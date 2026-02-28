---
name: verify-shared-utils
description: 공유 유틸리티 함수의 중복 코드 재발을 방지하고, import 경로 일관성과 미사용 export를 검증합니다. 컴포넌트/페이지 추가/수정 후 사용.
---

# 공유 유틸리티 검증

## Purpose

1. **중복 코드 탐지** — 이미 공유 유틸에 존재하는 함수가 다른 파일에 재정의되지 않았는지 검증
2. **import 경로 일관성** — 공유 유틸에서 import하는 경로가 올바른지 검증
3. **미사용 export 탐지** — 공유 유틸에서 export하지만 어디에서도 import하지 않는 함수가 없는지 검증
4. **함수 시그니처 일관성** — 동일한 용도의 함수가 파일마다 다른 시그니처를 갖지 않는지 검증

## When to Run

- 새로운 컴포넌트나 페이지를 추가한 후
- 기존 유틸리티 함수를 수정한 후
- 코드 리팩토링 후 공유 유틸 변경 시
- PR 전 중복 코드 확인 시

## Related Files

| File | Purpose |
|------|---------|
| `src/components/keywords/keyword-utils.tsx` | 키워드 관련 공유 유틸 (getCompBadge, getScoreColor, formatNumber 등) |
| `src/lib/utils.ts` | 범용 공통 유틸 (cn 등) |
| `src/lib/utils/text.ts` | 텍스트 처리 유틸 (stripHtml, extractKoreanKeywords, STOPWORDS, countImageMarkers, detectStuffingPatterns 등) |
| `src/lib/utils/scoring.ts` | 점수 보정 유틸 (calculateScoreAdjustment — SEO/블로그지수 공용) |
| `src/lib/utils/grading.ts` | 등급 판정 유틸 (determineGrade, GradeTableEntry — SEO/DIA 공용) |
| `src/lib/blog-index/analyzers/content-quality.ts` | 콘텐츠 품질 분석 (analyzeContentQuality — scrapedData 파라미터 사용) |
| `src/lib/blog-index/engine.ts` | 블로그 지수 분석 엔진 (analyzeBlogIndex — scrapedData 전달) |
| `src/lib/naver/blog-scraper.ts` | 블로그 본문 스크래퍼 (ScrapedPostData 타입 정의) |
| `src/components/keywords/keyword-results.tsx` | 키워드 결과 테이블 (keyword-utils 사용) |
| `src/components/keywords/bulk-keyword-results.tsx` | 키워드 대량조회 결과 테이블 (keyword-utils, ensureUrl 사용) |
| `src/app/(dashboard)/opportunities/page.tsx` | 키워드 발굴 페이지 (keyword-utils 사용) |
| `src/app/(dashboard)/dashboard/page.tsx` | 대시보드 페이지 (timeAgo 함수 로컬 정의) |
| `src/app/(dashboard)/tracking/page.tsx` | 순위 트래킹 페이지 (timeAgo 함수 로컬 정의) |
| `src/app/(dashboard)/content/page.tsx` | 콘텐츠 관리 페이지 (getScoreBgColor 등 로컬 정의) |
| `src/app/(dashboard)/seo-check/page.tsx` | SEO 체크 페이지 (getScoreBg, getGradeLabel 등 로컬 정의) |
| `src/components/ui/inline-markdown.tsx` | 인라인 마크다운 렌더링 공유 컴포넌트 (AI 텍스트용 — ReactMarkdown 래퍼) |
| `src/lib/utils/markdown-convert.ts` | 마크다운↔HTML 변환 유틸 (markdownToHtml, htmlToMarkdown — TipTap 에디터 경계 변환) |
| `src/components/content/TiptapEditor.tsx` | TipTap 에디터 래퍼 (markdown-convert 사용) |
| `src/components/content/TiptapToolbar.tsx` | TipTap 서식 툴바 (shadcn/ui Button, lucide-react 아이콘 사용) |

## Workflow

### Step 1: 공유 유틸 export 목록 수집

**파일:** `src/components/keywords/keyword-utils.tsx`, `src/lib/utils.ts`, `src/lib/utils/text.ts`, `src/lib/utils/scoring.ts`, `src/lib/utils/grading.ts`

**검사:** 공유 유틸 파일에서 export된 함수/상수 목록을 수집합니다.

```bash
Grep pattern="^export (function|const|type|interface)" path="src/components/keywords/keyword-utils.tsx" output_mode="content"
Grep pattern="^export (function|const)" path="src/lib/utils.ts" output_mode="content"
Grep pattern="^export (function|const|type)" path="src/lib/utils" glob="*.ts" output_mode="content"
```

**결과:** export된 함수/상수 이름 목록 기록

### Step 2: 중복 함수 정의 탐지

**파일:** `src/app/(dashboard)/**/*.tsx`, `src/components/**/*.tsx`

**검사:** 공유 유틸에 이미 존재하는 함수와 동일한 이름의 함수가 다른 파일에 로컬로 정의되어 있는지 확인합니다.

```bash
# keyword-utils에 있는 함수 이름으로 중복 검색
Grep pattern="function (getCompBadge|getScoreColor|getScoreTooltip|getCategoryBadge|formatNumber)\b" path="src" glob="*.tsx" output_mode="content"

# utils/text.ts에 있는 함수 이름으로 중복 검색
Grep pattern="function (stripHtml|extractKoreanKeywords|countImageMarkers|daysBetween|parsePostDate|jaccardSimilarity|extractBlogId|detectStuffingPatterns)\b" path="src/lib" glob="*.ts" output_mode="content"
```

keyword-utils.tsx 또는 utils/text.ts 이외의 파일에서 같은 이름의 함수가 정의되어 있으면 중복입니다.

**PASS:** 공유 유틸 함수가 다른 파일에 재정의되지 않음
**FAIL:** 동일 이름 함수가 다른 파일에도 정의됨
**수정:** 중복 함수 제거하고 공유 유틸에서 import

### Step 3: 유사 함수 패턴 탐지

**파일:** `src/app/(dashboard)/**/*.tsx`, `src/components/**/*.tsx`

**검사:** 이름은 다르지만 동일한 용도의 함수가 여러 파일에 존재하는지 확인합니다.

```bash
# timeAgo 패턴 (상대 시간 표시 함수)
Grep pattern="function timeAgo" path="src" glob="*.tsx" output_mode="files_with_matches"

# 점수-색상 매핑 함수
Grep pattern="function (getScore(Color|Bg|BgColor)|getGrade)" path="src" glob="*.tsx" output_mode="content"

# 숫자 포맷 함수
Grep pattern="function format(Number|Count)" path="src" glob="*.tsx" output_mode="files_with_matches"
```

동일 용도 함수가 2개 이상 파일에 있으면 공유 유틸 추출 후보입니다.

**PASS:** 중복 유사 함수 없음
**WARN:** 2개 이상 파일에 유사 함수 존재 — 공유 유틸 추출 권장
**수정:** 공통 유틸 파일로 추출하고 기존 파일에서 import

### Step 4: import 경로 정확성 검증

**파일:** `src/components/keywords/keyword-utils.tsx`를 import하는 모든 파일

**검사:** `keyword-utils`를 import하는 파일에서 경로가 올바른지 확인합니다.

```bash
Grep pattern="from.*keyword-utils" path="src" glob="*.tsx" output_mode="content"
```

import 경로가 `@/components/keywords/keyword-utils`인지 확인합니다.

**PASS:** 모든 import 경로가 올바름
**FAIL:** 잘못된 상대 경로나 존재하지 않는 경로 사용
**수정:** 올바른 alias 경로로 수정

### Step 5: 미사용 export 탐지

**파일:** `src/components/keywords/keyword-utils.tsx`

**검사:** export된 각 함수/상수가 프로젝트 내 다른 파일에서 실제로 import되는지 확인합니다.

Step 1에서 수집한 export 목록 각각에 대해:

```bash
# 각 export된 이름으로 import 검색
Grep pattern="import.*getCompBadge" path="src" glob="*.tsx" output_mode="files_with_matches"
Grep pattern="import.*CATEGORY_TOOLTIPS" path="src" glob="*.tsx" output_mode="files_with_matches"
```

**PASS:** 모든 export가 최소 1곳에서 import됨
**WARN:** 특정 export가 어디에서도 import되지 않음 — 제거 또는 향후 사용 계획 확인
**수정:** 미사용 export 제거 또는 사용처 추가

### Step 6: 분석 엔진 함수 시그니처 일관성 검증

**파일:** `src/lib/blog-index/analyzers/*.ts`, `src/lib/blog-index/engine.ts`

**검사:** analyzer 함수들이 스크래핑 데이터를 받을 수 있는 시그니처를 가지고 있는지, 그리고 engine에서 올바르게 전달하는지 확인합니다.

```bash
# content-quality.ts의 함수 시그니처에 scrapedData 파라미터 확인
Grep pattern="export function analyzeContentQuality.*scrapedData.*Map.*ScrapedPostData" path="src/lib/blog-index/analyzers/content-quality.ts" output_mode="content"

# engine.ts에서 scrapedData 전달 여부
Grep pattern="analyzeContentQuality.*posts.*scrapedData" path="src/lib/blog-index/engine.ts" output_mode="content"
```

**PASS:** analyzeContentQuality 함수가 scrapedData 파라미터를 받고, engine에서 올바르게 전달
**FAIL:** 함수 시그니처에 scrapedData가 없거나, engine에서 전달하지 않음
**수정:** 함수 시그니처에 `scrapedData?: Map<string, ScrapedPostData> | null` 추가, engine에서 전달

### Step 7: 2티어 분석 로직 검증 (실제 본문 vs RSS)

**파일:** `src/lib/blog-index/analyzers/content-quality.ts`

**검사:** 콘텐츠 깊이와 이미지 분석에서 실제 본문(스크래핑)과 RSS 미리보기를 구분하여 다른 기준을 적용하는지 확인합니다.

```bash
# 실제 본문 우선 처리 로직
Grep pattern="if.*scrapedData.*scrapedData.size.*0" path="src/lib/blog-index/analyzers/content-quality.ts" output_mode="content" -A 3

# 실제 본문 기준 (1500/1000/500자)
Grep pattern="avgContentLen.*>=.*1500|avgContentLen.*>=.*1000|avgContentLen.*>=.*500" path="src/lib/blog-index/analyzers/content-quality.ts" output_mode="content"

# RSS 미리보기 기준 (150/100/50자)
Grep pattern="avgContentLen.*>=.*150|avgContentLen.*>=.*100|avgContentLen.*>=.*50" path="src/lib/blog-index/analyzers/content-quality.ts" output_mode="content"

# isActualContent 플래그 사용 확인
Grep pattern="isActualContent.*=.*true|if.*isActualContent" path="src/lib/blog-index/analyzers/content-quality.ts" output_mode="content"
```

**PASS:** 스크래핑 데이터가 있을 때 실제 본문 기준 사용, 없을 때 RSS 기준 사용
**FAIL:** 데이터 소스와 관계없이 단일 기준만 사용
**수정:** `isActualContent` 플래그 기반 2티어 분석 로직 구현

### Step 8: 이미지 분석 스크래핑 데이터 우선 사용 검증

**파일:** `src/lib/blog-index/analyzers/content-quality.ts`

**검사:** 이미지 분석에서 스크래핑 데이터의 실제 이미지 수를 우선 사용하는지 확인합니다.

```bash
# 스크래핑 데이터에서 imageCount 추출
Grep pattern="p.imageCount.*p.hasImage" path="src/lib/blog-index/analyzers/content-quality.ts" output_mode="content" -A 2

# RSS 폴백: countImageMarkers 사용
Grep pattern="countImageMarkers.*p.description" path="src/lib/blog-index/analyzers/content-quality.ts" output_mode="content"
```

**PASS:** 스크래핑 데이터가 있으면 p.imageCount 사용, 없으면 countImageMarkers 폴백
**FAIL:** 항상 countImageMarkers만 사용하거나, 스크래핑 데이터를 무시
**수정:** 스크래핑 데이터 우선 사용 로직 추가

## Output Format

```markdown
## 공유 유틸리티 검증 결과

| # | 검사 항목 | 상태 | 파일 | 상세 |
|---|-----------|------|------|------|
| 1 | 중복 함수 정의 | PASS/FAIL | 관련 파일 | 상세 설명 |
| 2 | 유사 함수 패턴 | PASS/WARN | 관련 파일 | 상세 설명 |
| 3 | import 경로 | PASS/FAIL | 관련 파일 | 상세 설명 |
| 4 | 미사용 export | PASS/WARN | keyword-utils.tsx | 상세 설명 |
| 5 | 분석 엔진 시그니처 | PASS/FAIL | analyzers/content-quality.ts | analyzeContentQuality 함수 시그니처 |
| 6 | 2티어 분석 로직 | PASS/FAIL | analyzers/content-quality.ts | 실제 본문 vs RSS 분기 처리 |
| 7 | 이미지 분석 우선순위 | PASS/FAIL | analyzers/content-quality.ts | 스크래핑 데이터 우선 사용 |

### 공유 유틸 추출 후보
| 함수명 | 위치 (파일 수) | 권장 조치 |
|--------|---------------|-----------|
| timeAgo | 2개 파일 | 공통 유틸로 추출 |
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **의도적으로 다른 로직** — 함수 이름이 같지만 로직이 의도적으로 다른 경우 (예: `getScoreColor`가 페이지마다 다른 임계값 사용)
2. **컴포넌트 내부 전용 헬퍼** — 해당 컴포넌트에서만 사용되고 재사용 가능성이 없는 1회성 헬퍼 함수
3. **Recharts 전용 함수** — `recharts` 차트 라이브러리의 `Tooltip`은 shadcn/ui `Tooltip`과 별개이며 중복이 아님
4. **테스트/데모 전용 함수** — 테스트나 데모 목적으로 별도 정의된 유틸리티 함수
