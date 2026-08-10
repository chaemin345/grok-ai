/**
 * 문맥·논리 이상 탐지 레이어
 *
 * - 단순 법 존재 여부: lib/analysis.ts (컴퓨터)
 * - 논리 비약 / 전제-결론 불일치 / 조문 오인용 문맥: 여기 (Claude)
 *
 * CLAUDE_API_KEY 를 .env.local 에 넣고,
 * 아래 TODO 구간만 본인 API 호출로 채우면 됩니다.
 * 고치지 말고, 구간 + 이유(각주)만 반환하세요.
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

export async function checkContextLogic(
  input: ContextCheckInput
): Promise<ContextCheckResult> {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return { enabled: false, findings: [] };
  }

  // ============================================================
  // TODO: 여기에 Claude API 호출만 연결하세요.
  //
  // 권장 프롬프트 요지:
  // - 법률 문서에서 논리 비약, 전제-결론 불일치, 문맥상 이상한 부분만 찾는다.
  // - 문장을 수정하지 않는다.
  // - existingIssues 에 이미 잡힌 구간은 제외하거나 참고만 한다.
  // - JSON 배열로 반환: [{ originalText, start, end, reason, severity }]
  //
  // 예시 (Anthropic Messages API):
  //
  // const res = await fetch("https://api.anthropic.com/v1/messages", {
  //   method: "POST",
  //   headers: {
  //     "content-type": "application/json",
  //     "x-api-key": apiKey,
  //     "anthropic-version": "2023-06-01",
  //   },
  //   body: JSON.stringify({
  //     model: "claude-sonnet-4-20250514",
  //     max_tokens: 2048,
  //     messages: [{ role: "user", content: prompt }],
  //   }),
  // });
  // const data = await res.json();
  // const findings = parseFindings(data); // 본인 파서
  // return { enabled: true, findings, model: "claude-sonnet-4" };
  // ============================================================

  console.info(
    "[context-check] CLAUDE_API_KEY 있음 — API 호출 코드를 아직 연결하지 않았습니다."
  );

  return {
    enabled: true,
    findings: [],
    model: "claude-pending",
  };
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
