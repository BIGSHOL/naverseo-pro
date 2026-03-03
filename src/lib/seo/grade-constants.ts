/**
 * SEO 뱃지 상수 데이터
 * Tailwind CSS 중복 길이를 피하기 위해 gradeColor, badgeColor 정의를 중앙 집중화합니다.
 */

export const GRADE_BADGES: Record<number, string> = {
    16: 'bg-amber-100 text-amber-700 border-amber-300 border-2 motion-safe:animate-grade-glow font-bold',
    15: 'bg-emerald-100 text-emerald-700 border-emerald-300 border-2 motion-safe:animate-grade-pulse-strong font-bold',
    14: 'bg-emerald-100 text-emerald-700 border-emerald-300 motion-safe:animate-grade-pulse-subtle font-semibold',
    13: 'bg-teal-100 text-teal-700 border-teal-300 shadow-sm font-semibold',
    12: 'bg-teal-100 text-teal-700 border-teal-300',
    11: 'bg-green-100 text-green-700 border-green-300',
    10: 'bg-green-100 text-green-700 border-green-300',
    9: 'bg-lime-100 text-lime-700 border-lime-300',
    8: 'bg-blue-100 text-blue-700 border-blue-300',
    7: 'bg-blue-100 text-blue-700 border-blue-300',
    6: 'bg-sky-100 text-sky-700 border-sky-300',
    5: 'bg-sky-100 text-sky-700 border-sky-300',
    4: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    3: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    2: 'bg-violet-100 text-violet-700 border-violet-300',
    1: 'bg-slate-100 text-slate-700 border-slate-300',
}
