-- ============================================================
-- 022: AI 이미지 생성용 스토리지 버킷
-- Gemini로 생성한 블로그 이미지를 저장하는 공개 버킷
-- ============================================================

-- 1. ai-images 공개 버킷 (블로그 붙여넣기 시 외부 접근 필요)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ai-images', 'ai-images', true, 5242880, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2. RLS 정책

-- 사용자별 폴더 업로드 (ai-images/{userId}/...)
CREATE POLICY "Users upload own images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 공개 읽기 (블로그 이미지 URL 접근)
CREATE POLICY "Public read ai-images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'ai-images');

-- 본인 이미지 삭제
CREATE POLICY "Users delete own images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text);
