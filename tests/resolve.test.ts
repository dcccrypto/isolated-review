import { describe, it, expect } from 'vitest';
import { resolveModel, listAliases } from '../src/providers/resolve.js';

describe('resolveModel', () => {
  it('aliases claude to the latest Sonnet', () => {
    expect(resolveModel('claude')).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
  });

  it('aliases claude-sonnet to the latest Sonnet', () => {
    expect(resolveModel('claude-sonnet')).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
  });

  it('aliases claude-opus to the latest Opus', () => {
    expect(resolveModel('claude-opus')).toEqual({ provider: 'anthropic', model: 'claude-opus-4-7' });
  });

  it('aliases claude-haiku to the latest Haiku', () => {
    expect(resolveModel('claude-haiku')).toEqual({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001' });
  });

  it('passes through explicit claude model', () => {
    expect(resolveModel('claude-3-5-haiku-latest')).toEqual({ provider: 'anthropic', model: 'claude-3-5-haiku-latest' });
  });

  it('routes gpt-* to openai', () => {
    expect(resolveModel('gpt-4o')).toEqual({ provider: 'openai', model: 'gpt-4o' });
    expect(resolveModel('gpt-5')).toEqual({ provider: 'openai', model: 'gpt-5' });
  });

  it('routes o-series to openai', () => {
    expect(resolveModel('o3-mini')).toEqual({ provider: 'openai', model: 'o3-mini' });
  });

  it('throws on unknown', () => {
    expect(() => resolveModel('mistral')).toThrow(/unknown model/);
  });
});

describe('listAliases', () => {
  it('returns every registered alias with its resolved model', () => {
    const aliases = listAliases();
    expect(aliases.map(a => a.alias).sort()).toEqual(['claude', 'claude-haiku', 'claude-opus', 'claude-sonnet']);
    for (const a of aliases) expect(a.provider).toBe('anthropic');
  });
});
