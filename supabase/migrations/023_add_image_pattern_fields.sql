-- Blog Learning: 이미지 패턴 필드 추가
-- analyzed_posts에 이미지 위치/유형 컬럼, keyword_patterns에 집계 컬럼

ALTER TABLE analyzed_posts
  ADD COLUMN IF NOT EXISTS image_positions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS image_types TEXT[] DEFAULT '{}';

-- keyword_patterns 테이블에 이미지 집계 필드가 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'keyword_patterns' AND column_name = 'image_position_rates'
  ) THEN
    ALTER TABLE keyword_patterns ADD COLUMN image_position_rates JSONB DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'keyword_patterns' AND column_name = 'top_image_types'
  ) THEN
    ALTER TABLE keyword_patterns ADD COLUMN top_image_types JSONB DEFAULT '[]';
  END IF;
END $$;
