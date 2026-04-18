import chalk from 'chalk';

export interface Theme {
  header: (s: string) => string;
  dim: (s: string) => string;
  muted: (s: string) => string;
  accent: (s: string) => string;
  critical: (s: string) => string;
  medium: (s: string) => string;
  low: (s: string) => string;
  ok: (s: string) => string;
  sym: { critical: string; medium: string; low: string; caret: string; check: string };
  rule: (width?: number) => string;
  plain: boolean;
}

const identity = (s: string) => s;

export function createTheme(opts: { plain?: boolean; forceRich?: boolean } = {}): Theme {
  const isTTY = opts.forceRich || process.stdout.isTTY;
  const colorOff = opts.plain || !!process.env.NO_COLOR || !isTTY;

  const c = {
    bold: colorOff ? identity : (s: string) => chalk.bold(s),
    dim: colorOff ? identity : (s: string) => chalk.dim(s),
    gray: colorOff ? identity : (s: string) => chalk.gray(s),
    cyan: colorOff ? identity : (s: string) => chalk.cyan(s),
    redBold: colorOff ? identity : (s: string) => chalk.red.bold(s),
    yellow: colorOff ? identity : (s: string) => chalk.yellow(s),
    green: colorOff ? identity : (s: string) => chalk.green(s)
  };

  const unicode = !opts.plain;
  const sym = unicode
    ? { critical: '●', medium: '◆', low: '·', caret: '›', check: '✓' }
    : { critical: '!', medium: '*', low: '-', caret: '>', check: 'v' };
  const ruleChar = unicode ? '─' : '-';

  return {
    header: (s) => c.bold(s),
    dim: (s) => c.dim(s),
    muted: (s) => c.gray(s),
    accent: (s) => c.cyan(s),
    critical: (s) => c.redBold(s),
    medium: (s) => c.yellow(s),
    low: (s) => c.gray(s),
    ok: (s) => c.green(s),
    sym,
    rule: (width = 55) => ruleChar.repeat(width),
    plain: !!opts.plain
  };
}
