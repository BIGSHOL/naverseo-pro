/**
 * 공유 등급 시스템 유틸리티
 *
 * SEO 엔진과 DIA 엔진에서 동일한 패턴의 등급 결정 로직을
 * 범용 함수로 추출. 각 엔진은 자기 고유 테이블만 전달.
 */

/** 공통 등급 정보 구조 */
export interface GradeInfo {
  grade: string       // S/A+/A/B+/B/C/D
  label: string
  color: string
  description: string
}

/** 등급 테이블 항목: 최소 점수 + 등급 정보 */
export interface GradeTableEntry {
  minScore: number
  info: GradeInfo
}

/**
 * 점수 기반 등급 결정 (범용)
 *
 * 테이블은 minScore 내림차순으로 정렬되어 있어야 함.
 * 첫 번째로 매칭되는 등급을 반환, 없으면 마지막 등급 반환.
 */
export function determineGrade(score: number, table: GradeTableEntry[]): GradeInfo {
  for (const entry of table) {
    if (score >= entry.minScore) {
      return entry.info
    }
  }
  // 마지막 항목 (최하위 등급) 반환
  return table[table.length - 1].info
}
