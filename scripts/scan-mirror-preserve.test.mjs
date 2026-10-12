import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('a stale scan mirror preserves a newly published route and its deployed assets', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const match = workflow.match(/rsync ([^\n]+) dist\/ \/tmp\/product-site\/scan\//);
  assert.ok(match, 'scan mirror sync command exists');
  const root = mkdtempSync(join(tmpdir(), 'scan-mirror-'));
  try {
    const source = join(root, 'dist');
    const target = join(root, 'scan');
    for (const dir of [source, target, join(source, 'old'), join(source, 'assets'), join(target, 'old'), join(target, 'alvin'), join(target, 'assets')]) mkdirSync(dir, { recursive: true });
    writeFileSync(join(source, 'old/index.html'), 'updated old scan');
    writeFileSync(join(target, 'old/index.html'), 'old scan');
    writeFileSync(join(source, 'assets/new.js'), 'new app');
    writeFileSync(join(target, 'alvin/index.html'), '<script src="/scan/assets/live.js"></script>');
    writeFileSync(join(target, 'assets/live.js'), 'app used by the quick-published scan');
    writeFileSync(join(target, 'CNAME'), 'preserved');
    const run = spawnSync('rsync', [...match[1].trim().split(/\s+/), source + '/', target + '/'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.ok(existsSync(join(target, 'alvin/index.html')), 'quick-published route survived');
    assert.ok(existsSync(join(target, 'assets/live.js')), 'referenced app asset survived');
    assert.equal(readFileSync(join(target, 'old/index.html'), 'utf8'), 'updated old scan');
    assert.equal(readFileSync(join(target, 'CNAME'), 'utf8'), 'preserved');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
