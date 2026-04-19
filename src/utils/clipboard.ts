import { spawn } from 'node:child_process';
import { platform } from 'node:process';

function trySpawnCopy(cmd: string, args: string[], input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    } catch (e) {
      reject(e);
      return;
    }
    let stderr = '';
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
    });
    child.stdin.end(input, 'utf8');
  });
}

async function firstAvailable(cmds: Array<[string, string[]]>, input: string): Promise<string> {
  const errors: string[] = [];
  for (const [cmd, args] of cmds) {
    try {
      await trySpawnCopy(cmd, args, input);
      return cmd;
    } catch (e) {
      errors.push(`${cmd}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`no clipboard command available (${errors.join('; ')})`);
}

export async function copyToClipboard(text: string): Promise<string> {
  if (platform === 'darwin') {
    return firstAvailable([['pbcopy', []]], text);
  }
  if (platform === 'win32') {
    return firstAvailable([['clip', []]], text);
  }
  // Linux / BSD / others — prefer Wayland, then X11
  return firstAvailable([
    ['wl-copy', []],
    ['xclip',   ['-selection', 'clipboard']],
    ['xsel',    ['--clipboard', '--input']]
  ], text);
}
