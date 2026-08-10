import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Grok AI – 법률 보고서 검증",
  description: "국가법령 API 기반 법률 문서 검증 (밑줄 + 각주)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          background: "#fff",
          color: "#111",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
