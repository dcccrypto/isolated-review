import { describe, it, expect, beforeEach, vi } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ReviewResult } from '../src/providers/types.js';

const anthropicReview = vi.fn();
const anthropicVerify = vi.fn();
const openaiReview    = vi.fn();
const openaiVerify    = vi.fn();

vi.mock('../src/providers/anthropic.js', () => ({
  anthropicProvider: {
    name: 'anthropic' as const,
    review: anthropicReview,
    verify: anthropicVerify
  }
}));

vi.mock('../src/providers/openai.js', () => ({
  openaiProvider: {
    name: 'openai' as const,
    review: openaiReview,
    verify: openaiVerify
  }
}));

const tmp = () => mkdtempSync(join(tmpdir(), 'ir-review-'));

function makeFile(content = 'export const x = 1;\n', ext = 'ts') {
  const d = tmp();
  const p = join(d, `file.${ext}`);
  writeFileSync(p, content);
  return { dir: d, path: p };
}

describe('runReview', () => {
  beforeEach(() => {
    anthropicReview.mockReset();
    anthropicVerify.mockReset();
    openaiReview.mockReset();
    openaiVerify.mockReset();
  });

  it('runs a single-pass review through the Anthropic provider when model is claude', async () => {
    const payload: ReviewResult = {
      summary: 'Looks good.',
      findings: [{ title: 'Off-by-one', severity: 'critical', explanation: 'e' }]
    };
    anthropicReview.mockResolvedValue(payload);

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    const out = await runReview(file.path, {
      model: 'claude', patch: false, json: false, plain: true
    });

    expect(anthropicReview).toHaveBeenCalledTimes(1);
    expect(openaiReview).not.toHaveBeenCalled();
    expect(anthropicReview.mock.calls[0]![0]).toBe('claude-sonnet-4-5-20250929');
    expect(out).toContain('review');
    expect(out).toContain('Looks good.');
    expect(out).toContain('Critical  (1)');
    rmSync(file.dir, { recursive: true });
  });

  it('routes gpt-* to the OpenAI provider', async () => {
    const payload: ReviewResult = { summary: 's', findings: [] };
    openaiReview.mockResolvedValue(payload);

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    await runReview(file.path, {
      model: 'gpt-4o', patch: false, json: true, plain: false
    });

    expect(openaiReview).toHaveBeenCalledTimes(1);
    expect(anthropicReview).not.toHaveBeenCalled();
    rmSync(file.dir, { recursive: true });
  });

  it('runs a verifier pass and returns the refined result in the pretty output', async () => {
    const primary: ReviewResult = {
      summary: 'First pass.',
      findings: [{ title: 'Weak', severity: 'low', explanation: 'maybe' }]
    };
    const refined: ReviewResult = { summary: 'Refined pass.', findings: [] };
    openaiReview.mockResolvedValue(primary);
    anthropicVerify.mockResolvedValue(refined);

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    const out = await runReview(file.path, {
      model: 'gpt-4o', verify: 'claude', patch: false, json: false, plain: true
    });

    expect(openaiReview).toHaveBeenCalledTimes(1);
    expect(anthropicVerify).toHaveBeenCalledTimes(1);
    // verifier gets both the input and the prior result
    expect(anthropicVerify.mock.calls[0]![2]).toEqual(primary);
    expect(out).toContain('VERIFIED');
    expect(out).toContain('Refined pass.');
    // footer counts use the verified (final) result, which has zero findings
    expect(out).toContain('0 critical · 0 medium · 0 low');
    rmSync(file.dir, { recursive: true });
  });

  it('emits stable JSON for --json and returns verified result when verifier ran', async () => {
    const primary: ReviewResult = { summary: 'p', findings: [] };
    const refined: ReviewResult = { summary: 'r', findings: [] };
    anthropicReview.mockResolvedValue(primary);
    openaiVerify.mockResolvedValue(refined);

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    const out = await runReview(file.path, {
      model: 'claude', verify: 'gpt-4o', patch: false, json: true, plain: false
    });

    expect(() => JSON.parse(out)).not.toThrow();
    expect(JSON.parse(out)).toEqual(refined);
    rmSync(file.dir, { recursive: true });
  });

  it('passes userNotes and includePatch through to the provider input', async () => {
    openaiReview.mockResolvedValue({ summary: 's', findings: [] });

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    await runReview(file.path, {
      model: 'gpt-4o', notes: 'settlement logic', patch: true, json: true, plain: false
    });

    const input = openaiReview.mock.calls[0]![1];
    expect(input.userNotes).toBe('settlement logic');
    expect(input.includePatch).toBe(true);
    expect(input.language).toBe('typescript');
    rmSync(file.dir, { recursive: true });
  });

  it('propagates file-not-found errors from the reader', async () => {
    const { runReview } = await import('../src/commands/review.js');
    await expect(runReview('/no/such/file.ts', {
      model: 'claude', patch: false, json: false, plain: true
    })).rejects.toThrow(/file not found/);
  });

  it('propagates unknown-model errors from the resolver', async () => {
    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    await expect(runReview(file.path, {
      model: 'mistral', patch: false, json: false, plain: true
    })).rejects.toThrow(/unknown model/);
    rmSync(file.dir, { recursive: true });
  });

  it('propagates provider errors', async () => {
    anthropicReview.mockRejectedValue(new Error('429 rate limited'));

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    await expect(runReview(file.path, {
      model: 'claude', patch: false, json: false, plain: true
    })).rejects.toThrow(/429 rate limited/);
    rmSync(file.dir, { recursive: true });
  });
});
