/**
 * NaverSEO Pro - 블로그 지수 측정 엔진 v11
 *
 * v12 점수 체계: 5축 비균등 배분 = 100점
 *
 * 5대 분석 축 (C-Rank 알고리즘 기반 비균등 배분):
 * 1. 주제 전문성 - 25점: 일관성(8), 카테고리(7), 시리즈(4), 전문용어(3), 품질일관성(3), 유사도(-3), 중복(-3)
 * 2. 콘텐츠 품질 - 25점: 깊이(8), 이미지(5), 구조(5), 내부링크(4), 경험정보(3), 짧은글(-3), 이미지도배(-2)
 * 3. 활동 신뢰도 - 20점: 규칙성(6), 빈도(5), 최근성(4), 누적(3), 운영기간(2), 스팸(-3), 외부링크(-3), 일괄발행(-3)
 * 4. 사용자 반응 - 15점: 댓글(5), 공감(3), 이웃(3), 체류(4), 벽텍스트(-1), 광고성(-1)
 * 5. 검색 노출력 - 15점: 순위(5), 노출률(3), TOP10(4), 제목(3), 특수문자(-1), 상업적(-1), 반복(-1)
 *
 * v11→v12 변경:
 * - 5축 비균등(30:25:25:10:10) → (25:25:20:15:15)
 * - 사용자 반응/검색 노출력 가중치 강화 (댓글/공감/검색순위 영향력 ↑)
 * - 미측정 무상 점수 폐지 유지
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
  ExposureVerification,
  BlogIndexResult,
  BlogProfileData,
  EngagementData,
} from './types'

// 서브 모듈 함수 import
import { analyzeTopicAuthority } from './analyzers/topic-authority'
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
  ExposureVerification,
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
      const quality = scorePost(cleanTitle, p.description, charCount, imgCount, isScrapped, {
        commentCount,
        sympathyCount,
        readCount,
        videoCount: scraped?.videoCount,
        tableCount: scraped?.tableCount,
        formatting: scraped?.formatting,
        linkCount: scraped?.linkCount,
        internalLinkCount: scraped?.meta?.linkAnalysis?.internalCount,
      })

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

  // v11: 5축 비균등 배분 (30+25+25+10+10 = 100점)
  const { category: topicAuthority, topicKeywords } = analyzeTopicAuthority(posts, scrapedData, blogName, blogId)
  const contentQuality = analyzeContentQuality(posts, scrapedData, topPostsScrapedData)
  const { category: trust, frequency, recentPostDays } = analyzeTrust(posts, blogProfileData, blogAgeDays, scrapedData)
  const popularity = analyzePopularity(visitorData, engagementData, blogProfileData, recentPosts, scrapedData)
  const seoOptimization = analyzeSearchPower(keywordResults, keywordCompetition, posts)

  // v10: 어뷰징 감점이 각 축에 통합되어 별도 페널티 없음
  const abusePenalty = { score: 0, details: [] as string[], flags: [] as string[] }

  // v11: 5축 합계 = 총점
  const categories = [topicAuthority, contentQuality, trust, popularity, seoOptimization]
  const rawScore = categories.reduce((sum, c) => sum + c.score, 0)

  // v13: 노출 검증 보정 — 내부 지표 대비 검색 노출 괴리 시 감점
  const exposureVerification = calculateExposureVerification(categories, keywordResults)
  const totalScore = Math.max(0, Math.min(100, rawScore - exposureVerification.discount))
  const level = determineLevelInfo(totalScore)

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
    exposureVerification,
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
 * v13: 노출 검증 보정
 *
 * 내부 4축(전문성/품질/활동/반응)과 검색 노출력 사이의 괴리를 감지.
 * 내부 지표가 좋은데 검색에 안 잡히면 총점을 감점하여
 * "점수는 높은데 왜 안 나오지?" 문제를 해결합니다.
 */
function calculateExposureVerification(
  categories: import('./types').AnalysisCategory[],
  keywordResults: KeywordRankResult[],
): ExposureVerification {
  const searchCat = categories.find(c => c.name === '검색 노출력')
  if (!searchCat) {
    return { status: 'verified', discount: 0, message: '', internalPct: 0, searchPct: 0 }
  }

  const internalCats = categories.filter(c => c.name !== '검색 노출력')
  const internalScore = internalCats.reduce((s, c) => s + c.score, 0)
  const internalMax = internalCats.reduce((s, c) => s + c.maxScore, 0)

  const internalRatio = internalMax > 0 ? internalScore / internalMax : 0
  const searchRatio = searchCat.maxScore > 0 ? searchCat.score / searchCat.maxScore : 0

  const internalPct = Math.round(internalRatio * 1000) / 10
  const searchPct = Math.round(searchRatio * 1000) / 10

  // 내부 점수가 낮은 블로그는 추가 감점 불필요
  if (internalRatio < 0.5) {
    return { status: 'verified', discount: 0, message: '', internalPct, searchPct }
  }

  // 키워드 미입력 — 검증 자체가 불가
  if (keywordResults.length === 0) {
    return {
      status: 'unverified',
      discount: 5,
      message: '검색 키워드가 입력되지 않아 노출을 검증할 수 없습니다. 키워드를 추가하면 더 정확한 점수를 받을 수 있습니다.',
      internalPct,
      searchPct,
    }
  }

  const gap = internalRatio - searchRatio

  // 심한 괴리: 내부 지표 >> 검색 노출
  if (gap >= 0.4) {
    return {
      status: 'unverified',
      discount: Math.min(10, Math.floor(gap * 15)),
      message: `내부 지표(${internalPct}%) 대비 실제 검색 노출(${searchPct}%)이 매우 낮습니다. 키워드 전략과 검색 최적화를 우선 개선하세요.`,
      internalPct,
      searchPct,
    }
  }

  // 중간 괴리
  if (gap >= 0.25) {
    return {
      status: 'partial',
      discount: Math.min(5, Math.floor(gap * 8)),
      message: `내부 지표(${internalPct}%) 대비 검색 노출(${searchPct}%)이 다소 부족합니다. 키워드 최적화에 집중하세요.`,
      internalPct,
      searchPct,
    }
  }

  // 괴리 없음
  return { status: 'verified', discount: 0, message: '', internalPct, searchPct }
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

