import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// ===== 경쟁도 툴팁 =====

const COMP_TOOLTIPS: Record<string, string> = {
  HIGH: '광고 경쟁이 치열합니다. 상위 노출 난이도가 높습니다',
  MEDIUM: '적절한 경쟁 수준입니다. 양질의 콘텐츠로 승부 가능합니다',
  LOW: '경쟁이 적어 상위 노출 가능성이 높습니다',
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
        return <Badge variant="outline" className="text-xs">-</Badge>
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

export function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600 bg-green-50'
  if (score >= 40) return 'text-yellow-600 bg-yellow-50'
  return 'text-red-600 bg-red-50'
}

export function getScoreTooltip(score: number): string {
  if (score >= 70) return '블로그 상위 노출 가능성이 높은 추천 키워드입니다'
  if (score >= 40) return '경쟁에 따라 상위 노출 가능한 키워드입니다'
  return '경쟁이 높거나 검색량이 부족한 키워드입니다'
}

// ===== 숫자 포맷 =====

export function formatNumber(num: number): string {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}만`
  return num.toLocaleString()
}
