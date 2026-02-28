---
name: verify-seo-engine
description: SEO 점수 체계(13개 카테고리 100점 만점)와 등급 판정이 엔진/API/UI에서 일관되게 적용되는지 검증합니다. SEO 로직 수정 후 사용.
---

# SEO 엔진 검증

## Purpose

1. **점수 체계 일관성** — 엔진의 13개 카테고리 합계가 100점인지, 점수 배분이 올바른지 검증
2. **등급 체계 동기화** — 엔진의 16단계 등급(Lv.1~16, 임계값 95/89/82/76/70/64/57/51/45/38/32/26/20/13/7/0)이 API/UI에서 일관되게 적용되는지 검증
3. **색상 매핑 일관성** — 16단계 등급별 색상(amber/emerald/teal/green/lime/blue/sky/indigo/violet/slate)이 모든 UI에서 동일한지 검증
4. **가독성 분석 동기화** — 가독성 점수(A~F 등급)의 임계값이 엔진과 UI에서 일치하는지 검증
5. **블로그 지수 티어 일관성** — 16등급 티어(Lv.1~16) 점수 구간이 엔진과 UI에서 일치하는지 검증
6. **키워드 스터핑 감지 일관성** — SEO/DIA 엔진의 스터핑 감점 기준과 AI 프롬프트의 스터핑 지시가 동기화되어 있는지 검증

## When to Run

- `src/lib/seo/engine.ts` 또는 `src/lib/content/engine.ts`의 SEO 분석 로직을 수정한 후
- `src/lib/blog-index/engine.ts`의 블로그 지수 로직을 수정한 후
- `src/lib/seo/ai-analyzer.ts`의 AI SEO 분석 로직을 수정한 후
- `src/lib/dia/engine.ts`의 D.I.A. 분석 로직을 수정한 후
- `src/lib/utils/text.ts`의 `detectStuffingPatterns` 공유 함수를 수정한 후
- `src/lib/ai/prompts/seo.ts`의 SEO 분석 프롬프트를 수정한 후
- SEO 점수 관련 UI 컴포넌트를 수정한 후
- 등급 판정 기준이나 색상 매핑을 변경한 후

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/content/engine.ts` | 콘텐츠 생성 엔진 (analyzeSeo re-export + buildSystemPrompt 스터핑 금지 규칙) |
| `src/lib/seo/engine.ts` | SEO 분석 엔진 핵심 (analyzeSeo: 13카테고리 100점, analyzeReadability: A~F 등급) |
| `src/lib/seo/ai-analyzer.ts` | Gemini AI 기반 심층 SEO 분석 |
| `src/lib/seo/index.ts` | SEO 모듈 통합 export |
| `src/lib/blog-index/engine.ts` | 블로그 지수 엔진 (5카테고리 100점) |
| `src/lib/blog-index/grading.ts` | 블로그 지수 등급 체계 (16등급 티어 판정, 추천 생성) |
| `src/lib/blog-index/scoring.ts` | 블로그 지수 개별 포스트 점수 (scorePost) |
| `src/lib/blog-index/ai-analyzer.ts` | Gemini AI 기반 블로그 심층 분석 |
| `src/lib/blog-index/analyzers/content-quality.ts` | 콘텐츠 품질 분석기 (30점) |
| `src/lib/blog-index/analyzers/topic-authority.ts` | 주제 전문성 분석기 (25점) |
| `src/lib/blog-index/analyzers/search-power.ts` | 검색 파워 분석기 (30점) |
| `src/lib/blog-index/analyzers/activity.ts` | 활동성 분석기 (15점) |
| `src/lib/blog-index/analyzers/popularity.ts` | 인기도/구독자 분석기 |
| `src/lib/blog-index/analyzers/abuse.ts` | 어뷰징 감점 분석기 (-20점) |
| `src/lib/dia/engine.ts` | D.I.A. 분석 엔진 (DIA_GRADE_TABLE 사용, 스터핑 감지 포함) |
| `src/lib/utils/text.ts` | 공유 텍스트 유틸 (detectStuffingPatterns — SEO/DIA 엔진 공용) |
| `src/lib/utils/scoring.ts` | 공유 점수 보정 유틸 (calculateScoreAdjustment) |
| `src/lib/utils/grading.ts` | 공유 등급 판정 유틸 (determineGrade, GradeTableEntry) |
| `src/lib/ai/prompts/seo.ts` | SEO 분석 프롬프트 (SEO_DEEP_ANALYSIS_PROMPT — 스터핑 감점 지시 포함) |
| `src/lib/naver/post-meta-extractor.ts` | 블로그 포스트 메타데이터 추출 (태그, 서식 등 SeoScrapedMeta 데이터 소스) |
| `src/app/api/ai/seo-check/route.ts` | SEO 분석 API (엔진 호출 + Gemini 심층 분석) |
| `src/app/api/report/route.ts` | SEO 리포트 API (로컬 GRADE_THRESHOLDS 16단계 등급 판정) |
| `src/components/seo/LiveSeoPanel.tsx` | 실시간 SEO 분석 패널 (점수 색상, 가독성 등급 표시) |
| `src/app/(dashboard)/seo-check/page.tsx` | SEO 체크 페이지 (등급 라벨, 점수 색상, 카테고리 바) |
| `src/app/(dashboard)/content/page.tsx` | 콘텐츠 관리 페이지 (SEO 점수 배지 색상) |
| `src/app/(dashboard)/dashboard/page.tsx` | 대시보드 (평균 SEO 점수 표시) |
| `src/app/(dashboard)/blog-index/page.tsx` | 블로그 지수 페이지 (티어 표시) |
| `src/components/keywords/keyword-utils.tsx` | 키워드 점수 색상/툴팁 유틸 |

## Workflow

### Step 1: SEO 분석 카테고리 합계 확인

**파일:** `src/lib/seo/engine.ts` (핵심 엔진), `src/lib/content/engine.ts` (re-export)

**검사:** `analyzeSeo` 함수에서 13개 카테고리의 maxScore 합계가 100인지 확인합니다.

```bash
Grep pattern="maxScore|점|카테고리" path="src/lib/seo/engine.ts" output_mode="content"
```

파일을 읽고 각 카테고리의 maxScore를 합산합니다. 13개 카테고리의 합계가 정확히 100점이어야 합니다.

**PASS:** 13개 카테고리의 합계가 100점 만점
**FAIL:** 카테고리 수 또는 점수 배분이 100점이 아님
**수정:** 카테고리 점수 재배분

### Step 2: 16단계 등급 체계 동기화 확인

**파일:** `src/lib/seo/engine.ts`, `src/app/api/ai/seo-check/route.ts`, `src/app/api/report/route.ts`, `src/app/(dashboard)/seo-check/page.tsx`, `src/components/seo/LiveSeoPanel.tsx`

**검사:** SEO 등급이 16단계(Lv.1~16) 체계를 사용하고, 엔진의 `SEO_GRADE_TABLE`과 API/UI의 등급 판정이 일치하는지 확인합니다.

```bash
# 2a. 엔진의 16단계 등급 테이블 확인 (SeoGradeEntry 타입)
Grep pattern="minScore:.*info:.*tier:" path="src/lib/seo/engine.ts" output_mode="content" -n

# 2b. seo-check API에서 getGradeByScore 사용 확인 (하드코딩 등급 판정 금지)
Grep pattern="getGradeByScore|score >= (90|80|70|60|50|40)" path="src/app/api/ai/seo-check/route.ts" output_mode="content" -n

# 2c. report API의 GRADE_THRESHOLDS 임계값이 엔진과 동기화 확인
Grep pattern="minScore:.*grade:" path="src/app/api/report/route.ts" output_mode="content" -n

# 2d. seo-check 페이지에서 gradeInfo 사용 확인
Grep pattern="getGradeByScore|gradeInfo" path="src/app/(dashboard)/seo-check/page.tsx" output_mode="content" -n

# 2e. LiveSeoPanel에서 gradeInfo 사용 확인
Grep pattern="gradeInfo\." path="src/components/seo/LiveSeoPanel.tsx" output_mode="content" -n
```

**검증 기준:**
- 엔진의 SEO_GRADE_TABLE이 16개 항목(95/89/82/76/70/64/57/51/45/38/32/26/20/13/7/0)을 포함
- seo-check API가 `getGradeByScore()`로 등급을 조회 (하드코딩 if-else 금지)
- report API의 GRADE_THRESHOLDS가 엔진의 16단계 임계값과 동일
- UI가 `gradeInfo.label`, `gradeInfo.badgeColor` 등 엔진 데이터를 직접 사용

**PASS:** 엔진/API/UI 모두 16단계 등급 체계를 일관되게 사용
**FAIL:** 하드코딩 등급 판정이 남아있거나, 임계값이 불일치
**수정:** `getGradeByScore()` 사용으로 통일하거나 임계값 동기화

### Step 3: 등급 색상/배지 일관성 확인

**파일:** `src/lib/seo/engine.ts`, `src/app/(dashboard)/seo-check/page.tsx`, `src/components/seo/LiveSeoPanel.tsx`

**검사:** 16단계 등급의 색상이 엔진의 `SeoGradeInfo.color`/`badgeColor`에서 정의되고, UI가 이를 직접 참조하는지 확인합니다.

```bash
# 3a. 엔진의 등급별 색상 정의 확인
Grep pattern="color:.*badgeColor:" path="src/lib/seo/engine.ts" output_mode="content" -n head_limit=5

# 3b. seo-check 페이지에서 gradeInfo.badgeColor 사용 확인
Grep pattern="gradeInfo\.badgeColor|gradeInfo\.color" path="src/app/(dashboard)/seo-check/page.tsx" output_mode="content" -n

# 3c. LiveSeoPanel에서 gradeInfo.badgeColor/label 사용 확인
Grep pattern="gradeInfo\.badgeColor|gradeInfo\.label" path="src/components/seo/LiveSeoPanel.tsx" output_mode="content" -n

# 3d. 프로그레스 바 색상 함수 확인 (점수 구간별 bg-색상)
Grep pattern="score >= .*(bg-|return )" path="src/app/(dashboard)/seo-check/page.tsx" output_mode="content" -n head_limit=10
```

**PASS:** UI가 `gradeInfo.badgeColor`/`gradeInfo.color`를 직접 참조하여 색상 표시
**FAIL:** UI에서 별도 색상 매핑을 하드코딩 (엔진과 불일치 위험)
**수정:** 엔진의 `gradeInfo` 데이터를 직접 사용하도록 변경

### Step 4: 가독성 등급 동기화 확인

**파일:** `src/lib/content/engine.ts`, `src/components/seo/LiveSeoPanel.tsx`

**검사:** 가독성 분석의 등급 임계값(A:85+, B:70+, C:50+, D:30+, F:<30)이 엔진과 UI에서 일치하는지 확인합니다.

```bash
Grep pattern="(readability|가독성).*(85|70|50|30)" path="src/lib/content/engine.ts" output_mode="content"
Grep pattern="(grade|등급).*(A|B|C|D|F)" path="src/components/seo/LiveSeoPanel.tsx" output_mode="content"
```

파일을 읽고 엔진의 등급 기준과 UI의 등급 표시를 대조합니다.

**PASS:** 엔진과 UI의 가독성 등급 임계값이 일치
**FAIL:** 엔진은 85점을 A로 판정하지만 UI는 80점을 A로 표시하는 등 불일치
**수정:** 임계값 통일

### Step 5: 블로그 지수 티어 일관성 확인

**파일:** `src/lib/blog-index/grading.ts`, `src/app/(dashboard)/blog-index/page.tsx`

**검사:** 16등급 티어의 점수 구간(95/89/82/76/70/64/57/51/45/38/32/26/20/13/7)이 등급 모듈과 UI에서 일치하는지 확인합니다.
- 5개 카테고리: 일반(Lv.1) / 준최적화(Lv.2~8) / 최적화(Lv.9~11) / 최적화+(Lv.12~15) / 파워(Lv.16)

```bash
# grading.ts의 티어 임계값 확인 (determineLevelInfo 함수)
Grep pattern="totalScore >= (95|89|82|76|70|64|57|51|45|38|32|26|20|13|7)" path="src/lib/blog-index/grading.ts" output_mode="content"

# UI의 티어 표시 확인
Grep pattern="(Lv\.|레벨|티어|tier)" path="src/app/(dashboard)/blog-index/page.tsx" output_mode="content"
```

**PASS:** 등급 모듈과 UI의 16등급 티어 구간이 일치
**FAIL:** 등급 모듈의 티어 구간과 UI 표시 불일치
**수정:** 등급 모듈 또는 UI의 티어 구간 수정

### Step 6: 엔진 등급 라벨 일관성 확인

**파일:** `src/lib/seo/engine.ts`

**검사:** SEO 16단계 등급(Lv.1~Lv.16)이 연속적이고, 5개 카테고리(일반/준최적화/최적화/최적화+/파워)가 올바르게 할당되어 있는지 확인합니다.

```bash
# 6a. 16단계 등급 라벨 확인
Grep pattern="grade: 'Lv\." path="src/lib/seo/engine.ts" output_mode="content" -n

# 6b. 카테고리 분포 확인 (5종류)
Grep pattern="category: '" path="src/lib/seo/engine.ts" output_mode="content" -n
```

16개 등급이 Lv.1~Lv.16까지 빈 구간 없이 연속적이고, 각 등급에 5개 카테고리(일반/준최적화/최적화/최적화+/파워) 중 하나가 할당되어야 합니다.

**PASS:** 16개 등급이 연속적이고 카테고리가 올바르게 할당됨
**FAIL:** 등급 누락 또는 카테고리 미할당
**수정:** 누락된 등급 추가

### Step 7: 키워드 스터핑 감지 일관성 확인

**파일:** `src/lib/seo/engine.ts`, `src/lib/dia/engine.ts`, `src/lib/utils/text.ts`, `src/lib/ai/prompts/seo.ts`, `src/lib/content/engine.ts`

**검사:** 키워드 스터핑 감지 로직이 다음 3개 레이어에서 일관되게 적용되는지 확인합니다:
1. 공유 유틸 (`detectStuffingPatterns`) — SEO/DIA 엔진에서 import
2. 엔진 감점 기준 — SEO 엔진과 DIA 엔진의 stuffRatio 임계값
3. AI 프롬프트 — 심층 분석/콘텐츠 생성 프롬프트의 스터핑 지시

```bash
# 7a. detectStuffingPatterns 공유 유틸에서 import 확인 (로컬 재정의 방지)
Grep pattern="detectStuffingPatterns" path="src/lib/seo/engine.ts" output_mode="content"
Grep pattern="detectStuffingPatterns" path="src/lib/dia/engine.ts" output_mode="content"
Grep pattern="detectStuffingPatterns" path="src/lib/utils/text.ts" output_mode="content"

# 7b. stuffRatio 임계값 동기화 확인 (두 엔진 모두 0.5/0.3 기준)
Grep pattern="stuffRatio >= " path="src/lib/seo/engine.ts" output_mode="content"
Grep pattern="stuffRatio >= " path="src/lib/dia/engine.ts" output_mode="content"

# 7c. AI 프롬프트에 스터핑 감점 지시 존재 확인
Grep pattern="스터핑" path="src/lib/ai/prompts/seo.ts" output_mode="content"
Grep pattern="스터핑" path="src/lib/content/engine.ts" output_mode="content"
```

**검증 기준:**
- `detectStuffingPatterns`는 `@/lib/utils/text`에서만 import되어야 함 (로컬 정의 금지)
- SEO 엔진과 DIA 엔진의 stuffRatio 임계값이 동일해야 함 (0.5: 큰 감점, 0.3: 소폭 감점)
- AI 프롬프트에 스터핑 감점 기준이 명시되어 있어야 함

**PASS:** 3개 레이어 모두 일관된 스터핑 감지 적용
**FAIL:** 엔진 간 임계값 불일치, 로컬 함수 중복 정의, 프롬프트에 스터핑 지시 누락
**수정:** 임계값 통일, 로컬 함수를 공유 유틸 import로 교체, 프롬프트에 스터핑 지시 추가

### Step 8: AI 프롬프트 SEO 요구사항과 엔진 로직 정렬 확인

**파일:** `src/lib/content/engine.ts`, `src/lib/seo/engine.ts`, `src/lib/ai/prompts/content.ts`

**검사:** AI 프롬프트의 SEO 지시사항이 엔진의 실제 검증 로직과 일치하는지 확인합니다.

```bash
# 8a. 프롬프트의 키워드 밀도 지시 확인
Grep pattern="키워드 밀도.*5.*8.*회|키워드.*본문.*[0-9].*회" path="src/lib/content/engine.ts" output_mode="content"
Grep pattern="키워드 밀도.*5.*8.*회|키워드.*본문.*[0-9].*회" path="src/lib/ai/prompts/content.ts" output_mode="content"

# 8b. 엔진의 키워드 밀도 검증 로직 확인
Grep pattern="density.*>=.*0\.5|density.*<=.*2\.5" path="src/lib/seo/engine.ts" output_mode="content"

# 8c. 프롬프트의 키워드 분포 지시 확인
Grep pattern="3등분|전반부.*중반부.*후반부|처음.*중간.*마지막.*1/3" path="src/lib/content/engine.ts" output_mode="content"
Grep pattern="3등분|전반부.*중반부.*후반부|처음.*중간.*마지막.*1/3" path="src/lib/ai/prompts/content.ts" output_mode="content"

# 8d. 엔진의 키워드 분포 검증 로직 확인 (3-section split)
Grep pattern="const sectionSize|sections = 3|split.*3" path="src/lib/seo/engine.ts" output_mode="content"

# 8e. 프롬프트의 내부 링크 지시 확인
Grep pattern="내부 링크.*2.*3|마크다운 링크.*2.*3" path="src/lib/content/engine.ts" output_mode="content"
Grep pattern="내부 링크.*2.*3|마크다운 링크.*2.*3" path="src/lib/ai/prompts/content.ts" output_mode="content"

# 8f. 엔진의 내부 링크 검증 로직 확인
Grep pattern="\[.*\]\(.*\)|markdown.*link" path="src/lib/seo/engine.ts" output_mode="content"
```

**검증 기준:**
- **키워드 밀도**: 프롬프트가 "5~8회 반복"을 지시 → 엔진이 0.5~2.5% 밀도를 체크 (2000자 기준 10~50회, 약 5~8회가 최적 범위에 해당)
- **키워드 분포**: 프롬프트가 "3등분 각 섹션 포함" 지시 → 엔진이 본문을 3개 섹션으로 분할하여 각 섹션 검증
- **내부 링크**: 프롬프트가 "2~3개 마크다운 링크" 지시 → 엔진이 `[text](url)` 패턴으로 링크 수 카운트

**PASS:** AI 프롬프트의 SEO 지시와 엔진의 검증 로직이 정렬됨
**FAIL:** 프롬프트는 "5~8회"를 지시하는데 엔진은 다른 기준으로 검증, 또는 프롬프트에 분포/링크 지시 누락
**수정:** 프롬프트와 엔진 로직을 동기화하여 AI가 생성한 콘텐츠가 엔진 검증을 통과하도록 조정

### Step 9: 광고성 키워드 감점 일관성 확인

**파일:** `src/lib/seo/engine.ts`, `src/lib/blog-index/analyzers/popularity.ts`, `src/lib/blog-index/analyzers/search-power.ts`, `src/lib/content/engine.ts`

**검사:** SEO 엔진과 블로그 지수 분석기 모두 광고성/상업적 키워드를 감지하고 감점합니다. 두 모듈의 AD_KEYWORDS/COMMERCIAL_KEYWORDS 목록이 일관되고, AI 콘텐츠 생성 프롬프트에도 해당 키워드 회피 지시가 포함되어 있는지 확인합니다.

```bash
# 9a. SEO 엔진의 광고성 키워드 목록 확인
Grep pattern="AD_KEYWORDS|COMMERCIAL_KEYWORDS" path="src/lib/seo/engine.ts" output_mode="content" -A 10

# 9b. 블로그 지수 분석기의 광고성 키워드 목록 확인
Grep pattern="AD_KEYWORDS|COMMERCIAL_KEYWORDS" path="src/lib/blog-index/analyzers/popularity.ts" output_mode="content" -A 10
Grep pattern="COMMERCIAL_KEYWORDS" path="src/lib/blog-index/analyzers/search-power.ts" output_mode="content" -A 10

# 9c. 콘텐츠 생성 프롬프트에 감점 키워드 회피 지시 존재 확인
Grep pattern="감점.*키워드|광고성|낚시성|상업적" path="src/lib/content/engine.ts" output_mode="content"
Grep pattern="감점.*키워드|광고성|낚시성|상업적" path="src/lib/ai/prompts/content.ts" output_mode="content"

# 9d. SEO 엔진의 detectAdKeywords 함수 존재 확인
Grep pattern="detectAdKeywords" path="src/lib/seo/engine.ts" output_mode="content"
```

**검증 기준:**
- SEO 엔진과 블로그 지수 분석기의 핵심 광고 키워드(제휴마케팅, 쿠팡파트너스, 협찬 등)가 공통으로 포함
- 콘텐츠 생성 프롬프트에 네이버 감점 유발 표현 회피 지시가 포함
- `detectAdKeywords`가 `analyzeSeo` 내에서 호출되어 총점에 반영

**PASS:** 3개 레이어(SEO 엔진/블로그 지수/AI 프롬프트) 모두 일관된 광고성 키워드 감지 적용
**FAIL:** 모듈 간 키워드 목록 대폭 불일치, 프롬프트에 감점 키워드 회피 지시 누락, 또는 detectAdKeywords가 총점에 미반영
**수정:** 키워드 목록 동기화, 프롬프트에 회피 지시 추가, detectAdKeywords 호출 확인

### Step 10: analyzeSeo 시그니처 및 SeoScrapedMeta 활용 확인

**파일:** `src/lib/seo/engine.ts`, `src/lib/seo/index.ts`, `src/app/api/ai/seo-check/route.ts`

**검사:** `analyzeSeo` 함수가 `scrapedMeta` 파라미터를 받아 태그/서식 데이터를 활용하는지, `SeoScrapedMeta` 타입이 export되는지 확인합니다.

```bash
# 10a. analyzeSeo 시그니처에 scrapedMeta 파라미터 존재 확인
Grep pattern="analyzeSeo.*scrapedMeta" path="src/lib/seo/engine.ts" output_mode="content"

# 10b. SeoScrapedMeta 타입 export 확인
Grep pattern="SeoScrapedMeta" path="src/lib/seo/index.ts" output_mode="content"

# 10c. seo-check API에서 scrapedMeta 전달 확인
Grep pattern="scrapedMeta|SeoScrapedMeta" path="src/app/api/ai/seo-check/route.ts" output_mode="content"
```

**PASS:** analyzeSeo가 scrapedMeta를 받고, SeoScrapedMeta가 index.ts에서 export되고, API에서 전달됨
**FAIL:** 시그니처 불일치, 타입 미export, 또는 API에서 전달 누락
**수정:** 시그니처/export/전달 동기화

## Output Format

```markdown
## SEO 엔진 검증 결과

| # | 검사 항목 | 상태 | 파일 | 상세 |
|---|-----------|------|------|------|
| 1 | 카테고리 합계 (100점) | PASS/FAIL | engine.ts | 상세 설명 |
| 2 | 16단계 등급 체계 동기화 | PASS/FAIL | engine, seo-check API, report API, UI | 상세 설명 |
| 3 | 등급 색상/배지 일관성 | PASS/FAIL | engine, seo-check page, LiveSeoPanel | 상세 설명 |
| 4 | 가독성 등급 동기화 | PASS/FAIL | engine.ts, LiveSeoPanel | 상세 설명 |
| 5 | 블로그 지수 티어 | PASS/FAIL | blog-index/engine.ts, page | 상세 설명 |
| 6 | 등급 라벨 일관성 | PASS/FAIL | engine.ts | 상세 설명 |
| 7 | 스터핑 감지 일관성 | PASS/FAIL | seo/engine, dia/engine, utils/text, prompts/seo | 상세 설명 |
| 8 | AI 프롬프트-엔진 정렬 | PASS/FAIL | content/engine, seo/engine, prompts/content | 상세 설명 |
| 9 | 광고성 키워드 감점 | PASS/FAIL | seo/engine, blog-index/analyzers, content/engine | 상세 설명 |
| 10 | SeoScrapedMeta 활용 | PASS/FAIL | seo/engine, seo/index, seo-check route | 상세 설명 |
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **키워드 추천 점수** — `keyword-utils.tsx`의 점수(70/40)는 키워드 추천용이며, SEO 콘텐츠 점수(80/60/40)와는 별도 체계
2. **Recharts 색상** — 차트 라이브러리에서 사용하는 하드코딩 색상(#6366f1 등)은 SEO 등급 색상과 무관
3. **블로그 지수 vs SEO 점수** — 블로그 지수와 SEO 점수는 동일한 16단계 등급 체계를 공유하지만, 점수 산출 방식(카테고리 구성)이 다르므로 별도 분석 모듈로 운영됨
4. **데모 데이터 점수** — API 키 미설정 시 반환하는 데모 데이터의 점수는 하드코딩된 예시값이므로 검증 대상 아님
5. **SEO vs DIA 감점 방식 차이** — SEO 엔진은 `Math.min(score, N)`으로 상한 제한, DIA 엔진은 `Math.max(0, score - N)`으로 감산 방식을 사용하는데, 이는 점수 체계 차이에 따른 의도적 설계이므로 불일치가 아님
