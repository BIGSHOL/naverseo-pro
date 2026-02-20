/**
 * NaverSEO Pro - 블로그 지수 AI 심층 분석 모듈 (v2.5)
 *
 * Gemini 2.5 Flash를 활용한 블로그 콘텐츠 심층 분석
 * - D.I.A. 경험 정보 감지
 * - 콘텐츠 품질 심층 평가
 * - 어뷰징 정밀 감지
 * - 맞춤 추천 생성
 *
 * Gemini 2.5 Flash: 향상된 추론 능력 + 코드/분석 성능 개선
 */

import { callAI, parseGeminiJson, BLOG_INDEX_AI_PROMPT, type AiProvider } from '@/lib/ai/gemini'
import { calculateScoreAdjustment } from '@/lib/utils/scoring'
import type { AiAnalysis, BlogPost } from './types'

/** Gemini AI 응답 형식 */
interface AiAnalysisRaw {
  experienceScore: number
  experienceDetails: string
  qualityScore: number
  qualityDetails: string
  abuseRisk: number
  abuseDetails: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
}

/**
 * RSS/검색 API에서 가져온 포스트의 링크에서 blogId와 postNo를 추출
 */
function parsePostLink(link: string): { blogId: string; postNo: string } | null {
  try {
    const url = new URL(link)
    // blog.naver.com/{blogId}/{postNo}
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
      return { blogId: parts[0], postNo: parts[1] }
    }
    // PostView.naver?blogId=xxx&logNo=yyy
    const blogId = url.searchParams.get('blogId')
    const logNo = url.searchParams.get('logNo')
    if (blogId && logNo) {
      return { blogId, postNo: logNo }
    }
  } catch {
    // URL 파싱 실패
  }
  return null
}

/**
 * 네이버 블로그 포스트의 본문을 가져오는 함수
 * 모바일 URL을 사용하여 SSR 콘텐츠를 가져옴
 */
async function fetchPostContent(blogId: string, postNo: string): Promise<string | null> {
  try {
    const mobileUrl = `https://m.blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${postNo}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(mobileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) return null

    const html = await response.text()

    // 본문 텍스트 추출 (간단한 방식 — se-text-paragraph 우선)
    const paragraphs: string[] = []
    const pRegex = /<p[^>]*class=["'][^"']*se-text-paragraph[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi
    let m
    while ((m = pRegex.exec(html)) !== null) {
      const text = m[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .trim()
      if (text.length > 0) paragraphs.push(text)
    }

    if (paragraphs.length > 0) {
      return paragraphs.join('\n\n')
    }

    // 폴백: og:description
    const ogDesc = html.match(/<meta\s+(?:property=["']og:description["']\s+content=["']([^"']+)["']|content=["']([^"']+)["']\s+property=["']og:description["'])/i)
    if (ogDesc) {
      return (ogDesc[1] || ogDesc[2]).replace(/&[a-z]+;/gi, ' ').trim()
    }

    return null
  } catch {
    return null
  }
}

/**
 * 대표 포스트 선택 (최근 + 다양성 고려)
 * 최대 5개 포스트를 선택하여 더 정확한 분석 수행
 */
function selectRepresentativePosts(posts: BlogPost[], maxCount: number = 5): BlogPost[] {
  if (posts.length <= maxCount) return posts

  // 날짜순 정렬 (최신 우선)
  const sorted = [...posts].sort((a, b) => {
    const dateA = parseInt(a.postdate || '0')
    const dateB = parseInt(b.postdate || '0')
    return dateB - dateA
  })

  const selected: BlogPost[] = []

  // 1. 가장 최근 포스트 (현재 글쓰기 스타일 반영)
  selected.push(sorted[0])

  // 2. 두 번째 최신 포스트 (최근 트렌드 확인)
  if (sorted.length > 1) selected.push(sorted[1])

  // 3. 중간 시점 포스트 (글쓰기 스타일 변화 감지)
  const midIdx = Math.floor(sorted.length / 2)
  if (!selected.includes(sorted[midIdx])) {
    selected.push(sorted[midIdx])
  }

  // 4. 가장 긴 설명문 포스트 (최고 품질 글 평가)
  const longestPost = sorted
    .filter(p => !selected.includes(p))
    .sort((a, b) => b.description.length - a.description.length)[0]
  if (longestPost && selected.length < maxCount) selected.push(longestPost)

  // 5. 가장 오래된 포스트 (성장 추이 파악)
  const oldestPost = sorted[sorted.length - 1]
  if (!selected.includes(oldestPost) && selected.length < maxCount) {
    selected.push(oldestPost)
  }

  return selected.slice(0, maxCount)
}

/**
 * 블로그 포스트 AI 심층 분석 실행
 *
 * @param posts - RSS/검색에서 가져온 포스트 목록
 * @param isDemo - 데모 모드 여부
 * @returns AI 분석 결과 (실패 시 null)
 */
export async function analyzeWithAi(
  posts: BlogPost[],
  isDemo: boolean,
  provider: AiProvider = 'gemini'
): Promise<AiAnalysis | null> {
  // AI API 키가 없으면 스킵
  const hasKey = provider === 'claude'
    ? !!process.env.ANTHROPIC_API_KEY?.trim()
    : !!process.env.GEMINI_API_KEY?.trim()
  if (!hasKey) {
    console.log(`[BlogIndex AI] ${provider} API 키 미설정, AI 분석 스킵`)
    return null
  }

  // 포스트가 없으면 스킵
  if (posts.length === 0) return null

  try {
    // 대표 포스트 선택 (최대 5개로 확대하여 정확도 향상)
    const targetPosts = selectRepresentativePosts(posts, 5)
    const postContents: { title: string; content: string; date: string }[] = []

    if (isDemo) {
      // 데모 모드: 설명문(description)을 본문으로 사용
      for (const post of targetPosts) {
        const cleanDesc = post.description
          .replace(/<[^>]*>/g, '')
          .replace(/&[a-z]+;/gi, ' ')
          .trim()
        postContents.push({
          title: post.title.replace(/<[^>]*>/g, ''),
          content: cleanDesc,
          date: post.postdate,
        })
      }
    } else {
      // 실제 모드: 각 포스트의 본문을 가져옴
      for (const post of targetPosts) {
        const parsed = parsePostLink(post.link)
        if (!parsed) {
          // 링크 파싱 실패 시 설명문 사용
          const cleanDesc = post.description
            .replace(/<[^>]*>/g, '')
            .replace(/&[a-z]+;/gi, ' ')
            .trim()
          postContents.push({
            title: post.title.replace(/<[^>]*>/g, ''),
            content: cleanDesc,
            date: post.postdate,
          })
          continue
        }

        const content = await fetchPostContent(parsed.blogId, parsed.postNo)
        if (content && content.length >= 50) {
          // 본문이 너무 길면 앞 1500자 + 뒤 500자 사용 (결론/CTA 포함)
          let truncated: string
          if (content.length > 2000) {
            const head = content.substring(0, 1500)
            const tail = content.substring(content.length - 500)
            truncated = head + '\n...(중략)...\n' + tail
          } else {
            truncated = content
          }
          postContents.push({
            title: post.title.replace(/<[^>]*>/g, ''),
            content: truncated,
            date: post.postdate,
          })
        } else {
          // 본문 가져오기 실패 시 설명문 사용
          const cleanDesc = post.description
            .replace(/<[^>]*>/g, '')
            .replace(/&[a-z]+;/gi, ' ')
            .trim()
          postContents.push({
            title: post.title.replace(/<[^>]*>/g, ''),
            content: cleanDesc,
            date: post.postdate,
          })
        }

        // 네이버 rate limit 방지
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    if (postContents.length === 0) return null

    // Gemini에 보낼 사용자 메시지 구성
    const userMessage = `아래는 하나의 네이버 블로그에서 가져온 ${postContents.length}개 포스트입니다. 이 블로그의 전체적인 콘텐츠 품질을 분석해주세요.

${postContents.map((p, i) => `--- 포스트 ${i + 1} ---
제목: ${p.title}
작성일: ${p.date || '불명'}
본문:
${p.content}
`).join('\n')}`

    console.log(`[BlogIndex AI] ${postContents.length}개 포스트 분석 요청 (총 ${userMessage.length}자)`)

    const response = await callAI(provider, BLOG_INDEX_AI_PROMPT, userMessage, 1024, { jsonMode: true })
    const raw = parseGeminiJson<AiAnalysisRaw>(response)

    // 점수 범위 보정
    const experienceScore = Math.max(1, Math.min(10, raw.experienceScore))
    const qualityScore = Math.max(1, Math.min(10, raw.qualityScore))
    const abuseRisk = Math.max(0, Math.min(10, raw.abuseRisk))

    // AI 점수 보정값 계산
    const avgPositive = (experienceScore + qualityScore) / 2
    const { adjustment: scoreAdjustment, reason: adjustmentReason } = calculateScoreAdjustment({
      avgPositiveScore: avgPositive,
      abuseRisk: abuseRisk,
      positiveReason: (avg) => `AI 분석: 높은 경험 정보(${experienceScore}점)와 콘텐츠 품질(${qualityScore}점)으로 가산`,
      mildPositiveReason: 'AI 분석: 양호한 콘텐츠 품질로 소폭 가산',
      negativeReason: (_avg) => `AI 분석: 낮은 콘텐츠 품질(${qualityScore}점)로 감산`,
      abuseReason: (risk) => `AI 분석: 어뷰징 위험(${risk}점)으로 감산`,
    })

    return {
      experienceScore,
      experienceDetails: raw.experienceDetails || '',
      qualityScore,
      qualityDetails: raw.qualityDetails || '',
      abuseRisk,
      abuseDetails: raw.abuseDetails || '',
      strengths: raw.strengths || [],
      weaknesses: raw.weaknesses || [],
      recommendations: raw.recommendations || [],
      analyzedPosts: postContents.length,
      scoreAdjustment,
      adjustmentReason,
    }
  } catch (error) {
    console.error('[BlogIndex AI] AI 분석 실패:', error)
    return null
  }
}

/**
 * 데모용 AI 분석 결과 생성
 */
export function generateDemoAiAnalysis(): AiAnalysis {
  return {
    experienceScore: 7,
    experienceDetails: '직접 방문/체험 기반의 콘텐츠가 다수 확인됩니다. 날짜, 가격, 위치 정보가 구체적으로 기술되어 있습니다.',
    qualityScore: 6,
    qualityDetails: '글 구조가 비교적 체계적이나, 소제목 활용과 리스트 구조화를 더 강화하면 좋겠습니다.',
    abuseRisk: 2,
    abuseDetails: '전반적으로 자연스러운 문체입니다. 일부 키워드가 제목에 반복되는 경향이 있으나 심각한 수준은 아닙니다.',
    strengths: [
      '직접 체험 기반의 신뢰성 있는 콘텐츠',
      '구체적 가격/위치 정보 제공으로 실용성 높음',
      '이미지 활용이 적절함',
    ],
    weaknesses: [
      '소제목(H2, H3) 활용이 부족하여 구조가 단조로움',
      '관련 키워드/연관 검색어 활용이 미흡',
      '글 마무리가 약하여 체류 시간에 불리',
    ],
    recommendations: [
      '각 글에 소제목(H2) 3개 이상을 사용하여 구조화하세요',
      '핵심 키워드의 동의어/관련 키워드를 본문에 자연스럽게 배치하세요',
      '글 마지막에 핵심 정보 요약과 다음 글 예고를 추가하세요',
      '이미지에 설명 캡션을 달아 D.I.A. 점수를 높이세요',
      '댓글 유도 질문을 넣어 소통 지표를 개선하세요',
    ],
    analyzedPosts: 3,
    scoreAdjustment: 3,
    adjustmentReason: 'AI 분석: 양호한 콘텐츠 품질로 소폭 가산',
  }
}
