import type { ReviewInput } from '../providers/types.js';

const SCHEMA_INSTRUCTION = `Return ONLY a JSON object matching this TypeScript type, with no prose or code fences: { summary: string; findings: { title: string; severity: "critical"|"medium"|"low"; location?: { startLine: number; endLine?: number }; snippet?: string; explanation: string; fix?: string; patch?: string }[]; notes?: string }

Every finding MUST include \`location\` with the line range it refers to (1-based, inclusive). The file you are given has line numbers prepended in the form "  42 | <code>" — read them as the canonical line numbers. \`snippet\` should quote the exact tokens you are referring to, copied verbatim from the file.`;

const REVIEW_SYSTEM = `You are a deep code reviewer. Review ONLY the provided file in isolation. Do not assume access to the rest of the repository unless explicitly stated. Focus on correctness, edge cases, security issues, maintainability problems, performance issues when clearly relevant, and bad assumptions. Be concrete and reference exact code snippets where possible. Avoid generic advice.

Calibration rules — follow strictly:
- Every finding must cite a specific line range and quote the tokens it is about. If you cannot point at a line, do not include the finding.
- Do NOT include generic advice ("consider adding tests", "add documentation", "use TypeScript", "handle errors"). Only issues that are visible in this exact file, right now.
- Do NOT pad. If the file is clean, return an empty \`findings\` array and say so in \`summary\`. An empty review is a valid, good review.
- Severity calibration: "critical" = bug, security hole, data loss, or crash in a realistic path. "medium" = concrete maintainability or correctness risk. "low" = concrete, localised nit with a clear fix. Anything vaguer than "low" does not belong in the output at all.
- Prefer fewer, sharper findings over many weak ones.

${SCHEMA_INSTRUCTION}`;

function withLineNumbers(content: string): string {
  const lines = content.split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width, ' ')} | ${line}`).join('\n');
}

export function buildReviewMessages(input: ReviewInput) {
  const notes = input.userNotes ? `\n\n## Context from author\n${input.userNotes}` : '';
  const patch = input.includePatch
    ? `\n\nFor each actionable finding, include a unified-diff \`patch\` field when a concrete fix is possible.`
    : '';
  const numbered = withLineNumbers(input.content);
  const user = `## File: ${input.filePath}\nLanguage: ${input.language}${notes}${patch}\n\n\`\`\`${input.language}\n${numbered}\n\`\`\``;
  return { system: REVIEW_SYSTEM, user };
}
