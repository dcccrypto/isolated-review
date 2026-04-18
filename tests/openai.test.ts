import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReviewInput, ReviewResult } from '../src/providers/types.js';

const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } }
  }))
}));

const input: ReviewInput = {
  filePath: 'src/a.ts',
  language: 'typescript',
  content: 'export const x = 1;',
  includePatch: false
};

describe('openaiProvider', () => {
  const origKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (origKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = origKey;
  });

  it('throws a clean error when API key is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const { openaiProvider } = await import('../src/providers/openai.js');
    await expect(openaiProvider.review('gpt-4o', input))
      .rejects.toThrow(/OPENAI_API_KEY not set/);
  });

  it('requests json_object response format and parses the content', async () => {
    const payload: ReviewResult = {
      summary: 's',
      findings: [{ title: 't', severity: 'medium', explanation: 'e' }]
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload) } }]
    });

    const { openaiProvider } = await import('../src/providers/openai.js');
    const result = await openaiProvider.review('gpt-4o', input);

    expect(result).toEqual(payload);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0]![0];
    expect(args.model).toBe('gpt-4o');
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toContain('You are a deep code reviewer');
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toContain('export const x = 1;');
  });

  it('verify() routes through the verifier prompt', async () => {
    const prior: ReviewResult = { summary: 'p', findings: [] };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"refined","findings":[]}' } }]
    });

    const { openaiProvider } = await import('../src/providers/openai.js');
    const result = await openaiProvider.verify('gpt-4o', input, prior);

    expect(result.summary).toBe('refined');
    const args = mockCreate.mock.calls[0]![0];
    expect(args.messages[0].content).toContain('You are validating and refining a prior code review');
    expect(args.messages[1].content).toContain('## Prior review');
  });

  it('throws a descriptive error when the model returns non-JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }]
    });

    const { openaiProvider } = await import('../src/providers/openai.js');
    await expect(openaiProvider.review('gpt-4o', input))
      .rejects.toThrow(/openai: model returned non-JSON output[\s\S]*not json/);
  });

  it('handles missing content as empty string', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: {} }] });

    const { openaiProvider } = await import('../src/providers/openai.js');
    await expect(openaiProvider.review('gpt-4o', input))
      .rejects.toThrow(/non-JSON output/);
  });
});
