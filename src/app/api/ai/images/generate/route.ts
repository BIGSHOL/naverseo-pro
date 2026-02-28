import { NextRequest, NextResponse } from 'next/server'
import { checkCredits, deductCredits } from '@/lib/credit-check'

export const maxDuration = 60

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

interface ImageMarker {
  index: number
  description: string
}

/**
 * 실제 사진이 필요한 이미지인지 판별
 * AI가 생성할 수 없는 유형: 건물 외관, 실제 장소, 스크린샷, 지도, 인물 등
 */
const REAL_PHOTO_PATTERNS = [
  // 건물/장소 외관·내부
  /외관/,
  /내부\s*(사진|모습|전경)/,
  /전경/,
  /전면\s*(사진|모습)/,
  /건물\s*(사진|모습)/,
  /매장\s*(사진|모습|전경|내부|외부)/,
  /가게\s*(사진|모습|전경|내부|외부)/,
  /입구\s*(사진|모습)/,
  /간판/,
  // 스크린샷/캡처
  /스크린샷/,
  /캡[처쳐]/,
  /화면\s*(캡|사진|촬영)/,
  // 지도/위치
  /지도/,
  /약도/,
  /네이버\s*지도/,
  /구글\s*맵/,
  /위치\s*(안내|사진)/,
  /찾아오시는\s*길/,
  // 실제 인물
  /인물\s*사진/,
  /얼굴/,
  /셀[카피]/,
  /프로필\s*사진/,
  /증명\s*사진/,
  /단체\s*사진/,
  // 실제 제품/문서
  /영수증/,
  /메뉴판/,
  /명함/,
  /자격증/,
  /수료증/,
  /성적표/,
  // 실제 촬영 필요
  /실제\s*(사진|촬영|모습)/,
  /현장\s*(사진|촬영|모습)/,
  /시공\s*(사진|전후|과정)/,
  /비포\s*(앤|&)\s*애프터/,
  /before\s*(and|&)\s*after/i,
]

function isRealPhotoRequired(description: string): boolean {
  return REAL_PHOTO_PATTERNS.some(pattern => pattern.test(description))
}

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { contentId, keyword, markers } = body as {
      contentId: string | null
      keyword: string
      markers: ImageMarker[]
    }

    if (!keyword?.trim()) {
      return NextResponse.json({ error: '키워드가 필요합니다.' }, { status: 400 })
    }

    if (!markers || !Array.isArray(markers) || markers.length === 0) {
      return NextResponse.json({ error: '이미지 마커가 없습니다.' }, { status: 400 })
    }

    // 최대 10장 제한 (Vercel 60초 타임아웃 고려)
    const safeMarkers = markers.slice(0, 10)

    // 실사 이미지 필터링 (서버 안전장치)
    const generatable: ImageMarker[] = []
    const skipped: Array<{ index: number; description: string; reason: string }> = []

    for (const marker of safeMarkers) {
      if (isRealPhotoRequired(marker.description)) {
        skipped.push({
          index: marker.index,
          description: marker.description,
          reason: '실제 사진이 필요한 이미지 (AI 생성 불가)',
        })
      } else {
        generatable.push(marker)
      }
    }

    // 생성 가능한 마커가 없으면 즉시 반환
    if (generatable.length === 0) {
      return NextResponse.json({
        error: '생성 가능한 이미지가 없습니다. 모든 마커가 실제 사진이 필요한 유형입니다.',
        skipped,
      }, { status: 400 })
    }

    // 크레딧 체크 (생성 가능한 장수만)
    const creditCheck = await checkCredits(supabase, user.id, 'image_generation', generatable.length)
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: creditCheck.message || '크레딧이 부족합니다.',
          creditLimit: true,
          balance: creditCheck.balance,
          cost: creditCheck.cost,
          planGate: creditCheck.planGate,
        },
        { status: 403 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // NDJSON 스트리밍 응답
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        }

        try {
          // 스킵된 마커 알림
          for (const s of skipped) {
            send({ type: 'skipped', index: s.index, description: s.description, reason: s.reason })
          }

          let successCount = 0
          let failCount = 0
          const results: Array<{ index: number; url: string; description: string }> = []

          for (let i = 0; i < generatable.length; i++) {
            const marker = generatable[i]
            send({
              type: 'progress',
              current: i + 1,
              total: generatable.length,
              message: `이미지 생성 중... (${i + 1}/${generatable.length})`,
            })

            try {
              // Gemini 이미지 생성 호출
              const imageData = await generateImageWithGemini(
                apiKey,
                keyword,
                marker.description
              )

              if (!imageData) {
                send({ type: 'error_partial', index: marker.index, reason: '이미지 생성 실패 (빈 응답)' })
                failCount++
                continue
              }

              // Supabase Storage 업로드
              const timestamp = Date.now()
              const fileName = `${user.id}/${contentId || 'temp'}_${marker.index}_${timestamp}.png`

              // base64 → Buffer
              const buffer = Buffer.from(imageData.base64, 'base64')

              const { error: uploadError } = await supabase.storage
                .from('ai-images')
                .upload(fileName, buffer, {
                  contentType: imageData.mimeType || 'image/png',
                  upsert: true,
                })

              if (uploadError) {
                console.error(`[ImageGen] 업로드 실패 (${marker.index}):`, uploadError.message)
                send({ type: 'error_partial', index: marker.index, reason: `업로드 실패: ${uploadError.message}` })
                failCount++
                continue
              }

              // 공개 URL 획득
              const { data: urlData } = supabase.storage
                .from('ai-images')
                .getPublicUrl(fileName)

              const publicUrl = urlData?.publicUrl
              if (!publicUrl) {
                send({ type: 'error_partial', index: marker.index, reason: 'URL 생성 실패' })
                failCount++
                continue
              }

              results.push({ index: marker.index, url: publicUrl, description: marker.description })
              send({ type: 'image', index: marker.index, url: publicUrl, description: marker.description })
              successCount++
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error)
              console.error(`[ImageGen] 마커 ${marker.index} 오류:`, msg)
              send({ type: 'error_partial', index: marker.index, reason: msg })
              failCount++
            }
          }

          // 성공한 만큼만 크레딧 차감
          if (successCount > 0) {
            await deductCredits(supabase, user.id, 'image_generation', {
              keyword,
              contentId,
              generated: successCount,
              failed: failCount,
              skippedCount: skipped.length,
            }, successCount)
          }

          send({
            type: 'result',
            generated: successCount,
            failed: failCount,
            skippedCount: skipped.length,
            totalCredits: successCount,
            images: results,
          })
        } catch (error) {
          console.error('[ImageGen] 스트리밍 오류:', error)
          send({ type: 'error', error: '이미지 생성 중 오류가 발생했습니다.' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)

    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
      return NextResponse.json(
        { error: 'AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }

    console.error('[ImageGen] 오류:', error)
    return NextResponse.json(
      { error: `이미지 생성 중 오류가 발생했습니다: ${msg}` },
      { status: 500 }
    )
  }
}

/**
 * Gemini 이미지 생성 (gemini-2.5-flash-image, responseModalities: IMAGE)
 * 30초 타임아웃
 */
async function generateImageWithGemini(
  apiKey: string,
  keyword: string,
  description: string
): Promise<{ base64: string; mimeType: string } | null> {
  const url = `${GEMINI_API_BASE}/gemini-2.5-flash-image:generateContent?key=${apiKey}`

  const prompt = [
    '한국 네이버 블로그 포스트에 사용할 이미지를 생성하세요.',
    `블로그 주제: "${keyword}"`,
    `이미지 설명: ${description}`,
    '스타일: 깔끔하고 전문적인 블로그 삽화, 텍스트/워터마크 없이, 밝은 톤',
  ].join('\n')

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.7,
    },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      throw new Error(`Gemini API 오류 (${res.status}): ${errorText.slice(0, 200)}`)
    }

    const data = await res.json()

    // 응답에서 이미지 데이터 추출
    const candidates = data?.candidates
    if (!candidates?.[0]?.content?.parts) {
      return null
    }

    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
        }
      }
    }

    return null
  } catch (error) {
    clearTimeout(timer)
    throw error
  }
}
