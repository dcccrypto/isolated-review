import type { ReviewResult, Finding, Severity } from '../providers/types.js';
import type { Theme } from './theme.js';
import { basename } from 'node:path';

export function renderJson(result: ReviewResult): string {
  return JSON.stringify(result, null, 2);
}

export interface RenderArgs {
  filePath: string;
  primaryModel: string;
  verifierModel?: string;
  primary: ReviewResult;
  verified?: ReviewResult;
  elapsedMs: number;
  includePatch: boolean;
  theme: Theme;
}

const ORDER: Severity[] = ['critical', 'medium', 'low'];
const LABEL: Record<Severity, string> = { critical: 'Critical', medium: 'Medium', low: 'Low' };

function countBy(findings: Finding[]) {
  return {
    critical: findings.filter(f => f.severity === 'critical').length,
    medium:   findings.filter(f => f.severity === 'medium').length,
    low:      findings.filter(f => f.severity === 'low').length
  };
}

function locationLabel(filePath: string, f: Finding): string | null {
  if (!f.location) return null;
  const name = basename(filePath);
  const { startLine, endLine } = f.location;
  const range = endLine && endLine !== startLine ? `${startLine}-${endLine}` : `${startLine}`;
  return `${name}:${range}`;
}

function renderFinding(filePath: string, f: Finding, t: Theme): string {
  const symMap: Record<Severity, string> = {
    critical: t.sym.critical, medium: t.sym.medium, low: t.sym.low
  };
  const colorMap: Record<Severity, (s: string) => string> = {
    critical: t.critical, medium: t.medium, low: t.low
  };
  const head = `  ${colorMap[f.severity](symMap[f.severity])} ${t.header(f.title)}`;
  const loc = locationLabel(filePath, f);
  const locLine = loc ? `\n     ${t.muted(loc)}` : '';
  const snip = f.snippet ? `\n     ${t.muted(f.snippet)}` : '';
  const body = `\n     ${f.explanation}`;
  const fix  = f.fix   ? `\n     ${t.dim('Fix — ')}${f.fix}` : '';
  const pch  = f.patch ? `\n     ${t.dim('Patch —')}\n${f.patch.split('\n').map(l => '       ' + l).join('\n')}` : '';
  return head + locLine + snip + body + fix + pch;
}

function renderBlock(filePath: string, result: ReviewResult, t: Theme): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(` ${t.header(t.sym.caret + ' Summary')}`);
  lines.push(`   ${result.summary}`);
  for (const sev of ORDER) {
    const bucket = result.findings.filter(f => f.severity === sev);
    if (bucket.length === 0) continue;
    lines.push('');
    lines.push(` ${t.header(t.sym.caret + ' ' + LABEL[sev] + `  (${bucket.length})`)}`);
    for (const f of bucket) lines.push(renderFinding(filePath, f, t));
  }
  if (result.notes) {
    lines.push('');
    lines.push(` ${t.muted('Notes:')} ${result.notes}`);
  }
  return lines.join('\n');
}

export function renderPretty(args: RenderArgs): string {
  const { theme: t, primary, verified, elapsedMs, filePath, primaryModel, verifierModel, includePatch } = args;
  const title = ` ${t.header('review')}  ${t.accent(filePath)}`;
  const topRule = ' ' + t.muted(t.rule());
  const kv = (k: string, v: string) => ` ${t.muted(k.padEnd(9))}${v}`;
  const headerLines = [
    title,
    topRule,
    kv('Model', primaryModel),
    verifierModel ? kv('Verifier', verifierModel) : null,
    includePatch ? kv('Mode', 'patch') : null
  ].filter((l): l is string => l !== null);
  const header = headerLines.join('\n');

  const body = renderBlock(filePath, primary, t);

  const verifiedBlock = verified
    ? `\n\n ${t.muted(t.rule())}\n ${t.accent('VERIFIED')}${renderBlock(filePath, verified, t)}`
    : '';

  const final = verified ?? primary;
  const counts = countBy(final.findings);
  const secs = (elapsedMs / 1000).toFixed(1);
  const footer = `\n\n ${t.muted(t.rule())}\n ${t.ok(t.sym.check)} Reviewed in ${secs}s · ${counts.critical} critical · ${counts.medium} medium · ${counts.low} low\n`;

  return header + body + verifiedBlock + footer;
}

export function renderPlain(args: RenderArgs): string {
  return renderPretty({ ...args, theme: { ...args.theme, plain: true } });
}
