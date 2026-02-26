/**
 * 블로그 지수 - 축4. 활동성(20점) + 축5. 블로그 신뢰도(20점) (v7: 연차→활동기간 대체)
 *
 * 활동성(20): 포스팅 빈도(8) + 포스팅 규칙성(6) + 최근성(6)
 * 블로그 신뢰도(20): 활동 기간(10) + 누적 포스팅 수(10)
 *
 * v7 변경: 블로그 연차(개설일 기반, 스크래핑 불안정) → 활동 기간(포스트 날짜 기반, 안정적)
 */

import { daysBetween, parsePostDate } from '@/lib/utils/text'
import type { BlogPost, AnalysisCategory, BlogProfileData } from '../types'

export function analyzeActivity(
  posts: BlogPost[],
  blogProfileData?: BlogProfileData | null
): { activity: AnalysisCategory; trust: AnalysisCategory; frequency: string; recentPostDays: number | null } {
  const activityDetails: string[] = []
  const trustDetails: string[] = []
  let activityScore = 0
  let trustScore = 0
  let frequency = '분석 불가'
  let recentPostDays: number | null = null

  if (posts.length === 0) {
    return {
      activity: { name: '활동성', score: 0, maxScore: 20, grade: 'F', details: ['분석할 포스트가 없습니다'] },
      trust: { name: '블로그 신뢰도', score: 0, maxScore: 20, grade: 'F', details: ['분석할 포스트가 없습니다'] },
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
      activity: { name: '활동성', score: 1, maxScore: 20, grade: 'D', details: ['포스트 날짜를 파싱할 수 없습니다'] },
      trust: { name: '블로그 신뢰도', score: 1, maxScore: 20, grade: 'D', details: ['포스트 날짜를 파싱할 수 없습니다'] },
      frequency,
      recentPostDays,
    }
  }

  // ============ 활동성 (20점) ============

  // === 포스팅 빈도 (8점) ===
  if (dates.length >= 2) {
    const totalDays = daysBetween(dates[0], dates[dates.length - 1]) || 1
    const postsPerWeek = (dates.length / totalDays) * 7

    if (postsPerWeek >= 5) {
      activityScore += 8
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (매일)`
      activityDetails.push(`포스팅 빈도: ${frequency}`)
    } else if (postsPerWeek >= 3) {
      activityScore += 6
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (격일)`
      activityDetails.push(`포스팅 빈도: ${frequency}`)
    } else if (postsPerWeek >= 1) {
      activityScore += 3
      frequency = `주 ${postsPerWeek.toFixed(1)}회`
      activityDetails.push(`포스팅 빈도: ${frequency}`)
    } else {
      activityScore += 1
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (부족)`
      activityDetails.push(`포스팅 빈도: ${frequency} - 주 3회 이상을 권장합니다`)
    }
  }

  // === 포스팅 규칙성 - 변동계수 (6점) ===
  if (dates.length >= 3) {
    const gaps: number[] = []
    for (let i = 0; i < dates.length - 1; i++) {
      gaps.push(daysBetween(dates[i], dates[i + 1]))
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length
    const variance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length
    const stdDev = Math.sqrt(variance)
    const cv = avgGap > 0 ? stdDev / avgGap : 0

    if (cv < 0.3) {
      activityScore += 6
      activityDetails.push('포스팅 주기 매우 규칙적')
    } else if (cv < 0.5) {
      activityScore += 5
      activityDetails.push('포스팅 주기 규칙적')
    } else if (cv < 1.0) {
      activityScore += 3
      activityDetails.push('포스팅 주기 비교적 규칙적')
    } else if (cv < 2.0) {
      activityScore += 1
      activityDetails.push('포스팅 주기 불규칙 - 꾸준한 발행이 C-Rank에 도움됩니다')
    } else {
      activityDetails.push('포스팅 주기 매우 불규칙')
    }
  }

  // === 최근성 (6점) ===
  recentPostDays = daysBetween(now, dates[0])
  if (recentPostDays <= 3) {
    activityScore += 6
    activityDetails.push(`최근 포스팅: ${recentPostDays}일 전 (매우 활발)`)
  } else if (recentPostDays <= 7) {
    activityScore += 5
    activityDetails.push(`최근 포스팅: ${recentPostDays}일 전 (활발)`)
  } else if (recentPostDays <= 14) {
    activityScore += 3
    activityDetails.push(`최근 포스팅: ${recentPostDays}일 전 (양호)`)
  } else if (recentPostDays <= 30) {
    activityScore += 1
    activityDetails.push(`최근 포스팅: ${recentPostDays}일 전 (보통)`)
  } else {
    activityScore += 0
    activityDetails.push(`최근 포스팅: ${recentPostDays}일 전 (비활성)`)
  }

  // ============ 블로그 신뢰도 (20점) ============

  // === 활동 기간 (10점) — 실제 포스팅 날짜 기반 (개설일 X) ===
  // 가장 오래된 글 ~ 현재까지의 기간 = 실제로 활동한 기간
  const activeSpanDays = dates.length >= 2
    ? daysBetween(now, dates[dates.length - 1])  // 가장 오래된 포스트 ~ 현재
    : null

  if (activeSpanDays !== null) {
    if (activeSpanDays >= 1825) { // 5년+
      trustScore += 10
      trustDetails.push(`활동 기간: ${Math.floor(activeSpanDays / 365)}년+ (최우수)`)
    } else if (activeSpanDays >= 1095) { // 3년+
      trustScore += 7
      trustDetails.push(`활동 기간: ${Math.floor(activeSpanDays / 365)}년+ (우수)`)
    } else if (activeSpanDays >= 365) { // 1년+
      trustScore += 5
      trustDetails.push(`활동 기간: ${Math.floor(activeSpanDays / 365)}년+ (양호)`)
    } else if (activeSpanDays >= 180) { // 6개월+
      trustScore += 3
      trustDetails.push(`활동 기간: ${Math.floor(activeSpanDays / 30)}개월 (보통)`)
    } else if (activeSpanDays >= 90) { // 3개월+
      trustScore += 1
      trustDetails.push(`활동 기간: ${Math.floor(activeSpanDays / 30)}개월 (부족)`)
    } else {
      trustScore += 0
      trustDetails.push(`활동 기간: ${activeSpanDays}일 (활동 초기)`)
    }
  } else {
    trustDetails.push('활동 기간을 측정할 수 없습니다')
  }

  // === 누적 포스팅 수 (10점) ===
  const totalPostCount = blogProfileData?.totalPostCount ?? posts.length

  if (totalPostCount >= 500) {
    trustScore += 10
    trustDetails.push(`누적 포스팅: ${totalPostCount.toLocaleString()}개 (최우수)`)
  } else if (totalPostCount >= 200) {
    trustScore += 7
    trustDetails.push(`누적 포스팅: ${totalPostCount.toLocaleString()}개 (우수)`)
  } else if (totalPostCount >= 100) {
    trustScore += 5
    trustDetails.push(`누적 포스팅: ${totalPostCount.toLocaleString()}개 (양호)`)
  } else if (totalPostCount >= 50) {
    trustScore += 3
    trustDetails.push(`누적 포스팅: ${totalPostCount}개 (보통)`)
  } else if (totalPostCount >= 20) {
    trustScore += 1
    trustDetails.push(`누적 포스팅: ${totalPostCount}개 (부족)`)
  } else {
    trustScore += 0
    trustDetails.push(`누적 포스팅: ${totalPostCount}개 (매우 부족)`)
  }

  const activityGrade = activityScore >= 16 ? 'S' : activityScore >= 12 ? 'A' : activityScore >= 8 ? 'B' : activityScore >= 4 ? 'C' : 'D'
  const trustGrade = trustScore >= 16 ? 'S' : trustScore >= 12 ? 'A' : trustScore >= 8 ? 'B' : trustScore >= 4 ? 'C' : 'D'

  return {
    activity: { name: '활동성', score: Math.min(20, activityScore), maxScore: 20, grade: activityGrade, details: activityDetails },
    trust: { name: '블로그 신뢰도', score: Math.min(20, trustScore), maxScore: 20, grade: trustGrade, details: trustDetails },
    frequency,
    recentPostDays,
  }
}
