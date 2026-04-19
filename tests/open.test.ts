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

  it('uses file:line directly for Sublime Text (subl)', () => {
    expect(editorArgs('subl',   'src/foo.ts', 42)).toEqual(['subl',   'src/foo.ts:42']);
    expect(editorArgs('sublime','src/foo.ts', 42)).toEqual(['sublime','src/foo.ts:42']);
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
});
