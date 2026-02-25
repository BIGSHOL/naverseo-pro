/**
 * 블로그 지수 - 축2. 콘텐츠 품질 분석 (D.I.A. proxy) — 20점 (v5: 10→20 독립 축)
 *
 * 깊이(8) + 이미지(6) + 구조(6)
 */

import { stripHtml, countImageMarkers } from '@/lib/utils/text'
import type { BlogPost, AnalysisCategory } from '../types'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'

export function analyzeContentQuality(
  posts: BlogPost[],
  scrapedData?: Map<string, ScrapedPostData> | null
): AnalysisCategory {
  const maxScore = 20
  const details: string[] = []
  let score = 0

  if (posts.length === 0) {
    return { name: '콘텐츠 품질', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] }
  }

  // === 콘텐츠 깊이 (8점) - 실제 본문 우선, 없으면 RSS 미리보기 ===
  let avgContentLen = 0
  let isActualContent = false

  if (scrapedData && scrapedData.size > 0) {
    const scrapedPosts = Array.from(scrapedData.values())
    avgContentLen = scrapedPosts.reduce((sum, p) => sum + p.charCount, 0) / scrapedPosts.length
    isActualContent = true
  } else {
    avgContentLen = posts.reduce((sum, p) => sum + stripHtml(p.description).length, 0) / posts.length
    isActualContent = false
  }

  if (isActualContent) {
    if (avgContentLen >= 2000) {
      score += 8
      details.push(`콘텐츠 깊이 최우수 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자)`)
    } else if (avgContentLen >= 1500) {
      score += 6
      details.push(`콘텐츠 깊이 우수 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자)`)
    } else if (avgContentLen >= 1000) {
      score += 4
      details.push(`콘텐츠 깊이 양호 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자)`)
    } else if (avgContentLen >= 500) {
      score += 2
      details.push(`콘텐츠 깊이 보통 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자)`)
    } else {
      score += 1
      details.push(`콘텐츠가 짧습니다 (본문 평균 ${Math.round(avgContentLen)}자, 권장: 1500자 이상)`)
    }
  } else {
    if (avgContentLen >= 200) {
      score += 8
      details.push(`콘텐츠 깊이 최우수 (미리보기 평균 ${Math.round(avgContentLen)}자)`)
    } else if (avgContentLen >= 150) {
      score += 6
      details.push(`콘텐츠 깊이 우수 (미리보기 평균 ${Math.round(avgContentLen)}자)`)
    } else if (avgContentLen >= 100) {
      score += 4
      details.push(`콘텐츠 깊이 양호 (미리보기 평균 ${Math.round(avgContentLen)}자)`)
    } else if (avgContentLen >= 50) {
      score += 2
      details.push(`콘텐츠 깊이 보통 (미리보기 평균 ${Math.round(avgContentLen)}자)`)
    } else {
      score += 1
      details.push(`콘텐츠가 짧습니다 (미리보기 평균 ${Math.round(avgContentLen)}자)`)
    }
  }

  // === 이미지 분석 (6점) ===
  let avgImageCount = 0
  let imageRate = 0

  if (scrapedData && scrapedData.size > 0) {
    const scrapedPosts = Array.from(scrapedData.values())
    avgImageCount = scrapedPosts.reduce((s, p) => s + (p.imageCount || 0), 0) / scrapedPosts.length
    const postsWithImages = scrapedPosts.filter(p => p.hasImage).length
    imageRate = postsWithImages / scrapedPosts.length
  } else {
    const imageCounts = posts.map(p => countImageMarkers(p.description))
    avgImageCount = imageCounts.reduce((s, c) => s + c, 0) / posts.length
    const postsWithImages = imageCounts.filter(c => c > 0).length
    imageRate = postsWithImages / posts.length
  }

  if (imageRate >= 0.8 && avgImageCount >= 3) {
    score += 6
    details.push(`이미지 활용 최우수 (${Math.round(imageRate * 100)}% 포스트에 평균 ${avgImageCount.toFixed(1)}장)`)
  } else if (imageRate >= 0.8 && avgImageCount >= 2) {
    score += 5
    details.push(`이미지 활용 우수 (${Math.round(imageRate * 100)}% 포스트에 평균 ${avgImageCount.toFixed(1)}장)`)
  } else if (imageRate >= 0.5 && avgImageCount >= 1) {
    score += 3
    details.push(`이미지 활용 양호 (${Math.round(imageRate * 100)}% 포스트에 이미지 포함)`)
  } else if (imageRate >= 0.3) {
    score += 1
    details.push(`이미지 활용 부족 (${Math.round(imageRate * 100)}% 포스트에만 이미지 포함)`)
  } else {
    details.push('이미지가 거의 없습니다 - 직접 촬영한 원본 이미지를 추가하세요')
  }

  // === 구조/서식 패턴 감지 (6점: 리스트+2, 구체데이터+2, 서식태그+2) ===
  let structureScore = 0

  const hasListPattern = posts.filter(p =>
    /[①②③④⑤⑥⑦⑧⑨⑩]|[1-9]\.\s|•|▶|■|★|✔|✅/.test(p.description)
  ).length
  if (hasListPattern >= posts.length * 0.5) {
    structureScore += 2
  }

  const hasConcreteData = posts.filter(p =>
    /\d+[만천백]?\s*원|₩\d|가격|비용|\d+분|\d+km|\d+[%퍼센트]/.test(p.description)
  ).length
  if (hasConcreteData >= posts.length * 0.4) {
    structureScore += 2
  }

  const hasFormatting = posts.filter(p =>
    /<b>|<strong>|<a\s|<em>|<mark>/.test(p.description)
  ).length
  if (hasFormatting >= posts.length * 0.3) {
    structureScore += 2
  }

  score += structureScore
  if (structureScore >= 4) {
    details.push('콘텐츠 구조화 우수')
  } else if (structureScore >= 2) {
    details.push('콘텐츠 구조화 보통')
  } else {
    details.push('콘텐츠 구조화가 부족합니다 - 리스트, 소제목, 구체적 수치를 활용하세요')
  }

  const grade = score >= 16 ? 'S' : score >= 12 ? 'A' : score >= 8 ? 'B' : score >= 4 ? 'C' : 'D'

  return { name: '콘텐츠 품질', score: Math.min(maxScore, score), maxScore, grade, details }
}
