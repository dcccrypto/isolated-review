import { loadConfig, getConfigPath } from '../utils/config.js';
import { listAllPrompts } from '../prompts/library.js';
import { createTheme } from '../utils/theme.js';
import { createRequire } from 'node:module';

function fingerprint(v: string): string {
  if (v.length <= 8) return `len=${v.length}`;
  return `len=${v.length} ${v.slice(0, 4)}…${v.slice(-4)}`;
}

function version(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../../package.json') as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function runStatus(): Promise<string> {
  const t = createTheme();
  const c = loadConfig();
  const prompts = listAllPrompts();
  const user = prompts.filter(p => p.source === 'user');
  const builtin = prompts.filter(p => p.source === 'builtin').map(p => p.name);

  const keyCell = (v: string | undefined) =>
    v ? t.ok(fingerprint(v)) : t.dim('not set');

  const lines: string[] = [];
  lines.push('');
  lines.push(` ${t.header('isolated-review')}  ${t.muted('v' + version())}`);
  lines.push(' ' + t.muted(t.rule()));
  lines.push(` ${t.muted('Config      ')}${getConfigPath()}`);
  lines.push(' ' + t.muted(t.rule()));
  lines.push(` ${t.muted('Anthropic   ')}${keyCell(c.anthropic)}`);
  lines.push(` ${t.muted('OpenAI      ')}${keyCell(c.openai)}`);
  lines.push(` ${t.muted('OpenRouter  ')}${keyCell(c.openrouter)}`);
  lines.push(' ' + t.muted(t.rule()));
  lines.push(` ${t.muted('Default     ')}${c.defaultModel ?? t.dim('(falls back to "claude")')}`);
  lines.push(' ' + t.muted(t.rule()));
  lines.push(` ${t.muted('Built-in prompts  ')}${builtin.join(', ')}`);
  lines.push(` ${t.muted('User prompts      ')}${user.length ? user.map(p => p.name).join(', ') : t.dim('(none — add with `review prompts new <name>`)')}`);
  lines.push('');
  return lines.join('\n');
}
