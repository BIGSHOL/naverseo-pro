/**
 * NaverSEO Pro - 블로그 지수 측정 엔진 v10
 *
 * v10 점수 체계: 4축 × 25점 = 100점 (어뷰징 감점 통합)
 *
 * 4대 분석 축 (각 25점, 가점+감점 포함):
 * 1. 콘텐츠 품질 - 25점: 깊이(7), 이미지(5), 주제집중도(4), 구조(3), 내부링크(3), 일관성(3), 제목유사도(-3), 중복(-3), 짧은글(-2)
 * 2. 방문자 활동 - 25점: 방문자(8), 댓글(5), 공감(4), 이웃(4), 체류시간(4)
 * 3. SEO 최적화 - 25점: 순위(7), 노출률(5), 제목최적화(5), TOP10(4), 경쟁가치(4), 특수문자(-2)
 * 4. 신뢰도 - 25점: 규칙성(7), 빈도(6), 최근성(5), 누적포스팅(4), 운영기간(3), 스팸(-3), 외부링크(-3)
 *
 * v9→v10 변경:
 * - 별도 어뷰징 감점 → 4축에 감점으로 통합
 * - 범위 기반 점수 (길면 무조건 좋은 게 아님)
 * - 항목별 ±점수 표시 (items: ScoreItem[])
 */

import { stripHtml, countImageMarkers, daysBetween, parsePostDate, extractKoreanKeywords, extractBlogId } from '@/lib/utils/text'

// 타입 re-export (기존 import 호환)
export type {
  BlogPost,
  KeywordRankResult,
  AnalysisCategory,
  ScoreItem,
  KeywordCompetitionData,
  VisitorData,
  BlogLevelInfo,
  PostQuality,
  PostDetail,
  BlogProfile,
  BenchmarkData,
  AbusePenalty,
  AiAnalysis,
  BlogIndexResult,
  BlogProfileData,
  EngagementData,
} from './types'

// 서브 모듈 함수 import
import { analyzeContentQuality } from './analyzers/content-quality'
import { analyzeSearchPower } from './analyzers/search-power'
import { analyzePopularity } from './analyzers/popularity'
import { analyzeTrust } from './analyzers/activity'
import { determineLevelInfo, generateRecommendations } from './grading'
import { scorePost } from './scoring'
import { calculateDiaScore, calculateCrankScore } from './naver-scores'

// public re-export
export { determineLevelInfo } from './grading'
export { generateDemoPosts, generateDemoKeywordResults, generateDemoKeywordCompetition, generateDemoVisitorData, generateDemoBlogProfileData, generateDemoEngagementData, generateDemoScrapedData } from './demo'

import type {
  BlogPost,
  KeywordRankResult,
  KeywordCompetitionData,
  VisitorData,
  PostDetail,
  BlogProfile,
  BenchmarkData,
  BlogIndexResult,
  BlogProfileData,
  EngagementData,
  ScoreItem,
} from './types'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'

// ===== 메인 분석 함수 =====

export function analyzeBlogIndex(
  blogUrl: string,
  posts: BlogPost[],
  keywordResults: KeywordRankResult[],
  isDemo: boolean,
  blogName?: string | null,
  keywordCompetition?: KeywordCompetitionData[],
  visitorData?: VisitorData | null,
  scrapedData?: Map<string, ScrapedPostData> | null,
  blogProfileData?: BlogProfileData | null,
  categoryBenchmarkValues?: import('./categories').CategoryBenchmarkValues | null,
  topPostsScrapedData?: Map<string, ScrapedPostData> | null,
): BlogIndexResult {
  const blogId = extractBlogId(blogUrl)
  const now = new Date()

  // 인기도 데이터 집계 (scrapedData에서 댓글/공감 추출)
  const engagementData = aggregateEngagementData(scrapedData)

  // 포스트 분석 요약 (recentPosts 생성 먼저 - 방문자 활동에서 사용)
  const avgTitleLength = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + stripHtml(p.title).length, 0) / posts.length)
    : 0

  // 개별 포스트 상세 데이터 생성
  const recentPosts: PostDetail[] = posts
    .map((p) => {
      const cleanTitle = stripHtml(p.title)
      const cleanDesc = stripHtml(p.description)
      const postDate = parsePostDate(p.postdate)
      const daysAgo = !isNaN(postDate.getTime()) ? daysBetween(now, postDate) : -1
      const dateStr = !isNaN(postDate.getTime())
        ? `${postDate.getFullYear()}.${String(postDate.getMonth() + 1).padStart(2, '0')}.${String(postDate.getDate()).padStart(2, '0')}`
        : '날짜 없음'

      const scraped = scrapedData?.get(p.link) ?? null
      const charCount = scraped ? scraped.charCount : cleanDesc.length
      const imgCount = scraped ? scraped.imageCount : countImageMarkers(p.description)
      const hasImage = imgCount > 0
      const isScrapped = scraped !== null
      const commentCount = scraped?.commentCount ?? null
      const sympathyCount = scraped?.sympathyCount ?? null
      const readCount = scraped?.readCount ?? null
      const quality = scorePost(cleanTitle, p.description, charCount, imgCount, isScrapped, commentCount, sympathyCount)

      const estimatedReadTimeSec = isScrapped
        ? Math.round((charCount / 400) * 60 + imgCount * 3)
        : undefined

      return {
        title: cleanTitle,
        link: p.link,
        daysAgo,
        date: dateStr,
        charCount,
        hasImage,
        imageCount: imgCount,
        titleLength: cleanTitle.length,
        quality,
        isScrapped,
        commentCount,
        sympathyCount,
        readCount,
        estimatedReadTimeSec,
      }
    })
    .filter((p) => p.daysAgo >= 0)
    .sort((a, b) => a.daysAgo - b.daysAgo)
    .slice(0, 20)

  // v9: 최초 포스팅일 결정 (우선순위: 검색API → 개설일 → 수집 포스트 최소일)
  // analyzeTrust에 전달하기 위해 먼저 계산
  const preSortedDates = posts
    .map((p) => parsePostDate(p.postdate))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  let blogAgeDays: number | null = null
  const firstPostDateStr = blogProfileData?.firstPostDate  // YYYYMMDD
  const profileStartDate = blogProfileData?.blogStartDate  // YYYY-MM-DD

  if (firstPostDateStr && /^\d{8}$/.test(firstPostDateStr)) {
    const firstDate = new Date(`${firstPostDateStr.slice(0, 4)}-${firstPostDateStr.slice(4, 6)}-${firstPostDateStr.slice(6, 8)}`)
    if (!isNaN(firstDate.getTime())) blogAgeDays = daysBetween(now, firstDate)
  } else if (profileStartDate) {
    const startDate = new Date(profileStartDate)
    if (!isNaN(startDate.getTime())) blogAgeDays = daysBetween(now, startDate)
  } else if (preSortedDates.length > 0) {
    blogAgeDays = daysBetween(now, preSortedDates[0])
  }

  // 4대 분석 축 (어뷰징 감점 각 축에 통합됨)
  const { category: contentQuality, topicKeywords } = analyzeContentQuality(posts, scrapedData, blogName, blogId, topPostsScrapedData)
  const popularity = analyzePopularity(visitorData, engagementData, blogProfileData, recentPosts, scrapedData)
  const seoOptimization = analyzeSearchPower(keywordResults, keywordCompetition, posts)
  const { category: trust, frequency, recentPostDays } = analyzeTrust(posts, blogProfileData, blogAgeDays, scrapedData)

  // v10: 어뷰징 감점이 각 축에 통합되어 별도 페널티 없음
  const abusePenalty = { score: 0, details: [] as string[], flags: [] as string[] }

  // 4축 합계 = 총점 (별도 감점 없음)
  const categories = [contentQuality, popularity, seoOptimization, trust]
  const rawScore = categories.reduce((sum, c) => sum + c.score, 0)
  const totalScore = Math.max(0, Math.min(100, rawScore))
  const level = determineLevelInfo(totalScore)

  // v10: 검색 성과 (5대축 전용) — SEO 최적화와 다른 관점으로 키워드 순위 성과 측정
  const searchBonus = computeSearchPerformance(keywordResults)

  // v10: recentPosts(PostDetail)의 실제 charCount/imageCount 사용 (스크래핑 데이터 우선)
  const avgDescLength = recentPosts.length > 0
    ? Math.round(recentPosts.reduce((s, p) => s + p.charCount, 0) / recentPosts.length)
    : 0
  const avgImageCount = recentPosts.length > 0
    ? Math.round((recentPosts.reduce((s, p) => s + p.imageCount, 0) / recentPosts.length) * 10) / 10
    : 0

  // 블로그 프로필 생성 - preSortedDates 재활용
  let postsPerWeek: number | null = null
  if (preSortedDates.length >= 2) {
    const spanDays = daysBetween(preSortedDates[preSortedDates.length - 1], preSortedDates[0]) || 1
    postsPerWeek = Math.round((preSortedDates.length / spanDays) * 7 * 10) / 10
  }

  // estimatedStartDate + blogAgeEstimated (blogAgeDays는 이미 위에서 계산됨)
  let estimatedStartDate: string | null = null
  let blogAgeEstimated = false

  if (firstPostDateStr && /^\d{8}$/.test(firstPostDateStr)) {
    const y = firstPostDateStr.slice(0, 4)
    const m = firstPostDateStr.slice(4, 6)
    const d = firstPostDateStr.slice(6, 8)
    estimatedStartDate = `${y}.${m}.${d}`
    blogAgeEstimated = !(blogProfileData?.firstPostDateAccurate ?? true)
  } else if (profileStartDate) {
    estimatedStartDate = profileStartDate.replace(/-/g, '.')
    blogAgeEstimated = true
  } else if (preSortedDates.length > 0) {
    estimatedStartDate = `${preSortedDates[0].getFullYear()}.${String(preSortedDates[0].getMonth() + 1).padStart(2, '0')}.${String(preSortedDates[0].getDate()).padStart(2, '0')}`
    blogAgeEstimated = true
  }

  const blogProfile: BlogProfile = {
    blogId,
    blogName: blogName || null,
    blogUrl,
    totalPosts: posts.length,
    categoryKeywords: topicKeywords.slice(0, 5),
    estimatedStartDate,
    isActive: recentPostDays !== null && recentPostDays <= 30,
    blogAgeDays,
    blogAgeEstimated,
    postsPerWeek,
    totalPostCount: blogProfileData?.totalPostCount ?? null,
    blogCreatedDate: blogProfileData?.blogStartDate ?? null,
  }

  // 벤치마크 데이터 생성
  const imageRate = recentPosts.length > 0
    ? Math.round((recentPosts.filter(p => p.hasImage).length / recentPosts.length) * 100)
    : 0

  // 주제 집중도 계산
  const wordFreqAll: Record<string, number> = {}
  posts.forEach((p) => {
    const words = extractKoreanKeywords(stripHtml(p.title) + ' ' + stripHtml(p.description))
    const unique = new Set(words)
    unique.forEach((w) => { wordFreqAll[w] = (wordFreqAll[w] || 0) + 1 })
  })
  const topWordCount = Object.values(wordFreqAll).sort((a, b) => b - a)[0] || 0
  const topicFocusPct = posts.length > 0 ? Math.min(100, Math.round((topWordCount / posts.length) * 100)) : 0

  // 키워드 밀도 계산
  const allDescWords = posts.flatMap(p => extractKoreanKeywords(stripHtml(p.description)))
  const topWordInAll = Object.entries(wordFreqAll).sort((a, b) => b[1] - a[1])[0]
  const keywordDensity = topWordInAll && allDescWords.length > 0
    ? Math.round((allDescWords.filter(w => w === topWordInAll[0]).length / allDescWords.length) * 1000) / 10
    : 0

  const optimizationPct = Math.round(totalScore * 1.0)

  let categoryPercentile: number
  if (totalScore >= 95) categoryPercentile = 3
  else if (totalScore >= 85) categoryPercentile = 10
  else if (totalScore >= 75) categoryPercentile = 20
  else if (totalScore >= 65) categoryPercentile = 30
  else if (totalScore >= 55) categoryPercentile = 40
  else if (totalScore >= 45) categoryPercentile = 50
  else if (totalScore >= 35) categoryPercentile = 65
  else if (totalScore >= 25) categoryPercentile = 80
  else categoryPercentile = 95

  const cb = categoryBenchmarkValues

  // v11: 상위 포스팅 실데이터 → 벤치마크 topBlogger 대체
  let topContentLen: number | null = null
  let topImageCount: number | null = null
  if (topPostsScrapedData && topPostsScrapedData.size > 0) {
    const topPosts = Array.from(topPostsScrapedData.values())
    topContentLen = Math.round(topPosts.reduce((s, p) => s + p.charCount, 0) / topPosts.length)
    topImageCount = Math.round((topPosts.reduce((s, p) => s + (p.imageCount || 0), 0) / topPosts.length) * 10) / 10
  }

  const benchmark: BenchmarkData = {
    postingFrequency: {
      mine: postsPerWeek || 0,
      recommended: cb?.postingFrequency.recommended ?? 3,
      topBlogger: cb?.postingFrequency.topBlogger ?? 5,
    },
    avgTitleLength: {
      mine: avgTitleLength,
      optimal: cb?.avgTitleLength.optimal ?? 25,
      topBlogger: Math.round((cb?.avgTitleLength.optimal ?? 25) * 1.3),
    },
    avgContentLength: {
      mine: avgDescLength,
      recommended: cb?.avgContentLength.recommended ?? 1500,
      topBlogger: topContentLen ?? Math.round((cb?.avgContentLength.recommended ?? 1500) * 1.7),
    },
    imageRate: {
      mine: imageRate,
      recommended: cb?.imageRate.recommended ?? 80,
      topBlogger: Math.min(100, (cb?.imageRate.recommended ?? 80) + 5),
    },
    topicFocus: {
      mine: topicFocusPct,
      recommended: cb?.topicFocus.recommended ?? 60,
      topBlogger: Math.min(95, (cb?.topicFocus.recommended ?? 60) + 20),
    },
    keywordDensity: { mine: keywordDensity, optimal: [0.5, 3.0] },
    avgImageCount: {
      mine: avgImageCount,
      recommended: cb?.avgImageCount.recommended ?? 5,
      topBlogger: topImageCount ?? Math.round((cb?.avgImageCount.recommended ?? 5) * 2),
    },
    optimizationPct,
    categoryPercentile,
    ...(engagementData?.isAvailable && engagementData.avgCommentCount !== null ? {
      avgCommentCount: {
        mine: engagementData.avgCommentCount,
        recommended: cb?.avgCommentCount.recommended ?? 5,
        topBlogger: Math.round((cb?.avgCommentCount.recommended ?? 5) * 2.5),
      },
    } : {}),
    ...(engagementData?.isAvailable && engagementData.avgSympathyCount !== null ? {
      avgSympathyCount: {
        mine: engagementData.avgSympathyCount,
        recommended: cb?.avgSympathyCount.recommended ?? 10,
        topBlogger: Math.round((cb?.avgSympathyCount.recommended ?? 10) * 2.5),
      },
    } : {}),
    ...(visitorData?.isAvailable ? {
      dailyVisitors: {
        mine: visitorData.avgDailyVisitors,
        recommended: cb?.dailyVisitors.recommended ?? 200,
        topBlogger: cb?.dailyVisitors.topBlogger ?? 1000,
        source: visitorData.source || 'api',
        historyDays: visitorData.historyDays,
      },
    } : {}),
    blogAge: {
      mine: blogAgeDays ?? 0,
      recommended: cb?.blogAge.recommended ?? 365,
    },
    totalPostCount: {
      mine: blogProfileData?.totalPostCount ?? posts.length,
      recommended: cb?.totalPostCount.recommended ?? 100,
    },
    ...(blogProfileData?.buddyCount != null ? {
      buddyCount: {
        mine: blogProfileData.buddyCount,
        recommended: 300,
      },
    } : {}),
  }

  const recommendations = generateRecommendations(categories, abusePenalty, {
    benchmark,
    level,
    totalScore,
    recentPosts,
    blogProfile,
    searchBonus,
  })

  // v9.1: 네이버 알고리즘 추정 점수
  const diaScore = calculateDiaScore(categories)
  const crankScore = calculateCrankScore(categories)

  return {
    blogUrl,
    blogId,
    totalScore,
    level,
    categories,
    abusePenalty,
    searchBonus,
    keywordResults,
    postAnalysis: {
      totalFound: posts.length,
      avgTitleLength,
      avgDescLength,
      avgImageCount,
      topicKeywords,
      postingFrequency: frequency,
      recentPostDays,
      avgCommentCount: engagementData?.avgCommentCount ?? null,
      avgSympathyCount: engagementData?.avgSympathyCount ?? null,
      avgEstimatedReadTimeSec: (() => {
        const withTime = recentPosts.filter(p => p.estimatedReadTimeSec != null)
        return withTime.length > 0
          ? Math.round(withTime.reduce((s, p) => s + p.estimatedReadTimeSec!, 0) / withTime.length)
          : undefined
      })(),
    },
    recentPosts,
    blogProfile,
    benchmark,
    recommendations,
    isDemo,
    checkedAt: new Date().toISOString(),
    diaScore,
    crankScore,
  }
}

/**
 * 스크래핑 데이터에서 인기도 데이터 집계
 */
function aggregateEngagementData(
  scrapedData?: Map<string, ScrapedPostData> | null
): EngagementData | null {
  if (!scrapedData || scrapedData.size === 0) {
    return null
  }

  const posts = Array.from(scrapedData.values())

  const commentsWithData = posts.filter(p => p.commentCount !== null)
  const avgCommentCount = commentsWithData.length > 0
    ? Math.round((commentsWithData.reduce((s, p) => s + (p.commentCount || 0), 0) / commentsWithData.length) * 10) / 10
    : null

  const sympathyWithData = posts.filter(p => p.sympathyCount !== null)
  const avgSympathyCount = sympathyWithData.length > 0
    ? Math.round((sympathyWithData.reduce((s, p) => s + (p.sympathyCount || 0), 0) / sympathyWithData.length) * 10) / 10
    : null

  const isAvailable = avgCommentCount !== null || avgSympathyCount !== null

  return { avgCommentCount, avgSympathyCount, isAvailable }
}

/**
 * 검색 성과 (5대축 전용, 25점)
 *
 * SEO 최적화(3축)와 다른 관점으로 키워드 순위를 평가:
 * - SEO 최적화: 블로그 자체의 SEO 역량 (제목 최적화, 경쟁 가치 등)
 * - 검색 성과: 실제 키워드 검색에서의 순위 결과 성과
 *
 * 가점: 1페이지 점유율(8) + 최상위 비율(6) + 순위 안정성(6) + 키워드 커버리지(5) = 25
 * 감점: 키워드 부족(0~-3)
 * 최종: clamp(가점 + 감점, 0, 25)
 *
 * 차별화 (SEO 최적화와의 차이):
 * - 1페이지 점유율: TOP10 "비율" (SEO축은 절대 개수)
 * - 최상위 비율: TOP3 "비율" (SEO축에는 없음)
 * - 순위 안정성: "중앙값" 기반 (SEO축은 "평균")
 * - 키워드 커버리지: 노출 여부 비율 (SEO축과 기준 다름: 순위 유무 vs TOP10)
 */
function computeSearchPerformance(keywordResults: KeywordRankResult[]) {
  const maxScore = 25
  const items: ScoreItem[] = []
  const details: string[] = []
  let score = 0

  if (keywordResults.length === 0) {
    return { score: 0, maxScore, grade: 'F', details: ['측정 키워드가 없습니다'], items: [] as ScoreItem[] }
  }

  const ranked = keywordResults.filter(r => r.rank !== null)
  const total = keywordResults.length

  // === 1. 1페이지 점유율 (8점): TOP10 키워드 비율 ===
  const top10 = ranked.filter(r => r.rank! <= 10).length
  const top10Rate = top10 / total
  let top10Pts = 0
  if (top10Rate >= 0.8) top10Pts = 8
  else if (top10Rate >= 0.6) top10Pts = 6
  else if (top10Rate >= 0.4) top10Pts = 4
  else if (top10Rate >= 0.2) top10Pts = 3
  else if (top10Rate >= 0.1) top10Pts = 2
  else if (top10 >= 1) top10Pts = 1
  score += top10Pts
  details.push(`1페이지 점유율: ${Math.round(top10Rate * 100)}% (${top10}/${total}) (+${top10Pts})`)
  items.push({ label: `1페이지 점유율 (${Math.round(top10Rate * 100)}%)`, points: top10Pts })

  // === 2. 최상위 비율 (6점): TOP3 키워드 비율 (절대 개수X → 비율O) ===
  const top3 = ranked.filter(r => r.rank! <= 3).length
  const top3Rate = total > 0 ? top3 / total : 0
  let top3Pts = 0
  if (top3Rate >= 0.6) top3Pts = 6
  else if (top3Rate >= 0.4) top3Pts = 5
  else if (top3Rate >= 0.25) top3Pts = 4
  else if (top3Rate >= 0.15) top3Pts = 3
  else if (top3 >= 1) top3Pts = 2     // 최소 1개라도 TOP3이면 2점
  score += top3Pts
  details.push(`최상위 비율: ${Math.round(top3Rate * 100)}% (${top3}/${total}) (+${top3Pts})`)
  items.push({ label: `최상위 TOP3 비율 (${Math.round(top3Rate * 100)}%)`, points: top3Pts })

  // === 3. 순위 안정성 (6점): 순위 중앙값 기반 (평균 대비 이상치 방어) ===
  if (ranked.length > 0) {
    const sortedRanks = ranked.map(r => r.rank!).sort((a, b) => a - b)
    const mid = Math.floor(sortedRanks.length / 2)
    const median = sortedRanks.length % 2 === 0
      ? (sortedRanks[mid - 1] + sortedRanks[mid]) / 2
      : sortedRanks[mid]

    let medianPts = 0
    if (median <= 5) medianPts = 6
    else if (median <= 10) medianPts = 5
    else if (median <= 20) medianPts = 4
    else if (median <= 30) medianPts = 3
    else if (median <= 50) medianPts = 2
    else medianPts = 1
    score += medianPts
    details.push(`순위 중앙값: ${Math.round(median)}위 (+${medianPts})`)
    items.push({ label: `순위 안정성 (중앙 ${Math.round(median)}위)`, points: medianPts })
  }

  // === 4. 키워드 커버리지 (5점): 노출 비율 (순위 유무) ===
  const coverageRate = ranked.length / total
  let coveragePts = 0
  if (coverageRate >= 0.9) coveragePts = 5
  else if (coverageRate >= 0.7) coveragePts = 4
  else if (coverageRate >= 0.5) coveragePts = 3
  else if (coverageRate >= 0.3) coveragePts = 2
  else if (coverageRate >= 0.1) coveragePts = 1
  score += coveragePts
  details.push(`키워드 커버리지: ${Math.round(coverageRate * 100)}% (+${coveragePts})`)
  items.push({ label: `키워드 커버리지 (${Math.round(coverageRate * 100)}%)`, points: coveragePts })

  // === [감점] 키워드 부족 (0~-3): 측정 키워드가 적으면 신뢰도 낮음 ===
  if (total <= 1) {
    score -= 3
    details.push(`키워드 부족: ${total}개 (최소 3개 이상 권장) (-3)`)
    items.push({ label: `키워드 부족 (${total}개)`, points: -3 })
  } else if (total <= 2) {
    score -= 2
    details.push(`키워드 부족: ${total}개 (3개 이상 권장) (-2)`)
    items.push({ label: `키워드 부족 (${total}개)`, points: -2 })
  }

  score = Math.max(0, Math.min(maxScore, score))
  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return { score, maxScore, grade, details, items }
}
