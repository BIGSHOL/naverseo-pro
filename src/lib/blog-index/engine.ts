/**
 * NaverSEO Pro - 블로그 지수 측정 엔진
 *
 * 5대 분석 축:
 * 1. 검색 파워 (Search Power) - 25점: 다양한 키워드에서 상위 노출 여부
 * 2. 콘텐츠 품질 (Content Quality) - 25점: 글 길이, 구조, 멀티미디어
 * 3. 주제 전문성 (Topic Authority) - 20점: 주제 집중도, 키워드 일관성
 * 4. 활동성 (Activity) - 15점: 포스팅 빈도, 꾸준함
 * 5. 영향력 (Influence) - 15점: 검색 결과 점유율, 노출 범위
 */

// ===== 타입 정의 =====

export interface BlogPost {
  title: string
  link: string
  description: string
  postdate: string // YYYYMMDD
}

export interface KeywordRankResult {
  keyword: string
  rank: number | null
  totalResults: number
}

export interface AnalysisCategory {
  name: string
  score: number
  maxScore: number
  grade: string
  details: string[]
}

export interface BlogIndexResult {
  blogUrl: string
  blogId: string | null
  totalScore: number
  level: string
  levelDescription: string
  categories: AnalysisCategory[]
  keywordResults: KeywordRankResult[]
  postAnalysis: {
    totalFound: number
    avgTitleLength: number
    avgDescLength: number
    topicKeywords: string[]
    postingFrequency: string
    recentPostDays: number | null
  }
  recommendations: string[]
  isDemo: boolean
  checkedAt: string
}

// ===== 유틸리티 =====

function extractBlogId(url: string): string | null {
  const match = url.match(
    /(?:blog\.naver\.com|m\.blog\.naver\.com)\/([a-zA-Z0-9_-]+)/
  )
  return match ? match[1] : null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim()
}

function daysBetween(date1: Date, date2: Date): number {
  return Math.floor(Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24))
}

function parsePostDate(yyyymmdd: string): Date {
  const y = parseInt(yyyymmdd.substring(0, 4))
  const m = parseInt(yyyymmdd.substring(4, 6)) - 1
  const d = parseInt(yyyymmdd.substring(6, 8))
  return new Date(y, m, d)
}

// ===== 1. 검색 파워 분석 (25점) =====

function analyzeSearchPower(keywordResults: KeywordRankResult[]): AnalysisCategory {
  const maxScore = 25
  const details: string[] = []
  let score = 0

  if (keywordResults.length === 0) {
    return { name: '검색 파워', score: 0, maxScore, grade: 'F', details: ['분석할 키워드 결과가 없습니다'] }
  }

  const ranked = keywordResults.filter((r) => r.rank !== null)
  const rankedCount = ranked.length
  const total = keywordResults.length
  const exposureRate = rankedCount / total

  // 노출률 (10점)
  const exposureScore = Math.round(exposureRate * 10)
  score += exposureScore
  details.push(`검색 노출률: ${rankedCount}/${total} (${Math.round(exposureRate * 100)}%)`)

  // 평균 순위 (8점)
  if (rankedCount > 0) {
    const avgRank = ranked.reduce((sum, r) => sum + (r.rank || 0), 0) / rankedCount
    if (avgRank <= 5) score += 8
    else if (avgRank <= 10) score += 7
    else if (avgRank <= 20) score += 5
    else if (avgRank <= 30) score += 4
    else if (avgRank <= 50) score += 3
    else score += 1
    details.push(`평균 순위: ${Math.round(avgRank)}위`)
  }

  // TOP 10 비율 (7점)
  const top10 = ranked.filter((r) => r.rank! <= 10).length
  const top10Rate = top10 / total
  score += Math.round(top10Rate * 7)
  if (top10 > 0) {
    details.push(`TOP 10 키워드: ${top10}개`)
  }

  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return { name: '검색 파워', score: Math.min(maxScore, score), maxScore, grade, details }
}

// ===== 2. 콘텐츠 품질 분석 (25점) =====

function analyzeContentQuality(posts: BlogPost[]): AnalysisCategory {
  const maxScore = 25
  const details: string[] = []
  let score = 0

  if (posts.length === 0) {
    return { name: '콘텐츠 품질', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] }
  }

  // 제목 품질 (8점)
  const avgTitleLen = posts.reduce((sum, p) => sum + stripHtml(p.title).length, 0) / posts.length
  if (avgTitleLen >= 15 && avgTitleLen <= 40) {
    score += 8
    details.push(`제목 길이 최적 (평균 ${Math.round(avgTitleLen)}자)`)
  } else if (avgTitleLen >= 10 && avgTitleLen <= 50) {
    score += 5
    details.push(`제목 길이 양호 (평균 ${Math.round(avgTitleLen)}자)`)
  } else {
    score += 2
    details.push(`제목 길이 개선 필요 (평균 ${Math.round(avgTitleLen)}자, 권장: 15~40자)`)
  }

  // 본문 미리보기 길이 (설명문 기반 추정) (8점)
  const avgDescLen = posts.reduce((sum, p) => sum + stripHtml(p.description).length, 0) / posts.length
  if (avgDescLen >= 150) {
    score += 8
    details.push(`콘텐츠 깊이 우수 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  } else if (avgDescLen >= 100) {
    score += 6
    details.push(`콘텐츠 깊이 양호 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  } else if (avgDescLen >= 50) {
    score += 3
    details.push(`콘텐츠 깊이 보통 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  } else {
    score += 1
    details.push(`콘텐츠가 너무 짧습니다 (설명문 평균 ${Math.round(avgDescLen)}자)`)
  }

  // 제목 다양성 & 키워드 활용 (5점)
  const titleWords = new Set<string>()
  posts.forEach((p) => {
    const words = stripHtml(p.title).split(/\s+/)
    words.forEach((w) => { if (w.length >= 2) titleWords.add(w) })
  })
  const diversity = titleWords.size / posts.length
  if (diversity >= 3) {
    score += 5
    details.push('제목 키워드 다양성 우수')
  } else if (diversity >= 2) {
    score += 3
    details.push('제목 키워드 다양성 양호')
  } else {
    score += 1
    details.push('제목 키워드 다양성 부족 - 더 다양한 키워드를 활용하세요')
  }

  // 설명문에 핵심 정보 포함 여부 (4점)
  const hasNumbers = posts.filter((p) => /\d+/.test(p.description)).length
  const hasListPattern = posts.filter((p) => /[①②③④⑤]|[1-9]\.|TOP|best/i.test(p.description)).length
  if (hasNumbers >= posts.length * 0.5 || hasListPattern >= posts.length * 0.3) {
    score += 4
    details.push('콘텐츠에 구체적 수치/리스트 활용 우수')
  } else if (hasNumbers >= posts.length * 0.2) {
    score += 2
    details.push('콘텐츠에 수치 활용 보통')
  }

  const grade = score >= 20 ? 'S' : score >= 15 ? 'A' : score >= 10 ? 'B' : score >= 5 ? 'C' : 'D'

  return { name: '콘텐츠 품질', score: Math.min(maxScore, score), maxScore, grade, details }
}

// ===== 3. 주제 전문성 분석 (20점) =====

function analyzeTopicAuthority(posts: BlogPost[]): { category: AnalysisCategory; topicKeywords: string[] } {
  const maxScore = 20
  const details: string[] = []
  let score = 0
  const topicKeywords: string[] = []

  if (posts.length === 0) {
    return {
      category: { name: '주제 전문성', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] },
      topicKeywords,
    }
  }

  // 모든 제목+설명에서 키워드 추출
  const wordFreq: Record<string, number> = {}
  posts.forEach((p) => {
    const text = stripHtml(p.title) + ' ' + stripHtml(p.description)
    // 한글 2글자 이상, 영문 3글자 이상 단어 추출
    const words = text.match(/[가-힣]{2,}|[a-zA-Z]{3,}/g) || []
    words.forEach((w) => {
      const lower = w.toLowerCase()
      // 불용어 제외
      const stopwords = ['그리고', '하지만', '그래서', '때문에', '입니다', '합니다', '있습니다', '됩니다', '것입니다', '블로그', '포스팅', '오늘은', '안녕하세요', 'the', 'and', 'for', 'with']
      if (!stopwords.includes(lower)) {
        wordFreq[lower] = (wordFreq[lower] || 0) + 1
      }
    })
  })

  // 상위 빈출 키워드 추출
  const sorted = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  sorted.slice(0, 5).forEach(([word]) => topicKeywords.push(word))

  // 주제 집중도 계산 (12점)
  // 상위 5개 키워드가 전체 포스트의 몇 %에 등장하는지
  if (sorted.length > 0) {
    const topKeyword = sorted[0]
    const topKeywordRate = topKeyword[1] / posts.length

    if (topKeywordRate >= 0.7) {
      score += 12
      details.push(`주제 집중도 우수: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else if (topKeywordRate >= 0.5) {
      score += 9
      details.push(`주제 집중도 양호: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else if (topKeywordRate >= 0.3) {
      score += 6
      details.push(`주제 집중도 보통: "${topKeyword[0]}" 키워드가 ${Math.round(topKeywordRate * 100)}% 포스트에 등장`)
    } else {
      score += 3
      details.push('주제가 분산되어 있습니다 - 하나의 주제에 집중하면 C-Rank 향상에 도움됩니다')
    }
  }

  // 키워드 일관성 (8점)
  // 상위 3개 키워드가 포스트 전반에 고르게 분포하는지
  if (sorted.length >= 3) {
    const top3Coverage = sorted.slice(0, 3).reduce((sum, [, count]) => sum + count, 0) / (posts.length * 3)
    if (top3Coverage >= 0.5) {
      score += 8
      details.push(`핵심 키워드 일관성 우수 (상위 3개 키워드: ${sorted.slice(0, 3).map(([w]) => w).join(', ')})`)
    } else if (top3Coverage >= 0.3) {
      score += 5
      details.push(`핵심 키워드 일관성 양호`)
    } else {
      score += 2
      details.push('핵심 키워드 일관성 부족 - 관련 키워드를 반복 활용하세요')
    }
  }

  const grade = score >= 16 ? 'S' : score >= 12 ? 'A' : score >= 8 ? 'B' : score >= 4 ? 'C' : 'D'

  return {
    category: { name: '주제 전문성', score: Math.min(maxScore, score), maxScore, grade, details },
    topicKeywords,
  }
}

// ===== 4. 활동성 분석 (15점) =====

function analyzeActivity(posts: BlogPost[]): { category: AnalysisCategory; frequency: string; recentPostDays: number | null } {
  const maxScore = 15
  const details: string[] = []
  let score = 0
  let frequency = '분석 불가'
  let recentPostDays: number | null = null

  if (posts.length === 0) {
    return {
      category: { name: '활동성', score: 0, maxScore, grade: 'F', details: ['분석할 포스트가 없습니다'] },
      frequency,
      recentPostDays,
    }
  }

  const now = new Date()

  // 포스트 날짜 파싱 및 정렬
  const dates = posts
    .map((p) => parsePostDate(p.postdate))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())

  if (dates.length === 0) {
    return {
      category: { name: '활동성', score: 2, maxScore, grade: 'D', details: ['포스트 날짜를 파싱할 수 없습니다'] },
      frequency,
      recentPostDays,
    }
  }

  // 최근 포스팅 (5점)
  recentPostDays = daysBetween(now, dates[0])
  if (recentPostDays <= 3) {
    score += 5
    details.push(`최근 포스팅: ${recentPostDays}일 전 (매우 활발)`)
  } else if (recentPostDays <= 7) {
    score += 4
    details.push(`최근 포스팅: ${recentPostDays}일 전 (활발)`)
  } else if (recentPostDays <= 14) {
    score += 3
    details.push(`최근 포스팅: ${recentPostDays}일 전 (양호)`)
  } else if (recentPostDays <= 30) {
    score += 2
    details.push(`최근 포스팅: ${recentPostDays}일 전 (보통)`)
  } else {
    score += 0
    details.push(`최근 포스팅: ${recentPostDays}일 전 (비활성)`)
  }

  // 포스팅 빈도 (6점)
  if (dates.length >= 2) {
    const totalDays = daysBetween(dates[0], dates[dates.length - 1]) || 1
    const postsPerWeek = (dates.length / totalDays) * 7

    if (postsPerWeek >= 5) {
      score += 6
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (매일)`
      details.push(`포스팅 빈도: ${frequency}`)
    } else if (postsPerWeek >= 3) {
      score += 5
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (격일)`
      details.push(`포스팅 빈도: ${frequency}`)
    } else if (postsPerWeek >= 1) {
      score += 3
      frequency = `주 ${postsPerWeek.toFixed(1)}회`
      details.push(`포스팅 빈도: ${frequency}`)
    } else {
      score += 1
      frequency = `주 ${postsPerWeek.toFixed(1)}회 (부족)`
      details.push(`포스팅 빈도: ${frequency} - 주 3회 이상을 권장합니다`)
    }
  }

  // 꾸준함 - 날짜 간격의 표준편차 (4점)
  if (dates.length >= 3) {
    const gaps: number[] = []
    for (let i = 0; i < dates.length - 1; i++) {
      gaps.push(daysBetween(dates[i], dates[i + 1]))
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length
    const variance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length
    const stdDev = Math.sqrt(variance)
    const cv = avgGap > 0 ? stdDev / avgGap : 0 // 변동계수

    if (cv < 0.5) {
      score += 4
      details.push('포스팅 주기 매우 규칙적')
    } else if (cv < 1.0) {
      score += 3
      details.push('포스팅 주기 비교적 규칙적')
    } else if (cv < 2.0) {
      score += 1
      details.push('포스팅 주기 불규칙 - 꾸준한 발행이 C-Rank에 도움됩니다')
    } else {
      details.push('포스팅 주기 매우 불규칙')
    }
  }

  const grade = score >= 12 ? 'S' : score >= 9 ? 'A' : score >= 6 ? 'B' : score >= 3 ? 'C' : 'D'

  return {
    category: { name: '활동성', score: Math.min(maxScore, score), maxScore, grade, details },
    frequency,
    recentPostDays,
  }
}

// ===== 5. 영향력 분석 (15점) =====

function analyzeInfluence(
  posts: BlogPost[],
  keywordResults: KeywordRankResult[]
): AnalysisCategory {
  const maxScore = 15
  const details: string[] = []
  let score = 0

  // 키워드 커버리지 - 얼마나 다양한 키워드에서 노출되는지 (7점)
  if (keywordResults.length > 0) {
    const ranked = keywordResults.filter((r) => r.rank !== null)
    const coverage = ranked.length / keywordResults.length

    if (coverage >= 0.7) {
      score += 7
      details.push(`키워드 커버리지 우수: ${Math.round(coverage * 100)}% 키워드에서 노출`)
    } else if (coverage >= 0.5) {
      score += 5
      details.push(`키워드 커버리지 양호: ${Math.round(coverage * 100)}% 키워드에서 노출`)
    } else if (coverage >= 0.3) {
      score += 3
      details.push(`키워드 커버리지 보통: ${Math.round(coverage * 100)}% 키워드에서 노출`)
    } else {
      score += 1
      details.push(`키워드 커버리지 부족: ${Math.round(coverage * 100)}%`)
    }
  }

  // 상위 노출 강도 - TOP10에 얼마나 많은 키워드가 있는지 (5점)
  if (keywordResults.length > 0) {
    const top10Count = keywordResults.filter((r) => r.rank !== null && r.rank <= 10).length
    if (top10Count >= 3) {
      score += 5
      details.push(`상위 노출 강도 우수: ${top10Count}개 키워드 TOP10`)
    } else if (top10Count >= 2) {
      score += 4
      details.push(`상위 노출 강도 양호: ${top10Count}개 키워드 TOP10`)
    } else if (top10Count >= 1) {
      score += 2
      details.push(`상위 노출 강도 보통: ${top10Count}개 키워드 TOP10`)
    } else {
      details.push('TOP10 노출 키워드 없음 - 경쟁이 낮은 키워드부터 공략하세요')
    }
  }

  // 검색 결과 내 콘텐츠 다양성 (3점)
  if (posts.length >= 10) {
    score += 3
    details.push(`검색 결과 콘텐츠 풍부 (${posts.length}개 발견)`)
  } else if (posts.length >= 5) {
    score += 2
    details.push(`검색 결과 콘텐츠 양호 (${posts.length}개 발견)`)
  } else if (posts.length > 0) {
    score += 1
    details.push(`검색 결과 콘텐츠 부족 (${posts.length}개 발견)`)
  }

  const grade = score >= 12 ? 'S' : score >= 9 ? 'A' : score >= 6 ? 'B' : score >= 3 ? 'C' : 'D'

  return { name: '영향력', score: Math.min(maxScore, score), maxScore, grade, details }
}

// ===== 등급 및 추천 =====

function determineLevelInfo(totalScore: number): { level: string; description: string } {
  if (totalScore >= 85) return { level: '최적화', description: '네이버 검색에 최적화된 파워 블로그입니다' }
  if (totalScore >= 70) return { level: '우수', description: '높은 검색 노출력을 보유하고 있습니다' }
  if (totalScore >= 55) return { level: '양호', description: '성장 잠재력이 높은 블로그입니다' }
  if (totalScore >= 40) return { level: '보통', description: '기본기가 갖춰져 있으나 개선이 필요합니다' }
  if (totalScore >= 25) return { level: '성장 중', description: '꾸준한 노력으로 지수를 올릴 수 있습니다' }
  return { level: '입문', description: '기초부터 차근차근 블로그를 키워보세요' }
}

function generateRecommendations(categories: AnalysisCategory[]): string[] {
  const recommendations: string[] = []

  for (const cat of categories) {
    const pct = cat.score / cat.maxScore
    if (pct < 0.4) {
      switch (cat.name) {
        case '검색 파워':
          recommendations.push('경쟁이 낮은 롱테일 키워드부터 공략하여 상위 노출 경험을 쌓으세요')
          recommendations.push('제목에 검색 키워드를 자연스럽게 포함하세요')
          break
        case '콘텐츠 품질':
          recommendations.push('글 길이를 1,500~2,000자로 늘리고, 소제목(H2, H3)으로 구조화하세요')
          recommendations.push('원본 이미지와 구체적인 수치를 활용하세요')
          break
        case '주제 전문성':
          recommendations.push('하나의 주제 카테고리에 집중하여 C-Rank를 높이세요')
          recommendations.push('관련 키워드를 꾸준히 반복 활용하세요')
          break
        case '활동성':
          recommendations.push('최소 주 3회 이상 꾸준히 포스팅하세요')
          recommendations.push('매일 같은 시간대에 발행하면 규칙성 점수가 올라갑니다')
          break
        case '영향력':
          recommendations.push('이웃과의 소통(댓글, 공감)을 적극적으로 늘리세요')
          recommendations.push('공유하고 싶은 실용적 정보를 제공하여 자연스러운 확산을 유도하세요')
          break
      }
    }
  }

  // 우선순위가 낮은 영역이 없으면 일반적 가이드
  if (recommendations.length === 0) {
    recommendations.push('현재 전략을 유지하면서 경쟁이 높은 키워드도 공략해보세요')
    recommendations.push('콘텐츠의 최신성을 유지하고, 기존 글도 주기적으로 업데이트하세요')
  }

  return recommendations.slice(0, 5) // 최대 5개
}

// ===== 메인 분석 함수 =====

export function analyzeBlogIndex(
  blogUrl: string,
  posts: BlogPost[],
  keywordResults: KeywordRankResult[],
  isDemo: boolean
): BlogIndexResult {
  const blogId = extractBlogId(blogUrl)

  // 5대 분석 실행
  const searchPower = analyzeSearchPower(keywordResults)
  const contentQuality = analyzeContentQuality(posts)
  const { category: topicAuthority, topicKeywords } = analyzeTopicAuthority(posts)
  const { category: activity, frequency, recentPostDays } = analyzeActivity(posts)
  const influence = analyzeInfluence(posts, keywordResults)

  const categories = [searchPower, contentQuality, topicAuthority, activity, influence]
  const totalScore = categories.reduce((sum, c) => sum + c.score, 0)
  const { level, description } = determineLevelInfo(totalScore)
  const recommendations = generateRecommendations(categories)

  // 포스트 분석 요약
  const avgTitleLength = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + stripHtml(p.title).length, 0) / posts.length)
    : 0
  const avgDescLength = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + stripHtml(p.description).length, 0) / posts.length)
    : 0

  return {
    blogUrl,
    blogId,
    totalScore,
    level,
    levelDescription: description,
    categories,
    keywordResults,
    postAnalysis: {
      totalFound: posts.length,
      avgTitleLength,
      avgDescLength,
      topicKeywords,
      postingFrequency: frequency,
      recentPostDays,
    },
    recommendations,
    isDemo,
    checkedAt: new Date().toISOString(),
  }
}

// ===== 데모 데이터 생성 =====

export function generateDemoPosts(blogId: string): BlogPost[] {
  const topics = ['맛집', '여행', '카페', '다이어트', '인테리어', '독서', '자기계발', '헬스']
  const mainTopic = topics[Math.floor(Math.random() * 3)] // 주제 집중도를 위해 상위 3개에서 주로 선택
  const now = new Date()

  return Array.from({ length: 15 }, (_, i) => {
    const daysAgo = Math.floor(Math.random() * 60) + i * 3
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    const topic = Math.random() > 0.3 ? mainTopic : topics[Math.floor(Math.random() * topics.length)]
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`

    return {
      title: `${topic} ${['추천', '후기', '리뷰', '정보', '가이드'][Math.floor(Math.random() * 5)]} - ${['초보자용', '실전', '최신', '2025년'][Math.floor(Math.random() * 4)]} ${['완벽 정리', '총정리', 'BEST', '꿀팁'][Math.floor(Math.random() * 4)]}`,
      link: `https://blog.naver.com/${blogId}/${100000000 + i}`,
      description: `${topic}에 대한 상세한 정보를 정리했습니다. ${Math.random() > 0.5 ? '가격 비교와 ' : ''}${Math.random() > 0.5 ? '실제 후기를 포함하여 ' : ''}꼼꼼하게 분석한 글입니다. ${topic} 관련 핵심 정보 ${Math.floor(Math.random() * 10) + 3}가지를 소개합니다. 실제 경험을 바탕으로 작성했으며, 초보자도 쉽게 따라할 수 있도록 단계별로 설명합니다.`,
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
