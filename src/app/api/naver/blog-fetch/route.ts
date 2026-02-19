import { NextRequest, NextResponse } from 'next/server'
import {
  parseNaverBlogUrl,
  buildPostViewUrl,
  extractTitle,
  extractContent,
  htmlToPlainText,
} from '@/lib/naver/blog-fetch'

// === 데모 데이터 ===

function getDemoData() {
  return {
    title: '네이버 블로그 SEO 최적화 완벽 가이드 2025',
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

// === API 핸들러 ===

export async function POST(request: NextRequest) {
  try {
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

    // PostView URL 생성 (iframe 없는 직접 접근 URL)
    const postViewUrl = buildPostViewUrl(parsed.blogId, parsed.postNo)

    let html: string
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(postViewUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        console.error(`[BlogFetch] HTTP ${response.status} for ${postViewUrl}`)
        // fetch 실패 시 데모 데이터 반환
        return NextResponse.json(getDemoData())
      }

      html = await response.text()
    } catch (fetchError) {
      console.error('[BlogFetch] fetch 실패:', fetchError)
      // 네트워크 오류 시 데모 데이터 반환
      return NextResponse.json(getDemoData())
    }

    // 제목 추출
    const title = extractTitle(html)

    // 본문 추출
    const rawContent = extractContent(html)
    const content = htmlToPlainText(rawContent)

    // 비공개/삭제 글 체크 (본문이 너무 짧은 경우)
    if (content.length < 50) {
      return NextResponse.json(
        { error: '블로그 글 내용을 가져올 수 없습니다. 비공개 글이거나 삭제된 글일 수 있습니다.' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      title,
      content,
      source: `https://blog.naver.com/${parsed.blogId}/${parsed.postNo}`,
      isDemo: false,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[BlogFetch] 오류:', errorMessage)
    return NextResponse.json(
      { error: `블로그 글을 가져오는 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
