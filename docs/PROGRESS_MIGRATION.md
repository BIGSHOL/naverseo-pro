# Progress 시스템 마이그레이션 가이드

기존의 중복되고 일관성 없는 Progress 코드를 새로운 통합 시스템으로 마이그레이션하는 방법입니다.

## 📋 목차

1. [개요](#개요)
2. [새로운 시스템 구조](#새로운-시스템-구조)
3. [마이그레이션 패턴](#마이그레이션-패턴)
4. [페이지별 마이그레이션 예제](#페이지별-마이그레이션-예제)
5. [체크리스트](#체크리스트)

---

## 개요

### 기존 문제점

❌ **6가지 다른 Progress State 구조**
```tsx
// keywords 페이지
const [progress, setProgress] = useState<SearchProgress | null>(null)

// keywords-bulk 페이지
const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' })

// seo-check 페이지
const [progressStep, setProgressStep] = useState<ProgressStep | null>(null)

// competitors 페이지
const [progressStep, setProgressStep] = useState(0)
const [progressTotal, setProgressTotal] = useState(0)
const [progressMessage, setProgressMessage] = useState('')
```

❌ **SSE 처리 로직 중복** (6개 페이지에서 동일 패턴 반복)

❌ **Progress 컴포넌트 저활용** (1곳만 사용)

### 새로운 시스템의 장점

✅ **통일된 타입 시스템** (`ProgressState`)
✅ **재사용 가능한 컴포넌트** (Inline/Card/FullPage)
✅ **SSE 처리 자동화** (`useSSEProgress` 훅)
✅ **유틸리티 함수** (percent 계산, 메시지 추출 등)

---

## 새로운 시스템 구조

### 1. 타입 시스템

```tsx
import type {
  StepProgress,      // { step: 2, totalSteps: 5, message: '...' }
  CountProgress,     // { current: 15, total: 100, message: '...' }
  PercentProgress,   // { percent: 45, message: '...' }
  ProgressState      // Union Type (위 3가지 중 하나 또는 null)
} from '@/lib/progress'
```

### 2. 컴포넌트

```tsx
import {
  InlineProgress,    // 버튼/작은 영역
  CardProgress,      // 카드/모달
  FullPageProgress   // 전체 화면 오버레이
} from '@/lib/progress'
```

### 3. 훅

```tsx
import { useSSEProgress } from '@/lib/progress'
```

### 4. 유틸리티

```tsx
import {
  getProgressPercent,   // 퍼센트 계산
  getProgressMessage,   // 메시지 추출
  getProgressDetail,    // 세부 정보 (2/5, 45% 등)
  isProgressComplete    // 완료 여부 확인
} from '@/lib/progress'
```

---

## 마이그레이션 패턴

### 패턴 1: 기본 Progress State 교체

#### Before
```tsx
const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' })

setProgress({ current: 1, total: 3, stage: '검색량 조회 중...' })
```

#### After
```tsx
import type { ProgressState } from '@/lib/progress'
import { createCountProgress } from '@/lib/progress'

const [progress, setProgress] = useState<ProgressState>(null)

setProgress(createCountProgress(1, 3, '검색량 조회 중...'))
```

---

### 패턴 2: SSE Progress 처리

#### Before (70줄 이상의 중복 코드)
```tsx
const [progress, setProgress] = useState<SearchProgress | null>(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')

const handleSearch = async () => {
  setLoading(true)
  setProgress({ step: 0, totalSteps: 3, message: '검색 준비 중...' })

  try {
    const response = await fetch('/api/keywords', {
      method: 'POST',
      // ...
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue
        const event = JSON.parse(line.replace('data: ', ''))

        if (event.type === 'progress') {
          setProgress(event.data)
        } else if (event.type === 'complete') {
          setResults(event.data)
          setLoading(false)
        }
      }
    }
  } catch (err) {
    setError(err.message)
    setLoading(false)
  }
}
```

#### After (훨씬 간결)
```tsx
import { useSSEProgress } from '@/lib/progress'

const { progress, data, loading, error, start } = useSSEProgress<KeywordResults>({
  onComplete: (results) => setResults(results),
  onError: (err) => toast.error(err),
})

const handleSearch = () => {
  start('/api/keywords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword }),
  })
}
```

---

### 패턴 3: Progress UI 표시

#### Before
```tsx
{loading && (
  <Card>
    <CardContent className="py-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="w-full max-w-xs space-y-2">
          <Progress
            value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
            className="h-2"
          />
          <p className="text-center text-sm text-muted-foreground">
            {progress.stage} ({progress.current}/{progress.total})
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

#### After
```tsx
import { CardProgress } from '@/lib/progress'

{loading && (
  <CardProgress
    progress={progress}
    options={{ showBar: true, showPercent: true, showDetail: true }}
  />
)}
```

---

## 페이지별 마이그레이션 예제

### 예제 1: keywords-bulk 페이지

#### Before
```tsx
const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' })

setProgress({ current: 0, total: 3, stage: '검색량 조회 중...' })
setProgress({ current: 1, total: 3, stage: '자동완성 확인 중...' })
setProgress({ current: 2, total: 3, stage: '인기글 분석 중...' })
setProgress({ current: 3, total: 3, stage: '완료!' })
```

#### After
```tsx
import type { ProgressState } from '@/lib/progress'
import { createCountProgress, CardProgress } from '@/lib/progress'

const [progress, setProgress] = useState<ProgressState>(null)

setProgress(createCountProgress(0, 3, '검색량 조회 중...'))
setProgress(createCountProgress(1, 3, '자동완성 확인 중...'))
setProgress(createCountProgress(2, 3, '인기글 분석 중...'))
setProgress(createCountProgress(3, 3, '완료!'))

// UI 렌더링
{loading && <CardProgress progress={progress} />}
```

---

### 예제 2: keywords 페이지 (SSE 사용)

#### Before (70줄+)
```tsx
const [progress, setProgress] = useState<SearchProgress | null>(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')

// 긴 SSE 처리 로직...
```

#### After (15줄)
```tsx
import { useSSEProgress, CardProgress } from '@/lib/progress'

const { progress, data, loading, error, start } = useSSEProgress<KeywordResults>({
  onComplete: (results) => {
    setResults(results)
    toast.success('검색 완료!')
  },
})

const handleSearch = () => {
  start('/api/ai/keywords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  })
}

// UI 렌더링
{loading && <CardProgress progress={progress} />}
```

---

### 예제 3: blog-index 페이지 (복잡한 Progress)

#### Before
```tsx
const [progress, setProgress] = useState<{
  step: number
  totalSteps: number
  message: string
  current?: number
  total?: number
} | null>(null)
```

#### After
```tsx
import type { ProgressState } from '@/lib/progress'
import { useSSEProgress, FullPageProgress } from '@/lib/progress'

const { progress, loading } = useSSEProgress<BlogIndexResult>({
  onProgress: (p) => console.log('진행률:', getProgressPercent(p)),
})

// 전체 화면 오버레이로 표시
{loading && <FullPageProgress progress={progress} overlay />}
```

---

## 체크리스트

마이그레이션 시 확인할 사항:

### 1단계: 타입 마이그레이션
- [ ] 기존 progress state 타입을 `ProgressState`로 교체
- [ ] 커스텀 progress 타입 제거 (SearchProgress, ProgressStep 등)

### 2단계: 로직 마이그레이션
- [ ] SSE 처리 코드를 `useSSEProgress` 훅으로 교체
- [ ] progress 업데이트 로직을 헬퍼 함수 사용으로 변경
- [ ] 퍼센트 계산 로직을 `getProgressPercent` 사용으로 교체

### 3단계: UI 마이그레이션
- [ ] 커스텀 Progress UI를 공통 컴포넌트로 교체
  - 인라인: `InlineProgress`
  - 카드/모달: `CardProgress`
  - 전체 화면: `FullPageProgress`
- [ ] 중복된 Loader2 + Progress 조합 제거

### 4단계: 테스트
- [ ] 진행률 표시가 정상 작동하는지 확인
- [ ] SSE 연결/해제가 정상 작동하는지 확인
- [ ] 에러 처리가 올바른지 확인
- [ ] 컴포넌트 언마운트 시 메모리 누수 없는지 확인

### 5단계: 정리
- [ ] 기존 progress 관련 타입 정의 삭제
- [ ] 사용하지 않는 progress 관련 코드 제거
- [ ] import 경로 정리 (`@/lib/progress`로 통일)

---

## 추가 팁

### 1. Progress 변형 사용
```tsx
<CardProgress
  progress={progress}
  options={{
    variant: 'success',  // 성공 색상
    size: 'lg',          // 큰 사이즈
    showBar: true,
    showPercent: true,
  }}
/>
```

### 2. 오버레이 Progress
```tsx
<FullPageProgress
  progress={progress}
  overlay              // 배경 어둡게
  dismissible          // 클릭으로 닫기 가능
  onDismiss={() => stop()}
/>
```

### 3. SSE 자동 재시도
```tsx
const { progress, start } = useSSEProgress({
  autoRetry: true,
  maxRetries: 3,
  onError: (err) => console.error('재시도 실패:', err),
})
```

---

## 마이그레이션 우선순위

권장 순서:

1. **keywords-bulk** (가장 간단, Progress 컴포넌트 이미 사용 중)
2. **keywords** (SSE 사용, 마이그레이션 효과 큼)
3. **opportunities** (SSE 사용)
4. **blog-index** (SSE 사용, 복잡한 Progress)
5. **seo-check** (SSE 사용)
6. **competitors** (별도 변수 분리 패턴)
7. **content** (ContentProgress 타입)

---

## 문의

마이그레이션 중 문제가 발생하면:
- `src/lib/progress/index.ts` - 전체 API 확인
- `src/types/progress.ts` - 타입 정의 확인
- `src/hooks/use-sse-progress.ts` - SSE 훅 구현 확인
