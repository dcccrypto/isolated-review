import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPrompt, listAllPrompts, listBuiltinNames } from '../src/prompts/library.js';

describe('prompt library', () => {
  let dir: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ir-prompts-'));
    process.env.IR_CONFIG_DIR = dir;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('returns the four built-in prompts', () => {
    const names = listBuiltinNames();
    expect(names.sort()).toEqual(['default', 'perf', 'refactor', 'security']);
  });

  it('loadPrompt(default) returns a prompt mentioning categories and the schema', () => {
    const p = loadPrompt('default');
    expect(p.source).toBe('builtin');
    expect(p.system).toMatch(/Categorise/);
    expect(p.system).toContain('Return ONLY a JSON object');
  });

  it('loadPrompt(security) is security-focused', () => {
    const p = loadPrompt('security');
    expect(p.system.toLowerCase()).toMatch(/injection|vulnerab|security/);
  });

  it('loadPrompt(perf) is performance-focused', () => {
    const p = loadPrompt('perf');
    expect(p.system.toLowerCase()).toMatch(/perform|allocation|complexity/);
  });

  it('loads a user-defined prompt from IR_CONFIG_DIR/prompts/<name>.md', () => {
    mkdirSync(join(dir, 'prompts'));
    writeFileSync(join(dir, 'prompts', 'house-style.md'), 'You enforce our house style. Be terse.');
    const p = loadPrompt('house-style');
    expect(p.source).toBe('user');
    expect(p.system).toContain('You enforce our house style');
    expect(p.system).toContain('Return ONLY a JSON object');
  });

  it('listAllPrompts merges built-ins with user-defined', () => {
    mkdirSync(join(dir, 'prompts'));
    writeFileSync(join(dir, 'prompts', 'mine.md'), 'X');
    const all = listAllPrompts();
    const names = all.map(p => p.name).sort();
    expect(names).toContain('default');
    expect(names).toContain('mine');
  });

  it('throws a helpful error on unknown prompt name', () => {
    expect(() => loadPrompt('not-a-thing'))
      .toThrow(/unknown prompt: "not-a-thing"[\s\S]*built-in: default, security, perf, refactor/);
  });
});
