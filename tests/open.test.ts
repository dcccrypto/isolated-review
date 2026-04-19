import { describe, it, expect } from 'vitest';
import { editorArgs } from '../src/utils/open.js';

describe('editorArgs', () => {
  it('uses +line for vim-family editors', () => {
    expect(editorArgs('vim',    'src/foo.ts', 42)).toEqual(['vim',    '+42', 'src/foo.ts']);
    expect(editorArgs('nvim',   'src/foo.ts', 42)).toEqual(['nvim',   '+42', 'src/foo.ts']);
    expect(editorArgs('gvim',   'src/foo.ts', 42)).toEqual(['gvim',   '+42', 'src/foo.ts']);
    expect(editorArgs('nano',   'src/foo.ts', 42)).toEqual(['nano',   '+42', 'src/foo.ts']);
  });

  it('uses --goto file:line for VS Code / Cursor / Windsurf', () => {
    expect(editorArgs('code',     'src/foo.ts', 42)).toEqual(['code',     '--goto', 'src/foo.ts:42']);
    expect(editorArgs('cursor',   'src/foo.ts', 42)).toEqual(['cursor',   '--goto', 'src/foo.ts:42']);
    expect(editorArgs('windsurf', 'src/foo.ts', 42)).toEqual(['windsurf', '--goto', 'src/foo.ts:42']);
  });

  it('uses file:line directly for Sublime Text (subl / sublime_text)', () => {
    expect(editorArgs('subl',         'src/foo.ts', 42)).toEqual(['subl',         'src/foo.ts:42']);
    expect(editorArgs('sublime_text', 'src/foo.ts', 42)).toEqual(['sublime_text', 'src/foo.ts:42']);
  });

  it('uses +line for emacs and emacsclient', () => {
    expect(editorArgs('emacs',       'src/foo.ts', 42)).toEqual(['emacs',       '+42', 'src/foo.ts']);
    expect(editorArgs('emacsclient', 'src/foo.ts', 42)).toEqual(['emacsclient', '+42', 'src/foo.ts']);
  });

  it('preserves multi-word editor prefixes (e.g. "code --wait")', () => {
    expect(editorArgs('code --wait', 'src/foo.ts', 42)).toEqual(['code', '--wait', '--goto', 'src/foo.ts:42']);
    expect(editorArgs('vim -u NONE', 'src/foo.ts', 42)).toEqual(['vim', '-u', 'NONE', '+42', 'src/foo.ts']);
  });

  it('falls back to just opening the file for unknown editors', () => {
    expect(editorArgs('textmate', 'src/foo.ts', 42)).toEqual(['textmate', 'src/foo.ts']);
    expect(editorArgs('hx',       'src/foo.ts', 42)).toEqual(['hx',       'src/foo.ts']);
  });

  it('is case-insensitive on the binary name', () => {
    expect(editorArgs('VIM',  'src/foo.ts', 42)).toEqual(['VIM',  '+42', 'src/foo.ts']);
    expect(editorArgs('Code', 'src/foo.ts', 42)).toEqual(['Code', '--goto', 'src/foo.ts:42']);
  });

  it('treats an existing full editor path as a single atomic argument (spaces in path)', async () => {
    const { mkdtempSync, writeFileSync, rmSync, chmodSync, mkdirSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    // Simulate a Mac-style GUI editor path like:
    //   /Applications/Visual Studio Code.app/Contents/Resources/app/bin/code
    const dir = mkdtempSync(join(tmpdir(), 'ir-ed-'));
    const nested = join(dir, 'Visual Studio Code.app', 'Contents', 'bin');
    mkdirSync(nested, { recursive: true });
    const binPath = join(nested, 'code');
    writeFileSync(binPath, '#!/bin/sh\necho "$@"\n');
    chmodSync(binPath, 0o755);
    try {
      // existsSync detects the path is real → atomic arg.
      // basename is "code" → recognised as a VS Code variant, gets --goto.
      expect(editorArgs(binPath, 'src/foo.ts', 42))
        .toEqual([binPath, '--goto', 'src/foo.ts:42']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('recognises vim variants (vim/nvim/gvim/mvim/vimdiff) exactly, not substring', () => {
    expect(editorArgs('gvim',    'a', 1)).toEqual(['gvim',    '+1', 'a']);
    expect(editorArgs('mvim',    'a', 1)).toEqual(['mvim',    '+1', 'a']);
    expect(editorArgs('vimdiff', 'a', 1)).toEqual(['vimdiff', '+1', 'a']);
    // Random binaries whose name contains 'vim' should NOT be treated as vim
    // (previously the regex was /vim|nvim|nano/ which matched substrings like
    // "my-vim-like-tool"). Now we require exact-name matches.
    expect(editorArgs('vimfake', 'a', 1)).toEqual(['vimfake', 'a']); // falls through
  });

  it('recognises code-insiders as a VS Code variant', () => {
    expect(editorArgs('code-insiders', 'a', 5)).toEqual(['code-insiders', '--goto', 'a:5']);
  });
});
