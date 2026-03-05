# NaverSEO Pro 디자인 리팩토링 계획서

본 문서는 현재 **NaverSEO Pro**의 UI/UX 디자인을 보다 신뢰성 있고 전문적인 B2B SaaS 수준으로 향상시키기 위한 리팩토링 계획입니다. 

## 1. 디자인 목표 (Design Goals)
* **신뢰성 (Reliability):** 사용자가 서비스를 이용하며 데이터(순위, 분석 등)에 대한 확신을 가질 수 있도록 차분하고 정돈된 톤 앤 매너 구축.
* **전문성 (Professionalism):** 트렌디한 SaaS 스타일(예: Vercel, Stripe, Linear)을 벤치마킹하여 완성도 높은 마감 처리.
* **가독성 (Readability):** 텍스트와 데이터 차트의 가독성을 극대화하는 타이포그래피 및 여백(Whitespace) 개선.

---

## 2. 세부 개선 계획 (Actionable Steps)

### 2.1. 컬러 팔레트 (Color Palette) 고도화
현재 기본 Shadcn 테마(순백색/순흑색)와 날카로운 네이버 그린을 사용 중입니다. 이를 더 세련되게 다듬어야 합니다.
* **배경 및 표면 (Background & Surface):**
  * **Light Mode:** 완전한 흰색(`#ffffff`)보다는 눈이 편안한 오프화이트(예: `#FAFAFA`)를 배경으로 하고, 카드 컴포넌트에 완전한 흰색 사용.
  * **Dark Mode:** 단순한 검은색이 아닌, 깊이감 있는 슬레이트 다크(Slate Dark, 예: `#09090B` 또는 어두운 네이비 계열) 적용.
* **브랜드 컬러 (Primary Color):**
  * 기존의 강렬한 초록색을 모던하게 톤다운(예: `#00C755` -> `#03B550` 또는 그라데이션 적용)하여 신뢰감을 주도록 변경.
* **테두리(Borders) 및 디바이더:**
  * 대비를 약간 낮춰 UI 선이 시선을 빼앗지 않도록 아주 옅은 보더 컬러 적용.

### 2.2. 타이포그래피 (Typography) 개선
현재 `Geist` 폰트를 사용 중이나, 한글 렌더링에 있어서 가독성과 전문성을 높이기 폰트 전략 재정비가 필요합니다.
* **한글 폰트 최적화:** `Pretendard` 웹 폰트를 필수적으로 도입하여, 국영문 혼용 시 이질감을 없애고 깨끗하고 정교한 텍스트 렌더링 확보.
* **자간 및 행간 조절:** 
  * 제목(Headings): 자간을 좁게(`tracking-tight`) 설정하여 밀도감 부여.
  * 본문(Body): 행간을 넓게(`leading-relaxed`) 설정하여 가독성 증대.
* **위계(Hierarchy) 강화:** 그레이스케일을 활용해 정보의 중요도에 따라 텍스트 색상(`text-foreground`, `text-muted-foreground`) 철저히 분리.

### 2.3. 레이아웃 및 여백 (Layout & Whitespace)
* **여백(Whitespace) 활용:** 화면이 좁고 답답해 보이지 않도록 섹션 간의 여백(Margin)과 카드 내부 패딩(Padding)을 여유롭게 확장 (최소 `p-6` 이상 사용).
* **그리드 및 비율 완벽 맞춤:** Dashboard의 위젯 및 카드들이 일관된 비율을 갖도록 CSS Grid 시스템 최적화.
* **내비게이션 바/사이드바:**
  * 반투명(Glassmorphism) 효과(예: `backdrop-blur`)를 미세하게 주어 현대적인 느낌 추가.
  * 활성화된 메뉴 아이템에만 브랜드 컬러 강조 및 부드러운 전환 효과(Transition).

### 2.4. UI 컴포넌트 마감 처리 (Component Polish)
* **그림자 (Shadows & Elevation):** 
  * 무겁고 진한 그림자 대신, 블러(Blur) 값이 높고 투명도가 낮은 부드러운 다중 그림자 적용 (예: `shadow-[0px_2px_8px_0px_rgba(0,0,0,0.04)]`).
* **모서리 둥글기 (Border Radius):**
  * 현재 `0.5rem`으로 일괄 적용된 반경을 요소의 크기에 따라 세밀하게 조정. 큰 컨테이너는 `xl(12px)`나 `2xl(16px)`, 작은 버튼은 `md(6px)`.
* **버튼 (Buttons):**
  * 호버(Hover), 액티브(Active), 포커스(Focus) 상태에 대한 시각적 피드백 강화 (`transition-all duration-200`).
  * Primary Button안에 은은한 그라데이션이나 내부 그림자(Inner Shadow)를 주어 클릭 가능함을 명확히 함.

### 2.5. 데이터 시각화 (Data Visualization / Recharts)
SaaS의 핵심인 데이터 차트를 훨씬 고급스럽게 변경.
* **차트 그라데이션:** 라인/바 차트 내부에 투명하게 떨어지는 그라데이션 채우기(`fill="url(#color)"`) 적용.
* **툴팁(Tooltip):** 차트 위로 마우스오버 시 나타나는 툴팁을 커스텀하여 둥글고 부드러운 그림자가 포함된 깔끔한 카드 형태로 재디자인.
* **축(Axis):** 축의 선을 매우 옅게 하거나 제거하고, 틱(Tick) 라벨의 색상을 `muted-foreground`로 지정해 콘텐츠 방해 최소화.
* **빈 상태(Empty State) & 로딩(Skeleton):**
  * 데이터가 로딩 중일 때 단순 스피너가 아닌, 차트 형태의 Skeleton UI 배치.
  * 데이터가 없을 때 표시되는 일러스트 또는 아이콘 기반의 Empty State 디자인 추가 정비.

---

## 3. 진행 단계 (Milestones)

1. **[x] Phase 1: 기반 세팅 (Foundation Update) - 완료** 
   * `design-v2.tsx` 컨텍스트 및 사이드바 토글 스위치 도입.
   * `globals.css`에 V2 전용 Floating Island 레이아웃 구현 (다크 사이드바, 화이트 캔버스 분리).
   * 둥글기(16px Radius), 그림자(다중 섀도우) 디자인 토큰 일괄 교체.
2. **Phase 2: 타이포그래피 및 공통 컴포넌트 정비 (Typography & Component Overhaul)**
   * `Pretendard` 등 고품질 한글 웹 폰트 적용.
   * 버튼, 카드, 입력창의 모서리(Radius), 그림자(Elevation) 재조정.
   * Transition 및 마이크로 애니메이션 강화.
3. **Phase 3: 대시보드 및 코어 뷰 개선 (Views Refactoring)**
   * 위젯 그리드(Grid) 여백(Gap, Padding) 개선.
   * Recharts 기반 차트 디자인 커스텀(테두리, 축 선 옅게, 툴팁 향상).
4. **Phase 4: 마이크로 인터랙션 및 퀄리티 체크 (QA & Polish)**
   * 다크모드/라이트모드 세부 색상 일관성 검사.
   * 로딩 스켈레톤, 빈 화면(Empty State) 고도화.

---

> 본 계획서는 프로젝트의 시각적 신뢰감을 극대화하여 실제 비즈니스 가치를 지닌 프로덕트로 보이게 만드는 것을 최우선 목표로 합니다. 위 단계에 따라 순차적 리팩토링 진행을 건의드립니다.
