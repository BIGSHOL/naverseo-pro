-- 004: 사용자 역할(role) 컬럼 추가
-- 기본값 'user', 관리자는 'admin'

-- 1) role 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- 2) 기존 RLS 정책 정리 후 재생성
-- 기존 "Users can view own data"는 FOR ALL이므로 삭제 후 SELECT/UPDATE 분리
DROP POLICY IF EXISTS "Users can view own data" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- 3) 사용자: 자기 프로필 조회
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 4) 사용자: 자기 프로필 수정
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 관리자 API는 Service Role Key(RLS 우회)로 동작하므로
-- 별도 admin RLS 정책 불필요

-- 첫 관리자 설정
UPDATE profiles SET role = 'admin' WHERE email = 'st2000423@gmail.com';
