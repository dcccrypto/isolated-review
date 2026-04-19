import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyKeyPatch, setKeyFromInput } from '../src/commands/keys.js';

describe('applyKeyPatch', () => {
  let dir: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ir-keys-'));
    process.env.IR_CONFIG_DIR = dir;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('reports changed=false when the patch is empty', () => {
    const r = applyKeyPatch({});
    expect(r.changed).toBe(false);
  });

  it('saves new keys and reports each one in saved[]', () => {
    const r = applyKeyPatch({ anthropic: 'sk-ant-1', openai: 'sk-2' });
    expect(r.changed).toBe(true);
    expect(r.saved.anthropic).toBe('sk-ant-1');
    expect(r.saved.openai).toBe('sk-2');
    const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
    expect(cfg).toEqual({ anthropic: 'sk-ant-1', openai: 'sk-2' });
  });

  it('preserves other keys when updating one field', () => {
    applyKeyPatch({ anthropic: 'old-ant', openai: 'old-oai', openrouter: 'old-or' });
    applyKeyPatch({ openai: 'new-oai' });
    const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
    expect(cfg).toEqual({ anthropic: 'old-ant', openai: 'new-oai', openrouter: 'old-or' });
  });

  it('reports changed=false when the value already matches', () => {
    applyKeyPatch({ anthropic: 'same-key' });
    const r = applyKeyPatch({ anthropic: 'same-key' });
    expect(r.changed).toBe(false);
  });

  it('treats an explicit empty string as "clear this key"', () => {
    applyKeyPatch({ anthropic: 'to-be-cleared', openai: 'keep-me' });
    applyKeyPatch({ anthropic: '' });
    const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
    expect(cfg.anthropic).toBeUndefined();
    expect(cfg.openai).toBe('keep-me');
  });
});

describe('setKeyFromInput --from-file', () => {
  let dir: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ir-keys-file-'));
    process.env.IR_CONFIG_DIR = dir;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('reads a key from a file, strips trailing newlines, and saves it', async () => {
    const keyPath = join(dir, 'ant.txt');
    writeFileSync(keyPath, 'sk-ant-from-file\n');
    await setKeyFromInput('anthropic', 'file', keyPath);
    const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
    expect(cfg.anthropic).toBe('sk-ant-from-file');
  });

  it('throws on missing file path', async () => {
    await expect(setKeyFromInput('openai', 'file')).rejects.toThrow(/--from-file requires a path/);
  });

  it('throws on an empty file', async () => {
    const keyPath = join(dir, 'empty.txt');
    writeFileSync(keyPath, '   \n\n');
    await expect(setKeyFromInput('anthropic', 'file', keyPath)).rejects.toThrow(/input was empty/);
  });
});
