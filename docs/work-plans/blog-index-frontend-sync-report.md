# 블로그 지수 프론트엔드-백엔드 동기화 점검 보고서

> **작성일**: 2026-02-22
> **프로젝트**: NaverSEO Pro
> **대상 파일**: `src/app/(dashboard)/blog-index/page.tsx`

---

## 점검 배경

블로그 지수 백엔드(engine.ts, scoring.ts, types.ts)에 스크래핑 2단계 파이프라인을 추가한 후,
프론트엔드 page.tsx의 로컬 타입 정의와 UI가 새로운 데이터를 반영하지 못하고 있었음.

---

## 발견된 문제 및 수정 내역

### ✅ 1. `PostDetail.isScrapped` 프론트 타입 누락 (심각도: 높음)

**문제**: 백엔드 `types.ts`에는 `isScrapped?: boolean`이 있으나, `page.tsx`의 로컬 `PostDetail` 인터페이스에 없음.
**영향**: 스크래핑 성공 여부를 프론트에서 판별 불가.

**수정**: `isScrapped?: boolean` 필드 추가

### ✅ 2. 글자수 표시가 항상 추정치로 표시 (심각도: 높음)

**문제**: 포스팅 지수 테이블에서 글자수가 항상 `~{charCount}자` (추정치) 형태로 표시.
스크래핑으로 실제 본문 글자수를 얻었어도 "~" 접두사가 붙어 구분 불가.
색상 기준도 description 기반(300자↑) 고정.

**수정**:
- `isScrapped === true`: 접두사 없이 `{charCount}자` + ✓ 아이콘, 색상 기준 **1500자↑** 녹색
- `isScrapped === false/undefined`: 기존대로 `~{charCount}자`, 색상 기준 **300자↑** 녹색  
- tooltip도 "실제 본문 스크래핑 기준" / "RSS 미리보기 기준(추정치)"로 구분

### ✅ 3. `BenchmarkData` 타입 동기화 (심각도: 중간)

**문제**: 백엔드 `types.ts`에 추가된 `keywordDensity`와 `avgImageCount` 필드가 프론트에 없음.

**수정**: 두 필드를 optional로 추가
```typescript
keywordDensity?: { mine: number; optimal: [number, number] }
avgImageCount?: { mine: number; recommended: number }
```

### ✅ 4. `postAnalysis.avgImageCount` 누락 (심각도: 중간)

**문제**: 백엔드에서 보내는 `avgImageCount`가 프론트 타입에 없음.

**수정**: `avgImageCount?: number` 추가

### ✅ 5. `AbusePenalty` 프론트 타입 없음 (심각도: 중간)

**문제**: 백엔드에서 어뷰징 페널티 결과를 전달하지만, 프론트에 타입 자체가 없음.

**수정**: `AbusePenalty` 인터페이스 정의 + `BlogIndexResult`에 `abusePenalty?: AbusePenalty` 추가
*(UI 표시는 현재 AI 분석 카드의 abuseRisk에서 커버하므로 별도 UI 추가 보류)*

### ✅ 6. 품질 점수 `/10` → `/12` 정정 (심각도: 중간)

**문제**: scoring.ts가 v2에서 0~12점 체계로 변경되었으나, 포스팅 서머리에서 여전히 `/10` 표시.

**수정**: `평균 품질` 표시를 `/12`로 변경

---

## 빌드 결과

- ✅ TypeScript 컴파일 에러: **0건**

---

## 향후 검토 사항

| 항목 | 설명 | 우선순위 |
|------|------|---------|
| abusePenalty UI 카드 | 어뷰징 페널티를 별도 카드로 시각화 | 🟡 중간 |
| 스크래핑 성공률 표시 | 서머리에 "스크래핑 성공 X/Y개" 추가 | 🟢 낮음 |
| content-quality.ts에 scrapedData 전달 | 30점 콘텐츠 품질 분석에 실제 본문 데이터 활용 | 🟡 중간 |
| 메타 데이터 UI 표시 | 태그, OG 데이터, 링크 분석 결과를 포스트 상세에 표시 | 🟢 낮음 |
