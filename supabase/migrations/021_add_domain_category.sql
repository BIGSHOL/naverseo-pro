-- ============================================================
-- 021: Add domain_category to blog learning pipeline
-- 콘텐츠 도메인(산업/분야) 차원 추가
-- ============================================================

-- 1. analyzed_posts에 domain_category 컬럼 추가
ALTER TABLE analyzed_posts
  ADD COLUMN IF NOT EXISTS domain_category TEXT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_analyzed_posts_domain
  ON analyzed_posts (domain_category);
CREATE INDEX IF NOT EXISTS idx_analyzed_posts_domain_quality
  ON analyzed_posts (domain_category, quality_score DESC);

-- 2. keyword_patterns에 domain_category 컬럼 추가
ALTER TABLE keyword_patterns
  ADD COLUMN IF NOT EXISTS domain_category TEXT;

-- 기존 unique constraint 변경: (keyword, keyword_category) → (keyword, keyword_category, domain_category)
-- 중복 행 제거 (가장 최근 것만 남기고 삭제) 후 constraint 추가
DELETE FROM keyword_patterns a
USING keyword_patterns b
WHERE a.id < b.id
  AND a.keyword IS NOT DISTINCT FROM b.keyword
  AND a.keyword_category IS NOT DISTINCT FROM b.keyword_category
  AND a.domain_category IS NOT DISTINCT FROM b.domain_category;

ALTER TABLE keyword_patterns
  DROP CONSTRAINT IF EXISTS unique_keyword_pattern;
ALTER TABLE keyword_patterns
  ADD CONSTRAINT unique_keyword_pattern
  UNIQUE NULLS NOT DISTINCT (keyword, keyword_category, domain_category);

-- 도메인별 집계 인덱스
CREATE INDEX IF NOT EXISTS idx_keyword_patterns_domain
  ON keyword_patterns (domain_category);
CREATE INDEX IF NOT EXISTS idx_keyword_patterns_domain_global
  ON keyword_patterns (domain_category) WHERE keyword IS NULL;
