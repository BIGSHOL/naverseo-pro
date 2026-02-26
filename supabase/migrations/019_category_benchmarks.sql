-- 카테고리별 벤치마크 축적 테이블
-- 블로그 지수 분석 시 자동 축적, 카테고리당 1행 (12행 고정)
-- sample_count >= 20이면 축적 데이터 사용, 미만이면 정적 테이블 폴백

CREATE TABLE category_benchmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_category TEXT NOT NULL UNIQUE,
  sample_count INT DEFAULT 0,
  -- 평균값 (현재 기준)
  avg_posting_frequency REAL DEFAULT 0,
  avg_title_length REAL DEFAULT 0,
  avg_content_length REAL DEFAULT 0,
  avg_image_rate REAL DEFAULT 0,
  avg_topic_focus REAL DEFAULT 0,
  avg_image_count REAL DEFAULT 0,
  avg_comment_count REAL DEFAULT 0,
  avg_sympathy_count REAL DEFAULT 0,
  avg_daily_visitors REAL DEFAULT 0,
  avg_blog_age REAL DEFAULT 0,
  avg_total_post_count REAL DEFAULT 0,
  -- 75퍼센타일 (상위 블로거 기준)
  p75_posting_frequency REAL DEFAULT 0,
  p75_daily_visitors REAL DEFAULT 0,
  -- 메타
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 서비스 키(admin)만 쓰기 가능, 인증 사용자 읽기 가능
ALTER TABLE category_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read benchmarks"
  ON category_benchmarks FOR SELECT
  USING (auth.role() = 'authenticated');

-- 서비스 키(service_role)로만 INSERT/UPDATE
CREATE POLICY "Service role can manage benchmarks"
  ON category_benchmarks FOR ALL
  USING (auth.role() = 'service_role');
