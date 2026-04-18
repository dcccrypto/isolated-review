import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ReviewResult, Usage } from '../src/providers/types.js';

const anthropicReview   = vi.fn();
const anthropicVerify   = vi.fn();
const openaiReview      = vi.fn();
const openaiVerify      = vi.fn();
const openrouterReview  = vi.fn();
const openrouterVerify  = vi.fn();

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

vi.mock('../src/providers/openrouter.js', () => ({
  openrouterProvider: {
    name: 'openrouter' as const,
    review: openrouterReview,
    verify: openrouterVerify
  }
}));

const tmp = () => mkdtempSync(join(tmpdir(), 'ir-review-'));

function makeFile(content = 'export const x = 1;\n', ext = 'ts') {
  const d = tmp();
  const p = join(d, `file.${ext}`);
  writeFileSync(p, content);
  return { dir: d, path: p };
}

function resp(result: ReviewResult, usage?: Usage) {
  return { result, usage };
}

describe('runReview', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    anthropicReview.mockReset();
    anthropicVerify.mockReset();
    openaiReview.mockReset();
    openaiVerify.mockReset();
    openrouterReview.mockReset();
    openrouterVerify.mockReset();
    process.env.IR_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'ir-review-cfg-'));
  });

  afterEach(() => {
    if (process.env.IR_CONFIG_DIR) rmSync(process.env.IR_CONFIG_DIR, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('runs a single-pass review through the Anthropic provider when model is claude', async () => {
    const payload: ReviewResult = {
      summary: 'Looks good.',
      findings: [{ title: 'Off-by-one', severity: 'critical', explanation: 'e' }]
    };
    anthropicReview.mockResolvedValue(resp(payload));

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    const out = await runReview(file.path, {
      model: 'claude', patch: false, json: false, plain: true
    });

    expect(anthropicReview).toHaveBeenCalledTimes(1);
    expect(openaiReview).not.toHaveBeenCalled();
    expect(anthropicReview.mock.calls[0]![0]).toBe('claude-sonnet-4-6');
    expect(out).toContain('review');
    expect(out).toContain('Looks good.');
    expect(out).toContain('Critical  (1)');
    rmSync(file.dir, { recursive: true });
  });

  it('routes gpt-* to the OpenAI provider', async () => {
    openaiReview.mockResolvedValue(resp({ summary: 's', findings: [] }));

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    await runReview(file.path, {
      model: 'gpt-4o', patch: false, json: true, plain: false
    });

    expect(openaiReview).toHaveBeenCalledTimes(1);
    expect(anthropicReview).not.toHaveBeenCalled();
    rmSync(file.dir, { recursive: true });
  });

  it('routes vendor/model to OpenRouter provider', async () => {
    openrouterReview.mockResolvedValue(resp({ summary: 's', findings: [] }));

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    await runReview(file.path, {
      model: 'anthropic/claude-3.5-sonnet', patch: false, json: true, plain: false
    });

    expect(openrouterReview).toHaveBeenCalledTimes(1);
    expect(openrouterReview.mock.calls[0]![0]).toBe('anthropic/claude-3.5-sonnet');
    rmSync(file.dir, { recursive: true });
  });

  it('runs a verifier pass and returns the refined result in the pretty output', async () => {
    const primary: ReviewResult = {
      summary: 'First pass.',
      findings: [{ title: 'Weak', severity: 'low', explanation: 'maybe' }]
    };
    const refined: ReviewResult = { summary: 'Refined pass.', findings: [] };
    openaiReview.mockResolvedValue(resp(primary));
    anthropicVerify.mockResolvedValue(resp(refined));

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    const out = await runReview(file.path, {
      model: 'gpt-4o', verify: 'claude', patch: false, json: false, plain: true
    });

    expect(openaiReview).toHaveBeenCalledTimes(1);
    expect(anthropicVerify).toHaveBeenCalledTimes(1);
    expect(anthropicVerify.mock.calls[0]![2]).toEqual(primary);
    expect(out).toContain('VERIFIED');
    expect(out).toContain('Refined pass.');
    expect(out).toContain('0 critical · 0 medium · 0 low');
    rmSync(file.dir, { recursive: true });
  });

  it('emits stable JSON for --json and returns verified result when verifier ran', async () => {
    const primary: ReviewResult = { summary: 'p', findings: [] };
    const refined: ReviewResult = { summary: 'r', findings: [] };
    anthropicReview.mockResolvedValue(resp(primary));
    openaiVerify.mockResolvedValue(resp(refined));

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
    openaiReview.mockResolvedValue(resp({ summary: 's', findings: [] }));

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

  it('falls back to defaultModel from config when --model is omitted', async () => {
    const { saveConfig } = await import('../src/utils/config.js');
    saveConfig({ defaultModel: 'claude-opus' });

    anthropicReview.mockResolvedValue(resp({ summary: 's', findings: [] }));

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    await runReview(file.path, { patch: false, json: true, plain: false });

    expect(anthropicReview.mock.calls[0]![0]).toBe('claude-opus-4-7');
    rmSync(file.dir, { recursive: true });
  });

  it('falls back to "claude" when neither --model nor defaultModel are set', async () => {
    anthropicReview.mockResolvedValue(resp({ summary: 's', findings: [] }));

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    await runReview(file.path, { patch: false, json: true, plain: false });

    expect(anthropicReview.mock.calls[0]![0]).toBe('claude-sonnet-4-6');
    rmSync(file.dir, { recursive: true });
  });

  it('--model takes precedence over defaultModel', async () => {
    const { saveConfig } = await import('../src/utils/config.js');
    saveConfig({ defaultModel: 'claude-opus' });

    openaiReview.mockResolvedValue(resp({ summary: 's', findings: [] }));

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    await runReview(file.path, {
      model: 'gpt-4o', patch: false, json: true, plain: false
    });

    expect(openaiReview.mock.calls[0]![0]).toBe('gpt-4o');
    expect(anthropicReview).not.toHaveBeenCalled();
    rmSync(file.dir, { recursive: true });
  });

  it('passes usage through to the pretty footer (tokens + cost)', async () => {
    const payload: ReviewResult = { summary: 's', findings: [] };
    const usage: Usage = { inputTokens: 2847, outputTokens: 893, cachedInputTokens: 1200 };
    anthropicReview.mockResolvedValue(resp(payload, usage));

    const { runReview } = await import('../src/commands/review.js');
    const file = makeFile();
    const out = await runReview(file.path, {
      model: 'claude-opus', patch: false, json: false, plain: true
    });

    expect(out).toMatch(/2\.8k in/);
    expect(out).toMatch(/1\.2k cached/);
    expect(out).toMatch(/893 out/);
    expect(out).toMatch(/\$/);
    rmSync(file.dir, { recursive: true });
  });
});
