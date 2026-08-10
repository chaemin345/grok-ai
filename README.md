# Grok AI / Lunia.ai MVP

국가법령정보센터 Open API를 연결해 보고서를 검증하는 도구입니다.

## 기능
- 텍스트 붙여넣기 → 법령 인용(「OO법 제N조」) 자동 추출
- 실제 법령 존재 여부 확인
- 틀린 부분 밑줄 + 각주 설명
- 점수 산출

## 실행 방법
```bash
npm install
cp .env.example .env.local
# .env.local 에 LAW_API_OC=발급받은값 입력
npm run dev
```

## 환경변수
- `LAW_API_OC` : open.law.go.kr 에서 발급받은 이메일 ID 앞부분
- `LUNIA_API_KEY` : (선택) API 보호용 키

## 구조
- `app/page.tsx` : 프론트엔드
- `app/api/analyze/route.ts` : 분석 API
- `lib/analysis.ts` : 인용 추출 + 검증 로직
- `lib/law-api.ts` : 국가법령 API 연동
- `lib/types.ts` : 타입 정의
