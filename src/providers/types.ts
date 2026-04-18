export type Severity = 'critical' | 'medium' | 'low';

export interface Finding {
  title: string;
  severity: Severity;
  snippet?: string;
  explanation: string;
  fix?: string;
  patch?: string;
}

export interface ReviewResult {
  summary: string;
  findings: Finding[];
  notes?: string;
}

export interface ReviewInput {
  filePath: string;
  language: string;
  content: string;
  userNotes?: string;
  includePatch: boolean;
}

export interface Provider {
  name: 'anthropic' | 'openai';
  review(model: string, input: ReviewInput): Promise<ReviewResult>;
  verify(model: string, input: ReviewInput, prior: ReviewResult): Promise<ReviewResult>;
}
