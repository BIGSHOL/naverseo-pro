-- 007_add_daily_recommendations.sql
-- profiles 테이블에 일일 추천 키워드 저장 컬럼 추가

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS recommended_keywords JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS recommendations_updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN profiles.recommended_keywords IS '개인화된 일일 추천 키워드 목록 (최대 6개)';
COMMENT ON COLUMN profiles.recommendations_updated_at IS '마지막 추천 업데이트 시각 (하루 1회 갱신)';
