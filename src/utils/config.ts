import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Keys {
  anthropic?: string;
  openai?: string;
}

export function getConfigDir(): string {
  return process.env.IR_CONFIG_DIR ?? join(homedir(), '.config', 'isolated-review');
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

function readConfigFile(): Keys {
  const path = getConfigPath();
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Keys;
    return {
      anthropic: typeof parsed.anthropic === 'string' ? parsed.anthropic : undefined,
      openai:    typeof parsed.openai    === 'string' ? parsed.openai    : undefined
    };
  } catch {
    return {};
  }
}

export function loadKeys(): Keys {
  const fromFile = readConfigFile();
  return {
    anthropic: process.env.ANTHROPIC_API_KEY || fromFile.anthropic,
    openai:    process.env.OPENAI_API_KEY    || fromFile.openai
  };
}

export function saveKeys(patch: Keys): void {
  const dir = getConfigDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* non-fatal on non-POSIX fs */ }

  const current = readConfigFile();
  const merged: Keys = {
    anthropic: patch.anthropic ?? current.anthropic,
    openai:    patch.openai    ?? current.openai
  };

  const clean: Keys = {};
  if (merged.anthropic) clean.anthropic = merged.anthropic;
  if (merged.openai)    clean.openai    = merged.openai;

  writeFileSync(getConfigPath(), JSON.stringify(clean, null, 2) + '\n', { mode: 0o600 });
  try { chmodSync(getConfigPath(), 0o600); } catch { /* non-fatal */ }
}
