import { createInterface } from 'node:readline/promises';
import { loadConfig, saveConfig, getConfigPath } from '../utils/config.js';
import { resolveModel, listAliases } from '../providers/resolve.js';
import { createTheme } from '../utils/theme.js';

export async function runSettings(): Promise<string> {
  const t = createTheme();
  const current = loadConfig();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let newDefault: string | undefined | null = undefined; // undefined = no change, null = clear
  try {
    console.log('');
    console.log(` ${t.header('review settings')}  ${t.muted('· configure defaults')}`);
    console.log(' ' + t.muted(t.rule()));
    console.log(` ${t.muted('Default model')}  ${current.defaultModel ?? t.dim('(not set → falls back to "claude")')}`);
    console.log(' ' + t.muted(t.rule()));
    console.log('');
    console.log(` ${t.dim('Aliases:')}`);
    for (const a of listAliases()) {
      console.log(`   ${t.muted(a.alias.padEnd(14))} → ${a.model}`);
    }
    console.log(` ${t.dim('Or any explicit model name the SDK supports (e.g. gpt-5, claude-opus-4-7).')}`);
    console.log(` ${t.dim('Leave blank to keep the current value. Type "-" to clear.')}`);
    console.log('');

    const raw = (await rl.question(' Default model: ')).trim();
    if (raw === '-') newDefault = null;
    else if (raw) newDefault = raw;
  } finally {
    rl.close();
  }

  if (newDefault === undefined) return `\n ${t.muted('No changes.')}\n`;

  if (newDefault !== null) {
    if (/\s/.test(newDefault) || newDefault.startsWith('--')) {
      throw new Error(`expected just a model name (e.g. "claude-opus" or "claude-opus-4-7"), got: ${newDefault}`);
    }
    try { resolveModel(newDefault); }
    catch (e) {
      throw new Error(`${e instanceof Error ? e.message : String(e)}`);
    }
  }

  saveConfig({ defaultModel: newDefault ?? '' });
  const after = loadConfig();
  const label = after.defaultModel ?? t.dim('(cleared)');
  return `\n ${t.ok(t.sym.check)} Default model: ${t.accent(String(label))}\n   ${t.muted(`saved to ${getConfigPath()}`)}\n`;
}
