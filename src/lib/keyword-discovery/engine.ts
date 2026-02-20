/**
 * 키워드 발굴 엔진 v2 - 하이브리드 방식
 *
 * Phase 1: AI가 5~8개 시드 키워드 생성 (전략적 방향)
 * Phase 2: 네이버 API로 시드 → 실제 연관 키워드 50~100개 확장
 * Phase 3: 개선된 점수로 스코어링 + 카테고리 자동 분류
 * Phase 4: 상위 20개 선별 + 출처 표시
 */

import { callGemini, parseGeminiJson, OPPORTUNITY_DISCOVERY_PROMPT } from '@/lib/ai/gemini'
import { getKeywordStats, calculateKeywordScore } from '@/lib/naver/search-ad'
import { inferCategory, generateReason, estimateCompetition } from './categorizer'
import type { SeedKeyword, DiscoveredKeyword, DiscoveryResult, RawKeywordData } from './types'

// 최소 점수 필터 (이 이하는 "고스트 키워드"로 판단하여 제외)
const MIN_SCORE_THRESHOLD = 15
// 결과 최대 개수
const MAX_RESULTS = 20

interface AiSeedResponse {
  seeds: SeedKeyword[]
  summary: string
}

/**
 * Phase 1: AI 시드 키워드 생성
 * 주제에서 5~8개의 자연스러운 시드 키워드를 생성
 */
async function generateSeedKeywords(topic: string): Promise<AiSeedResponse> {
  const userMessage = `주제: "${topic}"

이 주제에 대해 네이버 검색광고 API에 넣을 시드 키워드를 8~12개 생성해주세요.
사람들이 실제로 네이버에 검색하는 자연스러운 2~4단어 키워드여야 합니다.

다양한 검색 의도를 포함해주세요:
- 정보형 (방법, 종류, 효과 등)
- 비교형 (추천, 비교, 순위 등)
- 구매형 (가격, 가성비, 후기 등)
- 경험형 (후기, 리뷰, 체험 등)

JSON 형식으로 응답:
{
  "seeds": [
    { "keyword": "시드 키워드", "direction": "전략적 의미" }
  ],
  "summary": "${topic} 주제 전체 기회 분석 요약 (2~3문장)"
}`

  const aiResponse = await callGemini(OPPORTUNITY_DISCOVERY_PROMPT, userMessage, 4096, { jsonMode: true })

  let parsed: AiSeedResponse
  try {
    parsed = parseGeminiJson<AiSeedResponse>(aiResponse)
  } catch (parseErr) {
    const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr)
    console.error('[KeywordDiscovery] AI 파싱 실패:', errMsg)
    // 폴백: 주제 자체를 시드로 사용
    parsed = {
      seeds: [
        { keyword: topic, direction: '주제 직접 검색' },
        { keyword: `${topic} 추천`, direction: '추천 키워드' },
        { keyword: `${topic} 방법`, direction: '정보형 키워드' },
        { keyword: `${topic} 후기`, direction: '경험형 키워드' },
        { keyword: `${topic} 비교`, direction: '비교형 키워드' },
      ],
      summary: `"${topic}" 주제에서 키워드를 발굴 중입니다.`,
    }
  }

  // 안전장치: seeds가 없거나 비어있으면 폴백
  if (!parsed.seeds || parsed.seeds.length === 0) {
    // 기존 keywords 형식인 경우 호환 처리
    const legacy = parsed as unknown as { keywords?: { keyword: string; category?: string; reason?: string }[] }
    if (legacy.keywords && legacy.keywords.length > 0) {
      parsed.seeds = legacy.keywords.map(k => ({
        keyword: k.keyword,
        direction: k.reason || k.category || '키워드 방향',
      }))
    } else {
      parsed.seeds = [
        { keyword: topic, direction: '주제 직접 검색' },
        { keyword: `${topic} 추천`, direction: '추천 키워드' },
        { keyword: `${topic} 방법`, direction: '정보형 키워드' },
      ]
    }
  }

  return parsed
}

/**
 * Phase 2: 네이버 API로 시드 키워드 확장
 * 시드 키워드를 보내면 네이버가 연관 키워드까지 함께 반환
 */
async function expandWithNaverApi(
  seeds: SeedKeyword[]
): Promise<{ allKeywords: RawKeywordData[]; seedKeywordSet: Set<string> }> {
  // 시드 키워드를 배치로 나눠서 병렬 요청 (5개씩)
  const batchSize = 5
  const batches: string[][] = []
  for (let i = 0; i < seeds.length; i += batchSize) {
    const batch = seeds.slice(i, i + batchSize).map(s => s.keyword)
    batches.push(batch)
  }

  // 시드 키워드 목록 (공백 제거해서 매칭용)
  const seedKeywordSet = new Set(
    seeds.map(s => s.keyword.replace(/\s+/g, ''))
  )

  // 모든 배치 병렬 요청
  const batchResults = await Promise.allSettled(
    batches.map(batch => getKeywordStats(batch.join(',')))
  )

  // 결과 수집 (중복 제거)
  const seen = new Set<string>()
  const allKeywords: RawKeywordData[] = []

  for (const result of batchResults) {
    if (result.status === 'rejected') {
      console.error('[KeywordDiscovery] 네이버 배치 실패:', result.reason)
      continue
    }
    for (const stat of result.value) {
      const normalized = stat.relKeyword.replace(/\s+/g, '')
      if (seen.has(normalized)) continue
      seen.add(normalized)
      allKeywords.push(stat as RawKeywordData)
    }
  }

  return { allKeywords, seedKeywordSet }
}

/**
 * 주제에서 핵심 단어 추출 (관련성 필터용)
 * "침산동 수학" → ["침산동", "수학"]
 */
function extractTopicWords(topic: string): string[] {
  return topic
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2)
}

/**
 * 키워드가 주제와 관련 있는지 판별
 * 주제 단어 중 하나라도 포함되어 있으면 관련 있음
 */
function isRelevantKeyword(keyword: string, topicWords: string[]): boolean {
  if (topicWords.length === 0) return true
  const normalized = keyword.replace(/\s+/g, '')
  return topicWords.some(word => normalized.includes(word))
}

/**
 * Phase 3: 관련성 필터 + 경쟁도 추정 + 스코어링 + 카테고리 분류
 */
function scoreAndCategorize(
  allKeywords: RawKeywordData[],
  seedKeywordSet: Set<string>,
  seeds: SeedKeyword[],
  topic: string
): DiscoveredKeyword[] {
  const topicWords = extractTopicWords(topic)
  const results: DiscoveredKeyword[] = []

  for (const stat of allKeywords) {
    const normalized = stat.relKeyword.replace(/\s+/g, '')

    // ★ 관련성 필터: 주제 단어가 하나도 포함되지 않으면 제외
    // (시드 키워드는 AI가 의도적으로 생성한 것이므로 항상 포함)
    const isSeed = seedKeywordSet.has(normalized)
    if (!isSeed && !isRelevantKeyword(stat.relKeyword, topicWords)) continue

    const score = calculateKeywordScore(stat)

    // 고스트 키워드 필터: 점수 너무 낮으면 제외
    if (score < MIN_SCORE_THRESHOLD) continue

    // 시드 키워드면 AI의 direction 활용, 아니면 자동 생성
    const matchedSeed = isSeed
      ? seeds.find(s => s.keyword.replace(/\s+/g, '') === normalized)
      : null

    const totalSearch = stat.monthlyPcQcCnt + stat.monthlyMobileQcCnt

    // ★ 경쟁도 추정: compIdx가 "-"이면 plAvgDepth + 검색량으로 추정
    const estimatedComp = estimateCompetition(stat)

    results.push({
      keyword: stat.relKeyword,
      monthlySearch: totalSearch,
      monthlyPc: stat.monthlyPcQcCnt,
      monthlyMobile: stat.monthlyMobileQcCnt,
      compIdx: estimatedComp,
      score,
      category: inferCategory(stat.relKeyword),
      reason: matchedSeed?.direction || generateReason(stat),
      source: isSeed ? 'ai' : 'naver',
    })
  }

  // 점수 높은 순 정렬
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, MAX_RESULTS)
}

/**
 * 키워드 발굴 엔진 메인 함수
 */
export async function discoverKeywords(topic: string): Promise<DiscoveryResult> {
  // Phase 1: AI 시드 키워드 생성
  const aiResult = await generateSeedKeywords(topic)
  const seedCount = aiResult.seeds.length

  // Phase 2: 네이버 API 확장
  const { allKeywords, seedKeywordSet } = await expandWithNaverApi(aiResult.seeds)
  const naverExpandedCount = allKeywords.length

  // Phase 3: 관련성 필터 + 경쟁도 추정 + 스코어링 + 카테고리 분류
  const opportunities = scoreAndCategorize(allKeywords, seedKeywordSet, aiResult.seeds, topic)

  return {
    topic,
    opportunities,
    summary: aiResult.summary || `"${topic}" 주제에서 ${opportunities.length}개의 블루오션 키워드를 발굴했습니다.`,
    seedCount,
    naverExpandedCount,
    filteredCount: naverExpandedCount - opportunities.length,
  }
}

/**
 * 데모 데이터 생성 (API 키 없을 때)
 */
export function getDemoDiscoveryResult(topic: string): DiscoveryResult {
  const demos: { keyword: string; category: '정보형' | '비교형' | '구매형' | '경험형'; reason: string; source: 'ai' | 'naver' }[] = [
    { keyword: `${topic} 초보 가이드`, category: '정보형', reason: '초보 대상 콘텐츠는 검색량이 높고 경쟁이 낮아 상위 노출 가능성이 높습니다', source: 'ai' },
    { keyword: `${topic} 비용 비교`, category: '비교형', reason: '가격/비용 비교 콘텐츠는 구매 의도가 높은 사용자를 유입시킵니다', source: 'naver' },
    { keyword: `${topic} 추천 순위`, category: '구매형', reason: '리스트형 콘텐츠는 클릭률이 높고 체류 시간이 깁니다', source: 'naver' },
    { keyword: `${topic} 실패 경험담`, category: '경험형', reason: '실패 사례는 경쟁 글이 적으면서 신뢰도가 높은 콘텐츠입니다', source: 'ai' },
    { keyword: `${topic} 주의사항`, category: '정보형', reason: '주의사항/팁 정리 콘텐츠는 검색 의도가 명확합니다', source: 'naver' },
    { keyword: `2026 ${topic} 트렌드`, category: '정보형', reason: '연도 포함 키워드는 최신성을 인정받아 네이버 노출에 유리합니다', source: 'ai' },
    { keyword: `${topic} vs 대안`, category: '비교형', reason: 'vs 비교 콘텐츠는 체류 시간이 길어 D.I.A. 점수가 높아집니다', source: 'naver' },
    { keyword: `${topic} 1개월 후기`, category: '경험형', reason: '구체적 기간 명시 후기는 롱테일 키워드로 경쟁이 낮습니다', source: 'naver' },
    { keyword: `${topic} 가성비`, category: '구매형', reason: '가성비 키워드는 구매 전환율이 높은 핵심 키워드입니다', source: 'naver' },
    { keyword: `${topic} 하는법`, category: '정보형', reason: '단계별 가이드는 소제목 구조화에 유리하고 SEO 점수가 높습니다', source: 'ai' },
    { keyword: `${topic} 장단점`, category: '비교형', reason: '장단점 키워드는 검색 의도가 명확하고 클릭률이 높습니다', source: 'naver' },
    { keyword: `${topic} 입문자 추천`, category: '구매형', reason: '입문자 대상 추천은 구매 전환율이 높고 경쟁이 낮습니다', source: 'naver' },
    { keyword: `${topic} 3개월 변화`, category: '경험형', reason: '장기 후기는 희소성이 높아 블루오션 키워드입니다', source: 'ai' },
    { keyword: `${topic} 자주 하는 실수`, category: '정보형', reason: '실수/주의 콘텐츠는 검색량이 꾸준하고 경쟁이 낮습니다', source: 'naver' },
    { keyword: `${topic} 혼자 시작`, category: '정보형', reason: '독학/혼자 키워드는 검색 의도가 높고 콘텐츠 경쟁이 적습니다', source: 'naver' },
    { keyword: `${topic} 효과 없는 이유`, category: '경험형', reason: '부정적 경험 키워드는 공감도가 높아 체류 시간이 깁니다', source: 'ai' },
    { keyword: `${topic} 무료 유료`, category: '비교형', reason: '무료/유료 비교는 구매 결정 단계 사용자를 유입시킵니다', source: 'naver' },
    { keyword: `${topic} 나이별 추천`, category: '구매형', reason: '세분화된 추천 키워드는 경쟁이 매우 낮은 틈새 시장입니다', source: 'naver' },
    { keyword: `${topic} 꿀팁`, category: '정보형', reason: '꿀팁/모음 키워드는 저장·공유율이 높아 노출에 유리합니다', source: 'naver' },
    { keyword: `${topic} 현실 비용`, category: '경험형', reason: '구체적 비용 공개 콘텐츠는 신뢰도와 체류 시간이 매우 높습니다', source: 'ai' },
  ]

  const opportunities: DiscoveredKeyword[] = demos.map((d, i) => {
    const tier = i < 5 ? 'high' : i < 12 ? 'mid' : 'low'
    const monthlyPc = tier === 'high' ? Math.floor(Math.random() * 1500) + 500
      : tier === 'mid' ? Math.floor(Math.random() * 600) + 100
      : Math.floor(Math.random() * 200) + 30
    const monthlyMobile = tier === 'high' ? Math.floor(Math.random() * 4000) + 1000
      : tier === 'mid' ? Math.floor(Math.random() * 2000) + 300
      : Math.floor(Math.random() * 800) + 100

    return {
      ...d,
      monthlySearch: monthlyPc + monthlyMobile,
      monthlyPc,
      monthlyMobile,
      compIdx: i < 8 ? 'LOW' : i < 15 ? 'MEDIUM' : 'HIGH',
      score: Math.floor(Math.random() * 35) + (i < 8 ? 60 : i < 15 ? 40 : 25),
    }
  }).sort((a, b) => b.score - a.score)

  return {
    topic,
    opportunities,
    summary: `"${topic}" 주제에서 ${opportunities.length}개의 블루오션 키워드를 발견했습니다. 경쟁이 낮으면서 검색량이 충분한 키워드들로, 블로그 상위 노출 가능성이 높습니다.`,
    seedCount: 8,
    naverExpandedCount: 65,
    filteredCount: 45,
  }
}
