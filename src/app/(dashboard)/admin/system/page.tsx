'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, XCircle, Server } from 'lucide-react'

interface ApiStatusItem {
  name: string
  configured: boolean
}

interface SystemData {
  apiStatus: Record<string, ApiStatusItem>
  planLimits: Record<string, {
    keywordsPerMonth: number
    contentPerMonth: number
    trackingKeywords: number
    analysisPerDay: number
  }>
  environment: {
    nodeEnv: string
    vercelEnv: string
  }
}

export default function AdminSystemPage() {
  const [data, setData] = useState<SystemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadSystem() {
      try {
        const res = await fetch('/api/admin/system')
        if (!res.ok) {
          const d = await res.json()
          setError(d.error || '시스템 정보를 불러올 수 없습니다.')
          return
        }
        setData(await res.json())
      } catch {
        setError('시스템 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    loadSystem()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const allConfigured = Object.values(data.apiStatus).every((s) => s.configured)
  const configuredCount = Object.values(data.apiStatus).filter((s) => s.configured).length
  const totalApis = Object.values(data.apiStatus).length

  function formatLimit(value: number): string {
    if (value === -1) return '무제한'
    if (value === 0) return 'X'
    return String(value)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Server className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">시스템 설정</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            API 연동 상태와 플랜 설정을 확인합니다
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* API 키 상태 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">API 연동 상태</CardTitle>
            <Badge variant={allConfigured ? 'default' : 'destructive'}>
              {configuredCount}/{totalApis} 설정됨
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(data.apiStatus).map(([key, status]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm font-medium">{status.name}</span>
                  {status.configured ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs">설정됨</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-4 w-4" />
                      <span className="text-xs">미설정</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 환경 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">환경 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Node 환경</span>
                <Badge variant="outline">{data.environment.nodeEnv}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Vercel 환경</span>
                <Badge variant="outline">{data.environment.vercelEnv}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 플랜 제한 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">플랜별 제한 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left font-medium text-muted-foreground">플랜</th>
                  <th className="py-2 text-center font-medium text-muted-foreground">키워드/월</th>
                  <th className="py-2 text-center font-medium text-muted-foreground">콘텐츠/월</th>
                  <th className="py-2 text-center font-medium text-muted-foreground">트래킹 키워드</th>
                  <th className="py-2 text-center font-medium text-muted-foreground">분석/일</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.planLimits).map(([plan, limits]) => (
                  <tr key={plan} className="border-b last:border-0">
                    <td className="py-3">
                      <Badge variant="outline" className="uppercase">{plan}</Badge>
                    </td>
                    <td className="py-3 text-center">{formatLimit(limits.keywordsPerMonth)}</td>
                    <td className="py-3 text-center">{formatLimit(limits.contentPerMonth)}</td>
                    <td className="py-3 text-center">{formatLimit(limits.trackingKeywords)}</td>
                    <td className="py-3 text-center">{formatLimit(limits.analysisPerDay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
