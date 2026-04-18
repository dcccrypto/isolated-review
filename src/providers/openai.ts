import OpenAI from 'openai';
import type { Provider, ReviewResponse, Usage } from './types.js';
import { buildReviewMessages } from '../prompts/reviewPrompt.js';
import { buildVerifyMessages } from '../prompts/verifyPrompt.js';
import { loadKeys } from '../utils/config.js';
import { parseReviewResult } from './parse.js';

function client() {
  const { openai } = loadKeys();
  if (!openai) throw new Error('no OpenAI API key found. set OPENAI_API_KEY or run `review keys`');
  return new OpenAI({ apiKey: openai });
}

function extractUsage(res: OpenAI.Chat.Completions.ChatCompletion): Usage | undefined {
  const u = res.usage;
  if (!u) return undefined;
  return {
    inputTokens: u.prompt_tokens,
    outputTokens: u.completion_tokens,
    cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? undefined
  };
}

async function call(model: string, system: string, user: string): Promise<ReviewResponse> {
  const res = await client().chat.completions.create({
    model,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user }
    ]
  });
  const raw = res.choices[0]?.message?.content ?? '';
  return { result: parseReviewResult(raw, 'openai'), usage: extractUsage(res) };
}

export const openaiProvider: Provider = {
  name: 'openai',
  async review(model, input) {
    const { system, user } = buildReviewMessages(input);
    return call(model, system, user);
  },
  async verify(model, input, prior) {
    const { system, user } = buildVerifyMessages(input, prior);
    return call(model, system, user);
  }
};
