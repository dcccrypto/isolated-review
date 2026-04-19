import OpenAI from 'openai';
import type { Provider, ReviewResponse, Usage, OnToken, Effort } from './types.js';
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

// OpenAI reasoning models accept reasoning_effort. Values are model-dependent:
// - GPT-5.2+: 'none' | 'low' | 'medium' | 'high' | 'xhigh'
// - GPT-5.0 / earlier: 'minimal' | 'low' | 'medium' | 'high'
// - o-series (o1, o3, o4): 'low' | 'medium' | 'high'
// We pass the user's value through verbatim; the model returns 400 on mismatch.
function supportsReasoning(model: string): boolean {
  return /^(gpt-5|o[134])/.test(model);
}

function buildParams(model: string, system: string, user: string, effort?: Effort) {
  const base: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    max_tokens: 4096,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: system },
      { role: 'user'   as const, content: user }
    ]
  };
  if (effort && supportsReasoning(model)) {
    // reasoning_effort is accepted by GPT-5 / o-series but the SDK's static union
    // is narrower than the real API (which includes 'none', 'minimal', 'xhigh'
    // depending on the model). Object.assign bypasses the narrow typing while
    // the HTTP body still carries the string through verbatim.
    Object.assign(base, { reasoning_effort: effort });
  }
  return base;
}

async function call(model: string, system: string, user: string, effort?: Effort, onToken?: OnToken): Promise<ReviewResponse> {
  const base = buildParams(model, system, user, effort);

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
    return call(model, system, user, input.effort, onToken);
  },
  async verify(model, input, prior, onToken) {
    const { system, user } = buildVerifyMessages(input, prior);
    return call(model, system, user, input.effort, onToken);
  }
};
