---
name: verify-api-routes
description: API Route의 에러 처리, 입력 검증, 데모 데이터 폴백, 한국어 에러 메시지, HTTP 상태 코드 패턴을 검증합니다. API 엔드포인트 추가/수정 후 사용.
---

# API Routes 검증

## Purpose

1. **에러 처리 패턴** — 모든 API route에 try-catch 블록과 적절한 HTTP 상태 코드가 있는지 검증
2. **입력 검증** — 필수 파라미터에 대한 빈 값/누락 검사가 있는지 검증
3. **데모 데이터 폴백** — API 키 미설정 시 데모 데이터를 반환하는 패턴이 일관되는지 검증
4. **한국어 에러 메시지** — 사용자에게 반환되는 에러 메시지가 한국어인지 검증
5. **AI 응답 파싱** — Gemini API 응답에서 JSON 추출 시 마크다운 코드블록 제거 로직이 있는지 검증

## When to Run

- 새로운 API route를 추가한 후
- 기존 API route의 에러 처리나 검증 로직을 수정한 후
- AI(Gemini) 호출 관련 코드를 변경한 후
- 네이버 API 또는 외부 API 연동 코드를 수정한 후

## Related Files

| File | Purpose |
|------|---------|
| `src/app/api/ai/keywords/route.ts` | AI 키워드 추천 엔드포인트 |
| `src/app/api/ai/seo-check/route.ts` | SEO 점수 분석 엔드포인트 |
| `src/app/api/ai/content/route.ts` | AI 콘텐츠 생성 엔드포인트 |
| `src/app/api/ai/content/improve/route.ts` | AI 약점 개선 엔드포인트 (Patch 방식) |
| `src/app/api/naver/keywords/route.ts` | 네이버 키워드 검색량 조회 엔드포인트 |
| `src/app/api/tracking/route.ts` | 순위 트래킹 엔드포인트 |
| `src/app/api/tracking/check/route.ts` | 순위 체크 엔드포인트 |
| `src/app/api/tracking/delete/route.ts` | 트래킹 삭제 엔드포인트 |
| `src/app/api/dashboard/route.ts` | 대시보드 데이터 엔드포인트 |
| `src/app/api/billing/route.ts` | 결제 정보 엔드포인트 (admin client로 프로필 조회) |
| `src/app/api/billing/checkout/route.ts` | LemonSqueezy 체크아웃 URL 생성 엔드포인트 |
| `src/app/api/billing/portal/route.ts` | LemonSqueezy 고객 포털 URL 조회 엔드포인트 |
| `src/app/api/webhooks/lemonsqueezy/route.ts` | LemonSqueezy Webhook 이벤트 처리 (HMAC-SHA256 서명 검증) |
| `src/lib/lemonsqueezy/index.ts` | LemonSqueezy 설정 유틸 (configureLemonSqueezy, PLAN_VARIANT_MAP) |
| `src/app/api/content/list/route.ts` | 콘텐츠 목록 엔드포인트 |
| `src/app/api/content/update/route.ts` | 콘텐츠 업데이트 엔드포인트 |
| `src/app/api/content/save/route.ts` | 콘텐츠 편집 저장 엔드포인트 |
| `src/app/api/report/route.ts` | SEO 리포트 엔드포인트 |
| `src/app/api/ai/competitors/route.ts` | 경쟁사 분석 엔드포인트 |
| `src/app/api/ai/opportunities/route.ts` | 키워드 기회 발견 엔드포인트 |
| `src/app/api/blog-index/route.ts` | 블로그 지수 측정 엔드포인트 |
| `src/app/api/blog-index/ai/route.ts` | 블로그 지수 AI 심층 분석 엔드포인트 (온디맨드) |
| `src/app/api/credits/route.ts` | 크레딧 사용 내역 조회 엔드포인트 |
| `src/app/api/naver/blog-fetch/route.ts` | 블로그 URL에서 콘텐츠 가져오기 엔드포인트 |
| `src/lib/ai/gemini.ts` | Gemini AI 유틸리티 (callGemini, 시스템 프롬프트) |
| `src/lib/naver/search-ad.ts` | 네이버 검색광고 API 유틸리티 |
| `src/lib/naver/blog-fetch.ts` | 네이버 블로그 URL 파싱/콘텐츠 추출 유틸리티 |
| `src/lib/naver/post-meta-extractor.ts` | 블로그 포스트 메타데이터 추출 (태그, 서식, 링크 분석) |
| `src/app/api/search-history/route.ts` | 검색 히스토리 조회/저장 엔드포인트 |
| `src/app/api/templates/route.ts` | 콘텐츠 템플릿 관리 엔드포인트 (GET/POST/DELETE) |
| `src/lib/naver/visitor-stats.ts` | 네이버 방문자 통계 유틸리티 |
| `src/lib/ai/prompts/keyword.ts` | AI 키워드 분석 프롬프트 |
| `src/lib/ai/prompts/content.ts` | AI 콘텐츠 생성 프롬프트 |
| `src/lib/ai/prompts/seo.ts` | SEO 분석 프롬프트 |
| `src/lib/ai/prompts/blog-index.ts` | 블로그 지수 AI 분석 프롬프트 |
| `src/lib/ai/prompts/competitor.ts` | 경쟁사 분석 프롬프트 |
| `src/lib/ai/prompts/index.ts` | AI 프롬프트 barrel export |
| `src/app/api/admin/system/route.ts` | 관리자 시스템 설정 엔드포인트 |
| `src/app/api/admin/users/route.ts` | 관리자 사용자 목록 엔드포인트 |
| `src/app/api/admin/users/[id]/route.ts` | 관리자 사용자 상세/수정 엔드포인트 |
| `src/lib/admin-check.ts` | 관리자 인증 검증 유틸리티 (verifyAdmin) |
| `src/app/api/profile/blog/route.ts` | 블로그 등록/조회/삭제 엔드포인트 |
| `src/app/api/profile/blog/verify/route.ts` | 블로그 소유권 인증 엔드포인트 |
| `src/app/api/blog-learning/stats/route.ts` | 블로그 학습 통계 엔드포인트 |
| `src/app/api/blog-index/history/route.ts` | 블로그 지수 히스토리 조회 엔드포인트 |
| `src/app/api/naver/search-rank/route.ts` | 네이버 검색 순위 분석 엔드포인트 (cheerio 스크래핑) |
| `src/app/api/naver/keywords-bulk/route.ts` | 키워드 대량조회 엔드포인트 |
| `src/app/api/naver/autocomplete/route.ts` | 네이버 자동완성 조회 엔드포인트 |
| `src/lib/naver/blog-search.ts` | 네이버 블로그 검색 API 유틸리티 |
| `src/lib/naver/blog-crawler.ts` | 네이버 블로그 본문 크롤링 유틸리티 |
| `src/lib/naver/blog-profile-scraper.ts` | 네이버 블로그 프로필 스크래핑 유틸리티 |
| `src/lib/keyword-discovery/engine.ts` | 키워드 발굴 엔진 (Phase 1~3, onProgress 콜백) |

## Workflow

### Step 1: try-catch 에러 처리 검증

**파일:** `src/app/api/**/route.ts`

**검사:** 모든 API route의 export 함수(GET, POST, PUT, DELETE 등)가 try-catch 블록으로 감싸져 있는지 확인합니다.

```bash
# API route에서 export async function을 찾기
Grep pattern="export async function (GET|POST|PUT|DELETE|PATCH)" path="src/app/api" glob="route.ts"

# try-catch가 없는 route 찾기 (export 함수 내부에 try가 없는 경우)
Grep pattern="export async function" path="src/app/api" glob="route.ts" output_mode="files_with_matches"
```

각 파일을 읽고 export 함수 내부에 `try {` 블록이 있는지 확인합니다.

**PASS:** 모든 export 함수가 try-catch로 감싸져 있음
**FAIL:** try-catch 없이 에러가 전파될 수 있는 export 함수 존재
**수정:** 해당 함수에 try-catch 블록 추가, catch에서 500 에러 반환

### Step 2: HTTP 상태 코드 검증

**파일:** `src/app/api/**/route.ts`

**검사:** 에러 응답에 적절한 HTTP 상태 코드를 사용하는지 확인합니다.
- 입력 검증 실패: 400
- 인증 실패: 401
- 서버 에러: 500

```bash
# 400 상태 코드 사용 확인
Grep pattern="status: 400" path="src/app/api" glob="route.ts" output_mode="content"

# 500 상태 코드 사용 확인
Grep pattern="status: 500" path="src/app/api" glob="route.ts" output_mode="content"
```

**PASS:** 입력 검증 실패 시 400, 서버 에러 시 500을 반환
**FAIL:** 에러 상황에서 상태 코드 없이 `NextResponse.json({ error: ... })`만 반환하거나 잘못된 상태 코드 사용
**수정:** 적절한 HTTP 상태 코드 추가

### Step 3: 한국어 에러 메시지 검증

**파일:** `src/app/api/**/route.ts`

**검사:** 사용자에게 반환되는 에러 메시지가 한국어인지 확인합니다.

```bash
# error 필드의 값이 한국어인지 확인
Grep pattern="error: ['\"]" path="src/app/api" glob="route.ts" output_mode="content"
```

각 `{ error: "..." }` 응답을 확인하여 메시지가 한국어로 작성되어 있는지 검토합니다.

**PASS:** 모든 사용자 대면 에러 메시지가 한국어
**FAIL:** 영어 에러 메시지가 사용자에게 직접 반환됨
**수정:** 에러 메시지를 한국어로 변경

### Step 4: 입력 검증 패턴 확인

**파일:** `src/app/api/**/route.ts` (사용자 입력을 받는 route만 해당)

**검사:** POST/GET 요청에서 필수 파라미터에 대한 빈 값 검사가 있는지 확인합니다.

```bash
# request.json() 또는 searchParams.get() 사용 후 검증 확인
Grep pattern="(request\.json|searchParams\.get)" path="src/app/api" glob="route.ts" output_mode="content"
```

각 파일에서 입력값을 받은 후 `if (!keyword || keyword.trim().length === 0)` 같은 검증이 있는지 확인합니다.

**PASS:** 모든 필수 파라미터에 대해 빈 값/누락 검사 있음
**FAIL:** 입력 검증 없이 바로 비즈니스 로직 실행
**수정:** 입력 검증 로직 추가 후 400 상태 코드와 한국어 에러 메시지 반환

### Step 5: 데모 데이터 폴백 패턴 확인

**파일:** 외부 API를 호출하는 API route (`ai/keywords`, `ai/seo-check`, `ai/content`, `naver/keywords`)

**검사:** API 키 미설정 시 데모 데이터를 반환하는 패턴이 있는지 확인합니다.

```bash
# GEMINI_API_KEY 체크
Grep pattern="process\.env\.(GEMINI_API_KEY|NAVER_AD)" path="src/app/api" glob="route.ts" output_mode="content"

# isDemo 플래그 사용 확인
Grep pattern="isDemo" path="src/app/api" glob="route.ts" output_mode="content"
```

**PASS:** 외부 API 호출 route에 데모 데이터 폴백이 있고, `isDemo: true` 플래그를 포함하여 반환
**FAIL:** API 키가 없으면 에러만 반환하여 개발/테스트 시 사용 불가
**수정:** 데모 데이터 생성 함수 추가 및 `isDemo: true` 플래그 포함

### Step 6: AI 응답 JSON 파싱 검증

**파일:** `src/app/api/ai/**/route.ts`

**검사:** Gemini API 응답에서 JSON을 추출할 때 마크다운 코드블록을 제거하는 로직이 있는지 확인합니다.

```bash
# 코드블록 제거 패턴 확인
Grep pattern="replace.*```" path="src/app/api/ai" glob="route.ts" output_mode="content"
```

**PASS:** `response.replace(/```json?\n?/g, '').replace(/```/g, '').trim()` 패턴 사용
**FAIL:** AI 응답을 바로 `JSON.parse()`하여 마크다운 코드블록이 포함된 경우 파싱 실패 가능
**수정:** JSON 파싱 전 코드블록 제거 로직 추가

### Step 7: NDJSON 스트리밍 라우트 에러 처리 검증

**파일:** NDJSON 스트리밍을 사용하는 API route (`ai/content`, `ai/content/improve`, `ai/competitors`, `ai/opportunities`, `naver/keywords`, `blog-index`, `blog-index/ai`)

**검사:** NDJSON 스트리밍 라우트는 `ReadableStream` + `send()` 패턴을 사용합니다. 이 라우트들의 에러 처리가 일관되는지 확인합니다:
1. 스트림 내부에 `try-catch`가 있고, catch에서 `send({ type: 'error', error: '한국어 메시지' })`를 호출하는지
2. `finally` 블록에서 `controller.close()`를 호출하여 스트림이 정상 종료되는지
3. `Content-Type: application/x-ndjson` 헤더가 설정되어 있는지
4. 인증/크레딧 에러는 스트림 시작 전에 `NextResponse.json()`으로 즉시 반환하는지
5. `maxDuration`이 설정되어 Vercel 타임아웃을 방지하는지

```bash
# NDJSON 스트리밍 라우트 찾기
Grep pattern="application/x-ndjson" path="src/app/api" glob="route.ts" output_mode="files_with_matches"

# 스트리밍 라우트에서 send({ type: 'error' 패턴 확인
Grep pattern="send.*type.*error" path="src/app/api" glob="route.ts" output_mode="content"

# controller.close() 확인
Grep pattern="controller\.close" path="src/app/api" glob="route.ts" output_mode="content"

# maxDuration 설정 확인
Grep pattern="maxDuration" path="src/app/api" glob="route.ts" output_mode="content"
```

**PASS:** 모든 NDJSON 스트리밍 라우트에 send error + controller.close + maxDuration이 있음
**FAIL:** 스트림 내부에서 에러 발생 시 스트림이 닫히지 않거나, 에러 이벤트 전송 없이 조용히 실패
**수정:** catch에 `send({ type: 'error', error: '한국어 메시지' })` 추가, finally에 `controller.close()` 추가

### Step 8: 환경변수 검증

**파일:** `src/lib/ai/gemini.ts`, `src/lib/naver/search-ad.ts`

**검사:** 외부 API 호출 시 환경변수가 하드코딩되지 않고 `process.env`에서 읽어오는지 확인합니다.

```bash
# 하드코딩된 API 키 검색 (의심스러운 패턴)
Grep pattern="(api[_-]?key|secret|password)\s*[:=]\s*['\"][^'\"]{10,}" path="src/lib" glob="*.ts" output_mode="content" -i
```

**PASS:** 모든 API 키가 `process.env`를 통해 읽어옴
**FAIL:** API 키나 시크릿이 코드에 하드코딩됨
**수정:** 환경변수로 이동하고 `.env.local`에 추가

### Step 9: report 라우트 등급 상수와 SEO 엔진 일관성 검증

**파일:** `src/app/api/report/route.ts`, `src/lib/seo/engine.ts`

**검사:** report route에 로컬로 정의된 `GRADE_THRESHOLDS`의 16단계 등급/임계값이 SEO 엔진의 `SEO_GRADE_TABLE`과 동기화되어 있는지 확인합니다.

```bash
# report route의 로컬 GRADE_THRESHOLDS 16단계 확인
Grep pattern="minScore:.*grade:" path="src/app/api/report/route.ts" output_mode="content" -n

# SEO 엔진의 SEO_GRADE_TABLE 16단계 확인
Grep pattern="minScore:.*tier:" path="src/lib/seo/engine.ts" output_mode="content" -n head_limit=16
```

report route의 16개 항목(95/89/82/76/70/64/57/51/45/38/32/26/20/13/7/0)이 SEO 엔진의 임계값과 동일한지 대조합니다. 등급 라벨(Lv.16~Lv.1)도 일치해야 합니다.

**PASS:** 로컬 GRADE_THRESHOLDS의 16단계 임계값 + 등급 라벨이 SEO 엔진과 동일
**FAIL:** 임계값 또는 등급 라벨이 불일치
**수정:** 로컬 상수를 SEO 엔진의 값과 동기화하거나, `getGradeByScore()`를 import하여 사용

## Output Format

```markdown
## API Routes 검증 결과

| # | 검사 항목 | 상태 | 파일 | 상세 |
|---|-----------|------|------|------|
| 1 | try-catch 에러 처리 | PASS/FAIL | 파일명 | 상세 설명 |
| 2 | HTTP 상태 코드 | PASS/FAIL | 파일명 | 상세 설명 |
| 3 | 한국어 에러 메시지 | PASS/FAIL | 파일명 | 상세 설명 |
| 4 | 입력 검증 | PASS/FAIL | 파일명 | 상세 설명 |
| 5 | 데모 데이터 폴백 | PASS/FAIL | 파일명 | 상세 설명 |
| 6 | AI JSON 파싱 | PASS/FAIL | 파일명 | 상세 설명 |
| 7 | NDJSON 스트리밍 에러 처리 | PASS/FAIL | 파일명 | 상세 설명 |
| 8 | 환경변수 검증 | PASS/FAIL | 파일명 | 상세 설명 |
| 9 | report 등급 상수 일관성 | PASS/FAIL | report/route.ts, seo/engine.ts | 상세 설명 |
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **auth/callback route** — OAuth 콜백은 사용자 입력을 직접 받지 않으므로 입력 검증 불필요. 데모 데이터 폴백도 불필요
2. **내부 전용 route** — `dashboard`, `billing` 등 인증된 사용자만 접근하는 route는 데모 데이터 폴백이 선택사항
3. **waitlist route** — 대기 목록 API는 외부 API 의존성이 없으므로 데모 데이터 폴백 불필요
4. **console.error 로그** — catch 블록에서 `console.error`로 에러를 로깅하는 것은 정상 패턴이며, 로깅 메시지는 한국어가 아니어도 됨 (개발자용)
5. **admin API route** — `admin/system`, `admin/users` 등 관리자 전용 route는 `verifyAdmin()` 인증을 사용하며, 일반 사용자 입력 검증과 데모 데이터 폴백이 불필요. 관리자 인증 실패 시 `auth.error`를 그대로 반환하는 패턴이 정상
