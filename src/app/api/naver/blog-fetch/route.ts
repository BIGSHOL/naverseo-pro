import { NextRequest, NextResponse } from 'next/server'
import {
  parseNaverBlogUrl,
  buildPostViewUrl,
  buildMobilePostViewUrl,
  extractTitle,
  extractContent,
  htmlToPlainText,
} from '@/lib/naver/blog-fetch'
import { scrapeBlogPost, toMobileUrl } from '@/lib/naver/blog-scraper'
import { extractPostMetaData, type PostMetaData } from '@/lib/naver/post-meta-extractor'

// === 데모 데이터 ===

function getDemoData() {
  return {
    title: '네이버 블로그 SEO 최적화 완벽 가이드 2026',
    content: `안녕하세요, 오늘은 네이버 블로그 SEO 최적화에 대해 자세히 알아보겠습니다.

네이버 블로그를 운영하면서 가장 중요한 것 중 하나가 바로 SEO(검색엔진 최적화)입니다. 네이버의 C-Rank와 D.I.A. 알고리즘을 이해하고, 이에 맞춰 콘텐츠를 최적화하면 검색 상위 노출을 달성할 수 있습니다.

1. 키워드 리서치의 중요성

블로그 글을 작성하기 전에 반드시 키워드 리서치를 해야 합니다. 검색량이 높으면서도 경쟁이 적은 키워드를 찾는 것이 핵심입니다.

2. 제목 최적화

제목에 핵심 키워드를 자연스럽게 포함시키는 것이 중요합니다. 제목 길이는 30~40자가 적당하며, 너무 짧거나 너무 긴 제목은 피하는 것이 좋습니다.

3. 본문 구조화

소제목(H2, H3)을 활용하여 글을 체계적으로 구성하세요. 2,000~3,000자 분량이 네이버 블로그에서 가장 좋은 성과를 보이는 것으로 알려져 있습니다.

4. 이미지와 멀티미디어 활용

적절한 이미지를 3~5개 포함하고, 이미지에 ALT 태그를 달아주면 SEO에 도움이 됩니다.

5. 정기적인 포스팅

꾸준한 포스팅은 C-Rank 지수를 높이는 데 매우 중요합니다. 최소 주 2~3회 이상의 포스팅을 권장합니다.

이상으로 네이버 블로그 SEO 최적화에 대해 알아보았습니다. 위 방법들을 실천하시면 분명 좋은 결과를 얻으실 수 있을 것입니다.

[이미지 4개 포함]`,
    source: 'demo',
    isDemo: true,
  }
}

// === 공통 fetch 함수 ===

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.error(`[BlogFetch] HTTP ${response.status} for ${url}`)
      return null
    }

    return await response.text()
  } catch (err) {
    console.error(`[BlogFetch] fetch 실패 (${url}):`, err)
    return null
  }
}

/**
 * HTML에서 본문을 추출하고 충분한 내용인지 확인
 */
function tryExtractContent(html: string): { title: string; content: string } | null {
  const title = extractTitle(html)
  const rawContent = extractContent(html)
  const content = htmlToPlainText(rawContent)

  // 본문이 충분하면 성공
  if (content.length >= 50) {
    return { title, content }
  }

  return null
}

// === API 핸들러 ===

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { url } = await request.json()

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return NextResponse.json(
        { error: '블로그 URL을 입력해주세요.' },
        { status: 400 }
      )
    }

    const cleanUrl = url.trim()

    // 네이버 블로그 URL인지 확인
    const parsed = parseNaverBlogUrl(cleanUrl)
    if (!parsed) {
      return NextResponse.json(
        { error: '올바른 네이버 블로그 URL이 아닙니다. (예: https://blog.naver.com/blogid/123456)' },
        { status: 400 }
      )
    }

    // 1차 시도: 모바일 URL (SSR 콘텐츠가 더 완전함)
    const mobileUrl = buildMobilePostViewUrl(parsed.blogId, parsed.postNo)
    console.log(`[BlogFetch] 1차 시도 (모바일): ${mobileUrl}`)

    let html = await fetchHtml(mobileUrl)
    let extracted = html ? tryExtractContent(html) : null

    // 2차 시도: 데스크톱 PostView URL
    if (!extracted) {
      const desktopUrl = buildPostViewUrl(parsed.blogId, parsed.postNo)
      console.log(`[BlogFetch] 2차 시도 (데스크톱): ${desktopUrl}`)

      html = await fetchHtml(desktopUrl)
      extracted = html ? tryExtractContent(html) : null
    }

    // 3차 시도: 원본 URL 직접 fetch
    if (!extracted && cleanUrl !== mobileUrl) {
      console.log(`[BlogFetch] 3차 시도 (원본 URL): ${cleanUrl}`)

      html = await fetchHtml(cleanUrl)
      extracted = html ? tryExtractContent(html) : null
    }

    // 모든 시도 실패
    if (!extracted) {
      // html은 있지만 본문 추출 실패 → 비공개/삭제 가능성
      if (html) {
        return NextResponse.json(
          { error: '블로그 글 내용을 가져올 수 없습니다. 비공개 글이거나, 본문이 이미지 위주인 경우 직접 텍스트를 붙여넣어 주세요.' },
          { status: 422 }
        )
      }
      // 네트워크 오류
      return NextResponse.json(getDemoData())
    }

    // ===== 상세 분석 추가 (블로그 스크래핑 시스템 통합) =====
    let detailedAnalysis: PostMetaData | null = null
    let scrapedData: { charCount: number; imageCount: number; videoCount: number; linkCount: number; tableCount: number; hasImage: boolean; imageUrls: string[]; commentCount: number | null; sympathyCount: number | null; readCount: number | null; formatting?: { hasBold: boolean; hasHeading: boolean; hasFontSize: boolean; hasColor: boolean; hasHighlight: boolean; hasUnderline: boolean; count: number } } | null = null

    try {
      // 모바일 URL로 변환하여 상세 스크래핑 시도
      const blogUrl = `https://blog.naver.com/${parsed.blogId}/${parsed.postNo}`
      const mobilePostUrl = toMobileUrl(blogUrl)

      if (mobilePostUrl && html) {
        // 1. 스크래핑 데이터 추출 (글자수, 이미지 수)
        const scraped = await scrapeBlogPost(blogUrl)
        if (scraped && scraped.isScrapped) {
          scrapedData = {
            charCount: scraped.charCount,
            imageCount: scraped.imageCount,
            videoCount: scraped.videoCount,
            linkCount: scraped.linkCount,
            tableCount: scraped.tableCount,
            hasImage: scraped.hasImage,
            imageUrls: scraped.imageUrls,
            commentCount: scraped.commentCount,
            sympathyCount: scraped.sympathyCount,
            readCount: scraped.readCount,
            formatting: scraped.formatting,
          }
        }

        // 2. 메타 데이터 추출 (태그, 링크 분석 등)
        detailedAnalysis = extractPostMetaData(html, parsed.blogId)
      }
    } catch (err) {
      console.log('[BlogFetch] 상세 분석 실패 (무시하고 계속):', err)
      // 상세 분석 실패는 무시하고 기본 정보만 반환
    }

    // 응답 데이터 구성
    const response: {
      title: string
      content: string
      source: string
      isDemo: boolean
      detailedAnalysis?: {
        tags?: string[]
        category?: string | null
        linkCount?: { internal: number; external: number }
        scrapedData?: {
          charCount: number
          imageCount: number
          videoCount: number
          linkCount: number
          tableCount: number
          hasImage: boolean
          imageUrls: string[]
          commentCount: number | null
          sympathyCount: number | null
          readCount: number | null
          formatting?: {
            hasBold: boolean
            hasHeading: boolean
            hasFontSize: boolean
            hasColor: boolean
            hasHighlight: boolean
            hasUnderline: boolean
            count: number
          }
        }
      }
    } = {
      title: extracted.title,
      // 이미지는 본문 내 위치별 [이미지] 마커로 포함됨 (SEO 엔진이 위치 감지 가능)
      content: extracted.content.trim(),
      source: `https://blog.naver.com/${parsed.blogId}/${parsed.postNo}`,
      isDemo: false,
    }

    // 상세 분석 데이터 추가
    if (detailedAnalysis || scrapedData) {
      response.detailedAnalysis = {}

      if (detailedAnalysis) {
        response.detailedAnalysis.tags = detailedAnalysis.tags.length > 0 ? detailedAnalysis.tags : undefined
        response.detailedAnalysis.category = detailedAnalysis.category
        response.detailedAnalysis.linkCount = {
          internal: detailedAnalysis.linkAnalysis.internalCount,
          external: detailedAnalysis.linkAnalysis.externalCount,
        }
      }

      if (scrapedData) {
        response.detailedAnalysis.scrapedData = scrapedData
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[BlogFetch] 오류:', errorMessage)
    return NextResponse.json(
      { error: `블로그 글을 가져오는 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
