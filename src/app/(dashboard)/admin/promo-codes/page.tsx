'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Ticket, Plus, Trash2, RefreshCw } from 'lucide-react'
import type { PromoCode } from '@/types/database'

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  // 생성 폼 상태
  const [newCode, setNewCode] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newRewardType, setNewRewardType] = useState<'credits' | 'plan_upgrade'>('credits')
  const [newBonusCredits, setNewBonusCredits] = useState(10)
  const [newMaxUses, setNewMaxUses] = useState('')
  const [newExpiresAt, setNewExpiresAt] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  const loadCodes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/promo-codes')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCodes(data.codes)
    } catch {
      setError('프로모 코드 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCodes()
  }, [loadCodes])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateLoading(true)

    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode,
          description: newDescription || null,
          reward_type: newRewardType,
          bonus_credits: newRewardType === 'credits' ? newBonusCredits : 0,
          max_uses: newMaxUses ? Number(newMaxUses) : null,
          expires_at: newExpiresAt || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error || '생성 실패')
        return
      }

      setDialogOpen(false)
      setNewCode('')
      setNewDescription('')
      setNewBonusCredits(10)
      setNewMaxUses('')
      setNewExpiresAt('')
      loadCodes()
    } catch {
      setCreateError('프로모 코드 생성 중 오류가 발생했습니다.')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      await fetch(`/api/admin/promo-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      })
      setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentActive } : c))
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 프로모 코드를 삭제하시겠습니까?')) return

    try {
      await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' })
      setCodes(prev => prev.filter(c => c.id !== id))
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ticket className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">프로모 코드 관리</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              할인 코드를 생성하고 관리합니다
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadCodes}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                새 코드 생성
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>프로모 코드 생성</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                {createError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {createError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>코드</Label>
                  <Input
                    placeholder="SUMMER2024"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>설명 (선택)</Label>
                  <Input
                    placeholder="여름 프로모션 이벤트"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>보상 유형</Label>
                  <Select
                    value={newRewardType}
                    onValueChange={(v) => setNewRewardType(v as 'credits' | 'plan_upgrade')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credits">크레딧 보너스</SelectItem>
                      <SelectItem value="plan_upgrade" disabled>플랜 업그레이드 (준비 중)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newRewardType === 'credits' && (
                  <div className="space-y-2">
                    <Label>보너스 크레딧</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newBonusCredits}
                      onChange={(e) => setNewBonusCredits(Number(e.target.value))}
                      required
                    />
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>최대 사용 횟수 (비워두면 무제한)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="무제한"
                      value={newMaxUses}
                      onChange={(e) => setNewMaxUses(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>만료일 (선택)</Label>
                    <Input
                      type="date"
                      value={newExpiresAt}
                      onChange={(e) => setNewExpiresAt(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createLoading}>
                  {createLoading ? '생성 중...' : '프로모 코드 생성'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            프로모 코드 목록 ({codes.length}개)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              생성된 프로모 코드가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {/* 헤더 (데스크톱) */}
              <div className="hidden rounded-lg bg-muted p-3 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-7 sm:gap-4">
                <span>코드</span>
                <span>설명</span>
                <span>보상</span>
                <span>사용</span>
                <span>만료일</span>
                <span>활성</span>
                <span>관리</span>
              </div>

              {codes.map((code) => (
                <div
                  key={code.id}
                  className="rounded-lg border p-3 sm:grid sm:grid-cols-7 sm:items-center sm:gap-4"
                >
                  <div>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono font-semibold">
                      {code.code}
                    </code>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {code.description || '-'}
                  </div>
                  <div>
                    <Badge variant={code.reward_type === 'credits' ? 'default' : 'secondary'}>
                      {code.reward_type === 'credits'
                        ? `+${code.bonus_credits} 크레딧`
                        : `${code.upgrade_plan} 업그레이드`}
                    </Badge>
                  </div>
                  <div className="text-sm">
                    {code.current_uses}/{code.max_uses ?? '무제한'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {code.expires_at
                      ? new Date(code.expires_at).toLocaleDateString('ko-KR')
                      : '없음'}
                  </div>
                  <div>
                    <Switch
                      checked={code.is_active}
                      onCheckedChange={() => handleToggle(code.id, code.is_active)}
                    />
                  </div>
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(code.id)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
