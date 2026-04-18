import { describe, it, expect } from 'vitest';
import { parseReviewResult } from '../src/providers/parse.js';

describe('parseReviewResult', () => {
  it('parses a plain JSON string', () => {
    const r = parseReviewResult('{"summary":"s","findings":[]}', 'anthropic');
    expect(r).toEqual({ summary: 's', findings: [] });
  });

  it('strips ```json fences from wrapped output', () => {
    const r = parseReviewResult('```json\n{"summary":"fenced","findings":[]}\n```', 'openrouter');
    expect(r.summary).toBe('fenced');
  });

  it('strips plain ``` fences too', () => {
    const r = parseReviewResult('```\n{"summary":"plain-fence","findings":[]}\n```', 'openrouter');
    expect(r.summary).toBe('plain-fence');
  });

  it('throws a distinct error on empty response, labeled with provider', () => {
    expect(() => parseReviewResult('', 'openai'))
      .toThrow(/openai: empty response from model/);
    expect(() => parseReviewResult('   \n\n  ', 'anthropic'))
      .toThrow(/anthropic: empty response from model/);
  });

  it('throws non-JSON error with the raw body for debugging', () => {
    expect(() => parseReviewResult('not json at all', 'openai'))
      .toThrow(/openai: model returned non-JSON output[\s\S]*not json at all/);
  });
});
