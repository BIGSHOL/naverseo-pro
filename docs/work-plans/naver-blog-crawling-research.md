# 네이버 블로그 크롤링 연구 보고서

> **작성일**: 2026-02-22  
> **프로젝트**: NaverSEO Pro  
> **상태**: ✅ 구현 완료

---

## 1. 목표

네이버 블로그 콘텐츠 수집 방법을 체계화하고, 블로그 지수 분석의 정확도를 높이기 위한 크롤링 파이프라인을 구축한다.

---

## 2. 크롤링 방법 비교

| 방법 | 장점 | 단점 | 채택 |
|------|------|------|------|
| **네이버 검색 API** | 안정적, 공식 API, 순위 데이터 | description 180자 제한 | ✅ 기존 |
| **RSS 피드** | 인증 불필요, 정확한 포스트 목록 | 포스트 수 제한 (10~30개) | ✅ 기존+확장 |
| **모바일 HTML 파싱** | 실제 본문 데이터, 가벼운 HTML | 차단 위험, 네이버 정책 변경 | ✅ 구현 완료 |
| **Headless Browser** | 동적 콘텐츠, 댓글/좋아요 | Vercel 비호환, 리소스 과다 | ❌ 보류 |
| **외부 크롤링 서비스** | 안정적, CAPTCHA 처리 | 비용 과다, 의존성 | ❌ 불채택 |

---

## 3. 구현 현황 (전체 완료)

### 3.1 ✅ 과제 1: Rate Limiting (blog-scraper.ts)

**변경 내용:**
- `Promise.allSettled()` 병렬 요청 → **순차 요청 + 500ms 딜레이**로 변경
- **429 Too Many Requests** 응답 시 백오프 재시도 (2초, 4초)
- 최대 재시도 2회, 타임아웃 3초→4초 확대
- User-Agent를 iOS 17로 업데이트

**핵심 코드:**
```typescript
// scrapeMultiplePosts: 순차 스크래핑
for (let i = 0; i < uncached.length; i++) {
  const result = await scrapeBlogPost(link)
  if (i < uncached.length - 1) await delay(500)
}

// scrapeBlogPost: 429 백오프 재시도
if (res.status === 429) {
  const backoffMs = 2000 * (attempt + 1)
  await delay(backoffMs)
  continue
}
```

### 3.2 ✅ 과제 2: 크롤링 캐시 (crawl-cache.ts)

**새 파일:** `src/lib/naver/crawl-cache.ts`

**기능:**
- 인메모리 캐시 (Map 기반) - 서버리스 환경 호환
- **TTL: 24시간** - 동일 URL 재요청 방지
- **최대 500건** 저장, LRU 기반 자동 정리
- `checkCrawlCacheBatch()` - 배치 캐시 조회 지원
- `getCrawlCacheStats()` - 디버그용 통계

**파이프라인:**
```
1. 캐시에서 먼저 조회 → 히트된 URL은 스킵
2. 캐시 미스만 순차 크롤링 (Rate Limiting 적용)
3. 크롤링 성공 시 캐시에 저장
```

### 3.3 ✅ 과제 3: RSS 피드 모듈 (blog-rss.ts)

**새 파일:** `src/lib/naver/blog-rss.ts`

**기능:**
| 함수 | 설명 |
|------|------|
| `fetchBlogRss(blogId)` | 단일 블로그 RSS 조회 (5초 타임아웃) |
| `fetchMultipleBlogRss(blogIds)` | 복수 블로그 병렬 조회 (경쟁 분석용) |
| `analyzePostingFrequency(rssResult)` | 포스팅 빈도 분석 (주간/월간, 규칙성 판단) |

**활용 시나리오:**
- 경쟁 블로그의 포스팅 빈도 모니터링
- 콘텐츠 캘린더에서 경쟁사 발행 일정 확인
- 블로그 활동성 정량 평가 (very-regular / regular / irregular / inactive)

### 3.4 ✅ 과제 4: 태그/링크 추출 (post-meta-extractor.ts)

**새 파일:** `src/lib/naver/post-meta-extractor.ts`

**추출 기능:**
| 함수 | 추출 데이터 |
|------|------------|
| `extractTags(html)` | 해시태그, 포스트 태그, meta keywords (최대 30개) |
| `extractCategory(html)` | 블로그 카테고리, article:section |
| `analyzeLinks(html, blogId)` | 내부/외부 링크, 네이버 지도/쇼핑/유튜브 감지 |
| `extractOpenGraph(html)` | OG title/description/image/type/url |
| `extractPostMetaData(html, blogId)` | 위 모든 데이터 통합 추출 |

**blog-scraper.ts 통합:**
```typescript
const result = await scrapeBlogPost(link, {
  extractMeta: true,        // 메타 데이터 추출 활성화
  blogId: 'myblog123',      // 내부 링크 판별용
})
// result.meta?.tags → ["맛집추천", "서울카페", ...]
// result.meta?.linkAnalysis.hasNaverMap → true
```

---

## 4. 파일 구조

```
src/lib/naver/
├── blog-scraper.ts         ← 본문 스크래퍼 (Rate Limiting + 캐시 + 메타 추출)
├── crawl-cache.ts          ← 인메모리 크롤링 캐시 (24h TTL)
├── blog-rss.ts             ← RSS 피드 모듈 (빈도 분석 포함)
├── post-meta-extractor.ts  ← 태그/카테고리/링크/OG 추출
├── blog-fetch.ts           ← 기존 블로그 HTML 파서
├── blog-search.ts          ← 네이버 검색 API (순위 추적)
├── search-ad.ts            ← 검색광고 API (키워드 통계)
├── search-enrichment.ts    ← 검색 결과 보강
├── visitor-stats.ts        ← 방문자 통계
└── datalab.ts              ← 네이버 데이터랩
```

---

## 5. engine.ts / scoring.ts 통합

### engine.ts
- `analyzeBlogIndex()` 함수에 `scrapedData` 파라미터 복원
- 스크래핑 데이터 우선 사용 → description 폴백
- `PostDetail.isScrapped` 플래그로 데이터 출처 구분

### scoring.ts
- `scorePost()` 함수에 `isScrapped` 파라미터 추가
- **실제 본문 기준**: 1500자↑ = 만점, 800자↑ = 2점, 이미지 5장↑ = 만점
- **API 요약 기준**: 300자↑ = 만점, 150자↑ = 2점 (기존 로직 유지)

### route.ts (API 라우트)
- 6단계 파이프라인에 본문 스크래핑 단계 재통합
- `extractMeta: true` 옵션으로 태그/링크 분석 활성화

---

## 6. 데이터 흐름 (전체 파이프라인)

```
사용자 요청 (blogUrl, keywords)
  ↓
1단계: 블로그 포스트 수집 (RSS 우선, 검색 API 폴백)
  ↓
2단계: 키워드 결정 (사용자 입력 또는 자동 추출)
  ↓
3단계: 키워드별 순위 체크 (검색 API)
  ↓
4단계: 키워드 경쟁도 조회 (검색광고 API)
  ↓
5단계: 방문자 데이터 조회 (XML API)
  ↓
6단계: 본문 스크래핑 [NEW] ← blog-scraper.ts
  ├── 캐시 히트 → 즉시 반환 (crawl-cache.ts)
  ├── 캐시 미스 → 순차 크롤링 (500ms 딜레이)
  ├── 메타 추출 → 태그/링크 분석 (post-meta-extractor.ts)
  └── 결과 캐시 저장 (24시간 TTL)
  ↓
7단계: 4축 블로그 지수 분석 (engine.ts + scoring.ts)
  ├── 스크래핑 데이터 우선 → description 폴백
  └── isScrapped 기반 점수 차등 적용
  ↓
8단계: AI 심층 분석 (v2.5)
  ↓
결과 반환
```

---

## 7. 향후 개선 사항

| 우선순위 | 항목 | 설명 |
|---------|------|------|
| 🟡 중간 | Supabase 영구 캐시 | 인메모리 → DB 전환 (서버 재시작 간 캐시 유지) |
| 🟡 중간 | 경쟁 블로그 모니터링 UI | `fetchMultipleBlogRss()` 활용 대시보드 |
| 🟢 낮음 | Headless Browser 서버 | 댓글/좋아요 수집 (별도 서버 필요) |
| 🟢 낮음 | 네이버 AI 검색 대응 | AuthGR, Next N Search 알고리즘 변화 모니터링 |

---

## 8. 컴플라이언스

- ✅ 네이버 공식 API 우선 사용
- ✅ robots.txt 준수 (모바일 블로그 페이지)
- ✅ Rate Limiting (500ms) + 429 백오프 적용
- ✅ 캐시로 불필요한 반복 요청 최소화
- ⚠️ 대규모 크롤링 시 네이버 이용약관 확인 필요
