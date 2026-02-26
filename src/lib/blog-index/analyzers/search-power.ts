/**
 * 블로그 지수 - 축3. SEO 최적화 (25점)
 *
 * v9: 검색 보너스(별도) → 본축 승격 + 제목 키워드 최적화 추가
 *
 * 검색 순위 품질(7) + 검색 노출률(5) + 제목 키워드 최적화(5) + TOP10 지배력(4) + 경쟁 키워드 가치(4)
 */

import { stripHtml, extractKoreanKeywords } from '@/lib/utils/text'
import type { KeywordRankResult, KeywordCompetitionData, AnalysisCategory, BlogPost } from '../types'

export function analyzeSearchPower(
  keywordResults: KeywordRankResult[],
  keywordCompetition?: KeywordCompetitionData[],
  posts?: BlogPost[],
): AnalysisCategory {
  const maxScore = 25
  const details: string[] = []
  let score = 0

  if (keywordResults.length === 0) {
    return { name: 'SEO 최적화', score: 0, maxScore, grade: 'F', details: ['분석할 키워드 결과가 없습니다'] }
  }

  const ranked = keywordResults.filter((r) => r.rank !== null)
  const rankedCount = ranked.length
  const total = keywordResults.length
  const exposureRate = rankedCount / total

  // === 검색 순위 품질 (7점) ===
  if (rankedCount > 0) {
    const avgRank = ranked.reduce((sum, r) => sum + (r.rank || 0), 0) / rankedCount
    if (avgRank <= 5) score += 7
    else if (avgRank <= 10) score += 5
    else if (avgRank <= 20) score += 4
    else if (avgRank <= 30) score += 3
    else if (avgRank <= 50) score += 2
    else score += 1
    details.push(`평균 순위: ${Math.round(avgRank)}위`)
  }

  // === 검색 노출률 (5점) ===
  const exposureScore = Math.round(exposureRate * 5)
  score += exposureScore
  details.push(`검색 노출률: ${rankedCount}/${total} (${Math.round(exposureRate * 100)}%)`)

  // === 제목 키워드 최적화 (5점) - v9 신규 ===
  if (posts && posts.length > 0) {
    const testKeywords = keywordResults.map(kr => kr.keyword.toLowerCase())
    let keywordInTitleCount = 0
    let optimalTitleCount = 0

    for (const post of posts) {
      const cleanTitle = stripHtml(post.title).toLowerCase()

      // 제목에 테스트 키워드가 포함되어 있는지
      for (const kw of testKeywords) {
        const kwWords = extractKoreanKeywords(kw)
        if (kwWords.some(w => cleanTitle.includes(w))) {
          keywordInTitleCount++
          break
        }
      }

      // 제목 길이 최적화 (20~35자)
      const titleLen = stripHtml(post.title).length
      if (titleLen >= 20 && titleLen <= 35) optimalTitleCount++
    }

    const keywordRate = keywordInTitleCount / posts.length
    const optimalRate = optimalTitleCount / posts.length

    let titleScore = 0
    // 키워드 포함률 (3점)
    if (keywordRate >= 0.6) titleScore += 3
    else if (keywordRate >= 0.3) titleScore += 2
    else if (keywordRate >= 0.1) titleScore += 1

    // 제목 길이 최적화 (2점)
    if (optimalRate >= 0.7) titleScore += 2
    else if (optimalRate >= 0.4) titleScore += 1

    score += titleScore
    if (titleScore >= 4) {
      details.push('제목 키워드 최적화 우수')
    } else if (titleScore >= 2) {
      details.push('제목 키워드 최적화 양호')
    } else {
      details.push('제목에 핵심 키워드를 자연스럽게 포함하세요 (20~35자 권장)')
    }
  } else {
    score += 2
  }

  // === TOP10 지배력 (4점) ===
  const top10 = ranked.filter((r) => r.rank! <= 10).length
  if (top10 >= 4) {
    score += 4
    details.push(`TOP 10 키워드: ${top10}개 (우수)`)
  } else if (top10 >= 2) {
    score += 3
    details.push(`TOP 10 키워드: ${top10}개 (양호)`)
  } else if (top10 >= 1) {
    score += 2
    details.push(`TOP 10 키워드: ${top10}개`)
  } else {
    details.push('TOP 10 노출 키워드 없음')
  }

  // === 경쟁 키워드 가치 (4점) ===
  if (keywordCompetition && keywordCompetition.length > 0) {
    const rankedKeywords = new Set(ranked.map(r => r.keyword))
    let competitiveRankScore = 0
    let competitiveCount = 0

    for (const comp of keywordCompetition) {
      if (!rankedKeywords.has(comp.keyword)) continue
      const kr = ranked.find(r => r.keyword === comp.keyword)
      if (!kr || kr.rank === null) continue

      competitiveCount++
      if (comp.compIdx === 'HIGH') {
        if (kr.rank <= 10) competitiveRankScore += 3
        else if (kr.rank <= 30) competitiveRankScore += 2
        else competitiveRankScore += 1
      } else if (comp.compIdx === 'MEDIUM') {
        if (kr.rank <= 10) competitiveRankScore += 2
        else if (kr.rank <= 30) competitiveRankScore += 1
      } else {
        if (kr.rank <= 10) competitiveRankScore += 1
      }
    }

    if (competitiveCount > 0) {
      const avgCompScore = competitiveRankScore / competitiveCount
      const compPoints = Math.min(4, Math.round(avgCompScore * 1.5))
      score += compPoints
      details.push(`경쟁 키워드 가치: ${compPoints}점`)
    } else {
      score += 2
      details.push('경쟁 키워드 매칭 없음 (기본 2점)')
    }
  } else {
    score += 2
    details.push('키워드 경쟁도 데이터 없음 (기본 2점)')
  }

  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return { name: 'SEO 최적화', score: Math.min(maxScore, score), maxScore, grade, details }
}
