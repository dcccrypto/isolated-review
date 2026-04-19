import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { search } from '@inquirer/prompts';

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', 'out', 'target', 'bin', 'obj',
  '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache', '.vercel',
  'coverage', '.nyc_output',
  '__pycache__', '.pytest_cache',
  '.venv', 'venv', 'env',
  '.idea', '.vscode'
]);

const SOURCE_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'rs', 'go', 'java', 'rb',
  'c', 'h', 'cpp', 'cc', 'hpp', 'cs',
  'swift', 'kt', 'php', 'sh', 'bash',
  'sql', 'md', 'yml', 'yaml', 'toml', 'json',
  'vue', 'svelte', 'astro', 'lua', 'ex', 'exs', 'erl', 'scala', 'clj'
]);

async function* walk(dir: string, base: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full, base);
    } else if (entry.isFile()) {
      const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
      if (!SOURCE_EXT.has(ext)) continue;
      yield relative(base, full);
    }
  }
}

export async function listSourceFiles(cwd: string): Promise<string[]> {
  const files: string[] = [];
  for await (const f of walk(cwd, cwd)) files.push(f);
  files.sort((a, b) => a.localeCompare(b));
  return files;
}

export async function pickFile(cwd: string = process.cwd()): Promise<string> {
  if (!process.stdout.isTTY) {
    throw new Error('--pick needs an interactive terminal. Pass a file path directly instead.');
  }
  const files = await listSourceFiles(cwd);
  if (files.length === 0) {
    throw new Error(`no source files found in ${cwd}`);
  }
  const selected = await search<string>({
    message: 'Pick a file to review',
    source: (term) => {
      const q = (term ?? '').toLowerCase();
      const matches = !q ? files : files.filter(f => f.toLowerCase().includes(q));
      return matches.slice(0, 50).map(value => ({ value, name: value }));
    }
  });
  return join(cwd, selected);
}
