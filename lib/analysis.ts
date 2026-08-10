import { searchLaw } from "./law-api";
import type { AnalyzeResult, Issue } from "./types";
import crypto from "node:crypto";

export function maskPersonalInfo(text: string): string {
  return text
    .replace(/\d{6}-\d{7}/g, "XXXXXX-XXXXXXX")
    .replace(/010-\d{4}-\d{4}/g, "010-XXXX-XXXX");
}

/**
 * 법령 인용 추출 (정확도 우선)
 * 1) 「법령명」 제N조…
 * 2) …법 제N조… (조 앞에서 가장 가까운 '법'으로 끝나는 이름)
 */
export function extractCitations(text: string) {
  const results: {
    full: string;
    lawName: string;
    article: string;
    start: number;
    end: number;
  }[] = [];

  const articleRe =
    /제\s*\d+\s*조(?:의\s*\d+)?(?:\s*제\s*\d+\s*항)?(?:\s*제\s*\d+\s*호)?/g;

  let m: RegExpExecArray | null;
  while ((m = articleRe.exec(text)) !== null) {
    const artStart = m.index;
    const artEnd = m.index + m[0].length;
    const article = m[0].replace(/\s+/g, " ").trim();
    const left = text.slice(Math.max(0, artStart - 40), artStart);

    // 「법령명」
    const quoted = left.match(/「([^」]{2,40})」\s*$/);
    if (quoted) {
      const lawName = quoted[1].trim();
      const fullStart = artStart - quoted[0].length;
      results.push({
        full: text.slice(fullStart, artEnd),
        lawName,
        article,
        start: fullStart,
        end: artEnd,
      });
      continue;
    }

    // 조 앞 구간에서 '…법' 후보 (제N조 형태는 제외)
    const candidates = [...left.matchAll(/(?:[가-힣A-Za-z0-9·]+\s+){0,3}[가-힣A-Za-z0-9·]+법(?:률)?/g)];
    if (candidates.length === 0) continue;

    // 오른쪽(조에 가장 가까운) 후보
    let best = candidates[candidates.length - 1];
    let lawName = best[0].trim();

    // '제12조와 형법' 같이 조문이 섞인 경우 → 마지막 'OO법'만 사용
    if (/제\s*\d+\s*조/.test(lawName) || /및|와|과/.test(lawName)) {
      const onlyLaws = [...lawName.matchAll(/[가-힣A-Za-z0-9·]+법(?:률)?/g)];
      if (onlyLaws.length === 0) continue;
      const last = onlyLaws[onlyLaws.length - 1];
      lawName = last[0];
      const rel = best.index! + (last.index ?? 0);
      const absStart = Math.max(0, artStart - 40) + rel;
      results.push({
        full: text.slice(absStart, artEnd),
        lawName,
        article,
        start: absStart,
        end: artEnd,
      });
      continue;
    }

    const absStart = Math.max(0, artStart - 40) + (best.index ?? 0);
    results.push({
      full: text.slice(absStart, artEnd),
      lawName,
      article,
      start: absStart,
      end: artEnd,
    });
  }

  // 시작 위치 기준 중복 제거
  const map = new Map<number, (typeof results)[0]>();
  for (const r of results) {
    if (!map.has(r.start)) map.set(r.start, r);
  }
  return [...map.values()].sort((a, b) => a.start - b.start);
}

/**
 * 핵심: 틀린 법령 인용에 빨간 밑줄 + 각주
 * (AI가 고치지 않음. 표시와 이유 설명이 전부)
 */
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
        (r.법령명한글 &&
          (r.법령명한글.includes(cit.lawName) || cit.lawName.includes(r.법령명한글)))
    );

    if (!exact) {
      issues.push({
        id: crypto.randomUUID(),
        ruleId: "LAW_NOT_FOUND",
        severity: "critical",
        originalText: cit.full,
        start: cit.start,
        end: cit.end,
        reason: `「${cit.lawName}」 ${cit.article} — 국가법령정보센터에서 해당 법령명을 찾을 수 없습니다. 오타이거나 존재하지 않는 법령일 수 있습니다.`,
        lawName: cit.lawName,
        article: cit.article,
        suggestion: "정확한 공식 법령명으로 수정해 주세요.",
      });
      score -= 25;
      continue;
    }

    // 법령은 존재하지만, 조 번호 형식만 기록 (상세 조문 API는 선택)
    // 존재하지 않는 조까지 강하게 단정하지 않음 (API 한도·개정 이슈)
  }

  // ----- 하이라이트 HTML + 각주 (뒤에서부터 삽입해 인덱스 유지) -----
  const sorted = [...issues]
    .filter((i) => i.end > i.start)
    .sort((a, b) => b.start - a.start);

  let highlighted = text;
  const footnotes: AnalyzeResult["footnotes"] = [];
  let num = 0;

  for (const issue of sorted) {
    num += 1;
    const mark =
      `<mark class="lunia-error" title="${escapeAttr(issue.reason)}">${escapeHtml(
        issue.originalText
      )}</mark><sup class="fn-ref">[${num}]</sup>`;
    highlighted =
      highlighted.slice(0, issue.start) + mark + highlighted.slice(issue.end);
    footnotes.unshift({
      number: num,
      reason: issue.reason,
      lawName: issue.lawName,
    });
  }

  footnotes.reverse();
  footnotes.forEach((f, i) => {
    f.number = i + 1;
  });

  // 각주 번호를 HTML 상 번호와 맞추기 위해 재삽입 없이 순서만 정리
  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    highlightedHtml: highlighted.replace(/\n/g, "<br/>"),
    footnotes,
    timestamp: new Date().toISOString(),
    maskedPreview: maskPersonalInfo(text).slice(0, 300),
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
