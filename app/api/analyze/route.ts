import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { analyzeTextForIssues, maskPersonalInfo } from "@/lib/analysis";
import {
  checkContextLogic,
  contextFindingsToIssues,
} from "@/lib/context-check";
import type { AnalyzeResult, Issue } from "@/lib/types";

type ReqBody = { text: string; enableContextCheck?: boolean };

type Bucket = { count: number; resetAtMs: number };
const buckets = new Map<string, Bucket>();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAtMs <= now) buckets.delete(key);
  }
}, 600_000);

function getIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimit(key: string) {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 20;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAtMs <= now) {
    buckets.set(key, { count: 1, resetAtMs: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (bucket.count >= limit) return { ok: false, remaining: 0 };
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count };
}

/** 이슈 목록으로 하이라이트 HTML + 각주 재생성 */
function buildHighlight(text: string, issues: Issue[]) {
  const sorted = [...issues]
    .filter((i) => i.end > i.start)
    .sort((a, b) => b.start - a.start);

  let highlighted = text;
  const footnotes: AnalyzeResult["footnotes"] = [];
  let num = 0;

  for (const issue of sorted) {
    num += 1;
    const safe = issue.originalText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const mark = `<mark class="lunia-error">${safe}</mark><sup class="fn-ref">[${num}]</sup>`;
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

  return {
    highlightedHtml: highlighted.replace(/\n/g, "<br/>"),
    footnotes,
  };
}

export async function POST(req: Request) {
  const ip = getIp(req);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const body = (await req.json()) as ReqBody;
    const cleanText = (body.text ?? "").trim();

    if (cleanText.length < 10 || cleanText.length > 80000) {
      return NextResponse.json({ error: "invalid_text_length" }, { status: 400 });
    }

    const masked = maskPersonalInfo(cleanText);
    const sha = crypto.createHash("sha256").update(masked).digest("hex").slice(0, 16);
    const started = Date.now();

    // 1) 컴퓨터: 법령 인용 대조 (밑줄+각주의 핵심)
    const base = await analyzeTextForIssues(cleanText);
    let allIssues: Issue[] = [...base.issues];
    let contextEnabled = false;

    // 2) 선택: 문맥·논리 이상만 Claude 레이어
    if (body.enableContextCheck) {
      const ctx = await checkContextLogic({
        text: cleanText,
        existingIssues: base.issues,
      });
      contextEnabled = ctx.enabled;
      if (ctx.findings.length > 0) {
        allIssues = [...allIssues, ...contextFindingsToIssues(ctx.findings)];
      }
    }

    const { highlightedHtml, footnotes } = buildHighlight(cleanText, allIssues);

    const score = Math.max(
      0,
      100 - allIssues.reduce((s, i) => s + (i.severity === "critical" ? 25 : i.severity === "major" ? 15 : 5), 0)
    );

    const result: AnalyzeResult = {
      score,
      issues: allIssues,
      highlightedHtml,
      footnotes,
      timestamp: new Date().toISOString(),
      maskedPreview: base.maskedPreview,
      contextCheckEnabled: contextEnabled,
    };

    console.info(
      JSON.stringify({
        event: "analyze_done",
        ip,
        sha,
        elapsedMs: Date.now() - started,
        score: result.score,
        issueCount: allIssues.length,
        contextCheckEnabled: contextEnabled,
      })
    );

    return NextResponse.json(result, {
      headers: { "x-rate-limit-remaining": String(rl.remaining) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
