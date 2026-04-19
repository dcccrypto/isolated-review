import OpenAI from 'openai';
import type { Provider, ReviewResponse, Usage, OnToken } from './types.js';
import { buildReviewMessages } from '../prompts/reviewPrompt.js';
import { buildVerifyMessages } from '../prompts/verifyPrompt.js';
import { loadKeys } from '../utils/config.js';
import { parseReviewResult } from './parse.js';
import { withRetry } from './retry.js';

function client() {
  const { openai } = loadKeys();
  if (!openai) throw new Error('no OpenAI API key found. set OPENAI_API_KEY or run `review keys`');
  return new OpenAI({ apiKey: openai });
}

function usageFrom(u: OpenAI.CompletionUsage | null | undefined): Usage | undefined {
  if (!u) return undefined;
  return {
    inputTokens: u.prompt_tokens,
    outputTokens: u.completion_tokens,
    cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? undefined
  };
}

async function call(model: string, system: string, user: string, onToken?: OnToken): Promise<ReviewResponse> {
  const base = {
    model,
    max_tokens: 4096,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: system },
      { role: 'user'   as const, content: user }
    ]
  };

  if (!onToken) {
    const res = await withRetry(() => client().chat.completions.create(base));
    const raw = res.choices[0]?.message?.content ?? '';
    return { result: parseReviewResult(raw, 'openai'), usage: usageFrom(res.usage) };
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
    return { result: parseReviewResult(raw, 'openai'), usage };
  });
}

export const openaiProvider: Provider = {
  name: 'openai',
  async review(model, input, onToken) {
    const { system, user } = buildReviewMessages(input, input.promptName);
    return call(model, system, user, onToken);
  },
  async verify(model, input, prior, onToken) {
    const { system, user } = buildVerifyMessages(input, prior);
    return call(model, system, user, onToken);
  }
};
