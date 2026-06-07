import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scanSkillDir, deprecateMissing, slugify } from './lib/capability-scan.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1); }
const db = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const HOME = homedir();
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const rows = [];
const skipped = [];

function safe(label, fn) {
  try { const r = fn(); if (Array.isArray(r)) rows.push(...r); }
  catch (e) { skipped.push(`${label}: ${e.message}`); }
}

function scanCmdSuite(pluginsRoot, group) {
  if (!existsSync(pluginsRoot)) return [];
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md') && /commands|skills/.test(dir)) {
        const md = readFileSync(p, 'utf8');
        const m = md.match(/^description:\s*["']?(.+?)["']?\s*$/m);
        const name = e.name.replace(/\.md$/, '');
        out.push({ kind: 'command', slug: slugify(name), name,
          description: m ? m[1].trim() : null, group, source_path: p, status: 'live' });
      }
    }
  };
  walk(pluginsRoot);
  return out;
}

function scanPanels(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('Panel.tsx'))
    .map((f) => {
      const name = f.replace(/\.tsx$/, '');
      return { kind: 'panel', slug: slugify(name), name,
        description: 'Dashboard panel', group: 'dashboard',
        source_path: join(dir, f), status: 'live' };
    });
}

function loadManifest(path) {
  const m = JSON.parse(readFileSync(path, 'utf8'));
  const out = [];
  for (const kind of ['integration', 'edge_fn']) {
    for (const r of m[kind] || []) {
      out.push({ kind, slug: r.slug, name: r.name, description: r.description,
        group: kind === 'edge_fn' ? 'supabase' : 'external', status: 'live' });
    }
  }
  return out;
}

function applyAdoption(allRows, projectsDir) {
  if (!existsSync(projectsDir)) return [];
  const counts = {};
  const last = {};
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.jsonl')) {
        let text; try { text = readFileSync(p, 'utf8'); } catch { continue; }
        const mtime = new Date(statSync(p).mtime).toISOString();
        for (const r of allRows) {
          if (r.kind !== 'skill' && r.kind !== 'command') continue;
          if (text.includes(`"${r.slug}"`)) {
            counts[r.slug] = (counts[r.slug] || 0) + 1;
            if (!last[r.slug] || mtime > last[r.slug]) last[r.slug] = mtime;
          }
        }
      }
    }
  };
  walk(projectsDir);
  for (const r of allRows) {
    r.invoke_count = counts[r.slug] || 0;
    r.last_used_at = last[r.slug] || null;
  }
  return [];
}

safe('skills', () => scanSkillDir(join(HOME, '.claude/skills'), 'skill', 'business'));
safe('commands', () => scanCmdSuite(join(HOME, '.claude/plugins'), 'gsd'));
safe('panels', () => scanPanels(join(REPO, 'components/dashboard')));
safe('manifest', () => loadManifest(join(HERE, 'aios-manifest.json')));
safe('adoption', () => applyAdoption(rows, join(HOME, '.claude/projects')));

const now = new Date().toISOString();
const payload = rows.map((r) => ({ ...r, invoke_count: r.invoke_count || 0,
  metadata: r.metadata || {}, synced_at: now }));

const { error: upErr } = await db.from('aios_capabilities')
  .upsert(payload, { onConflict: 'kind,slug' });
if (upErr) { console.error('upsert failed:', upErr.message); process.exit(1); }

const { data: dbRows } = await db.from('aios_capabilities').select('kind,slug');
const stale = deprecateMissing(payload, dbRows || []);
for (const s of stale) {
  await db.from('aios_capabilities').update({ status: 'deprecated', synced_at: now })
    .eq('kind', s.kind).eq('slug', s.slug);
}

console.log(`synced ${payload.length} rows, deprecated ${stale.length}` +
  (skipped.length ? `; skipped: ${skipped.join(' | ')}` : ''));
