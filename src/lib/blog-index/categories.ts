/**
 * 블로그 카테고리 분류 + 카테고리별 정적 벤치마크 테이블
 *
 * 블로그 지수의 "벤치마크 비교"에서 카테고리별 차등 기준을 제공
 * - 맛집 블로그 vs IT 블로그는 이미지 비율, 포스팅 빈도 등이 크게 다름
 * - 정적 테이블(리서치 기반)을 기본으로, 축적 데이터로 점진 대체
 */

export type BlogCategory =
  | 'food'       // 맛집/카페/요리
  | 'beauty'     // 뷰티/패션
  | 'it_tech'    // IT/테크/전자기기
  | 'parenting'  // 육아/교육
  | 'travel'     // 여행/숙소
  | 'health'     // 건강/운동/의학
  | 'interior'   // 인테리어/살림/가전
  | 'finance'    // 재테크/경제/부동산
  | 'pet'        // 반려동물
  | 'hobby'      // 취미/문화/엔터
  | 'business'   // 비즈니스/마케팅
  | 'general'    // 일반 (폴백)

/** 한국어 라벨 */
export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  food: '맛집/카페',
  beauty: '뷰티/패션',
  it_tech: 'IT/테크',
  parenting: '육아/교육',
  travel: '여행/숙소',
  health: '건강/운동',
  interior: '인테리어/살림',
  finance: '재테크/경제',
  pet: '반려동물',
  hobby: '취미/문화',
  business: '비즈니스/마케팅',
  general: '일반',
}

/** 카테고리별 매칭 키워드 (블로그 주제 키워드와 대조) */
const CATEGORY_KEYWORD_MAP: Record<BlogCategory, string[]> = {
  food: [
    '맛집', '카페', '요리', '레시피', '먹방', '메뉴', '음식', '디저트', '베이커리', '식당',
    '밥', '국', '찌개', '라면', '치킨', '피자', '파스타', '초밥', '고기', '삼겹살',
    '커피', '음료', '브런치', '빵', '케이크', '쿠키', '아이스크림', '떡', '간식', '과자',
    '맛있', '먹어', '먹고', '배달', '포장', '외식', '술집', '와인', '맥주', '칵테일',
  ],
  beauty: [
    '화장품', '메이크업', '패션', '코디', '피부', '향수', '네일', '헤어', '스킨케어', '뷰티',
    '립스틱', '파운데이션', '아이섀도', '마스카라', '클렌징', '세럼', '토너', '로션', '크림',
    '옷', '스타일', '브랜드', '쇼핑', '악세서리', '가방', '신발', '아우터', '원피스',
    '다이어트', '성형', '피부과', '에스테틱',
  ],
  it_tech: [
    '프로그래밍', '코딩', '개발', '앱', '소프트웨어', '하드웨어', '전자기기', '스마트폰',
    '노트북', '컴퓨터', '태블릿', '이어폰', '스피커', '모니터', '키보드', '마우스',
    '리뷰', '언박싱', '테크', '기술', '인공지능', '블로그', '유튜브', '디지털', '웹',
    '서버', '클라우드', '데이터', '보안', '네트워크', '게임', '콘솔',
  ],
  parenting: [
    '육아', '출산', '아기', '유아', '어린이', '학습', '교육', '학교', '학원', '과외',
    '초등', '중학', '고등', '대학', '입시', '수능', '논술', '영어', '수학', '과학',
    '동화', '놀이', '장난감', '이유식', '분유', '기저귀', '유모차', '카시트', '태교',
    '엄마', '아빠', '부모', '자녀', '가족',
  ],
  travel: [
    '여행', '관광', '호텔', '리조트', '펜션', '캠핑', '글램핑', '숙소', '항공', '비행기',
    '제주', '부산', '경주', '강릉', '속초', '해외', '유럽', '동남아', '일본', '중국',
    '맛집', '명소', '관광지', '일정', '코스', '투어', '배낭', '자유여행', '패키지',
    '풍경', '사진', '드라이브', '등산', '트레킹',
  ],
  health: [
    '헬스', '운동', '다이어트', '체중', '식단', '영양', '보충제', '단백질', '비타민',
    '필라테스', '요가', '크로스핏', '러닝', '마라톤', '수영', '자전거', '등산',
    '병원', '의학', '건강', '질환', '증상', '치료', '약', '한의원', '물리치료',
    '정신건강', '스트레스', '수면', '명상', '웰빙',
  ],
  interior: [
    '인테리어', '리모델링', '수납', '정리', '청소', '가전', '가구', '소파', '침대', '책상',
    '조명', '커튼', '벽지', '타일', '주방', '욕실', '거실', '침실', '베란다', '원룸',
    '아파트', '이사', '살림', '홈카페', '셀프인테리어', '홈데코', '수납정리',
  ],
  finance: [
    '주식', '투자', '부동산', '대출', '금리', '적금', '예금', '펀드', '보험', '연금',
    '재테크', '경제', '세금', '절세', '수익', '배당', '코인', '비트코인', '암호화폐',
    '아파트', '매매', '전세', '월세', '청약', '분양', '토지', '상가',
    '사업', '창업', '부업', '수입', '지출', '가계부',
  ],
  pet: [
    '강아지', '고양이', '반려동물', '반려견', '반려묘', '펫', '사료', '간식', '산책',
    '동물병원', '예방접종', '중성화', '입양', '분양', '훈련', '미용', '목욕',
    '햄스터', '앵무새', '토끼', '물고기', '어항', '파충류',
  ],
  hobby: [
    '독서', '영화', '음악', '공연', '전시', '뮤지컬', '연극', '콘서트', '페스티벌',
    '게임', '보드게임', '퍼즐', '그림', '드로잉', '캘리그라피', '사진', '카메라',
    '자격증', '공부', '시험', '토익', '자기계발', '취미', '원데이클래스',
    '기타', '피아노', '노래', '댄스', '요가',
  ],
  business: [
    '마케팅', '블로그', '유튜브', '인스타', '광고', '브랜딩', '홍보', '콘텐츠',
    '수익', '사업', '창업', '프리랜서', '부업', '투잡', '쇼핑몰', '스마트스토어',
    '네이버', '검색', '상위노출', '키워드', '트래픽', '방문자', '클릭', '전환율',
    '영업', '컨설팅', '코칭', '강의', '세미나',
  ],
  general: [], // 폴백 — 매칭 키워드 없음
}

/**
 * 블로그 주제 키워드에서 카테고리 감지
 * analyzeTopicAuthority()가 추출한 topicKeywords (상위 5~15개)를 입력으로 사용
 *
 * @param topicKeywords 블로그 포스트에서 추출한 주제 키워드 (빈도순)
 * @returns 감지된 카테고리 (매칭 안 되면 'general')
 */
export function detectBlogCategory(topicKeywords: string[], userKeywords?: string[]): BlogCategory {
  if ((!topicKeywords || topicKeywords.length === 0) && (!userKeywords || userKeywords.length === 0)) return 'general'

  const scores: Partial<Record<BlogCategory, number>> = {}

  // 측정 키워드(사용자 입력)를 블로그 포스트 키워드와 합산 (측정 키워드 가중치 2배)
  const allKeywords = [...(topicKeywords || [])]
  if (userKeywords && userKeywords.length > 0) {
    // 사용자 키워드를 공백/쉼표로 분리하여 개별 단어로 추가
    for (const kw of userKeywords) {
      const words = kw.split(/[\s,]+/).filter(w => w.length >= 2)
      allKeywords.push(...words, ...words) // 2배 가중치
    }
  }

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORD_MAP) as [BlogCategory, string[]][]) {
    if (category === 'general') continue
    let score = 0
    for (const tk of allKeywords) {
      if (keywords.some(kw => tk.includes(kw) || kw.includes(tk))) {
        score++
      }
    }
    if (score > 0) scores[category] = score
  }

  // 최고 점수 카테고리 반환 (2개 이상 매칭 필요)
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a)
  if (sorted.length > 0 && sorted[0][1] >= 2) {
    return sorted[0][0] as BlogCategory
  }

  return 'general'
}

/** 카테고리별 예시 키워드 세트 (키워드 대량조회용, 각 카테고리 3세트 × 5개) */
export const CATEGORY_EXAMPLE_KEYWORDS: Record<BlogCategory, string[][]> = {
  food: [
    ['서울 맛집 추천', '강남 점심 맛집', '홍대 데이트 맛집', '성수 카페 추천', '이태원 브런치'],
    ['집밥 레시피', '간단 자취 요리', '밑반찬 만들기', '원팬 요리', '에어프라이어 레시피'],
    ['제주 맛집', '부산 맛집 추천', '경주 한정식', '전주 맛집', '속초 맛집'],
  ],
  beauty: [
    ['여름 메이크업', '데일리 메이크업', '피부 관리 루틴', '선크림 추천', '쿠션 추천'],
    ['원피스 코디', '여름 코디 추천', '가성비 패션', '데이트룩', '출근룩 추천'],
    ['피부과 시술 후기', '여드름 관리', '미백 세럼 추천', '클렌징 추천', '스킨케어 순서'],
  ],
  it_tech: [
    ['아이폰 16 후기', '갤럭시 비교', '무선 이어폰 추천', '노트북 추천', '태블릿 추천'],
    ['프로그래밍 입문', '파이썬 기초', '코딩 독학', '개발자 로드맵', '코딩 부트캠프'],
    ['AI 활용법', '챗GPT 사용법', '생산성 앱 추천', '클라우드 서비스 비교', '스마트홈 추천'],
  ],
  parenting: [
    ['유아 학습지 추천', '초등 영어 학원', '수학 공부법', '독서 습관', '어린이 책 추천'],
    ['이유식 레시피', '유아식 메뉴', '아기 간식 추천', '유아 반찬', '키즈 카페'],
    ['육아 꿀팁', '엄마 일상', '유아 장난감 추천', '어린이집 준비물', '육아 스트레스'],
  ],
  travel: [
    ['제주도 여행 코스', '부산 여행 2박3일', '강릉 당일치기', '속초 여행', '경주 여행'],
    ['일본 여행 준비', '오사카 맛집', '도쿄 여행', '후쿠오카 여행', '해외여행 준비물'],
    ['캠핑 용품 추천', '글램핑 추천', '차박 캠핑', '캠핑 요리', '국내 캠핑장'],
  ],
  health: [
    ['아랫배 땡김', '오른쪽 아랫배 통증', '왼쪽 아랫배 통증', '복부 팽만감', '소화불량 원인'],
    ['다이어트 식단', '간헐적 단식', '저탄고지 식단', '단백질 식품', '다이어트 운동'],
    ['홈트레이닝 루틴', '헬스 초보 루틴', '러닝 입문', '필라테스 효과', '스트레칭 방법'],
  ],
  interior: [
    ['원룸 인테리어', '자취방 꾸미기', '셀프 인테리어', '좁은방 수납', '미니멀 인테리어'],
    ['공기청정기 추천', '에어컨 추천', '로봇청소기 비교', '건조기 추천', '식기세척기 후기'],
    ['주방 정리', '옷장 수납', '욕실 청소', '곰팡이 제거', '홈카페 만들기'],
  ],
  finance: [
    ['주식 초보 입문', '배당주 추천', 'ETF 추천', '미국 주식', '주식 공부 방법'],
    ['전세 대출', '청약 조건', '아파트 매매', '부동산 투자', '신혼부부 대출'],
    ['가계부 쓰는법', '절약 방법', '적금 추천', '재테크 시작', '비상금 마련'],
  ],
  pet: [
    ['강아지 산책', '강아지 간식 추천', '강아지 사료 추천', '강아지 훈련', '강아지 미용'],
    ['고양이 사료 추천', '고양이 장난감', '고양이 모래 추천', '고양이 건강검진', '냥이 간식'],
    ['반려동물 보험', '동물병원 비용', '강아지 예방접종', '펫 호텔 추천', '반려견 입양'],
  ],
  hobby: [
    ['독서 추천', '자기계발서 추천', '소설 추천', '베스트셀러', '독서 습관'],
    ['영화 추천', '넷플릭스 추천', '드라마 추천', '예능 추천', '영화 리뷰'],
    ['자격증 추천', '토익 공부법', '컴활 독학', '자기계발', '온라인 강의 추천'],
  ],
  business: [
    ['블로그 수익화', '네이버 블로그 상위노출', '블로그 키워드', '블로그 방문자 늘리기', '블로그 글쓰기'],
    ['스마트스토어 시작', '쇼핑몰 창업', '온라인 부업', '프리랜서 시작', '투잡 추천'],
    ['인스타 마케팅', '유튜브 시작', '콘텐츠 마케팅', 'SNS 마케팅', '브랜딩 전략'],
  ],
  general: [
    ['아랫배 땡김', '오른쪽 아랫배 땡김', '왼쪽 아랫배 땡김', '아랫배 통증', '아랫배 콕콕'],
    ['다이어트 식단', '간헐적 단식', '저탄고지', '키토제닉', '단백질 식단'],
    ['서울 맛집', '강남 맛집', '홍대 맛집', '이태원 맛집', '성수 카페'],
  ],
}

/** 카테고리별 정적 벤치마크 값 */
export interface CategoryBenchmarkValues {
  postingFrequency: { recommended: number; topBlogger: number }
  avgTitleLength: { optimal: number }
  avgContentLength: { recommended: number }
  imageRate: { recommended: number }
  topicFocus: { recommended: number }
  avgImageCount: { recommended: number }
  avgCommentCount: { recommended: number }
  avgSympathyCount: { recommended: number }
  dailyVisitors: { recommended: number; topBlogger: number }
  blogAge: { recommended: number }
  totalPostCount: { recommended: number }
}

/**
 * 카테고리별 정적 벤치마크 테이블
 * 네이버 블로그 상위 노출 블로거 리서치 기반
 */
export const STATIC_CATEGORY_BENCHMARKS: Record<BlogCategory, CategoryBenchmarkValues> = {
  food: {
    postingFrequency: { recommended: 4, topBlogger: 7 },
    avgTitleLength: { optimal: 28 },
    avgContentLength: { recommended: 1500 },
    imageRate: { recommended: 95 },
    topicFocus: { recommended: 55 },
    avgImageCount: { recommended: 12 },
    avgCommentCount: { recommended: 8 },
    avgSympathyCount: { recommended: 15 },
    dailyVisitors: { recommended: 300, topBlogger: 1500 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 150 },
  },
  beauty: {
    postingFrequency: { recommended: 3, topBlogger: 6 },
    avgTitleLength: { optimal: 26 },
    avgContentLength: { recommended: 1800 },
    imageRate: { recommended: 90 },
    topicFocus: { recommended: 60 },
    avgImageCount: { recommended: 10 },
    avgCommentCount: { recommended: 6 },
    avgSympathyCount: { recommended: 12 },
    dailyVisitors: { recommended: 250, topBlogger: 1200 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 120 },
  },
  it_tech: {
    postingFrequency: { recommended: 2, topBlogger: 4 },
    avgTitleLength: { optimal: 32 },
    avgContentLength: { recommended: 2500 },
    imageRate: { recommended: 60 },
    topicFocus: { recommended: 65 },
    avgImageCount: { recommended: 5 },
    avgCommentCount: { recommended: 4 },
    avgSympathyCount: { recommended: 8 },
    dailyVisitors: { recommended: 200, topBlogger: 800 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 80 },
  },
  parenting: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 24 },
    avgContentLength: { recommended: 1500 },
    imageRate: { recommended: 85 },
    topicFocus: { recommended: 55 },
    avgImageCount: { recommended: 8 },
    avgCommentCount: { recommended: 7 },
    avgSympathyCount: { recommended: 12 },
    dailyVisitors: { recommended: 250, topBlogger: 1000 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 120 },
  },
  travel: {
    postingFrequency: { recommended: 2, topBlogger: 4 },
    avgTitleLength: { optimal: 28 },
    avgContentLength: { recommended: 2000 },
    imageRate: { recommended: 95 },
    topicFocus: { recommended: 50 },
    avgImageCount: { recommended: 15 },
    avgCommentCount: { recommended: 6 },
    avgSympathyCount: { recommended: 15 },
    dailyVisitors: { recommended: 300, topBlogger: 1500 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 100 },
  },
  health: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 30 },
    avgContentLength: { recommended: 2000 },
    imageRate: { recommended: 70 },
    topicFocus: { recommended: 65 },
    avgImageCount: { recommended: 5 },
    avgCommentCount: { recommended: 5 },
    avgSympathyCount: { recommended: 10 },
    dailyVisitors: { recommended: 200, topBlogger: 800 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 100 },
  },
  interior: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 26 },
    avgContentLength: { recommended: 1500 },
    imageRate: { recommended: 90 },
    topicFocus: { recommended: 60 },
    avgImageCount: { recommended: 10 },
    avgCommentCount: { recommended: 5 },
    avgSympathyCount: { recommended: 10 },
    dailyVisitors: { recommended: 200, topBlogger: 800 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 100 },
  },
  finance: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 30 },
    avgContentLength: { recommended: 2500 },
    imageRate: { recommended: 50 },
    topicFocus: { recommended: 70 },
    avgImageCount: { recommended: 3 },
    avgCommentCount: { recommended: 5 },
    avgSympathyCount: { recommended: 8 },
    dailyVisitors: { recommended: 250, topBlogger: 1000 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 100 },
  },
  pet: {
    postingFrequency: { recommended: 3, topBlogger: 6 },
    avgTitleLength: { optimal: 24 },
    avgContentLength: { recommended: 1200 },
    imageRate: { recommended: 95 },
    topicFocus: { recommended: 60 },
    avgImageCount: { recommended: 10 },
    avgCommentCount: { recommended: 8 },
    avgSympathyCount: { recommended: 15 },
    dailyVisitors: { recommended: 250, topBlogger: 1000 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 120 },
  },
  hobby: {
    postingFrequency: { recommended: 2, topBlogger: 4 },
    avgTitleLength: { optimal: 26 },
    avgContentLength: { recommended: 1500 },
    imageRate: { recommended: 75 },
    topicFocus: { recommended: 55 },
    avgImageCount: { recommended: 6 },
    avgCommentCount: { recommended: 5 },
    avgSympathyCount: { recommended: 10 },
    dailyVisitors: { recommended: 150, topBlogger: 600 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 80 },
  },
  business: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 30 },
    avgContentLength: { recommended: 2000 },
    imageRate: { recommended: 60 },
    topicFocus: { recommended: 70 },
    avgImageCount: { recommended: 4 },
    avgCommentCount: { recommended: 4 },
    avgSympathyCount: { recommended: 8 },
    dailyVisitors: { recommended: 200, topBlogger: 800 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 100 },
  },
  general: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 25 },
    avgContentLength: { recommended: 1500 },
    imageRate: { recommended: 80 },
    topicFocus: { recommended: 60 },
    avgImageCount: { recommended: 5 },
    avgCommentCount: { recommended: 5 },
    avgSympathyCount: { recommended: 10 },
    dailyVisitors: { recommended: 200, topBlogger: 1000 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 100 },
  },
}
