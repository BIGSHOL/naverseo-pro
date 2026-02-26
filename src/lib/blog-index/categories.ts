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
export function detectBlogCategory(topicKeywords: string[]): BlogCategory {
  if (!topicKeywords || topicKeywords.length === 0) return 'general'

  const scores: Partial<Record<BlogCategory, number>> = {}

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORD_MAP) as [BlogCategory, string[]][]) {
    if (category === 'general') continue
    let score = 0
    for (const tk of topicKeywords) {
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
    avgContentLength: { recommended: 180 },
    imageRate: { recommended: 95 },
    topicFocus: { recommended: 55 },
    avgImageCount: { recommended: 8 },
    avgCommentCount: { recommended: 8 },
    avgSympathyCount: { recommended: 15 },
    dailyVisitors: { recommended: 300, topBlogger: 1500 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 150 },
  },
  beauty: {
    postingFrequency: { recommended: 3, topBlogger: 6 },
    avgTitleLength: { optimal: 26 },
    avgContentLength: { recommended: 200 },
    imageRate: { recommended: 90 },
    topicFocus: { recommended: 60 },
    avgImageCount: { recommended: 7 },
    avgCommentCount: { recommended: 6 },
    avgSympathyCount: { recommended: 12 },
    dailyVisitors: { recommended: 250, topBlogger: 1200 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 120 },
  },
  it_tech: {
    postingFrequency: { recommended: 2, topBlogger: 4 },
    avgTitleLength: { optimal: 32 },
    avgContentLength: { recommended: 250 },
    imageRate: { recommended: 60 },
    topicFocus: { recommended: 65 },
    avgImageCount: { recommended: 4 },
    avgCommentCount: { recommended: 4 },
    avgSympathyCount: { recommended: 8 },
    dailyVisitors: { recommended: 200, topBlogger: 800 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 80 },
  },
  parenting: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 24 },
    avgContentLength: { recommended: 180 },
    imageRate: { recommended: 85 },
    topicFocus: { recommended: 55 },
    avgImageCount: { recommended: 5 },
    avgCommentCount: { recommended: 7 },
    avgSympathyCount: { recommended: 12 },
    dailyVisitors: { recommended: 250, topBlogger: 1000 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 120 },
  },
  travel: {
    postingFrequency: { recommended: 2, topBlogger: 4 },
    avgTitleLength: { optimal: 28 },
    avgContentLength: { recommended: 220 },
    imageRate: { recommended: 95 },
    topicFocus: { recommended: 50 },
    avgImageCount: { recommended: 10 },
    avgCommentCount: { recommended: 6 },
    avgSympathyCount: { recommended: 15 },
    dailyVisitors: { recommended: 300, topBlogger: 1500 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 100 },
  },
  health: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 30 },
    avgContentLength: { recommended: 220 },
    imageRate: { recommended: 70 },
    topicFocus: { recommended: 65 },
    avgImageCount: { recommended: 4 },
    avgCommentCount: { recommended: 5 },
    avgSympathyCount: { recommended: 10 },
    dailyVisitors: { recommended: 200, topBlogger: 800 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 100 },
  },
  interior: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 26 },
    avgContentLength: { recommended: 200 },
    imageRate: { recommended: 90 },
    topicFocus: { recommended: 60 },
    avgImageCount: { recommended: 7 },
    avgCommentCount: { recommended: 5 },
    avgSympathyCount: { recommended: 10 },
    dailyVisitors: { recommended: 200, topBlogger: 800 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 100 },
  },
  finance: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 30 },
    avgContentLength: { recommended: 250 },
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
    avgContentLength: { recommended: 170 },
    imageRate: { recommended: 95 },
    topicFocus: { recommended: 60 },
    avgImageCount: { recommended: 8 },
    avgCommentCount: { recommended: 8 },
    avgSympathyCount: { recommended: 15 },
    dailyVisitors: { recommended: 250, topBlogger: 1000 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 120 },
  },
  hobby: {
    postingFrequency: { recommended: 2, topBlogger: 4 },
    avgTitleLength: { optimal: 26 },
    avgContentLength: { recommended: 180 },
    imageRate: { recommended: 75 },
    topicFocus: { recommended: 55 },
    avgImageCount: { recommended: 5 },
    avgCommentCount: { recommended: 5 },
    avgSympathyCount: { recommended: 10 },
    dailyVisitors: { recommended: 150, topBlogger: 600 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 80 },
  },
  business: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 30 },
    avgContentLength: { recommended: 230 },
    imageRate: { recommended: 60 },
    topicFocus: { recommended: 70 },
    avgImageCount: { recommended: 3 },
    avgCommentCount: { recommended: 4 },
    avgSympathyCount: { recommended: 8 },
    dailyVisitors: { recommended: 200, topBlogger: 800 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 100 },
  },
  general: {
    postingFrequency: { recommended: 3, topBlogger: 5 },
    avgTitleLength: { optimal: 25 },
    avgContentLength: { recommended: 150 },
    imageRate: { recommended: 80 },
    topicFocus: { recommended: 60 },
    avgImageCount: { recommended: 3 },
    avgCommentCount: { recommended: 5 },
    avgSympathyCount: { recommended: 10 },
    dailyVisitors: { recommended: 200, topBlogger: 1000 },
    blogAge: { recommended: 365 },
    totalPostCount: { recommended: 100 },
  },
}
