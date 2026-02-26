/**
 * 블로그 지수 - 축3. 주제 전문성 분석 (C-Rank proxy) — 20점 (v5: 10→20 독립 축)
 *
 * 집중도(12) + 일관성(8)
 */

import { stripHtml, extractKoreanKeywords } from '@/lib/utils/text'
import type { BlogPost, AnalysisCategory } from '../types'

export function analyzeTopicAuthority(
  posts: BlogPost[],
  blogName?: string | null,
  blogId?: string | null,
): { category: AnalysisCategory; topicKeywords: string[] } {
  const maxScore = 20
  const details: string[] = []
  let score = 0
  const topicKeywords: string[] = []

  if (posts.length === 0) {
    return {
      category: { name: '주제 전문성', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] },
      topicKeywords,
    }
  }

  // 블로그명/상호명에서 브랜드 키워드 추출 (이들은 주제 집중도 계산에서 제외)
  const brandKeywords = new Set<string>()
  const brandSources = [blogName, blogId].filter(Boolean) as string[]
  for (const src of brandSources) {
    const words = extractKoreanKeywords(src)
    words.forEach(w => brandKeywords.add(w))
  }

  // 모든 제목+설명에서 키워드 추출
  const wordFreq: Record<string, number> = {}

  posts.forEach((p) => {
    const text = stripHtml(p.title) + ' ' + stripHtml(p.description)
    const words = extractKoreanKeywords(text)
    const uniqueWords = Array.from(new Set(words))
    uniqueWords.forEach((w) => {
      if (!brandKeywords.has(w)) {
        wordFreq[w] = (wordFreq[w] || 0) + 1
      }
    })
  })

  const sorted = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)

  sorted.slice(0, 5).forEach(([word]) => topicKeywords.push(word))

  if (brandKeywords.size > 0) {
    details.push(`브랜드 키워드 제외: ${Array.from(brandKeywords).slice(0, 3).join(', ')}`)
  }

  // === 주제 집중도 (12점) ===
  if (sorted.length > 0) {
    const topKeyword = sorted[0]
    const topKeywordRate = topKeyword[1] / posts.length

    if (topKeywordRate >= 0.7) {
      score += 12
      details.push(`주제 집중도 최우수: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else if (topKeywordRate >= 0.5) {
      score += 9
      details.push(`주제 집중도 우수: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else if (topKeywordRate >= 0.3) {
      score += 6
      details.push(`주제 집중도 양호: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else if (topKeywordRate >= 0.15) {
      score += 3
      details.push(`주제 집중도 보통: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else {
      score += 1
      details.push('주제가 분산되어 있습니다 - 하나의 주제에 집중하면 C-Rank 향상에 도움됩니다')
    }
  }

  // === 키워드 일관성 (8점) ===
  if (sorted.length >= 3) {
    const top3Coverage = sorted.slice(0, 3).reduce((sum, [, count]) => sum + count, 0) / (posts.length * 3)
    if (top3Coverage >= 0.5) {
      score += 8
      details.push(`핵심 키워드 일관성 우수 (${sorted.slice(0, 3).map(([w]) => w).join(', ')})`)
    } else if (top3Coverage >= 0.3) {
      score += 5
      details.push('핵심 키워드 일관성 양호')
    } else if (top3Coverage >= 0.15) {
      score += 3
      details.push('핵심 키워드 일관성 보통')
    } else {
      score += 1
      details.push('핵심 키워드 일관성 부족 - 관련 키워드를 반복 활용하세요')
    }
  }

  const grade = score >= 16 ? 'S' : score >= 12 ? 'A' : score >= 8 ? 'B' : score >= 4 ? 'C' : 'D'

  return {
    category: { name: '주제 전문성', score: Math.min(maxScore, score), maxScore, grade, details },
    topicKeywords,
  }
}
