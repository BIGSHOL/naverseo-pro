-- 알림 읽음/삭제 상태 저장 (기기 간 동기화)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"read":[],"dismissed":[]}';
