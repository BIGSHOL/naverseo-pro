/**
 * 블로그 지수 - 축4. 사용자 반응 (25점)
 *
 * v17: 활동 신뢰도에서 5점 이관 (20→25). 방문자 수를 점수에 반영.
 * v18: 댓글/공감/이웃 중간 구간 세분화. 일반 블로그도 적정 점수 확보 가능.
 *
 * 댓글 참여(8) + 공감 참여(5) + 이웃/구독자(5) + 방문자 수(5) + 체류 시간(2) = 25점
 * 감점: 체류시간 저하 패턴(-1) + 광고성 콘텐츠 과다(-1) = -2
 *
 * 데이터 수집 실패 시 0점 (무상 점수 없음)
 */

import type { VisitorData, EngagementData, AnalysisCategory, BlogProfileData, PostDetail, ScoreItem } from '../types'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'

/** 광고성/제휴 키워드 패턴 */
const AD_KEYWORDS = [
  '제휴마케팅', '제휴링크', '쿠팡파트너스', '파트너스활동', '일정액의수수료',
  '소정의원고료', '원고료를제공', '업체로부터제공', '무상으로제공', '협찬',
  '광고포함', '유료광고', 'AD', '#광고', '#협찬', '#제공',
]

export function analyzePopularity(
  visitorData?: VisitorData | null,
  engagementData?: EngagementData | null,
  blogProfileData?: BlogProfileData | null,
  recentPosts?: PostDetail[] | null,
  scrapedData?: Map<string, ScrapedPostData> | null,
): AnalysisCategory {
  const maxScore = 25
  const details: string[] = []
  const items: ScoreItem[] = []
  let score = 0

  // === 일평균 방문자 수 (5점) === (v17: 신규 — 최근 30일 평균)
  let visitorPts = 0
  if (visitorData && visitorData.isAvailable) {
    const avg = visitorData.avgDailyVisitors
    const src = visitorData.source || 'api'
    const visitorLabel = src === 'history'
      ? `일평균 방문자 (${visitorData.historyDays}일)`
      : src === 'today' ? '오늘 방문자' : '일평균 방문자'

    if (avg >= 500) {
      visitorPts = 5
      details.push(`${visitorLabel}: ${avg.toLocaleString()}명 (최우수) (+5)`)
    } else if (avg >= 200) {
      visitorPts = 4
      details.push(`${visitorLabel}: ${avg.toLocaleString()}명 (우수) (+4)`)
    } else if (avg >= 80) {
      visitorPts = 3
      details.push(`${visitorLabel}: ${avg.toLocaleString()}명 (양호) (+3)`)
    } else if (avg >= 30) {
      visitorPts = 2
      details.push(`${visitorLabel}: ${avg.toLocaleString()}명 (보통) (+2)`)
    } else if (avg >= 10) {
      visitorPts = 1
      details.push(`${visitorLabel}: ${avg.toLocaleString()}명 (부족) (+1)`)
    } else {
      visitorPts = 0
      details.push(`${visitorLabel}: ${avg.toLocaleString()}명 (+0)`)
    }
    items.push({ label: `${visitorLabel} (${avg.toLocaleString()}명)`, points: visitorPts })
  } else {
    details.push('방문자 데이터 미제공 (+0)')
    items.push({ label: '방문자 데이터 미제공', points: 0 })
  }
  score += visitorPts

  // === 평균 댓글 수 (8점) === (v18: 중간 구간 세분화)
  let commentPts = 0
  if (engagementData && engagementData.isAvailable && engagementData.avgCommentCount !== null) {
    const avgComments = engagementData.avgCommentCount
    if (avgComments >= 20) {
      commentPts = 8
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (최우수) (+8)`)
    } else if (avgComments >= 10) {
      commentPts = 6
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (우수) (+6)`)
    } else if (avgComments >= 5) {
      commentPts = 4
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (양호) (+4)`)
    } else if (avgComments >= 3) {
      commentPts = 3
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (보통) (+3)`)
    } else if (avgComments >= 2) {
      commentPts = 2
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (보통) (+2)`)
    } else if (avgComments >= 1) {
      commentPts = 1
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (부족) (+1)`)
    } else {
      commentPts = 0
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (부족) (+0)`)
    }
    items.push({ label: `평균 댓글 (${avgComments.toFixed(1)}개)`, points: commentPts })
  } else {
    commentPts = 0
    details.push('댓글 데이터 미제공 (+0)')
    items.push({ label: '댓글 데이터 미제공', points: 0 })
  }
  score += commentPts

  // === 평균 공감 수 (5점) === (v18: 중간 구간 세분화)
  let sympathyPts = 0
  if (engagementData && engagementData.isAvailable && engagementData.avgSympathyCount !== null) {
    const avgSympathy = engagementData.avgSympathyCount
    if (avgSympathy >= 30) {
      sympathyPts = 5
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (최우수) (+5)`)
    } else if (avgSympathy >= 15) {
      sympathyPts = 4
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (우수) (+4)`)
    } else if (avgSympathy >= 8) {
      sympathyPts = 3
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (양호) (+3)`)
    } else if (avgSympathy >= 3) {
      sympathyPts = 2
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (보통) (+2)`)
    } else if (avgSympathy >= 1) {
      sympathyPts = 1
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (부족) (+1)`)
    } else {
      sympathyPts = 0
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (부족) (+0)`)
    }
    items.push({ label: `평균 공감 (${avgSympathy.toFixed(1)}개)`, points: sympathyPts })
  } else {
    sympathyPts = 0
    details.push('공감 데이터 미제공 (+0)')
    items.push({ label: '공감 데이터 미제공', points: 0 })
  }
  score += sympathyPts

  // === 이웃/구독자 수 (5점) === (v18: 중간 구간 세분화)
  let buddyPts = 0
  const buddyCount = blogProfileData?.buddyCount ?? blogProfileData?.subscriberCount ?? null
  if (buddyCount !== null) {
    if (buddyCount >= 2000) {
      buddyPts = 5
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (최우수) (+5)`)
    } else if (buddyCount >= 1000) {
      buddyPts = 4
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (우수) (+4)`)
    } else if (buddyCount >= 500) {
      buddyPts = 3
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (양호) (+3)`)
    } else if (buddyCount >= 200) {
      buddyPts = 2
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (보통) (+2)`)
    } else if (buddyCount >= 50) {
      buddyPts = 1
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (부족) (+1)`)
    } else {
      buddyPts = 0
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (부족) (+0)`)
    }
    items.push({ label: `이웃 (${buddyCount.toLocaleString()}명)`, points: buddyPts })
  } else {
    details.push('이웃 수 데이터 미제공 (+0)')
    items.push({ label: '이웃 데이터 미제공', points: 0 })
  }
  score += buddyPts

  // === 예상 체류 시간 (2점) ===
  let dwellPts = 0
  if (recentPosts && recentPosts.length > 0) {
    const withTime = recentPosts.filter(p => p.estimatedReadTimeSec != null)
    if (withTime.length > 0) {
      const avgSec = withTime.reduce((s, p) => s + p.estimatedReadTimeSec!, 0) / withTime.length
      const avgMin = avgSec / 60

      if (avgMin >= 8) {
        dwellPts = 2
        details.push(`예상 체류 시간: 평균 ${avgMin.toFixed(1)}분 (우수) (+2)`)
      } else if (avgMin >= 5) {
        dwellPts = 1
        details.push(`예상 체류 시간: 평균 ${avgMin.toFixed(1)}분 (양호) (+1)`)
      } else {
        details.push(`예상 체류 시간: 평균 ${avgMin.toFixed(1)}분 (부족 - 콘텐츠 깊이를 늘리세요) (+0)`)
      }
      items.push({ label: `예상 체류 시간 (${avgMin.toFixed(1)}분)`, points: dwellPts })
    }
  }
  score += dwellPts

  // === [감점] 체류시간 저하 패턴 (0 ~ -1) ===
  if (scrapedData && scrapedData.size >= 3) {
    const scrapedPosts = Array.from(scrapedData.values())
    const wallTextPosts = scrapedPosts.filter(p => {
      if (p.charCount < 1000) return false
      const estimatedParagraphs = Math.max(1, (p.imageCount || 0) + 1)
      const charsPerParagraph = p.charCount / estimatedParagraphs
      return charsPerParagraph >= 500 && p.imageCount <= 1
    }).length
    const wallTextRate = wallTextPosts / scrapedPosts.length

    if (wallTextRate >= 0.3) {
      score -= 1
      details.push(`벽 텍스트 패턴: ${Math.round(wallTextRate * 100)}%가 줄바꿈/이미지 없이 장문 (-1)`)
      items.push({ label: `벽 텍스트 (${Math.round(wallTextRate * 100)}%)`, points: -1 })
    }
  }

  // === [감점] 광고성/홍보성 콘텐츠 과다 (0 ~ -1) ===
  if (scrapedData && scrapedData.size >= 3) {
    const scrapedPosts = Array.from(scrapedData.values())
    let adPostCount = 0
    for (const p of scrapedPosts) {
      const tags = (p.meta?.tags || []).join(' ').replace(/\s/g, '').toLowerCase()
      const hasAdTag = AD_KEYWORDS.some(kw => tags.includes(kw.replace(/\s/g, '').toLowerCase()))
      const hasExcessiveExtLinks = (p.meta?.linkAnalysis?.externalCount || 0) >= 3
      if (hasAdTag || (hasExcessiveExtLinks && (p.meta?.linkAnalysis?.externalCount || 0) >= 5)) {
        adPostCount++
      }
    }
    const adRate = adPostCount / scrapedPosts.length

    if (adRate >= 0.4) {
      score -= 1
      details.push(`광고성 콘텐츠 과다: ${Math.round(adRate * 100)}%가 광고/협찬 (-1)`)
      items.push({ label: `광고성 콘텐츠 (${Math.round(adRate * 100)}%)`, points: -1 })
    }
  }

  // 최종 clamp
  score = Math.max(0, Math.min(maxScore, score))
  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return { name: '사용자 반응', score, maxScore, grade, details, items }
}
