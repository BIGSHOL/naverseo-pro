/**
 * 블로그 지수 - 축2. 방문자 활동 (25점)
 *
 * v11: 방문자 수 → 점수 제외 (참고 수치만 표시)
 *      측정 시간에 따라 달라지므로 점수 배제하고 다른 항목에 재배분
 *
 * 댓글 참여(8) + 공감 참여(6) + 이웃/구독자(6) + 체류 시간(5) = 25점
 * 방문자 수 → 0점 (조회용으로만 표시)
 *
 * 데이터 수집 실패 시 중립 점수: 댓글(2) + 공감(1) + 이웃(0) + 체류(0) = 3/25
 */

import type { VisitorData, EngagementData, AnalysisCategory, BlogProfileData, PostDetail, ScoreItem } from '../types'

export function analyzePopularity(
  visitorData?: VisitorData | null,
  engagementData?: EngagementData | null,
  blogProfileData?: BlogProfileData | null,
  recentPosts?: PostDetail[] | null,
): AnalysisCategory {
  const maxScore = 25
  const details: string[] = []
  const items: ScoreItem[] = []
  let score = 0

  // === 방문자 수 (점수 제외 - 참고 수치만 표시) ===
  // 측정 시간에 따라 달라지므로 점수에 반영하지 않음
  if (visitorData && visitorData.isAvailable) {
    const avg = visitorData.avgDailyVisitors
    const src = visitorData.source || 'api'
    const visitorLabel = src === 'history'
      ? `일평균 방문자 (${visitorData.historyDays}일)`
      : src === 'today' ? '오늘 방문자' : '일평균 방문자'
    details.push(`${visitorLabel}: ${avg.toLocaleString()}명 (참고, 점수 미반영)`)
    items.push({ label: `${visitorLabel} ${avg.toLocaleString()}명 (참고)`, points: 0 })
  }

  // === 평균 댓글 수 (8점) ===
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
      commentPts = 5
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (양호) (+5)`)
    } else if (avgComments >= 2) {
      commentPts = 3
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (보통) (+3)`)
    } else if (avgComments >= 0.5) {
      commentPts = 1
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (부족) (+1)`)
    } else {
      commentPts = 0
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (매우 부족) (+0)`)
    }
    items.push({ label: `평균 댓글 (${avgComments.toFixed(1)}개)`, points: commentPts })
  } else {
    commentPts = 2
    details.push('댓글 데이터 미제공 (+2)')
    items.push({ label: '댓글 데이터 미제공', points: commentPts })
  }
  score += commentPts

  // === 평균 공감 수 (6점) ===
  let sympathyPts = 0
  if (engagementData && engagementData.isAvailable && engagementData.avgSympathyCount !== null) {
    const avgSympathy = engagementData.avgSympathyCount
    if (avgSympathy >= 30) {
      sympathyPts = 6
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (최우수) (+6)`)
    } else if (avgSympathy >= 15) {
      sympathyPts = 5
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (우수) (+5)`)
    } else if (avgSympathy >= 5) {
      sympathyPts = 3
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (양호) (+3)`)
    } else if (avgSympathy >= 1) {
      sympathyPts = 1
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (보통) (+1)`)
    } else {
      sympathyPts = 0
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (부족) (+0)`)
    }
    items.push({ label: `평균 공감 (${avgSympathy.toFixed(1)}개)`, points: sympathyPts })
  } else {
    sympathyPts = 1
    details.push('공감 데이터 미제공 (+1)')
    items.push({ label: '공감 데이터 미제공', points: sympathyPts })
  }
  score += sympathyPts

  // === 이웃/구독자 수 (6점) ===
  let buddyPts = 0
  const buddyCount = blogProfileData?.buddyCount ?? blogProfileData?.subscriberCount ?? null
  if (buddyCount !== null) {
    if (buddyCount >= 5000) {
      buddyPts = 6
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (최우수) (+6)`)
    } else if (buddyCount >= 1000) {
      buddyPts = 5
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (우수) (+5)`)
    } else if (buddyCount >= 300) {
      buddyPts = 3
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (양호) (+3)`)
    } else if (buddyCount >= 50) {
      buddyPts = 1
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (보통) (+1)`)
    } else {
      buddyPts = 0
      details.push(`이웃: ${buddyCount}명 (부족) (+0)`)
    }
    items.push({ label: `이웃 (${buddyCount.toLocaleString()}명)`, points: buddyPts })
  } else {
    details.push('이웃 수 데이터 미제공 (+0)')
    items.push({ label: '이웃 데이터 미제공', points: 0 })
  }
  score += buddyPts

  // === 예상 체류 시간 (5점) ===
  let dwellPts = 0
  if (recentPosts && recentPosts.length > 0) {
    const withTime = recentPosts.filter(p => p.estimatedReadTimeSec != null)
    if (withTime.length > 0) {
      const avgSec = withTime.reduce((s, p) => s + p.estimatedReadTimeSec!, 0) / withTime.length
      const avgMin = avgSec / 60

      if (avgMin >= 5) {
        dwellPts = 5
        details.push(`예상 체류 시간: 평균 ${avgMin.toFixed(1)}분 (최우수) (+5)`)
      } else if (avgMin >= 3) {
        dwellPts = 4
        details.push(`예상 체류 시간: 평균 ${avgMin.toFixed(1)}분 (우수) (+4)`)
      } else if (avgMin >= 2) {
        dwellPts = 3
        details.push(`예상 체류 시간: 평균 ${avgMin.toFixed(1)}분 (양호) (+3)`)
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

  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return { name: '방문자 활동', score: Math.min(maxScore, score), maxScore, grade, details, items }
}
