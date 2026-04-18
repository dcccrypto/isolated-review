import { createInterface } from 'node:readline/promises';
import { loadKeys, saveKeys, getConfigPath, type Keys } from '../utils/config.js';
import { createTheme } from '../utils/theme.js';

function mask(v: string | undefined): string {
  if (!v) return 'not set';
  if (v.length <= 8) return '••••';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export async function runKeysSetup(): Promise<string> {
  const t = createTheme();
  const existing = loadKeys();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const patch: Keys = {};
  try {
    console.log('');
    console.log(` ${t.header('review keys')}  ${t.muted('· configure API keys')}`);
    console.log(' ' + t.muted(t.rule()));
    console.log(` ${t.muted('Anthropic')}  ${mask(existing.anthropic)}`);
    console.log(` ${t.muted('OpenAI')}     ${mask(existing.openai)}`);
    console.log(' ' + t.muted(t.rule()));
    console.log(` ${t.dim('Leave blank to keep the current value. Type "-" to clear.')}`);
    console.log('');

    const a = (await rl.question(' Anthropic API key: ')).trim();
    const o = (await rl.question(' OpenAI API key: ')).trim();

    if (a === '-') patch.anthropic = undefined;
    else if (a) patch.anthropic = a;

    if (o === '-') patch.openai = undefined;
    else if (o) patch.openai = o;
  } finally {
    rl.close();
  }

  const changed =
    (patch.anthropic !== undefined && patch.anthropic !== existing.anthropic) ||
    (patch.openai    !== undefined && patch.openai    !== existing.openai);

  if (!changed) {
    return `\n ${t.muted('No changes.')}\n`;
  }

  const merged: Keys = {
    anthropic: patch.anthropic !== undefined ? (patch.anthropic || undefined) : existing.anthropic,
    openai:    patch.openai    !== undefined ? (patch.openai    || undefined) : existing.openai
  };

  saveKeys(merged);
  return `\n ${t.ok(t.sym.check)} Saved to ${t.accent(getConfigPath())} ${t.muted('(chmod 600)')}\n`;
}
