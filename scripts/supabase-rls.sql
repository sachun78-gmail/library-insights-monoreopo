-- ============================================================
-- Supabase Row Level Security (RLS) 설정
-- Supabase Dashboard > SQL Editor 에서 실행하세요.
-- ============================================================

-- ── bookmarks ──────────────────────────────────────────────
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- 기존 정책 초기화 (재실행 시 오류 방지)
DROP POLICY IF EXISTS "bookmarks_select_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_insert_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_delete_own" ON bookmarks;

-- 본인 북마크만 조회
CREATE POLICY "bookmarks_select_own"
  ON bookmarks FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 북마크만 추가 (user_id를 JWT uid로 강제)
CREATE POLICY "bookmarks_insert_own"
  ON bookmarks FOR INSERT
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
