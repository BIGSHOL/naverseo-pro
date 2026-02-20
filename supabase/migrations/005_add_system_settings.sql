-- 시스템 설정 테이블 (기능 비활성화 등 글로벌 설정)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본값: 비활성화된 기능 없음
INSERT INTO system_settings (key, value)
VALUES ('disabled_features', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS 활성화
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 읽기 가능 (기능 상태 확인용)
CREATE POLICY "Anyone can read system_settings"
  ON system_settings FOR SELECT
  USING (true);

-- 관리자만 수정 가능
CREATE POLICY "Admin can update system_settings"
  ON system_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can insert system_settings"
  ON system_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
