import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// ===== 경쟁도 툴팁 =====

const COMP_TOOLTIPS: Record<string, string> = {
  HIGH: '광고 경쟁이 치열합니다. 상위 노출 난이도가 높습니다',
  MEDIUM: '적절한 경쟁 수준입니다. 양질의 콘텐츠로 승부 가능합니다',
  LOW: '경쟁이 적어 상위 노출 가능성이 높습니다',
  '-': '검색량이 적어 네이버에서 경쟁도 데이터를 제공하지 않습니다',
}

// ===== 카테고리 툴팁 =====

const CATEGORY_TOOLTIPS: Record<string, string> = {
  '정보형': '지식/정보를 찾는 검색 의도입니다',
  '비교형': '제품/서비스를 비교하려는 검색 의도입니다',
  '구매형': '구매 결정 직전의 검색 의도입니다',
  '경험형': '실제 경험/후기를 찾는 검색 의도입니다',
}

// ===== 경쟁도 배지 =====

export function getCompBadge(compIdx: string) {
  const badge = (() => {
    switch (compIdx) {
      case 'HIGH':
        return <Badge variant="destructive" className="text-xs">높음</Badge>
      case 'MEDIUM':
        return <Badge variant="secondary" className="text-xs">보통</Badge>
      case 'LOW':
        return <Badge className="bg-green-100 text-green-700 text-xs hover:bg-green-100">낮음</Badge>
      default:
        return <Badge variant="outline" className="text-xs text-muted-foreground">미확인</Badge>
    }
  })()

  const tip = COMP_TOOLTIPS[compIdx]
  if (!tip) return badge

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent><p>{tip}</p></TooltipContent>
    </Tooltip>
  )
}

// ===== 카테고리 배지 =====

export function getCategoryBadge(category: string) {
  const colors: Record<string, string> = {
    '정보형': 'bg-blue-100 text-blue-700',
    '비교형': 'bg-purple-100 text-purple-700',
    '구매형': 'bg-orange-100 text-orange-700',
    '경험형': 'bg-pink-100 text-pink-700',
  }
  const badge = (
    <Badge className={`text-xs ${colors[category] || 'bg-gray-100 text-gray-700'} hover:opacity-80`}>
      {category}
    </Badge>
  )

  const tip = CATEGORY_TOOLTIPS[category]
  if (!tip) return badge

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent><p>{tip}</p></TooltipContent>
    </Tooltip>
  )
}

// ===== 점수 색상/툴팁 =====

export function getScoreColor(score: number, textOnly = false): string {
  if (textOnly) {
    if (score >= 70) return 'text-green-600'
    if (score >= 40) return 'text-amber-600'
    return 'text-red-600'
  }
  if (score >= 70) return 'text-green-600 bg-green-50'
  if (score >= 40) return 'text-yellow-600 bg-yellow-50'
  return 'text-red-600 bg-red-50'
}

export function getScoreTooltip(score: number): string {
  if (score >= 70) return '블로그 상위 노출 가능성이 높은 추천 키워드입니다'
  if (score >= 40) return '경쟁에 따라 상위 노출 가능한 키워드입니다'
  return '경쟁이 높거나 검색량이 부족한 키워드입니다'
}

// ===== 포화지수 배지 =====

const SATURATION_TOOLTIPS: Record<string, string> = {
  '여유': '광고 경쟁이 적은 틈새 키워드입니다. 진입 난이도가 낮습니다',
  '보통': '적절한 경쟁 수준입니다. 꾸준한 포스팅으로 상위 노출 가능합니다',
  '포화': '경쟁이 치열한 키워드입니다. 차별화된 콘텐츠가 필요합니다',
  '과포화': '매우 치열한 레드오션입니다. 롱테일 키워드를 추천합니다',
}

function getSaturationLevel(plAvgDepth: number): string {
  if (plAvgDepth <= 2) return '여유'
  if (plAvgDepth <= 6) return '보통'
  if (plAvgDepth <= 11) return '포화'
  return '과포화'
}

export function getSaturationBadge(plAvgDepth: number) {
  const level = getSaturationLevel(plAvgDepth)
  const badge = (() => {
    switch (level) {
      case '여유':
        return <Badge className="bg-green-100 text-green-700 text-xs hover:bg-green-100">여유</Badge>
      case '보통':
        return <Badge className="bg-yellow-100 text-yellow-700 text-xs hover:bg-yellow-100">보통</Badge>
      case '포화':
        return <Badge className="bg-orange-100 text-orange-700 text-xs hover:bg-orange-100">포화</Badge>
      case '과포화':
        return <Badge variant="destructive" className="text-xs">과포화</Badge>
      default:
        return <Badge variant="outline" className="text-xs text-muted-foreground">미확인</Badge>
    }
  })()

  const tip = SATURATION_TOOLTIPS[level]
  if (!tip) return badge

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent><p>{tip}</p></TooltipContent>
    </Tooltip>
  )
}

// ===== 16등급 키워드 등급 체계 =====
// 점수(0~100)를 4단계 × 4등급 = 16등급으로 분류

export interface KeywordGrade {
  label: string
  category: '최적' | '준최' | '보통' | '비추'
  color: string
  bgColor: string
}

export function getKeywordGrade(score: number): KeywordGrade {
  // 최적 (62~100): 상위 노출 가능성 높은 추천 키워드
  if (score >= 85) return { label: '최적1', category: '최적', color: 'text-emerald-700', bgColor: 'bg-emerald-100' }
  if (score >= 75) return { label: '최적2', category: '최적', color: 'text-emerald-600', bgColor: 'bg-emerald-50' }
  if (score >= 68) return { label: '최적3', category: '최적', color: 'text-green-600', bgColor: 'bg-green-50' }
  if (score >= 62) return { label: '최적4', category: '최적', color: 'text-green-500', bgColor: 'bg-green-50' }
  // 준최적 (45~61): 조건부 추천 키워드
  if (score >= 57) return { label: '준최1', category: '준최', color: 'text-blue-700', bgColor: 'bg-blue-100' }
  if (score >= 53) return { label: '준최2', category: '준최', color: 'text-blue-600', bgColor: 'bg-blue-50' }
  if (score >= 49) return { label: '준최3', category: '준최', color: 'text-blue-500', bgColor: 'bg-blue-50' }
  if (score >= 45) return { label: '준최4', category: '준최', color: 'text-sky-600', bgColor: 'bg-sky-50' }
  // 보통 (29~44): 일반 키워드
  if (score >= 41) return { label: '보통1', category: '보통', color: 'text-yellow-700', bgColor: 'bg-yellow-100' }
  if (score >= 37) return { label: '보통2', category: '보통', color: 'text-yellow-600', bgColor: 'bg-yellow-50' }
  if (score >= 33) return { label: '보통3', category: '보통', color: 'text-amber-600', bgColor: 'bg-amber-50' }
  if (score >= 29) return { label: '보통4', category: '보통', color: 'text-amber-500', bgColor: 'bg-amber-50' }
  // 비추 (0~28): 비추천 키워드
  if (score >= 24) return { label: '비추1', category: '비추', color: 'text-orange-600', bgColor: 'bg-orange-50' }
  if (score >= 18) return { label: '비추2', category: '비추', color: 'text-red-500', bgColor: 'bg-red-50' }
  if (score >= 11) return { label: '비추3', category: '비추', color: 'text-red-600', bgColor: 'bg-red-100' }
  return { label: '비추4', category: '비추', color: 'text-red-700', bgColor: 'bg-red-100' }
}

// ===== 숫자 포맷 =====

export function formatNumber(num: number): string {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}만`
  return num.toLocaleString()
}
