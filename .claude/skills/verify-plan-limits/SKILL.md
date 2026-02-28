---
name: verify-plan-limits
description: 통합 크레딧 시스템(CREDIT_COSTS/PLAN_CREDITS/FREE_ALLOWED_FEATURES)과 API Route의 checkCredits/deductCredits 일관 적용을 검증합니다. API 엔드포인트 추가/수정 후 사용.
---

# 크레딧 시스템 검증

## Purpose

1. **크레딧 상수 동기화** — `CREDIT_COSTS`, `PLAN_CREDITS`, `FREE_ALLOWED_FEATURES`, `CREDIT_FEATURE_LABELS`가 일관되게 정의되어 있는지 검증
2. **크레딧 체크 적용** — 외부 API 호출/AI 생성 route에 `checkCredits()` 호출이 있는지 검증
3. **크레딧 차감 로직** — 성공 시 `deductCredits()`가 호출되는지 검증
4. **Free 플랜 기능 게이트** — Free 플랜에서 `FREE_ALLOWED_FEATURES`에 없는 기능이 차단되는지 검증
5. **HTTP 상태 코드** — 크레딧 부족 시 403, 기능 게이트 시 403(planGate:true)을 반환하는지 검증
6. **크레딧 API/UI** — `/api/credits` 엔드포인트와 크레딧 관리 페이지가 올바르게 동작하는지 검증

## When to Run

- 새로운 API route를 추가한 후
- 기존 API route의 크레딧 로직을 수정한 후
- `src/lib/credit-check.ts`를 수정한 후
- `src/types/database.ts`의 CREDIT_COSTS/PLAN_CREDITS 상수를 수정한 후
- 가격 정책 변경 후

## Related Files

| File | Purpose |
|------|---------|
| `src/types/database.ts` | CREDIT_COSTS, PLAN_CREDITS, FREE_ALLOWED_FEATURES, CREDIT_FEATURE_LABELS 상수 정의 |
| `src/lib/credit-check.ts` | checkCredits(), deductCredits() 함수 정의 |
| `src/app/api/naver/keywords/route.ts` | 키워드 검색량 조회 (keyword_research, 1크레딧) |
| `src/app/api/ai/content/route.ts` | AI 콘텐츠 생성 (content_generation, 5크레딧) |
| `src/app/api/ai/seo-check/route.ts` | SEO 점수 분석 (seo_check, 2크레딧) |
| `src/app/api/ai/competitors/route.ts` | 경쟁사 분석 (competitor_analysis, 3크레딧) |
| `src/app/api/ai/opportunities/route.ts` | 키워드 발굴 (keyword_discovery, 3크레딧) |
| `src/app/api/ai/keywords/route.ts` | AI 키워드 추천 (keyword_discovery, 3크레딧) |
| `src/app/api/blog-index/route.ts` | 블로그 지수 분석 (blog_index, 3크레딧) |
| `src/app/api/tracking/route.ts` | 순위 트래킹 등록/목록 (tracking_per_keyword, 1크레딧) |
| `src/app/api/tracking/check/route.ts` | 순위 체크 (tracking_per_keyword, 1크레딧) |
| `src/app/api/credits/route.ts` | 크레딧 사용 내역 API (잔액, 기능별 집계, 로그) |
| `src/app/(dashboard)/credits/page.tsx` | 크레딧 관리 페이지 (차트, 기능별 비율, 내역) |
| `src/components/layout/sidebar.tsx` | 사이드바 크레딧 잔액 표시 |

## Workflow

### Step 1: 크레딧 상수 정의 확인

**파일:** `src/types/database.ts`

**검사:** `CREDIT_COSTS`, `PLAN_CREDITS`, `FREE_ALLOWED_FEATURES`, `CREDIT_FEATURE_LABELS`가 모두 export되어 있는지 확인합니다.

```bash
Grep pattern="export const (CREDIT_COSTS|PLAN_CREDITS|FREE_ALLOWED_FEATURES|CREDIT_FEATURE_LABELS)" path="src/types/database.ts" output_mode="content"
```

**PASS:** 4개 상수 모두 export됨
**FAIL:** 상수 누락
**수정:** 누락된 상수 추가

### Step 2: CREDIT_COSTS 기능명 일관성 확인

**파일:** `src/types/database.ts`, `src/lib/credit-check.ts`

**검사:** CREDIT_COSTS에 정의된 기능명과 API route에서 사용하는 기능명이 일치하는지 확인합니다.

```bash
# CREDIT_COSTS의 기능명 확인
Grep pattern="keyword_research|keyword_discovery|content_generation|seo_check|competitor_analysis|blog_index|tracking_per_keyword|seo_report|content_improve" path="src/types/database.ts" output_mode="content"

# API route에서 checkCredits에 전달하는 기능명 확인
Grep pattern="checkCredits\(.*'" path="src/app/api" glob="route.ts" output_mode="content"
```

**PASS:** 모든 기능명이 CREDIT_COSTS에 정의된 키와 일치
**FAIL:** API route에서 CREDIT_COSTS에 없는 기능명을 사용
**수정:** 기능명을 CREDIT_COSTS 키와 일치시키거나, 새 기능을 CREDIT_COSTS에 추가

### Step 3: checkCredits/deductCredits 함수 존재 확인

**파일:** `src/lib/credit-check.ts`

**검사:** `checkCredits`와 `deductCredits` 함수가 export되어 있는지 확인합니다.

```bash
Grep pattern="export (async )?function (checkCredits|deductCredits)" path="src/lib/credit-check.ts" output_mode="content"
```

**PASS:** 2개 함수 모두 존재하고 export됨
**FAIL:** 함수 누락
**수정:** 누락된 함수 구현

### Step 4: API route 크레딧 체크 적용 확인

**파일:** 크레딧을 소비하는 모든 API route

**검사:** 각 API route에 `checkCredits`가 호출되고, 성공 후 `deductCredits`가 호출되는지 확인합니다.

```bash
# checkCredits import 확인
Grep pattern="import.*checkCredits.*from.*credit-check" path="src/app/api" glob="route.ts" output_mode="content"

# deductCredits 호출 확인
Grep pattern="deductCredits" path="src/app/api" glob="route.ts" output_mode="content"
```

각 파일을 읽어 `checkCredits` → 비즈니스 로직 → `deductCredits` 순서가 올바른지 확인합니다.

**PASS:** 9개 기능 route 모두에 checkCredits + deductCredits 존재
**FAIL:** 크레딧 체크 또는 차감 누락
**수정:** 누락된 로직 추가

### Step 5: Free 플랜 기능 게이트 확인

**파일:** `src/lib/credit-check.ts`, `src/types/database.ts`

**검사:** `checkCredits` 함수에서 Free 플랜 사용자가 `FREE_ALLOWED_FEATURES`에 없는 기능 호출 시 `planGate: true`를 반환하는지 확인합니다.

```bash
# FREE_ALLOWED_FEATURES / LITE_ALLOWED_FEATURES 정의 확인
Grep pattern="FREE_ALLOWED_FEATURES|LITE_ALLOWED_FEATURES" path="src/types/database.ts" output_mode="content" -A 5

# checkCredits에서 planGate 로직 확인
Grep pattern="planGate|FREE_ALLOWED_FEATURES|LITE_ALLOWED_FEATURES" path="src/lib/credit-check.ts" output_mode="content"
```

**PASS:** Free/Lite 플랜 차단 + planGate:true 반환 로직 존재. FREE_ALLOWED_FEATURES = keyword_research, seo_check, blog_index, post_check. LITE_ALLOWED_FEATURES = Free + content_generation, seo_report
**FAIL:** Free/Lite 플랜 차단 로직 없거나, 허용 목록이 부정확
**수정:** checkCredits에 Free/Lite 플랜 게이트 로직 추가

### Step 6: PLAN_CREDITS 월간 쿼터 확인

**파일:** `src/types/database.ts`

**검사:** PLAN_CREDITS에 5개 플랜(free, lite, starter, pro, enterprise)이 정의되어 있고 적절한 크레딧 할당이 있는지 확인합니다.

```bash
Grep pattern="(free|lite|starter|pro|enterprise):" path="src/types/database.ts" output_mode="content" -A 1
```

예상 값: free=30, lite=100, starter=250, pro=600, enterprise=2000

**PASS:** 5개 플랜 모두 정의 + 적절한 크레딧 할당
**FAIL:** 플랜 누락 또는 크레딧 값 불일치
**수정:** PLAN_CREDITS 수정

### Step 7: 크레딧 API/UI 존재 확인

**파일:** `src/app/api/credits/route.ts`, `src/app/(dashboard)/credits/page.tsx`

**검사:** 크레딧 사용 내역 API와 관리 페이지가 존재하는지 확인합니다.

```bash
Glob pattern="src/app/api/credits/route.ts"
Glob pattern="src/app/(dashboard)/credits/page.tsx"
```

**PASS:** API와 페이지 모두 존재
**FAIL:** API 또는 페이지 누락
**수정:** 누락된 파일 생성

### Step 8: 사이드바 크레딧 표시 동기화

**파일:** `src/components/layout/sidebar.tsx`

**검사:** 사이드바에 크레딧 잔액이 표시되고, 크레딧 관리 페이지로 이동할 수 있는지 확인합니다.

```bash
Grep pattern="credit|크레딧" path="src/components/layout/sidebar.tsx" output_mode="content" -i
```

**PASS:** 사이드바에 크레딧 잔액 표시 + 클릭 시 /credits 이동
**FAIL:** 크레딧 표시 없음 또는 기존 plan-check 기반 사용량 표시
**수정:** 사이드바에 크레딧 잔액 표시 추가

### Step 9: 구 시스템(plan-check) 잔여 참조 확인

**파일:** 프로젝트 전체

**검사:** 삭제된 `plan-check.ts`의 함수를 참조하는 코드가 남아있지 않은지 확인합니다.

```bash
Grep pattern="from.*plan-check|checkKeywordLimit|checkContentLimit|checkAnalysisLimit|checkTrackingAccess|checkTrackingCount|incrementAnalysisUsage" path="src" glob="*.ts" output_mode="content"
Grep pattern="from.*plan-check|checkKeywordLimit|checkContentLimit|checkAnalysisLimit|checkTrackingAccess|checkTrackingCount|incrementAnalysisUsage" path="src" glob="*.tsx" output_mode="content"
```

**PASS:** 구 시스템 참조 없음
**FAIL:** 삭제된 plan-check 함수를 참조하는 코드 존재
**수정:** credit-check 함수로 마이그레이션

## Output Format

```markdown
## 크레딧 시스템 검증 결과

| # | 검사 항목 | 상태 | 파일 | 상세 |
|---|-----------|------|------|------|
| 1 | 크레딧 상수 정의 | PASS/FAIL | types/database.ts | 상세 설명 |
| 2 | 기능명 일관성 | PASS/FAIL | database.ts + API routes | 상세 설명 |
| 3 | 함수 존재 | PASS/FAIL | lib/credit-check.ts | 상세 설명 |
| 4 | API 크레딧 적용 | PASS/FAIL | 9개 API routes | 상세 설명 |
| 5 | Free 기능 게이트 | PASS/FAIL | credit-check.ts + database.ts | 상세 설명 |
| 6 | 월간 쿼터 | PASS/FAIL | types/database.ts | 상세 설명 |
| 7 | 크레딧 API/UI | PASS/FAIL | credits/ | 상세 설명 |
| 8 | 사이드바 동기화 | PASS/FAIL | sidebar.tsx | 상세 설명 |
| 9 | 구 시스템 잔여 | PASS/FAIL | 전체 | 상세 설명 |
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **읽기 전용 API route** — `dashboard`, `billing`, `content/list`, `credits` 등 데이터 조회만 하는 route는 크레딧 소비 불필요
2. **삭제 API route** — `tracking/delete` 등 데이터를 삭제하는 route는 크레딧 소비 불필요
3. **Admin 무제한** — Admin 역할은 checkCredits에서 자동 bypass되므로 크레딧 체크 불필요
4. **blog-index/ai API** — `/api/blog-index/ai`는 별도 온디맨드 AI 분석으로, 자체 플랜 체크(Free 제외)를 수행하며 크레딧과 별개로 동작
5. **auth/callback route** — OAuth 콜백은 사용자 액션이 아니므로 크레딧 소비 불필요
6. **deductCredits RPC 폴백** — RPC 함수가 배포되지 않은 환경에서 수동 차감 폴백을 사용하는 것은 정상
