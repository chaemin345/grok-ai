export type Severity = "critical" | "major" | "minor" | "info";

export interface Issue {
  id: string;
  ruleId: string;
  severity: Severity;
  originalText: string;
  start: number;
  end: number;
  reason: string;
  lawName?: string;
  article?: string;
  officialUrl?: string;
  suggestion?: string;
}

export interface AnalyzeResult {
  score: number;
  issues: Issue[];
  highlightedHtml: string;
  footnotes: { number: number; reason: string; lawName?: string }[];
  timestamp: string;
  maskedPreview: string;
  contextCheckEnabled?: boolean;
}
