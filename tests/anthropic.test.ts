import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReviewInput, ReviewResult } from '../src/providers/types.js';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate }
  }))
}));

const input: ReviewInput = {
  filePath: 'src/a.ts',
  language: 'typescript',
  content: 'export const x = 1;',
  includePatch: false
};

describe('anthropicProvider', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.IR_CONFIG_DIR = '/nonexistent-for-test';
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('throws a clean error when API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { anthropicProvider } = await import('../src/providers/anthropic.js');
    await expect(anthropicProvider.review('claude-sonnet-4-5', input))
      .rejects.toThrow(/no Anthropic API key found/);
  });

  it('calls messages.create with system and user messages, parses JSON response', async () => {
    const payload: ReviewResult = {
      summary: 'looks fine',
      findings: [{ title: 't', severity: 'low', explanation: 'e' }]
    };
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(payload) }]
    });

    const { anthropicProvider } = await import('../src/providers/anthropic.js');
    const result = await anthropicProvider.review('claude-sonnet-4-5', input);

    expect(result).toEqual(payload);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0]![0];
    expect(args.model).toBe('claude-sonnet-4-5');
    expect(args.max_tokens).toBe(4096);
    expect(args.system).toContain('You are a deep code reviewer');
    expect(args.messages).toHaveLength(1);
    expect(args.messages[0].role).toBe('user');
    expect(args.messages[0].content).toContain('export const x = 1;');
  });

  it('verify() uses the verifier prompt and includes the prior review', async () => {
    const prior: ReviewResult = { summary: 'p', findings: [] };
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"summary":"v","findings":[]}' }]
    });

    const { anthropicProvider } = await import('../src/providers/anthropic.js');
    const result = await anthropicProvider.verify('claude-opus-4-6', input, prior);

    expect(result.summary).toBe('v');
    const args = mockCreate.mock.calls[0]![0];
    expect(args.system).toContain('You are validating and refining a prior code review');
    expect(args.messages[0].content).toContain('## Prior review');
    expect(args.messages[0].content).toContain('"summary": "p"');
  });

  it('throws a descriptive error when the model returns non-JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Here is some prose, not JSON.' }]
    });

    const { anthropicProvider } = await import('../src/providers/anthropic.js');
    await expect(anthropicProvider.review('claude-sonnet-4-5', input))
      .rejects.toThrow(/anthropic: model returned non-JSON output[\s\S]*Here is some prose/);
  });

  it('throws a labeled empty-response error when no text block is present', async () => {
    mockCreate.mockResolvedValue({ content: [] });

    const { anthropicProvider } = await import('../src/providers/anthropic.js');
    await expect(anthropicProvider.review('claude-sonnet-4-5', input))
      .rejects.toThrow(/anthropic: empty response from model/);
  });
});
