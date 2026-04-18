import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Config {
  anthropic?: string;
  openai?: string;
  openrouter?: string;
  defaultModel?: string;
}

export type Keys = Pick<Config, 'anthropic' | 'openai' | 'openrouter'>;

export function getConfigDir(): string {
  return process.env.IR_CONFIG_DIR ?? join(homedir(), '.config', 'isolated-review');
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

function readConfigFile(): Config {
  const path = getConfigPath();
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const clean: Config = {};
    if (typeof parsed.anthropic    === 'string') clean.anthropic    = parsed.anthropic;
    if (typeof parsed.openai       === 'string') clean.openai       = parsed.openai;
    if (typeof parsed.openrouter   === 'string') clean.openrouter   = parsed.openrouter;
    if (typeof parsed.defaultModel === 'string') clean.defaultModel = parsed.defaultModel;
    return clean;
  } catch {
    return {};
  }
}

export function loadConfig(): Config {
  const file = readConfigFile();
  return {
    anthropic:    process.env.ANTHROPIC_API_KEY  || file.anthropic,
    openai:       process.env.OPENAI_API_KEY     || file.openai,
    openrouter:   process.env.OPENROUTER_API_KEY || file.openrouter,
    defaultModel: file.defaultModel
  };
}

export function loadKeys(): Keys {
  const c = loadConfig();
  return { anthropic: c.anthropic, openai: c.openai, openrouter: c.openrouter };
}

export function saveConfig(patch: Partial<Config>): void {
  const dir = getConfigDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* non-fatal on non-POSIX fs */ }

  const current = readConfigFile();
  const merged: Config = { ...current };
  for (const [key, value] of Object.entries(patch) as [keyof Config, string | undefined][]) {
    if (value === undefined || value === '') delete merged[key];
    else merged[key] = value;
  }

  writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2) + '\n', { mode: 0o600 });
  try { chmodSync(getConfigPath(), 0o600); } catch { /* non-fatal */ }
}

export function saveKeys(patch: Keys): void {
  saveConfig(patch);
}
