import Anthropic from '@anthropic-ai/sdk';
import type { Provider, ReviewResponse, Usage } from './types.js';
import { buildReviewMessages } from '../prompts/reviewPrompt.js';
import { buildVerifyMessages } from '../prompts/verifyPrompt.js';
import { loadKeys } from '../utils/config.js';
import { parseReviewResult } from './parse.js';

function client() {
  const { anthropic } = loadKeys();
  if (!anthropic) throw new Error('no Anthropic API key found. set ANTHROPIC_API_KEY or run `review keys`');
  return new Anthropic({ apiKey: anthropic });
}

function extractUsage(msg: Anthropic.Messages.Message): Usage {
  const u = msg.usage;
  const cached = (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  return {
    inputTokens:  u.input_tokens + cached,
    outputTokens: u.output_tokens,
    cachedInputTokens: u.cache_read_input_tokens ?? undefined
  };
}

async function call(model: string, system: string, user: string): Promise<ReviewResponse> {
  const msg = await client().messages.create({
    model,
    max_tokens: 4096,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }]
  });
  const block = msg.content.find(b => b.type === 'text');
  const raw = block && block.type === 'text' ? block.text : '';
  return { result: parseReviewResult(raw, 'anthropic'), usage: extractUsage(msg) };
}

export const anthropicProvider: Provider = {
  name: 'anthropic',
  async review(model, input) {
    const { system, user } = buildReviewMessages(input);
    return call(model, system, user);
  },
  async verify(model, input, prior) {
    const { system, user } = buildVerifyMessages(input, prior);
    return call(model, system, user);
  }
};
