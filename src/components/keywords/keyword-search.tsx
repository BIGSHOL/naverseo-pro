'use client'

import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CreditTooltip } from '@/components/credit-tooltip'
import type { CreditFeature } from '@/types/database'

interface KeywordSearchProps {
  onSearch: (keyword: string) => void
  loading: boolean
  /** 크레딧 소모 기능 (툴팁 표시용, 기본: keyword_research) */
  creditFeature?: CreditFeature
}

export function KeywordSearch({ onSearch, loading, creditFeature = 'keyword_research' }: KeywordSearchProps) {
  const [keyword, setKeyword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.trim() && !loading) {
      onSearch(keyword.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="키워드를 입력하세요 (예: 다이어트 식단)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="h-11 pl-10"
          disabled={loading}
        />
      </div>
      <CreditTooltip feature={creditFeature}>
        <Button type="submit" className="h-11 px-6" disabled={loading || !keyword.trim()}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              분석 중
            </>
          ) : (
            '검색'
          )}
        </Button>
      </CreditTooltip>
    </form>
  )
}
