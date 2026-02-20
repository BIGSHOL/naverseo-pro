/**
 * 블로그 지수 - 2. 주제 전문성 분석 (C-Rank proxy) — 25점
 *
 * 기술 문서 1.1절 근거:
 * - Context(맥락): 카테고리 일관성 비율 → 주제 집중도
 * - Content(내용): 전체 글 대비 상위 노출 비율 → 키워드 일관성
 * - Chain(연결): 이웃의 질적 수준 → 현재 API로 측정 불가, Co-occurrence로 대체
 *
 * 기술 문서 3.1.2절:
 * - Co-occurrence Analysis: 타겟 키워드와 함께 등장하는 연관 단어 분석
 */

import { stripHtml, extractKoreanKeywords } from '@/lib/utils/text'
import type { BlogPost, AnalysisCategory } from '../types'

export function analyzeTopicAuthority(posts: BlogPost[]): { category: AnalysisCategory; topicKeywords: string[] } {
  const maxScore = 25
  const details: string[] = []
  let score = 0
  const topicKeywords: string[] = []

  if (posts.length === 0) {
    return {
      category: { name: '주제 전문성', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] },
      topicKeywords,
    }
  }

  // 모든 제목+설명에서 키워드 추출 (불용어 제거)
  const wordFreq: Record<string, number> = {}
  // 포스트별 키워드 셋 (co-occurrence 분석용)
  const postKeywordSets: string[][] = []

  posts.forEach((p) => {
    const text = stripHtml(p.title) + ' ' + stripHtml(p.description)
    const words = extractKoreanKeywords(text)
    const uniqueWords = Array.from(new Set(words))
    postKeywordSets.push(uniqueWords)
    uniqueWords.forEach((w) => {
      wordFreq[w] = (wordFreq[w] || 0) + 1
    })
  })

  // 상위 빈출 키워드 추출
  const sorted = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)

  sorted.slice(0, 5).forEach(([word]) => topicKeywords.push(word))

  // === 주제 집중도 (12점) ===
  // 기술 문서 1.1.1: Concentration Ratio — 특정 주제에 집중하는가?
  if (sorted.length > 0) {
    const topKeyword = sorted[0]
    const topKeywordRate = topKeyword[1] / posts.length

    if (topKeywordRate >= 0.7) {
      score += 12
      details.push(`주제 집중도 우수: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else if (topKeywordRate >= 0.5) {
      score += 9
      details.push(`주제 집중도 양호: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else if (topKeywordRate >= 0.3) {
      score += 6
      details.push(`주제 집중도 보통: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else {
      score += 3
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
    } else {
      score += 2
      details.push('핵심 키워드 일관성 부족 - 관련 키워드를 반복 활용하세요')
    }
  }

  // === Co-occurrence 연관어 분석 (5점) — v2 신규 ===
  // 기술 문서 3.1.2절: 타겟 키워드와 함께 등장하는 연관 단어 분석
  // 상위 키워드와 자주 함께 등장하는 연관 키워드가 있으면 문맥 점수 높음
  if (sorted.length >= 2 && postKeywordSets.length >= 3) {
    const topWord = sorted[0][0]
    const coOccurrence: Record<string, number> = {}

    // 상위 키워드가 등장하는 포스트에서 함께 등장하는 단어 카운트
    postKeywordSets.forEach((kwSet) => {
      if (kwSet.includes(topWord)) {
        kwSet.forEach((w) => {
          if (w !== topWord) {
            coOccurrence[w] = (coOccurrence[w] || 0) + 1
          }
        })
      }
    })

    // 연관 키워드 빈도 분석: 상위 키워드와 50% 이상 동반 등장하는 단어 수
    const topWordCount = sorted[0][1]
    const strongCoWords = Object.entries(coOccurrence)
      .filter(([, count]) => count >= topWordCount * 0.4)
      .length

    if (strongCoWords >= 5) {
      score += 5
      details.push(`연관 키워드 체계 우수 (${strongCoWords}개 키워드가 주제와 강하게 연결)`)
    } else if (strongCoWords >= 3) {
      score += 3
      details.push(`연관 키워드 체계 양호 (${strongCoWords}개 키워드 연결)`)
    } else if (strongCoWords >= 1) {
      score += 1
      details.push('연관 키워드가 부족합니다 - 주제와 관련된 다양한 세부 키워드를 활용하세요')
    } else {
      details.push('연관 키워드 체계 없음 - 하나의 주제를 다양한 각도로 다뤄보세요')
    }
  }

  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return {
    category: { name: '주제 전문성', score: Math.min(maxScore, score), maxScore, grade, details },
    topicKeywords,
  }
}
