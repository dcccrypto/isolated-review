import type { ReviewInput, ReviewResult } from '../providers/types.js';

const SCHEMA_INSTRUCTION = `Return ONLY a JSON object matching this TypeScript type, with no prose or code fences: { summary: string; findings: { title: string; severity: "critical"|"medium"|"low"; location?: { startLine: number; endLine?: number }; snippet?: string; explanation: string; fix?: string; patch?: string }[]; notes?: string }

Every retained finding MUST include \`location\` with the line range it refers to (1-based, inclusive), matching the line numbers in the file block.`;

const VERIFY_SYSTEM = `You are validating and refining a prior code review. You will receive the original file and an initial review. Remove weak or generic findings, strengthen valid findings, catch anything major that was missed, and return a cleaner final review. Stay grounded in the provided file only.

Calibration rules — follow strictly:
- Drop any finding that is generic advice or that cannot be tied to specific lines in the file.
- Drop low-severity nits that are not clearly actionable.
- Strengthen retained findings: tighten the title, sharpen the explanation, correct the line range if wrong.
- Only add a new finding if it is concrete, severe, and clearly missed by the prior pass.
- An empty refined review is a valid outcome if the prior review was entirely noise.

${SCHEMA_INSTRUCTION}`;

function withLineNumbers(content: string): string {
  const lines = content.split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width, ' ')} | ${line}`).join('\n');
}

export function buildVerifyMessages(input: ReviewInput, prior: ReviewResult) {
  const numbered = withLineNumbers(input.content);
  const user = `## File: ${input.filePath}\nLanguage: ${input.language}\n\n\`\`\`${input.language}\n${numbered}\n\`\`\`\n\n## Prior review\n\`\`\`json\n${JSON.stringify(prior, null, 2)}\n\`\`\``;
  return { system: VERIFY_SYSTEM, user };
}
