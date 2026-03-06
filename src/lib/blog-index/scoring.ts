/**
 * 블로그 지수 - 개별 포스트 품질 지수 (v5.1)
 *
 * D.I.A. 알고리즘 기준 100점 만점, 6항목 평가 (객관적 지표 중심):
 *   콘텐츠 깊이(10) + 미디어 활용(20) + 구조/서식(25) + 경험 정보(25) + 제목 최적화(5) + 참여도(15)
 *
 * v5→v5.1 변경:
 * - 글자수(25→10) / 제목(10→5): 조작 용이한 지표 최소화
 * - 경험 정보(15→25): D.I.A. E-E-A-T 핵심 신호 강화
 * - 구조/서식(20→25): 문서 완성도 = 객관적 측정 가능
 * - 참여도(10→15): 댓글/공감/조회 = 가장 객관적인 결과 지표
 * - 16등급 유지 (블로그 지수와 동일 등급 체계)
 * - 미측정=0점 원칙 (무상 점수 폐지)
 */

import type { PostQuality } from './types'

/** scorePost 추가 옵션 (ScrapedPostData에서 전달) */
export interface ScorePostOpts {
  commentCount?: number | null
  sympathyCount?: number | null
  readCount?: number | null
  videoCount?: number
  tableCount?: number
  formatting?: {
    hasBold: boolean
    hasHeading: boolean
    hasFontSize: boolean
    hasColor: boolean
    hasHighlight: boolean
    hasUnderline: boolean
    count: number
  }
  linkCount?: number
  internalLinkCount?: number
}

export function scorePost(
  title: string,
  descHtml: string,
  descLength: number,
  imageCount: number,
  isScrapped = false,
  opts?: ScorePostOpts,
): PostQuality {
  let total = 0

  // ── 1. 콘텐츠 깊이 (10점) — content-quality/seo-engine과 동일 기준 (v11.1) ──
  let depthPts = 0
  if (isScrapped) {
    // 1500~2500자 최적 (블로그 지수/SEO 체크 통일 기준)
    if (descLength >= 1500 && descLength <= 2500) depthPts = 10
    else if (descLength >= 1000 && descLength < 1500) depthPts = 8
    else if (descLength > 2500 && descLength <= 3000) depthPts = 7
    else if (descLength >= 800 && descLength < 1000) depthPts = 5
    else if (descLength > 3000 && descLength <= 4000) depthPts = 3
    else if (descLength > 4000) depthPts = 0  // 과다 (content-quality 감점 구간)
    else if (descLength >= 500) depthPts = 2
    else depthPts = 1
  } else {
    // 검색 스니펫 — 최대 4점 (스크래핑 안 된 경우)
    if (descLength >= 300) depthPts = 4
    else if (descLength >= 200) depthPts = 2
    else if (descLength >= 100) depthPts = 1
  }
  total += depthPts

  // ── 2. 미디어 활용 (20점) ── (v11.1 기준 강화)
  let mediaPts = 0

  // 이미지 (0~14) — 기준 상향, 1개로는 낮은 점수
  if (isScrapped) {
    if (imageCount >= 7) mediaPts += 14
    else if (imageCount >= 5) mediaPts += 11
    else if (imageCount >= 3) mediaPts += 7
    else if (imageCount >= 2) mediaPts += 3
    else if (imageCount >= 1) mediaPts += 1  // 1개 = 1점 (이전 3점 → 1점)
  } else {
    if (imageCount >= 5) mediaPts += 10
    else if (imageCount >= 3) mediaPts += 7
    else if (imageCount >= 2) mediaPts += 3
    else if (imageCount >= 1) mediaPts += 1  // 1개 = 1점 (이전 3점 → 1점)
  }

  // 동영상 (0~4) — 스크래핑만
  const videoCount = opts?.videoCount ?? 0
  if (videoCount >= 2) mediaPts += 4
  else if (videoCount >= 1) mediaPts += 2

  // 표 (0~2) — 스크래핑만
  const tableCount = opts?.tableCount ?? 0
  if (tableCount >= 1) mediaPts += 2

  total += Math.min(mediaPts, 20)

  // ── 3. 구조/서식 (25점) — D.I.A. 문서 완성도 (v11.1 기준 강화) ──
  let structPts = 0
  const fmt = opts?.formatting

  if (fmt) {
    // 소제목 개수별 차등 (0~10) — 단순 유무가 아닌 품질 평가
    // hasHeading은 boolean이므로 개수 정보 없음 → 보수적 점수
    if (fmt.hasHeading) {
      // 소제목이 있으면 중간 점수 (실제 개수 모르므로)
      structPts += 6  // 이전 10점 → 6점으로 축소
    }

    // 서식 다양성 (0~8) — 기준 상향
    if (fmt.count >= 5) structPts += 8
    else if (fmt.count >= 4) structPts += 7
    else if (fmt.count >= 3) structPts += 5
    else if (fmt.count >= 2) structPts += 3
    else if (fmt.count >= 1) structPts += 1  // 1종 = 1점 (이전 2점)
  } else {
    // 비스크래핑: HTML에서 간접 감지
    const hasStructure = /[①②③④⑤]|[1-9]\.\s|•|▶|<b>|<strong>/.test(descHtml)
    if (hasStructure) structPts += 3  // 이전 5점 → 3점
  }

  // 구체적 데이터/수치 (0~7) — 공통, 정보성 콘텐츠 핵심
  const dataPatterns = [
    /\d+[만천백]?\s*원|₩\d+|가격/,
    /\d+분|\d+시간|영업시간/,
    /\d+km|\d+m|거리|위치/,
    /\d+개|\d+가지|\d+종/,
    /전화|연락처|주소/,
  ]
  const matchedPatterns = dataPatterns.filter(p => p.test(descHtml)).length
  if (matchedPatterns >= 3) structPts += 7
  else if (matchedPatterns >= 2) structPts += 5
  else if (matchedPatterns >= 1) structPts += 3

  total += Math.min(structPts, 25)

  // ── 4. 경험 정보 (25점) — D.I.A. E-E-A-T (v11.1 기준 강화, 키워드 남발 방지) ──
  let expPts = 0
  const contentText = descHtml.toLowerCase()

  // A. 직접 경험 키워드 (매칭 수 × 1점, 최대 7점) — 이전 10점 → 7점
  const expKeywords = [
    '직접', '체험', '후기', '경험', '사용기', '리뷰',
    '방문', '다녀', '먹어', '써봤', '써본', '입어',
    '착용', '구매후기', '실사용', '개봉기',
  ]
  const expHits = expKeywords.filter(k => contentText.includes(k)).length
  expPts += Math.min(expHits, 7)  // 최대 7점으로 축소

  // B. 감각/감정 표현 (매칭 수 × 1점, 최대 5점) — 이전 7점 → 5점
  const sensoryKeywords = [
    '맛있', '예쁘', '좋았', '별로', '아쉬', '추천',
    '만족', '불편', '편리', '깔끔', '넓', '좁',
    '조용', '시끄', '향기', '냄새',
  ]
  const sensoryHits = sensoryKeywords.filter(k => contentText.includes(k)).length
  expPts += Math.min(sensoryHits, 5)  // 최대 5점으로 축소

  // C. 구체적 정보 (매칭 수 × 1점, 최대 6점) — 이전 8점 → 6점
  const infoPatterns = [
    /\d+[만천백]?\s*원|₩/,
    /주소|위치|도로명/,
    /영업시간|운영시간|오픈/,
    /\d+분|\d+km/,
    /전화|연락|예약/,
    /주차|교통/,
    /메뉴|사이즈|크기|무게/,
    /층|호|번지/,
  ]
  const infoHits = infoPatterns.filter(p => p.test(contentText)).length
  expPts += Math.min(infoHits, 6)  // 최대 6점으로 축소

  // [감점] 경험 키워드 과다 (키워드만 나열하고 내용 없는 경우)
  if (expHits >= 8 && descLength < 800) {
    expPts -= 3
  } else if (expHits >= 5 && descLength < 500) {
    expPts -= 2
  }

  total += Math.min(Math.max(expPts, 0), 25)

  // ── 5. 제목 최적화 (5점) — 기본 체크만, 조작 용이하므로 최소 배점 ──
  let titlePts = 0
  const titleLen = title.length

  // 길이 적정 범위 (0~3)
  if (titleLen >= 15 && titleLen <= 35) titlePts += 3
  else if (titleLen >= 10 && titleLen <= 40) titlePts += 2
  else if (titleLen >= 5 && titleLen <= 50) titlePts += 1

  // 검색 의도 키워드 (0~2)
  if (/추천|후기|방법|비교|정리|가이드|리뷰|TOP|순위|꿀팁|총정리/i.test(title)) titlePts += 2

  total += Math.min(titlePts, 5)

  // ── 6. 참여도 (15점) — 가장 객관적인 결과 지표 (v11.1 기준 상향) ──
  let engagePts = 0

  // 댓글 (0~5) — 기준 상향, 1~2개는 점수 없음
  const comments = opts?.commentCount ?? 0
  if (comments >= 20) engagePts += 5
  else if (comments >= 10) engagePts += 4
  else if (comments >= 5) engagePts += 3
  else if (comments >= 3) engagePts += 2  // 이전 2개 → 3개
  // 1~2개는 점수 없음 (이전 1개=1점, 2개=2점 폐지)

  // 공감 (0~5) — 기준 상향, 1~3개는 점수 없음
  const sympathy = opts?.sympathyCount ?? 0
  if (sympathy >= 30) engagePts += 5
  else if (sympathy >= 15) engagePts += 4
  else if (sympathy >= 7) engagePts += 3  // 이전 5개 → 7개
  else if (sympathy >= 4) engagePts += 2  // 이전 2개 → 4개
  // 1~3개는 점수 없음 (이전 1개=1점, 2개=2점 폐지)

  // 조회수 (0~5) — 기준 상향
  const reads = opts?.readCount ?? 0
  if (reads >= 1500) engagePts += 5  // 이전 1000 → 1500
  else if (reads >= 700) engagePts += 4  // 이전 500 → 700
  else if (reads >= 200) engagePts += 3
  else if (reads >= 50) engagePts += 2
  else if (reads >= 10) engagePts += 1

  total += Math.min(engagePts, 15)

  // ── 감점 요소 (과도한 수량/서식은 품질 저하) ──
  let penalty = 0

  // 이미지 과다 (이미지 도배)
  if (imageCount >= 15) penalty += 5          // 심각 — 이미지 스팸
  else if (imageCount >= 11) penalty += 3     // 과다

  // 서식 과잉 (가독성 저하)
  if (fmt && fmt.count >= 6) penalty += 3     // 6종 전부 — 서식 남용
  else if (fmt && fmt.count >= 5) penalty += 1

  // 이미지:글 비율 불균형 (글은 짧은데 이미지만 많음)
  if (isScrapped && imageCount >= 7 && descLength < 1000) penalty += 3

  // 콘텐츠 과다 (패딩/스팸 — 네이버 최적 1500~3000자, 5000+ 스팸급)
  if (isScrapped && descLength >= 7000) penalty += 5
  else if (isScrapped && descLength >= 5000) penalty += 3

  // 포스트 내부 문장 반복 (글자수 부풀리기 스팸 감지)
  // HTML 태그 제거 후 문장 단위로 쪼개어 동일 문장 반복률 측정
  if (isScrapped && descLength >= 500) {
    const plainText = descHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    // 마침표/느낌표/물음표/줄바꿈으로 문장 분리, 10자 이상만 유효
    const sentences = plainText.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length >= 10)
    if (sentences.length >= 4) {
      const freq: Record<string, number> = {}
      sentences.forEach(s => { freq[s] = (freq[s] || 0) + 1 })
      const duplicateCount = Object.values(freq).reduce((sum, c) => sum + (c > 1 ? c - 1 : 0), 0)
      const repeatRate = duplicateCount / sentences.length
      if (repeatRate >= 0.4) penalty += 5        // 40%+ 문장 반복 — 심각한 복붙 스팸
      else if (repeatRate >= 0.2) penalty += 3   // 20%+ 문장 반복 — 의심
    }
  }

  total -= penalty

  // ── 최종 clamp + 16등급 매핑 (v16: 준최적화 구간 확대, grading.ts와 동기화) ──
  const score = Math.max(0, Math.min(100, total))

  let tier: number
  let category: string
  let label: string

  if (score >= 99) { tier = 16; category = '파워'; label = '파워' }
  else if (score >= 97) { tier = 15; category = '최적화+'; label = '최적화4+' }
  else if (score >= 94) { tier = 14; category = '최적화+'; label = '최적화3+' }
  else if (score >= 91) { tier = 13; category = '최적화+'; label = '최적화2+' }
  else if (score >= 86) { tier = 12; category = '최적화+'; label = '최적화1+' }
  else if (score >= 80) { tier = 11; category = '최적화'; label = '최적화3' }
  else if (score >= 73) { tier = 10; category = '최적화'; label = '최적화2' }
  else if (score >= 65) { tier = 9; category = '최적화'; label = '최적화1' }
  else if (score >= 54) { tier = 8; category = '준최적화'; label = '준최적화7' }
  else if (score >= 43) { tier = 7; category = '준최적화'; label = '준최적화6' }
  else if (score >= 33) { tier = 6; category = '준최적화'; label = '준최적화5' }
  else if (score >= 24) { tier = 5; category = '준최적화'; label = '준최적화4' }
  else if (score >= 16) { tier = 4; category = '준최적화'; label = '준최적화3' }
  else if (score >= 9) { tier = 3; category = '준최적화'; label = '준최적화2' }
  else if (score >= 3) { tier = 2; category = '준최적화'; label = '준최적화1' }
  else { tier = 1; category = '일반'; label = '일반' }

  return { score, tier, label, category }
}
