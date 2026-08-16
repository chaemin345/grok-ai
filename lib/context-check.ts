/**
 * 문맥·논리 이상 탐지 레이어
 *
 * - 단순 법 존재 여부: lib/analysis.ts (컴퓨터)
 * - 논리 비약 / 전제-결론 불일치 / 조문 오인용 문맥: 여기 (Claude)
 *
 * CLAUDE_API_KEY 를 .env.local 에 넣으면 자동으로 동작합니다.
 * 문장을 수정하지 않고, 구간 + 이유(각주)만 반환합니다.
 */

import type { Issue } from "./types";
import crypto from "node:crypto";

export interface ContextCheckInput {
  text: string;
  existingIssues: Issue[];
}

export interface ContextFinding {
  id: string;
  originalText: string;
  start: number;
  end: number;
  reason: string;
  severity: "major" | "minor";
}

export interface ContextCheckResult {
  enabled: boolean;
  findings: ContextFinding[];
  model?: string;
}

const MODEL = "claude-sonnet-4-20250514";

function buildPrompt(text: string, existingIssues: Issue[]): string {
  const existingRanges =
    existingIssues.length > 0
      ? existingIssues
          .map(
            (i) =>
              `- [${i.start}-${i.end}] "${i.originalText.slice(0, 40)}${i.originalText.length > 40 ? "…" : ""}" (${i.ruleId})`
          )
          .join("\n")
      : "(없음)";

  return `당신은 한국 법률 문서 검증 전문가입니다.

아래 법률 관련 텍스트에서 **논리 비약**, **전제-결론 불일치**, **문맥상 조문 오인용**, **명백한 논리적 오류**만 찾아주세요.

규칙:
1. 문장을 절대 수정하거나 다시 쓰지 마세요.
2. 이미 아래 "기존 이슈"에 잡힌 구간은 중복으로 잡지 마세요 (참고만).
3. 단순 맞춤법/띄어쓰기 오류는 무시하세요.
4. 법령 존재 여부는 이미 다른 시스템이 검사했으므로 건드리지 마세요.
5. 반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 설명 금지.
6. start/end 인덱스는 반드시 정확한 0-based 문자 위치여야 합니다.

기존 이슈 (제외 참고):
${existingRanges}

텍스트:
"""
${text.slice(0, 12000)}
"""

응답 형식 (JSON 배열만):
[
  {
    "originalText": "문제가 되는 원문 구절 그대로",
    "start": 숫자 (텍스트 내 시작 인덱스, 0-based),
    "end": 숫자 (끝 인덱스),
    "reason": "왜 논리/문맥상 문제인지 한글로 1~2문장",
    "severity": "major" 또는 "minor"
  }
]

문제가 없으면 빈 배열 [] 을 반환하세요.`;
}

function parseFindings(
  rawContent: string,
  originalText: string
): ContextFinding[] {
  try {
    let jsonStr = rawContent.trim();
    const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      jsonStr = codeBlock[1].trim();
    }

    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr)) return [];

    const findings: ContextFinding[] = [];

    for (const item of arr) {
      if (
        !item ||
        typeof item.originalText !== "string" ||
        typeof item.reason !== "string"
      ) {
        continue;
      }

      let start =
        typeof item.start === "number" && item.start >= 0
          ? Math.floor(item.start)
          : -1;
      let end =
        typeof item.end === "number" && item.end > start
          ? Math.floor(item.end)
          : -1;

      if (start < 0 || end <= start || end > originalText.length) {
        const idx = originalText.indexOf(item.originalText);
        if (idx === -1) continue;
        start = idx;
        end = idx + item.originalText.length;
      }

      if (start < 0 || end > originalText.length || end <= start) continue;

      const severity =
        item.severity === "major" || item.severity === "minor"
          ? item.severity
          : "minor";

      findings.push({
        id: crypto.randomUUID(),
        originalText: originalText.slice(start, end),
        start,
        end,
        reason: String(item.reason).slice(0, 500),
        severity,
      });
    }

    return findings;
  } catch (e) {
    console.error("[context-check] parseFindings error", e);
    return [];
  }
}

export async function checkContextLogic(
  input: ContextCheckInput
): Promise<ContextCheckResult> {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return { enabled: false, findings: [] };
  }

  try {
    const prompt = buildPrompt(input.text, input.existingIssues);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        `[context-check] Claude API error ${res.status}:`,
        errText.slice(0, 300)
      );
      return { enabled: true, findings: [], model: MODEL };
    }

    const data = await res.json();
    const content =
      data?.content?.[0]?.type === "text" ? data.content[0].text : "";

    if (!content) {
      console.warn("[context-check] empty content from Claude");
      return { enabled: true, findings: [], model: MODEL };
    }

    const findings = parseFindings(content, input.text);

    console.info(
      `[context-check] Claude OK — findings: ${findings.length}`
    );

    return {
      enabled: true,
      findings,
      model: MODEL,
    };
  } catch (e) {
    console.error("[context-check] unexpected error", e);
    return { enabled: true, findings: [], model: MODEL };
  }
}

export function contextFindingsToIssues(findings: ContextFinding[]): Issue[] {
  return findings.map((f) => ({
    id: f.id || crypto.randomUUID(),
    ruleId: "CONTEXT_LOGIC",
    severity: f.severity,
    originalText: f.originalText,
    start: f.start,
    end: f.end,
    reason: f.reason,
    suggestion: "문맥·논리를 다시 검토해 주세요.",
  }));
}
