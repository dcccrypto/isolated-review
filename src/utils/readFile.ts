import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const MAX_BYTES = 1_048_576;

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  py: 'python', rs: 'rust', go: 'go', java: 'java', rb: 'ruby',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp',
  cs: 'csharp', swift: 'swift', kt: 'kotlin', php: 'php',
  sh: 'bash', sql: 'sql', json: 'json', md: 'markdown',
  yml: 'yaml', yaml: 'yaml', toml: 'toml'
};

export async function readSourceFile(path: string) {
  const absolutePath = resolve(path);
  let size: number;
  try {
    size = (await stat(absolutePath)).size;
  } catch {
    throw new Error(`file not found: ${path}`);
  }

  if (size === 0) throw new Error('file is empty');
  if (size > MAX_BYTES) throw new Error('file exceeds 1 MB limit');

  const buf = await readFile(absolutePath);
  const head = buf.subarray(0, Math.min(8192, buf.length));
  if (head.includes(0)) throw new Error('file appears to be binary');

  const ext = extname(absolutePath).slice(1).toLowerCase();
  const language = EXT_TO_LANG[ext] ?? 'plaintext';
  return { absolutePath, language, content: buf.toString('utf8') };
}
