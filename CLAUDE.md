# NaverSEO Pro - 네이버 블로그 SEO 올인원 SaaS

## 프로젝트 개요
네이버 블로그 운영자와 마케터를 위한 AI 기반 SEO 올인원 도구.
키워드 리서치 → AI 콘텐츠 생성 → SEO 점수 분석 → 순위 트래킹까지 한 곳에서.

## 개발자 레벨
- 초급 개발자 (TypeScript/React 기본 수준)
- Claude Code를 적극 활용하여 개발
- 복잡한 로직은 항상 설명과 함께 구현해줘

## 기술 스택
- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS + shadcn/ui
- **DB**: Supabase (PostgreSQL + Auth + Row Level Security)
- **AI**: Google Gemini Flash API (콘텐츠 생성/분석)
- **결제**: 토스페이먼츠 (한국 결제) + Stripe (해외 결제)
- **배포**: Vercel
- **외부 API**: 네이버 검색광고 API, 네이버 데이터랩 API, 네이버 검색 API

## 디렉토리 구조
```
naverseo-pro/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # 인증 관련 페이지
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/        # 로그인 후 대시보드
│   │   │   ├── dashboard/      # 메인 대시보드
│   │   │   ├── keywords/       # 키워드 리서치
│   │   │   ├── content/        # AI 콘텐츠 생성
│   │   │   ├── seo-check/      # SEO 점수 체커
│   │   │   ├── tracking/       # 순위 트래킹
│   │   │   └── settings/       # 계정 설정/결제
│   │   ├── api/                # API Routes
│   │   │   ├── naver/          # 네이버 API 프록시
│   │   │   ├── ai/             # Claude AI 엔드포인트
│   │   │   ├── auth/           # 인증 관련
│   │   │   └── billing/        # 결제 관련
│   │   ├── layout.tsx
│   │   └── page.tsx            # 랜딩 페이지
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 컴포넌트
│   │   ├── layout/             # 레이아웃 (사이드바, 헤더)
│   │   ├── keywords/           # 키워드 관련 컴포넌트
│   │   ├── content/            # 콘텐츠 관련 컴포넌트
│   │   └── charts/             # 차트/그래프
│   ├── lib/
│   │   ├── supabase/           # Supabase 클라이언트 & 타입
│   │   ├── naver/              # 네이버 API 유틸
│   │   ├── ai/                 # Claude AI 유틸
│   │   └── utils.ts            # 공통 유틸
│   ├── hooks/                  # 커스텀 훅
│   └── types/                  # TypeScript 타입 정의
├── supabase/
│   └── migrations/             # DB 마이그레이션
├── public/                     # 정적 에셋
├── .env.local                  # 환경변수 (절대 커밋 X)
├── CLAUDE.md                   # 이 파일
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

## DB 스키마 (Supabase)
```sql
-- 사용자 프로필
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'agency')),
  keywords_used_this_month INT DEFAULT 0,
  content_generated_this_month INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 키워드 리서치 결과 저장
CREATE TABLE keyword_research (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  seed_keyword TEXT NOT NULL,
  results JSONB NOT NULL,  -- {keywords: [{keyword, monthlyPc, monthlyMobile, competition, score}]}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI 생성 콘텐츠
CREATE TABLE generated_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_keyword TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  seo_score INT,
  seo_feedback JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 블로그 순위 트래킹
CREATE TABLE rank_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  blog_url TEXT NOT NULL,
  rank_position INT,  -- NULL이면 100위 밖
  section TEXT,  -- 'blog', 'smartblock', 'view'
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 프로젝트 (블로그별 관리)
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  blog_url TEXT,
  naver_blog_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 (모든 테이블에 적용)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 사용자는 본인 데이터만 접근
CREATE POLICY "Users can view own data" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can view own keywords" ON keyword_research FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own content" ON generated_content FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own tracking" ON rank_tracking FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own projects" ON projects FOR ALL USING (auth.uid() = user_id);
```

## 환경변수
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# 네이버 API
NAVER_AD_API_KEY=           # 검색광고 API 엑세스라이선스
NAVER_AD_SECRET_KEY=        # 검색광고 API 비밀키
NAVER_AD_CUSTOMER_ID=       # 검색광고 API 고객 ID
NAVER_CLIENT_ID=            # 네이버 개발자 센터 클라이언트 ID
NAVER_CLIENT_SECRET=        # 네이버 개발자 센터 시크릿

# Google Gemini
GEMINI_API_KEY=

# 결제
TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=
```

## 핵심 API 엔드포인트

### 네이버 검색광고 API (키워드 검색량)
```
GET https://api.searchad.naver.com/keywordstool
Headers:
  X-API-KEY: {NAVER_AD_API_KEY}
  X-Customer: {NAVER_AD_CUSTOMER_ID}
  X-Signature: HMAC-SHA256 서명
Query:
  hintKeywords: "검색할 키워드"
  showDetail: 1
Response: monthlyPcQcCnt, monthlyMobileQcCnt, monthlyAvePcClkCnt, compIdx 등
```

### 네이버 데이터랩 API (트렌드)
```
POST https://openapi.naver.com/v1/datalab/search
Headers:
  X-Naver-Client-Id: {NAVER_CLIENT_ID}
  X-Naver-Client-Secret: {NAVER_CLIENT_SECRET}
Body:
  startDate, endDate, timeUnit, keywordGroups
```

### 네이버 검색 API (블로그 검색)
```
GET https://openapi.naver.com/v1/search/blog.json
Headers:
  X-Naver-Client-Id: {NAVER_CLIENT_ID}
  X-Naver-Client-Secret: {NAVER_CLIENT_SECRET}
Query:
  query: "검색어"
  display: 10
  sort: "sim" | "date"
```

## 가격 정책
| 플랜 | 월 가격 | 키워드 조회 | AI 콘텐츠 생성 | 순위 트래킹 |
|------|--------|-----------|-------------|-----------|
| Free | ₩0 | 10회/월 | 3편/월 | X |
| Starter | ₩29,000 | 50회/월 | 10편/월 | 키워드 5개 |
| Pro | ₩59,000 | 무제한 | 50편/월 | 키워드 30개 |
| Agency | ₩149,000 | 무제한 | 200편/월 | 키워드 100개 |

## 코딩 컨벤션
- 모든 컴포넌트는 함수형 + TypeScript
- 한국어 UI (메뉴, 버튼, 에러 메시지 등 모두 한국어)
- 서버 컴포넌트 우선, 클라이언트 컴포넌트는 'use client' 명시
- API Route에서 에러 처리 필수 (try-catch + 적절한 HTTP 상태 코드)
- Supabase RLS로 데이터 보안 처리
- 환경변수는 .env.local에만 저장, 절대 하드코딩 금지
- 커밋 메시지: 한국어 OK (예: "키워드 검색 기능 추가")

## MVP 우선순위
1. ✅ 랜딩 페이지 + Supabase 인증 (회원가입/로그인)
2. ✅ 키워드 검색량 조회 (네이버 검색광고 API)
3. ✅ AI 키워드 추천 (Claude API)
4. ✅ AI 블로그 콘텐츠 생성 (Claude API + 네이버 SEO 최적화)
5. ✅ SEO 점수 체커
6. ✅ 대시보드 (사용량, 최근 활동)
7. ⬜ 결제 연동 (토스페이먼츠)
8. ⬜ 순위 트래킹
9. ⬜ 콘텐츠 캘린더
10. ⬜ 리포트 PDF 생성

## AI 프롬프트 가이드라인
콘텐츠 생성 시 Claude API에 보내는 시스템 프롬프트:
```
당신은 네이버 블로그 SEO 전문가입니다.
네이버의 C-Rank와 D.I.A. 알고리즘에 최적화된 블로그 글을 작성합니다.

작성 규칙:
1. 제목에 핵심 키워드를 자연스럽게 포함
2. 소제목(H2, H3)을 활용한 체계적 구조
3. 본문 2,000~3,000자 분량 (네이버 최적 길이)
4. 이미지 삽입 위치를 [이미지: 설명] 형태로 표시
5. 경험과 정보가 결합된 자연스러운 톤
6. 핵심 키워드와 관련 키워드를 본문에 자연스럽게 배치
7. 도입-본문-정리 3단 구조
8. 네이버 블로그 특유의 친근하고 읽기 쉬운 문체
9. 마지막에 관련 태그 5~10개 추천
```
