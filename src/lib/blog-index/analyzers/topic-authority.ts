/**
 * 블로그 지수 - 축1. 주제 전문성 (30점)
 *
 * v11: C-Rank 알고리즘 핵심 축. content-quality에서 주제/일관성 코드를 이동 + 확장.
 *
 * 가점: 주제 일관성(10) + 카테고리 집중도(8) + 시리즈 연속성(5) + 전문 용어(4) + 품질 일관성(3) = 30
 * 감점: 제목 유사도(-3) + 콘텐츠 중복(-3) = -6
 * 최종: clamp(가점 + 감점, 0, 30)
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
  const maxScore = 30
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

  // === 주제 일관성 (10점) ===
  // 최빈 키워드의 포스트 등장 비율로 주제 집중도 측정 (v11.1 기준 강화)
  let focusPts = 0
  if (sortedKeywords.length > 0) {
    const topKeyword = sortedKeywords[0]
    const topKeywordRate = topKeyword[1] / posts.length

    if (topKeywordRate >= 0.5 && topKeywordRate <= 0.7) {
      focusPts = 10
      details.push(`주제 일관성 최우수: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (최적 범위) (+10)`)
    } else if (topKeywordRate >= 0.4 && topKeywordRate < 0.5) {
      focusPts = 7
      details.push(`주제 일관성 우수: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (+7)`)
    } else if (topKeywordRate > 0.7 && topKeywordRate <= 0.8) {
      focusPts = 6
      details.push(`주제 일관성 양호: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (약간 높음) (+6)`)
    } else if (topKeywordRate >= 0.3 && topKeywordRate < 0.4) {
      focusPts = 4
      details.push(`주제 일관성 보통: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (+4)`)
    } else if (topKeywordRate > 0.8) {
      focusPts = 2
      details.push(`키워드 과집중: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (스터핑 위험) (+2)`)
    } else {
      focusPts = 1
      details.push('주제가 분산됨 - 하나의 주제에 집중하면 C-Rank 향상에 도움 (+1)')
    }
  }
  score += focusPts
  items.push({ label: `주제 일관성`, points: focusPts })

  // === 카테고리 집중도 (8점) ===
  // 상위 3개 키워드가 전체 포스트를 얼마나 커버하는지 (v11.1 기준 강화)
  let categoryPts = 0
  if (sortedKeywords.length >= 3) {
    const top3Keywords = sortedKeywords.slice(0, 3).map(([w]) => w)
    const coveredPosts = posts.filter((_, i) => {
      const kws = postKeywordSets[i] || []
      return top3Keywords.some(tk => kws.includes(tk))
    }).length
    const coverRate = coveredPosts / posts.length

    if (coverRate >= 0.75) {
      categoryPts = 8
      details.push(`카테고리 집중도 최우수: 상위 키워드가 ${Math.round(coverRate * 100)}% 포스트 커버 (+8)`)
    } else if (coverRate >= 0.6) {
      categoryPts = 6
      details.push(`카테고리 집중도 우수: 상위 키워드가 ${Math.round(coverRate * 100)}% 포스트 커버 (+6)`)
    } else if (coverRate >= 0.45) {
      categoryPts = 4
      details.push(`카테고리 집중도 양호: 상위 키워드가 ${Math.round(coverRate * 100)}% 포스트 커버 (+4)`)
    } else if (coverRate >= 0.3) {
      categoryPts = 2
      details.push(`카테고리 집중도 보통: 상위 키워드가 ${Math.round(coverRate * 100)}% 포스트 커버 (+2)`)
    } else {
      categoryPts = 0
      details.push(`카테고리가 분산됨: 상위 키워드가 ${Math.round(coverRate * 100)}% 포스트만 커버 (+0)`)
    }
  } else if (sortedKeywords.length > 0) {
    categoryPts = 1
    details.push('키워드가 부족하여 카테고리 집중도 측정 제한 (+1)')
  }
  score += categoryPts
  items.push({ label: '카테고리 집중도', points: categoryPts })

  // === 시리즈 연속성 (5점) ===
  // 7일 이내 연속 게시된 유사 주제 포스트 쌍 수 (v11.1 기준 강화)
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

    if (seriesPairs >= 5) {
      seriesPts = 5
      details.push(`시리즈 연속성 최우수: ${seriesPairs}쌍의 연속 주제 포스트 (+5)`)
    } else if (seriesPairs >= 3) {
      seriesPts = 3
      details.push(`시리즈 연속성 우수: ${seriesPairs}쌍의 연속 주제 포스트 (+3)`)
    } else if (seriesPairs >= 2) {
      seriesPts = 2
      details.push(`시리즈 연속성 양호: ${seriesPairs}쌍의 연속 주제 포스트 (+2)`)
    } else if (seriesPairs >= 1) {
      seriesPts = 1
      details.push(`시리즈 연속성 보통: ${seriesPairs}쌍의 연속 주제 포스트 (+1)`)
    } else {
      details.push('시리즈 포스팅 없음 - 같은 주제로 연속 포스팅하면 C-Rank 전문성이 높아집니다 (+0)')
    }
  }
  score += seriesPts
  items.push({ label: '시리즈 연속성', points: seriesPts })

  // === 전문 용어 (4점) ===
  // 4음절 이상 전문어/복합어가 포함된 포스트 비율
  let termPts = 0
  if (posts.length >= 3) {
    const postsWithTerms = posts.filter(p => {
      const text = stripHtml(p.title) + ' ' + stripHtml(p.description)
      const words = extractKoreanKeywords(text)
      // 4음절 이상인 단어가 2개 이상이면 전문 용어 포함으로 판단
      const longWords = words.filter(w => w.length >= 4)
      return longWords.length >= 2
    }).length
    const termRate = postsWithTerms / posts.length

    if (termRate >= 0.6) {
      termPts = 4
      details.push(`전문 용어 활용 우수: ${Math.round(termRate * 100)}% 포스트에 전문어 포함 (+4)`)
    } else if (termRate >= 0.4) {
      termPts = 2
      details.push(`전문 용어 활용 보통: ${Math.round(termRate * 100)}% 포스트에 전문어 포함 (+2)`)
    } else {
      details.push(`전문 용어 부족: 전문적인 용어와 구체적 정보를 더 활용하세요 (+0)`)
    }
  }
  score += termPts
  items.push({ label: '전문 용어', points: termPts })

  // === 품질 일관성 (3점) ===
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

    if (cv < 0.25) {
      consistencyPts = 3
      details.push('품질 일관성 최우수 (+3)')
    } else if (cv < 0.5) {
      consistencyPts = 2
      details.push('품질 일관성 우수 (+2)')
    } else if (cv < 0.8) {
      consistencyPts = 1
      details.push('품질 일관성 보통 (+1)')
    } else {
      details.push('품질 일관성 부족 - 글마다 길이 차이가 큽니다 (+0)')
    }
  }
  score += consistencyPts
  items.push({ label: '품질 일관성', points: consistencyPts })

  // === [감점] 제목 유사도 (0 ~ -3) ===
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
        score -= 3
        details.push(`제목 유사도 매우 높음: ${Math.round(similarRate * 100)}% 유사 (템플릿 의심) (-3)`)
        items.push({ label: `제목 유사도 (${Math.round(similarRate * 100)}% 유사)`, points: -3 })
      } else if (similarRate >= 0.3) {
        score -= 2
        details.push(`제목 유사도 높음: ${Math.round(similarRate * 100)}% 유사 (-2)`)
        items.push({ label: `제목 유사도 (${Math.round(similarRate * 100)}% 유사)`, points: -2 })
      } else if (similarRate >= 0.15) {
        score -= 1
        details.push(`일부 제목이 유사합니다 (-1)`)
        items.push({ label: '제목 유사도', points: -1 })
      }
    }
  }

  // === [감점] 콘텐츠 중복 (0 ~ -3) ===
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
          contentDupPts = -3
          details.push(`본문 콘텐츠 중복 심각: ${Math.round(simRate * 100)}% 유사 (-3)`)
        } else if (simRate >= 0.2) {
          contentDupPts = -2
          details.push(`본문 콘텐츠 일부 중복: ${Math.round(simRate * 100)}% 유사 (-2)`)
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
        contentDupPts = -3
        details.push(`설명문 반복 패턴 심각: ${duplicateCount}개 포스트 유사 (-3)`)
      } else if (duplicateCount >= posts.length * 0.3) {
        contentDupPts = -2
        details.push(`설명문 반복 패턴 주의: ${duplicateCount}개 포스트 유사 (-2)`)
      }
    }

    if (contentDupPts < 0) {
      score += contentDupPts
      items.push({ label: '콘텐츠 중복', points: contentDupPts })
    }
  }

  // 최종 clamp
  score = Math.max(0, Math.min(maxScore, score))
  const grade = score >= 24 ? 'S' : score >= 18 ? 'A' : score >= 12 ? 'B' : score >= 6 ? 'C' : 'D'

  return {
    category: { name: '주제 전문성', score, maxScore, grade, details, items },
    topicKeywords,
  }
}
