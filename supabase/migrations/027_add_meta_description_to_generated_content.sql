-- generated_content 테이블에 meta_description 컬럼 추가
-- AI 콘텐츠 생성 시 만들어진 메타 설명을 별도 컬럼으로 저장 (검색/조회 용이)
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS meta_description TEXT;
