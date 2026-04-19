import type { ReviewResult, Finding, Severity, Usage } from '../providers/types.js';
import { createTheme, type Theme } from './theme.js';
import { basename } from 'node:path';
import { estimateCost, formatTokens, formatUsd } from './pricing.js';

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
  diffBase?: string;
  theme: Theme;
  primaryUsage?: Usage;
  verifierUsage?: Usage;
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
  const sym = t.sym[f.severity];
  const color = t[f.severity];
  const tag = f.category ? `  ${t.muted('[' + f.category + ']')}` : '';
  const head = `  ${color(sym)} ${t.header(f.title)}${tag}`;
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
  const modes: string[] = [];
  if (includePatch)      modes.push('patch');
  if (args.diffBase)     modes.push(`diff vs ${args.diffBase}`);
  const headerLines = [
    title,
    topRule,
    kv('Model', primaryModel),
    verifierModel ? kv('Verifier', verifierModel) : null,
    modes.length ? kv('Mode', modes.join(', ')) : null
  ].filter((l): l is string => l !== null);
  const header = headerLines.join('\n');

  const body = renderBlock(filePath, primary, t);

  const verifiedBlock = verified
    ? `\n\n ${t.muted(t.rule())}\n ${t.accent('VERIFIED')}${renderBlock(filePath, verified, t)}`
    : '';

  const final = verified ?? primary;
  const counts = countBy(final.findings);
  const secs = (elapsedMs / 1000).toFixed(1);
  const usageLine = renderUsage(args, t);
  const footer = `\n\n ${t.muted(t.rule())}\n ${t.ok(t.sym.check)} Reviewed in ${secs}s · ${counts.critical} critical · ${counts.medium} medium · ${counts.low} low${usageLine}\n`;

  return header + body + verifiedBlock + footer;
}

function renderUsage(args: RenderArgs, t: Theme): string {
  const parts: string[] = [];
  if (args.primaryUsage) {
    parts.push(formatUsageLine('', args.primaryModel, args.primaryUsage));
  }
  if (args.verifierUsage && args.verifierModel) {
    parts.push(formatUsageLine('verifier ', args.verifierModel, args.verifierUsage));
  }
  if (!parts.length) return '';
  return '\n   ' + t.muted(parts.join('  ·  '));
}

function formatUsageLine(label: string, model: string, usage: Usage): string {
  const cached = usage.cachedInputTokens ?? 0;
  const cachedStr = cached > 0 ? ` (${formatTokens(cached)} cached)` : '';
  const tokens = `${formatTokens(usage.inputTokens)} in${cachedStr} / ${formatTokens(usage.outputTokens)} out`;
  const cost = estimateCost(model, usage);
  const costStr = cost !== null ? ` · ~${formatUsd(cost)}` : '';
  return `${label}${tokens}${costStr}`;
}

export function renderPlain(args: RenderArgs): string {
  return renderPretty({ ...args, theme: createTheme({ plain: true }) });
}
