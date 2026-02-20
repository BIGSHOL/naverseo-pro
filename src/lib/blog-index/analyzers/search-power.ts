/**
 * 블로그 지수 - 3. 검색 파워 분석 — 30점 (영향력 통합 + 키워드 경쟁도 추가)
 */

import type { KeywordRankResult, KeywordCompetitionData, AnalysisCategory } from '../types'

export function analyzeSearchPower(
  keywordResults: KeywordRankResult[],
  keywordCompetition?: KeywordCompetitionData[]
): AnalysisCategory {
  const maxScore = 30
  const details: string[] = []
  let score = 0

  if (keywordResults.length === 0) {
    return { name: '검색 파워', score: 0, maxScore, grade: 'F', details: ['분석할 키워드 결과가 없습니다'] }
  }

  const ranked = keywordResults.filter((r) => r.rank !== null)
  const rankedCount = ranked.length
  const total = keywordResults.length
  const exposureRate = rankedCount / total

  // === 키워드 순위 품질 (10점) ===
  if (rankedCount > 0) {
    const avgRank = ranked.reduce((sum, r) => sum + (r.rank || 0), 0) / rankedCount
    if (avgRank <= 5) score += 10
    else if (avgRank <= 10) score += 8
    else if (avgRank <= 20) score += 6
    else if (avgRank <= 30) score += 4
    else if (avgRank <= 50) score += 2
    else score += 1
    details.push(`평균 순위: ${Math.round(avgRank)}위`)
  }

  // === 검색 노출 범위 (8점) ===
  const exposureScore = Math.round(exposureRate * 8)
  score += exposureScore
  details.push(`검색 노출률: ${rankedCount}/${total} (${Math.round(exposureRate * 100)}%)`)

  // === TOP10 지배력 (5점) ===
  const top10 = ranked.filter((r) => r.rank! <= 10).length
  if (top10 >= 4) {
    score += 5
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

  // === 키워드 경쟁 가치 (7점, 신규) ===
  // 검색광고 API의 compIdx 활용: HIGH 경쟁 키워드에서 순위가 높으면 더 높은 점수
  if (keywordCompetition && keywordCompetition.length > 0) {
    // 노출된 키워드 중 경쟁도 높은 키워드 카운트
    const rankedKeywords = new Set(ranked.map(r => r.keyword))
    let competitiveRankScore = 0
    let competitiveCount = 0

    for (const comp of keywordCompetition) {
      if (!rankedKeywords.has(comp.keyword)) continue
      const kr = ranked.find(r => r.keyword === comp.keyword)
      if (!kr || kr.rank === null) continue

      competitiveCount++
      if (comp.compIdx === 'HIGH') {
        // HIGH 경쟁 키워드에서 상위 노출 → 높은 점수
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
      // 평균 경쟁 점수 → 7점 만점 매핑
      const avgCompScore = competitiveRankScore / competitiveCount
      const compPoints = Math.min(7, Math.round(avgCompScore * 2.5))
      score += compPoints

      const highCount = keywordCompetition.filter(c => c.compIdx === 'HIGH').length
      if (highCount > 0) {
        details.push(`경쟁 키워드 가치: ${compPoints}점 (HIGH 경쟁 ${highCount}개 포함)`)
      } else {
        details.push(`경쟁 키워드 가치: ${compPoints}점`)
      }
    } else {
      score += 3 // 중립 점수
      details.push('경쟁 키워드 매칭 없음 (기본 3점)')
    }
  } else {
    // 경쟁도 데이터 미제공 → 중립 점수
    score += 3
    details.push('키워드 경쟁도 데이터 없음 (기본 3점)')
  }

  const grade = score >= 24 ? 'S' : score >= 18 ? 'A' : score >= 12 ? 'B' : score >= 6 ? 'C' : 'D'

  return { name: '검색 파워', score: Math.min(maxScore, score), maxScore, grade, details }
}
