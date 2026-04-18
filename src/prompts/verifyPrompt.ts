import type { ReviewInput, ReviewResult } from '../providers/types.js';
import { SCHEMA_INSTRUCTION, withLineNumbers } from './shared.js';

const LOCATION_NOTE = `Every retained finding MUST include \`location\` with the line range it refers to (1-based, inclusive), matching the line numbers in the file block.`;

const VERIFY_SYSTEM = `You are validating and refining a prior code review. You will receive the original file and an initial review. Remove weak or generic findings, strengthen valid findings, catch anything major that was missed, and return a cleaner final review. Stay grounded in the provided file only.

Calibration rules — follow strictly:
- Drop any finding that is generic advice or that cannot be tied to specific lines in the file.
- Drop low-severity nits that are not clearly actionable.
- Strengthen retained findings: tighten the title, sharpen the explanation, correct the line range if wrong.
- Only add a new finding if it is concrete, severe, and clearly missed by the prior pass.
- An empty refined review is a valid outcome if the prior review was entirely noise.

${SCHEMA_INSTRUCTION}

${LOCATION_NOTE}`;

export function buildVerifyMessages(input: ReviewInput, prior: ReviewResult) {
  const numbered = withLineNumbers(input.content);
  const user = `## File: ${input.filePath}\nLanguage: ${input.language}\n\n\`\`\`${input.language}\n${numbered}\n\`\`\`\n\n## Prior review\n\`\`\`json\n${JSON.stringify(prior, null, 2)}\n\`\`\``;
  return { system: VERIFY_SYSTEM, user };
}
