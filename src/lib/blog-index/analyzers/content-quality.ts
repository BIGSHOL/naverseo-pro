/**
 * 블로그 지수 - 축1. 콘텐츠 품질 (25점)
 *
 * v10: 범위 기반 점수 + 어뷰징 감점 통합
 *
 * 가점: 콘텐츠 깊이(7) + 이미지 활용(5) + 주제 집중도(4) + 구조/서식(3) + 내부 링크(3) + 품질 일관성(3) = 25
 * 감점: 제목 유사도(-3) + 콘텐츠 중복(-3) + 짧은 글 비율(-2) + 이미지 도배(-2) = -10
 * 최종: clamp(가점 + 감점, 0, 25)
 */

import { stripHtml, countImageMarkers, extractKoreanKeywords, jaccardSimilarity } from '@/lib/utils/text'
import type { BlogPost, AnalysisCategory, ScoreItem } from '../types'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'

export function analyzeContentQuality(
  posts: BlogPost[],
  scrapedData?: Map<string, ScrapedPostData> | null,
  blogName?: string | null,
  blogId?: string | null,
  topPostsScrapedData?: Map<string, ScrapedPostData> | null,
): { category: AnalysisCategory; topicKeywords: string[] } {
  const maxScore = 25
  const details: string[] = []
  const items: ScoreItem[] = []
  let score = 0
  const topicKeywords: string[] = []

  if (posts.length === 0) {
    return {
      category: { name: '콘텐츠 품질', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'], items: [] },
      topicKeywords,
    }
  }

  // === 콘텐츠 깊이 (7점) - 범위 기반 ===
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
    // 범위 기반: 1500~3000자 최적, 너무 길면 감점
    let depthPts = 0
    if (avgContentLen >= 1500 && avgContentLen <= 3000) {
      depthPts = 7
      details.push(`콘텐츠 깊이 최우수 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자, 최적 범위) (+7)`)
    } else if (avgContentLen >= 1000 && avgContentLen < 1500) {
      depthPts = 5
      details.push(`콘텐츠 깊이 우수 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자) (+5)`)
    } else if (avgContentLen > 3000 && avgContentLen <= 5000) {
      depthPts = 5
      details.push(`콘텐츠 깊이 우수 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자, 약간 김) (+5)`)
    } else if (avgContentLen > 5000) {
      depthPts = 4
      details.push(`콘텐츠가 과도하게 깁니다 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자, 권장: 1500~3000자) (+4)`)
    } else if (avgContentLen >= 500) {
      depthPts = 2
      details.push(`콘텐츠 깊이 보통 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자) (+2)`)
    } else {
      depthPts = 1
      details.push(`콘텐츠가 짧습니다 (본문 평균 ${Math.round(avgContentLen)}자, 권장: 1500자 이상) (+1)`)
    }
    score += depthPts
    items.push({ label: `콘텐츠 깊이 (평균 ${Math.round(avgContentLen).toLocaleString()}자)`, points: depthPts })
  } else {
    // 미리보기 기준 (변경 없음)
    let depthPts = 0
    if (avgContentLen >= 200) {
      depthPts = 7
      details.push(`콘텐츠 깊이 최우수 (미리보기 평균 ${Math.round(avgContentLen)}자) (+7)`)
    } else if (avgContentLen >= 150) {
      depthPts = 5
      details.push(`콘텐츠 깊이 우수 (미리보기 평균 ${Math.round(avgContentLen)}자) (+5)`)
    } else if (avgContentLen >= 100) {
      depthPts = 4
      details.push(`콘텐츠 깊이 양호 (미리보기 평균 ${Math.round(avgContentLen)}자) (+4)`)
    } else if (avgContentLen >= 50) {
      depthPts = 2
      details.push(`콘텐츠 깊이 보통 (미리보기 평균 ${Math.round(avgContentLen)}자) (+2)`)
    } else {
      depthPts = 1
      details.push(`콘텐츠가 짧습니다 (미리보기 평균 ${Math.round(avgContentLen)}자) (+1)`)
    }
    score += depthPts
    items.push({ label: `콘텐츠 깊이 (미리보기 ${Math.round(avgContentLen)}자)`, points: depthPts })
  }

  // === 이미지 활용 (5점) - 평균 개수 기반 ===
  let avgImageCount = 0

  if (scrapedData && scrapedData.size > 0) {
    const scrapedPosts = Array.from(scrapedData.values())
    avgImageCount = scrapedPosts.reduce((s, p) => s + (p.imageCount || 0), 0) / scrapedPosts.length
  } else {
    const imageCounts = posts.map(p => countImageMarkers(p.description))
    avgImageCount = imageCounts.reduce((s, c) => s + c, 0) / posts.length
  }

  let imagePts = 0
  if (avgImageCount >= 3 && avgImageCount <= 10) {
    imagePts = 5
    details.push(`이미지 활용 최우수 (평균 ${avgImageCount.toFixed(1)}장, 최적 범위) (+5)`)
  } else if ((avgImageCount >= 2 && avgImageCount < 3) || (avgImageCount > 10 && avgImageCount <= 20)) {
    imagePts = 4
    details.push(`이미지 활용 우수 (평균 ${avgImageCount.toFixed(1)}장) (+4)`)
  } else if (avgImageCount > 20) {
    imagePts = 3
    details.push(`이미지 과다 (평균 ${avgImageCount.toFixed(1)}장, 권장: 3~10장) (+3)`)
  } else if (avgImageCount >= 1) {
    imagePts = 2
    details.push(`이미지 활용 보통 (평균 ${avgImageCount.toFixed(1)}장) (+2)`)
  } else {
    imagePts = 0
    details.push('이미지가 거의 없습니다 - 직접 촬영한 원본 이미지를 추가하세요 (+0)')
  }
  score += imagePts
  items.push({ label: `이미지 활용 (평균 ${avgImageCount.toFixed(1)}장)`, points: imagePts })

  // === 주제 집중도 (4점) - 범위 기반 (키워드 스터핑 통합) ===
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

    let focusPts = 0
    if (topKeywordRate >= 0.3 && topKeywordRate <= 0.6) {
      focusPts = 4
      details.push(`주제 집중도 최우수: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (최적 범위) (+4)`)
    } else if (topKeywordRate > 0.6 && topKeywordRate <= 0.8) {
      focusPts = 3
      details.push(`주제 집중도 우수: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (+3)`)
    } else if (topKeywordRate >= 0.2 && topKeywordRate < 0.3) {
      focusPts = 2
      details.push(`주제 집중도 양호: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (+2)`)
    } else if (topKeywordRate > 0.8) {
      focusPts = 1
      details.push(`키워드 과집중: "${topKeyword[0]}" ${Math.round(topKeywordRate * 100)}% 등장 (스터핑 위험, 다양한 키워드 사용 권장) (+1)`)
    } else {
      focusPts = 1
      details.push('주제가 분산됨 - 하나의 주제에 집중하면 C-Rank 향상에 도움 (+1)')
    }
    score += focusPts
    items.push({ label: `주제 집중도 (${topKeyword[0]} ${Math.round(topKeywordRate * 100)}%)`, points: focusPts })
  }

  // === 구조/서식 패턴 (3점) ===
  let structureScore = 0
  const formattingDetails: string[] = []

  // 리스트/번호 매기기 사용 여부
  const hasListPattern = posts.filter(p =>
    /[①②③④⑤⑥⑦⑧⑨⑩]|[1-9]\.\s|•|▶|■|★|✔|✅/.test(p.description)
  ).length
  if (hasListPattern >= posts.length * 0.5) structureScore += 1

  // 구체적 수치/데이터 포함
  const hasConcreteData = posts.filter(p =>
    /\d+[만천백]?\s*원|₩\d|가격|비용|\d+분|\d+km|\d+[%퍼센트]/.test(p.description)
  ).length
  if (hasConcreteData >= posts.length * 0.4) structureScore += 1

  // v11: 실제 본문 서식 사용 - 상위 포스팅 벤치마크 기반
  if (scrapedData && scrapedData.size > 0) {
    const scrapedPosts = Array.from(scrapedData.values())

    // 서식 종류 집계 (내 포스트)
    const fmtTypes: string[] = []
    const counts = { bold: 0, heading: 0, fontSize: 0, color: 0, highlight: 0, underline: 0 }
    scrapedPosts.forEach(p => {
      if (p.formatting) {
        if (p.formatting.hasBold) counts.bold++
        if (p.formatting.hasHeading) counts.heading++
        if (p.formatting.hasFontSize) counts.fontSize++
        if (p.formatting.hasColor) counts.color++
        if (p.formatting.hasHighlight) counts.highlight++
        if (p.formatting.hasUnderline) counts.underline++
      }
    })
    if (counts.bold > 0) fmtTypes.push('볼드')
    if (counts.heading > 0) fmtTypes.push('소제목')
    if (counts.fontSize > 0) fmtTypes.push('글자크기')
    if (counts.color > 0) fmtTypes.push('글자색')
    if (counts.highlight > 0) fmtTypes.push('배경색')
    if (counts.underline > 0) fmtTypes.push('밑줄')

    // 포스트당 평균 서식 종류 수
    const avgFmtCount = scrapedPosts.reduce((s, p) => s + (p.formatting?.count || 0), 0) / scrapedPosts.length

    // 상위 포스팅 서식 벤치마크 계산
    let topPostsAvgFmt: number | null = null
    if (topPostsScrapedData && topPostsScrapedData.size > 0) {
      const topPosts = Array.from(topPostsScrapedData.values())
      topPostsAvgFmt = topPosts.reduce((s, p) => s + (p.formatting?.count || 0), 0) / topPosts.length
    }

    if (topPostsAvgFmt !== null) {
      // 상위 포스팅 기준 비교 (±1 범위 내면 적절)
      const diff = avgFmtCount - topPostsAvgFmt
      if (Math.abs(diff) <= 1) {
        structureScore += 1
        formattingDetails.push(`${fmtTypes.join(', ')} (상위 포스팅 평균 ${topPostsAvgFmt.toFixed(1)}종과 유사)`)
      } else if (diff > 1) {
        // 상위 포스팅보다 서식이 많음 → 가산 없음
        formattingDetails.push(`${fmtTypes.join(', ')} - 상위 포스팅(${topPostsAvgFmt.toFixed(1)}종) 대비 과다`)
      } else {
        // 상위 포스팅보다 서식이 적음 → 가산 없음
        formattingDetails.push(`서식 부족 - 상위 포스팅 평균 ${topPostsAvgFmt.toFixed(1)}종 사용`)
      }
    } else {
      // 폴백: 상위 포스팅 데이터 없으면 고정 범위 (1~3종)
      if (avgFmtCount >= 1 && avgFmtCount <= 3) {
        structureScore += 1
        formattingDetails.push(fmtTypes.join(', '))
      } else if (avgFmtCount > 3) {
        formattingDetails.push(`${fmtTypes.join(', ')} - 과다 사용`)
      }
    }
  } else {
    // 폴백: description에서 기본 HTML 서식 체크
    const hasFormatting = posts.filter(p =>
      /<b>|<strong>|<a\s|<em>|<mark>/.test(p.description)
    ).length
    if (hasFormatting >= posts.length * 0.3) structureScore += 1
  }

  score += structureScore
  if (structureScore >= 3) {
    const fmtSuffix = formattingDetails.length > 0 ? ` (${formattingDetails[0]})` : ''
    details.push(`콘텐츠 구조화 우수${fmtSuffix} (+${structureScore})`)
  } else if (structureScore >= 1) {
    const fmtSuffix = formattingDetails.length > 0 ? ` (${formattingDetails[0]})` : ''
    details.push(`콘텐츠 구조화 보통${fmtSuffix} (+${structureScore})`)
  } else {
    details.push('구조화 부족 - 리스트, 소제목, 볼드체 등 서식을 적절히 활용하세요 (+0)')
  }
  items.push({ label: '구조/서식', points: structureScore })

  // === 내부 링크 활용 (3점) ===
  let linkPts = 0
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
        linkPts = 3
        details.push(`내부 링크 활용 우수 (평균 ${avgInternalLinks.toFixed(1)}개) (+3)`)
      } else if (avgInternalLinks >= 1 || sameBlogRate >= 0.1) {
        linkPts = 1
        details.push(`내부 링크 활용 보통 (평균 ${avgInternalLinks.toFixed(1)}개) (+1)`)
      } else {
        details.push('내부 링크 부족 - 관련 글 링크로 체류 시간을 늘리세요 (+0)')
      }
    }
  }
  score += linkPts
  items.push({ label: '내부 링크', points: linkPts })

  // === 품질 일관성 (3점) ===
  let consistencyPts = 0
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

  // === [감점] 제목 유사도 (0 ~ -3) — abuse.ts에서 이동 ===
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

  // === [감점] 콘텐츠 중복 (0 ~ -3) — abuse.ts에서 이동 ===
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

  // === [감점] 짧은 글 비율 (0 ~ -2) — abuse.ts에서 이동 ===
  if (scrapedData && scrapedData.size >= 3) {
    const scrapedPosts = Array.from(scrapedData.values())
    const shortPosts = scrapedPosts.filter(p => p.charCount < 300).length
    const shortRate = shortPosts / scrapedPosts.length

    if (shortRate >= 0.7) {
      score -= 2
      details.push(`짧은 글 비율 과다: ${Math.round(shortRate * 100)}%가 300자 미만 (-2)`)
      items.push({ label: `짧은 글 비율 (${Math.round(shortRate * 100)}%)`, points: -2 })
    } else if (shortRate >= 0.4) {
      score -= 1
      details.push(`짧은 글 비율 주의: ${Math.round(shortRate * 100)}%가 300자 미만 (-1)`)
      items.push({ label: `짧은 글 비율 (${Math.round(shortRate * 100)}%)`, points: -1 })
    }
  }

  // === [감점] 이미지 도배 (0 ~ -2) — 이미지 과다 + 텍스트 부족 ===
  if (scrapedData && scrapedData.size >= 3) {
    const scrapedPosts = Array.from(scrapedData.values())
    // 이미지 대비 텍스트가 극단적으로 적은 포스트 비율
    const imageSpamPosts = scrapedPosts.filter(p =>
      p.imageCount >= 10 && p.charCount < 500
    ).length
    const imageSpamRate = imageSpamPosts / scrapedPosts.length

    if (imageSpamRate >= 0.5) {
      score -= 2
      details.push(`이미지 도배 의심: ${Math.round(imageSpamRate * 100)}%가 이미지 10장↑ + 텍스트 500자↓ (-2)`)
      items.push({ label: `이미지 도배 (${Math.round(imageSpamRate * 100)}%)`, points: -2 })
    } else if (imageSpamRate >= 0.25) {
      score -= 1
      details.push(`이미지 과다 주의: ${Math.round(imageSpamRate * 100)}%가 이미지 10장↑ + 텍스트 500자↓ (-1)`)
      items.push({ label: `이미지 도배 (${Math.round(imageSpamRate * 100)}%)`, points: -1 })
    }
  }

  // 최종 점수 clamp
  score = Math.max(0, Math.min(maxScore, score))
  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return {
    category: { name: '콘텐츠 품질', score, maxScore, grade, details, items },
    topicKeywords,
  }
}
