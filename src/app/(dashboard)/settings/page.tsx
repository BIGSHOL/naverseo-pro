'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  User,
  CreditCard,
  Check,
  AlertCircle,
  RefreshCw,
  LogOut,
  Lock,
  CheckCircle2,
  Globe,
  ExternalLink,
  Trash2,
  BarChart3,
  Gift,
  Copy,
  Ticket,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PLANS, type Plan } from '@/types/database'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ProfileData {
  plan: Plan
  credits_balance: number
  credits_monthly_quota: number
  credits_reset_at: string | null
  keywords_used_this_month: number
  content_generated_this_month: number
  analysis_used_today: number
  analysis_reset_date: string | null
  email: string
  created_at: string
}

interface BlogProfile {
  blogUrl: string
  blogId: string | null
  blogName: string
  blogThumbnail: string | null
  totalPosts: number
  blogScore: number
  blogLevel: string
  categoryKeywords: string[]
  lastPostDate: string | null
  updatedAt: string | null
  verificationCode?: string
  verified?: boolean
  verifiedAt?: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [blogProfile, setBlogProfile] = useState<BlogProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [blogUrl, setBlogUrl] = useState('')
  const [blogLoading, setBlogLoading] = useState(false)
  const [blogError, setBlogError] = useState('')
  const [blogSuccess, setBlogSuccess] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifySuccess, setVerifySuccess] = useState(false)

  // 추천 코드
  const [referralCode, setReferralCode] = useState('')
  const [referralStats, setReferralStats] = useState({ totalReferrals: 0, totalCreditsEarned: 0 })
  const [referralCopied, setReferralCopied] = useState(false)

  // 프로모 코드
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [promoSuccess, setPromoSuccess] = useState('')

  const loadProfile = useCallback(async () => {
    try {
      const [billingRes, dashboardRes] = await Promise.all([
        fetch('/api/billing'),
        fetch('/api/dashboard'),
      ])

      if (!billingRes.ok) {
        setFetchError('설정 데이터를 불러오지 못했습니다.')
        return
      }

      const billingData = await billingRes.json()
      setProfile(billingData.profile)

      if (dashboardRes.ok) {
        const dashboardData = await dashboardRes.json()
        setBlogProfile(dashboardData.blogProfile || null)
      }

      // 추천 코드 정보 로드
      try {
        const referralRes = await fetch('/api/referral/my')
        if (referralRes.ok) {
          const refData = await referralRes.json()
          setReferralCode(refData.referralCode || '')
          setReferralStats({
            totalReferrals: refData.totalReferrals,
            totalCreditsEarned: refData.totalCreditsEarned,
          })
        }
      } catch {
        // 추천 정보 로드 실패 무시
      }
    } catch {
      setFetchError('설정 데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (!isSupabaseConfigured()) {
      setPwError('Supabase가 설정되지 않았습니다.')
      return
    }

    if (newPassword.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPwError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    setPwLoading(true)
    try {
      const supabase = createClient()

      // 현재 비밀번호로 재인증
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || '',
        password: currentPassword,
      })

      if (signInError) {
        setPwError('현재 비밀번호가 올바르지 않습니다.')
        return
      }

      // 새 비밀번호로 변경
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        if (updateError.message.includes('same password')) {
          setPwError('현재 비밀번호와 동일합니다. 다른 비밀번호를 입력해주세요.')
        } else {
          setPwError(updateError.message)
        }
        return
      }

      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch {
      setPwError('비밀번호 변경 중 오류가 발생했습니다.')
    } finally {
      setPwLoading(false)
    }
  }

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch {
        // ignore
      }
    }
    router.push('/')
    router.refresh()
  }

  const handleRegisterBlog = async (e: React.FormEvent) => {
    e.preventDefault()
    setBlogError('')
    setBlogSuccess(false)

    let normalizedUrl = blogUrl.trim()

    if (!normalizedUrl) {
      setBlogError('블로그 URL을 입력해주세요.')
      return
    }

    // URL 정규화: https:// 없으면 추가
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    // 네이버 블로그 URL 검증
    if (!normalizedUrl.includes('blog.naver.com/')) {
      setBlogError('네이버 블로그 URL을 입력해주세요. (예: https://blog.naver.com/아이디 또는 blog.naver.com/아이디)')
      return
    }

    setBlogLoading(true)
    try {
      const res = await fetch('/api/profile/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogUrl: normalizedUrl }),
      })

      const data = await res.json()

      if (!res.ok) {
        setBlogError(data.error || '블로그 등록에 실패했습니다.')
        return
      }

      // 인증 코드 저장
      if (data.verificationCode) {
        setVerificationCode(data.verificationCode)
      }

      setBlogSuccess(true)
      setBlogUrl('')
      // 블로그 프로필 새로고침
      await loadProfile()
    } catch {
      setBlogError('블로그 등록 중 오류가 발생했습니다.')
    } finally {
      setBlogLoading(false)
    }
  }

  const handleDeleteBlog = async () => {
    if (!confirm('블로그 정보를 삭제하시겠습니까?')) {
      return
    }

    setBlogLoading(true)
    setBlogError('')
    try {
      const res = await fetch('/api/profile/blog', {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        setBlogError(data.error || '블로그 삭제에 실패했습니다.')
        return
      }

      setBlogProfile(null)
      setBlogSuccess(false)
      setVerificationCode('')
    } catch {
      setBlogError('블로그 삭제 중 오류가 발생했습니다.')
    } finally {
      setBlogLoading(false)
    }
  }

  const handleVerifyBlog = async () => {
    setVerifyError('')
    setVerifySuccess(false)
    setVerifyLoading(true)

    try {
      const res = await fetch('/api/profile/blog/verify', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        setVerifyError(data.error || '인증에 실패했습니다.')
        return
      }

      setVerifySuccess(true)
      setVerificationCode('')
      // 블로그 프로필 새로고침
      await loadProfile()
    } catch {
      setVerifyError('인증 중 오류가 발생했습니다.')
    } finally {
      setVerifyLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
        {fetchError}
      </div>
    )
  }

  const currentPlan = profile?.plan || 'free'
  const currentPlanInfo = PLANS[currentPlan]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="mt-1 text-muted-foreground">
          계정 정보를 관리하세요
        </p>
      </div>

      {/* 프로필 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            프로필 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">이메일</p>
              <p className="font-medium">{profile?.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">가입일</p>
              <p className="font-medium">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('ko-KR')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">현재 플랜</p>
              <div className="flex items-center gap-2">
                <Badge variant={currentPlan === 'free' ? 'secondary' : 'default'}>
                  {currentPlanInfo.name}
                </Badge>
                <span className="text-sm font-medium">{currentPlanInfo.priceLabel}/월</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">크레딧</p>
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  {(profile?.credits_balance ?? 0).toLocaleString()} / {(profile?.credits_monthly_quota ?? 30).toLocaleString()} 크레딧
                </p>
                <div className="h-1.5 w-40 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${profile?.credits_monthly_quota ? Math.min(100, ((profile?.credits_balance ?? 0) / profile.credits_monthly_quota) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t pt-4">
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700">
              <LogOut className="h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 블로그 프로필 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            블로그 프로필
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {blogProfile ? (
            <>
              {/* 등록된 블로그 정보 */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      {blogProfile.blogThumbnail && (
                        <img
                          src={blogProfile.blogThumbnail}
                          alt={blogProfile.blogName}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{blogProfile.blogName}</h3>
                          {blogProfile.verified ? (
                            <Badge variant="default" className="text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              인증완료
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              미인증
                            </Badge>
                          )}
                        </div>
                        <a
                          href={blogProfile.blogUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          {blogProfile.blogUrl}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">총 포스트</p>
                        <p className="text-lg font-semibold">{blogProfile.totalPosts.toLocaleString()}개</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">블로그 점수</p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold">{blogProfile.blogScore}점</p>
                          {blogProfile.blogLevel && (
                            <Badge variant="outline" className="text-xs">
                              {blogProfile.blogLevel}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">마지막 포스트</p>
                        <p className="text-sm font-medium">
                          {blogProfile.lastPostDate
                            ? new Date(blogProfile.lastPostDate).toLocaleDateString('ko-KR')
                            : '-'}
                        </p>
                      </div>
                    </div>
                    {blogProfile.categoryKeywords.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">주요 키워드</p>
                        <div className="flex flex-wrap gap-1">
                          {blogProfile.categoryKeywords.slice(0, 5).map((keyword, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 블로그 소유권 인증 */}
                    {!blogProfile.verified && (verificationCode || blogProfile.verificationCode) && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950/30">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">
                          🔐 블로그 소유권 인증이 필요합니다
                        </p>
                        <div className="space-y-2 text-xs text-amber-800 dark:text-amber-300">
                          <p>1. 블로그 최신 글 하단에 아래 코드를 추가하세요:</p>
                          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded border">
                            <code className="flex-1 font-mono text-sm">
                              [인증코드: {verificationCode || blogProfile.verificationCode}]
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(`[인증코드: ${verificationCode || blogProfile.verificationCode}]`)
                              }}
                            >
                              복사
                            </Button>
                          </div>
                          <p>2. 글 저장 후 아래 "소유권 인증" 버튼을 클릭하세요</p>
                          <p className="text-amber-600 dark:text-amber-400">⏱️ 인증 코드는 10분간 유효합니다</p>
                        </div>
                        {verifyError && (
                          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                            {verifyError}
                          </div>
                        )}
                        {verifySuccess && (
                          <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                            ✅ 소유권 인증이 완료되었습니다!
                          </div>
                        )}
                        <Button
                          size="sm"
                          className="mt-3 w-full"
                          onClick={handleVerifyBlog}
                          disabled={verifyLoading}
                        >
                          {verifyLoading ? '인증 확인 중...' : '소유권 인증하기'}
                        </Button>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteBlog}
                    disabled={blogLoading}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {blogProfile.updatedAt && (
                <p className="text-xs text-muted-foreground">
                  마지막 업데이트: {new Date(blogProfile.updatedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </>
          ) : (
            <>
              {/* 블로그 등록 폼 */}
              {blogSuccess && (
                <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  블로그가 성공적으로 등록되었습니다.
                </div>
              )}
              {blogError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {blogError}
                </div>
              )}
              <form onSubmit={handleRegisterBlog} className="space-y-4">
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                  <p className="font-medium mb-1">📌 주의사항</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>본인 소유의 네이버 블로그만 등록해주세요</li>
                    <li>한 블로그는 한 계정에만 등록 가능합니다</li>
                    <li>타인의 블로그를 무단 등록할 경우 서비스 이용이 제한될 수 있습니다</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blogUrl">네이버 블로그 URL</Label>
                  <Input
                    id="blogUrl"
                    type="text"
                    placeholder="blog.naver.com/아이디 또는 https://blog.naver.com/아이디"
                    value={blogUrl}
                    onChange={(e) => setBlogUrl(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    블로그를 등록하면 블로그 지수 측정 결과가 프로필에 표시됩니다.
                  </p>
                </div>
                <Button type="submit" size="sm" disabled={blogLoading} className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {blogLoading ? '등록 중...' : '블로그 등록'}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {/* 비밀번호 변경 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            비밀번호 변경
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {pwError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                비밀번호가 성공적으로 변경되었습니다.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">현재 비밀번호</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="현재 비밀번호를 입력하세요"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">새 비밀번호</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="6자 이상 입력하세요"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">새 비밀번호 확인</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={pwLoading}>
              {pwLoading ? '변경 중...' : '비밀번호 변경'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 추천인 코드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4" />
            추천인 코드
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-2 text-sm text-muted-foreground">내 추천 코드</p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-primary/10 px-3 py-2 text-lg font-mono font-bold tracking-widest text-primary">
                {referralCode || '로딩중...'}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(referralCode)
                  setReferralCopied(true)
                  setTimeout(() => setReferralCopied(false), 2000)
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                {referralCopied ? '복사됨!' : '복사'}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              공유 링크:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {typeof window !== 'undefined' ? window.location.origin : ''}/signup?ref={referralCode}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-6 px-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${referralCode}`)
                  setReferralCopied(true)
                  setTimeout(() => setReferralCopied(false), 2000)
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">총 추천 수</p>
              <p className="text-xl font-bold">{referralStats.totalReferrals}명</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">적립 크레딧</p>
              <p className="text-xl font-bold">{referralStats.totalCreditsEarned}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            친구를 초대하면 나와 친구 모두 보너스 크레딧을 받을 수 있습니다.
          </p>
        </CardContent>
      </Card>

      {/* 프로모 코드 입력 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4" />
            프로모 코드
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {promoError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {promoError}
            </div>
          )}
          {promoSuccess && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {promoSuccess}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="프로모 코드를 입력하세요"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            />
            <Button
              size="sm"
              disabled={promoLoading || !promoInput.trim()}
              onClick={async () => {
                setPromoError('')
                setPromoSuccess('')
                setPromoLoading(true)
                try {
                  const res = await fetch('/api/promo/redeem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: promoInput.trim() }),
                  })
                  const data = await res.json()
                  if (!res.ok) {
                    setPromoError(data.error || '코드 적용 실패')
                  } else {
                    setPromoSuccess(data.message)
                    setPromoInput('')
                    loadProfile()
                  }
                } catch {
                  setPromoError('프로모 코드 적용 중 오류가 발생했습니다.')
                } finally {
                  setPromoLoading(false)
                }
              }}
            >
              {promoLoading ? '적용 중...' : '적용'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            프로모 코드가 있다면 입력하여 보너스 크레딧을 받으세요.
          </p>
        </CardContent>
      </Card>

      {/* 플랜 변경 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            플랜 변경
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).filter(
              ([key]) => key !== 'admin'
            ).map(
              ([planKey, planInfo]) => {
                const isCurrent = planKey === currentPlan

                return (
                  <div
                    key={planKey}
                    className={`relative flex flex-col rounded-lg border p-3 ${
                      isCurrent
                        ? 'border-primary bg-primary/5'
                        : ''
                    } ${planInfo.popular ? 'ring-1 ring-primary' : ''}`}
                  >
                    {isCurrent && (
                      <Badge variant="outline" className="absolute -top-2.5 left-1/2 -translate-x-1/2 border-primary bg-white text-[10px]">
                        현재 플랜
                      </Badge>
                    )}
                    {planInfo.popular && !isCurrent && (
                      <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px]">
                        인기
                      </Badge>
                    )}

                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{planInfo.name}</h3>
                        <span className="text-xs text-muted-foreground">{planInfo.credits} 크레딧/월</span>
                      </div>
                      <p className="mt-0.5 text-lg font-bold">
                        {planInfo.priceLabel}
                        <span className="text-xs font-normal text-muted-foreground">/월</span>
                      </p>
                    </div>

                    <ul className="mt-2 space-y-1">
                      {planInfo.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5 text-[11px] leading-tight">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-3">
                      {isCurrent ? (
                        <Button variant="outline" size="sm" className="h-7 w-full text-xs" disabled>
                          사용 중
                        </Button>
                      ) : (
                        <Link href="/billing">
                          <Button size="sm" className="h-7 w-full text-xs">
                            업그레이드
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )
              }
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
