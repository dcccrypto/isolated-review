import { describe, it, expect } from 'vitest';
import { toMarkdown } from '../src/utils/markdown.js';
import type { ReviewResult } from '../src/providers/types.js';

describe('toMarkdown', () => {
  const baseResult: ReviewResult = {
    summary: 'Short gist of the review.',
    findings: [
      {
        title: 'Off-by-one',
        severity: 'critical',
        category: 'correctness',
        location: { startLine: 42, endLine: 48 },
        snippet: 'for (let i = 0; i <= arr.length; i++) { use(arr[i]); }',
        explanation: 'Loop runs one past the last index.',
        fix: 'Change `<=` to `<`.'
      },
      {
        title: 'Naming',
        severity: 'low',
        category: 'style',
        location: { startLine: 7 },
        explanation: 'Unclear variable name `x`.'
      }
    ]
  };

  it('produces pasteable markdown with counts, model, and tokens', () => {
    const md = toMarkdown({
      filePath: '/tmp/src/foo.ts',
      model: 'claude-opus-4-7',
      result: baseResult,
      elapsedMs: 4200,
      usage: { inputTokens: 2847, outputTokens: 893, cachedInputTokens: 1200 }
    });
    expect(md).toContain('### Review: `foo.ts`');
    expect(md).toContain('claude-opus-4-7');
    expect(md).toContain('4.2s');
    expect(md).toContain('2.8k in');
    expect(md).toContain('1.2k cached');
    expect(md).toContain('893 out');
    expect(md).toContain('1 critical · 0 medium · 1 low');
    expect(md).toContain('Short gist of the review.');
    expect(md).toContain('#### Critical (1)');
    expect(md).toContain('- **Off-by-one** `foo.ts:42-48` _(correctness)_');
    expect(md).toContain('**Fix:** Change `<=` to `<`.');
    expect(md).toContain('#### Low (1)');
    expect(md).not.toContain('#### Medium');
  });

  it('links back to the project at the bottom', () => {
    const md = toMarkdown({
      filePath: 'foo.ts', model: 'claude', result: { summary: 's', findings: [] }
    });
    expect(md).toContain('isolated-review');
  });

  it('shows verifier model with arrow notation when set', () => {
    const md = toMarkdown({
      filePath: 'foo.ts',
      model: 'claude-sonnet-4-6',
      verifierModel: 'claude-opus-4-7',
      result: { summary: 's', findings: [] }
    });
    expect(md).toContain('claude-sonnet-4-6 → claude-opus-4-7');
  });
});
