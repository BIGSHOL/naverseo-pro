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

// ===== 16단계 키워드 등급 체계 (SEO/블로그 지수와 통일) =====
// Lv.1 (최하) ~ Lv.16 (최상)

export interface KeywordGrade {
  level: number        // 1~16
  category: '비추' | '보통' | '준최' | '최적'
  label: string        // 'Lv.16'
  fullLabel: string    // 'Lv.16 최적'
  tier: number         // 카테고리 내 세부 등급 (1~4)
  color: string
  bgColor: string
}

import { GRADE_BADGES } from '@/lib/seo/grade-constants'

export function getKeywordGrade(score: number): KeywordGrade {
  if (score >= 95) return { level: 16, category: '최적', label: 'Lv.16 파워', fullLabel: 'Lv.16 파워', tier: 1, color: 'text-amber-700', bgColor: GRADE_BADGES[16] }
  if (score >= 89) return { level: 15, category: '최적', label: 'Lv.15 최적화4+', fullLabel: 'Lv.15 최적화4+', tier: 2, color: 'text-emerald-700', bgColor: GRADE_BADGES[15] }
  if (score >= 82) return { level: 14, category: '최적', label: 'Lv.14 최적화3+', fullLabel: 'Lv.14 최적화3+', tier: 3, color: 'text-emerald-700', bgColor: GRADE_BADGES[14] }
  if (score >= 76) return { level: 13, category: '최적', label: 'Lv.13 최적화2+', fullLabel: 'Lv.13 최적화2+', tier: 4, color: 'text-teal-700', bgColor: GRADE_BADGES[13] }
  if (score >= 70) return { level: 12, category: '최적', label: 'Lv.12 최적화1+', fullLabel: 'Lv.12 최적화1+', tier: 1, color: 'text-teal-700', bgColor: GRADE_BADGES[12] }
  if (score >= 64) return { level: 11, category: '최적', label: 'Lv.11 최적화3', fullLabel: 'Lv.11 최적화3', tier: 2, color: 'text-green-700', bgColor: GRADE_BADGES[11] }
  if (score >= 57) return { level: 10, category: '최적', label: 'Lv.10 최적화2', fullLabel: 'Lv.10 최적화2', tier: 3, color: 'text-green-700', bgColor: GRADE_BADGES[10] }
  if (score >= 51) return { level: 9, category: '최적', label: 'Lv.9 최적화1', fullLabel: 'Lv.9 최적화1', tier: 4, color: 'text-lime-700', bgColor: GRADE_BADGES[9] }
  if (score >= 45) return { level: 8, category: '준최', label: 'Lv.8 준최적화7', fullLabel: 'Lv.8 준최적화7', tier: 1, color: 'text-blue-700', bgColor: GRADE_BADGES[8] }
  if (score >= 38) return { level: 7, category: '준최', label: 'Lv.7 준최적화6', fullLabel: 'Lv.7 준최적화6', tier: 2, color: 'text-blue-700', bgColor: GRADE_BADGES[7] }
  if (score >= 32) return { level: 6, category: '준최', label: 'Lv.6 준최적화5', fullLabel: 'Lv.6 준최적화5', tier: 3, color: 'text-sky-700', bgColor: GRADE_BADGES[6] }
  if (score >= 26) return { level: 5, category: '준최', label: 'Lv.5 준최적화4', fullLabel: 'Lv.5 준최적화4', tier: 4, color: 'text-sky-700', bgColor: GRADE_BADGES[5] }
  if (score >= 20) return { level: 4, category: '준최', label: 'Lv.4 준최적화3', fullLabel: 'Lv.4 준최적화3', tier: 1, color: 'text-indigo-700', bgColor: GRADE_BADGES[4] }
  if (score >= 13) return { level: 3, category: '준최', label: 'Lv.3 준최적화2', fullLabel: 'Lv.3 준최적화2', tier: 2, color: 'text-indigo-700', bgColor: GRADE_BADGES[3] }
  if (score >= 7) return { level: 2, category: '준최', label: 'Lv.2 준최적화1', fullLabel: 'Lv.2 준최적화1', tier: 3, color: 'text-violet-700', bgColor: GRADE_BADGES[2] }
  return { level: 1, category: '보통', label: 'Lv.1 일반', fullLabel: 'Lv.1 일반', tier: 4, color: 'text-slate-700', bgColor: GRADE_BADGES[1] }
}

// ===== 숫자 포맷 =====

export function formatNumber(num: number): string {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}만`
  return num.toLocaleString()
}
