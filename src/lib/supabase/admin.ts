import { createClient } from '@supabase/supabase-js'

/**
 * Supabase 관리자 클라이언트 (Service Role Key 사용)
 * RLS를 우회하므로 반드시 서버 사이드 + 관리자 인증 후에만 사용!
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Supabase 관리자 설정이 필요합니다 (SUPABASE_SERVICE_ROLE_KEY)')
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
