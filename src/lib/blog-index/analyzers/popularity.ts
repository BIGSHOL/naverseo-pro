/**
 * 블로그 지수 - 축4. 사용자 반응 (10점)
 *
 * v11: 25점 → 10점 대폭 축소. 조작 가능 지표의 영향력 최소화.
 *      무상 점수 폐지 — 데이터 미제공 시 0점.
 *
 * 댓글 참여(3) + 공감 참여(2) + 이웃/구독자(2) + 체류 시간(3) = 10점
 * 방문자 수 → 0점 (조회용으로만 표시)
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
  const maxScore = 10
  const details: string[] = []
  const items: ScoreItem[] = []
  let score = 0

  // === 방문자 수 (점수 제외 - 참고 수치만 표시) ===
  if (visitorData && visitorData.isAvailable) {
    const avg = visitorData.avgDailyVisitors
    const src = visitorData.source || 'api'
    const visitorLabel = src === 'history'
      ? `일평균 방문자 (${visitorData.historyDays}일)`
      : src === 'today' ? '오늘 방문자' : '일평균 방문자'
    details.push(`${visitorLabel}: ${avg.toLocaleString()}명 (참고, 점수 미반영)`)
    items.push({ label: `${visitorLabel} ${avg.toLocaleString()}명 (참고)`, points: 0 })
  }

  // === 평균 댓글 수 (3점) ===
  let commentPts = 0
  if (engagementData && engagementData.isAvailable && engagementData.avgCommentCount !== null) {
    const avgComments = engagementData.avgCommentCount
    if (avgComments >= 10) {
      commentPts = 3
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (우수) (+3)`)
    } else if (avgComments >= 5) {
      commentPts = 2
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (양호) (+2)`)
    } else if (avgComments >= 2) {
      commentPts = 1
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (보통) (+1)`)
    } else {
      commentPts = 0
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (부족) (+0)`)
    }
    items.push({ label: `평균 댓글 (${avgComments.toFixed(1)}개)`, points: commentPts })
  } else {
    // v11: 무상 점수 폐지 — 미제공 시 0점
    commentPts = 0
    details.push('댓글 데이터 미제공 (+0)')
    items.push({ label: '댓글 데이터 미제공', points: 0 })
  }
  score += commentPts

  // === 평균 공감 수 (2점) ===
  let sympathyPts = 0
  if (engagementData && engagementData.isAvailable && engagementData.avgSympathyCount !== null) {
    const avgSympathy = engagementData.avgSympathyCount
    if (avgSympathy >= 15) {
      sympathyPts = 2
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (우수) (+2)`)
    } else if (avgSympathy >= 5) {
      sympathyPts = 1
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (양호) (+1)`)
    } else {
      sympathyPts = 0
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (부족) (+0)`)
    }
    items.push({ label: `평균 공감 (${avgSympathy.toFixed(1)}개)`, points: sympathyPts })
  } else {
    // v11: 무상 점수 폐지 — 미제공 시 0점
    sympathyPts = 0
    details.push('공감 데이터 미제공 (+0)')
    items.push({ label: '공감 데이터 미제공', points: 0 })
  }
  score += sympathyPts

  // === 이웃/구독자 수 (2점) ===
  let buddyPts = 0
  const buddyCount = blogProfileData?.buddyCount ?? blogProfileData?.subscriberCount ?? null
  if (buddyCount !== null) {
    if (buddyCount >= 1000) {
      buddyPts = 2
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (우수) (+2)`)
    } else if (buddyCount >= 300) {
      buddyPts = 1
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (양호) (+1)`)
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

  // === 예상 체류 시간 (3점) ===
  let dwellPts = 0
  if (recentPosts && recentPosts.length > 0) {
    const withTime = recentPosts.filter(p => p.estimatedReadTimeSec != null)
    if (withTime.length > 0) {
      const avgSec = withTime.reduce((s, p) => s + p.estimatedReadTimeSec!, 0) / withTime.length
      const avgMin = avgSec / 60

      if (avgMin >= 5) {
        dwellPts = 3
        details.push(`예상 체류 시간: 평균 ${avgMin.toFixed(1)}분 (우수) (+3)`)
      } else if (avgMin >= 3) {
        dwellPts = 2
        details.push(`예상 체류 시간: 평균 ${avgMin.toFixed(1)}분 (양호) (+2)`)
      } else if (avgMin >= 1) {
        dwellPts = 1
        details.push(`예상 체류 시간: 평균 ${avgMin.toFixed(1)}분 (보통) (+1)`)
      } else {
        details.push(`예상 체류 시간: 평균 ${Math.round(avgSec)}초 (부족 - 콘텐츠 깊이를 늘리세요) (+0)`)
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
  const grade = score >= 8 ? 'S' : score >= 6 ? 'A' : score >= 4 ? 'B' : score >= 2 ? 'C' : 'D'

  return { name: '사용자 반응', score, maxScore, grade, details, items }
}
