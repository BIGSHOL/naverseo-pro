'use client'

import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface KeywordSearchProps {
  onSearch: (keyword: string) => void
  loading: boolean
}

export function KeywordSearch({ onSearch, loading }: KeywordSearchProps) {
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
    </form>
  )
}
