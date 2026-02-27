import Link from 'next/link'
import {
  ArrowRight, Sparkles, BarChart3, Radar,
  Check, CheckCircle, Lock, Home, FileEdit, Settings,
  Globe, Mail, Search, Wand2, TrendingUp, Clock,
  Target, BookOpen, Calendar, FileBarChart, Zap,
  Timer, AlertTriangle, DollarSign, Eye,
  LayoutDashboard, Lightbulb, Users, Activity, CalendarDays, FileDown,
  Shield, UserCog,
} from 'lucide-react'

/* ──────────────────── Logo Icon (inline SVG) ──────────────────── */
function LogoIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="13" cy="13" r="10" />
      <path d="M21 21 L29 29" />
      <path d="M7 16 L10 16 L14 10 L17 14 L22 7" strokeWidth="2" />
    </svg>
  )
}

/* ──────────────────── Navbar ──────────────────── */
function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#050505]/70 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050505]/50">
      <div className="max-w-7xl mx-auto px-6 h-16 md:h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#CCFF00]/10 flex items-center justify-center border border-[#CCFF00]/20 group">
            <LogoIcon className="h-4 w-4 text-[#CCFF00] transition-transform group-hover:scale-110" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            NaverSEO <span className="text-[#CCFF00] font-normal">Pro</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <a className="hover:text-white transition-colors" href="#features">기능</a>
          <a className="hover:text-white transition-colors" href="#pricing">가격</a>
          <a className="hover:text-white transition-colors" href="#comparison">비교</a>
          <div className="flex items-center gap-4 ml-6 pl-6 border-l border-white/10">
            <Link className="hover:text-white transition-colors" href="/login">로그인</Link>
            <Link
              href="/signup"
              className="bg-[#CCFF00] text-black hover:bg-[#B3E600] px-4 py-2 rounded-md text-sm font-semibold transition-all duration-300 shadow-lg shadow-[#CCFF00]/10"
            >
              무료로 시작하기
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

/* ──────────────────── Hero Section ──────────────────── */
function HeroSection() {
  return (
    <header className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto text-center relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-medium mb-10 hover:bg-white/10 transition-colors cursor-default backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#CCFF00] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#CCFF00]" />
          </span>
          블로그 글 1편 작성 시간: 3시간 → 10분
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.1] text-white">
          블로그 1편에 3시간?
          <br />
          <span className="text-gradient-primary">AI로 10분이면 끝납니다</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto font-light leading-relaxed tracking-wide">
          키워드 발굴부터 SEO 최적화 글 작성, 점수 분석, 순위 추적까지.
          <br className="hidden md:block" />
          월 <span className="font-semibold text-white">29,000원</span>으로 SEO 전문가를 고용하세요.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          <Link href="/signup">
            <button className="glow-button group relative px-8 py-4 bg-[#CCFF00] text-black font-bold rounded-lg transition-all flex items-center justify-center gap-2 w-full sm:w-auto hover:-translate-y-1">
              무료로 시작하기
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </Link>
          <a href="#pricing">
            <button className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium rounded-lg transition-all w-full sm:w-auto backdrop-blur-sm hover:border-white/20">
              요금제 보기
            </button>
          </a>
        </div>

        <p className="text-sm text-slate-500 mb-24">
          무료 플랜으로 바로 체험 · 신용카드 필요 없음 · 3분 만에 시작
        </p>

        {/* 3D Dashboard Mockup */}
        <DashboardMockup />

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-32 max-w-5xl mx-auto relative z-20">
          {[
            { value: '95%', label: '시간 절감 효과' },
            { value: '100점', label: 'SEO 만점 분석' },
            { value: '13개', label: 'SEO 체크 항목' },
            { value: '24/7', label: '실시간 순위 추적' },
          ].map((stat) => (
            <div key={stat.label} className="stat-card rounded-2xl p-6 text-center group">
              <div className="text-3xl font-bold text-white mb-1 group-hover:text-[#CCFF00] transition-colors">
                {stat.value}
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{stat.label}</p>
              <div className="mt-3 h-0.5 w-8 bg-[#CCFF00]/30 mx-auto rounded-full group-hover:w-16 line-expand" />
            </div>
          ))}
        </div>
      </div>
    </header>
  )
}

/* ──────────────────── Dashboard Mockup (3D) — 실제 대시보드 재현 ──────────────────── */
function DashboardMockup() {
  const circleR = 14
  const circleC = 2 * Math.PI * circleR

  return (
    <div className="perspective-container relative max-w-5xl mx-auto mt-8">
      <div className="glass-panel rounded-xl p-1.5 animate-float-3d rotate-3d relative z-10 bg-[#0A0A0A]/90 border border-white/10 shadow-2xl">
        {/* 내부는 실제 대시보드와 동일한 라이트 테마 */}
        <div className="rounded-lg overflow-hidden border border-gray-200 relative bg-white text-gray-900">
          {/* Window chrome */}
          <div className="h-10 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white rounded text-[10px] text-gray-500 font-mono border border-gray-200">
              <Lock className="h-2.5 w-2.5" />
              naverseopro.com/dashboard
            </div>
            <div className="w-4" />
          </div>

          <div className="flex">
            {/* ─── Sidebar (실제와 동일) ─── */}
            <div className="hidden md:flex flex-col w-[155px] border-r border-gray-200 bg-white p-2.5 shrink-0 justify-between">
              <div>
                {/* Logo */}
                <div className="flex items-center gap-2 mb-4 px-1">
                  <div className="h-6 w-6 bg-[#03C75A] rounded-md flex items-center justify-center">
                    <LogoIcon className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-900">NaverSEO <span className="text-[#03C75A] font-normal">Pro</span></span>
                </div>

                {/* Nav items - 실제 11개 메뉴 */}
                <div className="space-y-px">
                  {[
                    { icon: LayoutDashboard, label: '대시보드', active: true },
                    { icon: Search, label: '키워드 검색', active: false },
                    { icon: Lightbulb, label: '키워드 발굴', active: false },
                    { icon: Wand2, label: 'AI 콘텐츠 생성', active: false },
                    { icon: BarChart3, label: 'SEO 점수 체크', active: false },
                    { icon: Users, label: '상위노출 분석', active: false },
                    { icon: Activity, label: '블로그 지수', active: false },
                    { icon: TrendingUp, label: '순위 트래킹', active: false },
                    { icon: CalendarDays, label: '활동 캘린더', active: false },
                    { icon: FileDown, label: 'SEO 리포트', active: false },
                    { icon: Settings, label: '설정', active: false },
                  ].map(item => (
                    <div key={item.label} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] ${
                      item.active
                        ? 'bg-[#03C75A]/10 text-[#03C75A] font-semibold'
                        : 'text-gray-500'
                    }`}>
                      <item.icon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                  ))}
                </div>

                {/* 관리자 섹션 */}
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="text-[8px] text-gray-400 font-medium px-2 mb-1">관리자</div>
                  {[
                    { icon: Shield, label: '관리자 대시보드' },
                    { icon: UserCog, label: '사용자 관리' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] text-gray-500">
                      <item.icon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 하단 플랜 정보 */}
              <div className="mt-2 pt-2 border-t border-gray-100 px-1">
                <div className="text-[8px] text-gray-400">현재 플랜</div>
                <div className="text-[10px] font-bold text-gray-900">Pro</div>
                <div className="mt-1 space-y-1">
                  <div className="flex justify-between text-[7px]">
                    <span className="text-gray-400">키워드 조회</span>
                    <span className="text-gray-500">23/∞</span>
                  </div>
                  <div className="flex justify-between text-[7px]">
                    <span className="text-gray-400">콘텐츠 생성</span>
                    <span className="text-gray-500">7/50</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Main content (실제 대시보드와 동일) ─── */}
            <div className="flex-1 p-3.5 space-y-2.5 min-h-[400px] bg-gray-50/50 overflow-hidden">
              {/* Header */}
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-gray-900 font-bold text-sm">좋은 아침입니다</h3>
                    <span className="text-[8px] text-gray-500 border border-gray-200 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                      <Clock className="h-2 w-2" /> Pro 플랜
                    </span>
                  </div>
                  <p className="text-[9px] text-gray-400">2025년 6월 15일 — 오늘도 SEO 최적화를 시작하세요</p>
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { icon: Search, label: '키워드 검색' },
                    { icon: Wand2, label: 'AI 콘텐츠' },
                    { icon: BarChart3, label: 'SEO 체크' },
                  ].map((step, i) => (
                    <div key={step.label} className="flex items-center gap-0.5">
                      {i > 0 && <ArrowRight className="h-2 w-2 text-gray-300" />}
                      <div className="flex items-center gap-0.5 px-1.5 py-0.5 border border-gray-200 rounded text-[8px] text-gray-500 bg-white">
                        <step.icon className="h-2 w-2" /> {step.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 사용량 통계 4카드 (원형 프로그레스) */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '키워드 조회', value: '23', limit: '/ 무제한', pct: 0, color: '#3b82f6', iconType: 'infinity' as const },
                  { label: 'AI 콘텐츠', value: '7', limit: '/ 50편/월', pct: 14, color: '#8b5cf6', iconType: 'percent' as const },
                  { label: 'SEO 체크', value: '무제한', limit: '', pct: 100, color: '#22c55e', iconType: 'check' as const },
                  { label: '순위 트래킹', value: '3', limit: '/ 키워드 30개', pct: 10, color: '#f97316', iconType: 'percent' as const },
                ].map(stat => (
                  <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-2.5 flex items-center gap-2">
                    {/* Circular progress */}
                    <svg width="36" height="36" className="shrink-0">
                      <circle cx="18" cy="18" r={circleR} fill="none" stroke="#f1f5f9" strokeWidth="3" />
                      {stat.iconType === 'check' ? (
                        <circle cx="18" cy="18" r={circleR} fill="none" stroke={stat.color} strokeWidth="3"
                          strokeDasharray={circleC} strokeDashoffset={0}
                          strokeLinecap="round" transform="rotate(-90 18 18)" />
                      ) : stat.iconType === 'infinity' ? (
                        <text x="18" y="19" textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="bold" fill={stat.color}>∞</text>
                      ) : (
                        <>
                          <circle cx="18" cy="18" r={circleR} fill="none" stroke={stat.color} strokeWidth="3"
                            strokeDasharray={circleC} strokeDashoffset={circleC - (stat.pct / 100) * circleC}
                            strokeLinecap="round" transform="rotate(-90 18 18)" />
                          <text x="18" y="19" textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="bold" fill="#374151">{stat.pct}%</text>
                        </>
                      )}
                      {stat.iconType === 'check' && (
                        <text x="18" y="19" textAnchor="middle" dominantBaseline="central" fontSize="10" fill={stat.color}>✓</text>
                      )}
                    </svg>
                    <div className="min-w-0">
                      <div className="text-[8px] text-gray-400">{stat.label}</div>
                      <div className="text-[11px] font-bold text-gray-900">
                        {stat.value}
                        {stat.limit && <span className="text-[8px] font-normal text-gray-400 ml-0.5">{stat.limit}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 주간 활동 차트 (Area chart 스타일) */}
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="text-[10px] font-semibold text-gray-900 mb-2">주간 활동</div>
                <div className="relative h-[90px]">
                  {/* Y-axis grid lines */}
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="absolute w-full border-t border-gray-100" style={{ top: `${i * 33}%` }}>
                      <span className="text-[7px] text-gray-300 absolute -left-0.5 -top-1.5">{3 - i}</span>
                    </div>
                  ))}
                  {/* SVG Area curves */}
                  <svg viewBox="0 0 300 80" className="w-full h-full" preserveAspectRatio="none">
                    {/* Blue area (키워드) */}
                    <defs>
                      <linearGradient id="mockKwGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="mockCtGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 75 Q30 70 50 60 T100 30 T150 15 T200 25 T250 50 T300 65 V80 H0 Z" fill="url(#mockKwGrad)" />
                    <path d="M0 75 Q30 70 50 60 T100 30 T150 15 T200 25 T250 50 T300 65" fill="none" stroke="#3b82f6" strokeWidth="2" />
                    <path d="M0 78 Q30 75 50 72 T100 60 T150 55 T200 62 T250 70 T300 75 V80 H0 Z" fill="url(#mockCtGrad)" />
                    <path d="M0 78 Q30 75 50 72 T100 60 T150 55 T200 62 T250 70 T300 75" fill="none" stroke="#22c55e" strokeWidth="2" />
                  </svg>
                </div>
                <div className="flex items-center justify-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-0.5 rounded bg-blue-500" />
                    <span className="text-[7px] text-gray-400">키워드 조회</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-0.5 rounded bg-green-500" />
                    <span className="text-[7px] text-gray-400">콘텐츠 생성</span>
                  </div>
                </div>
              </div>

              {/* 오늘의 추천 */}
              <div className="bg-[#03C75A]/5 border border-[#03C75A]/20 rounded-lg p-2.5 border-l-4 border-l-[#03C75A]">
                <div className="flex items-start gap-2">
                  <div className="rounded-md bg-[#03C75A]/10 p-1.5 shrink-0">
                    <Lightbulb className="h-3 w-3 text-[#03C75A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-semibold text-gray-900">오늘의 추천</div>
                    <p className="text-[8px] text-gray-500 mt-0.5">최근 검색 기록을 바탕으로 추천 키워드를 준비했습니다.</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {['다이어트 식단', '다이어트 식단 추천', '다이어트 식단 방법', '다이어트 식단 후기'].map(kw => (
                        <span key={kw} className="text-[7px] text-gray-600 border border-gray-200 bg-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Wand2 className="h-1.5 w-1.5" />{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 콘텐츠 현황 */}
              <div className="bg-white border border-gray-200 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-gray-900">콘텐츠 현황</span>
                  <span className="text-[8px] text-gray-400">총 9개</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Status bar */}
                  <div className="flex-1">
                    <div className="flex h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-400" style={{ width: '67%' }} />
                      <div className="bg-green-500" style={{ width: '22%' }} />
                      <div className="bg-gray-300" style={{ width: '11%' }} />
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="flex items-center gap-0.5 text-[7px] text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />초안 6</span>
                      <span className="flex items-center gap-0.5 text-[7px] text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />발행 2</span>
                      <span className="flex items-center gap-0.5 text-[7px] text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-gray-300" />보관 1</span>
                    </div>
                  </div>
                  {/* 평균 SEO */}
                  <div className="flex items-center gap-1.5 border border-gray-200 rounded-md px-2 py-1.5 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-[8px] font-bold">82</div>
                    <div>
                      <div className="text-[8px] font-medium text-gray-900">평균 SEO</div>
                      <div className="text-[7px] text-gray-400">최적화 우수</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 빠른 시작 */}
              <div>
                <div className="text-[8px] text-gray-400 font-medium mb-1">빠른 시작</div>
                <div className="flex items-center gap-1">
                  {[
                    { icon: Search, label: '키워드', bg: 'bg-blue-50 text-blue-600' },
                    { icon: Lightbulb, label: '발굴', bg: 'bg-amber-50 text-amber-600' },
                    { icon: Wand2, label: 'AI 콘텐츠', bg: 'bg-purple-50 text-purple-600' },
                    { icon: BarChart3, label: 'SEO 체크', bg: 'bg-green-50 text-green-600' },
                    { icon: Users, label: '상위분석', bg: 'bg-rose-50 text-rose-600' },
                    { icon: Activity, label: '블로그지수', bg: 'bg-cyan-50 text-cyan-600' },
                    { icon: TrendingUp, label: '순위추적', bg: 'bg-orange-50 text-orange-600' },
                    { icon: CalendarDays, label: '캘린더', bg: 'bg-indigo-50 text-indigo-600' },
                    { icon: FileDown, label: '리포트', bg: 'bg-teal-50 text-teal-600' },
                  ].map(action => (
                    <div key={action.label} className="flex flex-col items-center gap-0.5 flex-1 py-1 rounded-lg border border-gray-200 bg-white">
                      <div className={`rounded p-1 ${action.bg}`}>
                        <action.icon className="h-2 w-2" />
                      </div>
                      <span className="text-[7px] text-gray-500 font-medium">{action.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Glow behind mockup */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] bg-[#03C75A]/15 blur-[120px] -z-10 rounded-full mix-blend-screen pointer-events-none" />
    </div>
  )
}

/* ──────────────────── Problem Section ──────────────────── */
function ProblemSection() {
  const problems = [
    { icon: Timer, title: '키워드 선정에 1시간+', desc: '어떤 키워드가 상위 노출 가능한지, 검색량은 얼마나 되는지 일일이 조사', impact: '월 20시간 낭비' },
    { icon: Clock, title: '글 1편에 3~4시간', desc: '키워드 배치, 소제목 구조, 이미지 위치까지 고려하면 반나절', impact: '월 48시간 소모' },
    { icon: AlertTriangle, title: '노출 안 되는 이유를 모름', desc: '열심히 썼는데 검색에 안 잡히고, 뭐가 문제인지 파악 불가', impact: '노력 대비 성과 0' },
    { icon: DollarSign, title: 'SEO 대행 월 50~200만원', desc: '전문 대행사에 맡기면 비용이 부담스럽고, 퀄리티도 제각각', impact: '연 600~2,400만원' },
  ]

  return (
    <section className="py-32 px-6 bg-[#0F1012] relative border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <span className="text-red-400 text-xs font-bold uppercase tracking-widest mb-4 block">Problem</span>
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white tracking-tight">
            블로그 운영,
            <br />
            <span className="text-slate-500">이런 고민 있으시죠?</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {problems.map((p) => (
            <div key={p.title} className="bento-card rounded-2xl p-8 relative overflow-hidden group">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center mb-4 text-red-400 border border-red-500/20">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{p.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">{p.desc}</p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                {p.impact}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────── Features (Bento Grid) ──────────────────── */
function FeaturesSection() {
  return (
    <section id="features" className="py-32 px-6 bg-[#050505] relative border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <span className="text-[#CCFF00] text-xs font-bold uppercase tracking-widest mb-4 block">Features</span>
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white tracking-tight">
            블로그 SEO의 모든 것,
            <br />
            <span className="text-slate-500">한 곳에서 해결</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg font-light">
            키워드 검색부터 AI 글쓰기, SEO 분석, 순위 추적까지 올인원으로.
          </p>
        </div>

        {/* Core Features - Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 mb-8 md:h-[600px]">
          {/* Large card - AI Content */}
          <div className="md:col-span-2 md:row-span-2 bento-card rounded-3xl p-8 md:p-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#CCFF00]/10 rounded-full blur-[80px] -z-10 transition-opacity opacity-50 group-hover:opacity-100" />
            <div className="flex flex-col h-full justify-between relative z-10">
              <div>
                <div className="w-12 h-12 bg-[#CCFF00]/10 rounded-xl flex items-center justify-center mb-6 text-[#CCFF00] border border-[#CCFF00]/20 shadow-[0_0_15px_rgba(204,255,0,0.15)]">
                  <Wand2 className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-2xl font-bold text-white">AI 콘텐츠 생성</h3>
                  <span className="text-xs text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded font-medium">3시간 → 10분</span>
                </div>
                <p className="text-slate-400 leading-relaxed max-w-md">
                  키워드만 입력하면 AI가 네이버 C-Rank, D.I.A. 알고리즘에 최적화된
                  2,000~3,000자 블로그 글을 자동으로 작성합니다.
                  소제목 구조, 이미지 위치, 태그까지 완벽하게.
                </p>
              </div>

              {/* Content Generation UI Preview */}
              <div className="mt-10 bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden backdrop-blur-md transform transition-all duration-500 group-hover:translate-y-[-5px] group-hover:border-[#CCFF00]/30 shadow-2xl">
                {/* Top bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-3.5 w-3.5 text-[#CCFF00]" />
                    <span className="text-xs font-semibold text-white">AI 콘텐츠 생성</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">Gemini Flash / Claude Sonnet</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
                  </div>
                </div>

                <div className="grid grid-cols-12 divide-x divide-white/5">
                  {/* Left: Input & Generation */}
                  <div className="col-span-8 p-5 space-y-4">
                    {/* Keyword input mock */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                        <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="text-sm text-white">다이어트 식단 추천</span>
                      </div>
                      <div className="bg-[#CCFF00] text-black text-xs font-bold px-4 py-2 rounded-lg shrink-0 shadow-[0_0_15px_rgba(204,255,0,0.2)]">
                        AI 생성
                      </div>
                    </div>

                    {/* Data enrichment badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                        <BarChart3 className="h-2.5 w-2.5 text-blue-400" />
                        <span className="text-[10px] text-blue-300">검색광고 연관 키워드 15개</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
                        <span className="text-[10px] text-emerald-300">12개월 트렌드 상승</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                        <Eye className="h-2.5 w-2.5 text-purple-400" />
                        <span className="text-[10px] text-purple-300">상위 5개 글 분석 완료</span>
                      </div>
                    </div>

                    {/* Generated content preview */}
                    <div className="bg-[#111] border border-white/5 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-3 w-3 text-[#CCFF00]" />
                        <span className="text-[10px] text-[#CCFF00] font-medium">AI 생성 완료 · 2,847자 · 소요시간 12초</span>
                      </div>
                      <h4 className="text-white font-bold text-sm leading-snug">
                        2025 다이어트 식단 추천: 영양사가 알려주는 건강하게 살 빠지는 일주일 메뉴
                      </h4>
                      <div className="space-y-2.5">
                        <div className="flex items-start gap-2">
                          <span className="text-[#CCFF00] text-[10px] font-bold mt-0.5 shrink-0">H2</span>
                          <div>
                            <span className="text-xs text-white font-medium">다이어트 식단, 왜 '제대로' 먹어야 할까?</span>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                              무작정 굶는 다이어트는 요요 현상을 부릅니다. 영양소 균형을 맞춘 식단이야말로...
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-blue-400 text-[10px] font-bold mt-0.5 shrink-0">H2</span>
                          <div>
                            <span className="text-xs text-white font-medium">월~금 5일 다이어트 식단표 (1,500kcal 기준)</span>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                              [이미지: 일주일 식단표 인포그래픽] 아침은 단백질 위주로, 점심은 균형 잡힌...
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-purple-400 text-[10px] font-bold mt-0.5 shrink-0">H2</span>
                          <div>
                            <span className="text-xs text-white font-medium">직장인을 위한 간편 다이어트 도시락 레시피</span>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-1">
                              바쁜 아침에도 10분이면 준비할 수 있는 도시락 레시피 3가지를 소개합니다...
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                        <span className="text-[10px] text-slate-500">추천 태그:</span>
                        {['다이어트식단', '식단추천', '건강식단', '다이어트레시피', '1500칼로리'].map(tag => (
                          <span key={tag} className="text-[9px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: SEO Score & Analytics */}
                  <div className="col-span-4 p-5 space-y-4">
                    {/* SEO Score Circle */}
                    <div className="text-center">
                      <div className="relative inline-flex items-center justify-center">
                        <svg className="w-20 h-20 transform -rotate-90">
                          <circle cx="40" cy="40" r="34" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                          <circle cx="40" cy="40" r="34" fill="transparent" stroke="#CCFF00" strokeWidth="6"
                            strokeDasharray={`${2 * Math.PI * 34 * 0.94} ${2 * Math.PI * 34}`}
                            strokeLinecap="round" />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-xl font-bold text-white">94</span>
                          <span className="text-[8px] text-slate-500">/ 100</span>
                        </div>
                      </div>
                      <div className="mt-1 text-[10px] text-[#CCFF00] font-medium">SEO 최적화 우수</div>
                    </div>

                    {/* Checklist */}
                    <div className="space-y-1.5">
                      {[
                        { label: '제목 키워드 배치', ok: true },
                        { label: '본문 길이 2,847자', ok: true },
                        { label: '소제목 구조 (H2×3)', ok: true },
                        { label: '이미지 위치 (4개)', ok: true },
                        { label: '키워드 밀도 2.1%', ok: true },
                        { label: '태그 추천 (5개)', ok: true },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <CheckCircle className="h-3 w-3 text-[#CCFF00] shrink-0" />
                          <span className="text-[10px] text-slate-300">{item.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Keyword stats mini */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 space-y-2">
                      <div className="text-[10px] text-slate-500 font-medium">핵심 키워드 분석</div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-300">다이어트 식단</span>
                          <span className="text-[9px] text-[#CCFF00]">월 74,000</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#CCFF00] w-[85%] rounded-full" />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-300">다이어트 레시피</span>
                          <span className="text-[9px] text-blue-400">월 32,100</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 w-[55%] rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Keyword Research */}
          <div className="bento-card rounded-3xl p-8 relative overflow-hidden group">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 text-blue-400 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
              <Search className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-white">키워드 검색</h3>
              <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">1시간 → 30초</span>
            </div>
            <p className="text-sm text-slate-400 mb-6">네이버 검색량, 경쟁도, 추천 점수를 실시간으로 분석합니다.</p>
            <div className="absolute bottom-4 right-4 w-24 h-16 opacity-40 group-hover:opacity-100 transition-opacity">
              <div className="flex items-end justify-between h-full gap-1">
                <div className="w-full bg-blue-500/20 h-[30%] rounded-sm" />
                <div className="w-full bg-blue-500/40 h-[50%] rounded-sm" />
                <div className="w-full bg-blue-500/60 h-[40%] rounded-sm" />
                <div className="w-full bg-blue-500 h-[80%] rounded-sm" />
              </div>
            </div>
          </div>

          {/* SEO Score Analysis */}
          <div className="bento-card rounded-3xl p-8 relative overflow-hidden group">
            <div className="w-10 h-10 bg-[#CCFF00]/10 rounded-xl flex items-center justify-center mb-4 text-[#CCFF00] border border-[#CCFF00]/20 group-hover:bg-[#CCFF00]/20 transition-colors">
              <Target className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">SEO 점수 분석</h3>
            <p className="text-sm text-slate-400 mb-6">13개 항목 100점 만점으로 정밀 분석. 개선 가이드까지.</p>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full border-4 border-[#CCFF00]/20 flex items-center justify-center">
              <span className="text-lg font-bold text-[#CCFF00]/60">100</span>
            </div>
          </div>
        </div>

        {/* Bonus Features Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: TrendingUp, label: '순위 트래킹', desc: '자동 추적' },
            { icon: Eye, label: '상위노출 분석', desc: '패턴 분석' },
            { icon: Sparkles, label: '키워드 발굴', desc: '블루오션' },
            { icon: BookOpen, label: '블로그 지수', desc: '등급 진단' },
            { icon: FileBarChart, label: 'SEO 리포트', desc: 'PDF 생성' },
          ].map((feat) => (
            <div key={feat.label} className="bento-card rounded-2xl p-5 text-center group hover:border-[#CCFF00]/20">
              <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center mx-auto mb-3 text-slate-400 group-hover:text-[#CCFF00] group-hover:bg-[#CCFF00]/10 transition-colors">
                <feat.icon className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold text-white mb-0.5">{feat.label}</div>
              <div className="text-[10px] text-slate-500">{feat.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────── Comparison Table ──────────────────── */
function ComparisonSection() {
  const rows = [
    { feature: '키워드 검색', before: '1시간+ 수작업', after: '30초 자동 분석' },
    { feature: '블로그 글 작성', before: '3~4시간', after: '10분 AI 생성' },
    { feature: 'SEO 최적화', before: '감에 의존', after: '100점 만점 자동 분석' },
    { feature: '순위 모니터링', before: '매일 수동 확인', after: '자동 추적 & 알림' },
    { feature: '월 비용', before: '₩500,000~₩2,000,000', after: '₩29,000부터', highlight: true },
  ]

  return (
    <section id="comparison" className="py-32 px-6 bg-[#0F1012] border-t border-white/5 relative">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <span className="text-[#CCFF00] text-xs font-bold uppercase tracking-widest mb-4 block">Comparison</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">비효율적인 방식과의 작별</h2>
          <p className="text-slate-400">SEO 대행사나 프리랜서 고용 대비 압도적인 효율을 경험하세요.</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#050505]/50 backdrop-blur-sm">
          {/* Header */}
          <div className="grid grid-cols-12 border-b border-white/10 bg-white/[0.02]">
            <div className="col-span-4 p-5 text-sm font-semibold text-slate-400 uppercase tracking-wider">항목</div>
            <div className="col-span-4 p-5 text-center text-sm font-semibold text-slate-500 uppercase tracking-wider border-l border-white/5">기존 방식</div>
            <div className="col-span-4 p-5 text-center text-sm font-bold text-[#CCFF00] uppercase tracking-wider border-l border-white/5 bg-[#CCFF00]/5">NaverSEO Pro</div>
          </div>

          {rows.map((row, i) => (
            <div key={row.feature} className={`grid grid-cols-12 group hover:bg-white/[0.02] transition-colors ${i < rows.length - 1 ? 'border-b border-white/5' : ''}`}>
              <div className="col-span-4 p-5 flex items-center text-white font-medium text-sm">{row.feature}</div>
              <div className="col-span-4 p-5 flex items-center justify-center text-slate-500 text-sm border-l border-white/5">{row.before}</div>
              <div className="col-span-4 p-5 flex items-center justify-center font-bold border-l border-white/5 bg-[#CCFF00]/[0.02] group-hover:bg-[#CCFF00]/5 transition-colors">
                {row.feature === '월 비용' && <Zap className="h-4 w-4 text-[#CCFF00] mr-2" />}
                <span className={row.highlight ? 'text-[#CCFF00] text-lg' : 'text-white text-sm'}>{row.after}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Cost summary */}
        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm">
            대행사 대비 <span className="text-[#CCFF00] font-bold">최대 98% 절감</span> ·
            프리랜서 대비 <span className="text-[#CCFF00] font-bold">최대 97% 절감</span>
          </p>
        </div>
      </div>
    </section>
  )
}

/* ──────────────────── Pricing Section ──────────────────── */
function PricingSection() {
  const plans = [
    {
      name: 'Free',
      desc: '무료로 체험해보세요',
      price: '₩0',
      priceNote: '무료',
      popular: false,
      badge: '3가지 기능',
      features: ['월 30 크레딧', '키워드 검색', 'SEO 점수 체크', '블로그 지수 분석'],
      cta: '무료 시작하기',
      ctaLink: '/signup',
    },
    {
      name: 'Lite',
      desc: '크레딧당 ₩99 · 부담 없이 시작',
      price: '₩9,900',
      priceNote: '/월',
      popular: false,
      badge: '5가지 기능',
      features: ['월 100 크레딧', 'Free 기능 포함', '+ AI 콘텐츠 생성', '+ SEO 리포트', '프리미엄 AI'],
      cta: '시작하기',
      ctaLink: '/signup',
    },
    {
      name: 'Starter',
      desc: '크레딧당 ₩75 · ~25% 할인',
      price: '₩29,900',
      priceNote: '/월',
      popular: false,
      badge: '전체 기능',
      features: ['월 400 크레딧', '모든 기능 사용', '키워드 발굴', '순위 트래킹', '프리미엄 AI'],
      cta: '시작하기',
      ctaLink: '/signup',
    },
    {
      name: 'Pro',
      desc: '크레딧당 ₩67 · ~33% 할인',
      price: '₩49,900',
      priceNote: '/월',
      popular: true,
      badge: '전체 기능',
      features: ['월 750 크레딧', '모든 기능 사용', 'AI 콘텐츠 ~150편/월', '대량 키워드 분석', '우선 지원'],
      cta: '가장 인기 있는 플랜',
      ctaLink: '/signup',
    },
    {
      name: 'Business',
      desc: '크레딧당 ₩59 · ~41% 할인',
      price: '₩99,900',
      priceNote: '/월',
      popular: false,
      badge: '전체 기능',
      features: ['월 1,700 크레딧', '모든 기능 사용', 'AI 콘텐츠 ~340편/월', '대규모 순위 트래킹', '전담 매니저'],
      cta: '시작하기',
      ctaLink: '/signup',
    },
    {
      name: 'Agency',
      desc: '크레딧당 ₩50 · ~50% 할인',
      price: '₩149,900',
      priceNote: '/월',
      popular: false,
      badge: '전체 기능',
      features: ['월 3,000 크레딧', '모든 기능 사용', 'AI 콘텐츠 ~600편/월', '전담 매니저', 'API 접근'],
      cta: '문의하기',
      ctaLink: '/signup',
    },
  ]

  return (
    <section id="pricing" className="py-32 px-6 bg-[#050505] relative overflow-hidden border-t border-white/5">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_rgba(204,255,0,0.05)_0%,_transparent_70%)] pointer-events-none" />
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-24">
          <span className="text-[#CCFF00] text-xs font-bold uppercase tracking-widest mb-4 block">Pricing</span>
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">심플하고 투명한 요금제</h2>
          <p className="text-slate-400">숨겨진 비용 없이, 필요한 기능만 골라 합리적으로 이용하세요.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`p-7 rounded-3xl flex flex-col h-full relative group transition-all ${
                plan.popular
                  ? 'bg-[#111] border border-[#CCFF00]/40 shadow-[0_0_40px_rgba(204,255,0,0.05)] md:-translate-y-4 z-10'
                  : 'bg-[#0A0A0A] border border-white/5 hover:border-white/10'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#CCFF00] text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-[#CCFF00]/20">
                  가장 인기
                </div>
              )}
              <h3 className="font-bold text-xl text-white mb-1">{plan.name}</h3>
              <p className={`text-xs mb-5 ${plan.popular ? 'text-[#CCFF00]' : 'text-slate-500'}`}>{plan.desc}</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className={`font-bold text-white ${plan.popular ? 'text-4xl' : 'text-3xl'}`}>{plan.price}</span>
                <span className="text-slate-500 text-sm">{plan.priceNote}</span>
              </div>
              <ul className="space-y-3 mb-6 flex-grow">
                {plan.features.map((feat) => (
                  <li key={feat} className={`flex items-center gap-2.5 text-sm ${plan.popular ? 'text-white font-medium' : 'text-slate-400'}`}>
                    {plan.popular
                      ? <CheckCircle className="h-4 w-4 text-[#CCFF00] shrink-0" />
                      : <Check className="h-4 w-4 text-white/50 shrink-0" />
                    }
                    {feat}
                  </li>
                ))}
              </ul>
              <Link href={plan.ctaLink}>
                <button
                  className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
                    plan.popular
                      ? 'bg-[#CCFF00] text-black hover:bg-[#B3E600] shadow-[0_0_20px_rgba(204,255,0,0.3)] group-hover:scale-[1.02]'
                      : 'border border-white/10 text-white hover:bg-white/5'
                  }`}
                >
                  {plan.cta}
                </button>
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          7일 이내 전액 환불 보장 · 언제든 플랜 변경 가능 · 장기 계약 없음
        </p>
      </div>
    </section>
  )
}

/* ──────────────────── CTA Section ──────────────────── */
function CtaSection() {
  return (
    <section className="py-32 px-6 bg-[#0F1012] text-center relative border-t border-white/5">
      <div className="absolute inset-0 bg-hero-mesh opacity-20 pointer-events-none" />
      <div className="max-w-3xl mx-auto relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-8 text-white tracking-tight">
          콘텐츠 제작이 아닌,
          <br />
          <span className="text-gradient-primary">성과에 집중하세요</span>
        </h2>
        <p className="text-lg text-slate-400 mb-12 font-light leading-relaxed">
          월 29,000원으로 SEO 전문 도구를 도입하세요.
          <br className="hidden sm:block" />
          매달 50시간 이상을 절약하고, 상위 노출 전략에 집중할 수 있습니다.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup">
            <button className="glow-button px-10 py-4 bg-[#CCFF00] text-black font-bold rounded-lg shadow-lg transition-all text-lg w-full sm:w-auto">
              무료로 시작하기
            </button>
          </Link>
          <a href="mailto:support@naverseopro.com">
            <button className="px-10 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-lg hover:bg-white/10 transition-all text-lg w-full sm:w-auto">
              문의하기
            </button>
          </a>
        </div>

        {/* Trust signals */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          {[
            '3분 만에 가입 완료',
            '무료 체험 후 결정',
            '7일 환불 보장',
            '장기 계약 없음',
          ].map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#CCFF00] rounded-full" />
              {t}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────── Footer ──────────────────── */
function Footer() {
  return (
    <footer className="py-16 px-6 bg-[#020202] border-t border-white/5 text-sm">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded bg-[#CCFF00]/20 flex items-center justify-center border border-[#CCFF00]/30">
                <LogoIcon className="h-3 w-3 text-[#CCFF00]" />
              </div>
              <span className="text-base font-bold text-white">
                NaverSEO <span className="text-[#CCFF00] font-normal">Pro</span>
              </span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed max-w-xs">
              AI 기반 네이버 블로그 SEO 올인원 도구.
              <br />
              키워드 검색부터 AI 글쓰기, SEO 분석, 순위 추적까지.
            </p>
          </div>
          <div className="flex gap-12">
            <div>
              <h4 className="font-bold text-white mb-3">서비스</h4>
              <ul className="space-y-2 text-slate-500">
                <li><a className="hover:text-[#CCFF00] transition-colors" href="#features">기능 소개</a></li>
                <li><a className="hover:text-[#CCFF00] transition-colors" href="#pricing">요금제</a></li>
                <li><a className="hover:text-[#CCFF00] transition-colors" href="#comparison">비교</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">법적 고지</h4>
              <ul className="space-y-2 text-slate-500">
                <li><Link className="hover:text-[#CCFF00] transition-colors" href="/terms">이용약관</Link></li>
                <li><Link className="hover:text-[#CCFF00] transition-colors" href="/privacy">개인정보처리방침</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-600">
          <div className="text-xs">&copy; 2025 NaverSEO Pro. All rights reserved.</div>
          <div className="flex gap-4">
            <a className="hover:text-white transition-colors" href="#"><Globe className="h-4 w-4" /></a>
            <a className="hover:text-white transition-colors" href="mailto:support@naverseopro.com"><Mail className="h-4 w-4" /></a>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ──────────────────── Main Page ──────────────────── */
export default function MockupPage() {
  return (
    <>
      {/* Global mesh background */}
      <div className="fixed inset-0 bg-hero-mesh pointer-events-none z-0 opacity-80" />

      <Navbar />
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <ComparisonSection />
      <PricingSection />
      <CtaSection />
      <Footer />
    </>
  )
}
