import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSourceFiles } from '../src/commands/pick.js';

describe('listSourceFiles', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ir-pick-'));
    writeFileSync(join(root, 'a.ts'), 'x');
    writeFileSync(join(root, 'readme.md'), 'x');
    writeFileSync(join(root, 'binary.png'), 'x');
    writeFileSync(join(root, '.env'), 'x');

    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'index.ts'), 'x');
    writeFileSync(join(root, 'src', 'util.py'), 'x');

    mkdirSync(join(root, 'node_modules', 'bad'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'bad', 'b.ts'), 'x');

    mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'dist', 'out.js'), 'x');

    mkdirSync(join(root, '.git'));
    writeFileSync(join(root, '.git', 'HEAD'), 'x');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns source files recursively, sorted', async () => {
    const files = await listSourceFiles(root);
    expect(files).toEqual([
      'a.ts',
      'readme.md',
      'src/index.ts',
      'src/util.py'
    ]);
  });

  it('excludes node_modules, dist, .git, and dotfiles', async () => {
    const files = await listSourceFiles(root);
    expect(files.every(f => !f.includes('node_modules'))).toBe(true);
    expect(files.every(f => !f.includes('dist/'))).toBe(true);
    expect(files.every(f => !f.includes('.git'))).toBe(true);
    expect(files.every(f => !f.startsWith('.'))).toBe(true);
  });

  it('excludes non-source extensions (.png)', async () => {
    const files = await listSourceFiles(root);
    expect(files.some(f => f.endsWith('.png'))).toBe(false);
  });

  it('returns empty array when the directory has no source files', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'ir-pick-empty-'));
    mkdirSync(join(empty, 'node_modules'));
    writeFileSync(join(empty, 'node_modules', 'x.ts'), 'x');
    writeFileSync(join(empty, 'image.jpg'), 'x');
    try {
      const files = await listSourceFiles(empty);
      expect(files).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
