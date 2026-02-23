-- ============================================================
-- 012: 추천인 코드 + 프로모 코드 시스템
-- ============================================================

-- 1. profiles 테이블에 추천 관련 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id);

-- 2. handle_new_user 트리거 수정 (추천 코드 자동 생성)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;

  INSERT INTO public.profiles (id, email, referral_code)
  VALUES (NEW.id, NEW.email, new_code);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 기존 사용자 추천 코드 backfill
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE referral_code IS NULL LOOP
    LOOP
      new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
      SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    UPDATE profiles SET referral_code = new_code WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE profiles ALTER COLUMN referral_code SET NOT NULL;

-- 4. 추천 보상 기록 테이블
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referee_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referrer_credits INT NOT NULL DEFAULT 0,
  referee_credits INT NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'reverted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_id, referee_id)
);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral rewards"
  ON referral_rewards FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

CREATE POLICY "Service can insert referral rewards"
  ON referral_rewards FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_referral_rewards_referrer ON referral_rewards (referrer_id, created_at DESC);
CREATE INDEX idx_referral_rewards_referee ON referral_rewards (referee_id);

-- 5. 프로모 코드 테이블
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('credits', 'plan_upgrade')),
  bonus_credits INT DEFAULT 0,
  upgrade_plan TEXT CHECK (upgrade_plan IN ('lite', 'starter', 'pro', 'business', 'agency')),
  upgrade_days INT DEFAULT 30,
  max_uses INT,
  current_uses INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on promo_codes"
  ON promo_codes FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_promo_codes_code ON promo_codes (code);
CREATE INDEX idx_promo_codes_active ON promo_codes (is_active, expires_at);

-- 6. 프로모 코드 사용 기록 테이블
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  promo_code_id UUID REFERENCES promo_codes(id) ON DELETE CASCADE NOT NULL,
  reward_type TEXT NOT NULL,
  bonus_credits INT DEFAULT 0,
  upgrade_plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, promo_code_id)
);

ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own promo redemptions"
  ON promo_redemptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert promo redemptions"
  ON promo_redemptions FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_promo_redemptions_user ON promo_redemptions (user_id, created_at DESC);
CREATE INDEX idx_promo_redemptions_promo ON promo_redemptions (promo_code_id);

-- 7. 추천인 설정 (system_settings)
INSERT INTO system_settings (key, value, updated_at)
VALUES (
  'referral_config',
  '{"referrer_credits": 10, "referee_credits": 10, "enabled": true}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;
