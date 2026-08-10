import { searchLaw } from "./law-api";
import type { AnalyzeResult, Issue } from "./types";
import crypto from "node:crypto";

export function maskPersonalInfo(text: string): string {
  return text
    .replace(/\d{6}-\d{7}/g, "XXXXXX-XXXXXXX")
    .replace(/010-\d{4}-\d{4}/g, "010-XXXX-XXXX");
}

function extractCitations(text: string) {
  const patterns = [
    /「([^」]{2,40})」\s*(제\s*\d+\s*조(?:의\s*\d+)?(?:\s*제\s*\d+\s*항)?(?:\s*제\s*\d+\s*호)?)/g,
    /([가-힣A-Za-z0-9·]+(?:\s+[가-힣A-Za-z0-9·]+)*법(?:률)?)\s*(제\s*\d+\s*조(?:의\s*\d+)?(?:\s*제\s*\d+\s*항)?(?:\s*제\s*\d+\s*호)?)/g,
  ];

  const results: { full: string; lawName: string; article: string; start: number; end: number }[] = [];
  const seen = new Set<string>();

  for (const regex of patterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(regex.source, regex.flags);
    while ((m = r.exec(text)) !== null) {
      const key = `${m.index}-${m.index + m[0].length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        full: m[0],
        lawName: m[1].trim(),
        article: m[2].trim(),
        start: m.index,
        end: m.index + m[0].length,
      });
    }
  }
  return results.sort((a, b) => a.start - b.start);
}

export async function analyzeTextForIssues(text: string): Promise<AnalyzeResult> {
  const issues: Issue[] = [];
  let score = 100;
  const citations = extractCitations(text);

  for (const cit of citations) {
    const searchResults = await searchLaw(cit.lawName);
    const exact = searchResults.find(
      (r) =>
        r.법령명한글 === cit.lawName ||
        r.법령약칭명 === cit.lawName ||
        (r.법령명한글 && r.법령명한글.includes(cit.lawName)) ||
        cit.lawName.includes(r.법령명한글 ?? "")
    );

    if (!exact) {
      issues.push({
        id: crypto.randomUUID(),
        ruleId: "LAW_NOT_FOUND",
        severity: "critical",
        originalText: cit.full,
        start: cit.start,
        end: cit.end,
        reason: `「${cit.lawName}」은(는) 국가법령정보센터에서 검색되지 않는 법령명입니다. 오타 또는 존재하지 않는 법령일 수 있습니다.`,
        lawName: cit.lawName,
        article: cit.article,
        suggestion: "정확한 법령명을 확인하세요.",
      });
      score -= 25;
    }
  }

  // 하이라이트 + 각주
  const sorted = [...issues]
    .filter((i) => i.start >= 0 && i.end > i.start)
    .sort((a, b) => b.start - a.start);

  let highlighted = text;
  const footnotes: AnalyzeResult["footnotes"] = [];
  let num = 0;

  for (const issue of sorted) {
    num += 1;
    const mark = `<mark class="lunia-error">${issue.originalText}</mark><sup>[${num}]</sup>`;
    highlighted = highlighted.slice(0, issue.start) + mark + highlighted.slice(issue.end);
    footnotes.unshift({ number: num, reason: issue.reason, lawName: issue.lawName });
  }

  footnotes.reverse();
  footnotes.forEach((f, i) => (f.number = i + 1));

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    highlightedHtml: highlighted.replace(/\n/g, "<br/>"),
    footnotes,
    timestamp: new Date().toISOString(),
    maskedPreview: maskPersonalInfo(text).slice(0, 300),
  };
}
