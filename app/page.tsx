"use client";

import { useState } from "react";
import type { AnalyzeResult } from "@/lib/types";

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState("");
  const [enableContext, setEnableContext] = useState(false);

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
      if (!res.ok) throw new Error(data.error || "분석 실패");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 880, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700 }}>Grok AI – 법률 보고서 검증</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>
        잘못된 법령 인용에 <strong>빨간 밑줄</strong>을 치고,{" "}
        <strong>각주</strong>로 이유를 설명합니다. 문장을 고치지 않습니다.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="예: 민법 제750조에 따라 책임이 있다. 존재하지않는가상법 제99조는 적용되지 않는다."
        rows={12}
        style={{
          width: "100%",
          padding: 14,
          fontSize: 15,
          border: "1px solid #ddd",
          borderRadius: 8,
          resize: "vertical",
        }}
      />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
          color: "#444",
          fontSize: 14,
        }}
      >
        <input
          type="checkbox"
          checked={enableContext}
          onChange={(e) => setEnableContext(e.target.checked)}
        />
        문맥·논리 검사 (Claude API 연결 후 동작)
      </label>

      <button
        onClick={handleAnalyze}
        disabled={loading || text.length < 10}
        style={{
          marginTop: 12,
          padding: "11px 24px",
          background: loading ? "#999" : "#111",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 15,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "검증 중…" : "법령 검증 실행"}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 14 }}>{error}</p>}

      {result && (
        <section style={{ marginTop: 36 }}>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
            점수:{" "}
            <span
              style={{
                color:
                  result.score >= 80
                    ? "#16a34a"
                    : result.score >= 50
                      ? "#ca8a04"
                      : "#dc2626",
              }}
            >
              {result.score}
            </span>
            <span style={{ fontSize: 14, color: "#666", marginLeft: 12 }}>
              이슈 {result.issues.length}건
              {result.contextCheckEnabled ? " · 문맥검사 ON" : ""}
            </span>
          </div>

          <h2 style={{ fontSize: 17, marginBottom: 8 }}>밑줄 결과</h2>
          <div
            style={{
              background: "#fafafa",
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 18,
              lineHeight: 1.75,
              fontSize: 15,
            }}
            dangerouslySetInnerHTML={{ __html: result.highlightedHtml }}
          />

          {result.footnotes.length > 0 && (
            <>
              <h2 style={{ fontSize: 17, marginTop: 28, marginBottom: 8 }}>
                각주 (왜 밑줄을 쳤는지)
              </h2>
              <ol style={{ paddingLeft: 20, lineHeight: 1.65 }}>
                {result.footnotes.map((fn) => (
                  <li key={fn.number} style={{ marginBottom: 8 }}>
                    <strong>[{fn.number}]</strong> {fn.reason}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

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
      `}</style>
    </main>
  );
}
