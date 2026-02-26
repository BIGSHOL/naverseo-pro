/**
 * NaverSEO Pro - 블로그 지수 측정 엔진 v9
 *
 * v9 점수 체계: 4축 × 25점 = 100점
 *
 * 4대 분석 축 (각 25점 × 4 = 100점):
 * 1. 콘텐츠 품질 - 25점: 깊이(7), 이미지(5), 주제집중도(4), 구조(3), 내부링크(3), 일관성(3)
 * 2. 방문자 활동 - 25점: 방문자(8), 댓글(5), 공감(4), 이웃(4), 체류시간(4)
 * 3. SEO 최적화 - 25점: 순위(7), 노출률(5), 제목최적화(5), TOP10(4), 경쟁가치(4)
 * 4. 신뢰도 - 25점: 규칙성(7), 빈도(6), 최근성(5), 누적포스팅(4), 운영기간(3)
 * P. 어뷰징 감점 - 최대 -20점
 *
 * v8→v9 변경:
 * - 5축→4축 (주제 전문성→콘텐츠 품질 병합, 활동성+신뢰도→신뢰도 통합)
 * - 검색 보너스(별도 25점)→SEO 최적화(본축 25점) 승격
 * - 블로그 연차(추정)→최초 포스팅일 기반 표시
 */

import { stripHtml, countImageMarkers, daysBetween, parsePostDate, extractKoreanKeywords, extractBlogId } from '@/lib/utils/text'

// 타입 re-export (기존 import 호환)
export type {
  BlogPost,
  KeywordRankResult,
  AnalysisCategory,
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
import { analyzeAbuse } from './analyzers/abuse'
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
        estimatedReadTimeSec,
      }
    })
    .filter((p) => p.daysAgo >= 0)
    .sort((a, b) => a.daysAgo - b.daysAgo)
    .slice(0, 20)

  // 4대 분석 축 + 어뷰징 페널티 실행
  const { category: contentQuality, topicKeywords } = analyzeContentQuality(posts, scrapedData, blogName, blogId)
  const popularity = analyzePopularity(visitorData, engagementData, blogProfileData, recentPosts)
  const seoOptimization = analyzeSearchPower(keywordResults, keywordCompetition, posts)
  const { category: trust, frequency, recentPostDays } = analyzeTrust(posts, blogProfileData)
  const abusePenalty = analyzeAbuse(posts, scrapedData)

  // 4축 (각 25점 × 4 = 100점)
  const categories = [contentQuality, popularity, seoOptimization, trust]
  const rawScore = categories.reduce((sum, c) => sum + c.score, 0)
  const totalScore = Math.max(0, Math.min(100, rawScore + abusePenalty.score))
  const level = determineLevelInfo(totalScore)

  // v9: searchBonus는 레거시 호환용 (SEO 최적화가 본축으로 흡수)
  const searchBonus = {
    score: seoOptimization.score,
    maxScore: seoOptimization.maxScore,
    grade: seoOptimization.grade,
    details: seoOptimization.details,
  }

  const avgDescLength = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + stripHtml(p.description).length, 0) / posts.length)
    : 0
  const avgImageCount = posts.length > 0
    ? Math.round((posts.reduce((s, p) => s + countImageMarkers(p.description), 0) / posts.length) * 10) / 10
    : 0

  // 블로그 프로필 생성 - v9: 최초 포스팅일 우선순위 (검색API > 개설일 > 수집포스트)
  const sortedDates = posts
    .map((p) => parsePostDate(p.postdate))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  let postsPerWeek: number | null = null
  if (sortedDates.length >= 2) {
    const spanDays = daysBetween(sortedDates[sortedDates.length - 1], sortedDates[0]) || 1
    postsPerWeek = Math.round((sortedDates.length / spanDays) * 7 * 10) / 10
  }

  // v9: 최초 포스팅일 결정 (우선순위: 검색API → 개설일 → 수집 포스트 최소일)
  let estimatedStartDate: string | null = null
  let blogAgeDays: number | null = null
  let blogAgeEstimated = false

  const firstPostDateStr = blogProfileData?.firstPostDate  // YYYYMMDD
  const profileStartDate = blogProfileData?.blogStartDate  // YYYY-MM-DD

  if (firstPostDateStr && /^\d{8}$/.test(firstPostDateStr)) {
    // 1순위: 검색 API로 조회한 실제 최초 포스팅 날짜
    const y = firstPostDateStr.slice(0, 4)
    const m = firstPostDateStr.slice(4, 6)
    const d = firstPostDateStr.slice(6, 8)
    estimatedStartDate = `${y}.${m}.${d}`
    const firstDate = new Date(`${y}-${m}-${d}`)
    if (!isNaN(firstDate.getTime())) {
      blogAgeDays = daysBetween(now, firstDate)
    }
    blogAgeEstimated = !(blogProfileData?.firstPostDateAccurate ?? true)
  } else if (profileStartDate) {
    // 2순위: 프로필 페이지에서 추출한 블로그 개설일
    estimatedStartDate = profileStartDate.replace(/-/g, '.')
    const startDate = new Date(profileStartDate)
    if (!isNaN(startDate.getTime())) {
      blogAgeDays = daysBetween(now, startDate)
    }
    blogAgeEstimated = true  // 개설일은 첫 포스팅과 다를 수 있음
  } else if (sortedDates.length > 0) {
    // 3순위: 수집된 포스트 중 가장 오래된 것 (가장 부정확)
    estimatedStartDate = `${sortedDates[0].getFullYear()}.${String(sortedDates[0].getMonth() + 1).padStart(2, '0')}.${String(sortedDates[0].getDate()).padStart(2, '0')}`
    blogAgeDays = daysBetween(now, sortedDates[0])
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

  const benchmark: BenchmarkData = {
    postingFrequency: {
      mine: postsPerWeek || 0,
      recommended: cb?.postingFrequency.recommended ?? 3,
      topBlogger: cb?.postingFrequency.topBlogger ?? 5,
    },
    avgTitleLength: { mine: avgTitleLength, optimal: cb?.avgTitleLength.optimal ?? 25 },
    avgContentLength: { mine: avgDescLength, recommended: cb?.avgContentLength.recommended ?? 150 },
    imageRate: { mine: imageRate, recommended: cb?.imageRate.recommended ?? 80 },
    topicFocus: { mine: topicFocusPct, recommended: cb?.topicFocus.recommended ?? 60 },
    keywordDensity: { mine: keywordDensity, optimal: [0.5, 3.0] },
    avgImageCount: { mine: avgImageCount, recommended: cb?.avgImageCount.recommended ?? 3 },
    optimizationPct,
    categoryPercentile,
    ...(engagementData?.isAvailable && engagementData.avgCommentCount !== null ? {
      avgCommentCount: {
        mine: engagementData.avgCommentCount,
        recommended: cb?.avgCommentCount.recommended ?? 5,
      },
    } : {}),
    ...(engagementData?.isAvailable && engagementData.avgSympathyCount !== null ? {
      avgSympathyCount: {
        mine: engagementData.avgSympathyCount,
        recommended: cb?.avgSympathyCount.recommended ?? 10,
      },
    } : {}),
    ...(visitorData?.isAvailable ? {
      dailyVisitors: {
        mine: visitorData.avgDailyVisitors,
        recommended: cb?.dailyVisitors.recommended ?? 200,
        topBlogger: cb?.dailyVisitors.topBlogger ?? 1000,
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
