-- 011: 6개 요금제 확장 (lite, business 추가)
-- 기존: free, starter, pro, agency
-- 변경: free, lite, starter, pro, business, agency

-- plan CHECK 제약조건 업데이트
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'lite', 'starter', 'pro', 'business', 'agency'));
