import { password } from '@inquirer/prompts';
import { readFileSync } from 'node:fs';
import { loadKeys, saveKeys, getConfigPath, type Keys } from '../utils/config.js';
import { createTheme, type Theme } from '../utils/theme.js';

export type Provider = 'anthropic' | 'openai' | 'openrouter';

function mask(v: string | undefined): string {
  if (!v) return 'not set';
  if (v.length <= 8) return '••••';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

function fingerprint(v: string): string {
  return `len=${v.length} starts=${v.slice(0, 4)} ends=${v.slice(-4)}`;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function setKeyFromInput(
  provider: Provider,
  source: 'stdin' | 'file',
  filePath?: string
): Promise<string> {
  const t = createTheme();
  let raw: string;
  if (source === 'stdin') {
    if (process.stdin.isTTY) {
      throw new Error('--from-stdin requires piped input. Try: printf %s "$KEY" | review keys --provider ' + provider + ' --from-stdin');
    }
    raw = await readStdin();
  } else {
    if (!filePath) throw new Error('--from-file requires a path');
    raw = readFileSync(filePath, 'utf8');
  }

  const value = raw.trim();
  if (!value) throw new Error('input was empty');

  const patch: Keys = { [provider]: value } as Keys;
  saveKeys(patch);
  return `\n ${t.ok(t.sym.check)} Saved ${t.accent(provider)} key (${fingerprint(value)})\n   ${t.muted(`to ${getConfigPath()} (chmod 600)`)}\n`;
}

export async function promptForKeys(t: Theme): Promise<Keys> {
  const existing = loadKeys();
  console.log('');
  console.log(` ${t.header('API keys')}  ${t.muted('· one key per provider you plan to use')}`);
  console.log(' ' + t.muted(t.rule()));
  console.log(` ${t.muted('Anthropic  ')}${mask(existing.anthropic)}   ${t.dim('console.anthropic.com/settings/keys')}`);
  console.log(` ${t.muted('OpenAI     ')}${mask(existing.openai)}   ${t.dim('platform.openai.com/api-keys')}`);
  console.log(` ${t.muted('OpenRouter ')}${mask(existing.openrouter)}   ${t.dim('openrouter.ai/keys  (one key unlocks many models)')}`);
  console.log(' ' + t.muted(t.rule()));
  console.log(` ${t.dim('Input is hidden as you paste. Leave blank to keep current. Type "-" to clear.')}`);
  console.log(` ${t.dim('If a paste truncates, use:  printf %s "$KEY" | review keys --provider <name> --from-stdin')}`);
  console.log('');

  const a = (await password({ message: 'Anthropic API key:',  mask: '*' })).replace(/[\r\n]+$/g, '');
  const o = (await password({ message: 'OpenAI API key:',     mask: '*' })).replace(/[\r\n]+$/g, '');
  const r = (await password({ message: 'OpenRouter API key:', mask: '*' })).replace(/[\r\n]+$/g, '');

  const patch: Keys = {};
  if (a === '-') patch.anthropic  = undefined; else if (a) patch.anthropic  = a;
  if (o === '-') patch.openai     = undefined; else if (o) patch.openai     = o;
  if (r === '-') patch.openrouter = undefined; else if (r) patch.openrouter = r;
  return patch;
}

export function applyKeyPatch(patch: Keys): { changed: boolean; saved: Partial<Record<Provider, string>> } {
  const existing = loadKeys();
  const saved: Partial<Record<Provider, string>> = {};
  if (patch.anthropic  !== undefined && patch.anthropic  !== existing.anthropic)  saved.anthropic  = patch.anthropic  || '(cleared)';
  if (patch.openai     !== undefined && patch.openai     !== existing.openai)     saved.openai     = patch.openai     || '(cleared)';
  if (patch.openrouter !== undefined && patch.openrouter !== existing.openrouter) saved.openrouter = patch.openrouter || '(cleared)';
  if (Object.keys(saved).length === 0) return { changed: false, saved };

  const merged: Keys = {
    anthropic:  patch.anthropic  !== undefined ? (patch.anthropic  || undefined) : existing.anthropic,
    openai:     patch.openai     !== undefined ? (patch.openai     || undefined) : existing.openai,
    openrouter: patch.openrouter !== undefined ? (patch.openrouter || undefined) : existing.openrouter
  };
  saveKeys(merged);
  return { changed: true, saved };
}

export async function runKeysSetup(opts?: {
  provider?: Provider;
  fromStdin?: boolean;
  fromFile?: string;
}): Promise<string> {
  if (opts?.fromStdin || opts?.fromFile) {
    if (!opts.provider) {
      throw new Error('--from-stdin / --from-file requires --provider <anthropic|openai|openrouter>');
    }
    const source = opts.fromStdin ? 'stdin' : 'file';
    return setKeyFromInput(opts.provider, source, opts.fromFile);
  }

  const t = createTheme();
  const patch = await promptForKeys(t);
  const { changed, saved } = applyKeyPatch(patch);
  if (!changed) return `\n ${t.muted('No changes.')}\n`;

  const lines = ['', ` ${t.ok(t.sym.check)} Saved to ${t.accent(getConfigPath())} ${t.muted('(chmod 600)')}`];
  for (const [provider, val] of Object.entries(saved)) {
    if (val === '(cleared)') {
      lines.push(`   ${t.muted(provider.padEnd(11))} ${t.dim('(cleared)')}`);
    } else {
      lines.push(`   ${t.muted(provider.padEnd(11))} ${t.dim(fingerprint(val as string))}`);
    }
  }
  lines.push('', ` ${t.dim('If a length looks short, your terminal may have truncated the paste.')}`);
  lines.push(` ${t.dim('Re-save it paste-immune via:')}`);
  lines.push(` ${t.dim('  printf %s "$KEY" | review keys --provider <name> --from-stdin')}`);
  lines.push('');
  return lines.join('\n');
}
