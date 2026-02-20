/**
 * 블로그 지수 - 4. 활동성 분석 — 15점 (방문자 추세 추가)
 */

import { daysBetween, parsePostDate } from '@/lib/utils/text'
import type { BlogPost, VisitorData, AnalysisCategory } from '../types'

export function analyzeActivity(
  posts: BlogPost[],
  visitorData?: VisitorData | null
): { category: AnalysisCategory; frequency: string; recentPostDays: number | null } {
  const maxScore = 15
  const details: string[] = []
  let score = 0
  let frequency = '분석 불가'
  let recentPostDays: number | null = null

  if (posts.length === 0) {
    return {
      category: { name: '활동성', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] },
      frequency,
      recentPostDays,
    }
  }

  const now = new Date()

  // 포스트 날짜 파싱 및 정렬
  const dates = posts
    .map((p) => parsePostDate(p.postdate))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())

  if (dates.length === 0) {
    return {
      category: { name: '활동성', score: 2, maxScore, grade: 'D', details: ['포스트 날짜를 파싱할 수 없습니다'] },
      frequency,
      recentPostDays,
    }
  }

  // === 최근 포스팅 (4점) ===
  recentPostDays = daysBetween(now, dates[0])
  if (recentPostDays <= 3) {
    score += 4
    details.push(`최근 포스팅: ${recentPostDays}일 전 (매우 활발)`)
  } else if (recentPostDays <= 7) {
    score += 3
    details.push(`최근 포스팅: ${recentPostDays}일 전 (활발)`)
  } else if (recentPostDays <= 14) {
    score += 2
    details.push(`최근 포스팅: ${recentPostDays}일 전 (양호)`)
  } else if (recentPostDays <= 30) {
    score += 1
    details.push(`최근 포스팅: ${recentPostDays}일 전 (보통)`)
  } else {
    score += 0
    details.push(`최근 포스팅: ${recentPostDays}일 전 (비활성)`)
  }

  // === 포스팅 빈도 (5점) ===
  if (dates.length >= 2) {
    const totalDays = daysBetween(dates[0], dates[dates.length - 1]) || 1
    const postsPerWeek = (dates.length / totalDays) * 7

    if (postsPerWeek >= 5) {
      score += 5
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (매일)`
      details.push(`포스팅 빈도: ${frequency}`)
    } else if (postsPerWeek >= 3) {
      score += 4
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (격일)`
      details.push(`포스팅 빈도: ${frequency}`)
    } else if (postsPerWeek >= 1) {
      score += 2
      frequency = `주 ${postsPerWeek.toFixed(1)}회`
      details.push(`포스팅 빈도: ${frequency}`)
    } else {
      score += 1
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (부족)`
      details.push(`포스팅 빈도: ${frequency} - 주 3회 이상을 권장합니다`)
    }
  }

  // === 꾸준함 - 날짜 간격의 변동계수 (3점) ===
  if (dates.length >= 3) {
    const gaps: number[] = []
    for (let i = 0; i < dates.length - 1; i++) {
      gaps.push(daysBetween(dates[i], dates[i + 1]))
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length
    const variance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length
    const stdDev = Math.sqrt(variance)
    const cv = avgGap > 0 ? stdDev / avgGap : 0

    if (cv < 0.5) {
      score += 3
      details.push('포스팅 주기 매우 규칙적')
    } else if (cv < 1.0) {
      score += 2
      details.push('포스팅 주기 비교적 규칙적')
    } else if (cv < 2.0) {
      score += 1
      details.push('포스팅 주기 불규칙 - 꾸준한 발행이 C-Rank에 도움됩니다')
    } else {
      details.push('포스팅 주기 매우 불규칙')
    }
  }

  // === 방문자 추세 (3점, 신규) ===
  if (visitorData && visitorData.isAvailable) {
    const avg = visitorData.avgDailyVisitors
    if (avg >= 500) {
      score += 3
      details.push(`일평균 방문자: ${avg}명 (우수)`)
    } else if (avg >= 100) {
      score += 2
      details.push(`일평균 방문자: ${avg}명 (양호)`)
    } else if (avg >= 30) {
      score += 1
      details.push(`일평균 방문자: ${avg}명 (보통)`)
    } else {
      details.push(`일평균 방문자: ${avg}명 (부족)`)
    }
  } else {
    // 방문자 데이터 미제공 → 중립 점수
    score += 1
    details.push('방문자 데이터 미제공 (기본 1점)')
  }

  const grade = score >= 12 ? 'S' : score >= 9 ? 'A' : score >= 6 ? 'B' : score >= 3 ? 'C' : 'D'

  return {
    category: { name: '활동성', score: Math.min(maxScore, score), maxScore, grade, details },
    frequency,
    recentPostDays,
  }
}
