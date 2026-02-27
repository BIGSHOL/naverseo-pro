-- ============================================================
-- 020: 관리자 크레딧 바이패스 제거
-- 관리자도 일반 사용자와 동일하게 크레딧 차감
-- ============================================================

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
BEGIN
  -- 행 잠금 (race condition 방지)
  SELECT credits_balance, credits_monthly_quota, credits_reset_at
  INTO current_balance, current_quota, reset_time
  FROM profiles WHERE id = uid FOR UPDATE;

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
