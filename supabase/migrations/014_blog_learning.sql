-- ============================================================
-- 014: Blog Content Learning Pipeline
-- 상위 노출 블로그 포스트 패턴 학습 시스템
--
-- 키워드 리서치/콘텐츠 생성/경쟁사 분석 등 기존 기능 사용 시
-- 백그라운드로 상위 블로그 글의 구조 패턴을 수집·축적하여
-- AI 콘텐츠 생성 프롬프트에 데이터 기반 패턴을 주입
-- ============================================================

-- 1. 분석된 블로그 포스트 (구조 패턴만 저장, 본문 텍스트 없음 = 저작권 안전)
CREATE TABLE IF NOT EXISTS analyzed_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 검색 컨텍스트
  keyword TEXT NOT NULL,
  keyword_category TEXT,
  search_rank INT,

  -- 포스트 식별 (중복 방지)
  post_url TEXT NOT NULL,
  blogger_name TEXT,
  post_date TEXT,

  -- 구조 패턴 (본문 텍스트 없음)
  char_count INT NOT NULL DEFAULT 0,
  image_count INT NOT NULL DEFAULT 0,
  heading_count INT NOT NULL DEFAULT 0,
  paragraph_count INT NOT NULL DEFAULT 0,

  -- 링크 패턴
  internal_link_count INT DEFAULT 0,
  external_link_count INT DEFAULT 0,
  has_naver_map BOOLEAN DEFAULT false,
  has_naver_shopping BOOLEAN DEFAULT false,
  has_youtube BOOLEAN DEFAULT false,

  -- 메타 패턴
  title_length INT DEFAULT 0,
  has_keyword_in_title BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  category TEXT,

  -- 구조 분석
  has_list_format BOOLEAN DEFAULT false,
  has_table BOOLEAN DEFAULT false,
  has_bold_emphasis BOOLEAN DEFAULT false,
  has_numbered_items BOOLEAN DEFAULT false,

  -- 톤
  writing_tone TEXT,

  -- 품질 점수 (scorePost 결과)
  quality_score INT DEFAULT 0,
  quality_tier TEXT,

  -- 수집 출처
  collected_from TEXT NOT NULL DEFAULT 'unknown',
  collected_at TIMESTAMPTZ DEFAULT NOW(),

  -- 중복 방지
  CONSTRAINT unique_post_url UNIQUE (post_url)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_analyzed_posts_keyword
  ON analyzed_posts (keyword);
CREATE INDEX IF NOT EXISTS idx_analyzed_posts_category
  ON analyzed_posts (keyword_category);
CREATE INDEX IF NOT EXISTS idx_analyzed_posts_quality
  ON analyzed_posts (quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_analyzed_posts_collected_at
  ON analyzed_posts (collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyzed_posts_keyword_quality
  ON analyzed_posts (keyword, quality_score DESC);


-- 2. 키워드/카테고리별 집계 패턴
CREATE TABLE IF NOT EXISTS keyword_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 집계 키 (keyword=NULL이면 카테고리 전체 집계)
  keyword TEXT,
  keyword_category TEXT NOT NULL,

  -- 샘플 수
  sample_count INT NOT NULL DEFAULT 0,

  -- 평균 구조 패턴
  avg_char_count FLOAT DEFAULT 0,
  avg_image_count FLOAT DEFAULT 0,
  avg_heading_count FLOAT DEFAULT 0,
  avg_paragraph_count FLOAT DEFAULT 0,
  avg_internal_links FLOAT DEFAULT 0,
  avg_external_links FLOAT DEFAULT 0,
  avg_title_length FLOAT DEFAULT 0,

  -- 비율 패턴 (0.0 ~ 1.0)
  keyword_in_title_rate FLOAT DEFAULT 0,
  list_format_rate FLOAT DEFAULT 0,
  table_usage_rate FLOAT DEFAULT 0,
  naver_map_rate FLOAT DEFAULT 0,
  youtube_rate FLOAT DEFAULT 0,

  -- 톤 분포
  tone_distribution JSONB DEFAULT '{}',

  -- 상위 태그 (빈도순)
  top_tags JSONB DEFAULT '[]',

  -- 성공 패턴 (quality_score >= 9)
  success_patterns JSONB DEFAULT '{}',

  -- 최적 범위 (p25~p75)
  optimal_char_range JSONB DEFAULT '{}',
  optimal_image_range JSONB DEFAULT '{}',
  optimal_heading_range JSONB DEFAULT '{}',

  -- 타임스탬프
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_keyword_pattern UNIQUE (keyword, keyword_category)
);

CREATE INDEX IF NOT EXISTS idx_keyword_patterns_keyword
  ON keyword_patterns (keyword);
CREATE INDEX IF NOT EXISTS idx_keyword_patterns_category
  ON keyword_patterns (keyword_category);
CREATE INDEX IF NOT EXISTS idx_keyword_patterns_category_global
  ON keyword_patterns (keyword_category) WHERE keyword IS NULL;


-- 3. RLS 정책
ALTER TABLE analyzed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_patterns ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 읽기만 가능
CREATE POLICY "Authenticated users can read analyzed posts"
  ON analyzed_posts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service can manage analyzed posts"
  ON analyzed_posts FOR ALL
  USING (true);

CREATE POLICY "Authenticated users can read keyword patterns"
  ON keyword_patterns FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service can manage keyword patterns"
  ON keyword_patterns FOR ALL
  USING (true);
