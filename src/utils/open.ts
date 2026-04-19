import { spawn } from 'node:child_process';
import { platform } from 'node:process';

/**
 * Open a file at a given line in the user's preferred editor.
 * Order of preference:
 *   1. $VISUAL / $EDITOR — if set, used directly (with --goto style args for known editors)
 *   2. `code --goto <file:line>` if VS Code CLI is available
 *   3. Platform default: `open` (macOS), `start` (Windows), `xdg-open` (Linux)
 *      — these ignore the line number.
 */
export async function openAtLine(filePath: string, line: number): Promise<string> {
  const editor = process.env.VISUAL || process.env.EDITOR;
  if (editor) {
    const argv = editorArgs(editor, filePath, line);
    const bin = argv[0];
    if (!bin) throw new Error(`invalid editor command: "${editor}"`);
    await spawnDetached(bin, argv.slice(1));
    return `${editor} ${filePath}:${line}`;
  }

  // Fallback: known Jump-to-line editors
  if (await tryCommand('code', ['--goto', `${filePath}:${line}`])) return `code ${filePath}:${line}`;

  const opener =
    platform === 'darwin' ? 'open' :
    platform === 'win32'  ? 'start' :
    'xdg-open';
  await spawnDetached(opener, [filePath]);
  return `${opener} ${filePath}`;
}

export function editorArgs(editor: string, file: string, line: number): string[] {
  const bin = editor.split(/\s+/)[0]!.toLowerCase();
  const prefix = editor.split(/\s+/);
  // Editors that support `file:line` natively or with a flag
  if (/vim|nvim|nano/.test(bin)) return [...prefix, `+${line}`, file];
  if (/^(code|cursor|windsurf)$/.test(bin)) return [...prefix, '--goto', `${file}:${line}`];
  if (/^(emacs|emacsclient)$/.test(bin)) return [...prefix, `+${line}`, file];
  if (/^subl/.test(bin)) return [...prefix, `${file}:${line}`];
  // Fallback: just open the file
  return [...prefix, file];
}

function tryCommand(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
      child.on('error', () => resolve(false));
      child.on('spawn', () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

function spawnDetached(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
      child.on('error', reject);
      child.on('spawn', () => {
        child.unref();
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}
