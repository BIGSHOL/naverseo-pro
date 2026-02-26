/** 검색 순위 분석 결과 (클라이언트/서버 공유 타입) */
export interface SearchRankResult {
    keyword: string
    /** 인기글 블록 포함 여부 */
    hasSmartBlock: boolean
    /** 인기글 블록 순서 (몇 번째 블록인지, null이면 미포함) */
    smartBlockOrder: number | null
    /** 상위 1~5위 블로그 유형 */
    topResults: Array<{
        rank: number
        type: string  // '최적', '준최', '카페', '포스트', '외부'
        typeDetail: string  // '최적2', '준최6' 등 세부 정보
        source: string  // 'blog.naver.com', 'cafe.naver.com' 등
        url: string    // 실제 게시물 URL
        title?: string // 게시글 제목
    }>
}
