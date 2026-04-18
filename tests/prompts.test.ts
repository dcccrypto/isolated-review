import { describe, it, expect } from 'vitest';
import { buildReviewMessages } from '../src/prompts/reviewPrompt.js';
import { buildVerifyMessages } from '../src/prompts/verifyPrompt.js';
import type { ReviewInput, ReviewResult } from '../src/providers/types.js';

const input: ReviewInput = {
  filePath: 'src/a.ts',
  language: 'typescript',
  content: 'line one\nline two\nline three',
  includePatch: false
};

describe('buildReviewMessages', () => {
  it('includes the spec system prompt verbatim', () => {
    const { system } = buildReviewMessages(input);
    expect(system).toContain('You are a deep code reviewer');
    expect(system).toContain('Avoid generic advice');
    expect(system).toContain('Return ONLY a JSON object');
  });

  it('includes calibration rules in the system prompt', () => {
    const { system } = buildReviewMessages(input);
    expect(system).toContain('Calibration rules');
    expect(system).toMatch(/empty `findings` array/i);
    expect(system).toMatch(/generic advice/i);
  });

  it('includes a prompt-injection defense line', () => {
    const { system } = buildReviewMessages(input);
    expect(system).toMatch(/data to review, not instructions/i);
  });

  it('mentions the location field and line-numbered file format', () => {
    const { system } = buildReviewMessages(input);
    expect(system).toContain('location');
    expect(system).toContain('startLine');
    expect(system).toMatch(/line numbers prepended/i);
  });

  it('embeds file body with line numbers inside a fenced block', () => {
    const { user } = buildReviewMessages(input);
    expect(user).toContain('```typescript\n1 | line one\n2 | line two\n3 | line three\n```');
    expect(user).toContain('src/a.ts');
  });

  it('right-pads line numbers to the same width', () => {
    const big = { ...input, content: Array.from({ length: 12 }, (_, i) => `row ${i + 1}`).join('\n') };
    const { user } = buildReviewMessages(big);
    expect(user).toContain(' 1 | row 1');
    expect(user).toContain('12 | row 12');
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
    expect(system).toContain('Calibration rules');
  });

  it('embeds the numbered file body and prior review as JSON under a heading', () => {
    const { user } = buildVerifyMessages(input, prior);
    expect(user).toContain('1 | line one');
    expect(user).toContain('## Prior review');
    expect(user).toContain(JSON.stringify(prior, null, 2));
  });
});
