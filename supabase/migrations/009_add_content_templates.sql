-- 사용자 정의 콘텐츠 템플릿 테이블
CREATE TABLE IF NOT EXISTS content_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- 고급 옵션 저장 (JSON)
  advanced_options JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가 (빠른 조회)
CREATE INDEX IF NOT EXISTS idx_content_templates_user_id ON content_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_created_at ON content_templates(user_id, created_at DESC);

-- RLS (Row Level Security) 활성화
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 본인의 템플릿만 접근 가능
CREATE POLICY "Users can view own templates"
  ON content_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON content_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON content_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON content_templates FOR DELETE
  USING (auth.uid() = user_id);

-- 템플릿 개수 제한 함수 (최대 5개)
CREATE OR REPLACE FUNCTION check_template_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM content_templates WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION '템플릿은 최대 5개까지만 저장할 수 있습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: INSERT 전에 개수 체크
CREATE TRIGGER check_template_limit_trigger
  BEFORE INSERT ON content_templates
  FOR EACH ROW
  EXECUTE FUNCTION check_template_limit();

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: UPDATE 시 updated_at 자동 갱신
CREATE TRIGGER update_content_templates_updated_at
  BEFORE UPDATE ON content_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
