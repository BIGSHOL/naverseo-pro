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
    console.log(`[BlogIndex] 본문 크롤링 시작: ${blogId}/${postNo}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 8초 → 15초로 증가

    const response = await fetch(mobileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.warn(`[BlogIndex] HTTP ${response.status} - ${blogId}/${postNo}`)
      return null
    }

    const html = await response.text()
    console.log(`[BlogIndex] HTML 크기: ${html.length}자 - ${blogId}/${postNo}`)

    // blog-scraper.ts와 동일한 파싱 로직 적용
    let bodyHtml = ''

    // SmartEditor 3: div 깊이 추적으로 se-main-container 전체 범위 추출
    const seContainerIdx = html.indexOf('se-main-container')
    if (seContainerIdx > -1) {
      const divStart = html.lastIndexOf('<div', seContainerIdx)
      const contentStart = html.indexOf('>', divStart) + 1

      // 중첩 div를 추적하여 올바른 닫힘 위치 찾기
      let depth = 1
      let pos = contentStart
      while (depth > 0 && pos < html.length) {
        const nextOpen = html.indexOf('<div', pos)
        const nextClose = html.indexOf('</div>', pos)

        if (nextClose === -1) break

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++
          pos = nextOpen + 4
        } else {
          depth--
          if (depth === 0) {
            bodyHtml = html.substring(contentStart, nextClose)
          }
          pos = nextClose + 6
        }
      }
    }

    // 구형 에디터 폴백
    if (!bodyHtml) {
      const postViewIdx = html.indexOf('id="postViewArea"') !== -1
        ? html.indexOf('id="postViewArea"')
        : html.indexOf('class="post-view')
      if (postViewIdx > -1) {
        const divStart = html.lastIndexOf('<div', postViewIdx)
        const contentStart = html.indexOf('>', divStart) + 1
        let depth = 1
        let pos = contentStart
        while (depth > 0 && pos < html.length) {
          const nextOpen = html.indexOf('<div', pos)
          const nextClose = html.indexOf('</div>', pos)
          if (nextClose === -1) break
          if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++
            pos = nextOpen + 4
          } else {
            depth--
            if (depth === 0) bodyHtml = html.substring(contentStart, nextClose)
            pos = nextClose + 6
          }
        }
      }
    }

    // 최종 폴백: 스크립트/스타일/헤더/푸터 제거
    if (!bodyHtml) {
      bodyHtml = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    }

    // HTML 태그 제거 후 순수 텍스트
    const text = bodyHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (text.length > 0) {
      console.log(`[BlogIndex] ✅ 본문 파싱 성공: ${text.length}자 - ${blogId}/${postNo}`)
      return text
    }

    console.warn(`[BlogIndex] ❌ 본문 추출 완전 실패 - ${blogId}/${postNo}`)
    return null
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[BlogIndex] 크롤링 에러: ${blogId}/${postNo} - ${errorMsg}`)
    return null
  }
}

/**
 * 대표 포스트 선택 (최근 + 균등 분포 + 다양성)
 * maxCount개 포스트를 선택하여 블로그 전체를 대표
 */
function selectRepresentativePosts(posts: BlogPost[], maxCount: number = 20): BlogPost[] {
  if (posts.length <= maxCount) return posts

  // 날짜순 정렬 (최신 우선)
  const sorted = [...posts].sort((a, b) => {
    const dateA = parseInt(a.postdate || '0')
    const dateB = parseInt(b.postdate || '0')
    return dateB - dateA
  })

  const selected: BlogPost[] = []
  const usedIndices = new Set<number>()

  const addPost = (idx: number) => {
    if (idx >= 0 && idx < sorted.length && !usedIndices.has(idx)) {
      selected.push(sorted[idx])
      usedIndices.add(idx)
    }
  }

  // 1. 최신 3개 (현재 스타일)
  addPost(0)
  addPost(1)
  addPost(2)

  // 2. 가장 오래된 포스트 (성장 추이)
  addPost(sorted.length - 1)

  // 3. 가장 긴/짧은 설명문 (품질 범위 파악)
  const byDescLen = sorted.map((p, i) => ({ i, len: p.description.length })).sort((a, b) => b.len - a.len)
  addPost(byDescLen[0]?.i)
  const shortest = byDescLen[byDescLen.length - 1]
  if (shortest) addPost(shortest.i)

  // 4. 나머지는 균등 간격으로 채움
  const remaining = maxCount - selected.length
  if (remaining > 0) {
    const step = sorted.length / (remaining + 1)
    for (let k = 1; k <= remaining; k++) {
      const idx = Math.round(step * k)
      if (!usedIndices.has(idx)) {
        addPost(idx)
      } else {
        // 가장 가까운 미사용 인덱스
        for (let offset = 1; offset < sorted.length; offset++) {
          if (!usedIndices.has(idx + offset) && idx + offset < sorted.length) { addPost(idx + offset); break }
          if (!usedIndices.has(idx - offset) && idx - offset >= 0) { addPost(idx - offset); break }
        }
      }
    }
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
    // 대표 포스트 선택 (최대 20개로 확대하여 정확도 향상)
    const targetPosts = selectRepresentativePosts(posts, 20)
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
      // 실제 모드: 배치 병렬 크롤링 (4개씩, rate limit 방지)
      const BATCH_SIZE = 4
      for (let i = 0; i < targetPosts.length; i += BATCH_SIZE) {
        const batch = targetPosts.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          batch.map(async (post) => {
            const parsed = parsePostLink(post.link)
            if (!parsed) {
              const cleanDesc = post.description.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
              return { title: post.title.replace(/<[^>]*>/g, ''), content: cleanDesc, date: post.postdate }
            }
            const content = await fetchPostContent(parsed.blogId, parsed.postNo)
            if (content && content.length >= 50) {
              // 20개 분석이므로 본문을 1000자로 축약 (토큰 절약)
              let truncated: string
              if (content.length > 1200) {
                const head = content.substring(0, 800)
                const tail = content.substring(content.length - 400)
                truncated = head + '\n...\n' + tail
              } else {
                truncated = content
              }
              return { title: post.title.replace(/<[^>]*>/g, ''), content: truncated, date: post.postdate }
            }
            const cleanDesc = post.description.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
            return { title: post.title.replace(/<[^>]*>/g, ''), content: cleanDesc, date: post.postdate }
          })
        )
        for (const r of results) {
          if (r.status === 'fulfilled') postContents.push(r.value)
        }
        // 배치 간 rate limit 방지
        if (i + BATCH_SIZE < targetPosts.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }

    if (postContents.length === 0) return null

    // Gemini에 보낼 사용자 메시지 구성
    const userMessage = `아래는 하나의 네이버 블로그에서 가져온 ${postContents.length}개 포스트입니다. 이 블로그의 전체적인 콘텐츠 품질을 분석해주세요.
참고: 긴 본문은 앞부분과 뒷부분만 발췌되었을 수 있습니다. 본문이 잘렸다는 언급 없이 제공된 내용만으로 분석해주세요.

${postContents.map((p, i) => `--- 포스트 ${i + 1} ---
제목: ${p.title}
작성일: ${p.date || '불명'}
본문:
${p.content}
`).join('\n')}`

    console.log(`[BlogIndex AI] ${postContents.length}개 포스트 분석 요청 (총 ${userMessage.length}자)`)

    const response = await callAI(provider, BLOG_INDEX_AI_PROMPT, userMessage, 4096, { jsonMode: true })
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

    // ===== Validation: 빈 배열 방지 (점수 기반 intelligent fallback) =====
    let recommendations = raw.recommendations || []
    let weaknesses = raw.weaknesses || []

    // 개선점이 없으면 점수 기반 fallback 제공
    if (recommendations.length === 0) {
      if (avgPositive >= 8) {
        // 고득점: 미세 개선 팁
        recommendations = [
          '질문형 소제목을 활용하여 대화형 검색에 대응하세요',
          '문단을 2~3문장으로 짧게 나누어 VLM 시각 최적화를 개선하세요',
          '권위 있는 출처(통계, 공식 발표)를 인용하여 신뢰도를 높이세요',
        ]
      } else if (avgPositive >= 6) {
        // 중간 점수: 구조/키워드 개선
        recommendations = [
          '소제목(H2, H3)을 활용하여 글 구조를 체계화하세요',
          '핵심 키워드의 동의어를 본문에 자연스럽게 배치하세요',
          '이미지에 설명 캡션을 추가하여 가독성과 SEO를 개선하세요',
          '글 마지막에 핵심 정보 요약을 추가하여 스캔 가능성을 높이세요',
        ]
      } else {
        // 낮은 점수: 근본적 개선
        recommendations = [
          '직접 경험 정보(날짜, 장소, 가격, 느낌)를 추가하여 경험 점수를 높이세요',
          '소제목으로 글을 단계별로 구조화하여 독자 체류 시간을 늘리세요',
          '구체적 수치와 데이터를 추가하여 정보 깊이를 강화하세요',
          '복사/붙여넣기 느낌을 줄이고 본인만의 해석과 의견을 넣으세요',
        ]
      }

      // 어뷰징 위험이 높으면 추가 경고
      if (abuseRisk >= 5) {
        recommendations.push('키워드 반복을 줄이고 자연스러운 문체로 다듬으세요')
      }
    }

    // 약점이 없으면 점수 기반 fallback 제공
    if (weaknesses.length === 0) {
      if (experienceScore < 6) {
        weaknesses.push('직접 체험 흔적이 부족하여 경험 점수가 낮음')
      }
      if (qualityScore < 6) {
        weaknesses.push('글 구조가 단조롭고 소제목 활용이 미흡함')
      }
      if (abuseRisk >= 5) {
        weaknesses.push('키워드 과다 삽입 또는 기계적 패턴이 감지됨')
      }
      // 모든 점수가 높아도 최소 1개 약점은 제시
      if (weaknesses.length === 0) {
        weaknesses.push('이미지 설명 캡션 활용이 부족함')
      }
    }

    return {
      experienceScore,
      experienceDetails: raw.experienceDetails || '',
      qualityScore,
      qualityDetails: raw.qualityDetails || '',
      abuseRisk,
      abuseDetails: raw.abuseDetails || '',
      strengths: raw.strengths || [],
      weaknesses,
      recommendations,
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
