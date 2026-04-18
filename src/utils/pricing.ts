import type { Usage } from '../providers/types.js';

interface PricePerMillion {
  input: number;
  output: number;
  cachedInput?: number;
}

const PRICES: Record<string, PricePerMillion> = {
  'claude-opus-4-7':             { input: 15,   output: 75,  cachedInput: 1.50 },
  'claude-sonnet-4-6':           { input: 3,    output: 15,  cachedInput: 0.30 },
  'claude-haiku-4-5-20251001':   { input: 0.80, output: 4,   cachedInput: 0.08 },
  'gpt-4o':                      { input: 2.50, output: 10,  cachedInput: 1.25 },
  'gpt-4o-mini':                 { input: 0.15, output: 0.60 }
};

export function estimateCost(model: string, usage: Usage | undefined): number | null {
  if (!usage) return null;
  const price = PRICES[model];
  if (!price) return null;
  const cached = usage.cachedInputTokens ?? 0;
  const fresh = Math.max(0, usage.inputTokens - cached);
  const cachedRate = price.cachedInput ?? price.input * 0.1;
  const dollars =
    (fresh * price.input + cached * cachedRate + usage.outputTokens * price.output) / 1_000_000;
  return dollars;
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

export function formatUsd(dollars: number): string {
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  if (dollars < 1)    return `$${dollars.toFixed(3)}`;
  return `$${dollars.toFixed(2)}`;
}
