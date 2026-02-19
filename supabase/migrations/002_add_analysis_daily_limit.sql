-- 일간 분석 사용량 제한 (블로그 지수 / 상위노출 분석 / 키워드 발굴)
-- 월간이 아닌 일간 제한으로 다계정 악용 방지

ALTER TABLE profiles
  ADD COLUMN analysis_used_today INT DEFAULT 0,
  ADD COLUMN analysis_reset_date DATE DEFAULT CURRENT_DATE;
