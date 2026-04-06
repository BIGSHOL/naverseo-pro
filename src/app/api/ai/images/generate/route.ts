import { NextRequest, NextResponse } from 'next/server'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import sharp from 'sharp'

// API Route는 항상 동적으로 실행 (cookies 사용으로 인한 정적 빌드 방지)
export const dynamic = 'force-dynamic'

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

/**
 * 이미지 스타일 자동 분류 시스템
 * 설명 키워드를 분석하여 최적의 시각 스타일을 결정
 */
type ImageStyle =
  | 'photorealistic'   // 실사풍 (음식, 인테리어, 자연, 여행)
  | 'infographic'      // 인포그래픽 (단계, 과정, 비교, 통계)
  | 'illustration'     // 일러스트 (개념, 팁, 가이드, 추상)
  | 'icon_flat'        // 플랫 아이콘 (기능, 특징, 카테고리)
  | 'chart_data'       // 데이터 시각화 (그래프, 차트, 성장)
  | 'thumbnail'        // 블로그 썸네일 (제목 강조, 배너)
  | 'product'          // 제품 사진풍 (제품, 패키지, 언박싱)
  | 'scene'            // 장면 연출 (라이프스타일, 분위기)

interface StyleRule {
  style: ImageStyle
  patterns: RegExp[]
}

const STYLE_RULES: StyleRule[] = [
  // 1. 썸네일/배너 — 제목이 들어가는 대표 이미지
  {
    style: 'thumbnail',
    patterns: [
      /썸네일/, /대표\s*이미지/, /배너/, /커버/, /타이틀/,
      /헤더\s*이미지/, /메인\s*이미지/, /대문/, /표지/,
      /TOP\s*\d/i, /BEST\s*\d/i, /추천\s*\d/i, /순위/,
    ],
  },
  // 2. 인포그래픽 — 단계, 과정, 비교, 구조화된 정보
  {
    style: 'infographic',
    patterns: [
      /인포그래픽/, /로드맵/, /타임라인/, /플로우\s*차트/, /순서도/,
      /마인드\s*맵/, /조직도/, /계통도/, /분류\s*(표|도)/,
      /비교\s*(표|차트|이미지)/, /장단점/, /체크\s*리스트/,
      /단계\s*(표|도|별|이미지)/, /과정\s*(표|도|이미지)/, /절차/,
      /일정\s*(표|계획)/, /시간\s*(표|계획)/, /커리큘럼/,
      /가격\s*(표|비교)/, /견적/, /요금\s*(표|비교)/,
      /성분\s*(표|비교)/, /영양\s*(표|성분|정보)/,
      /스펙\s*(표|비교)/, /사양\s*(표|비교)/,
      /vs\b/i, /대\s/, /차이점/, /비교/,
      /\d+단계/, /\d+가지/, /\d+종류/,
    ],
  },
  // 3. 차트/데이터 — 수치, 통계, 그래프
  {
    style: 'chart_data',
    patterns: [
      /그래프/, /차트/, /통계/, /데이터/, /분석\s*결과/,
      /성장\s*(률|율|추이|그래프)/, /매출/, /수익/, /트렌드/,
      /증가/, /감소/, /추이/, /변화\s*(그래프|추이)/,
      /시장\s*(규모|점유|분석)/, /비율/, /퍼센트/, /점유율/,
    ],
  },
  // 4. 제품 사진풍 — 제품, 패키지, 소재
  {
    style: 'product',
    patterns: [
      /제품\s*(사진|이미지|모습)/, /패키지/, /언박싱/, /구성품/,
      /상품/, /디자인\s*(이미지|사진)/, /외형/, /디테일\s*컷/,
      /클로즈\s*업/, /확대/, /텍스처/, /소재\s*(사진|이미지)/,
      /착용\s*(사진|샷|이미지)/, /사용\s*(모습|장면|사진)/,
    ],
  },
  // 5. 실사풍 — 음식, 공간, 자연, 여행
  {
    style: 'photorealistic',
    patterns: [
      /음식/, /요리/, /맛집/, /레시피/, /식단/, /식재료/,
      /카페/, /레스토랑/, /식당/, /베이커리/, /디저트/,
      /인테리어/, /공간/, /거실/, /침실/, /욕실/, /주방/,
      /풍경/, /자연/, /바다/, /산/, /숲/, /하늘/, /일출/, /일몰/,
      /여행/, /관광/, /호텔/, /리조트/, /수영장/,
      /운동/, /헬스/, /요가/, /필라테스/, /스트레칭/,
      /반려\s*(동물|견|묘)/, /강아지/, /고양이/, /펫/,
      /꽃/, /식물/, /정원/, /화분/, /플라워/,
    ],
  },
  // 6. 플랫 아이콘 — 기능, 특징, 카테고리 나열
  {
    style: 'icon_flat',
    patterns: [
      /아이콘/, /기능\s*(소개|설명|이미지)/, /특징\s*(소개|설명|이미지)/,
      /장점\s*(아이콘|이미지)/, /서비스\s*(소개|설명)/,
      /카테고리/, /분류\s*아이콘/, /메뉴\s*(아이콘|이미지)/,
      /심볼/, /픽토그램/, /로고\s*(디자인|이미지)/,
    ],
  },
  // 7. 장면 연출 — 라이프스타일, 일상, 분위기
  {
    style: 'scene',
    patterns: [
      /일상/, /라이프/, /모닝\s*루틴/, /루틴/, /하루/,
      /분위기/, /감성/, /무드/, /바이브/, /힐링/,
      /독서/, /공부/, /작업/, /재택/, /홈\s*오피스/,
      /데이트/, /모임/, /파티/, /축하/, /기념/,
      /쇼핑/, /선물/, /포장/, /기프트/,
    ],
  },
]

/** 스타일별 프롬프트 지시어 */
const STYLE_PROMPTS: Record<ImageStyle, string> = {
  photorealistic: [
    'Style: PHOTOREALISTIC, high-resolution photograph',
    '- Shot with professional DSLR camera, shallow depth of field',
    '- Natural lighting with soft shadows, warm color temperature',
    '- Vivid colors, crisp details, magazine-quality composition',
    '- Realistic textures and materials, no cartoon or illustrated elements',
  ].join('\n'),
  infographic: [
    'Style: INFOGRAPHIC / DIAGRAM',
    '- Clean, structured layout with clear visual hierarchy',
    '- Use numbered sections, arrows, and connecting lines to show flow',
    '- Flat design with bold colors, rounded shapes, and simple icons',
    '- Korean text labels should be large, bold, and clearly readable',
    '- Professional data visualization aesthetic, balanced whitespace',
  ].join('\n'),
  illustration: [
    'Style: MODERN ILLUSTRATION',
    '- Friendly, approachable digital illustration style',
    '- Soft pastel or vibrant color palette, clean vector-like shapes',
    '- Slightly stylized characters and objects (not hyper-realistic)',
    '- Warm, inviting atmosphere suitable for blog content',
    '- Consistent line weight and smooth gradients',
  ].join('\n'),
  icon_flat: [
    'Style: FLAT ICON / VECTOR',
    '- Minimalist flat design with geometric shapes',
    '- Limited color palette (3-5 colors), no gradients or shadows',
    '- Clean outlines, uniform stroke weight, centered composition',
    '- Simple symbolic representation, easily recognizable at small sizes',
    '- Grid-aligned, symmetrical layout',
  ].join('\n'),
  chart_data: [
    'Style: DATA VISUALIZATION / CHART',
    '- Professional chart or graph illustration',
    '- Clear axes, data points, and trend lines with vibrant accent colors',
    '- Clean grid background, subtle gradients on data bars/areas',
    '- Modern dashboard aesthetic with rounded corners',
    '- Upward-trending data to convey positive growth narrative',
  ].join('\n'),
  thumbnail: [
    'Style: BLOG THUMBNAIL / BANNER',
    '- Eye-catching, bold composition designed for small preview sizes',
    '- Strong focal point with vibrant, contrasting colors',
    '- Dynamic layout with visual depth (layered elements, gradients)',
    '- Korean text should be LARGE, BOLD, and highly legible as the main focus',
    '- Professional typography feel, magazine cover composition',
  ].join('\n'),
  product: [
    'Style: PRODUCT PHOTOGRAPHY',
    '- Clean, professional product shot on neutral or lifestyle background',
    '- Studio lighting with soft reflections, crisp product details',
    '- Slightly elevated angle (15-30 degrees) for dimensional view',
    '- Subtle shadow for grounding, sharp focus on product',
    '- E-commerce quality, aspirational lifestyle context',
  ].join('\n'),
  scene: [
    'Style: LIFESTYLE SCENE',
    '- Warm, atmospheric scene with natural lighting (golden hour feel)',
    '- Candid, relaxed composition showing everyday life moments',
    '- Soft bokeh background, muted earth tones with warm accents',
    '- Cozy, aspirational mood — inviting the viewer into the scene',
    '- Slightly desaturated with warm color grading (film-like look)',
  ].join('\n'),
}

/**
 * 이미지 설명에서 최적 스타일을 자동 판별
 * 매칭되는 규칙이 없으면 기본값 'illustration' 반환
 */
function detectImageStyle(description: string): ImageStyle {
  for (const rule of STYLE_RULES) {
    if (rule.patterns.some(p => p.test(description))) {
      return rule.style
    }
  }
  return 'illustration' // 기본값: 일러스트
}

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

    // 실사 이미지 + 텍스트 필수 이미지 사전 차단 (서버 안전장치)
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

    // 학습 데이터에서 이미지 패턴 조회 (실패해도 진행)
    let imagePatternHint: string | null = null
    try {
      const { getImagePatternPrompt } = await import('@/lib/blog-learning/prompt-injector')
      const { detectContentType, detectDomainCategory } = await import('@/lib/content/engine')
      const category = detectContentType(keyword)
      const domain = detectDomainCategory(keyword)
      imagePatternHint = await getImagePatternPrompt(keyword, category, domain)
    } catch {
      // 학습 데이터 조회 실패 시 무시 (기본 프롬프트로 진행)
    }

    // NDJSON 스트리밍 응답
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        }

        try {
          // 학습 데이터 사용 알림
          if (imagePatternHint) {
            send({ type: 'learning', message: '학습 데이터 기반 이미지 최적화 적용' })
          }

          // 스킵된 마커 알림
          for (const s of skipped) {
            send({ type: 'skipped', index: s.index, description: s.description, reason: s.reason })
          }

          let successCount = 0
          let failCount = 0
          const results: Array<{ index: number; url: string; description: string }> = []

          for (let i = 0; i < generatable.length; i++) {
            const marker = generatable[i]
            // 이미지 설명에서 최적 스타일 자동 판별
              const style = detectImageStyle(marker.description)

            send({
              type: 'progress',
              current: i + 1,
              total: generatable.length,
              style,
              message: `이미지 생성 중... (${i + 1}/${generatable.length}) [${style}]`,
            })

            try {

              // Gemini 이미지 생성 호출 (스타일 + 학습 데이터 힌트 포함)
              const imageData = await generateImageWithGemini(
                apiKey,
                keyword,
                marker.description,
                style,
                imagePatternHint
              )

              if (!imageData) {
                send({ type: 'error_partial', index: marker.index, reason: '이미지 생성 실패 (빈 응답)' })
                failCount++
                continue
              }

              // Supabase Storage 업로드
              const timestamp = Date.now()
              const fileName = `${user.id}/${contentId || 'temp'}_${marker.index}_${timestamp}.webp`

              // base64 → Buffer → sharp 압축 (WebP, 최대 800px, 품질 80)
              const rawBuffer = Buffer.from(imageData.base64, 'base64')
              const buffer = await sharp(rawBuffer)
                .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 80 })
                .toBuffer()

              const { error: uploadError } = await supabase.storage
                .from('ai-images')
                .upload(fileName, buffer, {
                  contentType: 'image/webp',
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
 * Gemini 이미지 생성 (gemini-3.1-flash-image-preview / Nano Banana 2, responseModalities: IMAGE)
 * 30초 타임아웃
 */
async function generateImageWithGemini(
  apiKey: string,
  keyword: string,
  description: string,
  style: ImageStyle,
  patternHint: string | null = null
): Promise<{ base64: string; mimeType: string } | null> {
  const url = `${GEMINI_API_BASE}/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`

  // 텍스트 포함이 의미 있는 스타일 판별
  const textAllowedStyles: ImageStyle[] = ['thumbnail', 'infographic', 'chart_data']
  const allowText = textAllowedStyles.includes(style)

  const promptParts = [
    `Generate a blog image about: ${description}`,
    `Blog keyword context: "${keyword}"`,
  ]

  // 스타일별 전문 프롬프트 주입
  promptParts.push('', STYLE_PROMPTS[style])

  // 학습 데이터 기반 힌트 주입
  if (patternHint) {
    promptParts.push('', 'Visual reference hints:', patternHint)
  }

  // 공통 품질 규칙
  promptParts.push(
    '',
    'ABSOLUTE REQUIREMENTS:',
    '- NEVER use a plain white, solid white, or blank white background',
    '- Use rich, vivid backgrounds that complement the subject',
    '- High quality, professional composition with visual depth',
    '- No watermarks, logos, or branding elements',
  )

  // 텍스트 허용 여부에 따른 규칙 분기
  if (allowText) {
    promptParts.push(
      '- Korean text (한글) should be ACCURATE, BOLD, and clearly legible',
      '- Use clean sans-serif fonts for Korean text',
      '- Text should be a natural, integrated part of the design',
      '- Numbers and English text should also be accurate',
    )
  } else {
    promptParts.push(
      '- ZERO TEXT in the image. No letters, words, numbers, labels, captions, or any written content',
      '- No text in any language (Korean, English, Chinese, Japanese, or any other)',
      '- If text would normally appear (signs, labels, screens), make those areas blank or filled with abstract patterns',
    )
  }

  const prompt = promptParts.join('\n')

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      temperature: 0.2,
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
