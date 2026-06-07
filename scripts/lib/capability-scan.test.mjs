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
