import OpenAI from 'openai';
import type { Provider, ReviewResult } from './types.js';
import { buildReviewMessages } from '../prompts/reviewPrompt.js';
import { buildVerifyMessages } from '../prompts/verifyPrompt.js';
import { loadKeys } from '../utils/config.js';
import { parseReviewResult } from './parse.js';

function client() {
  const { openai } = loadKeys();
  if (!openai) throw new Error('no OpenAI API key found. set OPENAI_API_KEY or run `review keys`');
  return new OpenAI({ apiKey: openai });
}

async function call(model: string, system: string, user: string): Promise<ReviewResult> {
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
  return parseReviewResult(raw, 'openai');
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
