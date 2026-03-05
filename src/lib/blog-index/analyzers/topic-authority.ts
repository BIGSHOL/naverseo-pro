/**
 * 블로그 지수 - 축1. 주제 전문성 (40점)
 *
 * v15: 이중 측정 축소 + 실질 노력 항목 보강.
 *      일관성+카테고리 24→18점 축소, 시리즈+전문용어+품질일관 16→22점 보강.
 *
 * 가점: 주제 일관성(11) + 카테고리 집중도(7) + 시리즈 연속성(8) + 전문 용어(7) + 품질 일관성(7) = 40
 * 감점: 제목 유사도(-5) + 콘텐츠 중복(-5) = -10
 * 최종: clamp(가점 + 감점, 0, 40)
 */

import { stripHtml, extractKoreanKeywords, jaccardSimilarity, parsePostDate, daysBetween } from '@/lib/utils/text'
import type { BlogPost, AnalysisCategory, ScoreItem } from '../types'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'

export function analyzeTopicAuthority(
  posts: BlogPost[],
  scrapedData?: Map<string, ScrapedPostData> | null,
  blogName?: string | null,
  blogId?: string | null,
): { category: AnalysisCategory; topicKeywords: string[] } {
  const maxScore = 40
  const details: string[] = []
  const items: ScoreItem[] = []
  let score = 0
  const topicKeywords: string[] = []

  if (posts.length === 0) {
    return {
      category: { name: '주제 전문성', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'], items: [] },
      topicKeywords,
    }
  }

  // 브랜드 키워드 필터 (블로그명/ID에서 추출한 단어 제외)
  const brandKeywords = new Set<string>()
  const brandSources = [blogName, blogId].filter(Boolean) as string[]
  for (const src of brandSources) {
    const words = extractKoreanKeywords(src)
    words.forEach(w => brandKeywords.add(w))
  }

  // 포스트별 키워드 추출 (브랜드 제외)
  const wordFreq: Record<string, number> = {}
  const postKeywordSets: string[][] = []

  posts.forEach((p) => {
    const text = stripHtml(p.title) + ' ' + stripHtml(p.description)
    const words = extractKoreanKeywords(text)
    const uniqueWords = Array.from(new Set(words))
    postKeywordSets.push(uniqueWords)
    uniqueWords.forEach((w) => {
      if (!brandKeywords.has(w)) {
        wordFreq[w] = (wordFreq[w] || 0) + 1
      }
    })
  })

  const sortedKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)

  sortedKeywords.slice(0, 5).forEach(([word]) => topicKeywords.push(word))

  // === 주제 일관성 (11점) === (v15: 14→11, 카테고리와 이중 측정 축소)
  // 최빈 키워드의 포스트 등장 비율로 주제 집중도 측정
  let focusPts = 0
  if (sortedKeywords.length > 0) {
    const topKeyword = sortedKeywords[0]
    const topKeywordRate = topKeyword[1] / posts.length

    if (topKeywordRate > 0.8) {
      // v15: 과집중 구간 80%↑ → 5점 (스터핑 위험)
      focusPts = 5
      details.push(`키워드 과집중: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (스터핑 위험) (+5)`)
    } else if (topKeywordRate >= 0.7) {
      focusPts = 11
      details.push(`주제 일관성 최우수: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (최적 범위) (+11)`)
    } else if (topKeywordRate >= 0.58) {
      focusPts = 8
      details.push(`주제 일관성 우수: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (+8)`)
    } else if (topKeywordRate >= 0.48) {
      focusPts = 5
      details.push(`주제 일관성 양호: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (+5)`)
    } else if (topKeywordRate >= 0.38) {
      focusPts = 2
      details.push(`주제 일관성 보통: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (+2)`)
    } else {
      focusPts = 0
      details.push('주제가 분산됨 - 하나의 주제에 집중하면 C-Rank 향상에 도움 (+0)')
    }
  }
  score += focusPts
  items.push({ label: `주제 일관성`, points: focusPts })

  // === 카테고리 집중도 (7점) === (v15: 10→7, 이중 측정 축소)
  // 상위 3개 키워드가 전체 포스트를 얼마나 커버하는지
  let categoryPts = 0
  if (sortedKeywords.length >= 3) {
    const top3Keywords = sortedKeywords.slice(0, 3).map(([w]) => w)
    const coveredPosts = posts.filter((_, i) => {
      const kws = postKeywordSets[i] || []
      return top3Keywords.some(tk => kws.includes(tk))
    }).length
    const coverRate = coveredPosts / posts.length

    if (coverRate >= 0.92) {
      categoryPts = 7
      details.push(`카테고리 집중도 최우수: 상위 키워드가 ${Math.round(coverRate * 100)}% 포스트 커버 (+7)`)
    } else if (coverRate >= 0.82) {
      categoryPts = 5
      details.push(`카테고리 집중도 우수: 상위 키워드가 ${Math.round(coverRate * 100)}% 포스트 커버 (+5)`)
    } else if (coverRate >= 0.7) {
      categoryPts = 3
      details.push(`카테고리 집중도 양호: 상위 키워드가 ${Math.round(coverRate * 100)}% 포스트 커버 (+3)`)
    } else if (coverRate >= 0.55) {
      categoryPts = 1
      details.push(`카테고리 집중도 보통: 상위 키워드가 ${Math.round(coverRate * 100)}% 포스트 커버 (+1)`)
    } else {
      categoryPts = 0
      details.push(`카테고리가 분산됨: 상위 키워드가 ${Math.round(coverRate * 100)}% 포스트만 커버 (+0)`)
    }
  } else if (sortedKeywords.length > 0) {
    categoryPts = 0
    details.push('키워드가 부족하여 카테고리 집중도 측정 불가 (+0)')
  }
  score += categoryPts
  items.push({ label: '카테고리 집중도', points: categoryPts })

  // === 시리즈 연속성 (8점) === (v15: 6→8, 실제 노력 필요 항목 보강)
  // 7일 이내 연속 게시된 유사 주제 포스트 쌍 수
  let seriesPts = 0
  if (posts.length >= 3) {
    const datedPosts = posts.map((p, i) => ({
      date: parsePostDate(p.postdate),
      keywords: postKeywordSets[i] || [],
    })).filter(p => !isNaN(p.date.getTime()))
      .sort((a, b) => b.date.getTime() - a.date.getTime())

    let seriesPairs = 0
    for (let i = 0; i < datedPosts.length - 1; i++) {
      const dayGap = daysBetween(datedPosts[i].date, datedPosts[i + 1].date)
      if (dayGap <= 7 && datedPosts[i].keywords.length >= 2 && datedPosts[i + 1].keywords.length >= 2) {
        const sim = jaccardSimilarity(datedPosts[i].keywords, datedPosts[i + 1].keywords)
        if (sim >= 0.3) seriesPairs++
      }
    }

    if (seriesPairs >= 7) {
      seriesPts = 8
      details.push(`시리즈 연속성 최우수: ${seriesPairs}쌍의 연속 주제 포스트 (+8)`)
    } else if (seriesPairs >= 5) {
      seriesPts = 6
      details.push(`시리즈 연속성 우수: ${seriesPairs}쌍의 연속 주제 포스트 (+6)`)
    } else if (seriesPairs >= 3) {
      seriesPts = 3
      details.push(`시리즈 연속성 양호: ${seriesPairs}쌍의 연속 주제 포스트 (+3)`)
    } else if (seriesPairs >= 1) {
      seriesPts = 1
      details.push(`시리즈 연속성 보통: ${seriesPairs}쌍의 연속 주제 포스트 (+1)`)
    } else {
      details.push('시리즈 포스팅 없음 - 같은 주제로 연속 포스팅하면 C-Rank 전문성이 높아집니다 (+0)')
    }
  }
  score += seriesPts
  items.push({ label: '시리즈 연속성', points: seriesPts })

  // === 전문 용어 (7점) === (v15: 5→7, 차별화 요소 보강)
  // 6음절 이상 전문어/복합어가 4개 이상 포함된 포스트 비율
  let termPts = 0
  if (posts.length >= 3) {
    const postsWithTerms = posts.filter(p => {
      const text = stripHtml(p.title) + ' ' + stripHtml(p.description)
      const words = extractKoreanKeywords(text)
      const longWords = words.filter(w => w.length >= 6)
      return longWords.length >= 4
    }).length
    const termRate = postsWithTerms / posts.length

    if (termRate >= 0.7) {
      termPts = 7
      details.push(`전문 용어 활용 최우수: ${Math.round(termRate * 100)}% 포스트에 전문어 포함 (+7)`)
    } else if (termRate >= 0.5) {
      termPts = 4
      details.push(`전문 용어 활용 양호: ${Math.round(termRate * 100)}% 포스트에 전문어 포함 (+4)`)
    } else if (termRate >= 0.3) {
      termPts = 2
      details.push(`전문 용어 활용 부족: ${Math.round(termRate * 100)}% 포스트에 전문어 포함 (+2)`)
    } else {
      details.push(`전문 용어 부족: 전문적인 용어와 구체적 정보를 더 활용하세요 (+0)`)
    }
  }
  score += termPts
  items.push({ label: '전문 용어', points: termPts })

  // === 품질 일관성 (7점) === (v15: 5→7, 꾸준함 보강)
  // 콘텐츠 길이의 변동계수(CV)로 측정
  let consistencyPts = 0
  const contentLengths: number[] = []

  if (scrapedData && scrapedData.size > 0) {
    Array.from(scrapedData.values()).forEach(p => contentLengths.push(p.charCount))
  } else {
    posts.forEach(p => contentLengths.push(stripHtml(p.description).length))
  }

  if (contentLengths.length >= 3) {
    const avgLen = contentLengths.reduce((s, l) => s + l, 0) / contentLengths.length
    const variance = contentLengths.reduce((s, l) => s + Math.pow(l - avgLen, 2), 0) / contentLengths.length
    const stdDev = Math.sqrt(variance)
    const cv = avgLen > 0 ? stdDev / avgLen : 0

    // v15: CV<0.15 만점 (더 엄격한 일관성 요구)
    if (cv < 0.15) {
      consistencyPts = 7
      details.push('품질 일관성 최우수 (+7)')
    } else if (cv < 0.25) {
      consistencyPts = 5
      details.push('품질 일관성 우수 (+5)')
    } else if (cv < 0.45) {
      consistencyPts = 2
      details.push('품질 일관성 보통 (+2)')
    } else {
      details.push('품질 일관성 부족 - 글마다 길이 차이가 큽니다 (+0)')
    }
  }
  score += consistencyPts
  items.push({ label: '품질 일관성', points: consistencyPts })

  // === [감점] 제목 유사도 (0 ~ -5) === (v14: -4→-5)
  if (posts.length >= 3) {
    const titleWordSets = posts.map(p => extractKoreanKeywords(stripHtml(p.title)))
    let highSimilarityCount = 0
    let totalPairs = 0

    for (let i = 0; i < titleWordSets.length; i++) {
      for (let j = i + 1; j < titleWordSets.length; j++) {
        const sim = jaccardSimilarity(titleWordSets[i], titleWordSets[j])
        if (sim >= 0.7) highSimilarityCount++
        totalPairs++
      }
    }

    if (totalPairs > 0) {
      const similarRate = highSimilarityCount / totalPairs
      if (similarRate >= 0.5) {
        score -= 5
        details.push(`제목 유사도 매우 높음: ${Math.round(similarRate * 100)}% 유사 (템플릿 의심) (-5)`)
        items.push({ label: `제목 유사도 (${Math.round(similarRate * 100)}% 유사)`, points: -5 })
      } else if (similarRate >= 0.3) {
        score -= 3
        details.push(`제목 유사도 높음: ${Math.round(similarRate * 100)}% 유사 (-3)`)
        items.push({ label: `제목 유사도 (${Math.round(similarRate * 100)}% 유사)`, points: -3 })
      } else if (similarRate >= 0.15) {
        score -= 1
        details.push(`일부 제목이 유사합니다 (-1)`)
        items.push({ label: '제목 유사도', points: -1 })
      }
    }
  }

  // === [감점] 콘텐츠 중복 (0 ~ -5) === (v14: -4→-5)
  if (posts.length >= 3) {
    let contentDupPts = 0

    if (scrapedData && scrapedData.size >= 3) {
      const descKeywordSets = posts.slice(0, 15).map(p =>
        extractKoreanKeywords(stripHtml(p.description).substring(0, 200))
      )
      let highSimPairs = 0
      let totalComparisons = 0
      for (let i = 0; i < descKeywordSets.length; i++) {
        for (let j = i + 1; j < descKeywordSets.length; j++) {
          if (descKeywordSets[i].length >= 3 && descKeywordSets[j].length >= 3) {
            const sim = jaccardSimilarity(descKeywordSets[i], descKeywordSets[j])
            if (sim >= 0.6) highSimPairs++
            totalComparisons++
          }
        }
      }
      if (totalComparisons > 0) {
        const simRate = highSimPairs / totalComparisons
        if (simRate >= 0.4) {
          contentDupPts = -5
          details.push(`본문 콘텐츠 중복 심각: ${Math.round(simRate * 100)}% 유사 (-5)`)
        } else if (simRate >= 0.2) {
          contentDupPts = -3
          details.push(`본문 콘텐츠 일부 중복: ${Math.round(simRate * 100)}% 유사 (-3)`)
        }
      }
    } else {
      // 폴백: 설명문 첫 50자 비교
      const descSnippets = posts.map(p => stripHtml(p.description).substring(0, 50))
      const snippetFreq: Record<string, number> = {}
      descSnippets.forEach(s => {
        if (s.length >= 20) snippetFreq[s] = (snippetFreq[s] || 0) + 1
      })
      const duplicateCount = Object.values(snippetFreq).filter(c => c >= 2).reduce((s, c) => s + c, 0)
      if (duplicateCount >= posts.length * 0.5) {
        contentDupPts = -5
        details.push(`설명문 반복 패턴 심각: ${duplicateCount}개 포스트 유사 (-5)`)
      } else if (duplicateCount >= posts.length * 0.3) {
        contentDupPts = -3
        details.push(`설명문 반복 패턴 주의: ${duplicateCount}개 포스트 유사 (-3)`)
      }
    }

    if (contentDupPts < 0) {
      score += contentDupPts
      items.push({ label: '콘텐츠 중복', points: contentDupPts })
    }
  }

  // 최종 clamp
  score = Math.max(0, Math.min(maxScore, score))
  const grade = score >= 32 ? 'S' : score >= 24 ? 'A' : score >= 16 ? 'B' : score >= 8 ? 'C' : 'D'

  return {
    category: { name: '주제 전문성', score, maxScore, grade, details, items },
    topicKeywords,
  }
}
