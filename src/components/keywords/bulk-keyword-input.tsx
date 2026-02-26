'use client'

import { useState, useMemo } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ListChecks, Upload, Loader2, X, Lightbulb } from 'lucide-react'
import { CATEGORY_EXAMPLE_KEYWORDS, BLOG_CATEGORY_LABELS } from '@/lib/blog-index/categories'
import type { BlogCategory } from '@/lib/blog-index/categories'

interface BulkKeywordInputProps {
    onSubmit: (keywords: string[]) => void
    loading: boolean
    blogCategory?: BlogCategory | null
}

const DEFAULT_EXAMPLES = [
    '아랫배 땡김\n오른쪽 아랫배 땡김\n왼쪽 아랫배 땡김\n아랫배 통증\n아랫배 콕콕',
    '다이어트 식단\n간헐적 단식\n저탄고지\n키토제닉\n단백질 식단',
    '서울 맛집\n강남 맛집\n홍대 맛집\n이태원 맛집\n성수 카페',
]

export function BulkKeywordInput({ onSubmit, loading, blogCategory }: BulkKeywordInputProps) {
    const [text, setText] = useState('')

    const keywords = useMemo(() => {
        return text
            .split(/[\n,]/)
            .map((kw) => kw.trim())
            .filter((kw) => kw.length > 0)
    }, [text])

    const uniqueKeywords = useMemo(() => Array.from(new Set(keywords)), [keywords])
    const duplicateCount = keywords.length - uniqueKeywords.length

    const handleSubmit = () => {
        if (uniqueKeywords.length === 0) return
        onSubmit(uniqueKeywords)
    }

    const handleExampleClick = (example: string) => {
        setText(example)
    }

    // 카테고리 기반 예시 키워드 (등록 블로그가 있으면 카테고리별, 없으면 기본)
    const exampleKeywords = useMemo(() => {
        if (!blogCategory) return DEFAULT_EXAMPLES
        const sets = CATEGORY_EXAMPLE_KEYWORDS[blogCategory]
        if (!sets || sets.length === 0) return DEFAULT_EXAMPLES
        return sets.map(set => set.join('\n'))
    }, [blogCategory])

    const handleClear = () => {
        setText('')
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <ListChecks className="h-5 w-5 text-primary" />
                    키워드 입력
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="relative">
                    <Textarea
                        placeholder="조회할 키워드를 입력하세요 (줄바꿈 또는 쉼표로 구분)&#10;&#10;예시:&#10;아랫배 땡김&#10;오른쪽 아랫배 땡김&#10;왼쪽 아랫배 땡김"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="min-h-[160px] resize-y font-mono text-sm"
                        disabled={loading}
                    />
                    {text && !loading && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={handleClear}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* 키워드 카운트 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>
                            키워드 <span className={`font-semibold ${uniqueKeywords.length > 100 ? 'text-destructive' : 'text-foreground'}`}>
                                {uniqueKeywords.length}
                            </span>개
                            {uniqueKeywords.length > 100 && (
                                <span className="ml-1 text-destructive">(최대 100개)</span>
                            )}
                        </span>
                        {duplicateCount > 0 && (
                            <span className="text-amber-600">중복 {duplicateCount}개 제거됨</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleSubmit}
                            disabled={loading || uniqueKeywords.length === 0}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    조회 중...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    대량 조회 ({Math.min(uniqueKeywords.length, 100)}개)
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* 예시 키워드 */}
                {uniqueKeywords.length === 0 && (
                    <div className="space-y-2">
                        {blogCategory ? (
                            <p className="flex items-center gap-1 text-xs text-blue-600">
                                <Lightbulb className="h-3.5 w-3.5" />
                                등록된 블로그의 카테고리({BLOG_CATEGORY_LABELS[blogCategory]})에 맞춘 추천 키워드입니다
                            </p>
                        ) : (
                            <div className="space-y-0.5">
                                <p className="text-xs text-muted-foreground">예시 키워드 세트:</p>
                                <p className="text-[11px] text-muted-foreground/70">
                                    블로그를 등록하고 블로그 지수를 측정하면 내 블로그에 맞는 키워드가 추천됩니다
                                </p>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {exampleKeywords.map((example, i) => {
                                const firstKeyword = example.split('\n')[0]
                                const count = example.split('\n').length
                                return (
                                    <Badge
                                        key={i}
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-secondary/80 transition-colors"
                                        onClick={() => handleExampleClick(example)}
                                    >
                                        {firstKeyword} 외 {count - 1}개
                                    </Badge>
                                )
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
