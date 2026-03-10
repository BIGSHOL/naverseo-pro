'use client'

import { useEffect, useState } from 'react'
import { Info, Sparkles, AlertTriangle, FileText, Globe, TrendingUp, type LucideIcon } from 'lucide-react'
import { useUserProfile } from '@/contexts/user-profile'

export interface Notification {
  icon: LucideIcon
  title: string
  message: string
  time: string
  actionable: boolean
  href?: string
}

function buildNotifications(data: {
  profile?: { credits_balance?: number; credits_monthly_quota?: number }
  blogProfile?: { blogUrl: string } | null
  contentStats?: { draft: number; avgSeoScore: number; total: number }
  dailyActivity?: { date: string; keywords: number; content: number }[]
}): Notification[] {
  const notifications: Notification[] = []

  // 1. 크레딧 한도 임박 (잔여 20% 이하)
  const balance = data.profile?.credits_balance ?? 0
  const quota = data.profile?.credits_monthly_quota ?? 30
  if (quota > 0 && balance / quota <= 0.2) {
    notifications.push({
      icon: AlertTriangle,
      title: balance === 0 ? '크레딧 소진' : '크레딧 부족',
      message: balance === 0
        ? '크레딧을 모두 사용했습니다. 플랜 업그레이드를 고려해보세요.'
        : `크레딧이 ${balance}/${quota} 남았습니다. 플랜 업그레이드를 고려해보세요.`,
      time: '사용량',
      actionable: true,
      href: '/settings',
    })
  }

  // 2. 작성완료 콘텐츠 알림
  if (data.contentStats && data.contentStats.draft > 0) {
    notifications.push({
      icon: FileText,
      title: '작성완료 콘텐츠 확인',
      message: `작성완료 상태의 콘텐츠가 ${data.contentStats.draft}개 있습니다. SEO 체크 후 복사해보세요!`,
      time: '콘텐츠',
      actionable: true,
      href: '/content',
    })
  }

  // 3. 블로그 미등록
  if (!data.blogProfile) {
    notifications.push({
      icon: Globe,
      title: '블로그 등록하기',
      message: '블로그를 등록하면 블로그 지수 분석과 순위 트래킹을 이용할 수 있습니다.',
      time: '설정',
      actionable: true,
      href: '/settings',
    })
  }

  // 4. 평균 SEO 점수 낮음
  if (data.contentStats && data.contentStats.total > 0 && data.contentStats.avgSeoScore < 60) {
    notifications.push({
      icon: TrendingUp,
      title: 'SEO 점수 개선 필요',
      message: `평균 SEO 점수가 ${data.contentStats.avgSeoScore}점입니다. SEO 체크 기능으로 점수를 높여보세요.`,
      time: 'SEO',
      actionable: true,
      href: '/seo-check',
    })
  }

  // 5. 7일 활동 없음
  if (data.dailyActivity && data.dailyActivity.length > 0 && data.dailyActivity.every(d => d.keywords === 0 && d.content === 0)) {
    notifications.push({
      icon: Info,
      title: '활동을 시작해보세요',
      message: '최근 7일간 활동이 없습니다. 키워드 검색부터 시작해보세요!',
      time: '활동',
      actionable: true,
      href: '/keywords',
    })
  }

  // 정적 알림 (하단에 항상 표시)
  notifications.push(...staticNotifications())

  return notifications
}

const TIPS: { title: string; message: string }[] = [
  { title: '사용 팁', message: 'URL로 가져오기 기능으로 기존 블로그 글의 SEO 점수를 바로 확인해보세요!' },
  { title: '사용 팁', message: 'AI 콘텐츠 생성 시 추가 키워드를 입력하면 더 풍부한 글이 만들어집니다.' },
  { title: '사용 팁', message: '키워드 발굴 기능으로 경쟁이 낮은 블루오션 키워드를 찾아보세요!' },
  { title: '사용 팁', message: '블로그 지수 분석으로 내 블로그의 C-Rank 경쟁력을 확인해보세요.' },
  { title: '사용 팁', message: 'SEO 체크 후 개선 제안을 적용하면 상위노출 확률이 높아집니다.' },
  { title: '사용 팁', message: '순위 트래킹으로 키워드별 노출 순위 변화를 매일 확인해보세요.' },
  { title: '사용 팁', message: '콘텐츠 템플릿을 저장해두면 일관된 품질의 글을 빠르게 작성할 수 있습니다.' },
]

function staticNotifications(): Notification[] {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % TIPS.length
  const tip = TIPS[dayIndex]
  return [
    {
      icon: Sparkles,
      title: tip.title,
      message: tip.message,
      time: '팁',
      actionable: false,
    },
  ]
}

export function useNotifications() {
  const { dashboardData, loaded } = useUserProfile()
  const [notifications, setNotifications] = useState<Notification[]>(staticNotifications())

  useEffect(() => {
    if (loaded && dashboardData) {
      setNotifications(buildNotifications(dashboardData as Parameters<typeof buildNotifications>[0]))
    }
  }, [loaded, dashboardData])

  const hasActionable = notifications.some(n => n.actionable)
  return { notifications, hasActionable }
}
