"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { AnalyzeResult, Issue } from "@/lib/types";
import { escapeHtml } from "@/lib/utils";

const SAMPLE = `민법 제750조에 따라 불법행위 책임이 성립한다. 
「존재하지않는가상법」 제99조는 본 사안에 적용되지 않는다.
형법 제347조에 의한 사기죄가 성립할 수 있다.`;

const HISTORY_KEY = "lunia_verify_history";
const HISTORY_MAX = 12;

interface HistoryItem {
  id: string;
  timestamp: string;
  score: number;
  issueCount: number;
  preview: string;
  text: string;
  contextCheckEnabled?: boolean;
}

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_MAX)));
  } catch {
    // quota or private mode – ignore
  }
}

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState("");
  const [enableContext, setEnableContext] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const pushHistory = useCallback((item: HistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev.filter((h) => h.id !== item.id)].slice(
        0,
        HISTORY_MAX
      );
      saveHistory(next);
      return next;
    });
  }, []);

  function clearHistory() {
    setHistory([]);
    saveHistory([]);
  }

  function restoreFromHistory(item: HistoryItem) {
    setText(item.text);
    setResult(null);
    setError("");
    setShowHistory(false);
  }

  async function handleAnalyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, enableContextCheck: enableContext }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "rate_limited") {
          throw new Error("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        }
        if (data.error === "unauthorized") {
          throw new Error("API 키가 필요합니다.");
        }
        throw new Error(data.message || data.error || "분석 실패");
      }
      setResult(data);

      // Save to history (client-side only)
      const preview =
        (data.maskedPreview as string) ||
        text.trim().slice(0, 80).replace(/\s+/g, " ");
      pushHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: data.timestamp || new Date().toISOString(),
        score: data.score,
        issueCount: data.issues?.length ?? 0,
        preview: preview.slice(0, 100),
        text: text.trim(),
        contextCheckEnabled: data.contextCheckEnabled,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handlePrintReport() {
    if (!result || !reportRef.current) return;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      alert("팝업이 차단되었습니다. 팝업을 허용해 주세요.");
      return;
    }
    const scoreColor =
      result.score >= 80 ? "#16a34a" : result.score >= 50 ? "#ca8a04" : "#dc2626";
    const issuesHtml = result.issues
      .map(
        (iss, i) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top;">${i + 1}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top;"><code>${escapeHtml(iss.ruleId)}</code></td>
            <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top;">${severityBadge(iss.severity)}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top;">${escapeHtml(iss.originalText.slice(0, 80))}${iss.originalText.length > 80 ? "…" : ""}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top;">${escapeHtml(iss.reason)}</td>
          </tr>`
      )
      .join("");

    printWindow.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>Lunia.ai 검증 리포트 – ${result.score}점</title>
  <style>
    body { font-family: Pretendard, -apple-system, sans-serif; color: #0f172a; max-width: 800px; margin: 40px auto; padding: 0 24px; line-height: 1.6; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
    .score { font-size: 42px; font-weight: 800; color: ${scoreColor}; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0; }
    mark.lunia-error { background: #fecaca; text-decoration: underline wavy #dc2626; text-decoration-thickness: 2px; padding: 0 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0; background: #f1f5f9; }
    .footer { margin-top: 40px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .disclaimer { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #9a3412; margin-bottom: 20px; }
    @media print { body { margin: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>Lunia.ai 법률 보고서 검증 리포트</h1>
  <div class="meta">생성 시각: ${new Date(result.timestamp).toLocaleString("ko-KR")} · 이슈 ${result.issues.length}건${result.contextCheckEnabled ? " · 문맥검사 포함" : ""} · v${result.version || "1.1.0"}</div>
  <div class="disclaimer">본 리포트는 참고용이며 법적 자문을 대체하지 않습니다. 최종 판단은 반드시 변호사 등 전문가의 검토를 받으시기 바랍니다.</div>
  <div class="score">${result.score}<span style="font-size:18px;font-weight:500;color:#64748b;"> / 100</span></div>
  <div class="box">
    <h2 style="font-size:15px;margin:0 0 12px;">밑줄 결과</h2>
    <div style="line-height:1.8;font-size:14px;">${result.highlightedHtml}</div>
  </div>
  ${result.footnotes.length > 0 ? `
  <div class="box">
    <h2 style="font-size:15px;margin:0 0 12px;">각주</h2>
    <ol style="padding-left:20px;margin:0;">
      ${result.footnotes.map((fn) => `<li style="margin-bottom:8px;"><strong>[${fn.number}]</strong> ${escapeHtml(fn.reason)}</li>`).join("")}
    </ol>
  </div>` : ""}
  ${result.issues.length > 0 ? `
  <div class="box">
    <h2 style="font-size:15px;margin:0 0 12px;">이슈 상세</h2>
    <table>
      <thead><tr><th>#</th><th>규칙</th><th>심각도</th><th>원문</th><th>사유</th></tr></thead>
      <tbody>${issuesHtml}</tbody>
    </table>
  </div>` : ""}
  <div class="footer">
    Lunia.ai · 국가법령정보센터 API 기반 · 본 리포트는 참고용이며 법적 자문을 대체하지 않습니다.<br/>
    Generated by Lunia.ai v1.1 · B2B Legal Tech
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }</script>
</body>
</html>`);
    printWindow.document.close();
  }

  function severityBadge(s: string) {
    const colors: Record<string, string> = {
      critical: "#dc2626",
      major: "#ea580c",
      minor: "#ca8a04",
      info: "#64748b",
    };
    const c = colors[s] || "#64748b";
    return `<span style="color:${c};font-weight:600;">${s}</span>`;
  }

  function countBySeverity(issues: Issue[]) {
    return {
      critical: issues.filter((i) => i.severity === "critical").length,
      major: issues.filter((i) => i.severity === "major").length,
      minor: issues.filter((i) => i.severity === "minor").length,
      info: issues.filter((i) => i.severity === "info").length,
    };
  }

  const sev = result ? countBySeverity(result.issues) : null;
  const charCount = text.length;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "#0f172a",
          color: "#fff",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            L
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Lunia.ai</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>법률 보고서 검증</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            style={{
              fontSize: 12,
              background: showHistory ? "rgba(255,255,255,0.15)" : "transparent",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            최근 기록 {history.length > 0 ? `(${history.length})` : ""}
          </button>
          <div style={{ fontSize: 12, opacity: 0.6 }}>B2B Legal AI · v1.1</div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          maxWidth: 920,
          width: "100%",
          margin: "0 auto",
          padding: "32px 20px 60px",
        }}
      >
        <section style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}
          >
            법령 인용을 검증하세요
          </h1>
          <p style={{ color: "#64748b", margin: 0, fontSize: 15, lineHeight: 1.6 }}>
            잘못된 법령·조문 인용에{" "}
            <strong style={{ color: "#dc2626" }}>빨간 밑줄</strong>과{" "}
            <strong>각주</strong>를 표시합니다. 문장을 고치지 않습니다.
          </p>
        </section>

        {showHistory && (
          <section
            style={{
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              padding: 20,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                최근 검증 기록
              </h2>
              <div style={{ display: "flex", gap: 10 }}>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    style={{
                      fontSize: 12,
                      color: "#dc2626",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    전체 삭제
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
            {history.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                아직 저장된 기록이 없습니다. 검증을 실행하면 이 브라우저에
                자동으로 저장됩니다.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {history.map((h) => (
                  <li
                    key={h.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        minWidth: 48,
                        color:
                          h.score >= 80
                            ? "#16a34a"
                            : h.score >= 50
                              ? "#ca8a04"
                              : "#dc2626",
                      }}
                    >
                      {h.score}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#0f172a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {h.preview}
                        {h.preview.length >= 100 ? "…" : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        {new Date(h.timestamp).toLocaleString("ko-KR")} · 이슈{" "}
                        {h.issueCount}건
                        {h.contextCheckEnabled ? " · 문맥검사" : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreFromHistory(h)}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#3b82f6",
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: 8,
                        padding: "6px 12px",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      불러오기
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 11,
                color: "#94a3b8",
                lineHeight: 1.4,
              }}
            >
              기록은 이 브라우저의 localStorage에만 저장됩니다. 서버로 전송되지
              않습니다. (최대 {HISTORY_MAX}건)
            </p>
          </section>
        )}

        <section
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <label style={{ fontWeight: 600, fontSize: 14 }}>검증할 텍스트</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {charCount.toLocaleString()}자
              </span>
              <button
                type="button"
                onClick={() => setText(SAMPLE)}
                style={{
                  fontSize: 12,
                  color: "#3b82f6",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                샘플 불러오기
              </button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              "법률 보고서·의견서·계약서 초안을 붙여넣으세요…\n예: 민법 제750조에 따라 책임이 있다."
            }
            rows={11}
            maxLength={80000}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 14,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              resize: "vertical",
              fontFamily: "inherit",
              lineHeight: 1.65,
              boxSizing: "border-box",
              outline: "none",
            }}
          />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 16,
              marginTop: 16,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#475569",
                fontSize: 13,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={enableContext}
                onChange={(e) => setEnableContext(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              문맥·논리 검사{" "}
              <span style={{ color: "#94a3b8" }}>(Claude API)</span>
            </label>

            <div style={{ flex: 1 }} />

            <button
              onClick={handleAnalyze}
              disabled={loading || text.trim().length < 10}
              style={{
                padding: "12px 28px",
                background:
                  loading || text.trim().length < 10
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #0f172a, #1e293b)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor:
                  loading || text.trim().length < 10 ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(15,23,42,0.2)",
              }}
            >
              {loading ? "검증 중…" : "법령 검증 실행"}
            </button>
          </div>
        </section>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: "12px 16px",
              borderRadius: 10,
              marginBottom: 20,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {result && (
          <section ref={reportRef}>
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                padding: 24,
                marginBottom: 20,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 24,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
                  검증 점수
                </div>
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 800,
                    lineHeight: 1,
                    color:
                      result.score >= 80
                        ? "#16a34a"
                        : result.score >= 50
                          ? "#ca8a04"
                          : "#dc2626",
                  }}
                >
                  {result.score}
                  <span
                    style={{ fontSize: 18, fontWeight: 500, color: "#94a3b8" }}
                  >
                    {" "}
                    / 100
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
                  이슈 요약
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <StatBadge label="Critical" count={sev!.critical} color="#dc2626" />
                  <StatBadge label="Major" count={sev!.major} color="#ea580c" />
                  <StatBadge label="Minor" count={sev!.minor} color="#ca8a04" />
                  {sev!.info > 0 && (
                    <StatBadge label="Info" count={sev!.info} color="#64748b" />
                  )}
                </div>
                {result.contextCheckEnabled && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#6366f1" }}>
                    문맥·논리 검사 포함
                  </div>
                )}
              </div>

              <button
                onClick={handlePrintReport}
                style={{
                  padding: "10px 18px",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>📄</span> 리포트 다운로드 (PDF)
              </button>
            </div>

            <div
              style={{
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 20,
                fontSize: 13,
                color: "#9a3412",
                lineHeight: 1.5,
              }}
            >
              <strong>면책 고지:</strong> 본 검증 결과는 참고용이며 법적 자문을
              대체하지 않습니다. 최종 판단은 반드시 변호사 등 전문가의 검토를
              받으시기 바랍니다.
            </div>

            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                padding: 24,
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>
                밑줄 결과
              </h2>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #f1f5f9",
                  borderRadius: 10,
                  padding: 18,
                  lineHeight: 1.8,
                  fontSize: 14,
                }}
                dangerouslySetInnerHTML={{ __html: result.highlightedHtml }}
              />
            </div>

            {result.footnotes.length > 0 && (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  padding: 24,
                  marginBottom: 20,
                }}
              >
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>
                  각주 (왜 밑줄을 쳤는지)
                </h2>
                <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                  {result.footnotes.map((fn) => (
                    <li key={fn.number} style={{ marginBottom: 10, fontSize: 14 }}>
                      <strong>[{fn.number}]</strong> {fn.reason}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {result.issues.length > 0 && (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  padding: 24,
                  overflowX: "auto",
                }}
              >
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>
                  이슈 상세
                </h2>
                <table
                  style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>규칙</th>
                      <th style={thStyle}>심각도</th>
                      <th style={thStyle}>원문</th>
                      <th style={thStyle}>사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.issues.map((iss, i) => (
                      <tr key={iss.id}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={tdStyle}>
                          <code
                            style={{
                              fontSize: 11,
                              background: "#f1f5f9",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {iss.ruleId}
                          </code>
                        </td>
                        <td style={tdStyle}>
                          <SeverityTag severity={iss.severity} />
                        </td>
                        <td style={{ ...tdStyle, maxWidth: 180 }}>
                          {iss.originalText.slice(0, 60)}
                          {iss.originalText.length > 60 ? "…" : ""}
                        </td>
                        <td style={tdStyle}>{iss.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      <footer
        style={{
          borderTop: "1px solid #e2e8f0",
          padding: "20px 24px",
          textAlign: "center",
          fontSize: 12,
          color: "#94a3b8",
          background: "#fff",
        }}
      >
        Lunia.ai · 국가법령정보센터 API 기반 · 본 서비스는 참고용이며 법적 자문을
        대체하지 않습니다.
        <br />
        <span style={{ opacity: 0.7 }}>
          B2B Legal Tech · v1.1 · Powered by Grok AI
        </span>
      </footer>

      <style jsx global>{`
        mark.lunia-error {
          background: #fecaca;
          text-decoration: underline wavy #dc2626;
          text-decoration-thickness: 2px;
          padding: 0 2px;
        }
        sup.fn-ref {
          color: #dc2626;
          font-weight: 700;
          margin-left: 1px;
        }
        textarea:focus {
          border-color: #94a3b8 !important;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.2);
        }
      `}</style>
    </div>
  );
}

function StatBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div
      style={{
        background: count > 0 ? `${color}12` : "#f8fafc",
        border: `1px solid ${count > 0 ? color + "40" : "#e2e8f0"}`,
        borderRadius: 8,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 600,
        color: count > 0 ? color : "#94a3b8",
      }}
    >
      {label} {count}
    </div>
  );
}

function SeverityTag({ severity }: { severity: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    critical: { bg: "#fef2f2", color: "#dc2626" },
    major: { bg: "#fff7ed", color: "#ea580c" },
    minor: { bg: "#fefce8", color: "#ca8a04" },
    info: { bg: "#f8fafc", color: "#64748b" },
  };
  const s = map[severity] || map.info;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        fontWeight: 600,
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 6,
      }}
    >
      {severity}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "2px solid #e2e8f0",
  fontWeight: 600,
  fontSize: 12,
  color: "#64748b",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
};
