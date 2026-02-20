-- 사용자별 AI 제공자 설정 (gemini 또는 claude)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini'
  CHECK (ai_provider IN ('gemini', 'claude'));
