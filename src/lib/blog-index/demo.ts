/**
 * 블로그 지수 - 데모 데이터 생성 (v4 확장)
 */

import type { BlogPost, KeywordRankResult, KeywordCompetitionData, VisitorData, BlogProfileData, EngagementData } from './types'
import type { ScrapedPostData } from '@/lib/naver/blog-scraper'

export function generateDemoPosts(blogId: string): BlogPost[] {
  const topics = ['맛집', '여행', '카페', '다이어트', '인테리어', '독서', '자기계발', '헬스']
  const mainTopic = topics[Math.floor(Math.random() * 3)] // 주제 집중도를 위해 상위 3개에서 주로 선택
  const now = new Date()

  return Array.from({ length: 15 }, (_, i) => {
    const daysAgo = Math.floor(Math.random() * 60) + i * 3
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    const topic = Math.random() > 0.3 ? mainTopic : topics[Math.floor(Math.random() * topics.length)]
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const imgCount = Math.floor(Math.random() * 4) + 1
    const imgTags = Array.from({ length: imgCount }, () => '<img src="demo.jpg" />').join(' ')

    return {
      title: `${topic} ${['추천', '후기', '리뷰', '정보', '가이드'][Math.floor(Math.random() * 5)]} - ${['초보자용', '실전', '최신', '2025년'][Math.floor(Math.random() * 4)]} ${['완벽 정리', '총정리', 'BEST', '꿀팁'][Math.floor(Math.random() * 4)]}`,
      link: `https://blog.naver.com/${blogId}/${100000000 + i}`,
      description: `${topic}에 대한 상세한 정보를 정리했습니다. ${imgTags} ${Math.random() > 0.5 ? '가격 비교와 ' : ''}${Math.random() > 0.5 ? '실제 후기를 포함하여 ' : ''}꼼꼼하게 분석한 글입니다. ${topic} 관련 핵심 정보 ${Math.floor(Math.random() * 10) + 3}가지를 소개합니다. 실제 경험을 바탕으로 작성했으며, 초보자도 쉽게 따라할 수 있도록 단계별로 설명합니다.${Math.random() > 0.5 ? ` 평균 가격은 ${Math.floor(Math.random() * 50 + 10) * 1000}원입니다.` : ''}`,
      postdate: dateStr,
    }
  })
}

export function generateDemoKeywordResults(keywords: string[]): KeywordRankResult[] {
  return keywords.map((keyword) => {
    const rand = Math.random()
    let rank: number | null
    if (rand < 0.25) rank = null
    else if (rand < 0.45) rank = Math.floor(Math.random() * 50) + 51
    else if (rand < 0.7) rank = Math.floor(Math.random() * 40) + 11
    else rank = Math.floor(Math.random() * 10) + 1
    return { keyword, rank, totalResults: Math.floor(Math.random() * 100000) + 10000 }
  })
}

/** 데모용 키워드 경쟁도 데이터 생성 */
export function generateDemoKeywordCompetition(keywords: string[]): KeywordCompetitionData[] {
  const compOptions: string[] = ['HIGH', 'MEDIUM', 'LOW']
  return keywords.map((keyword) => ({
    keyword,
    compIdx: compOptions[Math.floor(Math.random() * compOptions.length)],
    searchVolume: Math.floor(Math.random() * 50000) + 500,
  }))
}

/** 데모용 방문자 데이터 생성 */
export function generateDemoVisitorData(): VisitorData {
  const days = 30
  const baseVisitors = Math.floor(Math.random() * 300) + 50
  const dailyVisitors = Array.from({ length: days }, () =>
    Math.max(0, baseVisitors + Math.floor(Math.random() * 100) - 50)
  )
  const avg = Math.round(dailyVisitors.reduce((s, v) => s + v, 0) / dailyVisitors.length)
  return { dailyVisitors, avgDailyVisitors: avg, isAvailable: true }
}

/** 데모용 블로그 프로필 데이터 생성 (v4 신규) */
export function generateDemoBlogProfileData(): BlogProfileData {
  const blogAgeDays = Math.floor(Math.random() * 1500) + 180  // 6개월 ~ 5년
  const startDate = new Date(Date.now() - blogAgeDays * 24 * 60 * 60 * 1000)
  const blogStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`

  return {
    totalPostCount: Math.floor(Math.random() * 400) + 30,
    blogStartDate,
    blogAgeDays,
  }
}

/** 데모용 인기도 데이터 생성 (v4 신규) */
export function generateDemoEngagementData(): EngagementData {
  return {
    avgCommentCount: Math.round((Math.random() * 15 + 1) * 10) / 10,
    avgSympathyCount: Math.round((Math.random() * 25 + 2) * 10) / 10,
    isAvailable: true,
  }
}

/** 데모용 스크래핑 데이터 생성 (댓글/공감 포함, v4 신규) */
export function generateDemoScrapedData(posts: BlogPost[]): Map<string, ScrapedPostData> {
  const map = new Map<string, ScrapedPostData>()
  posts.forEach(p => {
    map.set(p.link, {
      charCount: Math.floor(Math.random() * 2000) + 500,
      imageCount: Math.floor(Math.random() * 5) + 1,
      videoCount: Math.random() > 0.7 ? 1 : 0,
      linkCount: Math.floor(Math.random() * 4),
      tableCount: Math.random() > 0.8 ? 1 : 0,
      hasImage: true,
      imageUrls: [],
      isScrapped: true,
      commentCount: Math.floor(Math.random() * 20),
      sympathyCount: Math.floor(Math.random() * 40),
      readCount: Math.floor(Math.random() * 500) + 50,
    })
  })
  return map
}
