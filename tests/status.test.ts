import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runStatus } from '../src/commands/status.js';

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('runStatus', () => {
  let dir: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ir-status-'));
    process.env.IR_CONFIG_DIR = dir;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('shows the tool name and version', async () => {
    const out = plain(await runStatus());
    expect(out).toContain('isolated-review');
    expect(out).toMatch(/v\d+\.\d+\.\d+/);
  });

  it('marks each key as "not set" when no keys configured', async () => {
    const out = plain(await runStatus());
    expect(out).toMatch(/Anthropic\s+not set/);
    expect(out).toMatch(/OpenAI\s+not set/);
    expect(out).toMatch(/OpenRouter\s+not set/);
  });

  it('shows a fingerprint for each set key (len + prefix + suffix, never the middle)', async () => {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      anthropic:  'sk-ant-' + 'Z'.repeat(101),
      openai:     'sk-proj-' + 'X'.repeat(160)
    }) + '\n');
    const out = plain(await runStatus());
    expect(out).toMatch(/Anthropic\s+len=108/);
    expect(out).toMatch(/OpenAI\s+len=168/);
    expect(out).not.toContain('Z'.repeat(10));
    expect(out).not.toContain('X'.repeat(10));
  });

  it('lists both built-in and user prompts', async () => {
    const out = plain(await runStatus());
    expect(out).toContain('Built-in prompts');
    expect(out).toMatch(/default, security, perf, refactor/);
    expect(out).toContain('User prompts');
  });

  it('shows the config path', async () => {
    const out = plain(await runStatus());
    expect(out).toContain(join(dir, 'config.json'));
  });
});
