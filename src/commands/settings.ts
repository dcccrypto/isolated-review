import { input } from '@inquirer/prompts';
import { loadConfig, loadKeys, saveConfig, getConfigPath } from '../utils/config.js';
import { resolveModel, listAliases } from '../providers/resolve.js';
import { createTheme, type Theme } from '../utils/theme.js';
import type { Provider } from '../providers/types.js';

const KEY_BY_PROVIDER: Record<Provider['name'], keyof ReturnType<typeof loadKeys>> = {
  anthropic:  'anthropic',
  openai:     'openai',
  openrouter: 'openrouter'
};

export function warnIfKeyMissing(model: string, t: Theme): string | null {
  try {
    const { provider } = resolveModel(model);
    const keys = loadKeys();
    if (!keys[KEY_BY_PROVIDER[provider]]) {
      return ` ${t.medium(t.sym.medium)} ${t.header('Warning')}: no ${provider} API key set. Run ${t.accent('review keys')} to add one before running a review.`;
    }
  } catch { /* invalid model will surface elsewhere */ }
  return null;
}

export async function promptForDefaultModel(t: Theme): Promise<string | null | undefined> {
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
  console.log(` ${t.dim('Or a direct name (claude-opus-4-7, gpt-5.4, o3-mini) or a vendor/model via OpenRouter (anthropic/claude-3.5-sonnet).')}`);
  console.log(` ${t.dim('Leave blank to keep the current value. Type "-" to clear.')}`);
  console.log('');

  const raw = (await input({ message: 'Default model:' })).trim();
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
  const choice = await promptForDefaultModel(t);
  const { changed, after } = applyDefaultModel(choice);
  if (!changed) return `\n ${t.muted('No changes.')}\n`;
  const label = after ?? t.dim('(cleared)');
  const warn = after ? warnIfKeyMissing(after, t) : null;
  const lines = [
    '',
    ` ${t.ok(t.sym.check)} Default model: ${t.accent(String(label))}`,
    `   ${t.muted(`saved to ${getConfigPath()}`)}`
  ];
  if (warn) lines.push('', warn);
  lines.push('');
  return lines.join('\n');
}
