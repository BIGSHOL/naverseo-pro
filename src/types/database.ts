export type Plan = 'free' | 'lite' | 'starter' | 'pro' | 'business' | 'agency' | 'admin'
export type UserRole = 'user' | 'admin'
export type ContentStatus = 'draft' | 'published' | 'archived'
export type SearchSection = 'blog' | 'smartblock' | 'view'

export interface Profile {
  id: string
  email: string
  plan: Plan
  role: UserRole
  // 통합 크레딧 시스템
  credits_balance: number
  credits_monthly_quota: number
  credits_reset_at: string
  // 추천인 시스템
  referral_code: string
  referred_by: string | null
  // DEPRECATED (마이그레이션 기간 유지)
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

// ─── 추천인 & 프로모 코드 시스템 ───

export interface PromoCode {
  id: string
  code: string
  description: string | null
  reward_type: 'credits' | 'plan_upgrade'
  bonus_credits: number
  upgrade_plan: Plan | null
  upgrade_days: number
  max_uses: number | null
  current_uses: number
  expires_at: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PromoRedemption {
  id: string
  user_id: string
  promo_code_id: string
  reward_type: string
  bonus_credits: number
  upgrade_plan: string | null
  created_at: string
}

export interface ReferralReward {
  id: string
  referrer_id: string
  referee_id: string
  referrer_credits: number
  referee_credits: number
  status: 'completed' | 'reverted'
  created_at: string
}

export interface ReferralConfig {
  referrer_credits: number
  referee_credits: number
  enabled: boolean
}

// ─── 크레딧 시스템 상수 ───

/** 기능별 크레딧 소모량 */
export const CREDIT_COSTS = {
  keyword_research: 1,       // 키워드 리서치
  keyword_discovery: 3,      // 키워드 발굴
  content_generation: 5,     // AI 콘텐츠 생성
  seo_check: 2,              // SEO 점수 체크
  competitor_analysis: 3,    // 상위노출 분석
  blog_index: 3,             // 블로그 지수 분석
  tracking_per_keyword: 1,   // 순위 트래킹 (키워드당)
  seo_report: 2,             // SEO 리포트 생성
  content_improve: 3,        // 콘텐츠 개선
} as const

export type CreditFeature = keyof typeof CREDIT_COSTS

/** 기능별 한국어 이름 */
export const CREDIT_FEATURE_LABELS: Record<CreditFeature, string> = {
  keyword_research: '키워드 리서치',
  keyword_discovery: '키워드 발굴',
  content_generation: 'AI 콘텐츠 생성',
  seo_check: 'SEO 점수 체크',
  competitor_analysis: '상위노출 분석',
  blog_index: '블로그 지수 분석',
  tracking_per_keyword: '순위 트래킹',
  seo_report: 'SEO 리포트',
  content_improve: '콘텐츠 개선',
}

/** 플랜별 월간 크레딧 */
export const PLAN_CREDITS: Record<Plan, number> = {
  free: 30,
  lite: 100,
  starter: 400,
  pro: 750,
  business: 1700,
  agency: 3000,
  admin: 999999,
}

/**
 * 플랜별 기능 게이트
 * Free (3기능): 키워드 리서치, SEO 점수 체크, 블로그 지수 분석
 * Lite (5기능): Free + AI 콘텐츠 생성, SEO 리포트
 * Starter 이상: 모든 기능 사용 가능
 */
export const FREE_ALLOWED_FEATURES: CreditFeature[] = [
  'keyword_research',
  'seo_check',
  'blog_index',
]

export const LITE_ALLOWED_FEATURES: CreditFeature[] = [
  ...FREE_ALLOWED_FEATURES,
  'content_generation',
  'seo_report',
]

/** 플랜별 템플릿 저장 개수 제한 */
export const PLAN_TEMPLATE_LIMITS: Record<Plan, number> = {
  free: 1,
  lite: 3,
  starter: 10,
  pro: 30,
  business: 50,
  agency: Infinity,
  admin: Infinity,
}

// ─── 플랜 정보 ───

export interface PlanInfo {
  name: string
  price: number
  priceLabel: string
  credits: number
  aiModel: string
  features: string[]
  popular?: boolean
}

export const PLANS: Record<Plan, PlanInfo> = {
  free: {
    name: 'Free',
    price: 0,
    priceLabel: '₩0',
    credits: 30,
    aiModel: '기본 AI',
    features: [
      '월 30 크레딧',
      '키워드 리서치 (~30회)',
      'SEO 점수 체크 (~15회)',
      '블로그 지수 분석 (~10회)',
    ],
  },
  lite: {
    name: 'Lite',
    price: 9900,
    priceLabel: '₩9,900',
    credits: 100,
    aiModel: '프리미엄 AI',
    features: [
      '월 100 크레딧',
      'Free 3가지 기능 포함',
      '+ AI 콘텐츠 생성',
      '+ SEO 리포트',
      '프리미엄 AI 모델',
    ],
  },
  starter: {
    name: 'Starter',
    price: 29900,
    priceLabel: '₩29,900',
    credits: 400,
    aiModel: '프리미엄 AI',
    features: [
      '월 400 크레딧 (~25% 할인)',
      '모든 기능 사용 가능',
      '키워드 발굴 · 상위노출 분석',
      '순위 트래킹 · 콘텐츠 개선',
      '프리미엄 AI 모델',
    ],
  },
  pro: {
    name: 'Pro',
    price: 49900,
    priceLabel: '₩49,900',
    credits: 750,
    aiModel: '프리미엄 AI',
    popular: true,
    features: [
      '월 750 크레딧 (~33% 할인)',
      '모든 기능 사용 가능',
      'AI 콘텐츠 ~150편/월',
      '대량 키워드 발굴·분석',
      '우선 지원',
    ],
  },
  business: {
    name: 'Business',
    price: 99900,
    priceLabel: '₩99,900',
    credits: 1700,
    aiModel: '프리미엄 AI',
    features: [
      '월 1,700 크레딧 (~41% 할인)',
      '모든 기능 사용 가능',
      'AI 콘텐츠 ~340편/월',
      '대규모 순위 트래킹',
      '전담 매니저 지원',
    ],
  },
  agency: {
    name: 'Agency',
    price: 149900,
    priceLabel: '₩149,900',
    credits: 3000,
    aiModel: '프리미엄 AI',
    features: [
      '월 3,000 크레딧 (~50% 할인)',
      '모든 기능 사용 가능',
      'AI 콘텐츠 ~600편/월',
      '전담 매니저 지원',
      'API 접근',
    ],
  },
  admin: {
    name: 'Admin',
    price: 0,
    priceLabel: '-',
    credits: 999999,
    aiModel: '프리미엄 AI',
    features: ['모든 기능 무제한', '관리자 대시보드', '사용자 관리'],
  },
}
