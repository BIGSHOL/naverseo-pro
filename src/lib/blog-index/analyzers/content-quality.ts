/**
 * 블로그 지수 - 1. 콘텐츠 품질 분석 (D.I.A. proxy) — 30점
 *
 * 기술 문서 3절 근거:
 * - 문서 구조화 지수 (S_structure = w₁H + w₂Quotes + w₃Sep + w₄Caption)
 * - 텍스트-이미지 교차 비율 (이미지 1장당 300~500자 권장)
 * - 키워드 밀도 (TF-IDF 기반, 0.5%~3% 자연스러운 분포)
 * - 정보 충실성 (구체적 수치, 리스트, 가격 정보 포함 여부)
 */

import { stripHtml, countImageMarkers } from '@/lib/utils/text'
import type { BlogPost, AnalysisCategory } from '../types'

export function analyzeContentQuality(posts: BlogPost[]): AnalysisCategory {
  const maxScore = 30
  const details: string[] = []
  let score = 0

  if (posts.length === 0) {
    return { name: '콘텐츠 품질', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] }
  }

  // === 제목 품질 (6점) ===
  const avgTitleLen = posts.reduce((sum, p) => sum + stripHtml(p.title).length, 0) / posts.length
  if (avgTitleLen >= 15 && avgTitleLen <= 40) {
    score += 6
    details.push(`제목 길이 최적 (평균 ${Math.round(avgTitleLen)}자)`)
  } else if (avgTitleLen >= 10 && avgTitleLen <= 50) {
    score += 4
    details.push(`제목 길이 양호 (평균 ${Math.round(avgTitleLen)}자)`)
  } else {
    score += 1
    details.push(`제목 길이 개선 필요 (평균 ${Math.round(avgTitleLen)}자, 권장: 15~40자)`)
  }

  // === 콘텐츠 깊이 - 설명문 길이 (6점) ===
  const avgDescLen = posts.reduce((sum, p) => sum + stripHtml(p.description).length, 0) / posts.length
  if (avgDescLen >= 150) {
    score += 6
    details.push(`콘텐츠 깊이 우수 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  } else if (avgDescLen >= 100) {
    score += 4
    details.push(`콘텐츠 깊이 양호 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  } else if (avgDescLen >= 50) {
    score += 2
    details.push(`콘텐츠 깊이 보통 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  } else {
    score += 1
    details.push(`콘텐츠가 너무 짧습니다 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  }

  // === 이미지 분석 (6점) — v2 신규 ===
  // 기술 문서 3.2절: 텍스트-이미지 교차 비율, 이미지 독창성
  const imageCounts = posts.map(p => countImageMarkers(p.description))
  const avgImageCount = imageCounts.reduce((s, c) => s + c, 0) / posts.length
  const postsWithImages = imageCounts.filter(c => c > 0).length
  const imageRate = postsWithImages / posts.length

  if (imageRate >= 0.8 && avgImageCount >= 2) {
    score += 6
    details.push(`이미지 활용 우수 (${Math.round(imageRate * 100)}% 포스트에 평균 ${avgImageCount.toFixed(1)}장)`)
  } else if (imageRate >= 0.6 && avgImageCount >= 1) {
    score += 4
    details.push(`이미지 활용 양호 (${Math.round(imageRate * 100)}% 포스트에 이미지 포함)`)
  } else if (imageRate >= 0.3) {
    score += 2
    details.push(`이미지 활용 부족 (${Math.round(imageRate * 100)}% 포스트에만 이미지 포함)`)
  } else {
    score += 0
    details.push('이미지가 거의 없습니다 - 직접 촬영한 원본 이미지를 추가하세요')
  }

  // 텍스트-이미지 교차 비율 체크 (이미지가 있는 포스트 대상)
  // 기술 문서: 이미지 1장당 텍스트 300~500자가 이상적
  if (avgImageCount > 0) {
    const textPerImage = avgDescLen / avgImageCount
    if (textPerImage >= 200 && textPerImage <= 600) {
      details.push(`텍스트-이미지 비율 적정 (이미지당 ${Math.round(textPerImage)}자)`)
    } else if (textPerImage < 200) {
      details.push('이미지 대비 텍스트가 부족합니다 - 이미지당 300~500자를 권장합니다')
    }
  }

  // === 구조/서식 패턴 감지 (6점) — v2 신규 ===
  // 기술 문서 3.1.3절: S_structure = w₁(H_tags) + w₂(Quotes) + w₃(Separators) + w₄(Img_caption)
  let structureScore = 0
  const structureDetails: string[] = []

  // 리스트/번호 패턴 (구조화된 정보)
  const hasListPattern = posts.filter(p =>
    /[①②③④⑤⑥⑦⑧⑨⑩]|[1-9]\.\s|•|▶|■|★|✔|✅/.test(p.description)
  ).length
  if (hasListPattern >= posts.length * 0.5) {
    structureScore += 2
    structureDetails.push('리스트/번호 활용 우수')
  } else if (hasListPattern >= posts.length * 0.2) {
    structureScore += 1
    structureDetails.push('리스트/번호 활용 보통')
  }

  // 구체적 수치/데이터 포함 (가격, 시간, 거리 등)
  const hasConcreteData = posts.filter(p =>
    /\d+[만천백]?\s*원|₩\d|가격|비용|\d+분|\d+km|\d+[%퍼센트]/.test(p.description)
  ).length
  if (hasConcreteData >= posts.length * 0.4) {
    structureScore += 2
    structureDetails.push('구체적 수치/데이터 활용 우수')
  } else if (hasConcreteData >= posts.length * 0.15) {
    structureScore += 1
    structureDetails.push('구체적 수치/데이터 활용 보통')
  }

  // 서식 활용 (볼드, 링크 등)
  const hasFormatting = posts.filter(p =>
    /<b>|<strong>|<a\s|<em>|<mark>/.test(p.description)
  ).length
  if (hasFormatting >= posts.length * 0.3) {
    structureScore += 2
    structureDetails.push('서식 활용 우수')
  } else if (hasFormatting >= posts.length * 0.1) {
    structureScore += 1
  }

  score += structureScore
  if (structureDetails.length > 0) {
    details.push(structureDetails.join(', '))
  } else {
    details.push('콘텐츠 구조화가 부족합니다 - 리스트, 소제목, 구체적 수치를 활용하세요')
  }

  // === 제목 다양성 & 키워드 활용 (3점) ===
  const titleWords = new Set<string>()
  posts.forEach((p) => {
    const words = stripHtml(p.title).split(/\s+/)
    words.forEach((w) => { if (w.length >= 2) titleWords.add(w) })
  })
  const diversity = titleWords.size / posts.length
  if (diversity >= 3) {
    score += 3
    details.push('제목 키워드 다양성 우수')
  } else if (diversity >= 2) {
    score += 2
    details.push('제목 키워드 다양성 양호')
  } else {
    score += 1
    details.push('제목 키워드 다양성 부족 - 더 다양한 키워드를 활용하세요')
  }

  // === 정보 충실성 (3점) ===
  const hasNumbers = posts.filter((p) => /\d+/.test(p.description)).length
  if (hasNumbers >= posts.length * 0.5) {
    score += 3
    details.push('콘텐츠에 구체적 수치 활용 우수')
  } else if (hasNumbers >= posts.length * 0.2) {
    score += 1
    details.push('콘텐츠에 수치 활용 보통')
  }

  const grade = score >= 24 ? 'S' : score >= 18 ? 'A' : score >= 12 ? 'B' : score >= 6 ? 'C' : 'D'

  return { name: '콘텐츠 품질', score: Math.min(maxScore, score), maxScore, grade, details }
}
