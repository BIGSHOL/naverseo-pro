/**
 * 블로그 지수 - 축4. 신뢰도 (25점)
 *
 * v9: 활동성+신뢰도 통합 → 단일 "신뢰도" 축
 *
 * 포스팅 규칙성(7) + 포스팅 빈도(6) + 최근 활동성(5) + 누적 포스팅(4) + 운영 기간(3)
 *
 * 핵심: 꾸준하고 규칙적인 포스팅 + 충분한 누적이 신뢰도의 핵심
 */

import { daysBetween, parsePostDate } from '@/lib/utils/text'
import type { BlogPost, AnalysisCategory, BlogProfileData } from '../types'

export function analyzeTrust(
  posts: BlogPost[],
  blogProfileData?: BlogProfileData | null,
): { category: AnalysisCategory; frequency: string; recentPostDays: number | null } {
  const maxScore = 25
  const details: string[] = []
  let score = 0
  let frequency = '분석 불가'
  let recentPostDays: number | null = null

  if (posts.length === 0) {
    return {
      category: { name: '신뢰도', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] },
      frequency,
      recentPostDays,
    }
  }

  const now = new Date()

  // 포스트 날짜 파싱 및 정렬 (최신 순)
  const dates = posts
    .map((p) => parsePostDate(p.postdate))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())

  if (dates.length === 0) {
    return {
      category: { name: '신뢰도', score: 1, maxScore, grade: 'D', details: ['포스트 날짜를 파싱할 수 없습니다'] },
      frequency,
      recentPostDays,
    }
  }

  // === 포스팅 규칙성 - 변동계수 (7점) ===
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
      score += 7
      details.push('포스팅 주기 매우 규칙적')
    } else if (cv < 0.5) {
      score += 5
      details.push('포스팅 주기 규칙적')
    } else if (cv < 1.0) {
      score += 3
      details.push('포스팅 주기 비교적 규칙적')
    } else if (cv < 2.0) {
      score += 1
      details.push('포스팅 주기 불규칙 - 꾸준한 발행이 C-Rank에 도움됩니다')
    } else {
      details.push('포스팅 주기 매우 불규칙')
    }
  }

  // === 포스팅 빈도 (6점) ===
  if (dates.length >= 2) {
    const totalDays = daysBetween(dates[0], dates[dates.length - 1]) || 1
    const postsPerWeek = (dates.length / totalDays) * 7

    if (postsPerWeek >= 5) {
      score += 6
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (매일)`
      details.push(`포스팅 빈도: ${frequency}`)
    } else if (postsPerWeek >= 3) {
      score += 5
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (격일)`
      details.push(`포스팅 빈도: ${frequency}`)
    } else if (postsPerWeek >= 1) {
      score += 3
      frequency = `주 ${postsPerWeek.toFixed(1)}회`
      details.push(`포스팅 빈도: ${frequency}`)
    } else {
      score += 1
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (부족)`
      details.push(`포스팅 빈도: ${frequency} - 주 3회 이상을 권장합니다`)
    }
  }

  // === 최근 활동성 (5점) ===
  recentPostDays = daysBetween(now, dates[0])
  if (recentPostDays <= 3) {
    score += 5
    details.push(`최근 포스팅: ${recentPostDays}일 전 (매우 활발)`)
  } else if (recentPostDays <= 7) {
    score += 4
    details.push(`최근 포스팅: ${recentPostDays}일 전 (활발)`)
  } else if (recentPostDays <= 14) {
    score += 3
    details.push(`최근 포스팅: ${recentPostDays}일 전 (양호)`)
  } else if (recentPostDays <= 30) {
    score += 1
    details.push(`최근 포스팅: ${recentPostDays}일 전 (보통)`)
  } else {
    score += 0
    details.push(`최근 포스팅: ${recentPostDays}일 전 (비활성)`)
  }

  // === 누적 포스팅 수 (4점) ===
  const totalPostCount = blogProfileData?.totalPostCount ?? posts.length

  if (totalPostCount >= 500) {
    score += 4
    details.push(`누적 포스팅: ${totalPostCount.toLocaleString()}개 (최우수)`)
  } else if (totalPostCount >= 200) {
    score += 3
    details.push(`누적 포스팅: ${totalPostCount.toLocaleString()}개 (우수)`)
  } else if (totalPostCount >= 100) {
    score += 2
    details.push(`누적 포스팅: ${totalPostCount.toLocaleString()}개 (양호)`)
  } else if (totalPostCount >= 50) {
    score += 1
    details.push(`누적 포스팅: ${totalPostCount}개 (보통)`)
  } else {
    score += 0
    details.push(`누적 포스팅: ${totalPostCount}개 (부족)`)
  }

  // === 운영 기간 (3점) — 가장 오래된 포스트 기준 ===
  const activeSpanDays = dates.length >= 2
    ? daysBetween(now, dates[dates.length - 1])
    : null

  if (activeSpanDays !== null) {
    if (activeSpanDays >= 1095) { // 3년+
      score += 3
      details.push(`운영 기간: ${Math.floor(activeSpanDays / 365)}년+ (최우수)`)
    } else if (activeSpanDays >= 365) { // 1년+
      score += 2
      details.push(`운영 기간: ${Math.floor(activeSpanDays / 365)}년+ (양호)`)
    } else if (activeSpanDays >= 180) { // 6개월+
      score += 1
      details.push(`운영 기간: ${Math.floor(activeSpanDays / 30)}개월 (보통)`)
    } else {
      details.push(`운영 기간: ${Math.floor(activeSpanDays / 30)}개월 (초기)`)
    }
  }

  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return {
    category: { name: '신뢰도', score: Math.min(maxScore, score), maxScore, grade, details },
    frequency,
    recentPostDays,
  }
}
