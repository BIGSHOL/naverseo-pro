/**
 * 블로그 지수 - 축5. 검색 노출력 (15점)
 *
 * v12: 10→15 재분배. 검색 노출/순위의 영향력 강화.
 *      경쟁 키워드 가치 항목 삭제. 미측정=0점.
 *
 * 가점: 검색 순위(5) + 노출률(3) + TOP10 지배력(4) + 제목 키워드 최적화(3) = 15
 * 감점: 제목 특수문자 남용(-1) + 상업적 키워드 남용(-1) + 제목 키워드 반복(-1) = -3
 * 최종: clamp(가점 + 감점, 0, 15)
 */

import { stripHtml, extractKoreanKeywords } from '@/lib/utils/text'
import type { KeywordRankResult, KeywordCompetitionData, AnalysisCategory, BlogPost, ScoreItem } from '../types'

export function analyzeSearchPower(
  keywordResults: KeywordRankResult[],
  keywordCompetition?: KeywordCompetitionData[],
  posts?: BlogPost[],
): AnalysisCategory {
  const maxScore = 15
  const details: string[] = []
  const items: ScoreItem[] = []
  let score = 0

  if (keywordResults.length === 0) {
    return { name: '검색 노출력', score: 0, maxScore, grade: 'F', details: ['분석할 키워드 결과가 없습니다'], items: [] }
  }

  const ranked = keywordResults.filter((r) => r.rank !== null)
  const rankedCount = ranked.length
  const total = keywordResults.length
  const exposureRate = rankedCount / total

  // === 검색 순위 품질 (5점) ===
  let rankPts = 0
  if (rankedCount > 0) {
    const avgRank = ranked.reduce((sum, r) => sum + (r.rank || 0), 0) / rankedCount
    if (avgRank <= 10) rankPts = 5
    else if (avgRank <= 30) rankPts = 3
    else if (avgRank <= 50) rankPts = 1
    score += rankPts
    details.push(`평균 순위: ${Math.round(avgRank)}위 (+${rankPts})`)
    items.push({ label: `검색 순위 (평균 ${Math.round(avgRank)}위)`, points: rankPts })
  }

  // === 검색 노출률 (3점) ===
  let exposureScore = 0
  if (exposureRate >= 0.8) exposureScore = 3
  else if (exposureRate >= 0.4) exposureScore = 2
  score += exposureScore
  details.push(`검색 노출률: ${rankedCount}/${total} (${Math.round(exposureRate * 100)}%) (+${exposureScore})`)
  items.push({ label: `검색 노출률 (${Math.round(exposureRate * 100)}%)`, points: exposureScore })

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
    top10Pts = 1
    details.push(`TOP 10 키워드: ${top10}개 (+1)`)
  } else {
    details.push('TOP 10 노출 키워드 없음 (+0)')
  }
  score += top10Pts
  items.push({ label: `TOP 10 (${top10}개)`, points: top10Pts })

  // === 제목 키워드 최적화 (3점) ===
  let titleScore = 0
  if (posts && posts.length > 0) {
    const testKeywords = keywordResults.map(kr => kr.keyword.toLowerCase())
    let keywordInTitleCount = 0

    for (const post of posts) {
      const cleanTitle = stripHtml(post.title).toLowerCase()
      for (const kw of testKeywords) {
        const kwWords = extractKoreanKeywords(kw)
        if (kwWords.some(w => cleanTitle.includes(w))) {
          keywordInTitleCount++
          break
        }
      }
    }

    const keywordRate = keywordInTitleCount / posts.length

    if (keywordRate >= 0.6) {
      titleScore = 3
      details.push(`제목 키워드 최적화 우수 (+3)`)
    } else if (keywordRate >= 0.3) {
      titleScore = 2
      details.push(`제목 키워드 최적화 양호 (+2)`)
    } else {
      details.push(`제목에 핵심 키워드를 자연스럽게 포함하세요 (+0)`)
    }
  } else {
    // v11: 미측정=0점 (무상 점수 폐지)
    titleScore = 0
    details.push('포스트 데이터 없음 (+0)')
  }
  score += titleScore
  items.push({ label: '제목 키워드 최적화', points: titleScore })

  // === [감점] 제목 특수문자/이모지 남용 (0 ~ -1) ===
  if (posts && posts.length >= 3) {
    const specialCharTitles = posts.filter(p => {
      const title = stripHtml(p.title)
      const specialChars = title.match(/[★☆♥♡◆◇■□▶▷●○♠♣♦◈※☞→←↑↓⊙⊕⊗✔✖✦❤❥❣✨⭐🔥💯🎉🎊💥⚡]/g)
      return specialChars && specialChars.length >= 3
    }).length
    const specialCharRate = specialCharTitles / posts.length

    if (specialCharRate >= 0.4) {
      score -= 1
      details.push(`제목 특수문자 남용: ${Math.round(specialCharRate * 100)}% 과다 사용 (-1)`)
      items.push({ label: `제목 특수문자 (${Math.round(specialCharRate * 100)}%)`, points: -1 })
    }
  }

  // === [감점] 상업적/홍보성 키워드 남용 (0 ~ -1) ===
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

    if (commercialRate >= 0.4) {
      score -= 1
      details.push(`상업적 키워드 남용: ${Math.round(commercialRate * 100)}%가 홍보성 키워드 과다 (-1)`)
      items.push({ label: `상업적 키워드 (${Math.round(commercialRate * 100)}%)`, points: -1 })
    }
  }

  // === [감점] 제목 키워드 반복 스터핑 (0 ~ -1) ===
  if (posts && posts.length >= 3) {
    let stuffedTitles = 0
    for (const p of posts) {
      const title = stripHtml(p.title)
      const words = extractKoreanKeywords(title)
      if (words.length >= 3) {
        const freq: Record<string, number> = {}
        words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
        const repeated = Object.values(freq).filter(c => c >= 2).length
        if (repeated >= 2) stuffedTitles++
      }
    }
    const stuffRate = stuffedTitles / posts.length

    if (stuffRate >= 0.3) {
      score -= 1
      details.push(`제목 키워드 반복: ${Math.round(stuffRate * 100)}%가 동일 키워드 반복 사용 (-1)`)
      items.push({ label: `제목 키워드 반복 (${Math.round(stuffRate * 100)}%)`, points: -1 })
    }
  }

  // 최종 clamp
  score = Math.max(0, Math.min(maxScore, score))
  const grade = score >= 12 ? 'S' : score >= 9 ? 'A' : score >= 6 ? 'B' : score >= 3 ? 'C' : 'D'

  return { name: '검색 노출력', score, maxScore, grade, details, items }
}
