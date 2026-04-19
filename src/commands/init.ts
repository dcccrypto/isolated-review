import { checkbox, password, select, input } from '@inquirer/prompts';
import { readFileSync } from 'node:fs';
import { createTheme, type Theme } from '../utils/theme.js';
import { loadKeys, saveKeys, saveConfig, getConfigPath, type Keys } from '../utils/config.js';
import { warnIfKeyMissing } from './settings.js';
import { resolveModel } from '../providers/resolve.js';

type ProviderId = 'anthropic' | 'openai' | 'openrouter';

interface ProviderSpec {
  id: ProviderId;
  label: string;
  tagline: string;
  keysUrl: string;
}

const PROVIDERS: ProviderSpec[] = [
  { id: 'openrouter', label: 'OpenRouter', tagline: 'one key unlocks Claude, GPT, Gemini, Grok, Llama, etc.',  keysUrl: 'https://openrouter.ai/keys' },
  { id: 'anthropic',  label: 'Anthropic',  tagline: 'Claude direct — best narrative quality for code review',   keysUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai',     label: 'OpenAI',     tagline: 'GPT-5.x + o-series direct',                                keysUrl: 'https://platform.openai.com/api-keys' }
];

interface ModelSuggestion {
  value: string;
  label: string;
  description: string;
  requires: ProviderId;
}

const MODEL_SUGGESTIONS: ModelSuggestion[] = [
  { value: 'claude',                      label: 'claude',                      description: 'Anthropic Sonnet 4.6 — balanced, good default',  requires: 'anthropic'  },
  { value: 'claude-opus',                 label: 'claude-opus',                 description: 'Anthropic Opus 4.7 — smartest, pricier',         requires: 'anthropic'  },
  { value: 'claude-haiku',                label: 'claude-haiku',                description: 'Anthropic Haiku 4.5 — cheap + fast',              requires: 'anthropic'  },
  { value: 'gpt-5.4',                     label: 'gpt-5.4',                     description: 'OpenAI flagship',                                 requires: 'openai'     },
  { value: 'gpt-5.4-mini',                label: 'gpt-5.4-mini',                description: 'OpenAI cheap + fast',                             requires: 'openai'     },
  { value: 'o3-mini',                     label: 'o3-mini',                     description: 'OpenAI reasoning, cheap',                         requires: 'openai'     },
  { value: 'anthropic/claude-3.5-sonnet', label: 'anthropic/claude-3.5-sonnet', description: 'Claude via OpenRouter',                           requires: 'openrouter' },
  { value: 'openai/gpt-4o',               label: 'openai/gpt-4o',               description: 'GPT-4o via OpenRouter',                           requires: 'openrouter' },
  { value: 'google/gemini-pro-1.5',       label: 'google/gemini-pro-1.5',       description: 'Gemini via OpenRouter — long context',            requires: 'openrouter' }
];

function fingerprint(v: string): string {
  if (v.length <= 8) return `len=${v.length}`;
  return `len=${v.length} ${v.slice(0, 4)}…${v.slice(-4)}`;
}

function padToRight(left: string, right: string, width: number): string {
  const gap = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

function recommended(configured: Set<ProviderId>): string | undefined {
  if (configured.has('anthropic')) return 'claude';
  if (configured.has('openrouter')) return 'anthropic/claude-3.5-sonnet';
  if (configured.has('openai')) return 'gpt-5.4-mini';
  return undefined;
}

async function askProviders(t: Theme, existing: Keys): Promise<ProviderId[]> {
  const choices = PROVIDERS.map(p => {
    const has = !!existing[p.id];
    return {
      value: p.id,
      name: has
        ? `${p.label.padEnd(11)}${t.muted(p.tagline)}  ${t.ok('(already set)')}`
        : `${p.label.padEnd(11)}${t.muted(p.tagline)}`,
      checked: !has
    };
  });
  console.log('');
  console.log(` ${t.header('Providers')}  ${t.muted('— space to toggle, enter to confirm. You only need one.')}`);
  return checkbox<ProviderId>({
    message: 'Configure which providers?',
    choices
  });
}

async function askKeyFor(p: ProviderSpec, t: Theme): Promise<string | null> {
  console.log('');
  console.log(` ${t.header(p.label)}  ${t.muted(p.tagline)}`);
  console.log(` ${t.dim('get one at')} ${t.accent(p.keysUrl)}`);
  console.log(` ${t.dim('input is hidden. leave blank to skip. if pastes truncate, use --from-stdin afterward.')}`);
  const raw = await password({ message: `${p.label} API key:`, mask: '*' });
  const trimmed = raw.replace(/[\r\n]+/g, '');
  if (!trimmed) return null;
  return trimmed;
}

async function askDefaultModel(t: Theme, configured: Set<ProviderId>): Promise<string | null> {
  const filtered = MODEL_SUGGESTIONS.filter(m => configured.has(m.requires));
  if (filtered.length === 0) return null;

  const rec = recommended(configured);
  const choices = filtered.map(m => {
    const isRec = m.value === rec;
    const suffix = isRec ? `  ${t.ok('(recommended)')}` : '';
    return {
      value: m.value,
      name: padToRight(`${m.label}`, m.description, 54) + suffix
    };
  });
  choices.push({ value: '__custom__', name: 'Custom…' + ' '.repeat(50 - 9) + t.muted('type any model name') });
  choices.push({ value: '__skip__',   name: 'Skip for now' });

  console.log('');
  console.log(` ${t.header('Default model')}  ${t.muted('— used when you run `review <file>` without --model')}`);
  const pick = await select<string>({
    message: 'Default model:',
    choices,
    default: rec,
    pageSize: Math.max(5, choices.length)
  });

  if (pick === '__skip__') return null;
  if (pick === '__custom__') {
    const raw = (await input({ message: 'Enter model name:' })).trim();
    if (!raw) return null;
    try { resolveModel(raw); }
    catch (e) { throw new Error(e instanceof Error ? e.message : String(e)); }
    return raw;
  }
  return pick;
}

export interface InitOpts {
  provider?: ProviderId;
  key?: string;
  defaultModel?: string;
  yes?: boolean;
}

function readKeyArg(raw: string): string {
  if (raw === '-') {
    if (process.stdin.isTTY) {
      throw new Error('--key - requires piped input. Try: printf %s "$KEY" | review init --key - --provider <name>  (or use --key @/path/to/file instead)');
    }
    return readFileSync(0, 'utf8').replace(/[\r\n]+/g, '');
  }
  if (raw.startsWith('@')) return readFileSync(raw.slice(1), 'utf8').replace(/[\r\n]+/g, '');
  return raw;
}

export async function runInitNonInteractive(opts: InitOpts): Promise<string> {
  const t = createTheme();
  const existing = loadKeys();

  const saved: Array<[ProviderId, string]> = [];
  if (opts.provider && opts.key) {
    const value = readKeyArg(opts.key).trim();
    if (!value) throw new Error('--key was empty');
    const merged: Keys = {
      anthropic:  existing.anthropic,
      openai:     existing.openai,
      openrouter: existing.openrouter,
      [opts.provider]: value
    };
    saveKeys(merged);
    saved.push([opts.provider, value]);
  } else if (opts.provider && !opts.key) {
    throw new Error('--provider requires --key (use "-" for stdin or "@file" for a file)');
  } else if (!opts.provider && opts.key) {
    throw new Error('--key requires --provider <anthropic|openai|openrouter>');
  }

  if (opts.defaultModel) {
    resolveModel(opts.defaultModel);
    saveConfig({ defaultModel: opts.defaultModel });
  }

  const lines: string[] = ['', ` ${t.ok(t.sym.check)} ${t.header('Setup complete')}`];
  for (const [id, v] of saved) {
    lines.push(`   ${t.muted(id.padEnd(10))}${t.dim(fingerprint(v))}`);
  }
  if (opts.defaultModel) lines.push(`   ${t.muted('default'.padEnd(10))}${t.accent(opts.defaultModel)}`);
  lines.push(`   ${t.muted('config'.padEnd(10))}${t.dim(getConfigPath())}`);
  lines.push('');
  return lines.join('\n');
}

export async function runInit(opts: InitOpts = {}): Promise<string> {
  if (opts.provider !== undefined || opts.key !== undefined || opts.defaultModel !== undefined || opts.yes) {
    return runInitNonInteractive(opts);
  }

  const t = createTheme();
  const existing = loadKeys();

  console.log('');
  console.log(` ${t.header('review init')}  ${t.muted('· one-shot setup')}`);

  const selected = await askProviders(t, existing);
  const configured = new Set<ProviderId>(
    (['anthropic', 'openai', 'openrouter'] as ProviderId[]).filter(id => existing[id])
  );

  const patch: Keys = {};
  const saved: Array<[ProviderId, string]> = [];
  const skipped: ProviderId[] = [];

  for (const id of selected) {
    const p = PROVIDERS.find(x => x.id === id)!;
    const key = await askKeyFor(p, t);
    if (key) {
      patch[id] = key;
      configured.add(id);
      saved.push([id, key]);
    } else {
      skipped.push(id);
    }
  }

  if (Object.keys(patch).length > 0) {
    saveKeys({
      anthropic:  patch.anthropic  ?? existing.anthropic,
      openai:     patch.openai     ?? existing.openai,
      openrouter: patch.openrouter ?? existing.openrouter
    });
  }

  let chosenModel: string | null = null;
  if (configured.size > 0) {
    chosenModel = await askDefaultModel(t, configured);
    if (chosenModel) saveConfig({ defaultModel: chosenModel });
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(' ' + t.muted(t.rule()));
  lines.push(` ${t.ok(t.sym.check)} ${t.header('Setup complete')}`);

  if (saved.length) {
    for (const [id, key] of saved) {
      lines.push(`   ${t.muted(id.padEnd(10))}${t.dim(fingerprint(key))}`);
    }
  }
  if (skipped.length) {
    lines.push(`   ${t.muted('skipped'.padEnd(10))}${t.dim(skipped.join(', ') + ' — add later via `review keys`')}`);
  }
  if (chosenModel) {
    lines.push(`   ${t.muted('default'.padEnd(10))}${t.accent(chosenModel)}`);
  } else if (configured.size > 0) {
    lines.push(`   ${t.muted('default'.padEnd(10))}${t.dim('(not set — falls back to "claude")')}`);
  }
  lines.push(`   ${t.muted('config'.padEnd(10))}${t.dim(getConfigPath())}`);

  if (chosenModel) {
    const warn = warnIfKeyMissing(chosenModel, t);
    if (warn) lines.push('', warn);
  }

  if (configured.size === 0) {
    lines.push('', ` ${t.muted('No keys configured. Run')} ${t.accent('review init')} ${t.muted('again, or set env vars and go.')}`);
  } else {
    lines.push('', ` ${t.dim('Next:')} ${t.accent('review --pick')} ${t.dim('— pick any file from here with arrow keys.')}`);
  }
  lines.push('');
  return lines.join('\n');
}
