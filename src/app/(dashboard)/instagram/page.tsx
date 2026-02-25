'use client'

import { useEffect, useState } from 'react'
import { Camera, Coins } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InstagramTabCaption } from '@/components/instagram/instagram-tab-caption'
import { InstagramTabHashtags } from '@/components/instagram/instagram-tab-hashtags'
import { InstagramTabCarousel } from '@/components/instagram/instagram-tab-carousel'
import { InstagramTabReels } from '@/components/instagram/instagram-tab-reels'
import { CREDIT_COSTS, type Plan } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

export default function InstagramPage() {
  const [userPlan, setUserPlan] = useState<Plan | undefined>()

  useEffect(() => {
    const fetchPlan = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .single()
        if (data) setUserPlan(data.plan as Plan)
      }
    }
    fetchPlan()
  }, [])

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-purple-600">
            <Camera className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">인스타그램 변환</h1>
            <p className="text-sm text-muted-foreground">
              네이버 블로그 콘텐츠를 인스타그램용으로 AI 변환
            </p>
          </div>
          <Badge variant="secondary" className="ml-auto gap-1">
            <Coins className="h-3 w-3" />
            {CREDIT_COSTS.instagram_convert} 크레딧/회
          </Badge>
        </div>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="caption" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="caption">캡션 변환</TabsTrigger>
          <TabsTrigger value="hashtags">해시태그 추천</TabsTrigger>
          <TabsTrigger value="carousel">캐러셀 생성</TabsTrigger>
          <TabsTrigger value="reels">릴스 대본</TabsTrigger>
        </TabsList>

        <TabsContent value="caption">
          <InstagramTabCaption userPlan={userPlan} />
        </TabsContent>

        <TabsContent value="hashtags">
          <InstagramTabHashtags userPlan={userPlan} />
        </TabsContent>

        <TabsContent value="carousel">
          <InstagramTabCarousel userPlan={userPlan} />
        </TabsContent>

        <TabsContent value="reels">
          <InstagramTabReels userPlan={userPlan} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
