/**
 * 블로그 지수 - 축2. 콘텐츠 품질 (15점)
 *
 * v15: 글자수 의존도 축소 + 구조/경험 보강.
 *      깊이 5→3점 축소, 구조 3→4점 보강, 경험 2→3점 보강.
 *
 * 가점: 콘텐츠 깊이(3) + 이미지 활용(3) + 구조/서식(4) + 내부 링크(2) + 경험 정보(3) = 15
 * 감점: 짧은 글 비율(-2) + 이미지 도배(-1) + 과도한 글 길이(-3) + 전체 이미지 과다(-1) + 문장 반복 스팸(-2) = -9
 * 최종: clamp(가점 + 감점, 0, 15)
 */

import { stripHtml, countImageMarkers } from '@/lib/utils/text'
import type { BlogPost, AnalysisCategory, ScoreItem } from '../types'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'

export function analyzeContentQuality(
  posts: BlogPost[],
  scrapedData?: Map<string, ScrapedPostData> | null,
  topPostsScrapedData?: Map<string, ScrapedPostData> | null,
): AnalysisCategory {
  const maxScore = 15
  const details: string[] = []
  const items: ScoreItem[] = []
  let score = 0

  if (posts.length === 0) {
    return { name: '콘텐츠 품질', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'], items: [] }
  }

  // === 콘텐츠 깊이 (3점) - 범위 기반 === (v15: 5→3, 글자수 의존도 축소)
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

  // v15: 최적 범위 2000-2500자, 만점 3점
  if (isActualContent) {
    let depthPts = 0
    if (avgContentLen >= 2000 && avgContentLen <= 2500) {
      depthPts = 3
      details.push(`콘텐츠 깊이 최우수 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자, 최적 범위) (+3)`)
    } else if ((avgContentLen >= 1500 && avgContentLen < 2000) || (avgContentLen > 2500 && avgContentLen <= 3000)) {
      depthPts = 2
      details.push(`콘텐츠 깊이 양호 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자) (+2)`)
    } else if (avgContentLen >= 1200 && avgContentLen < 1500) {
      depthPts = 1
      details.push(`콘텐츠 깊이 보통 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자, 권장: 2000자 이상) (+1)`)
    } else if (avgContentLen > 3000) {
      depthPts = 0
      details.push(`콘텐츠가 깁니다 (본문 평균 ${Math.round(avgContentLen).toLocaleString()}자, 권장: 2000~2500자) (+0)`)
    } else {
      depthPts = 0
      details.push(`콘텐츠가 짧습니다 (본문 평균 ${Math.round(avgContentLen)}자, 권장: 2000자 이상) (+0)`)
    }
    score += depthPts
    items.push({ label: `콘텐츠 깊이 (평균 ${Math.round(avgContentLen).toLocaleString()}자)`, points: depthPts })
  } else {
    let depthPts = 0
    if (avgContentLen >= 200) {
      depthPts = 2
      details.push(`콘텐츠 깊이 양호 (미리보기 평균 ${Math.round(avgContentLen)}자) (+2)`)
    } else if (avgContentLen >= 150) {
      depthPts = 1
      details.push(`콘텐츠 깊이 보통 (미리보기 평균 ${Math.round(avgContentLen)}자) (+1)`)
    } else {
      depthPts = 0
      details.push(`콘텐츠가 짧습니다 (미리보기 평균 ${Math.round(avgContentLen)}자) (+0)`)
    }
    score += depthPts
    items.push({ label: `콘텐츠 깊이 (미리보기 ${Math.round(avgContentLen)}자)`, points: depthPts })
  }

  // === 이미지 활용 (3점) - 평균 개수 기반 === (v13: 5→3)
  let avgImageCount = 0

  if (scrapedData && scrapedData.size > 0) {
    const scrapedPosts = Array.from(scrapedData.values())
    avgImageCount = scrapedPosts.reduce((s, p) => s + (p.imageCount || 0), 0) / scrapedPosts.length
  } else {
    const imageCounts = posts.map(p => countImageMarkers(p.description))
    avgImageCount = imageCounts.reduce((s, c) => s + c, 0) / posts.length
  }

  // v13: 최적 범위 5-10장, 5→3점으로 축소
  let imagePts = 0
  if (avgImageCount >= 5 && avgImageCount <= 10) {
    imagePts = 3
    details.push(`이미지 활용 최우수 (평균 ${avgImageCount.toFixed(1)}장, 최적 범위) (+3)`)
  } else if (avgImageCount >= 3 && avgImageCount < 5) {
    imagePts = 2
    details.push(`이미지 활용 우수 (평균 ${avgImageCount.toFixed(1)}장) (+2)`)
  } else if (avgImageCount > 10 && avgImageCount <= 20) {
    imagePts = 2
    details.push(`이미지 다소 과다 (평균 ${avgImageCount.toFixed(1)}장, 권장: 5~10장) (+2)`)
  } else if (avgImageCount >= 1) {
    imagePts = 1
    details.push(`이미지 부족 (평균 ${avgImageCount.toFixed(1)}장, 권장: 5장 이상) (+1)`)
  } else {
    imagePts = 0
    details.push('이미지가 거의 없습니다 - 직접 촬영한 원본 이미지를 추가하세요 (+0)')
  }
  score += imagePts
  items.push({ label: `이미지 활용 (평균 ${avgImageCount.toFixed(1)}장)`, points: imagePts })

  // === 구조/서식 패턴 (4점) === (v15: 3→4, 실질적 노력 보강)
  let structureScore = 0
  const formattingDetails: string[] = []

  // 리스트/번호 매기기 사용 여부 (1점)
  const hasListPattern = posts.filter(p =>
    /[①②③④⑤⑥⑦⑧⑨⑩]|[1-9]\.\s|•|▶|■|★|✔|✅/.test(p.description)
  ).length
  if (hasListPattern >= posts.length * 0.5) structureScore += 1

  // 구체적 수치/데이터 포함 (1점)
  const hasConcreteData = posts.filter(p =>
    /\d+[만천백]?\s*원|₩\d|가격|비용|\d+분|\d+km|\d+[%퍼센트]/.test(p.description)
  ).length
  if (hasConcreteData >= posts.length * 0.4) structureScore += 1

  // 소제목 활용 (1점 — scrapedData에서 heading 태그 확인)
  if (scrapedData && scrapedData.size > 0) {
    const scrapedPosts = Array.from(scrapedData.values())
    const postsWithHeadings = scrapedPosts.filter(p => p.formatting?.hasHeading).length
    if (postsWithHeadings >= scrapedPosts.length * 0.3) structureScore += 1
  }

  // v11: 실제 본문 서식 사용 - 상위 포스팅 벤치마크 기반 (2점)
  if (scrapedData && scrapedData.size > 0) {
    const scrapedPosts = Array.from(scrapedData.values())
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

    const avgFmtCount = scrapedPosts.reduce((s, p) => s + (p.formatting?.count || 0), 0) / scrapedPosts.length

    let topPostsAvgFmt: number | null = null
    if (topPostsScrapedData && topPostsScrapedData.size > 0) {
      const topPosts = Array.from(topPostsScrapedData.values())
      topPostsAvgFmt = topPosts.reduce((s, p) => s + (p.formatting?.count || 0), 0) / topPosts.length
    }

    if (topPostsAvgFmt !== null) {
      const diff = avgFmtCount - topPostsAvgFmt
      if (Math.abs(diff) <= 1) {
        structureScore += 2
        formattingDetails.push(`${fmtTypes.join(', ')} (상위 포스팅 평균 ${topPostsAvgFmt.toFixed(1)}종과 유사)`)
      } else if (diff > 1) {
        structureScore += 1
        formattingDetails.push(`${fmtTypes.join(', ')} - 상위 포스팅(${topPostsAvgFmt.toFixed(1)}종) 대비 다소 과다`)
      } else {
        formattingDetails.push(`서식 부족 - 상위 포스팅 평균 ${topPostsAvgFmt.toFixed(1)}종 사용`)
      }
    } else {
      if (avgFmtCount >= 1 && avgFmtCount <= 3) {
        structureScore += 2
        formattingDetails.push(fmtTypes.join(', '))
      } else if (avgFmtCount > 3) {
        structureScore += 1
        formattingDetails.push(`${fmtTypes.join(', ')} - 과다 사용`)
      }
    }
  } else {
    const hasFormatting = posts.filter(p =>
      /<b>|<strong>|<a\s|<em>|<mark>/.test(p.description)
    ).length
    if (hasFormatting >= posts.length * 0.3) structureScore += 1
  }

  // v15: 구조 점수 최대 4점으로 제한 (3→4)
  structureScore = Math.min(4, structureScore)
  score += structureScore
  if (structureScore >= 4) {
    const fmtSuffix = formattingDetails.length > 0 ? ` (${formattingDetails[0]})` : ''
    details.push(`콘텐츠 구조화 우수${fmtSuffix} (+${structureScore})`)
  } else if (structureScore >= 2) {
    const fmtSuffix = formattingDetails.length > 0 ? ` (${formattingDetails[0]})` : ''
    details.push(`콘텐츠 구조화 양호${fmtSuffix} (+${structureScore})`)
  } else if (structureScore >= 1) {
    details.push(`콘텐츠 구조화 보통 (+${structureScore})`)
  } else {
    details.push('구조화 부족 - 리스트, 소제목, 볼드체 등 서식을 적절히 활용하세요 (+0)')
  }
  items.push({ label: '구조/서식', points: structureScore })

  // === 내부 링크 활용 (2점) === (v13: 4→2)
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
        linkPts = 2
        details.push(`내부 링크 활용 우수 (평균 ${avgInternalLinks.toFixed(1)}개) (+2)`)
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

  // === 경험 정보 (3점) === (v15: 2→3, D.I.A. 핵심 보강)
  let experiencePts = 0
  if (posts.length > 0) {
    const experiencePatterns = /직접|체험|후기|경험|사용기|리뷰|방문|다녀|먹어|써봤|써본|입어|착용|구매후기|실사용/
    const postsWithExperience = posts.filter(p => {
      const text = stripHtml(p.title) + ' ' + stripHtml(p.description)
      return experiencePatterns.test(text)
    }).length
    const experienceRate = postsWithExperience / posts.length

    if (experienceRate >= 0.6) {
      experiencePts = 3
      details.push(`경험 정보 풍부: ${Math.round(experienceRate * 100)}% 포스트에 직접 경험 포함 (+3)`)
    } else if (experienceRate >= 0.35) {
      experiencePts = 2
      details.push(`경험 정보 양호: ${Math.round(experienceRate * 100)}% 포스트에 직접 경험 포함 (+2)`)
    } else if (experienceRate >= 0.2) {
      experiencePts = 1
      details.push(`경험 정보 보통: ${Math.round(experienceRate * 100)}% 포스트에 직접 경험 포함 (+1)`)
    } else {
      details.push('경험 정보 부족 - D.I.A. 알고리즘은 직접 경험이 담긴 콘텐츠를 선호합니다 (+0)')
    }
  }
  score += experiencePts
  items.push({ label: '경험 정보', points: experiencePts })

  // === [감점] 짧은 글 비율 (0 ~ -2) === (v13: -3→-2)
  if (scrapedData && scrapedData.size >= 3) {
    const scrapedPosts = Array.from(scrapedData.values())
    const shortPosts = scrapedPosts.filter(p => p.charCount < 300).length
    const shortRate = shortPosts / scrapedPosts.length

    if (shortRate >= 0.6) {
      score -= 2
      details.push(`짧은 글 비율 과다: ${Math.round(shortRate * 100)}%가 300자 미만 (-2)`)
      items.push({ label: `짧은 글 비율 (${Math.round(shortRate * 100)}%)`, points: -2 })
    } else if (shortRate >= 0.3) {
      score -= 1
      details.push(`짧은 글 비율 주의: ${Math.round(shortRate * 100)}%가 300자 미만 (-1)`)
      items.push({ label: `짧은 글 비율 (${Math.round(shortRate * 100)}%)`, points: -1 })
    }
  }

  // === [감점] 이미지 도배 (0 ~ -1) === (v13: -2→-1)
  if (scrapedData && scrapedData.size >= 3) {
    const scrapedPosts = Array.from(scrapedData.values())
    const imageSpamPosts = scrapedPosts.filter(p =>
      p.imageCount >= 10 && p.charCount < 500
    ).length
    const imageSpamRate = imageSpamPosts / scrapedPosts.length

    if (imageSpamRate >= 0.3) {
      score -= 1
      details.push(`이미지 도배 의심: ${Math.round(imageSpamRate * 100)}%가 이미지 10장↑ + 텍스트 500자↓ (-1)`)
      items.push({ label: `이미지 도배 (${Math.round(imageSpamRate * 100)}%)`, points: -1 })
    }
  }

  // === [감점] 과도한 콘텐츠 길이 (0 ~ -3) ===
  // 최적: 1500~2500자, 권장 최대: 3000자
  if (isActualContent && avgContentLen >= 7000) {
    score -= 3
    details.push(`극심한 콘텐츠 과다: 평균 ${Math.round(avgContentLen).toLocaleString()}자 — 스팸/패딩 의심 (권장: 1500~2500자) (-3)`)
    items.push({ label: `스팸 의심 (${Math.round(avgContentLen).toLocaleString()}자)`, points: -3 })
  } else if (isActualContent && avgContentLen >= 5000) {
    score -= 2
    details.push(`심각한 콘텐츠 과다: 평균 ${Math.round(avgContentLen).toLocaleString()}자 — 대폭 압축 필요 (-2)`)
    items.push({ label: `심각한 과다 (${Math.round(avgContentLen).toLocaleString()}자)`, points: -2 })
  } else if (isActualContent && avgContentLen >= 4000) {
    score -= 1
    details.push(`콘텐츠 과다: 평균 ${Math.round(avgContentLen).toLocaleString()}자 — 핵심 위주로 압축 권장 (-1)`)
    items.push({ label: `콘텐츠 과다 (${Math.round(avgContentLen).toLocaleString()}자)`, points: -1 })
  }

  // === [감점] 블로그 전체 이미지 과다 (0 ~ -1) === (v13: -2→-1)
  if (avgImageCount >= 20) {
    score -= 1
    details.push(`이미지 전체 과다: 평균 ${avgImageCount.toFixed(1)}장 — 이미지 도배 패턴 (-1)`)
    items.push({ label: `이미지 과다 (평균 ${avgImageCount.toFixed(1)}장)`, points: -1 })
  }

  // === [감점] 포스트 내 문장 반복 스팸 (0 ~ -2) ===
  // 블로그 전체에서 문장 복붙으로 글자수를 부풀리는 패턴 감지
  // ScrapedPostData에 본문 텍스트가 없으므로 BlogPost.description 활용
  if (posts.length >= 3) {
    let spamPostCount = 0
    for (const p of posts) {
      const plain = stripHtml(p.description).replace(/\s+/g, ' ').trim()
      if (plain.length < 200) continue
      const sentences = plain.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length >= 10)
      if (sentences.length < 4) continue
      const freq: Record<string, number> = {}
      sentences.forEach(s => { freq[s] = (freq[s] || 0) + 1 })
      const dupCount = Object.values(freq).reduce((sum, c) => sum + (c > 1 ? c - 1 : 0), 0)
      if (dupCount / sentences.length >= 0.2) spamPostCount++
    }
    const spamRate = spamPostCount / posts.length
    if (spamRate >= 0.3) {
      score -= 2
      details.push(`문장 반복 스팸: ${Math.round(spamRate * 100)}%의 글에서 동일 문장 반복 감지 (-2)`)
      items.push({ label: `문장 반복 (${Math.round(spamRate * 100)}%)`, points: -2 })
    } else if (spamRate >= 0.15) {
      score -= 1
      details.push(`문장 반복 주의: ${Math.round(spamRate * 100)}%의 글에서 문장 반복 감지 (-1)`)
      items.push({ label: `문장 반복 (${Math.round(spamRate * 100)}%)`, points: -1 })
    }
  }

  // 최종 점수 clamp
  score = Math.max(0, Math.min(maxScore, score))
  const grade = score >= 12 ? 'S' : score >= 9 ? 'A' : score >= 6 ? 'B' : score >= 3 ? 'C' : 'D'

  return { name: '콘텐츠 품질', score, maxScore, grade, details, items }
}
