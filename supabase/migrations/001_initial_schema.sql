-- NaverSEO Pro 초기 DB 스키마
-- Supabase PostgreSQL

-- 사용자 프로필
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'agency')),
  keywords_used_this_month INT DEFAULT 0,
  content_generated_this_month INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 키워드 리서치 결과 저장
CREATE TABLE keyword_research (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  seed_keyword TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI 생성 콘텐츠
CREATE TABLE generated_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_keyword TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  seo_score INT,
  seo_feedback JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 블로그 순위 트래킹
CREATE TABLE rank_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  blog_url TEXT NOT NULL,
  rank_position INT,
  section TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 프로젝트 (블로그별 관리)
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  blog_url TEXT,
  naver_blog_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 웨이트리스트 (사전 이메일 수집)
CREATE TABLE waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can view own keywords" ON keyword_research FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own content" ON generated_content FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own tracking" ON rank_tracking FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own projects" ON projects FOR ALL USING (auth.uid() = user_id);

-- 회원가입 시 자동 프로필 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 키워드 사용량 증가 RPC
CREATE OR REPLACE FUNCTION public.increment_keyword_usage(uid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET
    keywords_used_this_month = keywords_used_this_month + 1,
    updated_at = NOW()
  WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 콘텐츠 생성 사용량 증가 RPC
CREATE OR REPLACE FUNCTION public.increment_content_usage(uid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET
    content_generated_this_month = content_generated_this_month + 1,
    updated_at = NOW()
  WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 매월 사용량 리셋 (cron job으로 실행)
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET
    keywords_used_this_month = 0,
    content_generated_this_month = 0,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
