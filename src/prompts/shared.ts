export const SCHEMA_INSTRUCTION = `Return ONLY a JSON object matching this TypeScript type, with no prose or code fences: { summary: string; findings: { title: string; severity: "critical"|"medium"|"low"; location?: { startLine: number; endLine?: number }; snippet?: string; explanation: string; fix?: string; patch?: string }[]; notes?: string }`;

export function withLineNumbers(content: string): string {
  const lines = content.split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width, ' ')} | ${line}`).join('\n');
}
