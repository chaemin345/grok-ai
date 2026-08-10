import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { analyzeTextForIssues, maskPersonalInfo } from "@/lib/analysis";

type ReqBody = { text: string };

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
    const result = await analyzeTextForIssues(cleanText);

    console.info(JSON.stringify({ event: "analyze_done", ip, sha, elapsedMs: Date.now() - started, score: result.score }));

    return NextResponse.json(result, {
      headers: { "x-rate-limit-remaining": String(rl.remaining) },
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
