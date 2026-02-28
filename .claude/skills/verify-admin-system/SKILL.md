---
name: verify-admin-system
description: 관리자 인증(verifyAdmin), 시스템 설정 API, 사용자 관리 API, 관리자 UI 페이지의 일관성을 검증합니다. 관리자 기능 수정 후 사용.
---

# 관리자 시스템 검증

## Purpose

1. **관리자 인증 일관성** — 모든 admin API route에서 `verifyAdmin()` 함수를 호출하는지 검증
2. **시스템 설정 API** — API 키 상태 표시가 실제 환경변수와 일치하는지, 값이 노출되지 않는지 검증
3. **사용자 관리 API** — 사용자 목록/상세/수정 API가 올바른 필드를 처리하는지 검증
4. **관리자 UI 페이지** — admin 페이지들이 올바른 API를 호출하고 한국어 UI를 유지하는지 검증
5. **접근 제어** — 관리자가 아닌 사용자가 admin API에 접근하면 적절한 에러를 반환하는지 검증

## When to Run

- 관리자 API route를 추가/수정한 후
- `verifyAdmin()` 함수를 수정한 후
- 관리자 UI 페이지를 추가/수정한 후
- 시스템 설정에 새 API 키 상태를 추가한 후
- 사용자 관리 기능에 새 필드를 추가한 후

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/admin-check.ts` | verifyAdmin() 관리자 인증 유틸리티 |
| `src/app/api/admin/system/route.ts` | 시스템 설정 API (API 키 상태, 플랜 제한, 환경 정보) |
| `src/app/api/admin/users/route.ts` | 사용자 목록 API |
| `src/app/api/admin/users/[id]/route.ts` | 사용자 상세/수정 API (GET/PATCH) |
| `src/app/(dashboard)/admin/page.tsx` | 관리자 메인 페이지 |
| `src/app/(dashboard)/admin/users/page.tsx` | 사용자 목록 페이지 |
| `src/app/(dashboard)/admin/users/[id]/page.tsx` | 사용자 상세/수정 페이지 (AI 제공자 Select 포함) |
| `src/app/(dashboard)/admin/system/page.tsx` | 시스템 설정 페이지 |
| `src/app/(dashboard)/admin/features/page.tsx` | 기능 관리 페이지 |

## Workflow

### Step 1: verifyAdmin 호출 검증

**파일:** `src/app/api/admin/**/route.ts`

**검사:** 모든 admin API route에서 `verifyAdmin()` 함수를 호출하고, 인증 실패 시 에러를 반환하는지 확인합니다.

```bash
# admin API route 파일 목록
Glob pattern="src/app/api/admin/**/route.ts"

# verifyAdmin import 확인
Grep pattern="verifyAdmin" path="src/app/api/admin" glob="route.ts" output_mode="content"

# auth.error 반환 패턴 확인
Grep pattern="auth\.error" path="src/app/api/admin" glob="route.ts" output_mode="content"
```

각 admin API route를 읽어 `const auth = await verifyAdmin()` + `if (auth.error) return auth.error` 패턴이 있는지 확인합니다.

**PASS:** 모든 admin API route에 verifyAdmin 호출 + 에러 반환 패턴 존재
**FAIL:** verifyAdmin 호출 없이 관리자 데이터에 접근하는 route 존재
**수정:** 해당 route 시작 부분에 `const auth = await verifyAdmin()` + `if (auth.error) return auth.error` 추가

### Step 2: 시스템 설정 API 검증

**파일:** `src/app/api/admin/system/route.ts`

**검사:** API 키 상태가 boolean(`configured: true/false`)으로만 반환되고, 실제 키 값이 노출되지 않는지 확인합니다.

```bash
# configured 필드 사용 확인
Grep pattern="configured:" path="src/app/api/admin/system/route.ts" output_mode="content"

# API 키 값 직접 노출 여부 확인 (process.env.* 값이 응답에 포함되면 위험)
Grep pattern="process\.env\.\w+[^?!]" path="src/app/api/admin/system/route.ts" output_mode="content"
```

파일을 읽어 !!process.env.XXX 패턴(boolean 변환)만 사용하고, 키 값 자체를 JSON 응답에 포함하지 않는지 확인합니다.

**PASS:** 모든 API 키가 !! 연산자로 boolean 변환되어 상태만 반환
**FAIL:** API 키 값이 응답에 포함되어 노출됨
**수정:** !!process.env.XXX 패턴으로 변경하여 boolean 상태만 반환

### Step 3: 사용자 관리 PATCH 필드 검증

**파일:** `src/app/api/admin/users/[id]/route.ts`

**검사:** PATCH 요청에서 허용되는 필드가 화이트리스트 방식으로 검증되는지 확인합니다.

```bash
# PATCH 핸들러에서 허용 필드 확인
Grep pattern="(plan|ai_provider|email)" path="src/app/api/admin/users/[id]/route.ts" output_mode="content"
```

파일을 읽어 PATCH에서 `plan`, `ai_provider`, `add_credits`, `reset_credits` 등 허용된 필드만 업데이트하고, 임의 필드를 받아서 DB에 저장하지 않는지 확인합니다.

**PASS:** 허용 필드가 화이트리스트 방식으로 검증되고, 필드 값 유효성 검사 존재
**FAIL:** 요청 body를 그대로 DB에 전달하여 임의 필드 수정 가능
**수정:** 허용 필드 화이트리스트 적용

### Step 4: 관리자 UI 페이지 존재 확인

**파일:** `src/app/(dashboard)/admin/**/page.tsx`

**검사:** 관리자 관련 UI 페이지가 모두 존재하고, API 엔드포인트와 연결되는지 확인합니다.

```bash
# admin 페이지 목록
Glob pattern="src/app/(dashboard)/admin/**/page.tsx"

# admin API 호출 확인
Grep pattern="fetch.*admin" path="src/app/(dashboard)/admin" glob="page.tsx" output_mode="content"
```

**PASS:** 관리자 메인, 사용자 목록, 사용자 상세, 시스템 설정 페이지가 모두 존재
**FAIL:** API는 있지만 대응하는 UI 페이지가 없거나, UI에서 잘못된 API 경로 호출
**수정:** 누락된 페이지 생성 또는 API 경로 수정

### Step 5: try-catch 에러 처리 검증

**파일:** `src/app/api/admin/**/route.ts`

**검사:** 모든 admin API route의 export 함수에 try-catch 블록이 있는지 확인합니다.

```bash
# export 함수 확인
Grep pattern="export async function" path="src/app/api/admin" glob="route.ts" output_mode="content"
```

각 파일을 읽어 `try { ... } catch` 블록으로 감싸져 있고, catch에서 500 에러를 반환하는지 확인합니다.

**PASS:** 모든 export 함수에 try-catch + 500 에러 반환 존재
**FAIL:** try-catch 없이 에러가 전파될 수 있는 함수 존재
**수정:** try-catch 블록 추가, catch에서 한국어 에러 메시지 + 500 반환

## Output Format

```markdown
## 관리자 시스템 검증 결과

| # | 검사 항목 | 상태 | 파일 | 상세 |
|---|-----------|------|------|------|
| 1 | verifyAdmin 호출 | PASS/FAIL | admin API routes | 상세 설명 |
| 2 | 시스템 설정 API | PASS/FAIL | admin/system/route.ts | 상세 설명 |
| 3 | 사용자 PATCH 필드 | PASS/FAIL | admin/users/[id]/route.ts | 상세 설명 |
| 4 | 관리자 UI 페이지 | PASS/FAIL | admin 페이지들 | 상세 설명 |
| 5 | try-catch 처리 | PASS/FAIL | admin API routes | 상세 설명 |
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **verifyAdmin 내부 로직** — `verifyAdmin()` 함수 자체는 Supabase 서비스 키를 사용하여 사용자 역할을 확인하는 것이 정상. 이 함수의 내부 구현은 이 스킬의 검증 대상이 아님
2. **관리자 메인 페이지의 API 미호출** — `admin/page.tsx`가 하위 페이지로의 네비게이션만 제공하고 별도 API를 호출하지 않는 것은 정상
3. **시스템 설정의 환경 정보** — `NODE_ENV`, `VERCEL_ENV` 등 비밀이 아닌 환경 정보를 노출하는 것은 정상
4. **AI 제공자 Select의 Free 플랜 비활성화** — Free 플랜 사용자의 AI 제공자 Select를 disabled 처리하는 것은 정상 (Free는 항상 Gemini)