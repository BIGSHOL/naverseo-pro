/**
 * 블로그 지수 - 축1. 콘텐츠 품질 (25점)
 *
 * v9: 주제 전문성 병합 + 25점 확대
 *
 * 콘텐츠 깊이(7) + 이미지 활용(5) + 주제 집중도(4) + 구조/서식(3) + 내부 링크(3) + 품질 일관성(3)
 */

import { stripHtml, countImageMarkers, extractKoreanKeywords } from '@/lib/utils/text'
import type { BlogPost, AnalysisCategory } from '../types'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'

export function analyzeContentQuality(
  posts: BlogPost[],
  scrapedData?: Map<string, ScrapedPostData> | null,
  blogName?: string | null,
  blogId?: string | null,
): { category: AnalysisCategory; topicKeywords: string[] } {
  const maxScore = 25
  const details: string[] = []
  let score = 0
  const topicKeywords: string[] = []

  if (posts.length === 0) {
    return {
      category: { name: '콘텐츠 품질', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] },
      topicKeywords,
    }
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
      details.push(`콘텐츠 깊이 최우수 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자) (+7)`)
    } else if (avgContentLen >= 1500) {
      score += 5
      details.push(`콘텐츠 깊이 우수 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자) (+5)`)
    } else if (avgContentLen >= 1000) {
      score += 4
      details.push(`콘텐츠 깊이 양호 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자) (+4)`)
    } else if (avgContentLen >= 500) {
      score += 2
      details.push(`콘텐츠 깊이 보통 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자) (+2)`)
    } else {
      score += 1
      details.push(`콘텐츠가 짧습니다 (본문 평균 ${Math.round(avgContentLen)}자, 권장: 1500자 이상) (+1)`)
    }
  } else {
    if (avgContentLen >= 200) {
      score += 7
      details.push(`콘텐츠 깊이 최우수 (미리보기 평균 ${Math.round(avgContentLen)}자) (+7)`)
    } else if (avgContentLen >= 150) {
      score += 5
      details.push(`콘텐츠 깊이 우수 (미리보기 평균 ${Math.round(avgContentLen)}자) (+5)`)
    } else if (avgContentLen >= 100) {
      score += 4
      details.push(`콘텐츠 깊이 양호 (미리보기 평균 ${Math.round(avgContentLen)}자) (+4)`)
    } else if (avgContentLen >= 50) {
      score += 2
      details.push(`콘텐츠 깊이 보통 (미리보기 평균 ${Math.round(avgContentLen)}자) (+2)`)
    } else {
      score += 1
      details.push(`콘텐츠가 짧습니다 (미리보기 평균 ${Math.round(avgContentLen)}자) (+1)`)
    }
  }

  // === 이미지 활용 (5점) ===
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
    details.push(`이미지 활용 최우수 (${Math.round(imageRate * 100)}% 포스트에 평균 ${avgImageCount.toFixed(1)}장) (+5)`)
  } else if (imageRate >= 0.8 && avgImageCount >= 2) {
    score += 4
    details.push(`이미지 활용 우수 (${Math.round(imageRate * 100)}% 포스트에 평균 ${avgImageCount.toFixed(1)}장) (+4)`)
  } else if (imageRate >= 0.5 && avgImageCount >= 1) {
    score += 2
    details.push(`이미지 활용 양호 (${Math.round(imageRate * 100)}% 포스트에 이미지 포함) (+2)`)
  } else if (imageRate >= 0.3) {
    score += 1
    details.push(`이미지 활용 부족 (${Math.round(imageRate * 100)}% 포스트에만 이미지 포함) (+1)`)
  } else {
    details.push('이미지가 거의 없습니다 - 직접 촬영한 원본 이미지를 추가하세요 (+0)')
  }

  // === 주제 집중도/전문성 (4점) - v9: topic-authority에서 병합 ===
  const brandKeywords = new Set<string>()
  const brandSources = [blogName, blogId].filter(Boolean) as string[]
  for (const src of brandSources) {
    const words = extractKoreanKeywords(src)
    words.forEach(w => brandKeywords.add(w))
  }

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

  const sortedKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)

  sortedKeywords.slice(0, 5).forEach(([word]) => topicKeywords.push(word))

  if (sortedKeywords.length > 0) {
    const topKeyword = sortedKeywords[0]
    const topKeywordRate = topKeyword[1] / posts.length

    if (topKeywordRate >= 0.7) {
      score += 4
      details.push(`주제 집중도 최우수: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (+4)`)
    } else if (topKeywordRate >= 0.5) {
      score += 3
      details.push(`주제 집중도 우수: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (+3)`)
    } else if (topKeywordRate >= 0.3) {
      score += 2
      details.push(`주제 집중도 양호: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (+2)`)
    } else {
      score += 1
      details.push('주제가 분산됨 - 하나의 주제에 집중하면 C-Rank 향상에 도움 (+1)')
    }
  }

  // === 구조/서식 패턴 (3점) ===
  let structureScore = 0

  const hasListPattern = posts.filter(p =>
    /[①②③④⑤⑥⑦⑧⑨⑩]|[1-9]\.\s|•|▶|■|★|✔|✅/.test(p.description)
  ).length
  if (hasListPattern >= posts.length * 0.5) structureScore += 1

  const hasConcreteData = posts.filter(p =>
    /\d+[만천백]?\s*원|₩\d|가격|비용|\d+분|\d+km|\d+[%퍼센트]/.test(p.description)
  ).length
  if (hasConcreteData >= posts.length * 0.4) structureScore += 1

  const hasFormatting = posts.filter(p =>
    /<b>|<strong>|<a\s|<em>|<mark>/.test(p.description)
  ).length
  if (hasFormatting >= posts.length * 0.3) structureScore += 1

  score += structureScore
  if (structureScore >= 3) details.push(`콘텐츠 구조화 우수 (+${structureScore})`)
  else if (structureScore >= 1) details.push(`콘텐츠 구조화 보통 (+${structureScore})`)
  else details.push('구조화 부족 - 리스트, 소제목, 구체적 수치를 활용하세요 (+0)')

  // === 내부 링크 활용 (3점) ===
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
        score += 3
        details.push(`내부 링크 활용 우수 (평균 ${avgInternalLinks.toFixed(1)}개) (+3)`)
      } else if (avgInternalLinks >= 1 || sameBlogRate >= 0.1) {
        score += 1
        details.push(`내부 링크 활용 보통 (평균 ${avgInternalLinks.toFixed(1)}개) (+1)`)
      } else {
        details.push('내부 링크 부족 - 관련 글 링크로 체류 시간을 늘리세요 (+0)')
      }
    }
  }

  // === 품질 일관성 (3점) ===
  if (contentLengths.length >= 3) {
    const avgLen = contentLengths.reduce((s, l) => s + l, 0) / contentLengths.length
    const variance = contentLengths.reduce((s, l) => s + Math.pow(l - avgLen, 2), 0) / contentLengths.length
    const stdDev = Math.sqrt(variance)
    const cv = avgLen > 0 ? stdDev / avgLen : 0

    if (cv < 0.25) {
      score += 3
      details.push('품질 일관성 최우수 (+3)')
    } else if (cv < 0.5) {
      score += 2
      details.push('품질 일관성 우수 (+2)')
    } else if (cv < 0.8) {
      score += 1
      details.push('품질 일관성 보통 (+1)')
    } else {
      details.push('품질 일관성 부족 - 글마다 길이 차이가 큽니다 (+0)')
    }
  }

  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return {
    category: { name: '콘텐츠 품질', score: Math.min(maxScore, score), maxScore, grade, details },
    topicKeywords,
  }
}
