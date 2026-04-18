import type { ReviewResult } from './types.js';

function stripCodeFences(s: string): string {
  const m = s.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return m && m[1] !== undefined ? m[1].trim() : s;
}

export function parseReviewResult(raw: string, providerLabel: string): ReviewResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${providerLabel}: empty response from model`);
  }
  const unwrapped = stripCodeFences(trimmed);
  try {
    return JSON.parse(unwrapped) as ReviewResult;
  } catch {
    throw new Error(`${providerLabel}: model returned non-JSON output\n--- raw ---\n${raw}`);
  }
}
