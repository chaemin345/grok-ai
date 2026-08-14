import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lunia.ai – 법률 보고서 검증",
  description:
    "국가법령 API 기반 법률 문서 검증. 잘못된 법령 인용에 빨간 밑줄과 각주를 표시합니다. B2B 법률 AI.",
  keywords: ["법률 AI", "법령 검증", "법률 보고서", "Lunia", "국가법령"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily:
            "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {children}
      </body>
    </html>
  );
}
