# CLAUDE.md

## 코드 컨벤션
- 한국어 주석 사용
- 컴포넌트는 함수형 + TypeScript
- API 응답 타입은 apps/mobile/lib/types.ts에 정의
- 존댓말로 답변할 것

## 모델별 동작
- Opus: 계획 먼저 제시 → 승인 후 구현
- Sonnet: 바로 구현 진행

## 금지사항
- .env 파일 수정 금지
- supabase 스키마 직접 변경 금지 (scripts/supabase-rls.sql 통해서만)
- main 브랜치에 직접 push 금지

## 프로젝트 구조
- apps/web: Astro (프론트엔드)
- apps/mobile: React Native / Expo
- apps/server: API 서버
- DB: Supabase (RLS 설정은 scripts/supabase-rls.sql)
