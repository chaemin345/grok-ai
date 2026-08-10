/**
 * 문맥교정 레이어 (사업성)
 *
 * 원칙:
 * - 단순 법 존재 여부 / 인용 형식 → 컴퓨터(규칙+법령 API)가 처리 (lib/analysis.ts)
 * - 논리·문맥상 이상한 부분만 → Claude Pro 등 LLM 연동
 *
 * 이 파일은 인터페이스와 스텁만 제공한다.
 * CLAUDE_API_KEY 가 있을 때만 실제 호출하도록 확장하면 된다.
 */

import type { Issue } from "./types";

export interface ContextCheckInput {
  text: string;
  /** 이미 규칙 기반으로 찾은 법령 이슈 (중복 방지용) */
  existingIssues: Issue[];
}

export interface ContextFinding {
  id: string;
  /** 원문 구간 */
  originalText: string;
  start: number;
  end: number;
  /** 왜 논리적으로 이상한지 (각주용) */
  reason: string;
  severity: "major" | "minor";
}

export interface ContextCheckResult {
  enabled: boolean;
  findings: ContextFinding[];
  model?: string;
}

/**
 * 문맥·논리 이상 탐지
 * - 키가 없으면 빈 결과 + enabled:false
 * - 나중에 Anthropic Claude Pro API 연결
 */
export async function checkContextLogic(
  input: ContextCheckInput
): Promise<ContextCheckResult> {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return { enabled: false, findings: [] };
  }

  // TODO: Claude Pro 연동
  // 1) 프롬프트: "법률 문서에서 논리 비약, 전제-결론 불일치, 조문 오인용 문맥만 찾아라.
  //    고치지 말고, 구간과 이유만 JSON으로 반환."
  // 2) existingIssues 구간은 제외하거나 참고만
  // 3) findings 를 Issue 형태로 합쳐 밑줄+각주에 추가

  // 현재는 스텁 (키만 있으면 호출 자리 표시)
  console.info("[context-check] CLAUDE_API_KEY 감지됨 — 실제 호출 로직은 다음 단계에서 연결");

  return {
    enabled: true,
    findings: [],
    model: "claude-stub",
  };
}

/**
 * ContextFinding → 공통 Issue 로 변환 (밑줄/각주 파이프라인 재사용)
 */
export function contextFindingsToIssues(findings: ContextFinding[]): Issue[] {
  return findings.map((f) => ({
    id: f.id,
    ruleId: "CONTEXT_LOGIC",
    severity: f.severity,
    originalText: f.originalText,
    start: f.start,
    end: f.end,
    reason: f.reason,
    suggestion: "문맥·논리를 다시 검토해 주세요.",
  }));
}
