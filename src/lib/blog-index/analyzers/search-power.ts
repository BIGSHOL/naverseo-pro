/**
 * 블로그 지수 - 1. 검색 성과 분석 — 25점 (v4: 30→25 축소)
 *
 * 순위품질(8) + 노출범위(7) + TOP10(4) + 경쟁가치(6)
 */

import type { KeywordRankResult, KeywordCompetitionData, AnalysisCategory } from '../types'

export function analyzeSearchPower(
  keywordResults: KeywordRankResult[],
  keywordCompetition?: KeywordCompetitionData[]
): AnalysisCategory {
  const maxScore = 25
  const details: string[] = []
  let score = 0

  if (keywordResults.length === 0) {
    return { name: '검색 성과', score: 0, maxScore, grade: 'F', details: ['분석할 키워드 결과가 없습니다'] }
  }

  const ranked = keywordResults.filter((r) => r.rank !== null)
  const rankedCount = ranked.length
  const total = keywordResults.length
  const exposureRate = rankedCount / total

  // === 키워드 순위 품질 (8점) ===
  if (rankedCount > 0) {
    const avgRank = ranked.reduce((sum, r) => sum + (r.rank || 0), 0) / rankedCount
    if (avgRank <= 5) score += 8
    else if (avgRank <= 10) score += 6
    else if (avgRank <= 20) score += 5
    else if (avgRank <= 30) score += 3
    else if (avgRank <= 50) score += 2
    else score += 1
    details.push(`평균 순위: ${Math.round(avgRank)}위`)
  }

  // === 검색 노출 범위 (7점) ===
  const exposureScore = Math.round(exposureRate * 7)
  score += exposureScore
  details.push(`검색 노출률: ${rankedCount}/${total} (${Math.round(exposureRate * 100)}%)`)

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

  // === 키워드 경쟁 가치 (6점) ===
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
      const compPoints = Math.min(6, Math.round(avgCompScore * 2))
      score += compPoints

      const highCount = keywordCompetition.filter(c => c.compIdx === 'HIGH').length
      if (highCount > 0) {
        details.push(`경쟁 키워드 가치: ${compPoints}점 (HIGH 경쟁 ${highCount}개 포함)`)
      } else {
        details.push(`경쟁 키워드 가치: ${compPoints}점`)
      }
    } else {
      score += 3
      details.push('경쟁 키워드 매칭 없음 (기본 3점)')
    }
  } else {
    score += 3
    details.push('키워드 경쟁도 데이터 없음 (기본 3점)')
  }

  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return { name: '검색 성과', score: Math.min(maxScore, score), maxScore, grade, details }
}
