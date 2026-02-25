/**
 * NaverSEO Pro - 블로그 지수 측정 엔진 v4
 *
 * v4 점수 체계 전면 개편: "실제로 잘 운영되고 있나" 기준
 *
 * 4대 분석 축 + 어뷰징 페널티:
 * 1. 검색 성과 (구: 검색 파워) - 25점: 키워드 순위, 노출 범위, TOP10, 경쟁 키워드 가치
 * 2. 방문자 & 인기도 (신규) - 25점: 일평균 방문자, 평균 댓글, 평균 공감
 * 3. 콘텐츠 경쟁력 (구: 품질+주제) - 20점: 콘텐츠 품질(10) + 주제 전문성(10)
 * 4. 활동 & 신뢰도 (구: 활동성) - 30점: 빈도, 규칙성, 최근성, 블로그 연차, 누적 포스팅
 * P. 어뷰징 감점 - 최대 -20점
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
import { analyzeTopicAuthority } from './analyzers/topic-authority'
import { analyzeSearchPower } from './analyzers/search-power'
import { analyzeActivity } from './analyzers/activity'
import { analyzePopularity } from './analyzers/popularity'
import { analyzeAbuse } from './analyzers/abuse'
import { determineLevelInfo, generateRecommendations } from './grading'
import { scorePost } from './scoring'

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
  blogProfileData?: BlogProfileData | null
): BlogIndexResult {
  const blogId = extractBlogId(blogUrl)
  const now = new Date()

  // 인기도 데이터 집계 (scrapedData에서 댓글/공감 추출)
  const engagementData = aggregateEngagementData(scrapedData)

  // 4대 분석 축 + 어뷰징 페널티 실행
  const searchPerformance = analyzeSearchPower(keywordResults, keywordCompetition)  // 25점
  const popularity = analyzePopularity(visitorData, engagementData)                 // 25점 (신규)
  const contentQuality = analyzeContentQuality(posts, scrapedData)                  // 10점
  const { category: topicAuthority, topicKeywords } = analyzeTopicAuthority(posts)  // 10점
  const { category: activity, frequency, recentPostDays } = analyzeActivity(posts, blogProfileData)  // 30점
  const abusePenalty = analyzeAbuse(posts)                                          // -20점 max

  // 콘텐츠 품질(10) + 주제 전문성(10) = 콘텐츠 경쟁력(20)
  const contentCompetitiveness = {
    name: '콘텐츠 경쟁력',
    score: contentQuality.score + topicAuthority.score,
    maxScore: 20,
    grade: '',
    details: [...contentQuality.details, ...topicAuthority.details],
  }
  const ccPct = contentCompetitiveness.score / contentCompetitiveness.maxScore
  contentCompetitiveness.grade = ccPct >= 0.8 ? 'S' : ccPct >= 0.6 ? 'A' : ccPct >= 0.4 ? 'B' : ccPct >= 0.2 ? 'C' : 'D'

  const categories = [searchPerformance, popularity, contentCompetitiveness, activity]
  const rawScore = categories.reduce((sum, c) => sum + c.score, 0)
  const totalScore = Math.max(0, Math.min(100, rawScore + abusePenalty.score))  // 0~100 범위
  const level = determineLevelInfo(totalScore)

  // 포스트 분석 요약
  const avgTitleLength = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + stripHtml(p.title).length, 0) / posts.length)
    : 0

  // 개별 포스트 상세 데이터 생성 (v4: 댓글/공감 포함)
  const recentPosts: PostDetail[] = posts
    .map((p) => {
      const cleanTitle = stripHtml(p.title)
      const cleanDesc = stripHtml(p.description)
      const postDate = parsePostDate(p.postdate)
      const daysAgo = !isNaN(postDate.getTime()) ? daysBetween(now, postDate) : -1
      const dateStr = !isNaN(postDate.getTime())
        ? `${postDate.getFullYear()}.${String(postDate.getMonth() + 1).padStart(2, '0')}.${String(postDate.getDate()).padStart(2, '0')}`
        : '날짜 없음'

      // 스크래핑 데이터 우선 사용, 없으면 description 기반 폴백
      const scraped = scrapedData?.get(p.link) ?? null
      const charCount = scraped ? scraped.charCount : cleanDesc.length
      const imgCount = scraped ? scraped.imageCount : countImageMarkers(p.description)
      const hasImage = imgCount > 0
      const isScrapped = scraped !== null
      const commentCount = scraped?.commentCount ?? null
      const sympathyCount = scraped?.sympathyCount ?? null
      const quality = scorePost(cleanTitle, p.description, charCount, imgCount, isScrapped, commentCount, sympathyCount)

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
      }
    })
    .filter((p) => p.daysAgo >= 0)
    .sort((a, b) => a.daysAgo - b.daysAgo)
    .slice(0, 20)

  const avgDescLength = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + stripHtml(p.description).length, 0) / posts.length)
    : 0
  const avgImageCount = posts.length > 0
    ? Math.round((posts.reduce((s, p) => s + countImageMarkers(p.description), 0) / posts.length) * 10) / 10
    : 0

  // 블로그 프로필 생성
  const sortedDates = posts
    .map((p) => parsePostDate(p.postdate))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  const estimatedStartDate = sortedDates.length > 0
    ? `${sortedDates[0].getFullYear()}.${String(sortedDates[0].getMonth() + 1).padStart(2, '0')}.${String(sortedDates[0].getDate()).padStart(2, '0')}`
    : null

  const blogAgeDays = blogProfileData?.blogAgeDays
    ?? (sortedDates.length > 0 ? daysBetween(now, sortedDates[0]) : null)

  let postsPerWeek: number | null = null
  if (sortedDates.length >= 2) {
    const spanDays = daysBetween(sortedDates[sortedDates.length - 1], sortedDates[0]) || 1
    postsPerWeek = Math.round((sortedDates.length / spanDays) * 7 * 10) / 10
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

  // 전체 상위 X% 추정
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

  const benchmark: BenchmarkData = {
    postingFrequency: {
      mine: postsPerWeek || 0,
      recommended: 3,
      topBlogger: 5,
    },
    avgTitleLength: { mine: avgTitleLength, optimal: 25 },
    avgContentLength: { mine: avgDescLength, recommended: 150 },
    imageRate: { mine: imageRate, recommended: 80 },
    topicFocus: { mine: topicFocusPct, recommended: 60 },
    keywordDensity: { mine: keywordDensity, optimal: [0.5, 3.0] },
    avgImageCount: { mine: avgImageCount, recommended: 3 },
    optimizationPct,
    categoryPercentile,
    // v4 신규 벤치마크 항목
    avgCommentCount: {
      mine: engagementData?.avgCommentCount ?? 0,
      recommended: 5,
    },
    avgSympathyCount: {
      mine: engagementData?.avgSympathyCount ?? 0,
      recommended: 10,
    },
    dailyVisitors: {
      mine: visitorData?.isAvailable ? visitorData.avgDailyVisitors : 0,
      recommended: 200,
      topBlogger: 1000,
    },
    blogAge: {
      mine: blogAgeDays ?? 0,
      recommended: 365,
    },
    totalPostCount: {
      mine: blogProfileData?.totalPostCount ?? posts.length,
      recommended: 100,
    },
  }

  // 벤치마크/포스트 데이터를 활용한 구체적 추천 생성
  const recommendations = generateRecommendations(categories, abusePenalty, {
    benchmark,
    level,
    totalScore,
    recentPosts,
    blogProfile,
  })

  return {
    blogUrl,
    blogId,
    totalScore,
    level,
    categories,
    abusePenalty,
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
    },
    recentPosts,
    blogProfile,
    benchmark,
    recommendations,
    isDemo,
    checkedAt: new Date().toISOString(),
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
