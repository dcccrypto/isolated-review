import { describe, it, expect } from 'vitest';
import { buildReviewMessages } from '../src/prompts/reviewPrompt.js';
import { buildVerifyMessages } from '../src/prompts/verifyPrompt.js';
import type { ReviewInput, ReviewResult } from '../src/providers/types.js';

const input: ReviewInput = {
  filePath: 'src/a.ts',
  language: 'typescript',
  content: 'export const x = 1;',
  includePatch: false
};

describe('buildReviewMessages', () => {
  it('includes the spec system prompt verbatim', () => {
    const { system } = buildReviewMessages(input);
    expect(system).toContain('You are a deep code reviewer');
    expect(system).toContain('Avoid generic advice');
    expect(system).toContain('Return ONLY a JSON object');
  });

  it('embeds file body in a fenced block with language tag', () => {
    const { user } = buildReviewMessages(input);
    expect(user).toContain('```typescript\nexport const x = 1;\n```');
    expect(user).toContain('src/a.ts');
  });

  it('adds notes section when userNotes is set', () => {
    const { user } = buildReviewMessages({ ...input, userNotes: 'handles settlement' });
    expect(user).toContain('handles settlement');
  });

  it('requests patch fields when includePatch', () => {
    const { user } = buildReviewMessages({ ...input, includePatch: true });
    expect(user.toLowerCase()).toContain('patch');
  });
});

describe('buildVerifyMessages', () => {
  const prior: ReviewResult = { summary: 's', findings: [] };

  it('includes the spec verifier prompt verbatim', () => {
    const { system } = buildVerifyMessages(input, prior);
    expect(system).toContain('You are validating and refining a prior code review');
    expect(system).toContain('Return ONLY a JSON object');
  });

  it('embeds prior review as JSON under a heading', () => {
    const { user } = buildVerifyMessages(input, prior);
    expect(user).toContain('## Prior review');
    expect(user).toContain(JSON.stringify(prior, null, 2));
  });
});
