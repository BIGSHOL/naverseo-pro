'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Gift, Users, Coins, RefreshCw, Save } from 'lucide-react'
import type { ReferralConfig } from '@/types/database'

interface ReferralStats {
  totalReferrals: number
  totalCreditsGiven: number
  config: ReferralConfig
  recentReferrals: {
    id: string
    referrer_email: string
    referee_email: string
    referrer_credits: number
    referee_credits: number
    created_at: string
  }[]
}

export default function AdminReferralsPage() {
  const [data, setData] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 설정 편집
  const [referrerCredits, setReferrerCredits] = useState(10)
  const [refereeCredits, setRefereeCredits] = useState(10)
  const [enabled, setEnabled] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/referral-stats')
      if (!res.ok) throw new Error()
      const stats = await res.json()
      setData(stats)
      setReferrerCredits(stats.config.referrer_credits)
      setRefereeCredits(stats.config.referee_credits)
      setEnabled(stats.config.enabled)
    } catch {
      setError('추천 통계를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const handleSaveConfig = async () => {
    setSaveLoading(true)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/admin/referral-stats/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer_credits: referrerCredits,
          referee_credits: refereeCredits,
          enabled,
        }),
      })
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch {
      // ignore
    } finally {
      setSaveLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gift className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">추천인 관리</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              추천인 시스템 설정 및 통계를 관리합니다
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadStats}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* 통계 카드 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 추천 수</p>
                <p className="text-2xl font-bold">{data?.totalReferrals ?? 0}건</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                <Coins className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 지급 크레딧</p>
                <p className="text-2xl font-bold">{(data?.totalCreditsGiven ?? 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 추천 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">추천 보상 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">추천 시스템 활성화</p>
              <p className="text-sm text-muted-foreground">비활성화하면 새 추천이 처리되지 않습니다</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>추천인 보상 크레딧</Label>
              <Input
                type="number"
                min={0}
                value={referrerCredits}
                onChange={(e) => setReferrerCredits(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">추천한 사람에게 지급</p>
            </div>
            <div className="space-y-2">
              <Label>피추천인 보상 크레딧</Label>
              <Input
                type="number"
                min={0}
                value={refereeCredits}
                onChange={(e) => setRefereeCredits(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">추천받고 가입한 사람에게 지급</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleSaveConfig}
              disabled={saveLoading}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saveLoading ? '저장 중...' : '설정 저장'}
            </Button>
            {saveSuccess && (
              <span className="text-sm text-green-600">저장되었습니다.</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 최근 추천 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">최근 추천 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {(!data?.recentReferrals || data.recentReferrals.length === 0) ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              추천 내역이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="hidden rounded-lg bg-muted p-3 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-5 sm:gap-4">
                <span>추천인</span>
                <span>피추천인</span>
                <span>추천인 보상</span>
                <span>피추천인 보상</span>
                <span>날짜</span>
              </div>
              {data.recentReferrals.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border p-3 sm:grid sm:grid-cols-5 sm:items-center sm:gap-4"
                >
                  <div className="text-sm truncate">{r.referrer_email}</div>
                  <div className="text-sm truncate">{r.referee_email}</div>
                  <div>
                    <Badge variant="secondary">+{r.referrer_credits}</Badge>
                  </div>
                  <div>
                    <Badge variant="secondary">+{r.referee_credits}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
