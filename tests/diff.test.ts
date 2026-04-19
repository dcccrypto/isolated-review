import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getChangedLineRanges, formatRanges, isTracked } from '../src/utils/diff.js';

describe('getChangedLineRanges', () => {
  let repo: string;
  const cwd = process.cwd();

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'ir-diff-'));
    process.chdir(repo);
    execFileSync('git', ['init', '-q', '-b', 'main']);
    execFileSync('git', ['config', 'user.email', 'test@example.com']);
    execFileSync('git', ['config', 'user.name', 'Test']);

    writeFileSync(join(repo, 'file.ts'),
      ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'].join('\n') + '\n');
    execFileSync('git', ['add', '.']);
    execFileSync('git', ['commit', '-q', '-m', 'initial']);

    // Modify lines 2 and 4
    writeFileSync(join(repo, 'file.ts'),
      ['line 1', 'line two', 'line 3', 'line four', 'line 5'].join('\n') + '\n');
  });

  afterAll(() => {
    process.chdir(cwd);
    rmSync(repo, { recursive: true, force: true });
  });

  it('returns ranges for lines changed vs HEAD', () => {
    const ranges = getChangedLineRanges('file.ts', 'HEAD');
    const flat = ranges.flatMap(r => [r.startLine, r.endLine]);
    expect(flat).toContain(2);
    expect(flat).toContain(4);
  });

  it('throws a helpful error when base is unknown', () => {
    expect(() => getChangedLineRanges('file.ts', 'nonexistent-ref'))
      .toThrow(/--diff base not found/);
  });

  it('returns empty array when file is unchanged', () => {
    execFileSync('git', ['checkout', '--', 'file.ts']);
    const ranges = getChangedLineRanges('file.ts', 'HEAD');
    expect(ranges).toEqual([]);
  });
});

describe('formatRanges', () => {
  it('formats single-line and multi-line ranges', () => {
    expect(formatRanges([
      { startLine: 5 },
      { startLine: 10, endLine: 12 },
      { startLine: 20, endLine: 20 }
    ])).toBe('5, 10-12, 20');
  });
});

describe('isTracked', () => {
  it('returns false for a file outside any git repo', () => {
    expect(isTracked('/tmp/definitely-not-in-git.xyz')).toBe(false);
  });
});
