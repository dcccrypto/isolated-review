import type { ReviewInput } from '../providers/types.js';
import { withLineNumbers } from './shared.js';
import { formatRanges } from '../utils/diff.js';
import { loadPrompt } from './library.js';

export function buildReviewMessages(input: ReviewInput, promptName: string = 'default') {
  const prompt = loadPrompt(promptName);
  const notes = input.userNotes ? `\n\n## Context from author\n${input.userNotes}` : '';
  const patch = input.includePatch
    ? `\n\nFor each actionable finding, include a unified-diff \`patch\` field when a concrete fix is possible.`
    : '';
  const focus = input.focusRanges && input.focusRanges.length
    ? `\n\n## Only review changed lines\nOnly include findings that touch these line ranges: ${formatRanges(input.focusRanges)}. Skip findings on unchanged code, even if they would otherwise be valid. Use the full file below for context, but the report must only cover these ranges.`
    : '';
  const numbered = withLineNumbers(input.content);
  const user = `## File: ${input.filePath}\nLanguage: ${input.language}${notes}${patch}${focus}\n\n\`\`\`${input.language}\n${numbered}\n\`\`\``;
  return { system: prompt.system, user };
}
