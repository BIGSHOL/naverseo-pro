-- 013: 템플릿 개수 제한을 플랜별 차등으로 변경
-- 기존: 하드코딩 5개 제한 (DB 트리거)
-- 변경: 앱 레벨에서 플랜별 제한 적용, DB 트리거는 안전망(200개)으로 완화

-- 기존 트리거 함수 교체 (안전망 역할)
CREATE OR REPLACE FUNCTION check_template_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- 안전망: 앱 레벨에서 플랜별 제한을 관리하므로 DB는 최대 200개로 완화
  IF (SELECT COUNT(*) FROM content_templates WHERE user_id = NEW.user_id) >= 200 THEN
    RAISE EXCEPTION '템플릿 저장 한도를 초과했습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 플랜별 실제 제한:
-- Free: 1개, Lite: 3개, Starter: 10개, Pro: 30개, Business: 50개, Agency/Admin: 무제한
-- 앱 레벨(src/app/api/templates/route.ts)에서 PLAN_TEMPLATE_LIMITS로 관리
