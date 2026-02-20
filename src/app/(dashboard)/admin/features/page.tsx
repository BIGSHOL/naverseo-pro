'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ToggleRight, AlertTriangle } from 'lucide-react'

interface FeatureItem {
  key: string
  label: string
  description: string
  href: string
  enabled: boolean
}

export default function AdminFeaturesPage() {
  const [features, setFeatures] = useState<FeatureItem[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadFeatures() {
      try {
        const res = await fetch('/api/admin/features')
        if (!res.ok) {
          setError('기능 설정을 불러올 수 없습니다.')
          return
        }
        const data = await res.json()
        setFeatures(data.features)
      } catch {
        setError('기능 설정을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    loadFeatures()
  }, [])

  async function handleToggle(key: string, newEnabled: boolean) {
    setTogglingKey(key)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled: newEnabled }),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || '기능 설정 변경 중 오류가 발생했습니다.')
        return
      }

      // 로컬 상태 업데이트
      setFeatures((prev) =>
        prev.map((f) => (f.key === key ? { ...f, enabled: newEnabled } : f))
      )
      setSuccess(result.message)
    } catch {
      setError('기능 설정 변경 중 오류가 발생했습니다.')
    } finally {
      setTogglingKey(null)
    }
  }

  const disabledCount = features.filter((f) => !f.enabled).length

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ToggleRight className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">기능 관리</h1>
          <p className="text-sm text-muted-foreground">
            서비스 기능을 활성화/비활성화합니다. 비활성화된 기능은 사용자에게 표시되지 않습니다.
          </p>
        </div>
      </div>

      {/* 상태 요약 */}
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="gap-1 px-3 py-1">
          전체 {features.length}개 기능
        </Badge>
        {disabledCount > 0 && (
          <Badge variant="destructive" className="gap-1 px-3 py-1">
            <AlertTriangle className="h-3 w-3" />
            {disabledCount}개 비활성화
          </Badge>
        )}
      </div>

      {/* 메시지 */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700">{success}</div>
      )}

      {/* 기능 카드 그리드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card
            key={feature.key}
            className={!feature.enabled ? 'border-destructive/30 bg-destructive/5' : ''}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{feature.label}</CardTitle>
                <Switch
                  checked={feature.enabled}
                  onCheckedChange={(checked) => handleToggle(feature.key, checked)}
                  disabled={togglingKey === feature.key}
                />
              </div>
              <CardDescription className="text-xs">{feature.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{feature.href}</span>
                <Badge variant={feature.enabled ? 'default' : 'destructive'} className="text-xs">
                  {feature.enabled ? '활성' : '비활성'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
