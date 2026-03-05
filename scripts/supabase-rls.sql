-- ============================================================
-- Supabase Row Level Security (RLS) 설정
-- Supabase Dashboard > SQL Editor 에서 실행하세요.
-- ============================================================

-- ── bookmarks 마이그레이션 ────────────────────────────────
-- reading_status 컬럼 추가 (없으면 추가)
ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS reading_status TEXT NOT NULL DEFAULT 'to_read'
  CHECK (reading_status IN ('to_read', 'reading', 'read'));

-- ── bookmarks ──────────────────────────────────────────────
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- 기존 정책 초기화 (재실행 시 오류 방지)
DROP POLICY IF EXISTS "bookmarks_select_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_insert_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_update_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_delete_own" ON bookmarks;

-- 본인 북마크만 조회
CREATE POLICY "bookmarks_select_own"
  ON bookmarks FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 북마크만 추가 (user_id를 JWT uid로 강제)
CREATE POLICY "bookmarks_insert_own"
  ON bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 북마크만 수정 (reading_status 변경용)
CREATE POLICY "bookmarks_update_own"
  ON bookmarks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 본인 북마크만 삭제
CREATE POLICY "bookmarks_delete_own"
  ON bookmarks FOR DELETE
  USING (auth.uid() = user_id);


-- ── profiles ───────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- 본인 프로필만 조회
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 본인 프로필만 생성
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 본인 프로필만 수정
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ── book_reviews ────────────────────────────────────────────
ALTER TABLE book_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_all" ON book_reviews;
DROP POLICY IF EXISTS "reviews_insert_own" ON book_reviews;
DROP POLICY IF EXISTS "reviews_update_own" ON book_reviews;
DROP POLICY IF EXISTS "reviews_delete_own" ON book_reviews;

-- 한줄평은 누구나 조회 가능 (공개 데이터)
CREATE POLICY "reviews_select_all"
  ON book_reviews FOR SELECT
  USING (true);

-- 본인 리뷰만 작성
CREATE POLICY "reviews_insert_own"
  ON book_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 리뷰만 수정
CREATE POLICY "reviews_update_own"
  ON book_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 본인 리뷰만 삭제
CREATE POLICY "reviews_delete_own"
  ON book_reviews FOR DELETE
  USING (auth.uid() = user_id);


-- ── book_insights ───────────────────────────────────────────
-- AI 도서 인사이트 캐시 테이블 (서비스 롤로만 쓰기, 읽기는 공개)
ALTER TABLE book_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "book_insights_select_all" ON book_insights;

-- 누구나 조회 가능 (공개 캐시 데이터)
CREATE POLICY "book_insights_select_all"
  ON book_insights FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE는 서비스 롤 키가 RLS를 우회하므로 별도 정책 불필요


-- ── push_tokens ──────────────────────────────────────────────
-- 푸쉬 알림 토큰 저장 테이블 (Expo Push Token)
CREATE TABLE IF NOT EXISTS push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_select_own" ON push_tokens;
DROP POLICY IF EXISTS "push_tokens_insert_own" ON push_tokens;
DROP POLICY IF EXISTS "push_tokens_delete_own" ON push_tokens;

-- 본인 토큰만 조회
CREATE POLICY "push_tokens_select_own"
  ON push_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 토큰만 저장
CREATE POLICY "push_tokens_insert_own"
  ON push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 토큰만 삭제
CREATE POLICY "push_tokens_delete_own"
  ON push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- 서비스 롤이 북마크 기반으로 수신자 토큰을 조회할 수 있도록 허용
-- (웹 API에서 서비스 롤 키로 조회)
-- 참고: 서비스 롤은 RLS를 우회하므로 별도 정책 불필요


-- ── favorite_libraries ────────────────────────────────────────
-- 사용자가 즐겨찾기한 도서관 (최대 3개)
CREATE TABLE IF NOT EXISTS favorite_libraries (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lib_code   TEXT NOT NULL,
  lib_name   TEXT NOT NULL,
  address    TEXT,
  tel        TEXT,
  latitude   TEXT,
  longitude  TEXT,
  homepage   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lib_code)
);

ALTER TABLE favorite_libraries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fav_libs_select_own" ON favorite_libraries;
DROP POLICY IF EXISTS "fav_libs_insert_own" ON favorite_libraries;
DROP POLICY IF EXISTS "fav_libs_delete_own" ON favorite_libraries;

-- 본인 즐겨찾기만 조회
CREATE POLICY "fav_libs_select_own"
  ON favorite_libraries FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 즐겨찾기만 추가
CREATE POLICY "fav_libs_insert_own"
  ON favorite_libraries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 즐겨찾기만 삭제
CREATE POLICY "fav_libs_delete_own"
  ON favorite_libraries FOR DELETE
  USING (auth.uid() = user_id);


-- ── 추천 알림 pg_cron 스케줄 ────────────────────────────────
-- Supabase Dashboard > SQL Editor 에서 실행
-- 사전 조건: pg_cron 확장 활성화 필요
--   Supabase Dashboard > Database > Extensions > pg_cron 활성화

-- 기존 스케줄 제거 후 재등록
SELECT cron.unschedule('send-recommendation-notifications') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-recommendation-notifications'
);

-- 매주 월요일 오전 9시 (KST = UTC+9, 즉 UTC 00:00)
SELECT cron.schedule(
  'send-recommendation-notifications',
  '0 0 * * 1',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-recommendation-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
