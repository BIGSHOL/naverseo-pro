/**
 * NaverSEO Pro - 블로그 지수 측정 엔진 v15
 *
 * v15 점수 체계: 4축 C-Rank 업계 기준 배분 = 100점
 *
 * 4대 분석 축 (C-Rank 업계 컨센서스 40:25:20:15):
 * 1. 주제 전문성 - 40점: 일관성(11), 카테고리(7), 시리즈(8), 전문용어(7), 품질일관성(7), 유사도(-5), 중복(-5)
 * 2. 활동 신뢰도 - 25점: 규칙성(6), 빈도(5), 최근성(3), 누적(5), 운영기간(6), 스팸(-3), 외부링크(-3), 일괄발행(-3), 과다발행(-2)
 * 3. 사용자 반응 - 20점: 댓글(8), 공감(5), 이웃(5), 체류(2), 벽텍스트(-1), 광고성(-1)
 * 4. 콘텐츠 품질 - 15점: 깊이(3), 이미지(3), 구조(4), 내부링크(2), 경험정보(3), 짧은글(-2), 이미지도배(-1), 과도한길이(-3), 이미지과다(-1), 문장반복(-2)
 *
 * 검색 노출력: 점수 미반영 (참고 지표로만 표시)
 *   → 검색 순위는 C-Rank+DIA의 부산물이므로 입력 변수에서 제외 (순환 논리 방지)
 *
 * v14→v15 변경:
 * - 축 간 배분(40:25:20:15) 유지, 내부 배점만 재배분
 * - 주제 전문성: 이중 측정(일관성+카테고리) 24→18점 축소, 실질 노력(시리즈+전문용어+품질) 16→22점 보강
 * - 활동 신뢰도: 단기(규칙성+최근활동) 13→9점 축소, 장기(누적+운영기간) 6→11점 보강
 * - 사용자 반응: 추정값(체류시간) 5→2점 축소, 실측(댓글+공감+이웃) 15→18점 보강
 * - 콘텐츠 품질: 글자수(깊이) 5→3점 축소, 구조 3→4점, 경험정보 2→3점 보강
 * - 임계값 전면 강화: 만점 기준 상향, 중간 구간 점수 하향
 * - 체류시간 추정 공식 보수적 변경: (charCount/400)*60+img*3 → (charCount/600)*60+img*2
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

      // v15: 체류시간 추정 공식 보수적 변경 (글자수/600 + 이미지*2)
      const estimatedReadTimeSec = isScrapped
        ? Math.round((charCount / 600) * 60 + imgCount * 2)
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

  // v14: 4축 C-Rank 기준 배분 (40+25+20+15 = 100점)
  const { category: topicAuthority, topicKeywords } = analyzeTopicAuthority(posts, scrapedData, blogName, blogId)
  const contentQuality = analyzeContentQuality(posts, scrapedData, topPostsScrapedData)
  const { category: trust, frequency, recentPostDays } = analyzeTrust(posts, blogProfileData, blogAgeDays, scrapedData)
  const popularity = analyzePopularity(visitorData, engagementData, blogProfileData, recentPosts, scrapedData)
  // v14: 검색 노출력은 참고 지표로만 — 점수 합산 제외
  const searchPowerInfo = analyzeSearchPower(keywordResults, keywordCompetition, posts)

  // v10: 어뷰징 감점이 각 축에 통합되어 별도 페널티 없음
  const abusePenalty = { score: 0, details: [] as string[], flags: [] as string[] }

  // v14: 4축 합계 = 총점 (검색 노출력 제외)
  const categories = [topicAuthority, contentQuality, trust, popularity]
  const rawScore = categories.reduce((sum, c) => sum + c.score, 0)

  // v14: 노출 검증 보정 — 내부 지표 대비 검색 노출 괴리 시 참고 알림 (감점 제거)
  const exposureVerification = calculateExposureVerification(categories, searchPowerInfo, keywordResults)
  const totalScore = Math.max(0, Math.min(100, rawScore))
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

  // v9.1: 네이버 알고리즘 추정 점수 (검색 노출력 포함하여 계산)
  const allCategoriesForNaver = [...categories, searchPowerInfo]
  const diaScore = calculateDiaScore(allCategoriesForNaver)
  const crankScore = calculateCrankScore(allCategoriesForNaver)

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
 * v14: 노출 검증 (참고 지표)
 *
 * 내부 4축(전문성/활동/반응/품질)과 검색 노출 사이의 괴리를 감지하여
 * 사용자에게 알림을 표시합니다. v14부터 감점(discount)은 0 — 정보 제공만.
 */
function calculateExposureVerification(
  categories: import('./types').AnalysisCategory[],
  searchPowerInfo: import('./types').AnalysisCategory,
  keywordResults: KeywordRankResult[],
): ExposureVerification {
  const internalScore = categories.reduce((s, c) => s + c.score, 0)
  const internalMax = categories.reduce((s, c) => s + c.maxScore, 0)

  const internalRatio = internalMax > 0 ? internalScore / internalMax : 0
  const searchRatio = searchPowerInfo.maxScore > 0 ? searchPowerInfo.score / searchPowerInfo.maxScore : 0

  const internalPct = Math.round(internalRatio * 1000) / 10
  const searchPct = Math.round(searchRatio * 1000) / 10

  // 내부 점수가 낮으면 노출 부족은 당연
  if (internalRatio < 0.5) {
    return { status: 'verified', discount: 0, message: '', internalPct, searchPct }
  }

  // 키워드 미입력 — 검증 불가
  if (keywordResults.length === 0) {
    return {
      status: 'unverified',
      discount: 0,
      message: '검색 키워드가 입력되지 않아 노출을 검증할 수 없습니다. 키워드를 추가하면 현재 검색 노출 상태를 확인할 수 있습니다.',
      internalPct,
      searchPct,
    }
  }

  const gap = internalRatio - searchRatio

  // 심한 괴리: 내부 지표 >> 검색 노출
  if (gap >= 0.4) {
    return {
      status: 'unverified',
      discount: 0,
      message: `블로그 역량(${internalPct}%) 대비 실제 검색 노출(${searchPct}%)이 낮습니다. 키워드 전략과 제목 최적화를 점검해보세요.`,
      internalPct,
      searchPct,
    }
  }

  // 중간 괴리
  if (gap >= 0.25) {
    return {
      status: 'partial',
      discount: 0,
      message: `블로그 역량(${internalPct}%) 대비 검색 노출(${searchPct}%)이 다소 부족합니다. 키워드 최적화에 집중하세요.`,
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

