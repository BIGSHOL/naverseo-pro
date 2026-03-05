-- waitlist, post_seo_scores 테이블 RLS 활성화
-- Supabase Security Advisor: "RLS Disabled in Public" 경고 해결

-- 1. waitlist: 이메일 수집 테이블 (user_id 없음)
--    - 공개 INSERT만 허용 (랜딩 페이지에서 이메일 등록)
--    - SELECT/UPDATE/DELETE는 서비스 롤만 가능
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can manage waitlist"
  ON waitlist FOR ALL
  USING (auth.role() = 'service_role');

-- 2. post_seo_scores: SEO 점수 캐시 (user_id 없음)
--    - API Route에서 서비스 롤로만 접근
--    - 인증된 사용자는 읽기만 허용
ALTER TABLE post_seo_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read scores"
  ON post_seo_scores FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage scores"
  ON post_seo_scores FOR ALL
  USING (auth.role() = 'service_role');
