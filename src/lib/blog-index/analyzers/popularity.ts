/**
 * 블로그 지수 - 축2. 방문자 활동 (25점)
 *
 * v10: items 배열 추가 (로직 변경 없음)
 *
 * 일평균 방문자(8) + 댓글 참여(5) + 공감 참여(4) + 이웃/구독자(4) + 체류 시간(4)
 *
 * 데이터 수집 실패 시 중립 점수: 방문자(2) + 댓글(1) + 공감(1) + 이웃(0) + 체류(0) = 4/25
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

  // === 일평균 방문자 수 (8점) ===
  let visitorPts = 0
  if (visitorData && visitorData.isAvailable) {
    const avg = visitorData.avgDailyVisitors
    if (avg >= 1000) {
      visitorPts = 8
      details.push(`일평균 방문자: ${avg.toLocaleString()}명 (최우수) (+8)`)
    } else if (avg >= 500) {
      visitorPts = 6
      details.push(`일평균 방문자: ${avg.toLocaleString()}명 (우수) (+6)`)
    } else if (avg >= 200) {
      visitorPts = 4
      details.push(`일평균 방문자: ${avg.toLocaleString()}명 (양호) (+4)`)
    } else if (avg >= 50) {
      visitorPts = 2
      details.push(`일평균 방문자: ${avg.toLocaleString()}명 (보통) (+2)`)
    } else if (avg >= 10) {
      visitorPts = 1
      details.push(`일평균 방문자: ${avg.toLocaleString()}명 (부족) (+1)`)
    } else {
      visitorPts = 0
      details.push(`일평균 방문자: ${avg}명 (매우 부족) (+0)`)
    }
    items.push({ label: `일평균 방문자 (${avg.toLocaleString()}명)`, points: visitorPts })
  } else {
    visitorPts = 2
    details.push('방문자 데이터 미제공 (+2)')
    items.push({ label: '방문자 데이터 미제공', points: visitorPts })
  }
  score += visitorPts

  // === 평균 댓글 수 (5점) ===
  let commentPts = 0
  if (engagementData && engagementData.isAvailable && engagementData.avgCommentCount !== null) {
    const avgComments = engagementData.avgCommentCount
    if (avgComments >= 20) {
      commentPts = 5
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (최우수) (+5)`)
    } else if (avgComments >= 10) {
      commentPts = 4
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (우수) (+4)`)
    } else if (avgComments >= 5) {
      commentPts = 3
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (양호) (+3)`)
    } else if (avgComments >= 2) {
      commentPts = 2
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (보통) (+2)`)
    } else if (avgComments >= 0.5) {
      commentPts = 1
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (부족) (+1)`)
    } else {
      commentPts = 0
      details.push(`평균 댓글: ${avgComments.toFixed(1)}개 (매우 부족) (+0)`)
    }
    items.push({ label: `평균 댓글 (${avgComments.toFixed(1)}개)`, points: commentPts })
  } else {
    commentPts = 1
    details.push('댓글 데이터 미제공 (+1)')
    items.push({ label: '댓글 데이터 미제공', points: commentPts })
  }
  score += commentPts

  // === 평균 공감 수 (4점) ===
  let sympathyPts = 0
  if (engagementData && engagementData.isAvailable && engagementData.avgSympathyCount !== null) {
    const avgSympathy = engagementData.avgSympathyCount
    if (avgSympathy >= 30) {
      sympathyPts = 4
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (최우수) (+4)`)
    } else if (avgSympathy >= 15) {
      sympathyPts = 3
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (우수) (+3)`)
    } else if (avgSympathy >= 5) {
      sympathyPts = 2
      details.push(`평균 공감: ${avgSympathy.toFixed(1)}개 (양호) (+2)`)
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

  // === 이웃/구독자 수 (4점) ===
  let buddyPts = 0
  const buddyCount = blogProfileData?.buddyCount ?? blogProfileData?.subscriberCount ?? null
  if (buddyCount !== null) {
    if (buddyCount >= 5000) {
      buddyPts = 4
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (최우수) (+4)`)
    } else if (buddyCount >= 1000) {
      buddyPts = 3
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (우수) (+3)`)
    } else if (buddyCount >= 300) {
      buddyPts = 2
      details.push(`이웃: ${buddyCount.toLocaleString()}명 (양호) (+2)`)
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

  // === 예상 체류 시간 (4점) ===
  let dwellPts = 0
  if (recentPosts && recentPosts.length > 0) {
    const withTime = recentPosts.filter(p => p.estimatedReadTimeSec != null)
    if (withTime.length > 0) {
      const avgSec = withTime.reduce((s, p) => s + p.estimatedReadTimeSec!, 0) / withTime.length
      const avgMin = avgSec / 60

      if (avgMin >= 5) {
        dwellPts = 4
        details.push(`예상 체류 시간: 평균 ${avgMin.toFixed(1)}분 (최우수) (+4)`)
      } else if (avgMin >= 3) {
        dwellPts = 3
        details.push(`예상 체류 시간: 평균 ${avgMin.toFixed(1)}분 (우수) (+3)`)
      } else if (avgMin >= 2) {
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

  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return { name: '방문자 활동', score: Math.min(maxScore, score), maxScore, grade, details, items }
}
