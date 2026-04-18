import type { ReviewInput, ReviewResult } from '../providers/types.js';

const SCHEMA_INSTRUCTION = `Return ONLY a JSON object matching this TypeScript type, with no prose or code fences: { summary: string; findings: { title: string; severity: "critical"|"medium"|"low"; snippet?: string; explanation: string; fix?: string; patch?: string }[]; notes?: string }`;

const VERIFY_SYSTEM = `You are validating and refining a prior code review. You will receive the original file and an initial review. Remove weak or generic findings, strengthen valid findings, catch anything major that was missed, and return a cleaner final review. Stay grounded in the provided file only.

${SCHEMA_INSTRUCTION}`;

export function buildVerifyMessages(input: ReviewInput, prior: ReviewResult) {
  const user = `## File: ${input.filePath}\nLanguage: ${input.language}\n\n\`\`\`${input.language}\n${input.content}\n\`\`\`\n\n## Prior review\n\`\`\`json\n${JSON.stringify(prior, null, 2)}\n\`\`\``;
  return { system: VERIFY_SYSTEM, user };
}
