import OpenAI from 'openai';
import type { Provider, ReviewResult } from './types.js';
import { buildReviewMessages } from '../prompts/reviewPrompt.js';
import { buildVerifyMessages } from '../prompts/verifyPrompt.js';

function client() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  return new OpenAI();
}

async function call(model: string, system: string, user: string): Promise<ReviewResult> {
  const res = await client().chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user }
    ]
  });
  const raw = res.choices[0]?.message?.content ?? '';
  try {
    return JSON.parse(raw) as ReviewResult;
  } catch {
    throw new Error(`openai: model returned non-JSON output\n--- raw ---\n${raw}`);
  }
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
