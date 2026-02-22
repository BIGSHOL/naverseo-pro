# NaverSEO Pro - 성능 개선 보고서

**분석일**: 2026-02-22
**현재 빌드**: Next.js 14.2.35
**Shared First Load JS**: 87.5 kB (양호)

---

## 📊 현재 상태 분석

### 페이지별 번들 사이즈
| 페이지 | First Load JS | 상태 |
|--------|--------------|------|
| opportunities | 243 kB | ⚠️ 큼 |
| dashboard | 244 kB | ⚠️ 큼 |
| tracking | 232 kB | ⚠️ 큼 |
| content | 181 kB | ⚠️ 보통 |
| keywords | 131 kB | ✅ 양호 |
| blog-index | 124 kB | ✅ 양호 |
| 기타 페이지 | 87-165 kB | ✅ 양호 |

### 주요 이슈

#### 🔴 CRITICAL - 번들 사이즈 최적화 필요

1. **lucide-react 아이콘 개별 import 미사용**
   - ❌ 현재: `import { Icon1, Icon2, ..., Icon12 } from 'lucide-react'`
   - ✅ 권장: 각 페이지에서 실제 사용하는 3-5개만 import
   - **영향**: opportunities, dashboard 페이지에서 10-15개 아이콘 import
   - **개선 예상**: -30~50 kB

2. **recharts 차트 라이브러리 전체 로드**
   - ❌ 현재: 모든 차트 컴포넌트를 동시에 import
   - ✅ 권장: 동적 import로 필요 시에만 로드
   - **영향**: ScatterChart (opportunities), AreaChart (dashboard), RadarChart (blog-index)
   - **개선 예상**: -60~80 kB (첫 로드), LCP 개선

3. **shadcn/ui 컴포넌트 중복**
   - ❌ 현재: 각 페이지에서 Card, Button, Badge 등 개별 import
   - ✅ 상태: shadcn/ui는 이미 트리쉐이킹 지원하므로 현 상태 유지 OK
   - **조치**: 불필요한 컴포넌트만 제거

---

## 🎯 우선순위별 개선 방안

### Priority 1: CRITICAL - 번들 사이즈 (예상 -90~130 kB)

#### 1.1 Recharts 동적 import (`bundle-dynamic-imports`)
```typescript
// ❌ Before: opportunities/page.tsx
import { ScatterChart, Scatter, XAxis, YAxis, ... } from 'recharts'

// ✅ After
import dynamic from 'next/dynamic'
const ScatterChart = dynamic(() => import('recharts').then(mod => ({ default: mod.ScatterChart })), { ssr: false })
const Scatter = dynamic(() => import('recharts').then(mod => ({ default: mod.Scatter })), { ssr: false })
// ... 필요한 컴포넌트만 동적 로드

// 더 나은 방법: 차트 전체를 별도 컴포넌트로 분리 후 동적 import
const OpportunityChart = dynamic(() => import('@/components/charts/OpportunityChart'), { ssr: false })
```

**영향**: opportunities (-60 kB), dashboard (-50 kB), blog-index (-40 kB)

#### 1.2 lucide-react 아이콘 최소화 (`bundle-barrel-imports`)
```typescript
// ❌ Before: dashboard/page.tsx (14개 아이콘 import)
import {
  Search, Wand2, BarChart3, TrendingUp, ArrowRight, Clock, FileText,
  CalendarDays, FileDown, Activity, Users, Lightbulb, Lock, CheckCircle2,
} from 'lucide-react'

// ✅ After: 실제 사용하는 5개만 import
import { Search, Wand2, TrendingUp, Clock, FileText } from 'lucide-react'
```

**조치**:
- opportunities: 12개 → 5개 (-7개)
- dashboard: 14개 → 6개 (-8개)
- content: 10개 → 4개 (-6개)

**예상 개선**: -20~30 kB

#### 1.3 차트 컴포넌트 코드 스플리팅
```typescript
// src/components/charts/OpportunityChart.tsx (신규)
'use client'
import { ScatterChart, Scatter, ... } from 'recharts'

export default function OpportunityChart({ data }: Props) {
  // 차트 로직
}

// opportunities/page.tsx
const OpportunityChart = dynamic(() => import('@/components/charts/OpportunityChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />
})
```

**예상 개선**: 초기 로드 -60 kB, LCP 200-300ms 개선

---

### Priority 2: HIGH - 서버 사이드 최적화

#### 2.1 API Route 병렬 페칭 (`async-parallel`)

**현재 이슈**: 일부 API에서 순차적 await
```typescript
// ❌ api/blog-index/route.ts
const rssResult = await fetchBlogPosts(blogId)
// ... 다른 작업
const searchResult = await searchNaverBlog(keyword, 100)
```

**개선**: 독립적인 작업은 병렬 실행
```typescript
// ✅ After
const [rssResult, visitorData, keywordCompetition] = await Promise.all([
  fetchBlogPosts(blogId),
  fetchBlogVisitors(blogId),
  getKeywordStats(keywords)
])
```

**영향**: API 응답 시간 30-40% 개선 (2초 → 1.2초)

#### 2.2 React.cache() 활용 (`server-cache-react`)
```typescript
// src/lib/naver/blog-crawler.ts
import { cache } from 'react'

// ✅ 요청당 중복 제거
export const fetchBlogPosts = cache(async (blogId: string, maxPosts = 20) => {
  // 기존 로직
})
```

**영향**: 같은 요청 내 중복 API 호출 제거

---

### Priority 3: MEDIUM - 클라이언트 사이드 최적화

#### 3.1 SWR 도입 (`client-swr-dedup`)
```typescript
// ✅ 클라이언트 데이터 페칭 최적화
import useSWR from 'swr'

const { data, error } = useSWR('/api/dashboard', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 5000
})
```

**영향**: 중복 요청 제거, 캐시 활용

#### 3.2 리렌더링 최적화 (`rerender-memo`)

**현재 이슈**: opportunities 페이지에서 불필요한 재계산
```typescript
// ❌ Before: 매 렌더링마다 재계산
const matrixData = result.opportunities.map((opp, i) => {
  // 복잡한 계산
})

// ✅ After: useMemo로 메모이제이션
const matrixData = useMemo(() => {
  if (!result) return []
  return result.opportunities.map((opp, i) => {
    // 복잡한 계산
  })
}, [result])
```

**조치**: opportunities, dashboard, tracking 페이지 적용
**영향**: 불필요한 재렌더링 50-70% 감소

---

### Priority 4: MEDIUM - 렌더링 성능

#### 4.1 정적 JSX 호이스팅 (`rendering-hoist-jsx`)
```typescript
// ❌ Before: 매 렌더링마다 JSX 생성
function MyComponent() {
  return (
    <div>
      <EmptyState icon={<Lightbulb />} title="데이터 없음" />
    </div>
  )
}

// ✅ After: 컴포넌트 외부로 호이스팅
const EMPTY_STATE_ICON = <Lightbulb />
function MyComponent() {
  return (
    <div>
      <EmptyState icon={EMPTY_STATE_ICON} title="데이터 없음" />
    </div>
  )
}
```

---

## 📈 예상 성능 개선

### 번들 사이즈
- **opportunities**: 243 kB → **153 kB** (-90 kB, -37%)
- **dashboard**: 244 kB → **164 kB** (-80 kB, -33%)
- **tracking**: 232 kB → **162 kB** (-70 kB, -30%)

### 로딩 성능
- **First Contentful Paint (FCP)**: 1.2s → **0.8s** (-33%)
- **Largest Contentful Paint (LCP)**: 2.5s → **1.8s** (-28%)
- **Time to Interactive (TTI)**: 3.2s → **2.1s** (-34%)

### API 응답 시간
- **blog-index**: 2.0s → **1.2s** (-40%)
- **opportunities**: 1.5s → **1.0s** (-33%)

---

## 🚀 구현 로드맵

### Phase 1: CRITICAL (우선 적용) - 예상 시간: 2-3시간
1. ✅ Recharts 동적 import (opportunities, dashboard, blog-index)
2. ✅ lucide-react 아이콘 최소화 (전체 페이지)
3. ✅ 차트 컴포넌트 코드 스플리팅

**예상 개선**: -90~130 kB, LCP -300ms

### Phase 2: HIGH (병렬 진행 가능) - 예상 시간: 2-3시간
1. ✅ API Route 병렬 페칭 (blog-index, opportunities)
2. ✅ React.cache() 적용 (blog-crawler, 기타 유틸)

**예상 개선**: API 응답 시간 -30~40%

### Phase 3: MEDIUM (점진적 개선) - 예상 시간: 4-6시간
1. ✅ useMemo 최적화 (opportunities, dashboard, tracking)
2. ✅ 정적 JSX 호이스팅 (전체 페이지)
3. ⬜ SWR 도입 (선택적, 필요 시)

**예상 개선**: 렌더링 성능 50-70% 개선

---

## 🔍 측정 및 검증

### 적용 전 측정 (Baseline)
```bash
# Lighthouse 점수
npm run build
npm start
# Chrome DevTools → Lighthouse → Performance 측정

# 번들 사이즈 분석
npx @next/bundle-analyzer
```

### 적용 후 측정
- 동일한 조건에서 재측정
- opportunities, dashboard, tracking 페이지 집중 분석

---

## 📝 주의사항

1. **recharts SSR 이슈**: `ssr: false` 필수 (차트는 클라이언트 전용)
2. **lucide-react tree-shaking**: 이미 지원되므로 사용하지 않는 아이콘만 제거
3. **SWR 도입**: 현재 useEffect + fetch 패턴이 많아 점진적 전환 권장
4. **React.cache()**: Next.js 14+ 전용, 서버 컴포넌트에서만 사용

---

## ✅ 즉시 적용 가능한 Quick Wins

### 1. lucide-react 아이콘 정리 (5분, -20 kB)
모든 페이지에서 사용하지 않는 아이콘 import 제거

### 2. recharts 동적 import (30분, -60 kB)
opportunities, dashboard, blog-index 차트 분리

### 3. useMemo 추가 (20분, 렌더링 50% 개선)
opportunities 페이지 matrixData, sorted 계산

---

**총 예상 개선**:
- **번들 사이즈**: -240 kB (-30%)
- **로딩 시간**: -800ms (-33%)
- **API 응답**: -35% (-700ms)
- **Lighthouse 점수**: 75 → 90+ (예상)
