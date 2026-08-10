# 제품 원칙

1. **빨간 밑줄 + 각주**가 핵심이다. AI가 문장을 고쳐 쓰지 않는다.
2. **단순 법 대조**는 컴퓨터(규칙 + 국가법령 API)가 한다.
3. **문맥·논리 이상**만 Claude에 맡긴다. (`lib/context-check.ts`의 TODO)

## Claude 연결

`.env.local`에 `CLAUDE_API_KEY`를 넣고 `lib/context-check.ts`의 TODO 블록만 구현하면 됩니다.

## 이후 유료 기능 후보

PDF 검증 리포트 다운로드 (밑줄·각주·점수 포함) — B2B에 적합.
