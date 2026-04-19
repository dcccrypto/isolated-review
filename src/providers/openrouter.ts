import OpenAI from 'openai';
import type { Provider, ReviewResponse, Usage, OnToken, Effort } from './types.js';
import { buildReviewMessages } from '../prompts/reviewPrompt.js';
import { buildVerifyMessages } from '../prompts/verifyPrompt.js';
import { loadKeys } from '../utils/config.js';
import { parseReviewResult } from './parse.js';
import { withRetry } from './retry.js';

function client() {
  const { openrouter } = loadKeys();
  if (!openrouter) throw new Error('no OpenRouter API key found. set OPENROUTER_API_KEY or run `review keys`');
  return new OpenAI({
    apiKey: openrouter,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/dcccrypto/isolated-review',
      'X-Title': 'isolated-review'
    }
  });
}

function usageFrom(u: OpenAI.CompletionUsage | null | undefined): Usage | undefined {
  if (!u) return undefined;
  return {
    inputTokens: u.prompt_tokens,
    outputTokens: u.completion_tokens,
    cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? undefined
  };
}

function buildParams(model: string, system: string, user: string, effort?: Effort) {
  const base: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    max_tokens: 4096,
    messages: [
      { role: 'system' as const, content: system },
      { role: 'user'   as const, content: user }
    ]
  };
  if (effort) {
    // OpenRouter normalizes `reasoning.effort` across underlying providers.
    // https://openrouter.ai/docs/use-cases/reasoning-tokens
    Object.assign(base, { reasoning: { effort } });
  }
  return base;
}

async function call(model: string, system: string, user: string, effort?: Effort, onToken?: OnToken): Promise<ReviewResponse> {
  const base = buildParams(model, system, user, effort);

  if (!onToken) {
    const res = await withRetry(() => client().chat.completions.create(base));
    const raw = res.choices[0]?.message?.content ?? '';
    return { result: parseReviewResult(raw, 'openrouter'), usage: usageFrom(res.usage) };
  }

  return withRetry(async () => {
    const stream = await client().chat.completions.create({
      ...base,
      stream: true,
      stream_options: { include_usage: true }
    });
    let raw = '';
    let usage: Usage | undefined;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        raw += delta;
        onToken(delta);
      }
      if (chunk.usage) usage = usageFrom(chunk.usage);
    }
    return { result: parseReviewResult(raw, 'openrouter'), usage };
  });
}

export const openrouterProvider: Provider = {
  name: 'openrouter',
  async review(model, input, onToken) {
    const { system, user } = buildReviewMessages(input, input.promptName);
    return call(model, system, user, input.effort, onToken);
  },
  async verify(model, input, prior, onToken) {
    const { system, user } = buildVerifyMessages(input, prior);
    return call(model, system, user, input.effort, onToken);
  }
};
