import { existsSync, accessSync, constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { platform } from 'node:process';
import { loadConfig, getConfigDir, getConfigPath } from '../utils/config.js';
import { listAllPrompts } from '../prompts/library.js';
import { resolveModel } from '../providers/resolve.js';
import { createTheme, type Theme } from '../utils/theme.js';

type Status = 'ok' | 'warn' | 'fail';

interface Check {
  label: string;
  status: Status;
  detail: string;
}

function nodeVersion(): Check {
  const v = process.versions.node;
  const major = parseInt(v.split('.')[0]!, 10);
  return {
    label: 'Node version',
    status: major >= 20 ? 'ok' : 'fail',
    detail: major >= 20 ? `v${v}` : `v${v} — need Node 20+`
  };
}

function gitCheck(): Check {
  try {
    execFileSync('git', ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
    return { label: 'git', status: 'ok', detail: 'found in PATH (required for --diff)' };
  } catch {
    return { label: 'git', status: 'warn', detail: 'not in PATH — --diff mode will not work' };
  }
}

function configCheck(): Check {
  const path = getConfigPath();
  if (!existsSync(path)) return { label: 'Config file', status: 'warn', detail: `${path} not found — run \`review init\`` };
  try {
    accessSync(path, constants.R_OK);
    return { label: 'Config file', status: 'ok', detail: path };
  } catch {
    return { label: 'Config file', status: 'fail', detail: `${path} — not readable` };
  }
}

function keyFormat(name: string, value: string | undefined, expected: { prefix?: string; minLen: number }): Check {
  const label = `${name} key`;
  if (!value) return { label, status: 'warn', detail: 'not set' };
  if (expected.prefix && !value.startsWith(expected.prefix)) {
    return { label, status: 'warn', detail: `len=${value.length} — expected prefix "${expected.prefix}"` };
  }
  if (value.length < expected.minLen) {
    return { label, status: 'warn', detail: `len=${value.length} — expected at least ${expected.minLen} chars (paste may have truncated)` };
  }
  return { label, status: 'ok', detail: `len=${value.length} ${value.slice(0, 4)}…${value.slice(-4)}` };
}

function defaultModelCheck(c: ReturnType<typeof loadConfig>): Check {
  if (!c.defaultModel) return { label: 'Default model', status: 'ok', detail: '(not set — falls back to "claude")' };
  try {
    const { provider, model } = resolveModel(c.defaultModel);
    const hasKey = !!c[provider];
    if (!hasKey) {
      return {
        label: 'Default model',
        status: 'warn',
        detail: `${c.defaultModel} → ${provider} (${model}) — but no ${provider} key configured`
      };
    }
    return { label: 'Default model', status: 'ok', detail: `${c.defaultModel} → ${provider} (${model})` };
  } catch (e) {
    return { label: 'Default model', status: 'fail', detail: e instanceof Error ? e.message : String(e) };
  }
}

function clipboardCheck(): Check {
  const candidates =
    platform === 'darwin' ? ['pbcopy'] :
    platform === 'win32'  ? ['clip'] :
    ['wl-copy', 'xclip', 'xsel'];

  for (const cmd of candidates) {
    try {
      execFileSync(cmd, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
      return { label: 'Clipboard backend', status: 'ok', detail: cmd };
    } catch {
      try {
        execFileSync('which', [cmd], { stdio: ['ignore', 'ignore', 'ignore'] });
        return { label: 'Clipboard backend', status: 'ok', detail: cmd };
      } catch { /* keep trying */ }
    }
  }
  return {
    label: 'Clipboard backend',
    status: 'warn',
    detail: `none of ${candidates.join(' / ')} found — \`c\` to copy won't work, but --json and pretty output are unaffected`
  };
}

function promptsDirCheck(): Check {
  const dir = `${getConfigDir()}/prompts`;
  const count = listAllPrompts().filter(p => p.source === 'user').length;
  if (!existsSync(dir)) return { label: 'User prompts dir', status: 'ok', detail: `(none yet — \`review prompts new <name>\` creates it)` };
  try {
    accessSync(dir, constants.R_OK | constants.W_OK);
    return { label: 'User prompts dir', status: 'ok', detail: `${dir} · ${count} user prompt${count === 1 ? '' : 's'}` };
  } catch {
    return { label: 'User prompts dir', status: 'fail', detail: `${dir} — not readable/writable` };
  }
}

const GLYPH: Record<Status, (t: Theme) => string> = {
  ok:   t => t.ok(t.sym.check),
  warn: t => t.medium(t.sym.medium),
  fail: t => t.critical(t.sym.critical)
};

export async function runDoctor(): Promise<string> {
  const t = createTheme();
  const c = loadConfig();

  const checks: Check[] = [
    nodeVersion(),
    gitCheck(),
    configCheck(),
    keyFormat('Anthropic',  c.anthropic,  { prefix: 'sk-ant-', minLen: 90  }),
    keyFormat('OpenAI',     c.openai,     { prefix: 'sk-',     minLen: 40  }),
    keyFormat('OpenRouter', c.openrouter, { prefix: 'sk-or-',  minLen: 40  }),
    defaultModelCheck(c),
    clipboardCheck(),
    promptsDirCheck()
  ];

  const lines: string[] = [];
  lines.push('');
  lines.push(` ${t.header('review doctor')}  ${t.muted('· offline health check')}`);
  lines.push(' ' + t.muted(t.rule()));
  const labelWidth = Math.max(...checks.map(c => c.label.length));
  for (const ch of checks) {
    lines.push(` ${GLYPH[ch.status](t)}  ${t.muted(ch.label.padEnd(labelWidth))}  ${ch.detail}`);
  }
  lines.push(' ' + t.muted(t.rule()));

  const fails = checks.filter(c => c.status === 'fail').length;
  const warns = checks.filter(c => c.status === 'warn').length;
  if (fails === 0 && warns === 0) {
    lines.push(` ${t.ok(t.sym.check)} All good.`);
  } else {
    const bits: string[] = [];
    if (fails) bits.push(`${fails} issue${fails === 1 ? '' : 's'}`);
    if (warns) bits.push(`${warns} warning${warns === 1 ? '' : 's'}`);
    lines.push(` ${warns && !fails ? t.medium(t.sym.medium) : t.critical(t.sym.critical)} ${bits.join(' · ')}`);
  }
  lines.push('');
  return lines.join('\n');
}
