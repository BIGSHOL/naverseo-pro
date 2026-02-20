/**
 * NaverSEO Pro - SEO AI 심층 분석 모듈
 *
 * Gemini 2.5 Flash를 활용한 블로그 글 심층 SEO 분석
 * - 경험 정보 감지 (D.I.A.)
 * - 콘텐츠 품질 심층 평가
 * - 키워드 전략 분석
 * - 독자 참여도 평가
 * - 점수 보정 (-10 ~ +10)
 *
 * Gemini 2.5 Flash: 향상된 추론 능력 + 코드/분석 성능 개선
 */

import { callGemini, parseGeminiJson, SEO_DEEP_ANALYSIS_PROMPT } from '@/lib/ai/gemini'
import { calculateScoreAdjustment } from '@/lib/utils/scoring'

// ===== 타입 정의 =====

/** AI SEO 심층 분석 결과 */
export interface AiSeoAnalysis {
  experienceScore: number         // 1~10 경험 정보
  experienceDetails: string
  contentQualityScore: number     // 1~10 콘텐츠 품질
  contentQualityDetails: string
  keywordStrategyScore: number    // 1~10 키워드 전략
  keywordStrategyDetails: string
  engagementScore: number         // 1~10 독자 참여
  engagementDetails: string
  overallFeedback: string         // 종합 피드백
  strengths: string[]             // 강점 3~5개
  weaknesses: string[]            // 약점 3~5개
  recommendations: string[]      // 맞춤 추천 5~7개
  scoreAdjustment: number         // -10 ~ +10 점수 보정
  adjustmentReason: string        // 보정 사유
}

/** Gemini AI 응답 원본 형식 */
interface AiAnalysisRaw {
  experienceScore: number
  experienceDetails: string
  contentQualityScore: number
  contentQualityDetails: string
  keywordStrategyScore: number
  keywordStrategyDetails: string
  engagementScore: number
  engagementDetails: string
  overallFeedback: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
}

// ===== 메인 함수 =====

/**
 * 블로그 글 AI 심층 분석 실행
 *
 * @param keyword - 타겟 키워드
 * @param title - 글 제목
 * @param content - 글 본문
 * @returns AI 분석 결과 (실패 시 null)
 */
export async function analyzeWithAi(
  keyword: string,
  title: string,
  content: string
): Promise<AiSeoAnalysis | null> {
  // Gemini API 키가 없으면 스킵
  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.log('[SEO AI] GEMINI_API_KEY 미설정, AI 분석 스킵')
    return null
  }

  // 콘텐츠가 너무 짧으면 스킵
  if (content.trim().length < 100) {
    console.log('[SEO AI] 콘텐츠가 너무 짧아 AI 분석 스킵')
    return null
  }

  try {
    // 비용 절감: 본문 2000자까지만 전송 (앞 1500자 + 뒤 500자로 결론/CTA 포함)
    let truncatedContent: string
    if (content.length > 2000) {
      const head = content.substring(0, 1500)
      const tail = content.substring(content.length - 500)
      truncatedContent = head + '\n...(중략)...\n' + tail
    } else {
      truncatedContent = content
    }

    const userMessage = `다음 네이버 블로그 글을 심층 분석해주세요.

타겟 키워드: "${keyword || '(미지정)'}"
제목: ${title || '(제목 없음)'}

본문:
${truncatedContent}

위 글을 JSON 형식으로 분석해주세요:
{
  "experienceScore": 1~10,
  "experienceDetails": "경험 정보 분석 상세",
  "contentQualityScore": 1~10,
  "contentQualityDetails": "콘텐츠 품질 분석 상세",
  "keywordStrategyScore": 1~10,
  "keywordStrategyDetails": "키워드 전략 분석 상세",
  "engagementScore": 1~10,
  "engagementDetails": "독자 참여 분석 상세",
  "overallFeedback": "종합 피드백 (2~3문장)",
  "strengths": ["강점1", "강점2", "강점3"],
  "weaknesses": ["약점1", "약점2", "약점3"],
  "recommendations": ["추천1", "추천2", "추천3", "추천4", "추천5"]
}`

    console.log(`[SEO AI] 분석 요청 (${truncatedContent.length}자)`)

    const response = await callGemini(SEO_DEEP_ANALYSIS_PROMPT, userMessage, 1024)
    const raw = parseGeminiJson<AiAnalysisRaw>(response)

    // 점수 범위 보정 (1~10)
    const experienceScore = Math.max(1, Math.min(10, raw.experienceScore))
    const contentQualityScore = Math.max(1, Math.min(10, raw.contentQualityScore))
    const keywordStrategyScore = Math.max(1, Math.min(10, raw.keywordStrategyScore))
    const engagementScore = Math.max(1, Math.min(10, raw.engagementScore))

    // AI 점수 보정값 계산
    const avgScore = (experienceScore + contentQualityScore + keywordStrategyScore + engagementScore) / 4
    const { adjustment: scoreAdjustment, reason: adjustmentReason } = calculateScoreAdjustment({
      avgPositiveScore: avgScore,
      positiveReason: (avg) => `AI 분석: 높은 콘텐츠 품질(평균 ${avg.toFixed(1)}점)로 가산`,
      mildPositiveReason: 'AI 분석: 양호한 콘텐츠 품질로 소폭 가산',
      negativeReason: (avg) => `AI 분석: 낮은 콘텐츠 품질(평균 ${avg.toFixed(1)}점)로 감산`,
    })

    return {
      experienceScore,
      experienceDetails: raw.experienceDetails || '',
      contentQualityScore,
      contentQualityDetails: raw.contentQualityDetails || '',
      keywordStrategyScore,
      keywordStrategyDetails: raw.keywordStrategyDetails || '',
      engagementScore,
      engagementDetails: raw.engagementDetails || '',
      overallFeedback: raw.overallFeedback || '',
      strengths: raw.strengths || [],
      weaknesses: raw.weaknesses || [],
      recommendations: raw.recommendations || [],
      scoreAdjustment,
      adjustmentReason,
    }
  } catch (error) {
    console.error('[SEO AI] AI 분석 실패:', error)
    return null
  }
}

/**
 * 데모용 AI 분석 결과 생성
 */
export function generateDemoAiAnalysis(): AiSeoAnalysis {
  return {
    experienceScore: 7,
    experienceDetails: '직접 경험에 기반한 정보가 일부 포함되어 있으며, 구체적인 수치와 날짜 정보가 신뢰성을 높입니다.',
    contentQualityScore: 6,
    contentQualityDetails: '글 구조가 비교적 체계적이나, 소제목 활용과 리스트 구조화를 더 강화하면 D.I.A. 점수가 향상됩니다.',
    keywordStrategyScore: 5,
    keywordStrategyDetails: '핵심 키워드가 제목에 포함되어 있으나, 본문 내 관련 키워드 활용이 부족합니다. 롱테일 키워드를 추가하세요.',
    engagementScore: 4,
    engagementDetails: '독자 참여 유도 요소가 부족합니다. 질문형 문구, 댓글 유도, 관련 글 링크 등을 추가하면 좋겠습니다.',
    overallFeedback: '전반적으로 양호한 콘텐츠이나, 키워드 전략과 독자 참여 측면에서 개선이 필요합니다. 경험 기반 정보를 더 강화하면 D.I.A. 알고리즘에서 유리합니다.',
    strengths: [
      '직접 체험 기반의 신뢰성 있는 콘텐츠',
      '구체적 가격/위치 정보 제공으로 실용성 높음',
      '적절한 이미지 배치',
    ],
    weaknesses: [
      '관련 키워드/연관 검색어 활용이 미흡',
      '독자 참여 유도 요소 부족 (댓글, 공감 유도)',
      '내부 링크가 없어 체류 시간에 불리',
    ],
    recommendations: [
      '핵심 키워드의 동의어/관련 키워드를 본문에 자연스럽게 배치하세요',
      '글 마지막에 "궁금한 점은 댓글로 남겨주세요" 같은 참여 유도 문구를 추가하세요',
      '관련 글 3개 이상의 내부 링크를 본문에 자연스럽게 삽입하세요',
      '각 소제목 아래에 핵심 내용을 볼드 처리하여 스캔 가독성을 높이세요',
      '도입부에서 독자의 궁금증을 유발하는 질문으로 시작하세요',
    ],
    scoreAdjustment: 2,
    adjustmentReason: 'AI 분석: 양호한 콘텐츠 품질로 소폭 가산',
  }
}
