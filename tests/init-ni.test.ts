import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init.js';

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('runInit non-interactive', () => {
  let dir: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ir-init-ni-'));
    process.env.IR_CONFIG_DIR = dir;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('saves a literal --key for the chosen provider', async () => {
    const out = plain(await runInit({ provider: 'anthropic', key: 'sk-ant-' + 'A'.repeat(100), yes: true }));
    const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
    expect(cfg.anthropic).toMatch(/^sk-ant-A+$/);
    expect(out).toContain('Setup complete');
    expect(out).toMatch(/anthropic\s+len=107/);
  });

  it('reads --key from @path', async () => {
    const keyPath = join(dir, 'or-key.txt');
    writeFileSync(keyPath, 'sk-or-' + 'B'.repeat(70) + '\n');
    await runInit({ provider: 'openrouter', key: `@${keyPath}`, yes: true });
    const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
    expect(cfg.openrouter).toBe('sk-or-' + 'B'.repeat(70));
    expect(cfg.openrouter).not.toContain('\n');
  });

  it('sets defaultModel and validates via resolveModel', async () => {
    await runInit({ provider: 'anthropic', key: 'sk-ant-' + 'x'.repeat(100), defaultModel: 'claude-opus', yes: true });
    const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
    expect(cfg.defaultModel).toBe('claude-opus');
  });

  it('rejects an unresolvable default model', async () => {
    await expect(
      runInit({ provider: 'anthropic', key: 'sk-ant-' + 'y'.repeat(100), defaultModel: 'not-a-real-model', yes: true })
    ).rejects.toThrow(/unknown model/);
  });

  it('errors if --provider is given without --key', async () => {
    await expect(runInit({ provider: 'anthropic', yes: true })).rejects.toThrow(/--provider requires --key/);
  });

  it('errors if --key is given without --provider', async () => {
    await expect(runInit({ key: 'sk-ant-abc', yes: true })).rejects.toThrow(/--key requires --provider/);
  });

  it('errors on an empty --key value', async () => {
    const emptyFile = join(dir, 'empty.txt');
    writeFileSync(emptyFile, '');
    await expect(
      runInit({ provider: 'anthropic', key: `@${emptyFile}`, yes: true })
    ).rejects.toThrow(/--key was empty/);
  });

  it('leaves existing keys intact when adding a new provider', async () => {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      anthropic: 'sk-ant-old-' + 'z'.repeat(90)
    }));
    await runInit({ provider: 'openai', key: 'sk-' + 'w'.repeat(60), yes: true });
    const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
    expect(cfg.anthropic).toMatch(/^sk-ant-old-/);
    expect(cfg.openai).toMatch(/^sk-w+$/);
  });
});
