export type Plan = 'free' | 'starter' | 'pro' | 'agency' | 'admin'
export type UserRole = 'user' | 'admin'
export type ContentStatus = 'draft' | 'published' | 'archived'
export type SearchSection = 'blog' | 'smartblock' | 'view'

export interface Profile {
  id: string
  email: string
  plan: Plan
  role: UserRole
  keywords_used_this_month: number
  content_generated_this_month: number
  analysis_used_today: number
  analysis_reset_date: string
  created_at: string
  updated_at: string
}

export interface KeywordResult {
  keyword: string
  monthlyPcQcCnt: number
  monthlyMobileQcCnt: number
  monthlyAvePcClkCnt: number
  monthlyAveMobileClkCnt: number
  compIdx: string
  plAvgDepth: number
  score?: number
}

export interface KeywordResearch {
  id: string
  user_id: string
  seed_keyword: string
  results: {
    keywords: KeywordResult[]
  }
  created_at: string
}

export interface GeneratedContent {
  id: string
  user_id: string
  target_keyword: string
  title: string
  content: string
  seo_score: number | null
  seo_feedback: Record<string, unknown> | null
  status: ContentStatus
  created_at: string
  updated_at: string
}

export interface RankTracking {
  id: string
  user_id: string
  keyword: string
  blog_url: string
  rank_position: number | null
  section: SearchSection | null
  checked_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  blog_url: string | null
  naver_blog_id: string | null
  created_at: string
}

export interface WaitlistEntry {
  id: string
  email: string
  created_at: string
}

// 가격 정보 타입
export interface PlanInfo {
  name: string
  price: number
  priceLabel: string
  keywords: string
  content: string
  tracking: string
  analysis: string
  aiModel: string          // AI 모델 표시명
  features: string[]
  popular?: boolean
}

export const PLANS: Record<Plan, PlanInfo> = {
  free: {
    name: 'Free',
    price: 0,
    priceLabel: '₩0',
    keywords: '10회/월',
    content: '3편/월',
    tracking: 'X',
    analysis: '3회/일',
    aiModel: '기본 AI',
    features: ['키워드 검색량 조회 10회/월', 'AI 콘텐츠 생성 3편/월', 'SEO 점수 체크', '블로그 분석 3회/일'],
  },
  starter: {
    name: 'Starter',
    price: 29000,
    priceLabel: '₩29,000',
    keywords: '50회/월',
    content: '10편/월',
    tracking: '키워드 5개',
    analysis: '10회/일',
    aiModel: '프리미엄 AI',
    popular: false,
    features: ['키워드 검색량 조회 50회/월', 'AI 콘텐츠 생성 10편/월', '순위 트래킹 5개 키워드', 'SEO 점수 체크', '블로그 분석 10회/일', '더 강력한 AI 분석·생성'],
  },
  pro: {
    name: 'Pro',
    price: 59000,
    priceLabel: '₩59,000',
    keywords: '무제한',
    content: '50편/월',
    tracking: '키워드 30개',
    analysis: '무제한',
    aiModel: '프리미엄 AI',
    popular: true,
    features: ['키워드 검색량 무제한 조회', 'AI 콘텐츠 생성 50편/월', '순위 트래킹 30개 키워드', 'SEO 점수 체크', '블로그 분석 무제한', '더 강력한 AI 분석·생성', '우선 지원'],
  },
  agency: {
    name: 'Agency',
    price: 149000,
    priceLabel: '₩149,000',
    keywords: '무제한',
    content: '200편/월',
    tracking: '키워드 100개',
    analysis: '무제한',
    aiModel: '프리미엄 AI',
    features: ['키워드 검색량 무제한 조회', 'AI 콘텐츠 생성 200편/월', '순위 트래킹 100개 키워드', 'SEO 점수 체크', '블로그 분석 무제한', '더 강력한 AI 분석·생성', '전담 매니저 지원', 'API 접근'],
  },
  admin: {
    name: 'Admin',
    price: 0,
    priceLabel: '-',
    keywords: '무제한',
    content: '무제한',
    tracking: '무제한',
    analysis: '무제한',
    aiModel: '프리미엄 AI',
    features: ['모든 기능 무제한', '관리자 대시보드', '사용자 관리'],
  },
}
