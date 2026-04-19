import readline from 'node:readline';

export interface PressedKey {
  name?: string;
  sequence?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export function waitForKey(timeoutMs: number): Promise<PressedKey | null> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(null);
      return;
    }
    readline.emitKeypressEvents(process.stdin);
    try {
      process.stdin.setRawMode(true);
    } catch {
      resolve(null);
      return;
    }
    process.stdin.resume();

    const cleanup = () => {
      try { process.stdin.setRawMode(false); } catch { /* non-fatal */ }
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKey);
      clearTimeout(timer);
    };

    const onKey = (_str: string, key: PressedKey | undefined) => {
      cleanup();
      resolve(key ?? null);
    };

    process.stdin.on('keypress', onKey);

    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);
  });
}
