import ora from 'ora';
import { readSourceFile } from '../utils/readFile.js';
import { resolveModel } from '../providers/resolve.js';
import { anthropicProvider } from '../providers/anthropic.js';
import { openaiProvider } from '../providers/openai.js';
import { createTheme } from '../utils/theme.js';
import { renderJson, renderPretty } from '../utils/output.js';
import type { Provider, ReviewInput, ReviewResult } from '../providers/types.js';

const providers: Record<Provider['name'], Provider> = {
  anthropic: anthropicProvider,
  openai:    openaiProvider
};

export interface ReviewOpts {
  model: string;
  verify?: string;
  notes?: string;
  patch: boolean;
  json: boolean;
  plain: boolean;
}

export async function runReview(filePath: string, opts: ReviewOpts): Promise<string> {
  const file = await readSourceFile(filePath);
  const primary = resolveModel(opts.model);
  const provider = providers[primary.provider];
  const input: ReviewInput = {
    filePath: file.absolutePath,
    language: file.language,
    content: file.content,
    userNotes: opts.notes,
    includePatch: opts.patch
  };

  const started = Date.now();
  const silent = opts.json || !process.stdout.isTTY;

  const s1 = silent ? null : ora(`Reviewing with ${primary.model}…`).start();
  let primaryResult: ReviewResult;
  try {
    primaryResult = await provider.review(primary.model, input);
    s1?.succeed(`Reviewed with ${primary.model}`);
  } catch (e) {
    s1?.fail('Review failed');
    throw e;
  }

  let verifiedResult: ReviewResult | undefined;
  let verifierModelName: string | undefined;
  if (opts.verify) {
    const verifier = resolveModel(opts.verify);
    verifierModelName = verifier.model;
    const vprov = providers[verifier.provider];
    const s2 = silent ? null : ora(`Verifying with ${verifier.model}…`).start();
    try {
      verifiedResult = await vprov.verify(verifier.model, input, primaryResult);
      s2?.succeed(`Verified with ${verifier.model}`);
    } catch (e) {
      s2?.fail('Verify failed');
      throw e;
    }
  }

  if (opts.json) {
    return renderJson(verifiedResult ?? primaryResult);
  }

  const theme = createTheme({ plain: opts.plain });
  return renderPretty({
    filePath: file.absolutePath,
    primaryModel: primary.model,
    verifierModel: verifierModelName,
    primary: primaryResult,
    verified: verifiedResult,
    elapsedMs: Date.now() - started,
    includePatch: opts.patch,
    theme
  });
}
