import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDoctor, commandExists } from '../src/commands/doctor.js';

// Strips ANSI escape sequences so we can assert on plain text.
const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('commandExists', () => {
  it('returns true for a binary guaranteed on every POSIX/Windows install', () => {
    // `node` is whatever is running this process; it must exist.
    expect(commandExists(process.execPath)).toBe(true);
  });

  it('returns false for a clearly non-existent binary', () => {
    expect(commandExists('definitely-not-a-real-binary-xyz-12345')).toBe(false);
  });
});

describe('runDoctor', () => {
  let dir: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ir-doctor-'));
    process.env.IR_CONFIG_DIR = dir;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('prints the health-check header', async () => {
    const out = plain(await runDoctor());
    expect(out).toContain('review doctor');
    expect(out).toContain('offline health check');
  });

  it('flags missing keys as warnings, not failures', async () => {
    const out = plain(await runDoctor());
    expect(out).toMatch(/Anthropic key\s+not set/);
    expect(out).toMatch(/OpenAI key\s+not set/);
    expect(out).toMatch(/OpenRouter key\s+not set/);
    // should not claim "all good" when three providers are absent
    expect(out).not.toContain('All good');
  });

  it('shows key fingerprints when keys are set, without the middle bytes', async () => {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      anthropic:  'sk-ant-api03-' + 'A'.repeat(95),
      openai:     'sk-' + 'B'.repeat(100),
      openrouter: 'sk-or-' + 'C'.repeat(70)
    }) + '\n');
    const out = plain(await runDoctor());
    expect(out).toMatch(/Anthropic key\s+len=108/);
    expect(out).toMatch(/OpenAI key\s+len=103/);
    expect(out).toMatch(/OpenRouter key\s+len=76/);
    // must not contain more than a short prefix/suffix of any key
    expect(out).not.toContain('A'.repeat(10));
    expect(out).not.toContain('B'.repeat(10));
    expect(out).not.toContain('C'.repeat(10));
  });

  it('warns when the configured default model points at a provider without a key', async () => {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      openai: 'sk-' + 'x'.repeat(60),
      defaultModel: 'claude-opus'
    }) + '\n');
    const out = plain(await runDoctor());
    expect(out).toMatch(/Default model.*claude-opus.*no anthropic key/i);
  });

  it('shows a clean summary when nothing is set', async () => {
    const out = plain(await runDoctor());
    expect(out).toMatch(/User prompts dir/);
    // Even with no config, node + git should register as ok (developer box)
    expect(out).toContain('Node version');
  });
});
