-- ============================================================
-- 017: handle_new_user 트리거 - 소셜 로그인 NULL 이메일 대응
-- ============================================================
-- 카카오/네이버 등 소셜 로그인 시 auth.users.email이 NULL일 수 있음
-- profiles.email NOT NULL 제약으로 인해 트리거 실패 → "Database error saving new user"
-- 해결: COALESCE + raw_user_meta_data 폴백 + EXCEPTION 핸들링

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  user_email TEXT;
BEGIN
  user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');

  LOOP
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;

  INSERT INTO public.profiles (id, email, referral_code)
  VALUES (NEW.id, user_email, new_code)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
