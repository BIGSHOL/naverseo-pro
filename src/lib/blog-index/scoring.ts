/**
 * 블로그 지수 - 개별 포스트 품질 지수 (v4 개선)
 *
 * v2:   0~12점 (제목 3 + 콘텐츠 3 + 이미지 3 + 구조 2 + 키워드 1)
 * v4:   0~15점 (제목 3 + 콘텐츠 3 + 이미지 3 + 구조 2 + 키워드 1 + 인기도 3)
 */

import type { PostQuality } from './types'

export function scorePost(
  title: string,
  descHtml: string,
  descLength: number,
  imageCount: number,
  isScrapped = false,
  commentCount?: number | null,
  sympathyCount?: number | null
): PostQuality {
  let score = 0

  // 제목 길이 (0~3점) - 15~40자가 최적
  const titleLen = title.length
  if (titleLen >= 15 && titleLen <= 40) score += 3
  else if (titleLen >= 10 && titleLen <= 50) score += 2
  else if (titleLen >= 5) score += 1

  // 콘텐츠 길이 (0~3점)
  if (isScrapped) {
    if (descLength >= 1500) score += 3
    else if (descLength >= 800) score += 2
    else if (descLength >= 300) score += 1
  } else {
    if (descLength >= 300) score += 3
    else if (descLength >= 150) score += 2
    else if (descLength >= 60) score += 1
  }

  // 이미지 (0~3점) - 개수 기반
  if (isScrapped) {
    if (imageCount >= 5) score += 3
    else if (imageCount >= 3) score += 2
    else if (imageCount >= 1) score += 1
  } else {
    if (imageCount >= 3) score += 3
    else if (imageCount >= 2) score += 2
    else if (imageCount >= 1) score += 1
  }

  // 구조/서식 (0~2점)
  const hasStructure = /[①②③④⑤]|[1-9]\.\s|•|▶|<b>|<strong>/.test(descHtml)
  const hasConcreteData = /\d+[만천백]?\s*원|₩\d|가격|\d+분|\d+km/.test(descHtml)
  if (hasStructure && hasConcreteData) score += 2
  else if (hasStructure || hasConcreteData) score += 1

  // 제목 키워드 포함 여부 (0~1점)
  if (/\d+/.test(title) || /추천|후기|방법|비교|정리|가이드|리뷰|TOP/i.test(title)) {
    score += 1
  }

  // 인기도 (0~3점, v4 신규) - 댓글+공감 합산 기준
  const engagement = (commentCount ?? 0) + (sympathyCount ?? 0)
  if (engagement >= 30) score += 3
  else if (engagement >= 10) score += 2
  else if (engagement >= 3) score += 1

  // score 0~15 → 16등급 매핑 (v7: 블로그 지수와 동일한 16등급 체계)
  let tier: number
  let category: string
  let label: string

  if (score >= 15) { tier = 16; category = '파워'; label = '파워' }
  else if (score >= 14) { tier = 15; category = '최적화+'; label = '최적화4+' }
  else if (score >= 13) { tier = 14; category = '최적화+'; label = '최적화3+' }
  else if (score >= 12) { tier = 13; category = '최적화+'; label = '최적화2+' }
  else if (score >= 11) { tier = 12; category = '최적화+'; label = '최적화1+' }
  else if (score >= 10) { tier = 11; category = '최적화'; label = '최적화3' }
  else if (score >= 9) { tier = 10; category = '최적화'; label = '최적화2' }
  else if (score >= 8) { tier = 9; category = '최적화'; label = '최적화1' }
  else if (score >= 7) { tier = 8; category = '준최적화'; label = '준최적화7' }
  else if (score >= 6) { tier = 7; category = '준최적화'; label = '준최적화6' }
  else if (score >= 5) { tier = 6; category = '준최적화'; label = '준최적화5' }
  else if (score >= 4) { tier = 5; category = '준최적화'; label = '준최적화4' }
  else if (score >= 3) { tier = 4; category = '준최적화'; label = '준최적화3' }
  else if (score >= 2) { tier = 3; category = '준최적화'; label = '준최적화2' }
  else if (score >= 1) { tier = 2; category = '준최적화'; label = '준최적화1' }
  else { tier = 1; category = '일반'; label = '일반' }

  return { score, tier, label, category }
}
