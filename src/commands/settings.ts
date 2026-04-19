import { input, select } from '@inquirer/prompts';
import { loadConfig, loadKeys, saveConfig, getConfigPath } from '../utils/config.js';
import { resolveModel, listAliases } from '../providers/resolve.js';
import { createTheme, type Theme } from '../utils/theme.js';
import type { Provider } from '../providers/types.js';

const KEY_BY_PROVIDER: Record<Provider['name'], keyof ReturnType<typeof loadKeys>> = {
  anthropic:  'anthropic',
  openai:     'openai',
  openrouter: 'openrouter'
};

interface ModelChoice {
  value: string;
  label: string;
  description: string;
  requires: Provider['name'];
}

const SUGGESTIONS: ModelChoice[] = [
  { value: 'claude',                      label: 'claude',                      description: 'Anthropic Sonnet 4.6 — balanced', requires: 'anthropic'  },
  { value: 'claude-opus',                 label: 'claude-opus',                 description: 'Anthropic Opus 4.7 — smartest',   requires: 'anthropic'  },
  { value: 'claude-haiku',                label: 'claude-haiku',                description: 'Anthropic Haiku 4.5 — cheapest',  requires: 'anthropic'  },
  { value: 'gpt-5.4',                     label: 'gpt-5.4',                     description: 'OpenAI flagship',                 requires: 'openai'     },
  { value: 'gpt-5.4-mini',                label: 'gpt-5.4-mini',                description: 'OpenAI cheap + fast',             requires: 'openai'     },
  { value: 'o3-mini',                     label: 'o3-mini',                     description: 'OpenAI reasoning',                requires: 'openai'     },
  { value: 'anthropic/claude-3.5-sonnet', label: 'anthropic/claude-3.5-sonnet', description: 'Claude via OpenRouter',           requires: 'openrouter' },
  { value: 'openai/gpt-4o',               label: 'openai/gpt-4o',               description: 'GPT-4o via OpenRouter',           requires: 'openrouter' },
  { value: 'google/gemini-pro-1.5',       label: 'google/gemini-pro-1.5',       description: 'Gemini via OpenRouter',           requires: 'openrouter' }
];

function padToRight(left: string, right: string, width: number): string {
  const gap = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

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
  const keys = loadKeys();
  const configured = new Set<Provider['name']>();
  if (keys.anthropic)  configured.add('anthropic');
  if (keys.openai)     configured.add('openai');
  if (keys.openrouter) configured.add('openrouter');

  console.log('');
  console.log(` ${t.header('Default model')}  ${t.muted('— used when --model is omitted')}`);
  console.log(` ${t.muted('Current:  ')}${current.defaultModel ?? t.dim('(not set → falls back to "claude")')}`);
  console.log('');

  const suggestions = SUGGESTIONS.filter(m => configured.has(m.requires));
  const choices: Array<{ value: string; name: string }> = suggestions.map(m => ({
    value: m.value,
    name: padToRight(m.label, m.description, 54) +
      (m.value === current.defaultModel ? `  ${t.muted('(current)')}` : '')
  }));

  if (suggestions.length === 0) {
    choices.push({
      value: '__none__',
      name: padToRight('(no provider keys configured)', 'run `review init` first', 54)
    });
  }

  choices.push({ value: '__custom__',   name: padToRight('Custom…',          'type any model name', 54) });
  if (current.defaultModel) {
    choices.push({ value: '__clear__',  name: padToRight('Clear default',    'fall back to "claude"', 54) });
  }
  choices.push({ value: '__cancel__',   name: padToRight('Cancel',           'keep current setting', 54) });

  const pick = await select<string>({
    message: 'Pick a default:',
    choices,
    pageSize: Math.max(5, choices.length)
  });

  if (pick === '__cancel__' || pick === '__none__') return undefined;
  if (pick === '__clear__') return null;
  if (pick === '__custom__') {
    const raw = (await input({ message: 'Model name:' })).trim();
    if (!raw) return undefined;
    if (/\s/.test(raw) || raw.startsWith('--')) {
      throw new Error(`expected just a model name (e.g. "claude-opus" or "anthropic/claude-3.5-sonnet"), got: ${raw}`);
    }
    resolveModel(raw);
    return raw;
  }
  return pick;
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
