export type Severity = 'critical' | 'medium' | 'low';

export interface Location {
  startLine: number;
  endLine?: number;
}

export interface Finding {
  title: string;
  severity: Severity;
  location?: Location;
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
  focusRanges?: Location[];
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface ReviewResponse {
  result: ReviewResult;
  usage?: Usage;
}

export interface Provider {
  name: 'anthropic' | 'openai' | 'openrouter';
  review(model: string, input: ReviewInput): Promise<ReviewResponse>;
  verify(model: string, input: ReviewInput, prior: ReviewResult): Promise<ReviewResponse>;
}
