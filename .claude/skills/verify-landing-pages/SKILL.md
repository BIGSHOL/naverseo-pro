---
name: verify-landing-pages
description: 랜딩 페이지 컴포넌트의 한국어 마케팅 텍스트, 가격 정보 일관성, shadcn/ui 사용, lucide-react 아이콘 통일을 검증합니다. 랜딩 페이지 수정 후 사용.
---

# Landing Pages 검증

## Purpose

1. **한국어 마케팅 텍스트** — 랜딩 페이지의 모든 사용자 대면 텍스트(헤드라인, 설명, CTA)가 한국어인지 검증
2. **가격 정보 일관성** — pricing-section의 가격이 `PLANS` 상수(`src/types/database.ts`)와 일치하는지 검증
3. **shadcn/ui 컴포넌트 사용** — Card, Button, Badge 등 shadcn/ui 컴포넌트를 일관되게 사용하는지 검증
4. **아이콘 라이브러리 통일** — lucide-react만 사용하고 다른 아이콘 라이브러리를 혼용하지 않는지 검증
5. **페이지 구성 동기화** — `src/app/page.tsx`에서 import하는 섹션 컴포넌트가 실제 존재하는지 검증

## When to Run

- 랜딩 페이지 섹션 컴포넌트를 추가/수정한 후
- 가격 정책이나 플랜 정보를 변경한 후
- 랜딩 페이지의 마케팅 문구를 수정한 후
- 새로운 섹션을 랜딩 페이지에 추가한 후

## Related Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | 랜딩 페이지 메인 (섹션 컴포넌트 조합) |
| `src/components/landing/navbar.tsx` | 네비게이션 바 |
| `src/components/landing/hero-section.tsx` | 히어로 섹션 (메인 헤드라인, CTA) |
| `src/components/landing/problem-section.tsx` | 문제 제기 섹션 |
| `src/components/landing/features-section.tsx` | 기능 소개 섹션 |
| `src/components/landing/comparison-section.tsx` | 비교 섹션 |
| `src/components/landing/pricing-section.tsx` | 가격 정책 섹션 |
| `src/components/faq/faq-section.tsx` | FAQ 섹션 (가격/기능 안내) |
| `src/components/landing/cta-section.tsx` | CTA(Call to Action) 섹션 |
| `src/components/landing/footer.tsx` | 푸터 |
| `src/types/database.ts` | PLANS 상수 (가격 정보 원본) |

## Workflow

### Step 1: 한국어 마케팅 텍스트 검증

**파일:** `src/components/landing/*.tsx`

**검사:** 헤드라인(`<h1>`, `<h2>`, `<h3>`), 설명문(`<p>`), 버튼 텍스트가 한국어인지 확인합니다.

```bash
# h1, h2, h3 태그 내용 확인
Grep pattern="<h[1-3][^>]*>" path="src/components/landing" glob="*.tsx" output_mode="content" -A 1

# Button 텍스트 확인
Grep pattern="<Button[^>]*>[^<]*<" path="src/components/landing" glob="*.tsx" output_mode="content"
```

각 헤드라인과 버튼 텍스트가 한국어로 작성되어 있는지 검토합니다.

**PASS:** 모든 사용자 대면 텍스트가 한국어
**FAIL:** 영어 마케팅 문구가 사용자에게 직접 표시됨
**수정:** 해당 텍스트를 한국어로 변경

### Step 2: 가격 정보 일관성 검증

**파일:** `src/components/landing/pricing-section.tsx`, `src/components/faq/faq-section.tsx`, `src/types/database.ts`

**검사:** pricing-section에 표시되는 가격이 `PLANS` 상수에서 가져오는지, FAQ의 가격 표기가 USD 단위($)로 통일되어 있는지 확인합니다.

```bash
# PLANS import 확인
Grep pattern="import.*PLANS.*from.*database" path="src/components/landing/pricing-section.tsx" output_mode="content"

# 하드코딩된 USD 가격 검색
Grep pattern="\$[0-9,]+" path="src/components/landing" glob="*.tsx" output_mode="content" -n
Grep pattern="\$[0-9,]+" path="src/components/faq" glob="*.tsx" output_mode="content" -n

# 구 KRW 가격 잔여 확인 (₩ 또는 원)
Grep pattern="₩[0-9,]+|[0-9,]+원" path="src/components/landing" glob="*.tsx" output_mode="content" -n
Grep pattern="₩[0-9,]+|[0-9,]+원" path="src/components/faq" glob="*.tsx" output_mode="content" -n
```

pricing-section은 `PLANS` 상수에서 가격 데이터를 가져와야 합니다. FAQ 등 마케팅 문구의 가격은 USD 단위($5, $10, $20 등)로 표기되어야 합니다. hero-section이나 cta-section의 가격 언급도 USD로 통일되어야 합니다.

**PASS:** pricing-section이 `PLANS` import를 사용하고, 모든 가격이 USD($) 단위로 통일
**FAIL:** KRW(₩) 가격이 잔여하거나, USD 가격이 PLANS 상수와 불일치
**수정:** `PLANS` import를 사용하여 가격 표시, 잔여 KRW 표기를 USD로 변환

### Step 3: shadcn/ui 컴포넌트 사용 검증

**파일:** `src/components/landing/*.tsx`

**검사:** Card, Button, Badge 등에 shadcn/ui 컴포넌트를 사용하고 있는지 확인합니다.

```bash
# shadcn/ui 컴포넌트 import 확인
Grep pattern="from '@/components/ui/" path="src/components/landing" glob="*.tsx" output_mode="content"
```

**PASS:** shadcn/ui 컴포넌트를 일관되게 사용
**FAIL:** shadcn/ui 대신 네이티브 HTML 버튼/카드를 자체 스타일로 구현
**수정:** 해당 요소를 shadcn/ui 컴포넌트로 교체

### Step 4: 아이콘 라이브러리 통일 검증

**파일:** `src/components/landing/*.tsx`

**검사:** lucide-react만 아이콘 라이브러리로 사용하는지 확인합니다.

```bash
# lucide-react 사용 확인
Grep pattern="from 'lucide-react'" path="src/components/landing" glob="*.tsx" output_mode="files_with_matches"

# 다른 아이콘 라이브러리 혼용 확인
Grep pattern="from '(react-icons|@heroicons|@mui/icons)" path="src/components/landing" glob="*.tsx" output_mode="files_with_matches"
```

**PASS:** lucide-react만 아이콘 라이브러리로 사용
**FAIL:** lucide-react 외 다른 아이콘 라이브러리 혼용
**수정:** 모든 아이콘을 lucide-react로 통일

### Step 5: 페이지 구성 동기화 검증

**파일:** `src/app/page.tsx`, `src/components/landing/*.tsx`

**검사:** `src/app/page.tsx`에서 import하는 모든 섹션 컴포넌트 파일이 실제 존재하는지 확인합니다.

```bash
# page.tsx에서 import하는 랜딩 컴포넌트 확인
Grep pattern="from '@/components/landing/" path="src/app/page.tsx" output_mode="content"

# 실제 랜딩 컴포넌트 파일 목록
Glob pattern="src/components/landing/*.tsx"
```

page.tsx의 각 import에 대응하는 파일이 존재하는지 확인합니다.

**PASS:** 모든 import에 대응하는 파일이 존재
**FAIL:** import는 있지만 파일이 없거나, 파일은 있지만 page.tsx에서 사용하지 않는 섹션 존재
**수정:** import 또는 파일 추가/제거하여 동기화

## Output Format

```markdown
## Landing Pages 검증 결과

| # | 검사 항목 | 상태 | 파일 | 상세 |
|---|-----------|------|------|------|
| 1 | 한국어 마케팅 텍스트 | PASS/FAIL | 파일명 | 상세 설명 |
| 2 | 가격 정보 일관성 | PASS/FAIL | 파일명 | 상세 설명 |
| 3 | shadcn/ui 사용 | PASS/FAIL | 파일명 | 상세 설명 |
| 4 | 아이콘 통일 | PASS/FAIL | 파일명 | 상세 설명 |
| 5 | 페이지 구성 동기화 | PASS/FAIL | 파일명 | 상세 설명 |
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **기술 약어** — "SEO", "AI", "C-Rank", "D.I.A.", "CTA", "FAQ", "TOP" 등 기술/마케팅 용어는 영어 그대로 사용 가능
2. **마케팅 문구의 가격 언급** — hero-section, cta-section 등에서 마케팅 목적으로 가격을 직접 언급하는 것은 허용 (pricing-section만 `PLANS` 상수 의존 필수)
3. **footer의 영어 텍스트** — 저작권 표시(`Copyright`, `All rights reserved`) 등은 영어 관례를 따름
4. **서버 컴포넌트** — 랜딩 페이지 컴포넌트는 서버 컴포넌트이므로 `'use client'` 선언 불필요 (인터랙티브 요소가 없는 한)
