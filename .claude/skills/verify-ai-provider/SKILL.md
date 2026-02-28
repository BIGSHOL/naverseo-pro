---
name: verify-ai-provider
description: AI 제공자(Gemini/Claude) 라우팅, Free 플랜 Gemini 강제, 키워드 라우트 Gemini 고정 패턴을 검증합니다. AI 호출 코드 수정 후 사용.
---

# AI Provider 검증

## Purpose

1. **제공자 라우팅 일관성** — Claude 사용 가능한 라우트는 `callAI(provider, ...)`, Gemini 고정 라우트는 `callGemini(...)` 직접 호출 검증
2. **Free 플랜 Gemini 강제** — `getUserAiProvider()`에서 Free 플랜은 항상 'gemini' 반환하는지 검증
3. **API 키 검사 패턴** — Claude 지원 라우트에서 `hasAiApiKey(provider)` 사용, Gemini 고정 라우트에서 `process.env.GEMINI_API_KEY` 직접 검사 검증
4. **callAI/callClaude 함수** — `callAI`가 provider에 따라 올바르게 분기하는지, `callClaude`가 올바른 모델을 사용하는지 검증
5. **타입 안전성** — `AiProvider` 타입이 'gemini' | 'claude'로 정의되고, DB 스키마의 CHECK 제약조건과 일치하는지 검증

## When to Run

- AI 호출 관련 코드를 수정한 후
- 새로운 AI 라우트를 추가한 후
- `getUserAiProvider()` 또는 `callAI()` 함수를 수정한 후
- AI 제공자 관련 DB 마이그레이션 후
- 관리자 UI에서 AI 제공자 설정 관련 코드 수정 후

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/ai/gemini.ts` | callGemini, callClaude, callAI, getUserAiProvider, hasAiApiKey 정의 |
| `src/app/api/ai/content/route.ts` | 콘텐츠 생성 (Claude 지원 — callAI 사용) |
| `src/app/api/ai/seo-check/route.ts` | SEO 분석 (Claude 지원 — getUserAiProvider + hasAiApiKey 사용) |
| `src/app/api/ai/competitors/route.ts` | 경쟁사 분석 (Claude 지원 — callAI 사용) |
| `src/app/api/blog-index/route.ts` | 블로그 지수 분석 (Claude 지원 — getUserAiProvider 사용) |
| `src/app/api/blog-index/ai/route.ts` | 블로그 지수 AI 심층 분석 (Claude 지원 — getUserAiProvider 사용) |
| `src/lib/seo/ai-analyzer.ts` | SEO AI 심층 분석 (Claude 지원 — callAI 사용) |
| `src/lib/blog-index/ai-analyzer.ts` | 블로그 지수 AI 분석 (Claude 지원 — callAI 사용) |
| `src/app/api/ai/keywords/route.ts` | AI 키워드 추천 (Gemini 고정 — callGemini 직접 사용) |
| `src/app/api/ai/opportunities/route.ts` | 키워드 발굴 (Gemini 고정 — callGemini 직접 사용) |
| `src/app/api/admin/users/[id]/route.ts` | 관리자 사용자 수정 (ai_provider PATCH 허용) |
| `src/app/(dashboard)/admin/users/[id]/page.tsx` | 관리자 사용자 상세 (AI 제공자 Select UI) |
| `supabase/migrations/006_add_ai_provider.sql` | ai_provider 컬럼 마이그레이션 |

## Workflow

### Step 1: Claude 지원 라우트 검증

**파일:** Claude를 사용할 수 있는 6개 파일

**검사:** 다음 라우트에서 `callAI` 또는 `getUserAiProvider`를 import하고 사용하는지 확인합니다.

```bash
# Claude 지원 라우트에서 callAI/getUserAiProvider 사용 확인
Grep pattern="callAI|getUserAiProvider" path="src/app/api/ai/content" glob="route.ts" output_mode="content"
Grep pattern="callAI|getUserAiProvider" path="src/app/api/ai/seo-check" glob="route.ts" output_mode="content"
Grep pattern="callAI|getUserAiProvider" path="src/app/api/ai/competitors" glob="route.ts" output_mode="content"
Grep pattern="callAI|getUserAiProvider" path="src/app/api/blog-index" glob="route.ts" output_mode="content"
Grep pattern="callAI|getUserAiProvider" path="src/app/api/blog-index/ai" glob="route.ts" output_mode="content"
Grep pattern="callAI|getUserAiProvider" path="src/lib/seo" glob="ai-analyzer.ts" output_mode="content"
Grep pattern="callAI|getUserAiProvider" path="src/lib/blog-index" glob="ai-analyzer.ts" output_mode="content"
```

**PASS:** 7개 파일 모두 `getUserAiProvider` 또는 `callAI`를 사용
**FAIL:** Claude 지원 라우트에서 `callGemini`를 직접 호출하거나, `getUserAiProvider` 없이 하드코딩된 provider 사용
**수정:** `callGemini(...)` → `callAI(provider, ...)`, provider 조회 로직 추가

### Step 2: Gemini 고정 라우트 검증

**파일:** Gemini만 사용하는 2개 파일

**검사:** 키워드/발굴 라우트에서 `callGemini`을 직접 사용하고, `callAI`/`getUserAiProvider`를 사용하지 않는지 확인합니다.

```bash
# Gemini 고정 라우트에서 callGemini 직접 사용 확인
Grep pattern="callGemini" path="src/app/api/ai/keywords" glob="route.ts" output_mode="content"
Grep pattern="callGemini" path="src/app/api/ai/opportunities" glob="route.ts" output_mode="content"

# 이 라우트에서 callAI/getUserAiProvider가 없어야 함
Grep pattern="callAI|getUserAiProvider" path="src/app/api/ai/keywords" glob="route.ts" output_mode="content"
Grep pattern="callAI|getUserAiProvider" path="src/app/api/ai/opportunities" glob="route.ts" output_mode="content"
```

**PASS:** keywords, opportunities 라우트가 `callGemini` 직접 사용, `callAI`/`getUserAiProvider` 미사용
**FAIL:** Gemini 고정 라우트에서 `callAI`를 사용하거나, `getUserAiProvider`를 호출
**수정:** `callAI(provider, ...)` → `callGemini(...)`, 불필요한 import 제거

### Step 3: Free 플랜 Gemini 강제 검증

**파일:** `src/lib/ai/gemini.ts`

**검사:** `getUserAiProvider()` 함수에서 Free 플랜 사용자가 항상 'gemini'를 반환하는지 확인합니다.

```bash
# Free 플랜 체크 존재 확인
Grep pattern="plan.*free.*gemini|free.*plan.*gemini" path="src/lib/ai/gemini.ts" output_mode="content"

# profiles 테이블에서 plan 컬럼 조회 확인
Grep pattern="select.*ai_provider.*plan|select.*plan.*ai_provider" path="src/lib/ai/gemini.ts" output_mode="content"
```

파일을 읽어 `getUserAiProvider` 함수 내부에서 `if (data?.plan === 'free') return 'gemini'` 패턴이 있는지 확인합니다.

**PASS:** Free 플랜 체크가 `getUserAiProvider` 함수 내에 존재하고, provider DB 조회 전에 실행됨
**FAIL:** Free 플랜 체크가 없거나, provider 반환 후에 실행됨
**수정:** `getUserAiProvider` 함수에 `if (data?.plan === 'free') return 'gemini'` 추가

### Step 4: hasAiApiKey 패턴 검증

**파일:** Claude 지원 라우트

**검사:** Claude 지원 라우트에서 데모 데이터 폴백 시 `hasAiApiKey(provider)`를 사용하는지 확인합니다.

```bash
# hasAiApiKey 사용 확인
Grep pattern="hasAiApiKey" path="src/app/api/ai" glob="route.ts" output_mode="content"
Grep pattern="hasAiApiKey" path="src/lib/ai/gemini.ts" output_mode="content"
```

**PASS:** Claude 지원 라우트에서 `hasAiApiKey(provider)`로 API 키 존재 여부 확인
**FAIL:** `process.env.GEMINI_API_KEY` 직접 체크 (Claude 사용자의 경우 Gemini 키가 없어도 Claude 키가 있으면 동작해야 함)
**수정:** `!process.env.GEMINI_API_KEY` → `!hasAiApiKey(provider)`

### Step 5: callAI 라우터 함수 검증

**파일:** `src/lib/ai/gemini.ts`

**검사:** `callAI` 함수가 provider에 따라 올바르게 분기하는지 확인합니다.

```bash
# callAI 함수 내부 분기 확인
Grep pattern="callAI|callClaude|callGemini" path="src/lib/ai/gemini.ts" output_mode="content"
```

파일을 읽어 `callAI` 함수가 `provider === 'claude'` → `callClaude`, 기본값 → `callGemini`으로 분기하는지 확인합니다.

**PASS:** `callAI`가 provider에 따라 올바르게 분기하고, `callClaude`가 Anthropic SDK를 사용
**FAIL:** 분기 로직 오류 또는 `callClaude` 함수 누락
**수정:** `callAI` 함수 분기 로직 수정

### Step 6: DB 스키마 일관성 검증

**파일:** `supabase/migrations/006_add_ai_provider.sql`, `src/lib/ai/gemini.ts`

**검사:** DB의 CHECK 제약조건과 TypeScript `AiProvider` 타입이 일치하는지 확인합니다.

```bash
# 마이그레이션에서 허용 값 확인
Grep pattern="CHECK.*ai_provider" path="supabase/migrations" glob="*.sql" output_mode="content"

# TypeScript 타입 확인
Grep pattern="AiProvider" path="src/lib/ai/gemini.ts" output_mode="content"
```

**PASS:** DB CHECK 제약조건 `('gemini', 'claude')`와 TypeScript `'gemini' | 'claude'` 일치
**FAIL:** DB와 TypeScript 타입 불일치
**수정:** 일치하도록 수정

## Output Format

```markdown
## AI Provider 검증 결과

| # | 검사 항목 | 상태 | 파일 | 상세 |
|---|-----------|------|------|------|
| 1 | Claude 지원 라우트 | PASS/FAIL | 6개 파일 | 상세 설명 |
| 2 | Gemini 고정 라우트 | PASS/FAIL | keywords, opportunities | 상세 설명 |
| 3 | Free 플랜 강제 | PASS/FAIL | gemini.ts | 상세 설명 |
| 4 | hasAiApiKey 패턴 | PASS/FAIL | 관련 라우트 | 상세 설명 |
| 5 | callAI 라우터 | PASS/FAIL | gemini.ts | 상세 설명 |
| 6 | DB 스키마 일관성 | PASS/FAIL | migration + gemini.ts | 상세 설명 |
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **lib 엔진 파일의 provider 파라미터** — `src/lib/seo/ai-analyzer.ts`와 `src/lib/blog-index/ai-analyzer.ts`는 호출자로부터 provider를 전달받으므로 `getUserAiProvider`를 직접 호출하지 않는 것이 정상
2. **parseGeminiJson 공용 사용** — Claude 응답도 JSON 형식이므로 `parseGeminiJson` 함수명에 "Gemini"가 포함되어 있어도 Claude 응답 파싱에 사용하는 것은 정상
3. **Gemini 고정 라우트의 GEMINI_API_KEY 직접 체크** — keywords, opportunities 라우트는 항상 Gemini만 사용하므로 `process.env.GEMINI_API_KEY`를 직접 확인하는 것이 정상
4. **callClaude 모델 ID** — Claude 모델 ID가 업데이트될 수 있으므로 구체적인 모델 ID 검증보다 함수 존재 및 Anthropic SDK 사용 여부를 검증