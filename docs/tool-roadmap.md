# Performance Marketing Library — 분석 도구 개선 감사 & 신규 툴 로드맵

> **최종 업데이트**: 2026-06-24  
> **작성 주체**: Antigravity (AI 코딩 어시스턴트)  
> **참조 문서**: `docs/worklog.md`, `docs/backlog.md`, `CLAUDE.md`  
> **목적**: 퍼포먼스 마케팅 라이브러리(`index.html`) 내 분석 도구들의 UX/UI 개선 지점 및 고도화 포인트를 종합적으로 감사(Audit)하고, 향후 추가할 신규 분석 도구들의 로드맵을 정의한 기획 문서.

---

## 목차

1. [기존 분석 도구 개선 지점 (Audit)](#1-기존-분석-도구-개선-지점-audit)
2. [신규 툴 로드맵 (Roadmap)](#2-신규-툴-로드맵-roadmap)
3. [구현 완료 내역 (Implemented)](#3-구현-완료-내역-implemented)
4. [작업 방식 정의 (Working Guidelines)](#4-작업-방식-정의-working-guidelines)
5. [미결 작업 목록 (To-Do)](#5-미결-작업-목록-to-do)

---

## 1. 기존 분석 도구 개선 지점 (Audit)

### 5-2. 운영 대시보드 (Operational Dashboard)

- **[UX] 정보 및 분석 요약의 접이식화**  
  페이지 상단의 긴 대시보드 설명 및 지표 정적 정의 텍스트를 접이식 `<details>` 태그로 변환하여, 사용자가 CSV 업로드 후 핵심 대시보드 시각화 영역에 즉시 집중할 수 있도록 개선.

- **[시각화] 주요 이벤트 가로/세로 마커 기능**  
  집행 기간 중 대규모 캠페인 런칭, 프로모션, 혹은 매체 이슈 시점을 캔버스 위에 세로 점선 마커(Vertical Annotation Line)로 표시하고 텍스트 라벨을 달 수 있는 기능 추가.

- **[기능] 보고서 인쇄 및 내보내기(Print CSS) 최적화**  
  사이드바 및 상단 고정 필터 패널을 가리고, 차트와 주요 테이블 요약만 깔끔하게 정렬하여 PDF 인쇄/저장이 가능하도록 `@media print` 스타일 적용.

---

### 5-3. 예산 배분 (Budget Allocator)

> 티어 변경 완료: `pro` -> `free` 전환, `AUTH_PROTECTED_PAGES`에서 제거됨.

- **[수치] 추세선 적합(Fit) 신뢰도 및 R² 경고 표시**  
  채널별 Saturation Curve의 R²(결정계수)를 표에 명시하고, R² < 0.4 이하로 적합 신뢰도가 낮은 채널에 대해 `⚠ 적합 불안정` 경고 배너 노출.

- **[UX] 다중 채널 What-if 슬라이더 지원**  
  활성화된 상위 3~5개 매체의 예산 조절 슬라이더를 동시에 제공하고, 전체 예산 제약 조건 하에서 실시간 배분 최적화 변화를 보여주는 대화형 시뮬레이터 구현.

- **[기능] 시간 흐름에 따른 반응 곡선 추이 비교**  
  최근 14일 vs 전체 기간(90일)의 반응 곡선을 겹쳐 그려서, 특정 매체가 최근 들어 포화(Saturation) 구간에 도달하고 있는지 시각적으로 추적.

- **[기능] 최근 집행 데이터 자동 불러오기** ✅ 구현 완료  
  '최근 집행 불러오기' 버튼 추가. 예산 미입력 시 필터 적용 단계에서 최근 평균 예산을 자동 세팅하는 로직 구현.

---

### 5-4. A/B 테스트 계산기 (A/B Test Calculator)

- **[기능] 대량 실험 검정 (Mass Test Readout) 지원**  
  Multi-variant 결과가 담긴 CSV 업로드 시, 모든 Arm별 유의성 검정(z-test, 승률, 신뢰구간)을 표 하나로 자동 일괄 계산 및 리포팅.

- **[통계] Sequential Testing (순차적 검정) 가이드**  
  'Peeking Problem' 방지를 위해, 데이터 축적 진행률에 따라 유의수준 경계를 조절하는 Alpha Spending Function 기반의 조기 종료 판단 엔진 탑재.

- **[시각화] MDE vs Sample Size 파워 커브(Power Curve)**  
  고정된 표본 수에서 탐지 가능한 MDE와의 관계를 보여주는 2D 곡선 시각화 추가.

---

### 5-5. 잠식 분석기 (Cannibalization Analyzer)

- **[통계] 시차 분석 (Lagged Effects) 지원**  
  Paid 광고 비용 지출이 1일/2일/3일 시차(Lag)를 두고 발생하는 잠식/시너지 효과의 교차 상관(Cross-correlation) 계수를 도출하여 리포트.

- **[기능] 매체/캠페인 속성별 잠식 위험 지수 차등 적용**  
  채널 유형 매핑 정보를 기반으로 잠식 가능성을 가중 평가하여 "진성 증분 기여도" 지수화.

---

### 5-6. 크리에이티브 분석기 (소재 분석)

> Ad Fatigue Alert 및 Auto-Planner는 이 섹션 아래에 통합 구현 예정 (신규 툴 §2-B 참조).

- **[통계] 다차원 Fatigue(피로도) 지수**  
  노출 빈도(Frequency)의 상승 속도 및 CPM 상승 추세를 결합한 종합 크리에이티브 피로 위험도 지표 제공.

- **[기능] Concept Matrix 동적 축 변경**  
  CSV의 어떤 열이든 행축/열축으로 자유롭게 선택하여 매트릭스를 그릴 수 있도록 피벗 테이블 형태의 동적 그리드 지원.

- **[기능] 소재 잔여 생존일 예측 (Survival Analysis)**  
  과거 피로화되어 OFF된 소재들의 생존 수명 분포를 학습하여, 현재 집행 중인 신규 소재들의 예상 수명을 생존 곡선 기반으로 추정.

---

### 5-8. 품질 분석기 (Cohort Quality Analyzer)

> LTV Payback Period 기능은 **이미 5-2 운영 대시보드 및 5-8 코호트 도구에서 다루고 있음**. 별도 신규 툴 생성 불필요.

- **[통계] 장기 LTV 예측 모델의 다변화**  
  지수 감쇠(Exponential Decay) 모델 외에, Power-law 모델 및 BG/BB(Beta-Geometric/Beta-Binomial) 잔존 모델을 탑재하여 D90/D180/D360 시점의 예측 정밀도 향상.

- **[시각화] 코호트 잔존 Heatmap 밀도 시각화**  
  코호트 일자별/주별 잔존율 표에 값의 크기에 비례하는 그라데이션 색상(Heatmap)을 배경으로 깔아 시각적 스캔 용이성 향상.

---

## 2. 신규 툴 로드맵 (Roadmap)

### A. Media Mix Model (MMM) Simulator & Optimizer

> **분류**: Free 티어 (예산 배분까지 포함)  
> **우선순위**: HIGH

**목적**: 5-18 MMM 분석을 통해 도출된 각 매체별 수확체감 곡선 파라미터를 역산하여, 특정 마케팅 총 예산을 부여했을 때 성과가 극대화되는 최적의 매체별 포트폴리오 믹스를 최적화하여 제안.

**주요 기능**:
- 총 예산 입력 필드 및 개별 매체별 지출 하한선/상한선(제약 조건) 설정.
- 수학적 최적화 알고리즘(그리디 또는 경사하강법)을 클라이언트 사이드에서 즉각 작동.
- 전체 한계효용(Marginal Contribution)의 합이 최대가 되는 최적 예산 포트폴리오 믹스 도출.
- 최적화된 예산 분배안 적용 시의 예상 총 획득 성과 및 블렌디드 CPR/ROAS 시뮬레이션 비교.

> **참고**: 5-3 예산 배분(Budget Allocator)과 개념 유사하나, MMM Simulator는 MMM 파라미터 기반이고 5-3은 실제 집행 데이터 기반 saturation curve fitting으로 차별화됨.

---

### B. Ad Fatigue Alert & Auto-Planner (소재 피로도 알람 및 교체 플래너)

> **분류**: 5-6 크리에이티브 분석기에 통합 (CSV 업로드 1회로 연동)  
> **우선순위**: HIGH

**목적**: 크리에이티브 Fatigue 도달 주기와 주당 소재 제작 역량(Velocity)을 정량적으로 매핑하여, 소재 피로화로 인한 캠페인 단가 상승을 예방하고 선제적인 소재 교체 타임라인을 플래닝.

**통합 방식**:
- 5-6 크리에이티브 분석기에 CSV 업로드 UI 추가.
- **하나의 CSV 업로드**로 (1) 크리에이티브 분석 (2) Ad Fatigue Alert (3) Auto-Planner가 연동되어 순차적으로 렌더링.

**주요 기능**:
- 각 매체의 일평균 예산 규모 및 크리에이티브당 노출량(Impression)을 기반으로 피로도 임계점 도달 예상 시점 산출.
- 마케팅 팀의 주당 신규 크리에이티브 공급 가능 개수(Velocity)를 바탕으로 적정 속도 제시.
- 소재별 교체 주기를 타임라인(Gantt 차트 스타일)으로 자동 기획. 소재 제작 및 교체 우선순위 캘린더 생성.
- 다차원 Fatigue 지수(CTR 하락 + Frequency 상승 속도 + CPM 상승 추세) 결합.

---

### C. Event Trigger Precision & Recall Analyzer (이벤트 예측력 분석기)

> **분류**: 신규 Free 툴  
> **우선순위**: HIGH

**목적**: "A라는 이벤트를 일으킬 가능성이 높은 선행 이벤트(Precursor Event)를 찾는" 분석 도구.  
특정 목표 이벤트(Target Event, 예: 결제, 구독, 앱 삭제)에 대해, 어떤 이전 사용자 행동들이 높은 예측력(Precision)과 탐지율(Recall)을 보이는지를 정량 분석.

**분석 핵심**:
- **Precision(정밀도)**: 선행 이벤트 X가 발생했을 때, 실제로 목표 이벤트 A가 일어나는 비율. (노이즈 제어)
- **Recall(재현율)**: 목표 이벤트 A가 발생한 케이스 중, 선행 이벤트 X가 실제로 선행했던 비율. (커버리지)
- **F1-Score**: Precision과 Recall의 조화 평균으로 최적 선행 이벤트 랭킹.
- **Lift**: P(A|X) / P(A) — 선행 이벤트 X가 없을 때 대비 목표 이벤트 확률 상승도.

**주요 기능**:
- 이벤트 로그 CSV 업로드 (필수 컬럼: `user_id`, `event_name`, `event_timestamp`).
- 목표 이벤트(Target Event) 선택 UI.
- 분석 시간 윈도우 설정 (목표 이벤트 발생 전 N일 이내의 선행 이벤트만 카운트).
- 모든 이벤트 유형에 대해 자동으로 Precision / Recall / F1-Score / Support 계산.
- 결과를 Scatter Plot(X축: Recall, Y축: Precision, 버블 크기: Support)으로 시각화.
- 상위 Top-K 예측 이벤트를 테이블로 정렬하여 제공.

**데이터 계약 (CSV 스키마)**:

```
user_id,event_name,event_timestamp
u001,app_open,2024-01-05 09:00:00
u001,product_view,2024-01-05 09:02:00
u001,purchase,2024-01-05 09:10:00
```

---

### D. Cross-Channel Attribution Simulator (기여도 시뮬레이터)

> **분류**: TO-DO (향후 구현 예정)  
> **우선순위**: MEDIUM

**목적**: 매체 대시보드 리포트의 중복 기여(Over-reporting) 및 Attribution Window 차이로 발생하는 왜곡을 제거하고, 다양한 기여 모형별 성과 변화를 비교 분석.

**주요 기능 (계획)**:
- 유저 식별 정보와 매체 접점 타임스탬프가 담긴 멀티 터치 데이터(MTA) CSV 업로드 지원.
- First-touch, Last-touch, Linear, Time-decay, **Shapley Value / Markov Chain 데이터 기반 기여도(DDA)** 모형 지원.
- 각 기여 모델에 따른 채널별 기여 성과(Conversion) 및 실제 효율(CPA)을 테이블과 레이더 차트로 비교.

**구현 견적**:

| 항목 | 난이도 | 예상 시간 |
|------|--------|-----------|
| CSV 파싱 + 세션 구성 | 낮음 | 1~2h |
| First/Last/Linear/Time-decay 모형 | 낮음 | 2~3h |
| Shapley Value 계산 (조합 탐색) | 높음 | 4~6h |
| Markov Chain Transition Matrix | 높음 | 4~6h |
| 시각화 (레이더 차트 + 테이블) | 중간 | 2~3h |
| **총 예상** | | **13~20h** |

> **주의**: Shapley Value는 채널 수(N)가 늘어날수록 2^N 조합 계산이 필요. 클라이언트 사이드에서는 N <= 8 채널 한도로 제한 또는 SHAP Approximation 필요.

---

## 3. 구현 완료 내역 (Implemented)

| 날짜 | 항목 | 내용 |
|------|------|------|
| 2026-06-24 | 5-3 예산 배분 티어 변경 | `pro` -> `free` 전환, `AUTH_PROTECTED_PAGES`에서 제거 |
| 2026-06-24 | 5-3 최근 집행 불러오기 | '최근 집행 불러오기' 버튼 추가, 예산 미입력 시 최근 평균 자동 세팅 |
| 2026-06-24 | 5-6 Concept Matrix 테이블 구조 | `thead`/`tbody` 정교화 및 첫 번째 행 셀 간격 조정 |
| 2026-06-21~22 | 5-3 poly2 예산배분 안전장치 4종 | 종모양/U자형 곡선 감지, 극점 이후 CPR 외삽 차단, 소프트 외삽 한도, 채널별 최소/최대 집행 제약 |
| 2026-06-24 | poly2 골든 테스트 10종 | `window.runAllocPoly2Tests()` 신설 — `detectPoly2Shape` + `predictSafeCpr` 합성 유닛테스트 |

---

## 4. 작업 방식 정의 (Working Guidelines)

> 본 섹션은 Antigravity(AI 코딩 어시스턴트)가 이 프로젝트에서 작업할 때 준수해야 하는 원칙들입니다.  
> **모든 툴 구현 시 이 섹션을 먼저 읽고 적용하세요.**

### 4-1. 아키텍처 원칙

- **단일 파일 원칙**: 모든 로직은 `index.html` 단일 파일 내에 위치. 외부 JS/CSS 파일 생성 금지.
- **티어 관리**: `TOOL_TIER` 상수(`free`/`pro`)로 접근 제어. Pro 기능은 `AUTH_PROTECTED_PAGES` Set에 페이지 ID 추가.
- **상태 관리**: 각 툴별로 `{TOOL}_STATE` 네이밍 컨벤션의 IIFE 기반 상태 모듈 사용.
- **Math.random 금지**: 모든 통계 계산에 결정론적 수식 사용. 재현 가능성 필수.

### 4-2. 통계 도구 표준

- **순수함수 원칙**: 통계 계산 함수는 부수효과(Side Effect) 없는 순수 함수로 구현.
- **골든 테스트**: 신규 통계 함수 추가 시 `window.run{ToolName}Tests()` 형식의 골든 테스트 필수 작성.
- **HAC SE**: 회귀 계수 보고 시 Newey-West(HAC) 표준오차 및 신뢰구간 병기. 별표(*)만 있는 p값 보고 금지.
- **외삽 경고**: 관측 범위를 벗어난 예측값에 대해 `⚠ 외삽 구간` 경고 표시 의무.

### 4-3. CSV 업로드 및 데이터 계약

- **명시적 스키마**: 각 툴의 CSV 업로드 UI 옆에 예시 컬럼 및 데이터 형식을 명시.
- **위생 검증 게이트**: 날짜 파싱, 필수 컬럼 존재 여부, null/NaN 처리를 업로드 직후 검증. 오류 시 상세 메시지 표시.
- **공유 CSV**: 같은 화면에서 여러 분석 탭/섹션을 제공할 경우, 단일 CSV 업로드로 모든 탭에 데이터가 공유되도록 설계.

### 4-4. UX/UI 표준

- **다크 모드 기준**: 모든 신규 컴포넌트는 기존 다크 테마(`--bg-*`, `--text-*` 등 CSS 변수) 준수.
- **접이식 설명**: 긴 설명 텍스트는 `<details>/<summary>` 태그로 감싸서 기본적으로 접혀있게.
- **반응형**: 모바일 뷰포트(<= 768px) 기준으로도 핵심 테이블/차트가 가로 스크롤 없이 보이도록.
- **에러 상태**: 데이터 부족/계산 실패 시 빈 화면이 아닌 명확한 에러 메시지 + 해결 방법 제시.

### 4-5. 깃 작업 규칙

- **6월 작업 중 PR 금지**: 토큰 제약으로 `docs/worklog.md`에만 작업 내용 기록.
- **혼합 커밋 방지**: `git add index.html` 전에 `git diff`로 내 변경만 포함되는지 반드시 확인.
- **커밋 메시지**: `feat(5-X): 기능명 - 상세` 형식.
- **업로드 시 분리 PR**: `worklog.md` 미해결 섹션의 혼합 커밋은 반드시 분리하여 PR.

### 4-6. 신규 툴 구현 순서 (권장)

1. 이 문서의 §2 로드맵에서 목적/기능 재확인.
2. CSV 데이터 계약(스키마) 정의.
3. 통계/수식 로직 순수함수로 구현 + 골든 테스트 작성.
4. UI 섹션 (`<section id="page_X_Y">`) 추가.
5. `TOOL_TIER` 및 `AUTH_PROTECTED_PAGES` 등록.
6. `navigate()` 함수에 라우팅 케이스 추가.
7. `worklog.md`에 작업 내용 기록.

---

## 5. 미결 작업 목록 (To-Do)

### 🔴 HIGH Priority

- [ ] **Ad Fatigue Alert & Auto-Planner** (§2-B)  
  5-6 크리에이티브 분석기 하위에 통합. CSV 업로드 1회로 크리에이티브 분석 -> Fatigue Alert -> Auto-Planner 순차 렌더링.

- [ ] **Event Trigger Precision & Recall Analyzer** (§2-C)  
  신규 툴 생성. 이벤트 로그 CSV 업로드 -> 목표 이벤트 선택 -> 선행 이벤트 예측력(Precision/Recall/F1/Lift) 분석.

### 🟡 MEDIUM Priority

- [ ] **5-2 운영 대시보드 이벤트 마커** (§1)  
  캔버스 위 세로 점선 마커 기능 추가.

- [ ] **5-4 A/B 테스트 대량 검정 & 파워 커브** (§1)  
  CSV 일괄 업로드로 Multi-variant 결과 자동 산출. MDE vs Sample Size 파워 커브 시각화.

- [ ] **5-8 코호트 Heatmap** (§1)  
  잔존율 테이블에 그라데이션 Heatmap 오버레이.

### 🟢 LOW Priority (견적만 존재)

- [ ] **Cross-Channel Attribution Simulator** (§2-D)  
  TO-DO. 구현 전 Shapley Value 계산 범위(N <= 8 채널 제한 등) 사용자와 협의 필요.  
  예상 공수: **13~20시간**.

---

> **[NOTE]** 이미 구현된 항목: Concept Matrix thead/tbody 구조 정교화 및 셀 간격 조정 (5-6), 예산 배분 최근 집행 불러오기 UX (5-3), 5-3 Free 티어 전환, poly2 예산배분 안전장치 4종 및 골든 테스트 10종.

> **[IMPORTANT]** LTV Payback Period: 별도 신규 툴 불필요. 5-2 운영 대시보드 및 5-8 코호트 품질 분석기에서 이미 다루고 있음.

> **[WARNING]** 미푸시 커밋 주의: `d2199a5`에 poly2 예산배분(Antigravity) + GA4 SOP 세분화(Claude) 작업이 혼합되어 있음. 업로드 시 반드시 분리 PR 처리 필요. (`docs/worklog.md` 미해결 섹션 참조)
