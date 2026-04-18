import Anthropic from '@anthropic-ai/sdk';
import type { Provider, ReviewResult } from './types.js';
import { buildReviewMessages } from '../prompts/reviewPrompt.js';
import { buildVerifyMessages } from '../prompts/verifyPrompt.js';

function client() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic();
}

async function call(model: string, system: string, user: string): Promise<ReviewResult> {
  const msg = await client().messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }]
  });
  const block = msg.content.find(b => b.type === 'text');
  const raw = block && block.type === 'text' ? block.text : '';
  try {
    return JSON.parse(raw) as ReviewResult;
  } catch {
    throw new Error(`anthropic: model returned non-JSON output\n--- raw ---\n${raw}`);
  }
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
