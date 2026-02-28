---
name: verify-blog-learning
description: 블로그 학습 파이프라인의 수집 경로 연동, 프롬프트 주입, barrel export, admin client 사용 일관성을 검증합니다. 학습 파이프라인 수정 후 사용.
---

# Blog Learning Pipeline 검증

## Purpose

1. **수집 경로 일관성** — 6개 API 라우트에서 `scheduleCollection` + `collectFromSearchResults`를 올바르게 import하고 호출하는지 검증
2. **프롬프트 주입 연동** — content 라우트에서 `getPatternPromptSection`을 Promise.allSettled에 포함하고, 결과를 userMessage에 주입하는지 검증
3. **Barrel export 완전성** — `index.ts`에서 모든 공개 함수와 타입이 re-export되는지 검증
4. **Admin client 사용** — 시스템 공유 데이터(user_id 없음) 저장 시 `createAdminClient`를 사용하는지 검증
5. **Fire-and-forget 패턴** — `scheduleCollection`이 메인 응답을 블로킹하지 않는 패턴인지 검증

## When to Run

- `src/lib/blog-learning/` 모듈의 코드를 수정한 후
- 블로그 학습 수집 경로를 추가/제거한 후
- 프롬프트 주입 로직을 변경한 후
- 새 API 라우트에서 네이버 블로그 검색 결과를 가져오는 코드를 추가한 후
- `src/app/api/ai/content/route.ts`의 enrichment 파이프라인을 수정한 후

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/blog-learning/types.ts` | 타입 정의 (AnalyzedPostPattern, AggregatedPattern, CollectionSource 등) |
| `src/lib/blog-learning/extractor.ts` | 패턴 추출기 (extractPatternFromScrapedData, extractPatternFromSearchItem) |
| `src/lib/blog-learning/collector.ts` | 수집기 (scheduleCollection, collectFromSearchResults, collectFromScrapedPosts) |
| `src/lib/blog-learning/aggregator.ts` | 집계기 (updateAggregatePatterns) |
| `src/lib/blog-learning/prompt-injector.ts` | 프롬프트 주입 (getPatternPromptSection) |
| `src/lib/blog-learning/index.ts` | Barrel export |
| `src/app/api/ai/content/route.ts` | 콘텐츠 생성 (수집 + 프롬프트 주입) |
| `src/app/api/ai/competitors/route.ts` | 경쟁사 분석 (수집) |
| `src/app/api/naver/keywords/route.ts` | 키워드 리서치 (수집) |
| `src/app/api/blog-index/route.ts` | 블로그 지수 (수집) |
| `src/app/api/tracking/route.ts` | 순위 트래킹 등록 (수집) |
| `src/app/api/tracking/check/route.ts` | 순위 재확인 (수집) |
| `src/app/api/blog-learning/stats/route.ts` | 학습 통계 API |
| `src/app/(dashboard)/learning/page.tsx` | 학습 데이터 대시보드 |
| `supabase/migrations/014_blog_learning.sql` | DB 마이그레이션 |

## Workflow

### Step 1: 수집 경로 연동 검증 (6개 라우트)

**파일:** 6개 API 라우트

**검사:** 각 라우트에서 `scheduleCollection`과 `collectFromSearchResults`를 import하고 호출하는지 확인합니다.

```bash
# 6개 수집 경로에서 blog-learning import 확인
Grep pattern="from '@/lib/blog-learning'" path="src/app/api/ai/content" glob="route.ts" output_mode="content"
Grep pattern="from '@/lib/blog-learning'" path="src/app/api/ai/competitors" glob="route.ts" output_mode="content"
Grep pattern="from '@/lib/blog-learning'" path="src/app/api/naver/keywords" glob="route.ts" output_mode="content"
Grep pattern="from '@/lib/blog-learning'" path="src/app/api/blog-index" glob="route.ts" output_mode="content"
Grep pattern="from '@/lib/blog-learning'" path="src/app/api/tracking" glob="route.ts" output_mode="content"
Grep pattern="from '@/lib/blog-learning'" path="src/app/api/tracking/check" glob="route.ts" output_mode="content"

# scheduleCollection 호출 확인
Grep pattern="scheduleCollection" path="src/app/api" glob="route.ts" output_mode="files_with_matches"
```

**PASS:** 6개 라우트 모두 `scheduleCollection`을 import하고 호출
**FAIL:** 누락된 수집 경로 존재
**수정:** 누락된 라우트에 `import { scheduleCollection, collectFromSearchResults } from '@/lib/blog-learning'` 추가 후 적절한 위치에 `scheduleCollection(() => collectFromSearchResults(...))` 호출 추가

### Step 2: CollectionSource 매칭 검증

**파일:** 6개 API 라우트 + `src/lib/blog-learning/types.ts`

**검사:** 각 라우트에서 사용하는 `CollectionSource` 값이 types.ts에 정의된 값과 일치하는지 확인합니다.

```bash
# types.ts에서 정의된 CollectionSource 값
Grep pattern="CollectionSource" path="src/lib/blog-learning/types.ts" output_mode="content" -A 5

# 각 라우트에서 사용하는 source 문자열
Grep pattern="collectFromSearchResults.*'" path="src/app/api" glob="route.ts" output_mode="content"
```

유효한 값: `'keyword_research'`, `'content_generation'`, `'competitor_analysis'`, `'blog_index'`, `'rank_tracking'`

**PASS:** 모든 라우트가 유효한 CollectionSource 값을 사용
**FAIL:** types.ts에 정의되지 않은 source 값 사용
**수정:** 올바른 CollectionSource 값으로 변경하거나, 새 값을 types.ts에 추가

### Step 3: 프롬프트 주입 연동 검증

**파일:** `src/app/api/ai/content/route.ts`

**검사:** content 라우트에서 `getPatternPromptSection`을 Promise.allSettled에 포함하고, 결과를 userMessage에 주입하는지 확인합니다.

```bash
# getPatternPromptSection import 확인
Grep pattern="getPatternPromptSection" path="src/app/api/ai/content" glob="route.ts" output_mode="content"

# Promise.allSettled에 포함 확인
Grep pattern="Promise.allSettled.*getPatternPromptSection|learningResult" path="src/app/api/ai/content" glob="route.ts" output_mode="content"

# userMessage에 주입 확인
Grep pattern="learningRef.*text|learningRef.*sampleCount" path="src/app/api/ai/content" glob="route.ts" output_mode="content"
```

**PASS:** `getPatternPromptSection`이 Promise.allSettled에 포함되고, 결과가 userMessage에 조건부 주입됨
**FAIL:** 주입 누락 또는 블로킹 호출 사용
**수정:** Promise.allSettled 배열에 `getPatternPromptSection(keyword, contentType)` 추가, 결과를 `learningRef`로 추출 후 `if (learningRef?.sampleCount >= 3) userMessage += learningRef.text`

### Step 4: Barrel export 완전성 검증

**파일:** `src/lib/blog-learning/index.ts`

**검사:** 모든 공개 함수와 타입이 index.ts에서 re-export되는지 확인합니다.

```bash
# index.ts 내용 확인
Read file="src/lib/blog-learning/index.ts"

# 각 모듈의 export 확인
Grep pattern="^export " path="src/lib/blog-learning/collector.ts" output_mode="content"
Grep pattern="^export " path="src/lib/blog-learning/extractor.ts" output_mode="content"
Grep pattern="^export " path="src/lib/blog-learning/prompt-injector.ts" output_mode="content"
Grep pattern="^export " path="src/lib/blog-learning/aggregator.ts" output_mode="content"
Grep pattern="^export " path="src/lib/blog-learning/types.ts" output_mode="content"
```

필수 export: `scheduleCollection`, `collectFromSearchResults`, `collectFromScrapedPosts`, `getPatternPromptSection`, `CollectionSource` 타입

**PASS:** 모든 공개 함수/타입이 index.ts에서 re-export됨
**FAIL:** 공개 함수가 index.ts에 누락되어 import 시 직접 파일 경로를 지정해야 함
**수정:** 누락된 export를 index.ts에 추가

### Step 5: Admin client 사용 검증

**파일:** `src/lib/blog-learning/collector.ts`

**검사:** DB 저장 시 일반 `createClient()` 대신 `createAdminClient()`를 사용하는지 확인합니다. (analyzed_posts는 user_id가 없는 시스템 공유 데이터이므로 RLS bypass 필요)

```bash
# collector.ts에서 createAdminClient 사용 확인
Grep pattern="createAdminClient|service_role|SUPABASE_SERVICE_ROLE" path="src/lib/blog-learning/collector.ts" output_mode="content"

# 일반 createClient 사용 여부 확인 (위반)
Grep pattern="createClient\(\)" path="src/lib/blog-learning/collector.ts" output_mode="content"
```

**PASS:** `createAdminClient()`를 사용하여 RLS bypass로 시스템 데이터 저장
**FAIL:** 일반 `createClient()`를 사용하여 RLS 정책으로 인해 저장 실패 가능
**수정:** `createClient()` → `createAdminClient()` 변경

### Step 6: Fire-and-forget 패턴 검증

**파일:** `src/lib/blog-learning/collector.ts`, 6개 API 라우트

**검사:** `scheduleCollection`이 Promise를 await하지 않고 fire-and-forget으로 실행되는지 확인합니다.

```bash
# scheduleCollection 함수 정의 확인 (void 반환, catch 포함)
Grep pattern="function scheduleCollection" path="src/lib/blog-learning/collector.ts" output_mode="content" -A 3

# 라우트에서 await scheduleCollection 사용 여부 확인 (위반)
Grep pattern="await scheduleCollection" path="src/app/api" glob="route.ts" output_mode="content"
```

**PASS:** `scheduleCollection`이 void를 반환하고, 내부에서 `.catch()`로 에러를 처리하며, 호출부에서 await하지 않음
**FAIL:** `scheduleCollection`을 await하여 메인 응답이 블로킹됨
**수정:** `await scheduleCollection(...)` → `scheduleCollection(...)` (await 제거)

### Step 7: DB 스키마 일관성 검증

**파일:** `supabase/migrations/014_blog_learning.sql`, `src/lib/blog-learning/types.ts`

**검사:** 마이그레이션의 테이블 컬럼과 TypeScript 타입 정의가 일치하는지 확인합니다.

```bash
# DB 테이블 컬럼 확인
Grep pattern="(char_count|image_count|heading_count|quality_score|writing_tone|collected_from)" path="supabase/migrations/014_blog_learning.sql" output_mode="content"

# TypeScript 타입 필드 확인
Grep pattern="(char_count|image_count|heading_count|quality_score|writing_tone|collected_from)" path="src/lib/blog-learning/types.ts" output_mode="content"
```

**PASS:** DB 컬럼과 TypeScript 인터페이스의 필드명/타입이 일치
**FAIL:** DB에는 있지만 타입에 없는 필드, 또는 그 반대
**수정:** DB 스키마와 TypeScript 타입을 동기화

### Step 8: 학습 통계 API 검증

**파일:** `src/app/api/blog-learning/stats/route.ts`

**검사:** stats API가 인증을 확인하고, 적절한 통계를 반환하는지 확인합니다.

```bash
# 인증 체크 존재 확인
Grep pattern="auth.getUser|supabase.auth" path="src/app/api/blog-learning/stats" glob="route.ts" output_mode="content"

# 반환 데이터 필드 확인
Grep pattern="totalPosts|uniqueKeywords|categoryDistribution|patternCount" path="src/app/api/blog-learning/stats" glob="route.ts" output_mode="content"
```

**PASS:** 인증 체크 후 totalPosts, uniqueKeywords, categoryDistribution, patternCount 등 반환
**FAIL:** 인증 없이 데이터 반환하거나 필수 통계 필드 누락
**수정:** 인증 체크 추가 또는 누락 필드 추가

## Output Format

```markdown
## Blog Learning Pipeline 검증 결과

| # | 검사 항목 | 상태 | 파일 | 상세 |
|---|-----------|------|------|------|
| 1 | 수집 경로 연동 (6개) | PASS/FAIL | 6개 라우트 | 상세 설명 |
| 2 | CollectionSource 매칭 | PASS/FAIL | types.ts + 라우트 | 상세 설명 |
| 3 | 프롬프트 주입 연동 | PASS/FAIL | content/route.ts | 상세 설명 |
| 4 | Barrel export 완전성 | PASS/FAIL | index.ts | 상세 설명 |
| 5 | Admin client 사용 | PASS/FAIL | collector.ts | 상세 설명 |
| 6 | Fire-and-forget 패턴 | PASS/FAIL | collector.ts + 라우트 | 상세 설명 |
| 7 | DB 스키마 일관성 | PASS/FAIL | migration + types.ts | 상세 설명 |
| 8 | 학습 통계 API | PASS/FAIL | stats/route.ts | 상세 설명 |
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **content 라우트의 이중 역할** — content 라우트는 수집(scheduleCollection)과 주입(getPatternPromptSection) 두 가지를 모두 수행하므로, 다른 라우트보다 blog-learning import가 많은 것이 정상
2. **collectFromScrapedPosts 미사용 라우트** — `collectFromScrapedPosts`는 스크래핑된 HTML이 있는 경우에만 사용하므로, 대부분의 라우트가 `collectFromSearchResults`만 사용하는 것이 정상
3. **데모 모드에서 수집 건너뛰기** — `process.env.NAVER_CLIENT_ID`가 없는 데모 모드에서는 수집을 수행하지 않는 것이 정상 (네이버 API 미설정)
4. **aggregator.ts의 직접 import 없음** — `updateAggregatePatterns`는 collector에서 내부적으로 호출되므로, API 라우트에서 직접 import하지 않는 것이 정상
5. **stats API에 크레딧 체크 없음** — 학습 통계 조회는 읽기 전용이고 크레딧 소모가 없으므로 `checkCredits`가 없는 것이 정상