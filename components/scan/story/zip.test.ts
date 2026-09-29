import {describe, expect, it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {crc32, zip} from './zip';

describe('zip', () => {
 it('matches the standard CRC-32', () => expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926));
 it('produces an archive unzip can extract', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-')), file = join(dir, 'kit.zip');
  writeFileSync(file, zip([{path: 'kit/a-skill/SKILL.md', text: '---\nname: a-skill\n---\n# Café ✓'}, {path: 'kit/README.md', text: 'hi'}]));
  execFileSync('unzip', ['-q', file, '-d', dir]);
  expect(readFileSync(join(dir, 'kit/a-skill/SKILL.md'), 'utf8')).toContain('Café ✓');
  expect(readFileSync(join(dir, 'kit/README.md'), 'utf8')).toBe('hi');
 });
});
