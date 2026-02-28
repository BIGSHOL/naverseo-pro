---
name: verify-dashboard-pages
description: 대시보드 및 인증 페이지의 클라이언트 선언, 한국어 UI, shadcn/ui 컴포넌트 사용, 로딩/에러 상태 처리 패턴을 검증합니다. 대시보드/인증 페이지 추가/수정 후 사용.
---

# Dashboard Pages 검증

## Purpose

1. **클라이언트 컴포넌트 선언** — 인터랙티브 대시보드 페이지에 `'use client'` 선언이 있는지 검증
2. **한국어 UI** — 메뉴, 버튼, 라벨, 에러 메시지 등 사용자 대면 텍스트가 한국어인지 검증
3. **shadcn/ui 컴포넌트 사용** — Card, Button, Badge 등 디자인 시스템 컴포넌트를 일관되게 사용하는지 검증
4. **로딩/에러 상태 처리** — API 호출 시 로딩 상태와 에러 상태를 적절히 처리하는지 검증
5. **아이콘 사용** — lucide-react 아이콘 라이브러리를 일관되게 사용하는지 검증

## When to Run

- 새로운 대시보드 또는 인증 페이지를 추가한 후
- 기존 대시보드/인증 페이지의 UI를 수정한 후
- 새로운 컴포넌트를 대시보드에 추가한 후
- 사이드바 네비게이션 메뉴를 변경한 후
- 로딩/에러 UX를 수정한 후

## Related Files

| File | Purpose |
|------|---------|
| `src/app/(dashboard)/dashboard/page.tsx` | 메인 대시보드 페이지 |
| `src/app/(dashboard)/keywords/page.tsx` | 키워드 리서치 페이지 |
| `src/app/(dashboard)/content/page.tsx` | AI 콘텐츠 생성 페이지 |
| `src/app/(dashboard)/content/calendar/page.tsx` | 콘텐츠 캘린더 페이지 |
| `src/app/(dashboard)/seo-check/page.tsx` | SEO 점수 체크 페이지 |
| `src/app/(dashboard)/tracking/page.tsx` | 순위 트래킹 페이지 |
| `src/app/(dashboard)/settings/page.tsx` | 계정 설정/결제 페이지 |
| `src/app/(dashboard)/report/page.tsx` | SEO 리포트 페이지 |
| `src/app/(dashboard)/blog-index/page.tsx` | 블로그 지수 측정 페이지 |
| `src/app/(dashboard)/credits/page.tsx` | 크레딧 관리 페이지 (잔액, 차트, 사용 내역) |
| `src/app/(dashboard)/competitors/page.tsx` | 경쟁사 분석 페이지 |
| `src/app/(dashboard)/opportunities/page.tsx` | 키워드 기회 발견 페이지 |
| `src/app/(dashboard)/billing/page.tsx` | 요금제 변경/결제 페이지 (LemonSqueezy 오버레이 체크아웃) |
| `src/app/(dashboard)/post-check/page.tsx` | 포스트 체크 페이지 (개별 글 SEO 분석) |
| `src/app/(dashboard)/settings/payment/success/page.tsx` | 결제 성공 페이지 |
| `src/app/(dashboard)/settings/payment/fail/page.tsx` | 결제 실패 페이지 |
| `src/components/layout/sidebar.tsx` | 사이드바 네비게이션 컴포넌트 |
| `src/components/layout/mobile-sidebar.tsx` | 모바일 사이드바 네비게이션 컴포넌트 |
| `src/lib/navigation.ts` | 네비게이션 설정 (navGroups, navItems, NavGroup, NavItem, canAccessFeature) |
| `src/components/seo/LiveSeoPanel.tsx` | 실시간 SEO 분석 공유 컴포넌트 |
| `src/components/content/TagEditor.tsx` | 태그 편집 컴포넌트 |
| `src/components/landing/footer.tsx` | 푸터 컴포넌트 |
| `src/app/(auth)/login/page.tsx` | 로그인 페이지 |
| `src/app/(auth)/signup/page.tsx` | 회원가입 페이지 |
| `src/app/(auth)/forgot-password/page.tsx` | 비밀번호 찾기 페이지 |
| `src/app/(auth)/reset-password/page.tsx` | 비밀번호 재설정 페이지 |
| `src/app/(dashboard)/admin/page.tsx` | 관리자 메인 페이지 |
| `src/app/(dashboard)/admin/users/page.tsx` | 관리자 사용자 목록 페이지 |
| `src/app/(dashboard)/admin/users/[id]/page.tsx` | 관리자 사용자 상세/수정 페이지 |
| `src/app/(dashboard)/admin/system/page.tsx` | 관리자 시스템 설정 페이지 |
| `src/app/(dashboard)/admin/features/page.tsx` | 관리자 기능 관리 페이지 |
| `src/app/(dashboard)/learning/page.tsx` | 블로그 학습 데이터 페이지 |
| `src/components/ui/inline-markdown.tsx` | 인라인 마크다운 렌더링 공유 컴포넌트 (AI 텍스트용) |
| `src/components/content/TiptapEditor.tsx` | TipTap 리치텍스트 에디터 래퍼 (마크다운 입출력) |
| `src/components/content/TiptapToolbar.tsx` | TipTap 서식 툴바 (13종 네이버 블로그 호환 서식) |
| `src/lib/utils/markdown-convert.ts` | 마크다운↔HTML 변환 유틸 (TipTap 경계 변환용) |

## Workflow

### Step 1: 'use client' 선언 검증

**파일:** `src/app/(dashboard)/**/page.tsx`

**검사:** 인터랙티브 요소(useState, useEffect, onClick 등)를 사용하는 페이지에 `'use client'` 선언이 있는지 확인합니다.

```bash
# 'use client'가 있는 대시보드/인증 페이지
Grep pattern="^'use client'" path="src/app/(dashboard)" glob="page.tsx" output_mode="files_with_matches"
Grep pattern="^'use client'" path="src/app/(auth)" glob="page.tsx" output_mode="files_with_matches"

# useState나 useEffect를 사용하는 페이지
Grep pattern="(useState|useEffect|onClick)" path="src/app/(dashboard)" glob="page.tsx" output_mode="files_with_matches"
Grep pattern="(useState|useEffect|onClick)" path="src/app/(auth)" glob="page.tsx" output_mode="files_with_matches"
```

두 결과를 비교하여 인터랙티브 훅을 사용하면서 `'use client'`가 없는 페이지를 찾습니다.

**PASS:** 인터랙티브 훅을 사용하는 모든 페이지에 `'use client'` 선언 있음
**FAIL:** `useState`/`useEffect`를 사용하면서 `'use client'`가 없는 페이지 존재
**수정:** 파일 최상단에 `'use client'` 추가

### Step 2: 한국어 UI 텍스트 검증

**파일:** `src/app/(dashboard)/**/page.tsx`, `src/components/layout/sidebar.tsx`

**검사:** 페이지 제목, 버튼 텍스트, 라벨, 설명문 등 사용자 대면 텍스트가 한국어인지 확인합니다.

```bash
# h1 태그 내용 확인 (페이지 제목)
Grep pattern="<h1[^>]*>" path="src/app/(dashboard)" glob="page.tsx" output_mode="content" -A 1

# Button 텍스트 확인
Grep pattern="<Button[^>]*>[^<]*<" path="src/app/(dashboard)" glob="page.tsx" output_mode="content"
```

각 페이지의 제목(`<h1>`), 버튼 텍스트, 설명문(`<p>` 내 text-muted-foreground)이 한국어인지 검토합니다.

**PASS:** 모든 사용자 대면 텍스트가 한국어
**FAIL:** 영어 텍스트가 사용자에게 직접 표시됨 (예: "Loading...", "Submit", "Error")
**수정:** 해당 텍스트를 한국어로 변경 (예: "로딩 중...", "제출", "오류")

### Step 3: shadcn/ui 컴포넌트 사용 검증

**파일:** `src/app/(dashboard)/**/page.tsx`

**검사:** 카드, 버튼, 배지 등에 shadcn/ui 컴포넌트를 사용하고 있는지 확인합니다.

```bash
# shadcn/ui Card 컴포넌트 import 확인
Grep pattern="from '@/components/ui/(card|button|badge)'" path="src/app/(dashboard)" glob="page.tsx" output_mode="content"

# 네이티브 HTML로 카드를 구현한 경우 (shadcn 대신)
Grep pattern="className=.*rounded.*border.*p-[0-9]" path="src/app/(dashboard)" glob="page.tsx" output_mode="content"
```

**PASS:** Card, Button, Badge 등 shadcn/ui 컴포넌트를 일관되게 사용
**FAIL:** shadcn/ui 컴포넌트 대신 네이티브 HTML과 인라인 스타일로 카드/버튼을 구현
**수정:** 해당 요소를 shadcn/ui 컴포넌트로 교체

### Step 4: 로딩 상태 처리 검증

**파일:** `src/app/(dashboard)/**/page.tsx`

**검사:** API를 호출하는 페이지에서 로딩 상태를 표시하고 있는지 확인합니다.

```bash
# fetch 호출이 있는 파일
Grep pattern="await fetch\(" path="src/app/(dashboard)" glob="page.tsx" output_mode="files_with_matches"

# loading 상태 관리
Grep pattern="(setLoading|useState.*loading|Loader2|animate-spin|RefreshCw)" path="src/app/(dashboard)" glob="page.tsx" output_mode="files_with_matches"
```

fetch를 사용하는 페이지에서 로딩 상태(`useState`로 관리)와 로딩 UI(Loader2/RefreshCw 아이콘 + `animate-spin`)가 있는지 확인합니다.

**PASS:** API 호출 시 로딩 스피너 또는 로딩 상태 표시 있음
**FAIL:** fetch 호출이 있지만 로딩 상태 없이 빈 화면이 표시됨
**수정:** `useState`로 loading 상태 추가, Loader2 또는 RefreshCw 아이콘과 `animate-spin` 클래스로 로딩 UI 추가

### Step 5: 에러 상태 처리 검증

**파일:** `src/app/(dashboard)/**/page.tsx`

**검사:** API 호출 실패 시 사용자에게 에러 메시지를 표시하는지 확인합니다.

```bash
# error 상태 관리
Grep pattern="(setError|useState.*error)" path="src/app/(dashboard)" glob="page.tsx" output_mode="files_with_matches"

# 에러 UI 표시 (destructive 스타일)
Grep pattern="(bg-destructive|text-destructive|text-red)" path="src/app/(dashboard)" glob="page.tsx" output_mode="files_with_matches"
```

사용자 입력을 받아 API를 호출하는 페이지에서 에러 상태와 에러 UI가 있는지 확인합니다.

**PASS:** API 호출 실패 시 에러 메시지를 한국어로 표시
**FAIL:** fetch 실패 시 에러를 무시하거나 콘솔에만 출력
**수정:** `useState`로 error 상태 추가, `bg-destructive/10 text-destructive` 스타일로 에러 메시지 표시 영역 추가

### Step 6: 아이콘 라이브러리 일관성 검증

**파일:** `src/app/(dashboard)/**/page.tsx`, `src/components/layout/sidebar.tsx`

**검사:** 아이콘을 lucide-react에서 일관되게 import하는지 확인합니다.

```bash
# lucide-react import 확인
Grep pattern="from 'lucide-react'" path="src/app/(dashboard)" glob="page.tsx" output_mode="files_with_matches"

# 다른 아이콘 라이브러리 사용 확인
Grep pattern="from '(react-icons|@heroicons|@mui/icons)" path="src/app/(dashboard)" glob="page.tsx" output_mode="files_with_matches"
```

**PASS:** lucide-react만 아이콘 라이브러리로 사용
**FAIL:** lucide-react 외 다른 아이콘 라이브러리(react-icons, heroicons 등) 혼용
**수정:** 모든 아이콘을 lucide-react로 통일

### Step 7: 사이드바 네비게이션 동기화 검증

**파일:** `src/lib/navigation.ts`, `src/components/layout/sidebar.tsx`, `src/components/layout/mobile-sidebar.tsx`, `src/app/(dashboard)/**/page.tsx`

**검사:** `navGroups`에 정의된 href가 실제 존재하는 페이지와 일치하고, sidebar/mobile-sidebar가 navGroups 구조를 사용하는지 확인합니다.

```bash
# navGroups에서 href 추출 (navigation.ts)
Grep pattern="href: '/" path="src/lib/navigation.ts" output_mode="content"

# sidebar가 navGroups를 import하는지 확인
Grep pattern="navGroups" path="src/components/layout/sidebar.tsx" output_mode="content"
Grep pattern="navGroups" path="src/components/layout/mobile-sidebar.tsx" output_mode="content"

# 실제 대시보드 페이지 디렉토리 확인
Glob pattern="src/app/(dashboard)/**/page.tsx"
```

navGroups의 각 href에 대응하는 페이지 파일이 존재하는지 확인합니다. sidebar와 mobile-sidebar 모두 `navGroups`를 import하여 그룹화된 메뉴를 렌더링하는지 확인합니다.

**PASS:** 모든 navGroups 링크에 대응하는 페이지가 존재하고, sidebar/mobile-sidebar가 navGroups 사용
**FAIL:** 링크-페이지 불일치, 또는 sidebar가 구 `navItems` 배열을 직접 사용
**수정:** navGroups 또는 페이지 파일 추가/제거하여 동기화, sidebar를 navGroups import로 변경

### Step 8: 동적 데이터 기반 UI 라벨 검증 (blog-index 특화)

**파일:** `src/app/(dashboard)/blog-index/page.tsx`

**검사:** 블로그 분석 결과에서 실제 본문 데이터 여부에 따라 동적 라벨을 표시하는지 확인합니다.

```bash
# 포스트 분석 요약에서 hasActualContent 체크 로직
Grep pattern="hasActualContent.*=.*some.*isScrapped" path="src/app/(dashboard)/blog-index/page.tsx" output_mode="content"

# 동적 라벨 생성 (본문 깊이 vs 미리보기)
Grep pattern="label:.*hasActualContent.*본문 깊이.*미리보기" path="src/app/(dashboard)/blog-index/page.tsx" output_mode="content"
```

스크래핑된 실제 본문 데이터가 있을 때 "본문 깊이 1,234자", RSS 미리보기만 있을 때 "미리보기 ~356자"로 표시해야 합니다.

**PASS:** 데이터 소스에 따라 동적 라벨 표시 (본문 깊이 vs 미리보기)
**FAIL:** 데이터 소스와 관계없이 고정된 라벨 표시
**수정:** `hasActualContent` 상태 기반 삼항 연산자로 동적 라벨 구현

### Step 9: 사용자별 맞춤형 가이드 생성 검증 (blog-index 특화)

**파일:** `src/app/(dashboard)/blog-index/page.tsx`

**검사:** 사용자의 약한 카테고리 2개를 분석하여 맞춤형 개선 가이드를 표시하는지 확인합니다.

```bash
# 약한 카테고리 추출 로직
Grep pattern="weakCategories.*=.*sort.*score.*maxScore.*slice" path="src/app/(dashboard)/blog-index/page.tsx" output_mode="content"

# guideMap 존재 여부 (카테고리별 가이드 매핑)
Grep pattern="guideMap.*Record.*콘텐츠 품질.*주제 전문성.*검색 파워.*활동성" path="src/app/(dashboard)/blog-index/page.tsx" output_mode="content"
```

사용자의 카테고리별 점수를 분석하여 가장 약한 2개 카테고리의 맞춤형 개선 팁을 표시해야 합니다.

**PASS:** 약한 카테고리 2개 추출 + 카테고리별 guideMap 매핑 존재
**FAIL:** 모든 사용자에게 동일한 고정된 가이드 표시
**수정:** `weakCategories` 추출 로직 + `guideMap` 매핑 구현

### Step 10: AI 텍스트 마크다운 렌더링 검증

**파일:** `src/app/(dashboard)/seo-check/page.tsx`, `src/app/(dashboard)/blog-index/page.tsx`, `src/app/(dashboard)/competitors/page.tsx`, `src/app/(dashboard)/content/page.tsx`

**검사:** AI가 생성한 텍스트(`**bold**`, `## heading` 등)가 raw 문자열이 아닌 마크다운으로 렌더링되는지 확인합니다.

```bash
# InlineMarkdown 또는 ReactMarkdown을 사용하는 페이지 확인
Grep pattern="InlineMarkdown|ReactMarkdown" path="src/app/(dashboard)/seo-check/page.tsx" output_mode="content"
Grep pattern="InlineMarkdown|ReactMarkdown" path="src/app/(dashboard)/blog-index/page.tsx" output_mode="content"
Grep pattern="InlineMarkdown|ReactMarkdown" path="src/app/(dashboard)/competitors/page.tsx" output_mode="content"
Grep pattern="InlineMarkdown|ReactMarkdown" path="src/app/(dashboard)/content/page.tsx" output_mode="content"

# InlineMarkdown 컴포넌트가 존재하는지 확인
Glob pattern="src/components/ui/inline-markdown.tsx"
```

AI 생성 텍스트(강점, 약점, 추천, 피드백 등)가 `{text}` 대신 `<InlineMarkdown>{text}</InlineMarkdown>` 또는 `<ReactMarkdown>{text}</ReactMarkdown>`으로 감싸져야 합니다.

**PASS:** AI 텍스트 영역에 InlineMarkdown/ReactMarkdown 사용
**FAIL:** AI 텍스트가 `{s}`, `{rec}` 등으로 raw 렌더링
**수정:** `<InlineMarkdown>{text}</InlineMarkdown>` 으로 감싸기

### Step 11: TipTap 리치텍스트 에디터 검증 (content 특화)

**파일:** `src/app/(dashboard)/content/page.tsx`, `src/components/content/TiptapEditor.tsx`, `src/components/content/TiptapToolbar.tsx`

**검사:** 콘텐츠 편집 영역이 TipTap WYSIWYG 에디터를 사용하며, HTML 클립보드 복사가 구현되어 있는지 확인합니다.

```bash
# TiptapEditor 컴포넌트 import 확인
Grep pattern="TiptapEditor" path="src/app/(dashboard)/content/page.tsx" output_mode="content"

# HTML 클립보드 복사 (ClipboardItem) 구현 확인
Grep pattern="ClipboardItem|text/html" path="src/app/(dashboard)/content/page.tsx" output_mode="content"

# TipTap 에디터에서 마크다운 변환 유틸 사용 확인
Grep pattern="markdownToHtml|htmlToMarkdown" path="src/components/content/TiptapEditor.tsx" output_mode="content"

# TipTap 툴바에 필수 서식 버튼 포함 확인 (Bold, Italic, Underline, Color, Highlight, TextAlign)
Grep pattern="toggleBold|toggleItalic|toggleUnderline|setColor|toggleHighlight|setTextAlign" path="src/components/content/TiptapToolbar.tsx" output_mode="content"
```

**PASS:** TiptapEditor 사용 + HTML 클립보드 복사 + 마크다운 변환 + 서식 툴바 완비
**FAIL:** textarea로 편집 또는 HTML 클립보드 미구현
**수정:** TiptapEditor 컴포넌트 도입, ClipboardItem으로 text/html 복사, markdownToHtml/htmlToMarkdown 변환 연결

## Output Format

```markdown
## Dashboard Pages 검증 결과

| # | 검사 항목 | 상태 | 파일 | 상세 |
|---|-----------|------|------|------|
| 1 | 'use client' 선언 | PASS/FAIL | 파일명 | 상세 설명 |
| 2 | 한국어 UI 텍스트 | PASS/FAIL | 파일명 | 상세 설명 |
| 3 | shadcn/ui 사용 | PASS/FAIL | 파일명 | 상세 설명 |
| 4 | 로딩 상태 처리 | PASS/FAIL | 파일명 | 상세 설명 |
| 5 | 에러 상태 처리 | PASS/FAIL | 파일명 | 상세 설명 |
| 6 | 아이콘 일관성 | PASS/FAIL | 파일명 | 상세 설명 |
| 7 | 사이드바 동기화 | PASS/FAIL | 파일명 | 상세 설명 |
| 8 | 동적 데이터 라벨 | PASS/FAIL | blog-index/page.tsx | blog-index 전용: 데이터 소스 기반 동적 라벨 |
| 9 | 맞춤형 가이드 | PASS/FAIL | blog-index/page.tsx | blog-index 전용: 약한 카테고리 분석 기반 가이드 |
| 10 | AI 텍스트 마크다운 | PASS/FAIL | 파일명 | AI 생성 텍스트 마크다운 렌더링 |
| 11 | TipTap 에디터 | PASS/FAIL | content/page.tsx | TipTap WYSIWYG + HTML 복사 + 서식 툴바 |
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **서버 컴포넌트 페이지** — `useState`/`useEffect` 없이 서버에서 렌더링되는 페이지(예: 결제 성공/실패 페이지)는 `'use client'` 선언이 불필요하며, 로딩/에러 상태 관리도 불필요
2. **레이아웃 컴포넌트** — `layout.tsx` 파일은 대시보드 페이지가 아닌 레이아웃이므로 이 검증 대상이 아님
3. **일부 영어 약어** — "SEO", "AI", "API", "TOP 10", "URL" 등 기술 용어는 한국어 번역 없이 사용 가능
4. **컴포넌트 파일** — `src/components/` 내 재사용 컴포넌트는 이 검증의 직접 대상이 아님 (사이드바 동기화 검사 제외)
5. **데모 배지** — `isDemo` 상태에 따라 "데모" 배지를 표시하는 것은 정상 패턴
6. **인증 페이지 로딩/에러** — `(auth)/` 페이지는 API 호출 없이 Supabase Auth를 직접 사용하므로 로딩/에러 상태 관리 패턴이 대시보드와 다를 수 있음
7. **관리자 페이지** — `admin/` 하위 페이지는 일반 사용자에게 노출되지 않으므로 한국어 UI 검증 기준이 다소 유연. 단, 관리자도 한국어 사용자이므로 기본적으로 한국어 UI 유지
