-- LemonSqueezy 구독 관련 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_variant_id INTEGER,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none'
    CHECK (subscription_status IN (
      'none', 'on_trial', 'active', 'paused',
      'past_due', 'cancelled', 'expired'
    ));

-- 인덱스 (webhook에서 subscription_id로 빠른 조회)
CREATE INDEX IF NOT EXISTS idx_profiles_ls_subscription
  ON profiles (lemonsqueezy_subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_ls_customer
  ON profiles (lemonsqueezy_customer_id);
