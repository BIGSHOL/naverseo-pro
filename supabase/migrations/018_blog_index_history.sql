-- 블로그 지수 히스토리 트래킹
-- 매 측정 시 자동 저장, 1일 1회 중복 방지 (같은 날 재측정 시 업데이트)
-- full_result: 전체 측정 결과 캐시 (즉시 불러오기용)

CREATE TABLE blog_index_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blog_url TEXT NOT NULL,
  blog_id TEXT,
  total_score INT NOT NULL,
  -- 4축 점수 (축별 추이 차트 가능)
  search_score INT,
  popularity_score INT,
  content_score INT,
  activity_score INT,
  abuse_penalty INT DEFAULT 0,
  -- 등급 정보
  level_tier INT,
  level_label TEXT,
  -- 핵심 지표 (JSONB)
  metrics JSONB,
  -- 전체 결과 캐시 (페이지 즉시 로딩용)
  full_result JSONB,
  is_demo BOOLEAN DEFAULT FALSE,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blog_index_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blog history"
  ON blog_index_history FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_bih_user_blog_date
  ON blog_index_history (user_id, blog_url, checked_at DESC);
