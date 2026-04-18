import type { ReviewInput } from '../providers/types.js';

const SCHEMA_INSTRUCTION = `Return ONLY a JSON object matching this TypeScript type, with no prose or code fences: { summary: string; findings: { title: string; severity: "critical"|"medium"|"low"; snippet?: string; explanation: string; fix?: string; patch?: string }[]; notes?: string }`;

const REVIEW_SYSTEM = `You are a deep code reviewer. Review ONLY the provided file in isolation. Do not assume access to the rest of the repository unless explicitly stated. Focus on correctness, edge cases, security issues, maintainability problems, performance issues when clearly relevant, and bad assumptions. Be concrete and reference exact code snippets where possible. Avoid generic advice.

${SCHEMA_INSTRUCTION}`;

export function buildReviewMessages(input: ReviewInput) {
  const notes = input.userNotes ? `\n\n## Context from author\n${input.userNotes}` : '';
  const patch = input.includePatch
    ? `\n\nFor each actionable finding, include a unified-diff \`patch\` field when a concrete fix is possible.`
    : '';
  const user = `## File: ${input.filePath}\nLanguage: ${input.language}${notes}${patch}\n\n\`\`\`${input.language}\n${input.content}\n\`\`\``;
  return { system: REVIEW_SYSTEM, user };
}
