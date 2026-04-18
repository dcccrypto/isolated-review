import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyDefaultModel, warnIfKeyMissing } from '../src/commands/settings.js';
import { createTheme } from '../src/utils/theme.js';
import { saveConfig, loadConfig } from '../src/utils/config.js';

describe('applyDefaultModel', () => {
  const origEnv = { ...process.env };
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ir-settings-'));
    process.env.IR_CONFIG_DIR = dir;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('undefined choice → no change', () => {
    expect(applyDefaultModel(undefined)).toEqual({ changed: false });
  });

  it('null choice → clears defaultModel', () => {
    saveConfig({ defaultModel: 'claude-opus' });
    const r = applyDefaultModel(null);
    expect(r.changed).toBe(true);
    expect(loadConfig().defaultModel).toBeUndefined();
  });

  it('valid model string → saves', () => {
    const r = applyDefaultModel('gpt-4o');
    expect(r.changed).toBe(true);
    expect(r.after).toBe('gpt-4o');
    expect(loadConfig().defaultModel).toBe('gpt-4o');
  });
});

describe('warnIfKeyMissing', () => {
  const origEnv = { ...process.env };
  let dir: string;
  const theme = createTheme({ plain: true });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ir-warn-'));
    process.env.IR_CONFIG_DIR = dir;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('warns when picked model has no matching key', () => {
    const w = warnIfKeyMissing('claude-opus', theme);
    expect(w).toMatch(/no anthropic API key set/);
    expect(w).toMatch(/review keys/);
  });

  it('no warning when the matching key is set', () => {
    saveConfig({ anthropic: 'sk-ant-x' });
    expect(warnIfKeyMissing('claude-opus', theme)).toBeNull();
  });

  it('routes OpenRouter model to the openrouter key', () => {
    const w = warnIfKeyMissing('anthropic/claude-3.5-sonnet', theme);
    expect(w).toMatch(/no openrouter API key set/);
    saveConfig({ openrouter: 'or-x' });
    expect(warnIfKeyMissing('anthropic/claude-3.5-sonnet', theme)).toBeNull();
  });

  it('returns null (does not throw) on invalid model', () => {
    expect(warnIfKeyMissing('not-a-real-model', theme)).toBeNull();
  });
});
