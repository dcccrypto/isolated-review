import { describe, it, expect } from 'vitest';
import { resolveModel } from '../src/providers/resolve.js';

describe('resolveModel', () => {
  it('aliases claude', () => {
    expect(resolveModel('claude')).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' });
  });

  it('aliases claude-opus', () => {
    expect(resolveModel('claude-opus')).toEqual({ provider: 'anthropic', model: 'claude-opus-4-6' });
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
