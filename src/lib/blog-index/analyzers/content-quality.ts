/**
 * 블로그 지수 - 축2. 콘텐츠 품질 분석 (D.I.A. proxy) — 20점 (v8: 내부 링크 추가)
 *
 * 깊이(7) + 이미지(5) + 구조(3) + 품질 일관성(3) + 내부 링크(2)
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

  // === 콘텐츠 깊이 (7점) - 실제 본문 우선, 없으면 RSS 미리보기 ===
  let avgContentLen = 0
  let isActualContent = false
  const contentLengths: number[] = []

  if (scrapedData && scrapedData.size > 0) {
    const scrapedPosts = Array.from(scrapedData.values())
    scrapedPosts.forEach(p => contentLengths.push(p.charCount))
    avgContentLen = scrapedPosts.reduce((sum, p) => sum + p.charCount, 0) / scrapedPosts.length
    isActualContent = true
  } else {
    posts.forEach(p => contentLengths.push(stripHtml(p.description).length))
    avgContentLen = posts.reduce((sum, p) => sum + stripHtml(p.description).length, 0) / posts.length
    isActualContent = false
  }

  if (isActualContent) {
    if (avgContentLen >= 2000) {
      score += 7
      details.push(`콘텐츠 깊이 최우수 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자)`)
    } else if (avgContentLen >= 1500) {
      score += 5
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
      score += 7
      details.push(`콘텐츠 깊이 최우수 (미리보기 평균 ${Math.round(avgContentLen)}자)`)
    } else if (avgContentLen >= 150) {
      score += 5
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

  // === 이미지 분석 (5점) ===
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
    score += 5
    details.push(`이미지 활용 최우수 (${Math.round(imageRate * 100)}% 포스트에 평균 ${avgImageCount.toFixed(1)}장)`)
  } else if (imageRate >= 0.8 && avgImageCount >= 2) {
    score += 4
    details.push(`이미지 활용 우수 (${Math.round(imageRate * 100)}% 포스트에 평균 ${avgImageCount.toFixed(1)}장)`)
  } else if (imageRate >= 0.5 && avgImageCount >= 1) {
    score += 2
    details.push(`이미지 활용 양호 (${Math.round(imageRate * 100)}% 포스트에 이미지 포함)`)
  } else if (imageRate >= 0.3) {
    score += 1
    details.push(`이미지 활용 부족 (${Math.round(imageRate * 100)}% 포스트에만 이미지 포함)`)
  } else {
    details.push('이미지가 거의 없습니다 - 직접 촬영한 원본 이미지를 추가하세요')
  }

  // === 구조/서식 패턴 감지 (3점: 리스트+1, 구체데이터+1, 서식태그+1) ===
  let structureScore = 0

  const hasListPattern = posts.filter(p =>
    /[①②③④⑤⑥⑦⑧⑨⑩]|[1-9]\.\s|•|▶|■|★|✔|✅/.test(p.description)
  ).length
  if (hasListPattern >= posts.length * 0.5) {
    structureScore += 1
  }

  const hasConcreteData = posts.filter(p =>
    /\d+[만천백]?\s*원|₩\d|가격|비용|\d+분|\d+km|\d+[%퍼센트]/.test(p.description)
  ).length
  if (hasConcreteData >= posts.length * 0.4) {
    structureScore += 1
  }

  const hasFormatting = posts.filter(p =>
    /<b>|<strong>|<a\s|<em>|<mark>/.test(p.description)
  ).length
  if (hasFormatting >= posts.length * 0.3) {
    structureScore += 1
  }

  score += structureScore
  if (structureScore >= 3) {
    details.push('콘텐츠 구조화 우수')
  } else if (structureScore >= 1) {
    details.push('콘텐츠 구조화 보통')
  } else {
    details.push('콘텐츠 구조화가 부족합니다 - 리스트, 소제목, 구체적 수치를 활용하세요')
  }

  // === 포스트 품질 일관성 (3점) - 글 길이의 변동계수 기반 ===
  if (contentLengths.length >= 3) {
    const avgLen = contentLengths.reduce((s, l) => s + l, 0) / contentLengths.length
    const variance = contentLengths.reduce((s, l) => s + Math.pow(l - avgLen, 2), 0) / contentLengths.length
    const stdDev = Math.sqrt(variance)
    const cv = avgLen > 0 ? stdDev / avgLen : 0

    if (cv < 0.25) {
      score += 3
      details.push('품질 일관성 최우수 (글 길이 편차 매우 적음)')
    } else if (cv < 0.5) {
      score += 2
      details.push('품질 일관성 우수')
    } else if (cv < 0.8) {
      score += 1
      details.push('품질 일관성 보통 - 글 길이 편차가 큽니다')
    } else {
      details.push('품질 일관성 부족 - 글마다 길이 차이가 매우 큽니다')
    }
  }

  // === 내부 링크 활용 (2점) - 같은 블로그 내 관련 글 링크 → 체류 시간 증가 ===
  if (scrapedData && scrapedData.size > 0) {
    const scrapedPosts = Array.from(scrapedData.values())
    const postsWithMeta = scrapedPosts.filter(p => p.meta?.linkAnalysis)
    if (postsWithMeta.length > 0) {
      const avgInternalLinks = postsWithMeta.reduce(
        (s, p) => s + (p.meta!.linkAnalysis.internalCount || 0), 0
      ) / postsWithMeta.length
      const sameBlogLinkPosts = postsWithMeta.filter(
        p => p.meta!.linkAnalysis.internalLinks.some(l => l.isSameBlog)
      ).length
      const sameBlogRate = sameBlogLinkPosts / postsWithMeta.length

      if (avgInternalLinks >= 2 && sameBlogRate >= 0.3) {
        score += 2
        details.push(`내부 링크 활용 우수 (평균 ${avgInternalLinks.toFixed(1)}개, 자체 링크 ${Math.round(sameBlogRate * 100)}%)`)
      } else if (avgInternalLinks >= 1 || sameBlogRate >= 0.1) {
        score += 1
        details.push(`내부 링크 활용 보통 (평균 ${avgInternalLinks.toFixed(1)}개)`)
      } else {
        details.push('내부 링크가 부족합니다 - 관련 글 링크를 추가하면 체류 시간이 늘어납니다')
      }
    }
  }

  const grade = score >= 16 ? 'S' : score >= 12 ? 'A' : score >= 8 ? 'B' : score >= 4 ? 'C' : 'D'

  return { name: '콘텐츠 품질', score: Math.min(maxScore, score), maxScore, grade, details }
}
