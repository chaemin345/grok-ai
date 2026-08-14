# Grok AI – 법률 보고서 검증 MVP

잘못된 **법령 인용**을 찾아 **빨간 밑줄**을 치고, **각주**로 이유를 설명합니다.  
문장을 자동으로 고치지 않습니다.

## 동작 방식

| 단계 | 담당 | 설명 |
|------|------|------|
| 1. 법령 인용 추출·대조 | 컴퓨터 | `OO법 제N조` 추출 → 국가법령 API로 법령명 + 조문 존재 여부 확인 |
| 2. 밑줄 + 각주 | 컴퓨터 | 존재하지 않는 법령/조문에 빨간 밑줄, 각주로 이유 표시 |
| 3. 문맥·논리 이상 (선택) | Claude | `CLAUDE_API_KEY` 연결 시 자동 동작 (`lib/context-check.ts`) |

## 실행

```bash
npm install
cp .env.example .env.local
# LAW_API_OC 입력 (open.law.go.kr 발급)
# CLAUDE_API_KEY 입력 (문맥 검사 사용 시)
npm run dev
```

브라우저: http://localhost:3000

## 환경변수

```env
LAW_API_OC=          # 국가법령 Open API (이메일 ID 앞부분)
CLAUDE_API_KEY=      # 문맥·논리 검사용 (Anthropic)
LUNIA_API_KEY=       # (선택) API 보호
```

## 폴더 구조

```
app/
  page.tsx              # UI (밑줄·각주 표시)
  layout.tsx
  api/analyze/route.ts  # 분석 API
lib/
  analysis.ts           # 인용 추출 + 법/조문 대조 + 밑줄/각주
  law-api.ts            # 국가법령정보센터 API (검색 + 조문 확인)
  context-check.ts      # Claude 문맥·논리 검사 (완료)
  types.ts
```

## Claude 문맥 검사 사용법

1. `.env.local`에 `CLAUDE_API_KEY` 입력
2. UI에서 「문맥·논리 검사」 체크 후 실행
3. 논리 비약 / 전제-결론 불일치 / 문맥상 이상한 구간에 밑줄 + 각주 추가
