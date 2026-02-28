/**
 * 블로그 지수 - 축3. SEO 최적화 (25점)
 *
 * v10: items 배열 추가 + 제목 특수문자 남용 감점 통합
 *
 * 가점: 검색 순위(7) + 노출률(5) + 제목 키워드 최적화(5) + TOP10 지배력(4) + 경쟁 키워드 가치(4) = 25
 * 감점: 제목 특수문자 남용(-2) + 상업적 키워드 남용(-2) + 제목 키워드 반복(-2) = -6
 * 최종: clamp(가점 + 감점, 0, 25)
 */

import { stripHtml, extractKoreanKeywords } from '@/lib/utils/text'
import type { KeywordRankResult, KeywordCompetitionData, AnalysisCategory, BlogPost, ScoreItem } from '../types'

export function analyzeSearchPower(
  keywordResults: KeywordRankResult[],
  keywordCompetition?: KeywordCompetitionData[],
  posts?: BlogPost[],
): AnalysisCategory {
  const maxScore = 25
  const details: string[] = []
  const items: ScoreItem[] = []
  let score = 0

  if (keywordResults.length === 0) {
    return { name: 'SEO 최적화', score: 0, maxScore, grade: 'F', details: ['분석할 키워드 결과가 없습니다'], items: [] }
  }

  const ranked = keywordResults.filter((r) => r.rank !== null)
  const rankedCount = ranked.length
  const total = keywordResults.length
  const exposureRate = rankedCount / total

  // === 검색 순위 품질 (7점) ===
  let rankPts = 0
  if (rankedCount > 0) {
    const avgRank = ranked.reduce((sum, r) => sum + (r.rank || 0), 0) / rankedCount
    if (avgRank <= 5) rankPts = 7
    else if (avgRank <= 10) rankPts = 5
    else if (avgRank <= 20) rankPts = 4
    else if (avgRank <= 30) rankPts = 3
    else if (avgRank <= 50) rankPts = 2
    else rankPts = 1
    score += rankPts
    details.push(`평균 순위: ${Math.round(avgRank)}위 (+${rankPts})`)
    items.push({ label: `검색 순위 (평균 ${Math.round(avgRank)}위)`, points: rankPts })
  }

  // === 검색 노출률 (5점) ===
  const exposureScore = Math.round(exposureRate * 5)
  score += exposureScore
  details.push(`검색 노출률: ${rankedCount}/${total} (${Math.round(exposureRate * 100)}%) (+${exposureScore})`)
  items.push({ label: `검색 노출률 (${Math.round(exposureRate * 100)}%)`, points: exposureScore })

  // === 제목 키워드 최적화 (5점) ===
  let titleScore = 0
  if (posts && posts.length > 0) {
    const testKeywords = keywordResults.map(kr => kr.keyword.toLowerCase())
    let keywordInTitleCount = 0
    let optimalTitleCount = 0

    for (const post of posts) {
      const cleanTitle = stripHtml(post.title).toLowerCase()

      for (const kw of testKeywords) {
        const kwWords = extractKoreanKeywords(kw)
        if (kwWords.some(w => cleanTitle.includes(w))) {
          keywordInTitleCount++
          break
        }
      }

      const titleLen = stripHtml(post.title).length
      if (titleLen >= 20 && titleLen <= 35) optimalTitleCount++
    }

    const keywordRate = keywordInTitleCount / posts.length
    const optimalRate = optimalTitleCount / posts.length

    // 키워드 포함률 (3점)
    if (keywordRate >= 0.6) titleScore += 3
    else if (keywordRate >= 0.3) titleScore += 2
    else if (keywordRate >= 0.1) titleScore += 1

    // 제목 길이 최적화 (2점)
    if (optimalRate >= 0.7) titleScore += 2
    else if (optimalRate >= 0.4) titleScore += 1

    score += titleScore
    if (titleScore >= 4) {
      details.push(`제목 키워드 최적화 우수 (+${titleScore})`)
    } else if (titleScore >= 2) {
      details.push(`제목 키워드 최적화 양호 (+${titleScore})`)
    } else {
      details.push(`제목에 핵심 키워드를 자연스럽게 포함하세요 (20~35자 권장) (+${titleScore})`)
    }
  } else {
    titleScore = 2
    score += titleScore
    details.push('포스트 데이터 없음 (+2)')
  }
  items.push({ label: '제목 키워드 최적화', points: titleScore })

  // === TOP10 지배력 (4점) ===
  const top10 = ranked.filter((r) => r.rank! <= 10).length
  let top10Pts = 0
  if (top10 >= 4) {
    top10Pts = 4
    details.push(`TOP 10 키워드: ${top10}개 (우수) (+4)`)
  } else if (top10 >= 2) {
    top10Pts = 3
    details.push(`TOP 10 키워드: ${top10}개 (양호) (+3)`)
  } else if (top10 >= 1) {
    top10Pts = 2
    details.push(`TOP 10 키워드: ${top10}개 (+2)`)
  } else {
    details.push('TOP 10 노출 키워드 없음 (+0)')
  }
  score += top10Pts
  items.push({ label: `TOP 10 (${top10}개)`, points: top10Pts })

  // === 경쟁 키워드 가치 (4점) ===
  let compPoints = 0
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
      compPoints = Math.min(4, Math.round(avgCompScore * 1.5))
      details.push(`경쟁 키워드 가치 (+${compPoints})`)
    } else {
      compPoints = 2
      details.push('경쟁 키워드 매칭 없음 (+2)')
    }
  } else {
    compPoints = 2
    details.push('키워드 경쟁도 데이터 없음 (+2)')
  }
  score += compPoints
  items.push({ label: '경쟁 키워드 가치', points: compPoints })

  // === [감점] 제목 특수문자/이모지 남용 (0 ~ -2) — abuse.ts에서 이동 ===
  if (posts && posts.length >= 3) {
    const specialCharTitles = posts.filter(p => {
      const title = stripHtml(p.title)
      const specialChars = title.match(/[★☆♥♡◆◇■□▶▷●○♠♣♦◈※☞→←↑↓⊙⊕⊗✔✖✦❤❥❣✨⭐🔥💯🎉🎊💥⚡]/g)
      return specialChars && specialChars.length >= 3
    }).length
    const specialCharRate = specialCharTitles / posts.length

    if (specialCharRate >= 0.6) {
      score -= 2
      details.push(`제목 특수문자 남용: ${Math.round(specialCharRate * 100)}% 과다 사용 (-2)`)
      items.push({ label: `제목 특수문자 (${Math.round(specialCharRate * 100)}%)`, points: -2 })
    } else if (specialCharRate >= 0.3) {
      score -= 1
      details.push(`제목 특수문자 다소 많음: ${Math.round(specialCharRate * 100)}% (-1)`)
      items.push({ label: `제목 특수문자 (${Math.round(specialCharRate * 100)}%)`, points: -1 })
    }
  }

  // === [감점] 상업적/홍보성 키워드 남용 (0 ~ -2) ===
  if (posts && posts.length >= 3) {
    const COMMERCIAL_KEYWORDS = [
      '최저가', '할인', '구매링크', '바로가기', '무료체험', '당첨', '이벤트',
      '특가', '세일', '프로모션', '쿠폰', '적립금', '무료배송',
      '클릭', '사이트방문', '더보기', '링크확인',
    ]
    let postsWithExcessCommercial = 0
    for (const p of posts) {
      const text = (stripHtml(p.title) + ' ' + stripHtml(p.description)).replace(/\s/g, '').toLowerCase()
      let hitCount = 0
      for (const kw of COMMERCIAL_KEYWORDS) {
        const regex = new RegExp(kw, 'gi')
        const matches = text.match(regex)
        if (matches) hitCount += matches.length
      }
      if (hitCount >= 3) postsWithExcessCommercial++
    }
    const commercialRate = postsWithExcessCommercial / posts.length

    if (commercialRate >= 0.5) {
      score -= 2
      details.push(`상업적 키워드 남용: ${Math.round(commercialRate * 100)}%가 홍보성 키워드 과다 (-2)`)
      items.push({ label: `상업적 키워드 (${Math.round(commercialRate * 100)}%)`, points: -2 })
    } else if (commercialRate >= 0.25) {
      score -= 1
      details.push(`상업적 키워드 주의: ${Math.round(commercialRate * 100)}%가 홍보성 키워드 포함 (-1)`)
      items.push({ label: `상업적 키워드 (${Math.round(commercialRate * 100)}%)`, points: -1 })
    }
  }

  // === [감점] 제목 키워드 반복 스터핑 (0 ~ -2) ===
  // 동일 키워드가 제목의 대부분을 차지하는 패턴
  if (posts && posts.length >= 3) {
    let stuffedTitles = 0
    for (const p of posts) {
      const title = stripHtml(p.title)
      const words = extractKoreanKeywords(title)
      if (words.length >= 3) {
        // 같은 단어가 제목에 2회 이상 등장하면 스터핑
        const freq: Record<string, number> = {}
        words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
        const repeated = Object.values(freq).filter(c => c >= 2).length
        if (repeated >= 2) stuffedTitles++
      }
    }
    const stuffRate = stuffedTitles / posts.length

    if (stuffRate >= 0.4) {
      score -= 2
      details.push(`제목 키워드 반복: ${Math.round(stuffRate * 100)}%가 동일 키워드 반복 사용 (-2)`)
      items.push({ label: `제목 키워드 반복 (${Math.round(stuffRate * 100)}%)`, points: -2 })
    } else if (stuffRate >= 0.2) {
      score -= 1
      details.push(`제목 키워드 반복 주의: ${Math.round(stuffRate * 100)}% (-1)`)
      items.push({ label: `제목 키워드 반복 (${Math.round(stuffRate * 100)}%)`, points: -1 })
    }
  }

  // 최종 clamp
  score = Math.max(0, Math.min(maxScore, score))
  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return { name: 'SEO 최적화', score, maxScore, grade, details, items }
}
