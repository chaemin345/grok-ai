# Grok AI – 법률 보고서 검증 MVP

잘못된 **법령 인용**을 찾아 **빨간 밑줄**을 치고, **각주**로 이유를 설명합니다.  
문장을 자동으로 고치지 않습니다.

## 동작 방식

| 단계 | 담당 | 설명 |
|------|------|------|
| 1. 법령 인용 추출·대조 | 컴퓨터 | `OO법 제N조` 추출 → 국가법령 API 조회 |
| 2. 밑줄 + 각주 | 컴퓨터 | 존재하지 않는 법령에 빨간 밑줄, 각주로 이유 표시 |
| 3. 문맥·논리 이상 (선택) | Claude | API 키 연결 시에만 동작 (`lib/context-check.ts`) |

## 실행

```bash
npm install
cp .env.example .env.local
# LAW_API_OC 입력 (open.law.go.kr 발급)
npm run dev
```

브라우저: http://localhost:3000

## 환경변수

```env
LAW_API_OC=          # 국가법령 Open API (이메일 ID 앞부분)
CLAUDE_API_KEY=      # 문맥교정용 – 본인이 연결
LUNIA_API_KEY=       # (선택) API 보호
```

## 폴더 구조

```
app/
  page.tsx              # UI (밑줄·각주 표시)
  layout.tsx
  api/analyze/route.ts  # 분석 API
lib/
  analysis.ts           # 인용 추출 + 법 대조 + 밑줄/각주
  law-api.ts            # 국가법령정보센터 API
  context-check.ts      # Claude 연결 자리 (스텁)
  types.ts
```

## Claude 연결 방법

1. `.env.local`에 `CLAUDE_API_KEY` 입력
2. `lib/context-check.ts` 안의 `// TODO: Claude API 호출` 부분만 구현
3. UI에서 「문맥·논리 검사」 체크 후 실행
