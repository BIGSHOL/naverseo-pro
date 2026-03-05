-- generated_content 테이블에 tags 컬럼 추가
-- AI 콘텐츠 생성 시 만들어진 태그를 저장하여 히스토리 편집/SEO 분석에 활용
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
