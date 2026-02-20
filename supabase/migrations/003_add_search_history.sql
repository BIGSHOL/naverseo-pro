-- 검색 히스토리 테이블 (키워드 발굴 등 범용 검색 기록 저장)
CREATE TABLE IF NOT EXISTS search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'keyword-discovery',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: 사용자별 + 타입별 최근 순 조회 최적화
CREATE INDEX IF NOT EXISTS idx_search_history_user_type
  ON search_history(user_id, type, created_at DESC);

-- RLS 활성화
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- 사용자는 본인 데이터만 접근
CREATE POLICY "Users can manage own search history"
  ON search_history FOR ALL
  USING (auth.uid() = user_id);
