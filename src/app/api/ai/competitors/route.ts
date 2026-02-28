import { NextRequest, NextResponse } from 'next/server'
import { searchNaverBlog } from '@/lib/naver/blog-search'
import { callGemini, callGeminiStream, callClaudeStream, hasAiApiKey, parseGeminiJson, analyzeImagesWithGemini, getUserAiProvider, COMPETITOR_ANALYSIS_PROMPT } from '@/lib/ai/gemini'
import { checkCredits, deductCredits } from '@/lib/credit-check'
import { stripHtml } from '@/lib/utils/text'
import { scheduleCollection, collectFromSearchResults, collectFromScrapedPosts } from '@/lib/blog-learning'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'

// === 타입 정의 ===

interface CompetitorItem {
  rank: number
  title: string
  link: string
  description: string
  bloggerName: string
  bloggerLink: string
  postDate: string
  postDateFormatted: string
  daysSincePosted: number
  titleLength: number
  hasKeywordInTitle: boolean
  // 스크래핑 데이터 (상위 5개만 값 존재, 6~10위는 null)
  charCount: number | null
  imageCount: number | null
  videoCount: number | null
  commentCount: number | null
  sympathyCount: number | null
  readCount: number | null
}

interface ContentQualityStats {
  avgCharCount: number
  medianCharCount: number
  charCountRange: [number, number]
  avgImageCount: number
  avgVideoCount: number
  avgCommentCount: number | null
  avgSympathyCount: number | null
  avgReadCount: number | null
  scrapedCount: number
}

interface PatternAnalysis {
  titleStats: {
    avgLength: number
    minLength: number
    maxLength: number
    keywordInTitleRate: number
    keywordInTitleCount: number
  }
  dateStats: {
    avgDaysAgo: number
    newestDaysAgo: number
    oldestDaysAgo: number
    within30Days: number
    within90Days: number
    within365Days: number
    older: number
  }
  blogDiversity: {
    uniqueBlogCount: number
    totalResults: number
    diversityRate: number
    repeatedBlogs: { name: string; count: number }[]
  }
  contentQuality: ContentQualityStats | null
}

interface DifficultyAssessment {
  level: 'easy' | 'medium' | 'hard' | 'very_hard'
  score: number // 0~100 (높을수록 어려움)
  reasons: string[]
  breakdown: {
    competition: number   // 경쟁 치열도 (0~25)
    quality: number       // 콘텐츠 품질 장벽 (0~25)
    engagement: number    // 사용자 반응 장벽 (0~25)
    freshness: number     // 최신성 경쟁 (0~25)
  }
}

interface TitlePatternWords {
  word: string
  count: number
}

interface ImageAnalysis {
  totalImages: number
  imageTypes: string[]
  recommendation: string
}

interface AiInsights {
  summary: string
  topPatterns: string[]
  contentGaps: string[]
  recommendedStrategy: string
  recommendedContentType?: string
  recommendedTone?: string
  relatedKeywords?: string[]
  titleSuggestions: string[]
  imageAnalysis?: ImageAnalysis
}

// === 유틸리티 함수 ===

function daysSince(postdate: string): number {
  const year = parseInt(postdate.substring(0, 4))
  const month = parseInt(postdate.substring(4, 6)) - 1
  const day = parseInt(postdate.substring(6, 8))
  const postDate = new Date(year, month, day)
  const now = new Date()
  const diff = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

function formatDate(postdate: string): string {
  return `${postdate.substring(0, 4)}.${postdate.substring(4, 6)}.${postdate.substring(6, 8)}`
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function avgNonNull(arr: (number | null)[]): number | null {
  const valid = arr.filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 10) / 10
}

// === 패턴 분석 ===

function analyzePatterns(competitors: CompetitorItem[], keyword: string): PatternAnalysis {
  const keywordLower = keyword.toLowerCase().replace(/\s+/g, '')
  const count = competitors.length || 1

  // 제목 분석
  const lengths = competitors.map(c => c.titleLength)
  const withKeyword = competitors.filter(c =>
    c.title.toLowerCase().replace(/\s+/g, '').includes(keywordLower)
  )

  const titleStats = {
    avgLength: lengths.length > 0 ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0,
    minLength: lengths.length > 0 ? Math.min(...lengths) : 0,
    maxLength: lengths.length > 0 ? Math.max(...lengths) : 0,
    keywordInTitleRate: Math.round((withKeyword.length / count) * 100),
    keywordInTitleCount: withKeyword.length,
  }

  // 날짜 분석
  const days = competitors.map(c => c.daysSincePosted)
  const dateStats = {
    avgDaysAgo: days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0,
    newestDaysAgo: days.length > 0 ? Math.min(...days) : 0,
    oldestDaysAgo: days.length > 0 ? Math.max(...days) : 0,
    within30Days: days.filter(d => d <= 30).length,
    within90Days: days.filter(d => d <= 90).length,
    within365Days: days.filter(d => d <= 365).length,
    older: days.filter(d => d > 365).length,
  }

  // 블로그 다양성
  const blogCounts = new Map<string, number>()
  competitors.forEach(c => {
    blogCounts.set(c.bloggerName, (blogCounts.get(c.bloggerName) || 0) + 1)
  })
  const repeatedBlogs = Array.from(blogCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const blogDiversity = {
    uniqueBlogCount: blogCounts.size,
    totalResults: competitors.length,
    diversityRate: competitors.length > 0 ? Math.round((blogCounts.size / competitors.length) * 100) : 0,
    repeatedBlogs,
  }

  // 콘텐츠 품질 통계 (스크래핑 데이터 기반)
  const scraped = competitors.filter(c => c.charCount !== null)
  let contentQuality: ContentQualityStats | null = null

  if (scraped.length > 0) {
    const charCounts = scraped.map(c => c.charCount!).filter(v => v > 0)
    const imageCounts = scraped.map(c => c.imageCount ?? 0)
    const videoCounts = scraped.map(c => c.videoCount ?? 0)

    contentQuality = {
      avgCharCount: charCounts.length > 0 ? Math.round(charCounts.reduce((s, v) => s + v, 0) / charCounts.length) : 0,
      medianCharCount: median(charCounts),
      charCountRange: charCounts.length > 0 ? [Math.min(...charCounts), Math.max(...charCounts)] : [0, 0],
      avgImageCount: Math.round((imageCounts.reduce((s, v) => s + v, 0) / imageCounts.length) * 10) / 10,
      avgVideoCount: Math.round((videoCounts.reduce((s, v) => s + v, 0) / videoCounts.length) * 10) / 10,
      avgCommentCount: avgNonNull(scraped.map(c => c.commentCount)),
      avgSympathyCount: avgNonNull(scraped.map(c => c.sympathyCount)),
      avgReadCount: avgNonNull(scraped.map(c => c.readCount)),
      scrapedCount: scraped.length,
    }
  }

  return { titleStats, dateStats, blogDiversity, contentQuality }
}

// === 경쟁 난이도 평가 (4차원 재설계) ===

function assessDifficulty(patterns: PatternAnalysis, competitors: CompetitorItem[]): DifficultyAssessment {
  const reasons: string[] = []
  const cq = patterns.contentQuality

  // ── (A) 경쟁 치열도 (0~25) ──
  let competition = 0

  // 키워드 포함률 (0~8)
  const kwRate = patterns.titleStats.keywordInTitleRate
  if (kwRate >= 80) { competition += 8; reasons.push(`상위 글 ${kwRate}%가 제목에 키워드 포함 — SEO 최적화 수준 높음`) }
  else if (kwRate >= 60) { competition += 5; reasons.push(`상위 글 ${kwRate}%가 제목에 키워드 포함`) }
  else { competition += 2; reasons.push(`제목 키워드 포함률 ${kwRate}%로 낮아 진입 기회 있음`) }

  // 블로그 다양성 (0~8) — 독점 vs 블루오션 구분
  const diversity = patterns.blogDiversity.diversityRate
  const topRepeated = patterns.blogDiversity.repeatedBlogs[0]
  if (diversity < 50 && topRepeated && topRepeated.count >= 3) {
    competition += 8
    reasons.push(`${topRepeated.name}이(가) ${topRepeated.count}개 점유 — 파워블로거 독점 구간`)
  } else if (diversity < 50) {
    competition += 4
    reasons.push(`블로그 다양성 낮음 (${diversity}%) — 콘텐츠 부족 구간일 수 있음`)
  } else if (diversity < 80) {
    competition += 5
    reasons.push(`블로그 다양성 보통 (${diversity}%)`)
  } else {
    competition += 2
    reasons.push(`다양한 블로그가 노출 — 신규 진입 용이`)
  }

  // 제목 최적화 수준 (0~5) — 연도/숫자/클릭유도 포함 비율
  const optimizedTitles = competitors.filter(c => {
    const t = c.title
    return /20\d{2}|TOP|추천|비교|후기|정리|방법|가이드|\d+[가지선종개]/.test(t)
  })
  const optRate = optimizedTitles.length / (competitors.length || 1)
  if (optRate >= 0.6) { competition += 5; reasons.push('상위 글 제목이 SEO 최적화 패턴(연도/숫자/클릭유도)을 적극 활용') }
  else if (optRate >= 0.3) { competition += 3 }
  else { competition += 1 }

  // 상위 제목 유사도 (0~4)
  const titleWords = competitors.map(c =>
    new Set(c.title.replace(/[^\w가-힣]/g, ' ').split(/\s+/).filter(w => w.length >= 2))
  )
  let similarPairs = 0
  let totalPairs = 0
  for (let i = 0; i < titleWords.length; i++) {
    for (let j = i + 1; j < titleWords.length; j++) {
      totalPairs++
      const intersection = [...titleWords[i]].filter(w => titleWords[j].has(w)).length
      const union = new Set([...titleWords[i], ...titleWords[j]]).size
      if (union > 0 && intersection / union >= 0.3) similarPairs++
    }
  }
  const simRate = totalPairs > 0 ? similarPairs / totalPairs : 0
  if (simRate >= 0.4) { competition += 4 }
  else if (simRate >= 0.2) { competition += 2 }
  else { competition += 1 }

  // ── (B) 콘텐츠 품질 장벽 (0~25) ──
  let quality = 0

  if (cq) {
    // 콘텐츠 밀도 (0~10) — 길다고 좋은 게 아님
    const med = cq.medianCharCount
    if (med >= 2000 && med <= 3000) { quality += 10; reasons.push(`상위 글 본문 중앙값 ${med.toLocaleString()}자 — 정보 밀도 높은 콘텐츠 포진`) }
    else if (med >= 1000 && med < 2000) { quality += 7; reasons.push(`상위 글 본문 중앙값 ${med.toLocaleString()}자 — 적정 수준`) }
    else if (med > 3000) { quality += 7; reasons.push(`상위 글 본문 중앙값 ${med.toLocaleString()}자 — 길지만 밀도가 높다고 단정할 수 없음`) }
    else if (med >= 500) { quality += 4; reasons.push(`상위 글 본문 중앙값 ${med.toLocaleString()}자 — 품질 장벽 낮음`) }
    else { quality += 2; reasons.push(`상위 글 본문이 짧아 양질의 콘텐츠로 쉽게 차별화 가능`) }

    // 미디어 활용도 (0~8)
    const avgMedia = cq.avgImageCount + cq.avgVideoCount
    if (avgMedia >= 8) { quality += 8; reasons.push(`평균 이미지 ${cq.avgImageCount}장 — 미디어 활용 수준 높음`) }
    else if (avgMedia >= 5) { quality += 5; reasons.push(`평균 이미지 ${cq.avgImageCount}장 — 보통 수준`) }
    else if (avgMedia >= 2) { quality += 3 }
    else { quality += 1; reasons.push('이미지 활용이 적어 미디어로 차별화 가능') }

    // 구조화 수준 (0~7) — 이미지, 동영상, 본문 조합 판단
    const avgChar = cq.avgCharCount
    const hasVideo = cq.avgVideoCount >= 0.5
    const hasRichMedia = cq.avgImageCount >= 3 && avgChar >= 1500
    if (hasRichMedia && hasVideo) { quality += 7 }
    else if (hasRichMedia) { quality += 5 }
    else if (avgChar >= 1000 && cq.avgImageCount >= 2) { quality += 3 }
    else { quality += 1 }
  } else {
    // 스크래핑 실패 시 중립 (40% = 10점)
    quality = 10
    reasons.push('콘텐츠 심층 분석 불가 — 중립 평가 적용')
  }

  // ── (C) 사용자 반응 장벽 (0~25) ──
  let engagement = 0

  if (cq) {
    // 평균 댓글 (0~13)
    const avgCmt = cq.avgCommentCount
    if (avgCmt !== null) {
      if (avgCmt >= 20) { engagement += 13; reasons.push(`평균 댓글 ${avgCmt}개 — 독자 참여도 매우 높음`) }
      else if (avgCmt >= 10) { engagement += 9 }
      else if (avgCmt >= 3) { engagement += 5 }
      else { engagement += 2; reasons.push(`평균 댓글 ${avgCmt}개 — 반응 장벽 낮음`) }
    } else { engagement += 5 } // 중립

    // 평균 공감 (0~12)
    const avgSym = cq.avgSympathyCount
    if (avgSym !== null) {
      if (avgSym >= 30) { engagement += 12; reasons.push(`평균 공감 ${avgSym}개 — 독자 호감도 높음`) }
      else if (avgSym >= 10) { engagement += 8 }
      else if (avgSym >= 3) { engagement += 4 }
      else { engagement += 1 }
    } else { engagement += 5 } // 중립
  } else {
    engagement = 10
  }

  // ── (D) 최신성 경쟁 (0~25) ──
  let freshness = 0

  // 30일 내 글 비율 (0~10)
  const recentRate = patterns.dateStats.within30Days / (competitors.length || 1)
  if (recentRate >= 0.5) { freshness += 10; reasons.push(`최근 30일 내 ${patterns.dateStats.within30Days}개 — 활발한 경쟁`) }
  else if (recentRate >= 0.3) { freshness += 6; reasons.push('최근 글이 일부 있어 적당한 경쟁') }
  else { freshness += 2; reasons.push('오래된 글 위주 — 최신 콘텐츠로 진입 가능') }

  // 최신글 연령 (0~8)
  const newest = patterns.dateStats.newestDaysAgo
  if (newest <= 7) { freshness += 8 }
  else if (newest <= 30) { freshness += 5 }
  else if (newest <= 90) { freshness += 3 }
  else { freshness += 1 }

  // 포스팅 빈도 추정 (0~7) — 상위 10개의 날짜 분포 범위
  const dateRange = patterns.dateStats.oldestDaysAgo - patterns.dateStats.newestDaysAgo
  if (dateRange > 0) {
    const estimatedFreq = competitors.length / (dateRange / 7) // 주당 포스팅 추정
    if (estimatedFreq >= 2) { freshness += 7 }
    else if (estimatedFreq >= 1) { freshness += 4 }
    else { freshness += 2 }
  } else {
    freshness += 3 // 모든 글이 같은 날 → 중립
  }

  // 총점 계산
  const score = Math.min(100, competition + quality + engagement + freshness)
  const level = score >= 71 ? 'very_hard' : score >= 51 ? 'hard' : score >= 31 ? 'medium' : 'easy'

  return {
    level,
    score,
    reasons,
    breakdown: {
      competition: Math.min(25, competition),
      quality: Math.min(25, quality),
      engagement: Math.min(25, engagement),
      freshness: Math.min(25, freshness),
    },
  }
}

// === 제목 패턴 워드 추출 ===

function extractTitlePatterns(competitors: CompetitorItem[], keyword: string): TitlePatternWords[] {
  const stopWords = new Set(['의', '에', '를', '을', '이', '가', '은', '는', '로', '으로', '과', '와', '한', '할', '하는', '된', '되는', '및', '등', '더', '그', '이런', '저런', '그런'])
  const keywordWords = new Set(keyword.toLowerCase().split(/\s+/))
  const wordCount = new Map<string, number>()

  for (const comp of competitors) {
    const words = comp.title
      .replace(/[\[\]【】\(\)「」『』|·\-_~!@#$%^&*+=,.<>?;:'"\/\\]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopWords.has(w) && !keywordWords.has(w.toLowerCase()))

    const seen = new Set<string>()
    for (const word of words) {
      if (!seen.has(word)) {
        seen.add(word)
        wordCount.set(word, (wordCount.get(word) || 0) + 1)
      }
    }
  }

  return Array.from(wordCount.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }))
}

// === AI 분석 ===

async function getAiInsights(
  keyword: string,
  competitors: CompetitorItem[],
  patterns: PatternAnalysis,
  difficulty: DifficultyAssessment,
  onChunk?: (delta: string) => void,
  provider: 'gemini' | 'claude' = 'gemini',
): Promise<AiInsights> {
  const competitorList = competitors
    .map((c, i) => {
      let line = `${i + 1}위. 제목: "${c.title}" | 블로그: ${c.bloggerName} | 작성일: ${c.postDateFormatted} | 설명: "${c.description.substring(0, 80)}"`
      if (c.charCount !== null) {
        line += ` | 본문: ${c.charCount.toLocaleString()}자`
        if (c.imageCount !== null) line += `, 이미지 ${c.imageCount}장`
        if (c.commentCount !== null) line += `, 댓글 ${c.commentCount}`
        if (c.sympathyCount !== null) line += `, 공감 ${c.sympathyCount}`
        if (c.readCount !== null) line += `, 조회 ${c.readCount.toLocaleString()}`
      }
      return line
    })
    .join('\n')

  const difficultyLabel = difficulty.level === 'very_hard' ? '매우 어려움' : difficulty.level === 'hard' ? '어려움' : difficulty.level === 'medium' ? '보통' : '쉬움'

  // 키워드 의미 힌트
  let keywordHint = ''
  const cleanKw = keyword.trim()
  const kwEscaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const kwRegex = new RegExp(kwEscaped, 'gi')
  const phraseCounts = new Map<string, number>()
  for (const c of competitors) {
    const title = c.title.replace(kwRegex, ' ').trim()
    const words = title.split(/[\s,·|()!?:]+/).filter(w => w.length >= 2)
    for (let i = 0; i + 1 < words.length; i++) {
      const p = `${words[i]} ${words[i + 1]}`
      phraseCounts.set(p, (phraseCounts.get(p) || 0) + 1)
    }
  }
  let bestPhrase = ''
  let bestCount = 0
  phraseCounts.forEach((count, phrase) => {
    if (count > bestCount && count >= 2) { bestCount = count; bestPhrase = phrase }
  })
  if (bestPhrase) {
    keywordHint = `\n★ 키워드 의미 참고: "${keyword}" 검색 결과에서 "${bestPhrase}"이(가) 반복 등장합니다. 이 맥락에 맞춰 분석하세요.\n`
  }

  // 블로그 독점 정보
  const dominantBlogInfo = patterns.blogDiversity.repeatedBlogs
    .filter(b => b.count >= 2)
    .map(b => `${b.name}(${b.count}개)`)
    .join(', ')

  // 콘텐츠 품질 데이터 섹션
  const cq = patterns.contentQuality
  let contentQualitySection = ''
  if (cq) {
    contentQualitySection = `
콘텐츠 품질 (상위 ${cq.scrapedCount}개 실제 본문 분석):
- 본문 길이 중앙값: ${cq.medianCharCount.toLocaleString()}자 (범위: ${cq.charCountRange[0].toLocaleString()}~${cq.charCountRange[1].toLocaleString()}자)
- 평균 이미지: ${cq.avgImageCount}장 / 평균 동영상: ${cq.avgVideoCount}개
${cq.avgCommentCount !== null ? `- 평균 댓글: ${cq.avgCommentCount}개` : ''}
${cq.avgSympathyCount !== null ? `- 평균 공감: ${cq.avgSympathyCount}개` : ''}
${cq.avgReadCount !== null ? `- 평균 조회수: ${cq.avgReadCount.toLocaleString()}회` : '- 조회수: 비공개 (네이버 정책상 타인 블로그 조회수 확인 불가)'}
`
  }

  const userMessage = `키워드: "${keyword}"
${keywordHint}
네이버 블로그 검색 상위 ${competitors.length}개 결과 분석:

${competitorList}

패턴 분석 요약:
- 평균 제목 길이: ${patterns.titleStats.avgLength}자 (범위: ${patterns.titleStats.minLength}~${patterns.titleStats.maxLength}자)
- 제목에 키워드 포함률: ${patterns.titleStats.keywordInTitleRate}% (${patterns.titleStats.keywordInTitleCount}/${competitors.length}개)
- 평균 포스트 연령: ${patterns.dateStats.avgDaysAgo}일 (최신: ${patterns.dateStats.newestDaysAgo}일, 최오래: ${patterns.dateStats.oldestDaysAgo}일)
- 30일 이내 작성: ${patterns.dateStats.within30Days}개 / 90일 이내: ${patterns.dateStats.within90Days}개
- 블로그 다양성: ${patterns.blogDiversity.uniqueBlogCount}개 고유 블로그 / ${patterns.blogDiversity.totalResults}개 결과 (다양성 ${patterns.blogDiversity.diversityRate}%)
${dominantBlogInfo ? `- 다중 노출 블로그: ${dominantBlogInfo}` : ''}
${contentQualitySection}
경쟁 진입 난이도: ${difficultyLabel} (${difficulty.score}점/100점)
- 경쟁 치열도: ${difficulty.breakdown.competition}/25
- 콘텐츠 품질 장벽: ${difficulty.breakdown.quality}/25
- 사용자 반응 장벽: ${difficulty.breakdown.engagement}/25
- 최신성 경쟁: ${difficulty.breakdown.freshness}/25
난이도 근거: ${difficulty.reasons.join(' / ')}

위 데이터를 기반으로 경쟁 분석을 해주세요.
★ 중요:
1. 먼저 이 키워드의 검색 의도(정보형/상업형/지역형/경험형/증상형)를 파악하고, 그에 맞는 콘텐츠 전략을 제시하세요.
2. summary에서 경쟁 난이도 판정(${difficultyLabel})과 일관된 톤으로 분석하세요.
3. 난이도가 "어려움" 이상이면 진입이 쉽지 않다는 점을 반영하되, 발견된 콘텐츠 기회가 있다면 구체적으로 제시하세요.

다음 JSON 형식으로 응답해주세요:
{
  "summary": "전체 경쟁 상황 2-3문장 요약 (난이도 판정과 일관되게)",
  "topPatterns": ["상위 노출 글들의 공통 패턴 1", "패턴 2", "패턴 3"],
  "contentGaps": ["기존 글들이 놓치고 있는 콘텐츠 기회 1", "기회 2"],
  "recommendedStrategy": "이 키워드로 상위 노출하기 위한 구체적 전략 (100-200자)",
  "recommendedContentType": "비교/추천형|후기/리뷰형|방법/가이드형|리스트형|정보형|지역업종형 중 하나 (상위 글 분석 기반 최적 유형)",
  "recommendedTone": "친근하고 정보적인|전문적인|재미있는|솔직한 중 하나",
  "relatedKeywords": ["상위 글 분석에서 추출한 관련 키워드 5~8개"],
  "titleSuggestions": ["추천 제목 1", "추천 제목 2", "추천 제목 3"]
}`

  const response = onChunk
    ? (provider === 'claude'
      ? await callClaudeStream(COMPETITOR_ANALYSIS_PROMPT, userMessage, 4096, { jsonMode: true }, onChunk)
      : await callGeminiStream(COMPETITOR_ANALYSIS_PROMPT, userMessage, 4096, { jsonMode: true }, onChunk))
    : await callGemini(COMPETITOR_ANALYSIS_PROMPT, userMessage, 4096, { jsonMode: true })
  return parseGeminiJson<AiInsights>(response)
}

// === 이미지 분석 (기존 스크래핑 데이터 재사용) ===

async function analyzeCompetitorImages(
  keyword: string,
  scrapedData: Map<string, ScrapedPostData>,
): Promise<ImageAnalysis | null> {
  try {
    // 이미 스크래핑된 데이터에서 이미지 URL 수집 (글당 최대 3장, 총 최대 10장)
    const allImageUrls: string[] = []
    for (const [, data] of scrapedData) {
      if (data.imageUrls && data.imageUrls.length > 0) {
        allImageUrls.push(...data.imageUrls.slice(0, 3))
      }
    }

    if (allImageUrls.length === 0) {
      return { totalImages: 0, imageTypes: ['이미지 없음'], recommendation: '상위 글에서 이미지를 추출할 수 없었습니다.' }
    }

    const prompt = `"${keyword}" 키워드의 네이버 블로그 상위 노출 글에서 사용된 이미지 ${allImageUrls.length}장입니다.

다음을 분석해서 JSON으로 응답하세요:
{
  "imageTypes": ["직접 촬영 사진", "인포그래픽/도표", "제품 사진", "캡처/스크린샷", "일러스트/아이콘" 등 발견된 유형],
  "dominantType": "가장 많이 사용된 이미지 유형 1개",
  "recommendation": "이 키워드에서 상위 노출을 위해 어떤 이미지를 준비해야 하는지 구체적 추천 (2-3문장)"
}`

    const visionResult = await analyzeImagesWithGemini(allImageUrls, prompt, { maxImages: 10, thinkingBudget: 0 })

    try {
      const parsed = parseGeminiJson<{ imageTypes?: string[]; dominantType?: string; recommendation?: string }>(visionResult)
      return {
        totalImages: allImageUrls.length,
        imageTypes: parsed.imageTypes || [],
        recommendation: parsed.recommendation || '',
      }
    } catch {
      return {
        totalImages: allImageUrls.length,
        imageTypes: ['분석 실패'],
        recommendation: visionResult.substring(0, 200),
      }
    }
  } catch (err) {
    console.error('[Competitors] 이미지 분석 실패:', err)
    return null
  }
}

// === 데모 데이터 ===

function generateDemoCompetitors(keyword: string): CompetitorItem[] {
  const blogNames = ['블로그마스터', '일상기록장', '꿀팁대방출', '리뷰요정', '엄마의하루', '트렌드헌터', '생활연구소', '정보나눔이', '경험공유소', '스마트라이프']

  const titles = [
    `${keyword} 완벽 가이드 2026 총정리`,
    `${keyword} 추천 TOP 7 직접 비교해봄`,
    `${keyword} 후기 솔직하게 알려드릴게요`,
    `${keyword} 초보자도 쉽게 따라하는 방법`,
    `${keyword} 비교 분석 장단점 총정리`,
    `${keyword} 가성비 좋은 것만 골랐어요`,
    `[2026] ${keyword} 최신 트렌드 분석`,
    `${keyword} 실패하지 않는 꿀팁 5가지`,
    `${keyword} 전문가가 알려주는 핵심 포인트`,
    `내돈내산 ${keyword} 3개월 사용 후기`,
  ]

  const descs = [
    `오늘은 ${keyword}에 대해 자세히 알아보겠습니다. 많은 분들이 궁금해하시는 내용을 정리했어요.`,
    `${keyword} 관련 정보를 찾고 계신가요? 직접 경험해본 후기를 바탕으로 솔직하게 작성했습니다.`,
    `${keyword}의 모든 것을 한번에 정리! 초보자도 이해하기 쉽게 설명해드릴게요.`,
    `${keyword} 시작하시는 분들을 위해 기본부터 심화까지 단계별로 정리했습니다.`,
    `여러 ${keyword}를 직접 비교해보고 장단점을 분석했습니다. 선택에 도움이 되길 바랍니다.`,
    `가성비 좋은 ${keyword}만 엄선해서 추천드립니다. 가격 대비 만족도가 높은 것들이에요.`,
    `2026년 최신 ${keyword} 트렌드를 분석했습니다. 올해 달라진 점을 확인해보세요.`,
    `${keyword}에서 실패하지 않는 핵심 꿀팁 5가지를 정리했어요.`,
    `전문가 관점에서 ${keyword}의 핵심 포인트를 짚어드립니다.`,
    `3개월 동안 직접 사용해본 ${keyword} 솔직 후기입니다. 내돈내산 리뷰!`,
  ]

  // 데모 스크래핑 데이터 (일부러 짧은 글도 포함 — 짧아도 상위 노출 가능)
  const demoCharCounts = [2340, 1650, 870, 2800, 1900, null, null, null, null, null]
  const demoImageCounts = [8, 5, 3, 12, 6, null, null, null, null, null]
  const demoVideoCounts = [0, 1, 0, 2, 0, null, null, null, null, null]
  const demoCommentCounts = [15, 8, 22, 5, 12, null, null, null, null, null]
  const demoSympathyCounts = [25, 12, 35, 8, 18, null, null, null, null, null]
  const demoReadCounts = [3200, 1800, 5400, 2100, 2800, null, null, null, null, null]

  const now = new Date()
  return titles.map((title, i) => {
    const daysAgo = Math.floor(Math.random() * 150) + (i < 3 ? 7 : 30)
    const postDate = new Date(now.getTime() - daysAgo * 86400000)
    const yyyymmdd = `${postDate.getFullYear()}${String(postDate.getMonth() + 1).padStart(2, '0')}${String(postDate.getDate()).padStart(2, '0')}`

    return {
      rank: i + 1,
      title,
      link: `https://blog.naver.com/${blogNames[i].toLowerCase()}/22${3000000 + Math.floor(Math.random() * 100000)}`,
      description: descs[i],
      bloggerName: blogNames[i],
      bloggerLink: `https://blog.naver.com/${blogNames[i].toLowerCase()}`,
      postDate: yyyymmdd,
      postDateFormatted: formatDate(yyyymmdd),
      daysSincePosted: daysAgo,
      titleLength: title.length,
      hasKeywordInTitle: true,
      charCount: demoCharCounts[i] ?? null,
      imageCount: demoImageCounts[i] ?? null,
      videoCount: demoVideoCounts[i] ?? null,
      commentCount: demoCommentCounts[i] ?? null,
      sympathyCount: demoSympathyCounts[i] ?? null,
      readCount: demoReadCounts[i] ?? null,
    }
  })
}

function getDemoAiInsights(keyword: string): AiInsights {
  return {
    summary: `"${keyword}" 키워드의 상위 10개 블로그를 분석한 결과, 리스트형 콘텐츠와 후기가 주를 이루고 있습니다. 독자 반응(댓글/공감)이 높은 글은 구체적 경험과 수치를 포함한 콘텐츠이며, 최신 콘텐츠가 상위 노출에 유리한 경향이 뚜렷합니다.`,
    topPatterns: [
      '제목에 키워드를 앞쪽에 배치하고 "추천", "TOP", "비교" 등 클릭 유도 단어 사용',
      '소제목 3-5개를 활용한 체계적 구조로 독자 체류 시간 확보',
      '직접 경험 기반의 구체적 수치(가격, 기간)로 신뢰감 확보',
      '최신 연도(2026)를 제목이나 본문에 명시하여 최신성 어필',
    ],
    contentGaps: [
      '대부분의 글이 일반적인 정보 나열에 그치고 있어, 구체적인 비용/가격 비교 콘텐츠가 부족',
      '동영상이나 인포그래픽 등 멀티미디어 활용 글이 적어 차별화 가능',
      '초보자 관점의 단계별 가이드가 부족하여 진입 장벽이 낮은 콘텐츠로 공략 가능',
    ],
    recommendedStrategy: `${keyword} 키워드로 상위 노출을 위해서는 직접 경험 기반의 콘텐츠를 핵심 정보 위주로 밀도 높게 작성하세요. 기존 상위 글들이 다루지 않는 구체적인 비용 비교나 단계별 가이드 형태로 차별화하되, 소제목 4-5개로 구조화하여 독자의 체류 시간을 높이는 것이 핵심입니다.`,
    titleSuggestions: [
      `${keyword} 완벽 정리 - 초보자를 위한 단계별 가이드 (2026)`,
      `${keyword} 실제 비용 비교 분석 | 가성비 순위 TOP 5`,
      `${keyword} 3개월 직접 경험 후기 - 장단점 솔직 리뷰`,
    ],
    imageAnalysis: {
      totalImages: 15,
      imageTypes: ['직접 촬영 사진', '제품 비교 사진', '인포그래픽/도표'],
      recommendation: `${keyword} 관련 상위 글들은 직접 촬영한 실물 사진을 중심으로 사용하고 있습니다. 비교표나 인포그래픽을 추가하면 차별화할 수 있습니다.`,
    },
  }
}

// === API 핸들러 ===

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 크레딧 체크
    const creditCheck = await checkCredits(supabase, user.id, 'competitor_analysis')
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: creditCheck.message, creditLimit: true, balance: creditCheck.balance, cost: creditCheck.cost, planGate: creditCheck.planGate },
        { status: 403 }
      )
    }

    const { keyword, includeAi = false } = await request.json()

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: '분석할 키워드를 입력해주세요.' },
        { status: 400 }
      )
    }

    const cleanKeyword = keyword.trim()
    const provider = await getUserAiProvider(supabase, user.id)

    // API 키가 없으면 데모 데이터
    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
      const demoCompetitors = generateDemoCompetitors(cleanKeyword)
      const demoPatterns = analyzePatterns(demoCompetitors, cleanKeyword)
      const demoDifficulty = assessDifficulty(demoPatterns, demoCompetitors)
      const demoTitlePatterns = extractTitlePatterns(demoCompetitors, cleanKeyword)
      const demoAi = includeAi ? getDemoAiInsights(cleanKeyword) : null

      await deductCredits(supabase, user.id, 'competitor_analysis', { keyword: cleanKeyword })
      return NextResponse.json({
        keyword: cleanKeyword,
        competitors: demoCompetitors,
        patterns: demoPatterns,
        difficulty: demoDifficulty,
        titlePatterns: demoTitlePatterns,
        aiInsights: demoAi,
        isDemo: true,
      })
    }

    // 실제 분석: NDJSON 스트리밍 + 단계별 프로그레스
    await deductCredits(supabase, user.id, 'competitor_analysis', { keyword: cleanKeyword })

    const useAi = includeAi && hasAiApiKey(provider)
    const totalSteps = useAi ? 5 : 3
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        }

        try {
          // Step 1: 네이버 블로그 검색
          send({ type: 'progress', step: 1, totalSteps, message: '네이버 블로그 검색 중...' })
          const searchResult = await searchNaverBlog(cleanKeyword, 10)
          scheduleCollection(() => collectFromSearchResults(cleanKeyword, searchResult.items, 'competitor_analysis'))
          send({ type: 'progress', step: 1, totalSteps, message: `상위 ${searchResult.items.length}개 블로그 발견` })

          // Step 2: 콘텐츠 수집 (스크래핑)
          send({ type: 'progress', step: 2, totalSteps, message: '상위 블로그 콘텐츠 수집 중...' })
          let scrapedData = new Map<string, ScrapedPostData>()
          try {
            const { scrapeMultiplePosts } = await import('@/lib/naver/blog-scraper')
            const competitorLinks = searchResult.items.map(item => item.link)
            scrapedData = await scrapeMultiplePosts(competitorLinks, 10)
            send({ type: 'progress', step: 2, totalSteps, message: `${scrapedData.size}개 블로그 콘텐츠 수집 완료` })
            if (searchResult.items.length > 0 && scrapedData.size > 0) {
              scheduleCollection(() => collectFromScrapedPosts(cleanKeyword, scrapedData, searchResult.items, null, 'competitor_analysis'))
            }
          } catch (err) {
            console.error('[Competitors] 스크래핑 실패 (메타데이터만으로 분석):', err)
            send({ type: 'progress', step: 2, totalSteps, message: '메타데이터로 분석합니다' })
          }

          // 데이터 가공 (스크래핑 결과 병합)
          const competitors: CompetitorItem[] = searchResult.items.map((item, i) => {
            const cleanTitle = stripHtml(item.title)
            const cleanDesc = stripHtml(item.description)
            const keywordLower = cleanKeyword.toLowerCase().replace(/\s+/g, '')
            const scraped = scrapedData.get(item.link)

            return {
              rank: i + 1,
              title: cleanTitle,
              link: item.link,
              description: cleanDesc,
              bloggerName: item.bloggername,
              bloggerLink: item.bloggerlink,
              postDate: item.postdate,
              postDateFormatted: formatDate(item.postdate),
              daysSincePosted: daysSince(item.postdate),
              titleLength: cleanTitle.length,
              hasKeywordInTitle: cleanTitle.toLowerCase().replace(/\s+/g, '').includes(keywordLower),
              charCount: scraped?.charCount ?? null,
              imageCount: scraped?.imageCount ?? null,
              videoCount: scraped?.videoCount ?? null,
              commentCount: scraped?.commentCount ?? null,
              sympathyCount: scraped?.sympathyCount ?? null,
              readCount: scraped?.readCount ?? null,
            }
          })

          // Step 3: 패턴 분석
          send({ type: 'progress', step: 3, totalSteps, message: '경쟁 패턴 분석 중...' })
          const patterns = analyzePatterns(competitors, cleanKeyword)
          const difficulty = assessDifficulty(patterns, competitors)
          const titlePatterns = extractTitlePatterns(competitors, cleanKeyword)

          // 기본 분석 결과 전송
          send({
            type: 'data',
            keyword: cleanKeyword,
            competitors,
            patterns,
            difficulty,
            titlePatterns,
            isDemo: false,
          })

          // AI 분석 (includeAi일 때만)
          if (useAi) {
            send({ type: 'progress', step: 4, totalSteps, message: 'AI 경쟁 전략 분석 중...' })

            const [aiResult, imageResult] = await Promise.allSettled([
              getAiInsights(cleanKeyword, competitors, patterns, difficulty, (delta) => {
                send({ type: 'stream', delta })
              }, provider),
              analyzeCompetitorImages(cleanKeyword, scrapedData),
            ])

            let aiInsights: AiInsights | null = aiResult.status === 'fulfilled' ? aiResult.value : null
            if (aiResult.status === 'rejected') {
              console.error('[Competitors AI] AI 분석 실패:', aiResult.reason)
            }

            if (aiInsights && imageResult.status === 'fulfilled' && imageResult.value) {
              aiInsights.imageAnalysis = imageResult.value
            }

            send({ type: 'progress', step: 5, totalSteps, message: '분석 완료' })
            send({ type: 'ai_result', aiInsights })
          }
        } catch (error) {
          console.error('[Competitors] 스트리밍 오류:', error)
          send({ type: 'error', error: '상위노출 분석 중 오류가 발생했습니다.' })
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
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Competitors] 오류:', errorMessage)
    return NextResponse.json(
      { error: `상위노출 분석 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}
