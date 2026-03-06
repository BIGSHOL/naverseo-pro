/**
 * 블로그 지수 - 축3. 활동 신뢰도 (20점)
 *
 * v17: 사용자 반응 축 강화를 위해 25→20점 축소.
 *      매일 포스팅의 과대 보상을 줄이고, 실제 인기(방문자/댓글/공감)에 가중치 이동.
 *
 * 가점: 규칙성(5) + 빈도(4) + 최근 활동성(2) + 누적 포스팅(4) + 운영 기간(5) = 20
 * 감점: 스팸 키워드(-3) + 외부 링크 과다(-3) + 기계적 일괄 발행(-3) + 극단적 과다 발행(-2) = -11
 * 최종: clamp(가점 + 감점, 0, 20)
 */

import { stripHtml, daysBetween, parsePostDate, extractKoreanKeywords } from '@/lib/utils/text'
import type { BlogPost, AnalysisCategory, BlogProfileData, ScoreItem } from '../types'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'

/** 네이버가 저품질로 분류하는 스팸성 키워드 (abuse.ts에서 이동) */
const SPAM_KEYWORDS = [
  // 금융/대출
  '대출', '대환대출', '신용대출', '무직자대출', '소액대출',
  // 도박
  '도박', '카지노', '바카라', '슬롯', '사설토토', '먹튀',
  // 성인/건강기능식품
  '비아그라', '시알리스', '정력',
  // 불법 콘텐츠
  '불법다운', '무료다시보기', '토렌트',
  // 소액결제/현금화
  '정보이용료', '소액결제현금화', '캐싱',
  // 위조품
  '가품', '레플리카', '짝퉁',
  // 고관여 스팸 필터 대상
  '다이어트약', '주식리딩방', '선물옵션', '코인시그널',
]

/** 광고성/단축 URL 도메인 패턴 (abuse.ts에서 이동) */
const SUSPICIOUS_DOMAINS = [
  'bit.ly', 'goo.gl', 'tinyurl.com', 'han.gl', 'me2.do',
  'is.gd', 'v.gd', 'ow.ly', 'buff.ly', 'adf.ly',
  'linktr.ee', 'hoy.kr', 'url.kr',
]

export function analyzeTrust(
  posts: BlogPost[],
  blogProfileData?: BlogProfileData | null,
  /** 엔진에서 계산한 정확한 운영 일수 (검색API 최초포스팅 > 개설일 > 포스트최소일 순) */
  actualBlogAgeDays?: number | null,
  scrapedData?: Map<string, ScrapedPostData> | null,
): { category: AnalysisCategory; frequency: string; recentPostDays: number | null } {
  const maxScore = 20
  const details: string[] = []
  const items: ScoreItem[] = []
  let score = 0
  let frequency = '분석 불가'
  let recentPostDays: number | null = null

  if (posts.length === 0) {
    return {
      category: { name: '활동 신뢰도', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'], items: [] },
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
      category: { name: '활동 신뢰도', score: 1, maxScore, grade: 'D', details: ['포스트 날짜를 파싱할 수 없습니다'], items: [] },
      frequency,
      recentPostDays,
    }
  }

  // === 포스팅 규칙성 - 변동계수 (5점) === (v17: 6→5)
  let regularityPts = 0
  if (dates.length >= 3) {
    const gaps: number[] = []
    for (let i = 0; i < dates.length - 1; i++) {
      gaps.push(daysBetween(dates[i], dates[i + 1]))
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length
    const variance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length
    const stdDev = Math.sqrt(variance)
    const cv = avgGap > 0 ? stdDev / avgGap : 0

    if (cv < 0.15) {
      regularityPts = 5
      details.push('포스팅 주기 매우 규칙적 (+5)')
    } else if (cv < 0.3) {
      regularityPts = 3
      details.push('포스팅 주기 규칙적 (+3)')
    } else if (cv < 0.6) {
      regularityPts = 2
      details.push('포스팅 주기 비교적 규칙적 (+2)')
    } else if (cv < 1.5) {
      regularityPts = 1
      details.push('포스팅 주기 불규칙 - 꾸준한 발행이 C-Rank에 도움됩니다 (+1)')
    } else {
      details.push('포스팅 주기 매우 불규칙 (+0)')
    }
  }
  score += regularityPts
  items.push({ label: '포스팅 규칙성', points: regularityPts })

  // === 포스팅 빈도 (4점) - 범위 기반 === (v17: 5→4)
  let freqPts = 0
  if (dates.length >= 2) {
    const totalDays = daysBetween(dates[0], dates[dates.length - 1]) || 1
    const postsPerWeek = (dates.length / totalDays) * 7

    if (postsPerWeek >= 3 && postsPerWeek <= 5) {
      freqPts = 4
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (최적)`
      details.push(`포스팅 빈도: ${frequency} (+4)`)
    } else if (postsPerWeek > 5 && postsPerWeek <= 7) {
      freqPts = 3
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (양호)`
      details.push(`포스팅 빈도: ${frequency} (+3)`)
    } else if (postsPerWeek >= 2 && postsPerWeek < 3) {
      freqPts = 2
      frequency = `주 ${postsPerWeek.toFixed(1)}회`
      details.push(`포스팅 빈도: ${frequency} - 주 3회 이상을 권장합니다 (+2)`)
    } else if (postsPerWeek > 7 && postsPerWeek <= 14) {
      freqPts = 1
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (다소 많음)`
      details.push(`포스팅 빈도: ${frequency} - 양보다 질이 중요합니다 (+1)`)
    } else if (postsPerWeek > 14) {
      freqPts = 0
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (과다)`
      details.push(`포스팅 빈도: ${frequency} - 과도한 발행은 품질에 영향 (+0)`)
    } else {
      freqPts = 1
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (부족)`
      details.push(`포스팅 빈도: ${frequency} - 주 3회 이상을 권장합니다 (+1)`)
    }
  }
  score += freqPts
  items.push({ label: `포스팅 빈도 (${frequency})`, points: freqPts })

  // === 최근 활동성 (2점) === (v17: 3→2)
  let recentPts = 0
  recentPostDays = daysBetween(now, dates[0])
  if (recentPostDays <= 3) {
    recentPts = 2
    details.push(`최근 포스팅: ${recentPostDays}일 전 (활발) (+2)`)
  } else if (recentPostDays <= 7) {
    recentPts = 1
    details.push(`최근 포스팅: ${recentPostDays}일 전 (양호) (+1)`)
  } else {
    recentPts = 0
    details.push(`최근 포스팅: ${recentPostDays}일 전 (비활성) (+0)`)
  }
  score += recentPts
  items.push({ label: `최근 활동 (${recentPostDays}일 전)`, points: recentPts })

  // === 누적 포스팅 수 (4점) === (v17: 5→4)
  const totalPostCount = blogProfileData?.totalPostCount ?? posts.length
  let postCountPts = 0

  if (totalPostCount >= 2500) {
    postCountPts = 4
    details.push(`누적 포스팅: ${totalPostCount.toLocaleString()}개 (최우수) (+4)`)
  } else if (totalPostCount >= 1500) {
    postCountPts = 3
    details.push(`누적 포스팅: ${totalPostCount.toLocaleString()}개 (우수) (+3)`)
  } else if (totalPostCount >= 800) {
    postCountPts = 2
    details.push(`누적 포스팅: ${totalPostCount.toLocaleString()}개 (양호) (+2)`)
  } else if (totalPostCount >= 300) {
    postCountPts = 1
    details.push(`누적 포스팅: ${totalPostCount.toLocaleString()}개 (보통) (+1)`)
  } else {
    postCountPts = 0
    details.push(`누적 포스팅: ${totalPostCount.toLocaleString()}개 (부족) (+0)`)
  }
  score += postCountPts
  items.push({ label: `누적 포스팅 (${totalPostCount.toLocaleString()}개)`, points: postCountPts })

  // === 운영 기간 (5점) === (v17: 6→5)
  const activeSpanDays = actualBlogAgeDays
    ?? (dates.length >= 2 ? daysBetween(now, dates[dates.length - 1]) : null)

  let agePts = 0
  if (activeSpanDays !== null) {
    const label = activeSpanDays >= 365
      ? `${Math.floor(activeSpanDays / 365)}년 ${Math.floor((activeSpanDays % 365) / 30)}개월`
      : `${Math.floor(activeSpanDays / 30)}개월`

    // v17: 10년+ 최우수 5점
    if (activeSpanDays >= 3650) { // 10년+
      agePts = 5
      details.push(`운영 기간: ${label} (최우수) (+5)`)
    } else if (activeSpanDays >= 2555) { // 7년+
      agePts = 4
      details.push(`운영 기간: ${label} (우수) (+4)`)
    } else if (activeSpanDays >= 1825) { // 5년+
      agePts = 3
      details.push(`운영 기간: ${label} (양호) (+3)`)
    } else if (activeSpanDays >= 1095) { // 3년+
      agePts = 2
      details.push(`운영 기간: ${label} (보통) (+2)`)
    } else if (activeSpanDays >= 365) { // 1년+
      agePts = 1
      details.push(`운영 기간: ${label} (초기) (+1)`)
    } else {
      details.push(`운영 기간: ${label} (신규) (+0)`)
    }
    items.push({ label: `운영 기간 (${label})`, points: agePts })
  } else {
    items.push({ label: '운영 기간 (알 수 없음)', points: 0 })
  }
  score += agePts

  // === [감점] 스팸 키워드 (0 ~ -3) — abuse.ts에서 이동 ===
  if (posts.length >= 3) {
    const allText = posts.map(p => stripHtml(p.title) + ' ' + stripHtml(p.description)).join(' ').toLowerCase()
    const detectedSpam: string[] = []
    for (const keyword of SPAM_KEYWORDS) {
      const regex = new RegExp(keyword, 'gi')
      const matches = allText.match(regex)
      if (matches && matches.length >= 2) {
        detectedSpam.push(keyword)
      }
    }

    if (detectedSpam.length >= 3) {
      score -= 3
      details.push(`스팸 키워드 다수 감지: ${detectedSpam.slice(0, 5).join(', ')} (-3)`)
      items.push({ label: `스팸 키워드 (${detectedSpam.length}종)`, points: -3 })
    } else if (detectedSpam.length >= 1) {
      score -= 1
      details.push(`스팸성 키워드 주의: ${detectedSpam.join(', ')} (-1)`)
      items.push({ label: `스팸 키워드 (${detectedSpam.length}종)`, points: -1 })
    }
  }

  // === [감점] 외부 링크 과다 (0 ~ -3) — abuse.ts에서 이동 ===
  if (scrapedData && scrapedData.size > 0) {
    const postsWithMeta = Array.from(scrapedData.values()).filter(p => p.meta?.linkAnalysis)
    if (postsWithMeta.length > 0) {
      const totalExternal = postsWithMeta.reduce(
        (s, p) => s + (p.meta!.linkAnalysis.externalCount || 0), 0
      )
      const avgExternal = totalExternal / postsWithMeta.length
      let extPenalty = 0

      // 단축/광고 URL 감지
      let suspiciousCount = 0
      postsWithMeta.forEach(p => {
        p.meta!.linkAnalysis.externalLinks.forEach(link => {
          const domain = link.domain.toLowerCase()
          if (SUSPICIOUS_DOMAINS.some(d => domain.includes(d))) {
            suspiciousCount++
          }
        })
      })

      if (suspiciousCount >= 5) {
        extPenalty -= 2
        details.push(`광고성/단축 URL ${suspiciousCount}개 감지 (-2)`)
      } else if (suspiciousCount >= 2) {
        extPenalty -= 1
        details.push(`단축 URL ${suspiciousCount}개 감지 주의 (-1)`)
      }

      if (avgExternal >= 5) {
        extPenalty -= 2
        details.push(`외부 링크 과다 (포스트당 평균 ${avgExternal.toFixed(1)}개) (-2)`)
      } else if (avgExternal >= 3) {
        extPenalty -= 1
        details.push(`외부 링크 다소 많음 (포스트당 평균 ${avgExternal.toFixed(1)}개) (-1)`)
      }

      // 최대 -3 제한
      extPenalty = Math.max(-3, extPenalty)
      if (extPenalty < 0) {
        score += extPenalty
        items.push({ label: '외부 링크', points: extPenalty })
      }
    }
  }

  // === [감점] 기계적 일괄 발행 (0 ~ -3) ===
  // 같은 날짜에 3개 이상 발행하는 날이 많으면 기계적 패턴
  if (dates.length >= 5) {
    const dateCountMap: Record<string, number> = {}
    for (const d of dates) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      dateCountMap[key] = (dateCountMap[key] || 0) + 1
    }
    const bulkDays = Object.values(dateCountMap).filter(c => c >= 3).length
    const totalDays = Object.keys(dateCountMap).length
    const bulkRate = totalDays > 0 ? bulkDays / totalDays : 0

    if (bulkRate >= 0.4) {
      score -= 3
      details.push(`기계적 일괄 발행: ${Math.round(bulkRate * 100)}% 날짜에서 하루 3건↑ 발행 (-3)`)
      items.push({ label: `일괄 발행 (${Math.round(bulkRate * 100)}%)`, points: -3 })
    } else if (bulkRate >= 0.2) {
      score -= 2
      details.push(`일괄 발행 주의: ${Math.round(bulkRate * 100)}% 날짜에서 하루 3건↑ 발행 (-2)`)
      items.push({ label: `일괄 발행 (${Math.round(bulkRate * 100)}%)`, points: -2 })
    } else if (bulkRate >= 0.1) {
      score -= 1
      details.push(`일괄 발행 경미: ${Math.round(bulkRate * 100)}% 날짜에서 하루 3건↑ 발행 (-1)`)
      items.push({ label: `일괄 발행 (${Math.round(bulkRate * 100)}%)`, points: -1 })
    }
  }

  // === [감점] 극단적 포스팅 과다 (0 ~ -2) ===
  if (dates.length >= 2) {
    const spanDays = daysBetween(dates[0], dates[dates.length - 1]) || 1
    const weeklyRate = (dates.length / spanDays) * 7
    if (weeklyRate >= 35) {
      score -= 2
      details.push(`극단적 포스팅 과다: 주 ${weeklyRate.toFixed(1)}회 — AI 대량 발행 의심 (-2)`)
      items.push({ label: `포스팅 과다 (주 ${weeklyRate.toFixed(1)}회)`, points: -2 })
    } else if (weeklyRate >= 25) {
      score -= 1
      details.push(`포스팅 과다: 주 ${weeklyRate.toFixed(1)}회 — 양보다 질에 집중 권장 (-1)`)
      items.push({ label: `포스팅 과다 (주 ${weeklyRate.toFixed(1)}회)`, points: -1 })
    }
  }

  // 최종 clamp
  score = Math.max(0, Math.min(maxScore, score))
  const grade = score >= 16 ? 'S' : score >= 12 ? 'A' : score >= 8 ? 'B' : score >= 4 ? 'C' : 'D'

  return {
    category: { name: '활동 신뢰도', score, maxScore, grade, details, items },
    frequency,
    recentPostDays,
  }
}
