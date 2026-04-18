import { createInterface, type Interface } from 'node:readline/promises';
import { loadConfig, saveConfig, getConfigPath } from '../utils/config.js';
import { resolveModel, listAliases } from '../providers/resolve.js';
import { createTheme, type Theme } from '../utils/theme.js';

export async function promptForDefaultModel(rl: Interface, t: Theme): Promise<string | null | undefined> {
  const current = loadConfig();
  console.log('');
  console.log(` ${t.header('Default model')}  ${t.muted('· used when --model is omitted')}`);
  console.log(' ' + t.muted(t.rule()));
  console.log(` ${t.muted('Current')}  ${current.defaultModel ?? t.dim('(not set → falls back to "claude")')}`);
  console.log(' ' + t.muted(t.rule()));
  console.log(` ${t.dim('Aliases:')}`);
  for (const a of listAliases()) {
    console.log(`   ${t.muted(a.alias.padEnd(14))} → ${a.model}`);
  }
  console.log(` ${t.dim('Or a direct name (claude-opus-4-7, gpt-5, o3-mini) or a vendor/model via OpenRouter (anthropic/claude-3.5-sonnet).')}`);
  console.log(` ${t.dim('Leave blank to keep the current value. Type "-" to clear.')}`);
  console.log('');

  const raw = (await rl.question(' Default model: ')).trim();
  if (!raw) return undefined;
  if (raw === '-') return null;
  if (/\s/.test(raw) || raw.startsWith('--')) {
    throw new Error(`expected just a model name (e.g. "claude-opus" or "anthropic/claude-3.5-sonnet"), got: ${raw}`);
  }
  resolveModel(raw);
  return raw;
}

export function applyDefaultModel(value: string | null | undefined): { changed: boolean; after?: string } {
  if (value === undefined) return { changed: false };
  saveConfig({ defaultModel: value ?? '' });
  return { changed: true, after: loadConfig().defaultModel };
}

export async function runSettings(): Promise<string> {
  const t = createTheme();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let choice: string | null | undefined;
  try {
    choice = await promptForDefaultModel(rl, t);
  } finally {
    rl.close();
  }
  const { changed, after } = applyDefaultModel(choice);
  if (!changed) return `\n ${t.muted('No changes.')}\n`;
  const label = after ?? t.dim('(cleared)');
  return `\n ${t.ok(t.sym.check)} Default model: ${t.accent(String(label))}\n   ${t.muted(`saved to ${getConfigPath()}`)}\n`;
}
