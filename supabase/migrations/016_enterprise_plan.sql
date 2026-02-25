-- 016: Business/Agency → Enterprise 플랜 통합 + USD 전환
-- 기존 business/agency 사용자를 enterprise로 마이그레이션

-- 1. 기존 business/agency 사용자 → enterprise로 변경
UPDATE profiles SET plan = 'enterprise' WHERE plan IN ('business', 'agency');

-- 2. profiles.plan CHECK 제약조건 업데이트
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'lite', 'starter', 'pro', 'enterprise', 'admin'));

-- 3. promo_codes.upgrade_plan CHECK 제약조건 업데이트
ALTER TABLE promo_codes DROP CONSTRAINT IF EXISTS promo_codes_upgrade_plan_check;
ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_upgrade_plan_check
  CHECK (upgrade_plan IN ('lite', 'starter', 'pro', 'enterprise'));

-- 4. 기존 business/agency 참조 프로모 코드 → enterprise
UPDATE promo_codes SET upgrade_plan = 'enterprise' WHERE upgrade_plan IN ('business', 'agency');

-- 5. 크레딧 쿼타 업데이트 (새 요금제 기준)
UPDATE profiles SET credits_monthly_quota = 250 WHERE plan = 'starter' AND credits_monthly_quota = 400;
UPDATE profiles SET credits_monthly_quota = 600 WHERE plan = 'pro' AND credits_monthly_quota = 750;
UPDATE profiles SET credits_monthly_quota = 2000 WHERE plan = 'enterprise';
