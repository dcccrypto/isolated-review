import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, loadKeys, saveConfig, saveKeys, getConfigPath } from '../src/utils/config.js';

describe('config', () => {
  let dir: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ir-cfg-'));
    process.env.IR_CONFIG_DIR = dir;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('loadConfig returns empty when no file and no env', () => {
    expect(loadConfig()).toEqual({
      anthropic: undefined, openai: undefined, openrouter: undefined, defaultModel: undefined
    });
  });

  it('saveKeys writes JSON file with 0600 permissions', () => {
    saveKeys({ anthropic: 'sk-ant-1', openai: 'sk-oai-1' });
    const path = getConfigPath();
    expect(existsSync(path)).toBe(true);
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    expect(parsed).toEqual({ anthropic: 'sk-ant-1', openai: 'sk-oai-1' });
    if (process.platform !== 'win32') {
      const mode = statSync(path).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  it('saveConfig merges with existing config, does not clobber other fields', () => {
    saveKeys({ anthropic: 'first', openai: 'second' });
    saveConfig({ defaultModel: 'claude-opus-4-7' });
    const parsed = JSON.parse(readFileSync(getConfigPath(), 'utf8'));
    expect(parsed).toEqual({
      anthropic: 'first', openai: 'second', defaultModel: 'claude-opus-4-7'
    });
  });

  it('saveConfig with an empty string deletes that field', () => {
    saveConfig({ anthropic: 'first', defaultModel: 'claude' });
    saveConfig({ defaultModel: '' });
    const parsed = JSON.parse(readFileSync(getConfigPath(), 'utf8'));
    expect(parsed).toEqual({ anthropic: 'first' });
  });

  it('loadConfig reads stored values including defaultModel', () => {
    saveConfig({ anthropic: 'a', openai: 'o', defaultModel: 'claude-sonnet-4-6' });
    expect(loadConfig()).toEqual({
      anthropic: 'a', openai: 'o', defaultModel: 'claude-sonnet-4-6'
    });
  });

  it('process.env takes precedence over config file for API keys', () => {
    saveConfig({ anthropic: 'stored-a', openai: 'stored-o' });
    process.env.ANTHROPIC_API_KEY = 'env-a';
    const c = loadConfig();
    expect(c.anthropic).toBe('env-a');
    expect(c.openai).toBe('stored-o');
  });

  it('loadKeys still works as a thin wrapper', () => {
    saveKeys({ anthropic: 'ak', openai: 'ok' });
    expect(loadKeys()).toEqual({ anthropic: 'ak', openai: 'ok' });
  });

  it('loadConfig tolerates a corrupt config file', () => {
    writeFileSync(getConfigPath(), 'not json');
    expect(loadConfig()).toEqual({
      anthropic: undefined, openai: undefined, openrouter: undefined, defaultModel: undefined
    });
  });

  it('loads OpenRouter key from env and config', () => {
    saveConfig({ openrouter: 'or-stored' });
    expect(loadConfig().openrouter).toBe('or-stored');
    process.env.OPENROUTER_API_KEY = 'or-env';
    expect(loadConfig().openrouter).toBe('or-env');
  });
});
