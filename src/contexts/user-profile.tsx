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
  /** 관리자가 비활성화한 기능 키 목록 */
  disabledFeatures: string[]
}

interface ProfileState {
  plan: Plan
  role: UserRole
  creditsBalance: number
  creditsQuota: number
  avatarUrl: string | null
  userName: string
  userEmail: string
  loaded: boolean
  dashboardData: Record<string, unknown> | null
  disabledFeatures: string[]
}

const initialState: ProfileState = {
  plan: 'free',
  role: 'user',
  creditsBalance: 0,
  creditsQuota: 30,
  avatarUrl: null,
  userName: '',
  userEmail: '',
  loaded: false,
  dashboardData: null,
  disabledFeatures: [],
}

const defaultValue: UserProfileData = {
  ...initialState,
  refresh: () => {},
}

const UserProfileContext = createContext<UserProfileData>(defaultValue)

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProfileState>(initialState)

  const loadProfile = useCallback(async () => {
    try {
      // 소셜 프로필 + 대시보드 + 기능 상태를 모두 병렬 호출
      const authPromise = isSupabaseConfigured()
        ? createClient().auth.getUser()
        : Promise.resolve({ data: { user: null } })

      const [authResult, res, featuresRes] = await Promise.all([
        authPromise,
        fetch('/api/dashboard'),
        fetch('/api/features'),
      ])

      // 인증 데이터
      const user = authResult.data?.user
      let avatarUrl: string | null = null
      let userName = ''
      let userEmail = ''
      if (user) {
        const meta = user.user_metadata
        avatarUrl = meta?.avatar_url || meta?.picture || null
        userName = meta?.full_name || meta?.name || ''
        userEmail = user.email || ''
      }

      // 대시보드 데이터
      let dashboardData: Record<string, unknown> | null = null
      let plan: Plan = 'free'
      let role: UserRole = 'user'
      let creditsBalance = 0
      let creditsQuota = 30

      if (res.ok) {
        const data = await res.json()
        dashboardData = data
        const userRole = (data.profile?.role || 'user') as UserRole
        plan = userRole === 'admin' ? 'admin' : (data.profile?.plan || 'free') as Plan
        role = userRole
        creditsBalance = data.profile?.credits_balance ?? 0
        creditsQuota = data.profile?.credits_monthly_quota ?? 30

        // 블로그 썸네일 폴백
        if (!avatarUrl && data.blogProfile?.blogThumbnail) {
          avatarUrl = data.blogProfile.blogThumbnail
        }
      }

      // 비활성화된 기능 목록
      let disabledFeatures: string[] = []
      if (featuresRes.ok) {
        const featuresData = await featuresRes.json()
        disabledFeatures = featuresData.disabledFeatures || []
      }

      // 단일 setState로 리렌더 1회만 발생
      setState({
        plan,
        role,
        creditsBalance,
        creditsQuota,
        avatarUrl,
        userName,
        userEmail,
        loaded: true,
        dashboardData,
        disabledFeatures,
      })
    } catch {
      // 로드 실패 시 기본값 유지, loaded만 true
      setState(prev => ({ ...prev, loaded: true }))
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  return (
    <UserProfileContext.Provider
      value={{
        ...state,
        refresh: loadProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  )
}

export function useUserProfile() {
  return useContext(UserProfileContext)
}
