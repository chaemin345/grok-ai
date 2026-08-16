import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  analyzeTextForIssues,
  buildHighlight,
  calcScore,
  maskPersonalInfo,
} from "@/lib/analysis";
import {
  checkContextLogic,
  contextFindingsToIssues,
} from "@/lib/context-check";
import type { AnalyzeResult, Issue } from "@/lib/types";

type ReqBody = { text: string; enableContextCheck?: boolean; apiKey?: string };

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
  const limit = 40;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAtMs <= now) {
    buckets.set(key, { count: 1, resetAtMs: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (bucket.count >= limit) return { ok: false, remaining: 0 };
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count };
}

export async function POST(req: Request) {
  const requiredKey = process.env.LUNIA_API_KEY;
  if (requiredKey) {
    const headerKey =
      req.headers.get("x-lunia-key") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (headerKey !== requiredKey) {
      return NextResponse.json(
        { error: "unauthorized", message: "유효한 API 키가 필요합니다." },
        { status: 401 }
      );
    }
  }

  const ip = getIp(req);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 429 }
    );
  }

  try {
    const body = (await req.json()) as ReqBody;
    const cleanText = (body.text ?? "").trim();

    if (cleanText.length < 10) {
      return NextResponse.json(
        {
          error: "invalid_text_length",
          message: "텍스트가 너무 짧습니다. (최소 10자)",
        },
        { status: 400 }
      );
    }
    if (cleanText.length > 80_000) {
      return NextResponse.json(
        {
          error: "invalid_text_length",
          message: "텍스트가 너무 깁니다. (최대 80,000자)",
        },
        { status: 400 }
      );
    }

    const masked = maskPersonalInfo(cleanText);
    const sha = crypto
      .createHash("sha256")
      .update(masked)
      .digest("hex")
      .slice(0, 16);
    const started = Date.now();

    const base = await analyzeTextForIssues(cleanText);
    let allIssues: Issue[] = [...base.issues];
    let contextEnabled = false;

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

    const result: AnalyzeResult = {
      score: calcScore(allIssues),
      issues: allIssues,
      highlightedHtml,
      footnotes,
      timestamp: new Date().toISOString(),
      maskedPreview: base.maskedPreview,
      contextCheckEnabled: contextEnabled,
      version: "1.0.0",
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
        version: "1.0.0",
      })
    );

    return NextResponse.json(result, {
      headers: {
        "x-rate-limit-remaining": String(rl.remaining),
        "x-lunia-version": "1.0.0",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "server_error", message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
