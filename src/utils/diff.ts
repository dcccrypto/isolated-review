import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Location } from '../providers/types.js';

export function isTracked(filePath: string): boolean {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', resolve(filePath)], {
      stdio: ['ignore', 'ignore', 'ignore']
    });
    return true;
  } catch {
    return false;
  }
}

export function getChangedLineRanges(filePath: string, base: string): Location[] {
  const absolute = resolve(filePath);
  let output: string;
  try {
    output = execFileSync('git', ['diff', '--unified=0', base, '--', absolute], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not a git repository/i.test(msg)) {
      throw new Error('--diff requires a git repository');
    }
    if (/unknown revision|bad revision|ambiguous argument/i.test(msg)) {
      throw new Error(`--diff base not found: ${base}`);
    }
    throw new Error(`git diff failed: ${msg.split('\n')[0]}`);
  }

  const ranges: Location[] = [];
  for (const line of output.split('\n')) {
    const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!m) continue;
    const start = parseInt(m[1]!, 10);
    const count = m[2] !== undefined ? parseInt(m[2], 10) : 1;
    if (count === 0) continue;
    ranges.push({ startLine: start, endLine: start + count - 1 });
  }
  return ranges;
}

export function formatRanges(ranges: Location[]): string {
  return ranges
    .map(r => (r.endLine === undefined || r.endLine === r.startLine)
      ? `${r.startLine}`
      : `${r.startLine}-${r.endLine}`)
    .join(', ');
}
