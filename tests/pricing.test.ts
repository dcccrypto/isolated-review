import { describe, it, expect } from 'vitest';
import { estimateCost, formatTokens, formatUsd } from '../src/utils/pricing.js';

describe('estimateCost', () => {
  it('returns null when usage is undefined', () => {
    expect(estimateCost('claude-sonnet-4-6', undefined)).toBeNull();
  });

  it('returns null for unknown models', () => {
    expect(estimateCost('llama/super-secret', { inputTokens: 1000, outputTokens: 500 }))
      .toBeNull();
  });

  it('computes cost using fresh + cached + output rates', () => {
    // Sonnet: input $3/M, output $15/M, cached $0.30/M
    // 1,000,000 input = $3; but 500,000 cached at $0.30 = $0.15, 500,000 fresh at $3 = $1.50
    // 1,000,000 output at $15 = $15
    // total = $0.15 + $1.50 + $15 = $16.65
    const dollars = estimateCost('claude-sonnet-4-6', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cachedInputTokens: 500_000
    })!;
    expect(dollars).toBeCloseTo(16.65, 2);
  });

  it('handles no cached tokens gracefully', () => {
    const dollars = estimateCost('claude-haiku-4-5-20251001', {
      inputTokens: 1000, outputTokens: 500
    })!;
    // 1000 * 0.80 + 500 * 4 = 800 + 2000 = 2800 per 1M → 0.0028
    expect(dollars).toBeCloseTo(0.0028, 5);
  });
});

describe('formatTokens', () => {
  it('raw count under 1k', () => {
    expect(formatTokens(42)).toBe('42');
    expect(formatTokens(999)).toBe('999');
  });
  it('one decimal k under 10k', () => {
    expect(formatTokens(1234)).toBe('1.2k');
    expect(formatTokens(9876)).toBe('9.9k');
  });
  it('rounded k at 10k+', () => {
    expect(formatTokens(12_345)).toBe('12k');
    expect(formatTokens(1_234_567)).toBe('1235k');
  });
});

describe('formatUsd', () => {
  it('4 decimals under 1 cent', () => {
    expect(formatUsd(0.00123)).toBe('$0.0012');
  });
  it('3 decimals under a dollar', () => {
    expect(formatUsd(0.042)).toBe('$0.042');
  });
  it('2 decimals at a dollar or more', () => {
    expect(formatUsd(1.234)).toBe('$1.23');
    expect(formatUsd(12.345)).toBe('$12.35');
  });
});
