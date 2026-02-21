-- 008_add_blog_profile.sql
-- profiles 테이블에 블로그 프로필 정보 추가

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS blog_url TEXT,
ADD COLUMN IF NOT EXISTS blog_id TEXT,
ADD COLUMN IF NOT EXISTS blog_name TEXT,
ADD COLUMN IF NOT EXISTS blog_thumbnail TEXT,
ADD COLUMN IF NOT EXISTS blog_total_posts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS blog_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS blog_level TEXT,
ADD COLUMN IF NOT EXISTS blog_category_keywords TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS blog_last_post_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS blog_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS blog_verification_code TEXT,
ADD COLUMN IF NOT EXISTS blog_verification_code_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS blog_verification_attempts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS blog_verification_last_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS blog_verification_blocked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blog_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blog_verified_at TIMESTAMPTZ;

-- 블로그 URL 중복 방지를 위한 UNIQUE 제약 조건
-- NULL 값은 UNIQUE 제약에서 제외되므로 블로그를 등록하지 않은 사용자는 영향 없음
CREATE UNIQUE INDEX IF NOT EXISTS profiles_blog_url_unique
ON profiles(blog_url)
WHERE blog_url IS NOT NULL;

COMMENT ON COLUMN profiles.blog_url IS '등록된 블로그 URL (https://blog.naver.com/myblog)';
COMMENT ON COLUMN profiles.blog_id IS '네이버 블로그 ID (myblog)';
COMMENT ON COLUMN profiles.blog_name IS '블로그 이름 (닉네임)';
COMMENT ON COLUMN profiles.blog_thumbnail IS '블로그 썸네일 이미지 URL';
COMMENT ON COLUMN profiles.blog_total_posts IS '총 포스트 수';
COMMENT ON COLUMN profiles.blog_score IS '최근 측정된 블로그 지수 (0~100)';
COMMENT ON COLUMN profiles.blog_level IS '블로그 등급 (파워, 최적화1, 일반1 등)';
COMMENT ON COLUMN profiles.blog_category_keywords IS '주요 주제 키워드 배열';
COMMENT ON COLUMN profiles.blog_last_post_date IS '최근 포스팅 날짜';
COMMENT ON COLUMN profiles.blog_updated_at IS '블로그 정보 마지막 업데이트 시각';
COMMENT ON COLUMN profiles.blog_verification_code IS '블로그 소유권 인증 코드 (6자리 영숫자, 10분 유효)';
COMMENT ON COLUMN profiles.blog_verification_code_created_at IS '인증 코드 생성 시각 (10분 후 만료)';
COMMENT ON COLUMN profiles.blog_verification_attempts IS '1시간 내 인증 시도 횟수 (5회 제한)';
COMMENT ON COLUMN profiles.blog_verification_last_attempt_at IS '마지막 인증 시도 시각';
COMMENT ON COLUMN profiles.blog_verification_blocked IS '인증 차단 여부 (관리자가 해제 가능)';
COMMENT ON COLUMN profiles.blog_verified IS '블로그 소유권 인증 완료 여부';
COMMENT ON COLUMN profiles.blog_verified_at IS '블로그 소유권 인증 완료 시각';
