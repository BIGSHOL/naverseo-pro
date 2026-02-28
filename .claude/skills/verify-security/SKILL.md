---
name: verify-security
description: 봇 차단, Rate Limiting, robots.txt, 보안 헤더가 3개 레이어(middleware/robots.txt/next.config)에서 일관되게 적용되는지 검증합니다. 보안 설정 수정 후 사용.
---

# 보안 설정 검증

## Purpose

1. **보호 경로 동기화** — middleware.ts, robots.txt, next.config.mjs에서 차단하는 경로 목록이 일치하는지 검증
2. **봇 패턴 일관성** — middleware의 BOT_PATTERNS와 robots.txt의 AI 크롤러 차단 목록이 동기화되는지 검증
3. **보안 헤더 적용** — next.config.mjs의 보안 헤더(X-Frame-Options, X-Content-Type-Options 등)가 올바르게 설정되는지 검증
4. **Rate Limiting 설정** — middleware의 API Rate Limiting이 올바르게 동작하는지 검증
5. **인증 미들웨어 통합** — Supabase 인증 미들웨어가 보안 레이어와 올바르게 통합되는지 검증

## When to Run

- `src/middleware.ts`의 봇 차단, Rate Limiting 로직을 수정한 후
- `public/robots.txt`의 크롤링 정책을 수정한 후
- `next.config.mjs`의 보안 헤더를 수정한 후
- 새로운 대시보드 페이지(보호 대상 경로)를 추가한 후
- 인증 미들웨어(`src/lib/supabase/middleware.ts`)를 수정한 후

## Related Files

| File | Purpose |
|------|---------|
| `src/middleware.ts` | 봇 차단 (BOT_PATTERNS), Rate Limiting (60 req/min), 검색엔진 허용 (ALLOWED_SEARCH_BOTS), Supabase 인증 통합 |
| `public/robots.txt` | 크롤링 정책 (허용/차단 경로, AI 크롤러 차단) |
| `next.config.mjs` | 보안 헤더 (X-Frame-Options, X-Content-Type-Options, X-Robots-Tag, Cache-Control, Permissions-Policy) |
| `src/lib/supabase/middleware.ts` | Supabase 인증 미들웨어 (보호 경로 리다이렉트) |

## Workflow

### Step 1: 보호 경로 동기화 확인

**파일:** `src/middleware.ts`, `public/robots.txt`, `next.config.mjs`, `src/lib/supabase/middleware.ts`

**검사:** 대시보드 보호 경로 목록이 4개 파일에서 동기화되는지 확인합니다.

```bash
# middleware.ts의 봇 차단 대상 경로
Grep pattern="protectedFromBots" path="src/middleware.ts" output_mode="content" -A 10

# robots.txt의 Disallow 경로 (대시보드)
Grep pattern="Disallow:" path="public/robots.txt" output_mode="content"

# next.config.mjs의 X-Robots-Tag 적용 경로
Grep pattern="source.*dashboard|keywords|content|seo-check|tracking|report|settings" path="next.config.mjs" output_mode="content"

# supabase middleware의 보호 경로
Grep pattern="protectedPaths" path="src/lib/supabase/middleware.ts" output_mode="content" -A 5
```

4개 파일의 경로 목록을 대조합니다:

- `middleware.ts`의 `protectedFromBots` 배열
- `robots.txt`의 `Disallow` 목록 (대시보드 영역)
- `next.config.mjs`의 X-Robots-Tag 적용 source 패턴
- `supabase/middleware.ts`의 `protectedPaths` 배열

**PASS:** 모든 파일에서 동일한 보호 경로를 참조
**FAIL:** 파일마다 다른 경로 목록 (예: middleware에는 `/blog-index`가 있지만 supabase middleware에는 없음)
**수정:** 누락된 경로를 해당 파일에 추가

### Step 2: AI 크롤러 차단 동기화 확인

**파일:** `src/middleware.ts`, `public/robots.txt`

**검사:** middleware의 BOT_PATTERNS 중 AI 크롤러와 robots.txt의 AI 크롤러 차단이 동기화되는지 확인합니다.

```bash
# middleware.ts의 AI 크롤러 패턴
Grep pattern="GPTBot|ChatGPT|CCBot|ClaudeBot|anthropic|Bytespider|Google-Extended" path="src/middleware.ts" output_mode="content"

# robots.txt의 AI 크롤러 차단
Grep pattern="User-agent:.*(GPTBot|ChatGPT|CCBot|ClaudeBot|anthropic|Bytespider|Google-Extended)" path="public/robots.txt" output_mode="content"
```

**PASS:** middleware와 robots.txt 모두 동일한 AI 크롤러를 차단
**FAIL:** 한 곳에는 있지만 다른 곳에는 없는 AI 크롤러 (예: middleware에 새 봇 추가했지만 robots.txt 미반영)
**수정:** 누락된 크롤러를 해당 파일에 추가

### Step 3: 보안 헤더 확인

**파일:** `next.config.mjs`

**검사:** 필수 보안 헤더가 올바르게 설정되어 있는지 확인합니다.

```bash
# 필수 보안 헤더 존재 확인
Grep pattern="X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy" path="next.config.mjs" output_mode="content"

# API 보호 헤더 확인
Grep pattern="Cache-Control|X-Robots-Tag" path="next.config.mjs" output_mode="content"
```

필수 헤더 체크리스트:
- `X-Frame-Options: DENY` — 클릭재킹 방지
- `X-Content-Type-Options: nosniff` — MIME 스니핑 방지
- `Referrer-Policy: strict-origin-when-cross-origin` — Referrer 최소화
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — 권한 차단
- API: `Cache-Control: no-store` — 캐시 금지
- API/대시보드: `X-Robots-Tag: noindex, nofollow` — 인덱싱 차단

**PASS:** 모든 필수 보안 헤더가 올바른 값으로 설정됨
**FAIL:** 필수 헤더 누락 또는 잘못된 값 (예: X-Frame-Options이 DENY 대신 SAMEORIGIN)
**수정:** 누락된 헤더 추가 또는 값 수정

### Step 4: Rate Limiting 설정 확인

**파일:** `src/middleware.ts`

**검사:** API Rate Limiting이 올바르게 구현되어 있는지 확인합니다.

```bash
# Rate Limit 설정값 확인
Grep pattern="API_RATE_LIMIT|API_RATE_WINDOW|rateLimitMap|isRateLimited" path="src/middleware.ts" output_mode="content"

# 429 응답 확인
Grep pattern="429|요청이 너무 많습니다" path="src/middleware.ts" output_mode="content"
```

확인 사항:
- `API_RATE_LIMIT`과 `API_RATE_WINDOW` 상수가 정의되어 있는지
- `isRateLimited` 함수가 API 경로에서 호출되는지
- 429 상태 코드와 한국어 에러 메시지를 반환하는지

**PASS:** Rate Limiting 상수, 함수, 응답이 모두 올바르게 구현됨
**FAIL:** Rate Limiting 구현 누락 또는 불완전 (예: 429 상태 코드 없음)
**수정:** 누락된 Rate Limiting 코드 추가

### Step 5: 검색엔진 허용 목록 확인

**파일:** `src/middleware.ts`, `public/robots.txt`

**검사:** 허용된 검색엔진 봇이 middleware에서 올바르게 처리되고, robots.txt에서 공개 페이지 접근이 허용되는지 확인합니다.

```bash
# 허용된 검색엔진 봇 목록
Grep pattern="ALLOWED_SEARCH_BOTS" path="src/middleware.ts" output_mode="content" -A 5

# robots.txt의 공개 페이지 허용
Grep pattern="Allow:" path="public/robots.txt" output_mode="content"

# middleware의 공개 페이지 허용 경로
Grep pattern="publicPages" path="src/middleware.ts" output_mode="content" -A 3
```

대조 사항:
- middleware의 `publicPages` 배열과 robots.txt의 `Allow` 경로가 일치하는지
- `ALLOWED_SEARCH_BOTS`에 주요 검색엔진(Googlebot, Yeti/NaverBot, Bingbot)이 포함되는지

**PASS:** 허용 경로와 검색엔진 봇 목록이 동기화됨
**FAIL:** middleware와 robots.txt의 허용 경로가 불일치
**수정:** 허용 경로 통일

### Step 6: 인증 미들웨어 통합 확인

**파일:** `src/middleware.ts`, `src/lib/supabase/middleware.ts`

**검사:** Supabase 인증 미들웨어가 보안 레이어 이후에 올바르게 호출되는지 확인합니다.

```bash
# middleware.ts에서 supabase middleware import 및 호출 확인
Grep pattern="updateSession|supabase/middleware" path="src/middleware.ts" output_mode="content"

# matcher 설정 확인
Grep pattern="matcher" path="src/middleware.ts" output_mode="content" -A 5
```

확인 사항:
- 보안 검사(봇 차단, Rate Limiting) 후에 `updateSession`이 호출되는지
- `config.matcher`가 정적 파일을 제외하고 있는지
- 환경변수 미설정 시 graceful fallback이 있는지

**PASS:** 보안 레이어 → 인증 미들웨어 순서가 올바르고, matcher 설정이 적절
**FAIL:** 인증 미들웨어가 보안 검사 전에 호출되거나 matcher가 부적절
**수정:** 미들웨어 호출 순서 수정

## Output Format

```markdown
## 보안 설정 검증 결과

| # | 검사 항목 | 상태 | 파일 | 상세 |
|---|-----------|------|------|------|
| 1 | 보호 경로 동기화 | PASS/FAIL | middleware, robots.txt, next.config, supabase | 상세 설명 |
| 2 | AI 크롤러 차단 동기화 | PASS/FAIL | middleware, robots.txt | 상세 설명 |
| 3 | 보안 헤더 적용 | PASS/FAIL | next.config.mjs | 상세 설명 |
| 4 | Rate Limiting 설정 | PASS/FAIL | middleware.ts | 상세 설명 |
| 5 | 검색엔진 허용 목록 | PASS/FAIL | middleware, robots.txt | 상세 설명 |
| 6 | 인증 미들웨어 통합 | PASS/FAIL | middleware.ts | 상세 설명 |
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **supabase/middleware.ts의 보호 경로가 middleware.ts보다 적음** — `supabase/middleware.ts`의 `protectedPaths`는 인증 리다이렉트용이며, `middleware.ts`의 `protectedFromBots`는 봇 차단용으로 별도 목적. 새 대시보드 경로 추가 시 양쪽 모두 업데이트가 권장되지만, supabase 측에서 누락되더라도 인증은 클라이언트 컴포넌트에서도 처리됨
2. **Rate Limiting의 인메모리 저장** — 프로덕션 환경에서 서버리스 함수 간 상태 미공유는 알려진 제한사항이며, 현재 아키텍처에서는 정상
3. **ALLOWED_SEARCH_BOTS과 BOT_PATTERNS의 중복** — Googlebot은 BOT_PATTERNS의 `/bot/i`에 매칭되지만, ALLOWED_SEARCH_BOTS에서 명시적으로 허용하므로 정상 동작
4. **robots.txt의 AI 크롤러가 middleware의 BOT_PATTERNS보다 적음** — robots.txt는 주요 AI 크롤러만 명시적으로 차단하고, middleware는 포괄적 패턴(`/bot/i` 등)으로 추가 차단하므로 정상
