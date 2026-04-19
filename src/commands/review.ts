import ora from 'ora';
import { readSourceFile } from '../utils/readFile.js';
import { resolveModel } from '../providers/resolve.js';
import { anthropicProvider } from '../providers/anthropic.js';
import { openaiProvider } from '../providers/openai.js';
import { openrouterProvider } from '../providers/openrouter.js';
import { createTheme } from '../utils/theme.js';
import { renderJson, renderPretty } from '../utils/output.js';
import { loadConfig } from '../utils/config.js';
import { getChangedLineRanges } from '../utils/diff.js';
import type { Provider, ReviewInput, ReviewResponse } from '../providers/types.js';

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
}

export async function runReview(filePath: string, opts: ReviewOpts): Promise<string> {
  const file = await readSourceFile(filePath);
  const config = loadConfig();
  const modelName = opts.model ?? config.defaultModel ?? 'claude';
  const primary = resolveModel(modelName);
  const provider = providers[primary.provider];

  let focusRanges: ReviewInput['focusRanges'];
  if (opts.diff) {
    const ranges = getChangedLineRanges(file.absolutePath, opts.diff);
    if (ranges.length === 0) {
      throw new Error(`no changes vs ${opts.diff} in ${file.absolutePath}. omit --diff to review the whole file`);
    }
    focusRanges = ranges;
  }

  const input: ReviewInput = {
    filePath: file.absolutePath,
    language: file.language,
    content: file.content,
    userNotes: opts.notes,
    includePatch: opts.patch,
    focusRanges,
    promptName: opts.prompt
  };

  const started = Date.now();
  const silent = opts.json || !process.stdout.isTTY;

  const s1 = silent ? null : ora(`Reviewing with ${primary.model}…`).start();
  let primaryResponse: ReviewResponse;
  try {
    primaryResponse = await provider.review(primary.model, input);
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
    try {
      verifiedResponse = await vprov.verify(verifier.model, input, primaryResponse.result);
      s2?.succeed(`Verified with ${verifier.model}`);
    } catch (e) {
      s2?.fail('Verify failed');
      throw e;
    }
  }

  if (opts.json) {
    return renderJson((verifiedResponse ?? primaryResponse).result);
  }

  const theme = createTheme({ plain: opts.plain });
  return renderPretty({
    filePath: file.absolutePath,
    primaryModel: primary.model,
    verifierModel: verifierModelName,
    primary: primaryResponse.result,
    verified: verifiedResponse?.result,
    elapsedMs: Date.now() - started,
    includePatch: opts.patch,
    diffBase: opts.diff ?? undefined,
    theme,
    primaryUsage: primaryResponse.usage,
    verifierUsage: verifiedResponse?.usage
  });
}
