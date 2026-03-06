/**
 * 공유 텍스트 유틸리티
 *
 * HTML 처리, 키워드 추출, 불용어, 유사도 등
 * blog-index/engine, content/engine 등에서 중복되던 로직을 통합
 */

/** HTML 태그 및 엔티티 제거 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .trim()
}

/** 이미지 개수 추출 (HTML에서 <img 태그 카운트) */
export function countImageMarkers(content: string): number {
  const imgMatches = content.match(/<img[\s>]/gi)
  return imgMatches ? imgMatches.length : 0
}

/** 날짜 간 일수 차이 */
export function daysBetween(date1: Date, date2: Date): number {
  return Math.floor(Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24))
}

/** YYYYMMDD 문자열 → Date 변환 */
export function parsePostDate(yyyymmdd: string): Date {
  const y = parseInt(yyyymmdd.substring(0, 4))
  const m = parseInt(yyyymmdd.substring(4, 6)) - 1
  const d = parseInt(yyyymmdd.substring(6, 8))
  return new Date(y, m, d)
}

/**
 * 한국어 불용어 세트 (통합)
 * blog-index/engine + content/engine의 불용어를 합친 목록
 */
export const STOPWORDS = new Set([
  // ── 접속사/접속부사 ──
  '그리고', '하지만', '그래서', '때문에', '또한', '그래도', '그러나', '그러면', '따라서', '그런데',
  '그러니', '그러니까', '그러므로', '그럼', '그렇지만', '더구나', '더군다나', '게다가', '뿐만아니라',
  '물론', '아울러', '동시에', '한편', '반면', '반면에', '오히려', '차라리', '심지어', '하물며',

  // ── 대명사/지시사 ──
  '이것', '그것', '저것', '여기', '거기', '저기', '이곳', '그곳', '저곳',
  '우리', '너희', '그들', '자기', '자신', '당신', '누구', '무엇', '어디', '언제',

  // ── 관형사/부사 ──
  '같은', '통해', '대한', '위한', '하는', '있는', '되는', '다양한', '중요한', '필요한',
  '어떤', '그런', '이런', '저런', '이러한', '그러한', '모든', '각각', '각자', '각종',
  '매우', '정말', '아주', '너무', '조금', '약간', '거의', '겨우', '바로', '벌써',
  '여전히', '이미', '아직', '다시', '또다시', '잠시', '잠깐', '갑자기', '드디어', '마침내',
  '완전', '진짜', '매번', '항상', '늘', '가끔', '자주', '계속', '다소', '상당히',
  '특히', '주로', '대략', '대충', '제대로', '확실히', '분명히', '아마', '혹시', '혹은',
  '반드시', '결국', '결과적', '기본적', '일반적', '전반적', '비교적', '상대적', '절대적',

  // ── 접미/의존 형태 (regex가 잡는 2글자 이상) ──
  '정도', '부분', '느낌', '편이', '셈이', '만큼', '이상', '이하', '이전', '이후',
  '나름', '덕분', '탓에', '때문', '대신', '중에', '속에', '위에', '아래',

  // ── 서술어/용언 어간 ──
  '입니다', '합니다', '있습니다', '됩니다', '것입니다', '드려요', '드립니다', '볼까요', '해보세요',
  '알아보겠', '알아볼게', '살펴보', '해볼까', '해봤어', '해봤는데', '가봤어', '먹어봤',
  '됩니다', '됐습니다', '했습니다', '봤습니다', '겠습니다', '보겠습니다', '하겠습니다',
  '아닙니다', '모릅니다', '같습니다', '봅니다', '줍니다', '됩니까', '합니까',

  // ── 블로그 상투어/인사 ──
  '블로그', '포스팅', '포스트', '게시글', '오늘은', '안녕하세요', '여러분', '이번에',
  '꿀팁', '총정리', '알아보기', '알아보자', '정리해', '모아봤', '솔직후기', '솔직',
  '공유합니다', '공유해', '기록', '일상', '나들이', '데이트', '브이로그', '일기',
  '감사합니다', '감사해요', '구독', '좋아요', '공감', '댓글', '팔로우',
  '소식', '근황', '에피소드', '셀프', '홈카페', '홈쿡', '먹방', '맛집탐방',
  '언박싱', '하울', '루틴', '챌린지', '리뷰어', '체험단', '원고료',

  // ── 블로그 제목 상투 접두/접미 ──
  '대공개', '모음집', '모음', '총망라', '핵심정리', '완벽정리', '완벽가이드',
  '필수템', '꼭봐야', '안보면손해', '놓치면후회', '강력추천', '적극추천',
  '찐후기', '찐리뷰', '리얼후기', '리얼리뷰', '생생후기', '직접체험',
  '최신판', '업데이트', '최종판',

  // ── 감탄/수식 (의미 없음) ──
  '대박', '역시', '최고', '레전드', '미쳤다', '짱이다', '존맛', '존예', '갓성비',

  // ── 기능어/조사 역할 (2글자 이상) ──
  '대해서', '통해서', '위해서', '함께', '시작', '먼저', '다음', '마지막', '관련', '경우',
  '대해', '가지', '단지', '다만', '따위', '조차', '마저', '까지', '부터', '에서',
  '때문', '통해', '위해', '인해', '관해', '향해', '대로', '만큼', '덕에',

  // ── 일반 명사 (키워드로 무의미) ──
  '만들기', '사용', '방법', '추천', '후기', '리뷰', '정보', '이야기', '소개',
  '비교', '차이', '장단점', '장점', '단점', '가격', '비용', '위치', '영업시간',
  '종류', '특징', '효과', '효능', '성분', '원리', '개념', '의미', '역할',
  '과정', '결과', '원인', '이유', '목적', '목표', '계획', '준비', '주의사항',
  '참고', '팁', '노하우', '가이드', '안내', '설명', '해설', '요약', '정리',

  // ── 시간/수량 ──
  '오늘', '내일', '어제', '요즘', '최근', '올해', '작년', '내년', '지난달', '이번달',
  '이번주', '지난주', '다음주', '올초', '연초', '연말', '상반기', '하반기',
  '번째', '한번', '두번', '세번', '처음', '나중', '중간', '초반', '후반',

  // ── 영문 불용어 ──
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was', 'were',
  'been', 'being', 'have', 'has', 'had', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'not', 'but', 'yet', 'also', 'just', 'than', 'too', 'very', 'really',
  'about', 'above', 'after', 'again', 'all', 'any', 'because', 'before',
  'below', 'between', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'only', 'own', 'same', 'into', 'over', 'under',
  'here', 'there', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'how',
])

/**
 * 텍스트에서 의미 있는 키워드 추출
 * 한글 2글자 이상, 영문 3글자 이상 단어 + 불용어 제외
 */
export function extractKoreanKeywords(text: string, customStopwords?: Set<string>): string[] {
  const stops = customStopwords || STOPWORDS
  const words = text.match(/[가-힣]{2,}|[a-zA-Z]{3,}/g) || []
  return words.map(w => w.toLowerCase()).filter(w => !stops.has(w))
}

/** 두 배열의 Jaccard 유사도 계산 (0~1) */
export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = Array.from(setA).filter(x => setB.has(x)).length
  const union = new Set(a.concat(b)).size
  return union === 0 ? 0 : intersection / union
}

/** 블로그 URL에서 블로그 ID 추출 */
/** URL에 https:// 프로토콜이 없으면 추가 (외부 링크 href용) */
export function ensureUrl(url: string): string {
  if (!url) return url
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return `https://${trimmed}`
}

export function extractBlogId(url: string): string | null {
  const match = url.match(
    /(?:blog\.naver\.com|m\.blog\.naver\.com)\/([a-zA-Z0-9_-]+)/
  )
  return match ? match[1] : null
}

/**
 * 키워드 스터핑(부자연스러운 삽입) 패턴 감지
 * 인용문 끝, 짧은 줄 끝, 근접 반복 등을 탐지
 *
 * SEO 엔진 + DIA 엔진 공용
 */
export function detectStuffingPatterns(keyword: string, content: string): { stuffedCount: number; totalCount: number; patterns: string[] } {
  // 빈 키워드 → 무한루프 방지
  if (!keyword || keyword.length === 0) return { stuffedCount: 0, totalCount: 0, patterns: [] }

  const patterns: string[] = []
  let stuffedCount = 0
  const totalCount = content.split(keyword).length - 1
  if (totalCount === 0) return { stuffedCount: 0, totalCount: 0, patterns }

  const lines = content.split('\n')
  const kwLen = keyword.length

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.includes(keyword)) continue

    // 패턴 1: 인용문 끝에 삽입 ("..." - 키워드, "..." 키워드)
    if (/[""\u201D][\s]*[-\u2013\u2014]?\s*$/.test(trimmed.replace(keyword, '').trim()) && trimmed.endsWith(keyword)) {
      stuffedCount++
      if (!patterns.includes('인용문 끝 삽입')) patterns.push('인용문 끝 삽입')
    }

    // 패턴 2: 짧은 줄에서 키워드만 단독 또는 거의 단독
    if (trimmed.length > 0 && trimmed.length < kwLen * 2 && trimmed.includes(keyword)) {
      const withoutKw = trimmed.replace(keyword, '').replace(/[#\->\s*\u00B7|]/g, '').trim()
      if (withoutKw.length < 5) {
        stuffedCount++
        if (!patterns.includes('단독 줄 삽입')) patterns.push('단독 줄 삽입')
      }
    }
  }

  // 패턴 3: 근접 반복 (100자 이내에 키워드가 2번 이상)
  let searchFrom = 0
  let prevIdx = -200
  while (true) {
    const idx = content.indexOf(keyword, searchFrom)
    if (idx === -1) break
    if (idx - prevIdx < 100 && prevIdx >= 0) {
      stuffedCount++
      if (!patterns.includes('근접 반복')) patterns.push('근접 반복')
    }
    prevIdx = idx
    searchFrom = idx + kwLen
  }

  return { stuffedCount, totalCount, patterns }
}
