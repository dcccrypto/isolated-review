import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { listAllPrompts, createUserPrompt, userPromptPath, loadPrompt } from '../prompts/library.js';
import { createTheme } from '../utils/theme.js';
import { getConfigDir } from '../utils/config.js';

export async function runListPrompts(): Promise<string> {
  const t = createTheme();
  const prompts = listAllPrompts();
  const lines: string[] = [];
  lines.push('');
  lines.push(` ${t.header('review prompts')}  ${t.muted('· available prompt presets')}`);
  lines.push(' ' + t.muted(t.rule()));
  for (const p of prompts) {
    const tag = p.source === 'user' ? t.accent('[user]   ') : t.muted('[builtin]');
    lines.push(` ${t.header(p.name.padEnd(14))}${tag}  ${t.muted(p.description)}`);
  }
  lines.push(' ' + t.muted(t.rule()));
  lines.push(` ${t.dim('Use with')} ${t.accent('review <file> --prompt <name>')}`);
  lines.push(` ${t.dim('Create your own:')} ${t.accent('review prompts new <name>')}`);
  lines.push(` ${t.dim('User prompts live in:')} ${t.accent(join(getConfigDir(), 'prompts'))}`);
  lines.push('');
  return lines.join('\n');
}

function spawnEditor(filePath: string): Promise<void> {
  const editor = process.env.VISUAL || process.env.EDITOR || 'vi';
  return new Promise((resolveP, rejectP) => {
    const child = spawn(editor, [filePath], { stdio: 'inherit' });
    child.on('error', rejectP);
    child.on('exit', (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`editor exited with code ${code}`));
    });
  });
}

export async function runPromptNew(name: string): Promise<string> {
  const t = createTheme();
  const path = createUserPrompt(name);
  const editable = process.stdin.isTTY && (process.env.VISUAL || process.env.EDITOR);
  if (editable) {
    await spawnEditor(path);
  }
  return `\n ${t.ok(t.sym.check)} Created ${t.accent(path)}\n   ${t.muted(editable ? 'edit saved. try: ' : 'open in your editor, then try: ')}${t.accent(`review <file> --prompt ${name}`)}\n`;
}

export async function runPromptEdit(name: string): Promise<string> {
  const t = createTheme();
  const path = userPromptPath(name);
  if (!existsSync(path)) {
    throw new Error(`no user prompt named "${name}" at ${path}. create it with: review prompts new ${name}`);
  }
  await spawnEditor(path);
  return `\n ${t.ok(t.sym.check)} Saved ${t.accent(path)}\n`;
}

export async function runPromptShow(name: string): Promise<string> {
  const prompt = loadPrompt(name);
  return `\n${prompt.system}\n`;
}
