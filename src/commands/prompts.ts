import { listAllPrompts } from '../prompts/library.js';
import { createTheme } from '../utils/theme.js';
import { getConfigDir } from '../utils/config.js';
import { join } from 'node:path';

export async function runListPrompts(): Promise<string> {
  const t = createTheme();
  const prompts = listAllPrompts();
  const lines: string[] = [];
  lines.push('');
  lines.push(` ${t.header('review prompts')}  ${t.muted('· available prompt presets')}`);
  lines.push(' ' + t.muted(t.rule()));
  for (const p of prompts) {
    const tag = p.source === 'user' ? t.accent('[user]') : t.muted('[builtin]');
    lines.push(` ${t.header(p.name.padEnd(10))}${tag}  ${t.muted(p.description)}`);
  }
  lines.push(' ' + t.muted(t.rule()));
  lines.push(` ${t.dim('Use with')} ${t.accent('review <file> --prompt <name>')}`);
  lines.push(` ${t.dim('Add your own as')} ${t.accent(join(getConfigDir(), 'prompts', '<name>.md'))}`);
  lines.push('');
  return lines.join('\n');
}
