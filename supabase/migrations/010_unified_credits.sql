-- ============================================================
-- 010: 통합 크레딧 시스템 마이그레이션
-- 기존 기능별 카운터 → 단일 크레딧 풀로 전환
-- ============================================================

-- 1. profiles 테이블에 크레딧 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credits_balance INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS credits_monthly_quota INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ DEFAULT (date_trunc('month', NOW()) + interval '1 month');

-- 2. 기존 사용자 플랜 기반 크레딧 설정
UPDATE profiles SET
  credits_monthly_quota = CASE plan
    WHEN 'free'    THEN 30
    WHEN 'starter' THEN 200
    WHEN 'pro'     THEN 800
    WHEN 'agency'  THEN 3000
    ELSE 30
  END,
  credits_balance = CASE plan
    WHEN 'free'    THEN 30
    WHEN 'starter' THEN 200
    WHEN 'pro'     THEN 800
    WHEN 'agency'  THEN 3000
    ELSE 30
  END,
  credits_reset_at = date_trunc('month', NOW()) + interval '1 month';

-- 관리자는 사실상 무제한
UPDATE profiles SET
  credits_balance = 999999,
  credits_monthly_quota = 999999
WHERE role = 'admin';

-- 3. 크레딧 사용 내역 로그 테이블
CREATE TABLE IF NOT EXISTS credit_usage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  feature TEXT NOT NULL,
  credits_spent INT NOT NULL,
  credits_before INT NOT NULL,
  credits_after INT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE credit_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit log"
  ON credit_usage_log FOR SELECT
  USING (auth.uid() = user_id);

-- service_role 에서 insert 허용
CREATE POLICY "Service can insert credit log"
  ON credit_usage_log FOR INSERT
  WITH CHECK (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_user_created
  ON credit_usage_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_usage_log_user_feature
  ON credit_usage_log (user_id, feature);

-- 4. deduct_credits RPC (원자적 차감 + 로그 + lazy 리셋)
CREATE OR REPLACE FUNCTION public.deduct_credits(
  uid UUID,
  cost INT,
  feature_name TEXT,
  meta JSONB DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, remaining INT, message TEXT) AS $$
DECLARE
  current_balance INT;
  current_quota INT;
  reset_time TIMESTAMPTZ;
  user_role TEXT;
BEGIN
  -- 행 잠금 (race condition 방지)
  SELECT credits_balance, credits_monthly_quota, credits_reset_at, role
  INTO current_balance, current_quota, reset_time, user_role
  FROM profiles WHERE id = uid FOR UPDATE;

  -- 관리자도 동일하게 크레딧 차감 (바이패스 없음)

  -- lazy 월간 리셋
  IF NOW() >= reset_time THEN
    current_balance := current_quota;
    UPDATE profiles SET
      credits_balance = current_quota,
      credits_reset_at = date_trunc('month', NOW()) + interval '1 month',
      updated_at = NOW()
    WHERE id = uid;
  END IF;

  -- 잔액 부족
  IF current_balance < cost THEN
    RETURN QUERY SELECT false, current_balance,
      format('크레딧이 부족합니다. (잔여: %s, 필요: %s)', current_balance, cost)::TEXT;
    RETURN;
  END IF;

  -- 차감
  UPDATE profiles SET
    credits_balance = credits_balance - cost,
    updated_at = NOW()
  WHERE id = uid;

  -- 로그 기록
  INSERT INTO credit_usage_log (user_id, feature, credits_spent, credits_before, credits_after, metadata)
  VALUES (uid, feature_name, cost, current_balance, current_balance - cost, meta);

  RETURN QUERY SELECT true, (current_balance - cost), ''::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 월간 크레딧 리셋 함수 (cron 작업용)
CREATE OR REPLACE FUNCTION public.reset_credits_monthly()
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET
    credits_balance = credits_monthly_quota,
    credits_reset_at = date_trunc('month', NOW()) + interval '1 month',
    updated_at = NOW()
  WHERE credits_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
