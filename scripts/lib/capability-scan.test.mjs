import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, slugify } from './capability-scan.mjs';

test('parseFrontmatter reads quoted description', () => {
  const md = '---\nname: grill-me\ndescription: "Knowledge extraction interviewer"\n---\nbody';
  assert.deepEqual(parseFrontmatter(md), { name: 'grill-me', description: 'Knowledge extraction interviewer' });
});
test('parseFrontmatter reads unquoted description', () => {
  const md = '---\nname: recall\ndescription: Search memory tiers\n---\nx';
  assert.equal(parseFrontmatter(md).description, 'Search memory tiers');
});
test('parseFrontmatter returns nulls when missing', () => {
  assert.deepEqual(parseFrontmatter('no frontmatter here'), { name: null, description: null });
});
test('slugify lowercases and hyphenates', () => {
  assert.equal(slugify('Lead Magnets!'), 'lead-magnets');
});

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanSkillDir, deprecateMissing } from './capability-scan.mjs';

test('scanSkillDir returns one row per SKILL.md with parsed fields', () => {
  const root = mkdtempSync(join(tmpdir(), 'skills-'));
  mkdirSync(join(root, 'grill-me'));
  writeFileSync(join(root, 'grill-me', 'SKILL.md'),
    '---\nname: grill-me\ndescription: Knowledge extraction\n---\nbody');
  const rows = scanSkillDir(root, 'skill', 'business');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'skill');
  assert.equal(rows[0].slug, 'grill-me');
  assert.equal(rows[0].description, 'Knowledge extraction');
  assert.equal(rows[0].group, 'business');
});
test('deprecateMissing flags db slugs not in the fresh set', () => {
  const fresh = [{ kind: 'skill', slug: 'grill-me' }];
  const dbSlugs = [{ kind: 'skill', slug: 'grill-me' }, { kind: 'skill', slug: 'old-skill' }];
  assert.deepEqual(deprecateMissing(fresh, dbSlugs), [{ kind: 'skill', slug: 'old-skill' }]);
});
