import { searchLaw, checkArticleExists } from "./law-api";
import type { AnalyzeResult, Issue } from "./types";
import { escapeHtml, maskPersonalInfo } from "./utils";
import crypto from "node:crypto";

export { maskPersonalInfo };

/** 법령 인용 추출 (정확도 우선) */
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

    const candidates = [
      ...left.matchAll(
        /(?:[가-힣A-Za-z0-9·]+\s+){0,3}[가-힣A-Za-z0-9·]+법(?:률)?/g
      ),
    ];
    if (candidates.length === 0) continue;

    const best = candidates[candidates.length - 1];
    let lawName = best[0].trim();

    if (/제\s*\d+\s*조/.test(lawName) || /및|와|과/.test(lawName)) {
      const onlyLaws = [...lawName.matchAll(/[가-힣A-Za-z0-9·]+법(?:률)?/g)];
      if (onlyLaws.length === 0) continue;
      const last = onlyLaws[onlyLaws.length - 1];
      lawName = last[0];
      const absStart =
        Math.max(0, artStart - 40) + (best.index ?? 0) + (last.index ?? 0);
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

  const map = new Map<number, (typeof results)[0]>();
  for (const r of results) {
    if (!map.has(r.start)) map.set(r.start, r);
  }
  return [...map.values()].sort((a, b) => a.start - b.start);
}

/** 틀린 법령 인용 → 이슈 목록 (밑줄/각주용) - 병렬 처리 */
export async function analyzeTextForIssues(
  text: string
): Promise<{ issues: Issue[]; maskedPreview: string }> {
  const issues: Issue[] = [];
  const citations = extractCitations(text);

  // 병렬로 법령 검색 + 조문 검사 (유료급 속도)
  const checks = await Promise.all(
    citations.map(async (cit) => {
      const searchResults = await searchLaw(cit.lawName);
      const exact = searchResults.find(
        (r) =>
          r.법령명한글 === cit.lawName ||
          r.법령약칭명 === cit.lawName ||
          (r.법령명한글 &&
            (r.법령명한글.includes(cit.lawName) ||
              cit.lawName.includes(r.법령명한글)))
      );

      if (!exact) {
        return {
          type: "LAW_NOT_FOUND" as const,
          cit,
        };
      }

      const articleCheck = await checkArticleExists(
        exact.법령ID || exact.법령일련번호,
        cit.article
      );

      return {
        type: "CHECKED" as const,
        cit,
        exact,
        articleCheck,
      };
    })
  );

  for (const result of checks) {
    if (result.type === "LAW_NOT_FOUND") {
      const { cit } = result;
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
        suggestion: "정확한 공식 법령명으로 확인하세요.",
      });
      continue;
    }

    const { cit, articleCheck } = result;
    if (!articleCheck.exists) {
      issues.push({
        id: crypto.randomUUID(),
        ruleId: "ARTICLE_NOT_FOUND",
        severity: "major",
        originalText: cit.full,
        start: cit.start,
        end: cit.end,
        reason:
          articleCheck.detail ||
          `「${cit.lawName}」 ${cit.article} — 해당 법령에서 조문을 찾을 수 없습니다. 조문 번호가 틀리거나 폐지된 조문일 수 있습니다.`,
        lawName: cit.lawName,
        article: cit.article,
        suggestion: "해당 법령의 정확한 조문 번호를 확인하세요.",
      });
    } else if (articleCheck.uncertain) {
      // 불확실한 경우 info 수준으로 표시 (과도한 critical 방지)
      issues.push({
        id: crypto.randomUUID(),
        ruleId: "ARTICLE_UNCERTAIN",
        severity: "info",
        originalText: cit.full,
        start: cit.start,
        end: cit.end,
        reason:
          articleCheck.detail ||
          `「${cit.lawName}」 ${cit.article} — 조문 존재 여부를 자동으로 확정할 수 없습니다. 수동 확인을 권장합니다.`,
        lawName: cit.lawName,
        article: cit.article,
        suggestion: "국가법령정보센터에서 직접 확인해 주세요.",
      });
    }
  }

  return {
    issues,
    maskedPreview: maskPersonalInfo(text).slice(0, 300),
  };
}

/** 이슈 → 하이라이트 HTML + 각주 (올바른 이스케이프 + 겹침 구간 스킵) */
export function buildHighlight(text: string, issues: Issue[]) {
  // 뒤에서부터 삽입하되, 이미 처리한 구간과 겹치면 스킵 (인덱스 붕괴 방지)
  const sorted = [...issues]
    .filter((i) => i.end > i.start && i.start >= 0 && i.end <= text.length)
    .sort((a, b) => b.start - a.start || b.end - a.end);

  const used: { start: number; end: number }[] = [];
  let highlighted = text;
  const footnotes: AnalyzeResult["footnotes"] = [];
  let num = 0;

  for (const issue of sorted) {
    const overlaps = used.some(
      (u) => issue.start < u.end && issue.end > u.start
    );
    if (overlaps) continue;

    num += 1;
    const safe = escapeHtml(text.slice(issue.start, issue.end));
    const mark = `<mark class="lunia-error">${safe}</mark><sup class="fn-ref">[${num}]</sup>`;
    highlighted =
      highlighted.slice(0, issue.start) + mark + highlighted.slice(issue.end);
    used.push({ start: issue.start, end: issue.end });
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

  return {
    highlightedHtml: highlighted
      .replace(/\n/g, "<br/>")
      .replace(/\r/g, ""),
    footnotes,
  };
}

export function calcScore(issues: Issue[]): number {
  const penalty = issues.reduce((s, i) => {
    if (i.severity === "critical") return s + 25;
    if (i.severity === "major") return s + 15;
    if (i.severity === "minor") return s + 5;
    return s + 1;
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
