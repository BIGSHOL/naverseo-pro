/**
 * NaverSEO Pro - 블로그 지수 측정 엔진 v3
 *
 * 기술 문서 기반 개선 (네이버_블로그_지수_산출_기술_분석.md 참조)
 *
 * 가중치 모델: S_total = α(C_rank) + β(D_dia) + γ(Search) + δ(Activity) - P(Abuse)
 * 현실 적용: 콘텐츠(0.30) + 주제(0.25) + 검색(0.30) + 활동(0.15) - 어뷰징
 *
 * 4대 분석 축 + 어뷰징 페널티:
 * 1. 콘텐츠 품질 (D.I.A. proxy) - 30점: 글 구조, 이미지 분석, 텍스트 품질, 키워드 밀도
 * 2. 주제 전문성 (C-Rank proxy) - 25점: 주제 집중도, 키워드 일관성, 연관어 분석
 * 3. 검색 파워 - 30점: 키워드 순위, 노출 범위, TOP10, 경쟁 키워드 가치
 * 4. 활동성 - 15점: 포스팅 빈도, 규칙성, 최근성, 방문자 추세
 * P. 어뷰징 감점 - 최대 -20점: 키워드 과다 반복, 제목 유사도, 패턴 의심
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
} from './types'

// 서브 모듈 함수 import
import { analyzeContentQuality } from './analyzers/content-quality'
import { analyzeTopicAuthority } from './analyzers/topic-authority'
import { analyzeSearchPower } from './analyzers/search-power'
import { analyzeActivity } from './analyzers/activity'
import { analyzeAbuse } from './analyzers/abuse'
import { determineLevelInfo, generateRecommendations } from './grading'
import { scorePost } from './scoring'

// public re-export
export { determineLevelInfo } from './grading'
export { generateDemoPosts, generateDemoKeywordResults, generateDemoKeywordCompetition, generateDemoVisitorData } from './demo'

import type {
  BlogPost,
  KeywordRankResult,
  KeywordCompetitionData,
  VisitorData,
  PostDetail,
  BlogProfile,
  BenchmarkData,
  BlogIndexResult,
} from './types'

// ===== 메인 분석 함수 =====

export function analyzeBlogIndex(
  blogUrl: string,
  posts: BlogPost[],
  keywordResults: KeywordRankResult[],
  isDemo: boolean,
  blogName?: string | null,
  keywordCompetition?: KeywordCompetitionData[],
  visitorData?: VisitorData | null
): BlogIndexResult {
  const blogId = extractBlogId(blogUrl)
  const now = new Date()

  // 4대 분석 축 + 어뷰징 페널티 실행
  const contentQuality = analyzeContentQuality(posts)        // 30점
  const { category: topicAuthority, topicKeywords } = analyzeTopicAuthority(posts)  // 25점
  const searchPower = analyzeSearchPower(keywordResults, keywordCompetition)  // 30점
  const { category: activity, frequency, recentPostDays } = analyzeActivity(posts, visitorData)  // 15점
  const abusePenalty = analyzeAbuse(posts)                   // -20점 max

  const categories = [contentQuality, topicAuthority, searchPower, activity]
  const rawScore = categories.reduce((sum, c) => sum + c.score, 0)
  const totalScore = Math.max(0, Math.min(100, rawScore + abusePenalty.score))  // 0~100 범위
  const level = determineLevelInfo(totalScore)
  const recommendations = generateRecommendations(categories, abusePenalty)

  // 포스트 분석 요약
  const avgTitleLength = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + stripHtml(p.title).length, 0) / posts.length)
    : 0
  const avgDescLength = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + stripHtml(p.description).length, 0) / posts.length)
    : 0
  const avgImageCount = posts.length > 0
    ? Math.round((posts.reduce((s, p) => s + countImageMarkers(p.description), 0) / posts.length) * 10) / 10
    : 0

  // 개별 포스트 상세 데이터 생성 (v2: 이미지 개수 + 개선된 scorePost)
  const recentPosts: PostDetail[] = posts
    .map((p) => {
      const cleanTitle = stripHtml(p.title)
      const cleanDesc = stripHtml(p.description)
      const postDate = parsePostDate(p.postdate)
      const daysAgo = !isNaN(postDate.getTime()) ? daysBetween(now, postDate) : -1
      const dateStr = !isNaN(postDate.getTime())
        ? `${postDate.getFullYear()}.${String(postDate.getMonth() + 1).padStart(2, '0')}.${String(postDate.getDate()).padStart(2, '0')}`
        : '날짜 없음'
      const imgCount = countImageMarkers(p.description)
      const hasImage = imgCount > 0
      const quality = scorePost(cleanTitle, p.description, cleanDesc.length, imgCount)
      return {
        title: cleanTitle,
        link: p.link,
        daysAgo,
        date: dateStr,
        charCount: cleanDesc.length,
        hasImage,
        imageCount: imgCount,
        titleLength: cleanTitle.length,
        quality,
      }
    })
    .filter((p) => p.daysAgo >= 0)
    .sort((a, b) => a.daysAgo - b.daysAgo)
    .slice(0, 20)

  // 블로그 프로필 생성
  const sortedDates = posts
    .map((p) => parsePostDate(p.postdate))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  const estimatedStartDate = sortedDates.length > 0
    ? `${sortedDates[0].getFullYear()}.${String(sortedDates[0].getMonth() + 1).padStart(2, '0')}.${String(sortedDates[0].getDate()).padStart(2, '0')}`
    : null

  const blogAgeDays = sortedDates.length > 0 ? daysBetween(now, sortedDates[0]) : null

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

  // 키워드 밀도 계산 (v2 추가)
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
  }

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
    },
    recentPosts,
    blogProfile,
    benchmark,
    recommendations,
    isDemo,
    checkedAt: new Date().toISOString(),
  }
}
