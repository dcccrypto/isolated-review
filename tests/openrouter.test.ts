import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReviewInput, ReviewResult } from '../src/providers/types.js';

const mockCreate = vi.fn();
const ctorArgs: unknown[] = [];

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation((args: unknown) => {
    ctorArgs.push(args);
    return { chat: { completions: { create: mockCreate } } };
  })
}));

const input: ReviewInput = {
  filePath: 'src/a.ts',
  language: 'typescript',
  content: 'export const x = 1;',
  includePatch: false
};

describe('openrouterProvider', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    mockCreate.mockReset();
    ctorArgs.length = 0;
    process.env.OPENROUTER_API_KEY = 'or-test-key';
    process.env.IR_CONFIG_DIR = '/nonexistent-for-test';
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('throws a clean error when API key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { openrouterProvider } = await import('../src/providers/openrouter.js');
    await expect(openrouterProvider.review('anthropic/claude-3.5-sonnet', input))
      .rejects.toThrow(/no OpenRouter API key found/);
  });

  it('constructs the client with openrouter baseURL and attribution headers', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"s","findings":[]}' } }]
    });

    const { openrouterProvider } = await import('../src/providers/openrouter.js');
    await openrouterProvider.review('anthropic/claude-3.5-sonnet', input);

    const args = ctorArgs.at(-1) as { apiKey: string; baseURL: string; defaultHeaders: Record<string, string> };
    expect(args.apiKey).toBe('or-test-key');
    expect(args.baseURL).toBe('https://openrouter.ai/api/v1');
    expect(args.defaultHeaders['X-Title']).toBe('isolated-review');
  });

  it('sends the model name as provided (vendor/model format)', async () => {
    const payload: ReviewResult = {
      summary: 's',
      findings: [{ title: 't', severity: 'medium', explanation: 'e' }]
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload) } }],
      usage: { prompt_tokens: 80, completion_tokens: 40 }
    });

    const { openrouterProvider } = await import('../src/providers/openrouter.js');
    const { result, usage } = await openrouterProvider.review('anthropic/claude-3.5-sonnet', input);
    expect(result).toEqual(payload);
    expect(usage).toEqual({ inputTokens: 80, outputTokens: 40, cachedInputTokens: undefined });
    expect(mockCreate.mock.calls[0]![0].model).toBe('anthropic/claude-3.5-sonnet');
  });

  it('does NOT send response_format (portability across OpenRouter models) but sets max_tokens', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '{"summary":"s","findings":[]}' } }] });
    const { openrouterProvider } = await import('../src/providers/openrouter.js');
    await openrouterProvider.review('openai/gpt-4o', input);
    expect(mockCreate.mock.calls[0]![0].response_format).toBeUndefined();
    expect(mockCreate.mock.calls[0]![0].max_tokens).toBe(4096);
  });

  it('strips ```json code fences if a model returns them', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '```json\n{"summary":"fenced","findings":[]}\n```' } }]
    });
    const { openrouterProvider } = await import('../src/providers/openrouter.js');
    const { result } = await openrouterProvider.review('openai/gpt-4o', input);
    expect(result.summary).toBe('fenced');
  });

  it('throws descriptive error for non-JSON output', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'not json' } }] });
    const { openrouterProvider } = await import('../src/providers/openrouter.js');
    await expect(openrouterProvider.review('openai/gpt-4o', input))
      .rejects.toThrow(/openrouter: model returned non-JSON output[\s\S]*not json/);
  });
});
