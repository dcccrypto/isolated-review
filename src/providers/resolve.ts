import type { Provider } from './types.js';

const ALIASES: Record<string, { provider: Provider['name']; model: string }> = {
  'claude':        { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'claude-sonnet': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'claude-opus':   { provider: 'anthropic', model: 'claude-opus-4-7' },
  'claude-haiku':  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }
};

export function resolveModel(name: string): { provider: Provider['name']; model: string } {
  if (name.startsWith('openrouter:')) {
    const rest = name.slice('openrouter:'.length);
    if (!rest) throw new Error('empty OpenRouter model id after "openrouter:"');
    return { provider: 'openrouter', model: rest };
  }
  if (name.includes('/')) return { provider: 'openrouter', model: name };

  const alias = ALIASES[name];
  if (alias) return alias;
  if (name.startsWith('claude-')) return { provider: 'anthropic', model: name };
  if (/^(gpt-|o[134]-)/.test(name)) return { provider: 'openai', model: name };

  throw new Error(`unknown model: ${name}. try a vendor/model id for OpenRouter (e.g. anthropic/claude-3.5-sonnet), a direct provider model (claude-*, gpt-*, o1/o3/o4-*), or an alias (claude, claude-sonnet, claude-opus, claude-haiku)`);
}

export function listAliases(): Array<{ alias: string; model: string; provider: Provider['name'] }> {
  return Object.entries(ALIASES).map(([alias, v]) => ({ alias, model: v.model, provider: v.provider }));
}
