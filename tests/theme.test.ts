import { describe, it, expect, afterEach } from 'vitest';
import { createTheme } from '../src/utils/theme.js';

describe('createTheme', () => {
  const origNoColor = process.env.NO_COLOR;
  afterEach(() => {
    if (origNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = origNoColor;
  });

  it('returns unicode symbols and a ruled divider in rich mode', () => {
    delete process.env.NO_COLOR;
    const t = createTheme({ plain: false, forceRich: true });
    expect(t.sym.critical).toBe('●');
    expect(t.rule(3)).toBe('───');
  });

  it('returns ASCII symbols in plain mode', () => {
    const t = createTheme({ plain: true });
    expect(t.sym.critical).toBe('!');
    expect(t.rule(3)).toBe('---');
    expect(t.critical('x')).toBe('x');
  });

  it('disables color when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1';
    const t = createTheme({ plain: false, forceRich: true });
    expect(t.critical('x')).toBe('x');
  });
});
