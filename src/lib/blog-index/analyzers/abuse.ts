/**
 * 블로그 지수 - P. 어뷰징 감점 분석 — 최대 -20점 (v2 신규)
 *
 * 기술 문서 1.2.1절 & 4.2절 근거:
 * - 어뷰징 척도: 기계적 패턴, 숨겨진 텍스트, 무의미한 키워드 반복 감지
 * - P(Abuse): 키워드 과다 반복시 점수를 0으로 수렴시키는 강력한 감점 요인
 *
 * 3가지 어뷰징 유형 감지:
 * 1. 키워드 스터핑: 제목에 동일 키워드 과다 반복
 * 2. 제목 유사도: 템플릿처럼 찍어내는 제목 패턴
 * 3. 설명문 반복 패턴: 동일한 문구/구조 반복
 */

import { stripHtml, extractKoreanKeywords, jaccardSimilarity } from '@/lib/utils/text'
import type { BlogPost, AbusePenalty } from '../types'

export function analyzeAbuse(posts: BlogPost[]): AbusePenalty {
  let score = 0  // 0 ~ -20
  const details: string[] = []
  const flags: string[] = []

  if (posts.length < 3) {
    return { score: 0, details: ['포스트가 적어 어뷰징 분석 생략'], flags: [] }
  }

  // === 1. 키워드 스터핑 감지 (-7점 max) ===
  // 기술 문서 3.1.2: 0.5%~3% 키워드 밀도가 자연스러운 분포
  // 동일 단어가 전체 제목의 80% 이상에 등장하면 과다 반복
  const titleKeywordFreq: Record<string, number> = {}
  posts.forEach((p) => {
    const words = extractKoreanKeywords(stripHtml(p.title))
    const unique = new Set(words)
    unique.forEach((w) => {
      titleKeywordFreq[w] = (titleKeywordFreq[w] || 0) + 1
    })
  })

  const titleSorted = Object.entries(titleKeywordFreq).sort((a, b) => b[1] - a[1])
  if (titleSorted.length > 0) {
    const topRate = titleSorted[0][1] / posts.length
    if (topRate >= 0.9) {
      score -= 7
      details.push(`키워드 과다 반복 심각: "${titleSorted[0][0]}" 키워드가 제목의 ${Math.round(topRate * 100)}%에 등장`)
      flags.push('keyword_stuffing')
    } else if (topRate >= 0.8) {
      score -= 4
      details.push(`키워드 반복 주의: "${titleSorted[0][0]}" 키워드가 제목의 ${Math.round(topRate * 100)}%에 등장`)
      flags.push('keyword_stuffing')
    }
  }

  // 설명문에서의 키워드 밀도 체크
  if (titleSorted.length > 0) {
    const topWord = titleSorted[0][0]
    const allDescText = posts.map(p => stripHtml(p.description)).join(' ')
    const allWords = extractKoreanKeywords(allDescText)
    const topWordInDesc = allWords.filter(w => w === topWord).length
    const density = allWords.length > 0 ? topWordInDesc / allWords.length : 0

    if (density > 0.05) {  // 5% 초과
      score -= 3
      details.push(`본문 키워드 밀도 과다: "${topWord}" ${(density * 100).toFixed(1)}% (권장: 0.5~3%)`)
      if (!flags.includes('keyword_stuffing')) flags.push('keyword_stuffing')
    }
  }

  // === 2. 제목 유사도 감지 (-7점 max) ===
  // 템플릿 형태로 찍어내는 제목 감지 (Jaccard 유사도)
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
      score -= 7
      details.push(`제목 유사도 매우 높음: ${Math.round(similarRate * 100)}%의 제목 쌍이 유사 (템플릿 의심)`)
      flags.push('title_template')
    } else if (similarRate >= 0.3) {
      score -= 4
      details.push(`제목 유사도 높음: ${Math.round(similarRate * 100)}%의 제목 쌍이 유사`)
      flags.push('title_template')
    } else if (similarRate >= 0.15) {
      score -= 2
      details.push(`일부 제목이 유사합니다 - 더 다양한 제목 패턴을 사용하세요`)
    }
  }

  // === 3. 설명문 반복 패턴 감지 (-6점 max) ===
  // 동일한 문구가 여러 포스트에서 반복되면 복사-붙여넣기 의심
  const descSnippets = posts.map(p => {
    const clean = stripHtml(p.description)
    return clean.substring(0, 50) // 첫 50자로 비교
  })

  const snippetFreq: Record<string, number> = {}
  descSnippets.forEach(s => {
    if (s.length >= 20) {
      snippetFreq[s] = (snippetFreq[s] || 0) + 1
    }
  })

  const duplicateSnippets = Object.values(snippetFreq).filter(c => c >= 2)
  const duplicateCount = duplicateSnippets.reduce((s, c) => s + c, 0)

  if (duplicateCount >= posts.length * 0.5) {
    score -= 6
    details.push(`설명문 반복 패턴 심각: ${duplicateCount}개 포스트가 유사한 시작 문구 사용`)
    flags.push('content_duplication')
  } else if (duplicateCount >= posts.length * 0.3) {
    score -= 3
    details.push(`설명문 반복 패턴 주의: ${duplicateCount}개 포스트가 유사한 시작 문구 사용`)
    flags.push('content_duplication')
  }

  // 감점이 없으면 긍정적 메시지
  if (score === 0) {
    details.push('어뷰징 패턴이 감지되지 않았습니다')
  }

  // 최소값 -20으로 제한
  return { score: Math.max(-20, score), details, flags }
}
