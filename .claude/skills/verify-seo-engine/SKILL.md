---
name: verify-seo-engine
description: SEO 점수 체계(13개 카테고리 100점 만점)와 등급 판정이 엔진/API/UI에서 일관되게 적용되는지 검증합니다. SEO 로직 수정 후 사용.
---

# SEO 엔진 검증

## Purpose

1. **점수 체계 일관성** — 엔진의 13개 카테고리 합계가 100점인지, 점수 배분이 올바른지 검증
2. **등급 임계값 동기화** — 엔진/API/UI에서 사용하는 등급 임계값(80/60/40)이 모두 일치하는지 검증
3. **색상 매핑 일관성** — 점수 구간별 색상(green/yellow/orange/red)이 모든 UI에서 동일한지 검증
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
| `src/app/api/ai/seo-check/route.ts` | SEO 분석 API (엔진 호출 + Gemini 심층 분석) |
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

### Step 2: 등급 임계값 일관성 확인

**파일:** `src/app/(dashboard)/seo-check/page.tsx`, `src/components/seo/LiveSeoPanel.tsx`, `src/app/(dashboard)/dashboard/page.tsx`

**검사:** SEO 총점 등급 임계값이 모든 파일에서 동일한지 확인합니다.

```bash
# seo-check 페이지의 등급 판정
Grep pattern="score >= (80|60|40)" path="src/app/(dashboard)/seo-check/page.tsx" output_mode="content"

# LiveSeoPanel의 색상 매핑
Grep pattern="score >= (80|60|40)" path="src/components/seo/LiveSeoPanel.tsx" output_mode="content"

# 대시보드의 평균 SEO 표시
Grep pattern="avgSeoScore >= (80|60|40)" path="src/app/(dashboard)/dashboard/page.tsx" output_mode="content"

# 콘텐츠 페이지의 점수 색상
Grep pattern="score >= (80|60|40)" path="src/app/(dashboard)/content/page.tsx" output_mode="content"
```

모든 파일에서 동일한 임계값을 사용하는지 대조합니다.

**PASS:** 모든 파일에서 80/60/40 임계값이 동일
**FAIL:** 파일마다 다른 임계값 사용 (예: 한 곳은 70, 다른 곳은 80)
**수정:** 공통 상수로 추출하거나 모든 파일의 임계값 통일

### Step 3: 색상 매핑 일관성 확인

**파일:** `src/app/(dashboard)/seo-check/page.tsx`, `src/components/seo/LiveSeoPanel.tsx`, `src/app/(dashboard)/content/page.tsx`

**검사:** 점수 구간별 색상(bg-green, bg-yellow, bg-orange, bg-red)이 모든 UI에서 동일한지 확인합니다.

```bash
Grep pattern="bg-(green|yellow|orange|red|blue)-" path="src/app/(dashboard)/seo-check/page.tsx" output_mode="content"
Grep pattern="bg-(green|yellow|orange|red|blue)-" path="src/components/seo/LiveSeoPanel.tsx" output_mode="content"
Grep pattern="bg-(green|yellow|orange|red|blue)-" path="src/app/(dashboard)/content/page.tsx" output_mode="content"
```

**PASS:** 동일 점수 구간에 동일 색상 사용
**FAIL:** 같은 점수인데 파일마다 다른 색상 (예: 60~79가 한 곳은 yellow, 다른 곳은 blue)
**수정:** 색상 매핑 통일

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

**파일:** `src/lib/content/engine.ts`

**검사:** SEO 분석의 등급(S/A+/A/B+/B/C/D)과 블로그 지수의 등급 체계가 각각 내부적으로 일관되는지 확인합니다.

```bash
Grep pattern="grade.*=.*['\"]" path="src/lib/content/engine.ts" output_mode="content"
```

등급 문자열이 연속적이고 누락된 구간이 없는지 확인합니다.

**PASS:** 모든 점수 구간에 등급이 할당되어 있고 빈 구간이 없음
**FAIL:** 특정 점수 범위에 등급이 할당되지 않음
**수정:** 빈 구간에 등급 추가

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

## Output Format

```markdown
## SEO 엔진 검증 결과

| # | 검사 항목 | 상태 | 파일 | 상세 |
|---|-----------|------|------|------|
| 1 | 카테고리 합계 (100점) | PASS/FAIL | engine.ts | 상세 설명 |
| 2 | 등급 임계값 동기화 | PASS/FAIL | seo-check, LiveSeoPanel 등 | 상세 설명 |
| 3 | 색상 매핑 일관성 | PASS/FAIL | 관련 파일 | 상세 설명 |
| 4 | 가독성 등급 동기화 | PASS/FAIL | engine.ts, LiveSeoPanel | 상세 설명 |
| 5 | 블로그 지수 티어 | PASS/FAIL | blog-index/engine.ts, page | 상세 설명 |
| 6 | 등급 라벨 일관성 | PASS/FAIL | engine.ts | 상세 설명 |
| 7 | 스터핑 감지 일관성 | PASS/FAIL | seo/engine, dia/engine, utils/text, prompts/seo | 상세 설명 |
| 8 | AI 프롬프트-엔진 정렬 | PASS/FAIL | content/engine, seo/engine, prompts/content | 상세 설명 |
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **키워드 추천 점수** — `keyword-utils.tsx`의 점수(70/40)는 키워드 추천용이며, SEO 콘텐츠 점수(80/60/40)와는 별도 체계
2. **Recharts 색상** — 차트 라이브러리에서 사용하는 하드코딩 색상(#6366f1 등)은 SEO 등급 색상과 무관
3. **블로그 지수 vs SEO 점수** — 블로그 지수(10단계 티어)와 SEO 콘텐츠 점수(S~D 등급)는 별도 점수 체계이므로 임계값이 달라도 정상
4. **데모 데이터 점수** — API 키 미설정 시 반환하는 데모 데이터의 점수는 하드코딩된 예시값이므로 검증 대상 아님
5. **SEO vs DIA 감점 방식 차이** — SEO 엔진은 `Math.min(score, N)`으로 상한 제한, DIA 엔진은 `Math.max(0, score - N)`으로 감산 방식을 사용하는데, 이는 점수 체계 차이에 따른 의도적 설계이므로 불일치가 아님
