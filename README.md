# Grok AI / Lunia.ai MVP

국가법령정보센터 API로 보고서의 **잘못된 법령 인용**을 찾아
**빨간 밑줄**을 치고 **각주**로 이유를 설명합니다. (자동 수정 없음)

## 구조
| 구분 | 담당 | 파일 |
|------|------|------|
| 법령 인용 추출·대조 | 컴퓨터 | `lib/analysis.ts`, `lib/law-api.ts` |
| 밑줄 + 각주 렌더 | 컴퓨터 | `lib/analysis.ts`, `app/api/analyze/route.ts` |
| 문맥·논리 이상 | Claude Pro (선택) | `lib/context-check.ts` |
| UI | Next.js | `app/page.tsx` |

## 실행
```bash
npm install
cp .env.example .env.local
# LAW_API_OC=open.law.go.kr 발급값
npm run dev
```

## 환경변수
- `LAW_API_OC` — 국가법령 Open API (필수에 가까움, 없으면 mock)
- `CLAUDE_API_KEY` — 문맥교정용 (선택)
- `LUNIA_API_KEY` — API 보호 (선택)
