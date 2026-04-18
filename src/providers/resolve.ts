import type { Provider } from './types.js';

const ALIASES: Record<string, { provider: Provider['name']; model: string }> = {
  'claude':      { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
  'claude-opus': { provider: 'anthropic', model: 'claude-opus-4-6' }
};

export function resolveModel(name: string): { provider: Provider['name']; model: string } {
  const alias = ALIASES[name];
  if (alias) return alias;
  if (name.startsWith('claude-')) return { provider: 'anthropic', model: name };
  if (/^(gpt-|o[134]-)/.test(name)) return { provider: 'openai', model: name };
  throw new Error(`unknown model: ${name}. supported: claude, claude-opus, claude-*, gpt-*, o1/o3/o4-*`);
}
