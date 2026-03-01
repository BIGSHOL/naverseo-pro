'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Plan, UserRole } from '@/types/database'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client'

interface UserProfileData {
  plan: Plan
  role: UserRole
  creditsBalance: number
  creditsQuota: number
  avatarUrl: string | null
  userName: string
  userEmail: string
  /** 프로필 데이터가 1회 이상 로드 완료되었는지 */
  loaded: boolean
  /** 프로필 데이터 새로고침 (크레딧 차감 후 등) */
  refresh: () => void
  /** 대시보드 API 원본 데이터 (알림 등 하위 컴포넌트 용) */
  dashboardData: Record<string, unknown> | null
}

const defaultValue: UserProfileData = {
  plan: 'free',
  role: 'user',
  creditsBalance: 0,
  creditsQuota: 30,
  avatarUrl: null,
  userName: '',
  userEmail: '',
  loaded: false,
  refresh: () => {},
  dashboardData: null,
}

const UserProfileContext = createContext<UserProfileData>(defaultValue)

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<Plan>('free')
  const [role, setRole] = useState<UserRole>('user')
  const [creditsBalance, setCreditsBalance] = useState(0)
  const [creditsQuota, setCreditsQuota] = useState(30)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [dashboardData, setDashboardData] = useState<Record<string, unknown> | null>(null)

  const loadProfile = useCallback(async () => {
    try {
      // 소셜 프로필 이미지
      if (isSupabaseConfigured()) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const meta = user.user_metadata
          setAvatarUrl(meta?.avatar_url || meta?.picture || null)
          setUserName(meta?.full_name || meta?.name || '')
          setUserEmail(user.email || '')
        }
      }

      // 대시보드 API 1회 호출
      const res = await fetch('/api/dashboard')
      if (!res.ok) return
      const data = await res.json()
      const userRole = (data.profile?.role || 'user') as UserRole
      setPlan(userRole === 'admin' ? 'admin' : (data.profile?.plan || 'free') as Plan)
      setRole(userRole)
      setCreditsBalance(data.profile?.credits_balance ?? 0)
      setCreditsQuota(data.profile?.credits_monthly_quota ?? 30)

      // 블로그 썸네일 폴백
      if (!avatarUrl && data.blogProfile?.blogThumbnail) {
        setAvatarUrl(data.blogProfile.blogThumbnail)
      }

      setDashboardData(data)
    } catch {
      // 로드 실패 시 기본값 유지
    } finally {
      setLoaded(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  return (
    <UserProfileContext.Provider
      value={{
        plan,
        role,
        creditsBalance,
        creditsQuota,
        avatarUrl,
        userName,
        userEmail,
        loaded,
        refresh: loadProfile,
        dashboardData,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  )
}

export function useUserProfile() {
  return useContext(UserProfileContext)
}
