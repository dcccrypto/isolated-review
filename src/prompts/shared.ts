export const SCHEMA_INSTRUCTION = `Return ONLY a JSON object matching this TypeScript type, with no prose or code fences: { summary: string; findings: { title: string; severity: "critical"|"medium"|"low"; category?: "correctness"|"security"|"performance"|"maintainability"|"style"; location?: { startLine: number; endLine?: number }; snippet?: string; explanation: string; fix?: string; patch?: string }[]; notes?: string }

Every finding MUST include \`location\` with the line range it refers to (1-based, inclusive). The file you are given has line numbers prepended in the form "  42 | <code>" — read them as the canonical line numbers. \`snippet\` should quote the exact tokens you are referring to, copied verbatim from the file (without the line-number prefix).`;

export function withLineNumbers(content: string): string {
  const lines = content.split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width, ' ')} | ${line}`).join('\n');
}
