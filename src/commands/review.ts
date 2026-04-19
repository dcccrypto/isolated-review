import ora from 'ora';
import { readSourceFile } from '../utils/readFile.js';
import { resolveModel } from '../providers/resolve.js';
import { anthropicProvider } from '../providers/anthropic.js';
import { openaiProvider } from '../providers/openai.js';
import { openrouterProvider } from '../providers/openrouter.js';
import { createTheme } from '../utils/theme.js';
import { renderJson, renderPretty, type JsonEnvelope } from '../utils/output.js';
import { toMarkdown } from '../utils/markdown.js';
import { loadConfig } from '../utils/config.js';
import { getChangedLineRanges, isTracked } from '../utils/diff.js';
import { estimateCost } from '../utils/pricing.js';
import type { Provider, ReviewInput, ReviewResponse, OnToken, Effort } from '../providers/types.js';

const providers: Record<Provider['name'], Provider> = {
  anthropic:  anthropicProvider,
  openai:     openaiProvider,
  openrouter: openrouterProvider
};

export interface ReviewOpts {
  model?: string;
  verify?: string;
  notes?: string;
  patch: boolean;
  json: boolean;
  plain: boolean;
  diff?: string;
  prompt?: string;
  promptFile?: string;
  effort?: Effort;
  failOn?: 'critical' | 'medium' | 'low';
}

export interface ReviewOutput {
  text: string;
  markdown?: string;
  firstCritical?: { filePath: string; startLine: number };
  findings: { critical: number; medium: number; low: number };
}

function formatBytes(n: number): string {
  if (n < 1000) return `${n}B`;
  if (n < 10_000) return `${(n / 1000).toFixed(1)}kB`;
  return `${Math.round(n / 1000)}kB`;
}

function makeTicker(spinner: ReturnType<typeof ora> | null, label: string): OnToken | undefined {
  if (!spinner) return undefined;
  let received = 0;
  const started = Date.now();
  let lastUpdate = 0;
  return (text: string) => {
    received += Buffer.byteLength(text, 'utf8');
    const now = Date.now();
    if (now - lastUpdate < 100) return;
    lastUpdate = now;
    const elapsed = ((now - started) / 1000).toFixed(1);
    spinner.text = `${label} · ${formatBytes(received)} · ${elapsed}s`;
  };
}

export async function runReview(filePath: string, opts: ReviewOpts): Promise<ReviewOutput> {
  if (opts.prompt && opts.promptFile) {
    throw new Error('--prompt and --prompt-file are mutually exclusive; pick one');
  }

  const file = await readSourceFile(filePath);
  const config = loadConfig();
  const modelName = opts.model ?? config.defaultModel ?? 'claude';
  const primary = resolveModel(modelName);
  const provider = providers[primary.provider];

  let focusRanges: ReviewInput['focusRanges'];
  let diffBase = opts.diff;
  if (opts.diff) {
    const ranges = getChangedLineRanges(file.absolutePath, opts.diff);
    if (ranges.length === 0) {
      if (!isTracked(file.absolutePath)) {
        process.stderr.write(`note: ${file.absolutePath} is untracked; reviewing the whole file\n`);
        diffBase = undefined;
      } else {
        throw new Error(`no changes vs ${opts.diff} in ${file.absolutePath}. omit --diff to review the whole file`);
      }
    } else {
      focusRanges = ranges;
    }
  }

  const input: ReviewInput = {
    filePath: file.absolutePath,
    language: file.language,
    content: file.content,
    userNotes: opts.notes,
    includePatch: opts.patch,
    focusRanges,
    promptName: opts.prompt,
    promptFile: opts.promptFile,
    effort: opts.effort
  };

  const started = Date.now();
  const silent = opts.json || !process.stdout.isTTY;

  const s1 = silent ? null : ora(`Reviewing with ${primary.model}…`).start();
  const ticker1 = makeTicker(s1, `Reviewing with ${primary.model}`);
  let primaryResponse: ReviewResponse;
  try {
    primaryResponse = await provider.review(primary.model, input, ticker1);
    s1?.succeed(`Reviewed with ${primary.model}`);
  } catch (e) {
    s1?.fail('Review failed');
    throw e;
  }

  let verifiedResponse: ReviewResponse | undefined;
  let verifierModelName: string | undefined;
  if (opts.verify) {
    const verifier = resolveModel(opts.verify);
    verifierModelName = verifier.model;
    const vprov = providers[verifier.provider];
    const s2 = silent ? null : ora(`Verifying with ${verifier.model}…`).start();
    const ticker2 = makeTicker(s2, `Verifying with ${verifier.model}`);
    try {
      verifiedResponse = await vprov.verify(verifier.model, input, primaryResponse.result, ticker2);
      s2?.succeed(`Verified with ${verifier.model}`);
    } catch (e) {
      s2?.fail('Verify failed');
      throw e;
    }
  }

  const elapsedMs = Date.now() - started;
  const finalResp = verifiedResponse ?? primaryResponse;

  const counts = {
    critical: finalResp.result.findings.filter(f => f.severity === 'critical').length,
    medium:   finalResp.result.findings.filter(f => f.severity === 'medium').length,
    low:      finalResp.result.findings.filter(f => f.severity === 'low').length
  };
  const firstCriticalFinding = finalResp.result.findings.find(f => f.severity === 'critical' && f.location);
  const firstCritical = firstCriticalFinding?.location
    ? { filePath: file.absolutePath, startLine: firstCriticalFinding.location.startLine }
    : undefined;

  if (opts.json) {
    const envelope: JsonEnvelope = {
      schemaVersion: 1,
      file: file.absolutePath,
      model: primary.model,
      verifierModel: verifierModelName,
      effort: opts.effort,
      elapsedMs,
      usage: finalResp.usage,
      estimatedCostUsd: estimateCost(verifiedResponse ? (verifierModelName ?? primary.model) : primary.model, finalResp.usage) ?? undefined,
      result: finalResp.result
    };
    return { text: renderJson(envelope), findings: counts, firstCritical };
  }

  const theme = createTheme({ plain: opts.plain });
  const text = renderPretty({
    filePath: file.absolutePath,
    primaryModel: primary.model,
    verifierModel: verifierModelName,
    primary: primaryResponse.result,
    verified: verifiedResponse?.result,
    elapsedMs,
    includePatch: opts.patch,
    diffBase,
    effort: opts.effort,
    theme,
    primaryUsage: primaryResponse.usage,
    verifierUsage: verifiedResponse?.usage
  });
  const markdown = toMarkdown({
    filePath: file.absolutePath,
    model: primary.model,
    verifierModel: verifierModelName,
    result: finalResp.result,
    elapsedMs,
    usage: finalResp.usage
  });
  return { text, markdown, findings: counts, firstCritical };
}

export function meetsFailThreshold(counts: { critical: number; medium: number; low: number }, threshold: 'critical' | 'medium' | 'low'): boolean {
  if (threshold === 'critical') return counts.critical > 0;
  if (threshold === 'medium')   return counts.critical > 0 || counts.medium > 0;
  return counts.critical > 0 || counts.medium > 0 || counts.low > 0;
}
