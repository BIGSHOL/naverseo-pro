-- 게시글 SEO 점수 캐싱 테이블
CREATE TABLE post_seo_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  seo_score INT NOT NULL CHECK (seo_score >= 0 AND seo_score <= 100),
  metadata JSONB DEFAULT '{}'::jsonb,
  -- metadata 예시: { "title": "...", "charCount": 2000, "imageCount": 5 }
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_post_seo_scores_url ON post_seo_scores(url);
CREATE INDEX idx_post_seo_scores_analyzed_at ON post_seo_scores(analyzed_at);

-- 코멘트
COMMENT ON TABLE post_seo_scores IS '게시글 URL별 SEO 점수 캐시 (7일 유효)';
COMMENT ON COLUMN post_seo_scores.url IS '게시글 URL (고유 키)';
COMMENT ON COLUMN post_seo_scores.seo_score IS 'SEO 점수 (0~100)';
COMMENT ON COLUMN post_seo_scores.metadata IS '추가 메타데이터 (제목, 본문 길이, 이미지 수 등)';
COMMENT ON COLUMN post_seo_scores.analyzed_at IS '분석 시각 (7일 경과 시 재분석)';
