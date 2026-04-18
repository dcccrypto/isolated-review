import { createInterface, type Interface } from 'node:readline/promises';
import { loadKeys, saveKeys, getConfigPath, type Keys } from '../utils/config.js';
import { createTheme, type Theme } from '../utils/theme.js';

function mask(v: string | undefined): string {
  if (!v) return 'not set';
  if (v.length <= 8) return '••••';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export async function promptForKeys(rl: Interface, t: Theme): Promise<Keys> {
  const existing = loadKeys();
  console.log('');
  console.log(` ${t.header('API keys')}  ${t.muted('· one key per provider you plan to use')}`);
  console.log(' ' + t.muted(t.rule()));
  console.log(` ${t.muted('Anthropic  ')}${mask(existing.anthropic)}   ${t.dim('console.anthropic.com/settings/keys')}`);
  console.log(` ${t.muted('OpenAI     ')}${mask(existing.openai)}   ${t.dim('platform.openai.com/api-keys')}`);
  console.log(` ${t.muted('OpenRouter ')}${mask(existing.openrouter)}   ${t.dim('openrouter.ai/keys  (one key unlocks many models)')}`);
  console.log(' ' + t.muted(t.rule()));
  console.log(` ${t.dim('Leave blank to keep the current value. Type "-" to clear.')}`);
  console.log('');

  const a = (await rl.question(' Anthropic API key:  ')).trim();
  const o = (await rl.question(' OpenAI API key:     ')).trim();
  const r = (await rl.question(' OpenRouter API key: ')).trim();

  const patch: Keys = {};
  if (a === '-') patch.anthropic  = undefined; else if (a) patch.anthropic  = a;
  if (o === '-') patch.openai     = undefined; else if (o) patch.openai     = o;
  if (r === '-') patch.openrouter = undefined; else if (r) patch.openrouter = r;
  return patch;
}

export function applyKeyPatch(patch: Keys): { changed: boolean } {
  const existing = loadKeys();
  const changed =
    (patch.anthropic  !== undefined && patch.anthropic  !== existing.anthropic) ||
    (patch.openai     !== undefined && patch.openai     !== existing.openai) ||
    (patch.openrouter !== undefined && patch.openrouter !== existing.openrouter);
  if (!changed) return { changed: false };

  const merged: Keys = {
    anthropic:  patch.anthropic  !== undefined ? (patch.anthropic  || undefined) : existing.anthropic,
    openai:     patch.openai     !== undefined ? (patch.openai     || undefined) : existing.openai,
    openrouter: patch.openrouter !== undefined ? (patch.openrouter || undefined) : existing.openrouter
  };
  saveKeys(merged);
  return { changed: true };
}

export async function runKeysSetup(): Promise<string> {
  const t = createTheme();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let patch: Keys;
  try {
    patch = await promptForKeys(rl, t);
  } finally {
    rl.close();
  }
  const { changed } = applyKeyPatch(patch);
  if (!changed) return `\n ${t.muted('No changes.')}\n`;
  return `\n ${t.ok(t.sym.check)} Saved to ${t.accent(getConfigPath())} ${t.muted('(chmod 600)')}\n`;
}
