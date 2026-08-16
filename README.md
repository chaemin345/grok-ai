# Lunia.ai – 법률 보고서 검증 (v1.0)

잘못된 **법령·조문 인용**을 찾아 **빨간 밑줄**과 **각주**로 표시합니다.  
문장을 자동으로 고치지 않습니다. (B2B Legal AI)

## 동작 방식

| 단계 | 담당 | 설명 |
|------|------|------|
| 1. 법령 인용 추출·대조 | 컴퓨터 | `OO법 제N조` 추출 → 국가법령 API (법령명 + 조문) |
| 2. 밑줄 + 각주 + 점수 | 컴퓨터 | Critical / Major / Minor / Info 이슈 표시 |
| 3. 문맥·논리 이상 (선택) | Claude | `CLAUDE_API_KEY` 있을 때 |
| 4. 리포트 | 브라우저 | PDF/인쇄용 검증 리포트 다운로드 |

## 실행

```bash
npm install
cp .env.example .env.local
# LAW_API_OC 입력 (open.law.go.kr)
# CLAUDE_API_KEY (문맥 검사용, 선택)
# LUNIA_API_KEY (API 보호용, 선택)
npm run dev
```

브라우저: http://localhost:3000

## 환경변수

```env
LAW_API_OC=          # 국가법령 Open API (이메일 ID 앞부분)
CLAUDE_API_KEY=      # 문맥·논리 검사 (Anthropic)
LUNIA_API_KEY=       # (선택) API 보호 – 헤더 x-lunia-key 또는 Bearer
```

## 폴더 구조

```
app/
  page.tsx              # 비즈니스 UI + 리포트 다운로드
  layout.tsx
  api/analyze/route.ts  # 분석 API (rate limit + optional key)
lib/
  analysis.ts           # 인용 추출 + 법/조문 대조 + 하이라이트
  law-api.ts            # 국가법령정보센터 API
  context-check.ts      # Claude 문맥·논리 검사
  types.ts
  utils.ts              # escapeHtml, maskPersonalInfo
```

## v1.0 주요 개선

- HTML 이스케이프 보안 수정 (XSS 방지)
- 법령/조문 검사 병렬 처리 (속도 향상)
- 조문 확인 불확실 시 Info 등급 분리
- 면책 고지 강화
- 문자 수 표시, 버전 표시
- Timeout 및 에러 핸들링 강화
- 인쇄 리포트 품질 개선

## 비즈니스 포인트

- **수정하지 않는다** → 책임 경계 명확
- **국가법령 API 기반** → 근거 있는 검증
- **PDF 리포트** → 법무팀 / 고객 공유용
- **API key gate** → 상용화 준비

## 면책

본 서비스는 참고용이며 법적 자문을 대체하지 않습니다.  
최종 판단은 반드시 변호사 등 전문가의 검토를 받으시기 바랍니다.
