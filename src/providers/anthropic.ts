import Anthropic from '@anthropic-ai/sdk';
import type { Provider, ReviewResponse, Usage, OnToken, Effort } from './types.js';
import { buildReviewMessages } from '../prompts/reviewPrompt.js';
import { buildVerifyMessages } from '../prompts/verifyPrompt.js';
import { loadKeys } from '../utils/config.js';
import { parseReviewResult } from './parse.js';
import { withRetry } from './retry.js';

function client() {
  const { anthropic } = loadKeys();
  if (!anthropic) throw new Error('no Anthropic API key found. set ANTHROPIC_API_KEY or run `review keys`');
  return new Anthropic({ apiKey: anthropic });
}

function usageFrom(u: Anthropic.Messages.Usage): Usage {
  const cached = (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  return {
    inputTokens: u.input_tokens + cached,
    outputTokens: u.output_tokens,
    cachedInputTokens: u.cache_read_input_tokens ?? undefined
  };
}

// Anthropic 'thinking' takes a raw budget_tokens count (1024–32768 per docs).
// Level → budget mapping; 'none' and 'minimal' both disable thinking.
const THINKING_BUDGET: Record<Effort, number> = {
  none:    0,
  minimal: 0,
  low:     2048,
  medium:  8192,
  high:    16384,
  xhigh:   32768
};

function supportsThinking(model: string): boolean {
  return /claude-(opus|sonnet)-4/.test(model);
}

function buildParams(model: string, system: string, user: string, effort?: Effort) {
  const baseMax = 4096;
  const budget = effort && supportsThinking(model) ? THINKING_BUDGET[effort] : 0;
  const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: baseMax + budget,
    system: [{ type: 'text' as const, text: system, cache_control: { type: 'ephemeral' as const } }],
    messages: [{ role: 'user' as const, content: user }]
  };
  if (budget > 0) {
    params.thinking = { type: 'enabled', budget_tokens: budget };
  }
  return params;
}

async function call(model: string, system: string, user: string, effort?: Effort, onToken?: OnToken): Promise<ReviewResponse> {
  const params = buildParams(model, system, user, effort);

  if (!onToken) {
    const msg = await withRetry(() => client().messages.create(params));
    const block = msg.content.find(b => b.type === 'text');
    const raw = block && block.type === 'text' ? block.text : '';
    return { result: parseReviewResult(raw, 'anthropic'), usage: usageFrom(msg.usage) };
  }

  return withRetry(async () => {
    let raw = '';
    const stream = client().messages.stream(params)
      .on('text', (text) => { raw += text; onToken(text); });
    const finalMsg = await stream.finalMessage();
    return { result: parseReviewResult(raw, 'anthropic'), usage: usageFrom(finalMsg.usage) };
  });
}

export const anthropicProvider: Provider = {
  name: 'anthropic',
  async review(model, input, onToken) {
    const { system, user } = buildReviewMessages(input, input.promptName);
    return call(model, system, user, input.effort, onToken);
  },
  async verify(model, input, prior, onToken) {
    const { system, user } = buildVerifyMessages(input, prior);
    return call(model, system, user, input.effort, onToken);
  }
};
