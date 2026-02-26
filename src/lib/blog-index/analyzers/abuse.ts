/**
 * 블로그 지수 - P. 어뷰징 감점 분석 — 최대 -20점
 *
 * 8가지 어뷰징 유형 감지:
 * 1. 키워드 스터핑: 제목에 동일 키워드 과다 반복 (-7점 max)
 * 2. 제목 유사도: 템플릿처럼 찍어내는 제목 패턴 (-7점 max)
 * 3. 설명문/본문 반복 패턴: 동일한 문구/구조 반복 (-6점 max)
 * 4. 스팸 키워드: 대출/도박/성인 등 저품질 키워드 감지 (-5점 max)
 * 5. 외부 링크 과다: 광고성/단축 URL 과다 사용 (-5점 max)
 * 6. 짧은 글 비율 과다: 300자 미만 글이 많으면 저품질 (-4점 max)
 * 7. 이미지 없는 글 과다: 텍스트만으로는 노출 불리 (-3점 max)
 * 8. 제목 특수문자/이모지 남용: 과도한 장식 (-3점 max)
 *
 * 합산 후 -20 바닥 제한
 */

import { stripHtml, extractKoreanKeywords, jaccardSimilarity } from '@/lib/utils/text'
import type { BlogPost, AbusePenalty } from '../types'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'

/** 네이버가 저품질로 분류하는 스팸성 키워드 */
const SPAM_KEYWORDS = [
  '대출', '대환대출', '신용대출', '무직자대출', '소액대출',
  '도박', '카지노', '바카라', '슬롯', '사설토토', '먹튀',
  '비아그라', '시알리스', '정력',
  '불법다운', '무료다시보기', '토렌트',
  '정보이용료', '소액결제현금화', '캐싱',
  '가품', '레플리카', '짝퉁',
]

/** 광고성/단축 URL 도메인 패턴 */
const SUSPICIOUS_DOMAINS = [
  'bit.ly', 'goo.gl', 'tinyurl.com', 'han.gl', 'me2.do',
  'is.gd', 'v.gd', 'ow.ly', 'buff.ly', 'adf.ly',
  'linktr.ee', 'hoy.kr', 'url.kr',
]

export function analyzeAbuse(
  posts: BlogPost[],
  scrapedData?: Map<string, ScrapedPostData> | null
): AbusePenalty {
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
      details.push(`키워드 과다 반복 심각: "${titleSorted[0][0]}" 키워드가 제목의 ${Math.round(topRate * 100)}%에 등장 (-7)`)
      flags.push('keyword_stuffing')
    } else if (topRate >= 0.8) {
      score -= 4
      details.push(`키워드 반복 주의: "${titleSorted[0][0]}" 키워드가 제목의 ${Math.round(topRate * 100)}%에 등장 (-4)`)
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
      details.push(`본문 키워드 밀도 과다: "${topWord}" ${(density * 100).toFixed(1)}% (권장: 0.5~3%) (-3)`)
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
      details.push(`제목 유사도 매우 높음: ${Math.round(similarRate * 100)}%의 제목 쌍이 유사 (템플릿 의심) (-7)`)
      flags.push('title_template')
    } else if (similarRate >= 0.3) {
      score -= 4
      details.push(`제목 유사도 높음: ${Math.round(similarRate * 100)}%의 제목 쌍이 유사 (-4)`)
      flags.push('title_template')
    } else if (similarRate >= 0.15) {
      score -= 2
      details.push(`일부 제목이 유사합니다 - 더 다양한 제목 패턴을 사용하세요 (-2)`)
    }
  }

  // === 3. 콘텐츠 중복/자기 표절 감지 (-6점 max) ===
  // 스크래핑 본문이 있으면 본문 키워드 기반 Jaccard 유사도 비교 (정밀)
  // 없으면 기존 설명문 첫 50자 비교 (폴백)
  let contentDupDetected = false

  if (scrapedData && scrapedData.size >= 3) {
    // 키워드 세트 기반 Jaccard 유사도 (첫 50자 정확 매칭보다 정밀)
    // description 200자까지 키워드 추출 후 비교
    const descKeywordSets = posts.slice(0, 15).map(p =>  // 비교 쌍 폭발 방지
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
        score -= 6
        details.push(`본문 콘텐츠 중복 심각: ${Math.round(simRate * 100)}%의 글 쌍이 유사 (자기 표절 의심) (-6)`)
        flags.push('content_duplication')
        contentDupDetected = true
      } else if (simRate >= 0.2) {
        score -= 3
        details.push(`본문 콘텐츠 일부 중복: ${Math.round(simRate * 100)}%의 글 쌍이 유사 (-3)`)
        flags.push('content_duplication')
        contentDupDetected = true
      }
    }
  }

  // 스크래핑 데이터 없거나 위에서 미감지 시 → 기존 설명문 첫 50자 비교 (폴백)
  if (!contentDupDetected) {
    const descSnippets = posts.map(p => {
      const clean = stripHtml(p.description)
      return clean.substring(0, 50)
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
      details.push(`설명문 반복 패턴 심각: ${duplicateCount}개 포스트가 유사한 시작 문구 사용 (-6)`)
      flags.push('content_duplication')
    } else if (duplicateCount >= posts.length * 0.3) {
      score -= 3
      details.push(`설명문 반복 패턴 주의: ${duplicateCount}개 포스트가 유사한 시작 문구 사용 (-3)`)
      flags.push('content_duplication')
    }
  }

  // === 4. 스팸/저품질 키워드 감지 (-5점 max) ===
  const allText = posts.map(p => stripHtml(p.title) + ' ' + stripHtml(p.description)).join(' ').toLowerCase()
  const detectedSpam: string[] = []
  for (const keyword of SPAM_KEYWORDS) {
    // 단어 경계를 감안해 2회 이상 등장 시 감지
    const regex = new RegExp(keyword, 'gi')
    const matches = allText.match(regex)
    if (matches && matches.length >= 2) {
      detectedSpam.push(keyword)
    }
  }

  if (detectedSpam.length >= 3) {
    score -= 5
    details.push(`스팸 키워드 다수 감지: ${detectedSpam.slice(0, 5).join(', ')} (${detectedSpam.length}종) (-5)`)
    flags.push('spam_keywords')
  } else if (detectedSpam.length >= 1) {
    score -= 2
    details.push(`스팸성 키워드 주의: ${detectedSpam.join(', ')} (-2)`)
    flags.push('spam_keywords')
  }

  // === 5. 외부 링크 과다/광고성 링크 감지 (-5점 max) ===
  if (scrapedData && scrapedData.size > 0) {
    const postsWithMeta = Array.from(scrapedData.values()).filter(p => p.meta?.linkAnalysis)
    if (postsWithMeta.length > 0) {
      const totalExternal = postsWithMeta.reduce(
        (s, p) => s + (p.meta!.linkAnalysis.externalCount || 0), 0
      )
      const avgExternal = totalExternal / postsWithMeta.length

      // 단축/광고 URL 감지
      let suspiciousCount = 0
      postsWithMeta.forEach(p => {
        p.meta!.linkAnalysis.externalLinks.forEach(link => {
          const domain = link.domain.toLowerCase()
          if (SUSPICIOUS_DOMAINS.some(d => domain.includes(d))) {
            suspiciousCount++
          }
        })
      })

      if (suspiciousCount >= 5) {
        score -= 4
        details.push(`광고성/단축 URL ${suspiciousCount}개 감지 - 신뢰도에 부정적 영향 (-4)`)
        flags.push('suspicious_links')
      } else if (suspiciousCount >= 2) {
        score -= 2
        details.push(`단축 URL ${suspiciousCount}개 감지 주의 (-2)`)
        flags.push('suspicious_links')
      }

      if (avgExternal >= 5) {
        score -= 3
        details.push(`외부 링크 과다 (포스트당 평균 ${avgExternal.toFixed(1)}개) - 스팸 신호 (-3)`)
        if (!flags.includes('suspicious_links')) flags.push('excessive_external_links')
      } else if (avgExternal >= 3) {
        score -= 1
        details.push(`외부 링크 다소 많음 (포스트당 평균 ${avgExternal.toFixed(1)}개) (-1)`)
      }
    }
  }

  // === 6. 짧은 글 비율 과다 (-4점 max) ===
  if (scrapedData && scrapedData.size >= 3) {
    const scrapedPosts = Array.from(scrapedData.values())
    const shortPosts = scrapedPosts.filter(p => p.charCount < 300).length
    const shortRate = shortPosts / scrapedPosts.length

    if (shortRate >= 0.7) {
      score -= 4
      details.push(`짧은 글 비율 과다: ${Math.round(shortRate * 100)}%가 300자 미만 (저품질 콘텐츠 의심) (-4)`)
      flags.push('short_content')
    } else if (shortRate >= 0.4) {
      score -= 2
      details.push(`짧은 글 비율 주의: ${Math.round(shortRate * 100)}%가 300자 미만 (-2)`)
      flags.push('short_content')
    }
  }

  // === 7. 이미지 없는 글 과다 (-3점 max) ===
  if (scrapedData && scrapedData.size >= 3) {
    const scrapedPosts = Array.from(scrapedData.values())
    const noImagePosts = scrapedPosts.filter(p => !p.hasImage).length
    const noImageRate = noImagePosts / scrapedPosts.length

    if (noImageRate >= 0.8) {
      score -= 3
      details.push(`이미지 없는 글 ${Math.round(noImageRate * 100)}% - 텍스트만으로는 노출 불리 (-3)`)
      flags.push('no_images')
    } else if (noImageRate >= 0.5) {
      score -= 1
      details.push(`이미지 없는 글 ${Math.round(noImageRate * 100)}% - 이미지 추가 권장 (-1)`)
      flags.push('no_images')
    }
  }

  // === 8. 제목 과도한 특수문자/이모지 남용 (-3점 max) ===
  const specialCharTitles = posts.filter(p => {
    const title = stripHtml(p.title)
    const specialChars = title.match(/[★☆♥♡◆◇■□▶▷●○♠♣♦◈※☞→←↑↓⊙⊕⊗✔✖✦❤❥❣✨⭐🔥💯🎉🎊💥⚡]/g)
    return specialChars && specialChars.length >= 3
  }).length
  const specialCharRate = posts.length > 0 ? specialCharTitles / posts.length : 0

  if (specialCharRate >= 0.6) {
    score -= 3
    details.push(`제목 특수문자/이모지 남용: ${Math.round(specialCharRate * 100)}%의 제목에 과다 사용 (-3)`)
    flags.push('special_char_abuse')
  } else if (specialCharRate >= 0.3) {
    score -= 1
    details.push(`제목 특수문자 다소 많음: ${Math.round(specialCharRate * 100)}%의 제목에 사용 (-1)`)
    flags.push('special_char_abuse')
  }

  // 감점이 없으면 긍정적 메시지
  if (score === 0) {
    details.push('어뷰징 패턴이 감지되지 않았습니다')
  }

  // 최소값 -20으로 제한
  return { score: Math.max(-20, score), details, flags }
}
