import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadKeys, saveKeys, getConfigPath } from '../src/utils/config.js';

describe('config', () => {
  let dir: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ir-cfg-'));
    process.env.IR_CONFIG_DIR = dir;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('loadKeys returns empty when no file and no env', () => {
    expect(loadKeys()).toEqual({ anthropic: undefined, openai: undefined });
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

  it('saveKeys merges with existing config, does not clobber other keys', () => {
    saveKeys({ anthropic: 'first', openai: 'second' });
    saveKeys({ openai: 'third' });
    const parsed = JSON.parse(readFileSync(getConfigPath(), 'utf8'));
    expect(parsed).toEqual({ anthropic: 'first', openai: 'third' });
  });

  it('loadKeys reads stored config', () => {
    saveKeys({ anthropic: 'stored-a', openai: 'stored-o' });
    expect(loadKeys()).toEqual({ anthropic: 'stored-a', openai: 'stored-o' });
  });

  it('process.env takes precedence over config file', () => {
    saveKeys({ anthropic: 'stored-a', openai: 'stored-o' });
    process.env.ANTHROPIC_API_KEY = 'env-a';
    expect(loadKeys()).toEqual({ anthropic: 'env-a', openai: 'stored-o' });
  });

  it('loadKeys tolerates a corrupt config file', () => {
    writeFileSync(getConfigPath(), 'not json');
    expect(loadKeys()).toEqual({ anthropic: undefined, openai: undefined });
  });
});
