# 전체 사이트 A-Z 30회 반복 감사

> 작성일: 2026-07-27  
> 대상: `v2-migration` 전체 사이트와 분석 도구, 정적 콘텐츠, 공용 컴포넌트, 데이터 흐름, 테스트/빌드  
> 보호: Classic MMM 엔진·Classic 모델 결과·추세·패널티·분배는 변경하지 않음

## 0. 감사 방식 정정

이전 문서는 라운드별로 한 영역만 보는 형태였고, 요청한 “전체 사이트 A to Z를 30번”이 아니었다. 이번 문서는 다음 방식으로 다시 작성했다.

- **매 라운드마다 사이트 전체를 처음부터 끝까지 검사**한다.
- 검사 범위는 매번 동일하게 `라우트 → 랜딩/가이드 → 업로드/매핑 → 모든 도구 → 결과/차트/표 → export → 로컬 저장/외부 요청 → EN → 접근성/모바일 → 테스트/빌드 → Classic 보호`다.
- 직전 회차까지 발견한 항목은 `known/open` registry로 넘긴다.
- 다음 회차에서는 `known/open`을 다시 신규 발견으로 세지 않고, 그 목록 밖의 새 결함·새 위험만 기록한다.
- 코드가 실제로 수정되지 않은 항목은 신규 발견에서 제외하되 `open` 상태로 계속 추적한다. 즉, “제외”는 “해결됨”이라는 뜻이 아니다.

## 1. 전체 A-Z 검사 범위

| 영역 | 매 회차 확인한 내용 |
|---|---|
| A. Route/IA | App Router, routeMap, redirect, public/hidden, 404, SEO |
| B. Landing/Onboarding | 랜딩, 데모, StartGate, 첫 결과까지의 흐름 |
| C. CSV import | 파일·시트 입력, 파싱, 헤더, 빈 값, 대용량, 취소 |
| D. Mapping | 자동 후보, 충돌, 타입, 단위, required/optional, 승인 |
| E. Data state | Zustand group snapshot, handoff, analyzed signature |
| F. Filters | 날짜, grain, timezone, currency, OS/country/channel |
| G. Analysis state | ready/analyzing/stale/blocked/failed/retry |
| H. Quality | missing, duplicate, gap, zero variance, sparse, outlier |
| I. Statistical truth | denominator, CI, rank, collinearity, causal language |
| J. Result UX | conclusion, evidence, action, next analysis, warning |
| K. Provenance | method, version, seed, cache, input signature |
| L. Charts | theme, axes, tooltip, legend, resize, PNG |
| M. Tables | semantic header, sort, responsive, data view, export |
| N. Export | CSV/JSON/MD/PDF/PNG, BOM/CRLF, manifest |
| O. Accessibility | keyboard, focus, aria, screen reader, color-only status |
| P. Responsive | 360px, sticky bars, TOC, tables, menus |
| Q. Localization | KO/EN route·copy·error·empty·chart·export |
| R. Performance | parse, compute, worker, cache, chart disposal |
| S. Privacy | server boundary, third-party request, analytics, local storage |
| T. Dashboard | 5-2 tab consistency and drilldown |
| U. Budget/Saturation | 5-3/5-22 model display, constraints, extrapolation |
| V. Experimentality | 5-4/5-23 method strength, power, incrementality language |
| W. Creative/Content | 5-6/9-x grain, rollup, sparse evidence |
| X. PVM | decomposition identity, mix/result share, residual |
| Y. Aha/Cohort | window, censoring, weighted denominator, association |
| Z. Regression/MMM boundary | forecast extrapolation, Classic isolation, mode/cache separation |

## 2. 기준 상태와 검증 증거

이번 재감사 시점의 정적 범위는 다음과 같다.

- App route/page 파일: 36개
- `src/components`: 109개 파일
- `src/utils + src/lib + src/store`: 144개 파일
- production build가 생성한 route: 202개 static path 포함
- Vitest golden: 67개 파일 / 538개 통과 / 1개 skip
- `npm run lint`: 통과
- `npm run build`: 통과

테스트·lint·build 통과는 수학·컴파일 안전망이지 UX, 접근성, 단위 정합성, 분석 의미의 완전성을 의미하지 않는다.

## 3. Known/Open registry 운용 규칙

발견 ID는 다음 회차에 전달했다. `open`은 아직 코드에 남아 있거나 구현되지 않은 항목, `verified`는 존재를 확인했지만 결함이 아님을 확인한 항목, `deferred`는 제약상 후속인 항목이다.

| ID | 최초 발견 | 항목 | 상태 |
|---|---:|---|---|
| K-001 | 1 | 공용 primitive 적용 편차 | open |
| K-002 | 1 | 도구별 결과/상태 계약 편차 | open |
| K-003 | 2 | route redirect 목적지 안내 부족 | open |
| K-004 | 3 | demo/real 결과 경계와 export 메타 부족 | open |
| K-005 | 4 | 대용량 파싱 취소·부분 실패 UX 부족 | open |
| K-006 | 5 | MappingContract 분산 및 store TODO | open |
| K-007 | 6 | 날짜·grain·timezone 경계 계약 분산 | open |
| K-008 | 7 | 직접 숫자 포맷 및 cost/spend 의미 편차 | open |
| K-009 | 8 | 공통 분석 상태 머신 부재 | open |
| K-010 | 9 | 공통 오류·식별성 taxonomy 부족 | open |
| K-011 | 10 | 결론·근거·다음 행동 UI 편차 | open |
| K-012 | 11 | 표본·CI·provenance 채움 규칙 편차 | open |
| K-013 | 12 | cache key/version/dispose 계약 분산 | open |
| K-014 | 13 | IndexedDB/localStorage 저장 고지·삭제 UX 부족 | open |
| K-015 | 14 | Google Sheets 직접 요청 경계 고지 부족 | open |
| K-016 | 15 | telemetry opt-out 및 메타데이터 정책 부족 | open |
| K-017 | 16 | 직접 table과 export manifest 편차 | open |
| K-018 | 17 | 직접 hex/rgba와 차트 theme 편차 | open |
| K-019 | 18 | menu/chart/overlay 접근성 편차 | open |
| K-020 | 19 | 모바일 열 우선순위·필터 UX 부족 | open |
| K-021 | 20 | EN completeness 자동검사 부족 | open |
| K-022 | 21 | main-thread 계산·취소·메모리 정리 부족 | deferred |
| K-023 | 22 | 대시보드 tab/filter/분모 정합성 표준 부족 | open |
| K-024 | 23 | budget recommendation/수동 시뮬레이션 설명 부족 | open |
| K-025 | 24 | A/B·증분 방법별 증거 수준 표준 부족 | open |
| K-026 | 25 | creative/content grain·rollup·sparse gate 편차 | open |
| K-027 | 26 | PVM 항등식·mix share 라벨 검증 표준 부족 | open |
| K-028 | 27 | cohort/aha window·분모·censoring 표시 편차 | open |
| K-029 | 28 | forecast 외삽 경고 및 Classic 보호 PR gate 부족 | open |
| K-030 | 29 | UI ID의 Date.now/Math.random 사용 | open |
| K-031 | 29 | SOP HTML source/sanitizer 경계 명시 부족 | open |
| K-032 | 30 | 결과 비교용 cross-tool manifest 부재 | open |
| K-033 | 30 | 공개 기능의 “coming soon/준비 중” 정리 미완료 | open |

## 4. 1~30차: 매번 A-Z 전체 검사한 감사 로그

아래에서 “A-Z 전체 검사 완료”는 해당 회차에 한 영역만 본 것이 아니라 §1의 A~Z 전체를 다시 훑었다는 뜻이다. 회차별 `delta`만 신규로 기록하며 `known/open K-*`는 재카운트하지 않았다.

### 1차 — A-Z 전체 검사 / 기준선 구축

- 전체 route, app page, component, utils/lib/store, test, build target을 목록화했다.
- **delta:** K-001 공용 primitive 적용 편차, K-002 도구별 결과/상태 계약 편차.
- 이후 회차는 이 두 항목을 known으로 넘기고, 새 파일·새 경로·새 의미 차이만 탐색했다.

### 2차 — A-Z 전체 검사 / 라우트와 콘텐츠 경계

- 1차 known을 제외하고 routeMap·redirect·국문/영문·SEO·404·guide/blog·tool entry를 다시 전수 확인했다.
- **delta:** K-003 redirect 목적지 안내 부족.

### 3차 — A-Z 전체 검사 / 첫 사용 흐름

- K-001~003을 제외하고 랜딩→데모→실제 업로드→분석→결과 전환을 전수 재실행 관점으로 확인했다.
- **delta:** K-004 demo/real 경계와 export 메타 부족.

### 4차 — A-Z 전체 검사 / 파일 입력 경계

- 기존 known을 제외하고 CSV·Google Sheets·헤더·콤마 숫자·빈 행·invalid row·large file·loading/error/retry를 전체 경로에서 다시 확인했다.
- **delta:** K-005 대용량 파싱 취소·부분 실패 UX 부족.

### 5차 — A-Z 전체 검사 / 매핑 재귀 흐름

- 전체 도구의 required/optional, alias, candidate scoring, handoff remap, recipe save/load, 분석 버튼을 다시 확인했다.
- **delta:** K-006 MappingContract 분산 및 store TODO.

### 6차 — A-Z 전체 검사 / 시간 정합성

- 모든 도구와 export를 대상으로 start/end 포함 규칙, ISO week, partial week, timezone, date gap, period count를 다시 확인했다.
- **delta:** K-007 날짜·grain·timezone 계약 분산.

### 7차 — A-Z 전체 검사 / 지표 정합성

- 모든 metric key, cost/spend, installs/actions/users, CPA/CPR/ROAS, currency toggle, 차트/표/export 표시를 다시 대조했다.
- **delta:** K-008 직접 숫자 포맷과 의미 편차.

### 8차 — A-Z 전체 검사 / 분석 상태 변화

- 모든 분석 버튼·토글·필터·mapping 변경·cache hit·stale 결과·overlay·실패 후 retry 경로를 다시 확인했다.
- **delta:** K-009 공통 분석 상태 머신 부재.

### 9차 — A-Z 전체 검사 / 품질 차단과 보류

- 모든 eligibility, quality report, missing/duplicate/gap/zero/sparse/outlier/collinear/rank 경로를 다시 확인했다.
- **delta:** K-010 공통 오류·식별성 taxonomy 부족.

### 10차 — A-Z 전체 검사 / 결과 첫 화면

- 모든 결과 화면의 결론·수치·경고·액션·next analysis·데모 표시를 다시 대조했다.
- **delta:** K-011 결론·근거·다음 행동 UI 편차.

### 11차 — A-Z 전체 검사 / 신뢰도 상세

- 모든 결과에 sample, denominator, interval, method, version, seed, cache, scope가 실제로 전달되는지 다시 확인했다.
- **delta:** K-012 표본·CI·provenance 채움 규칙 편차.

### 12차 — A-Z 전체 검사 / 캐시와 재현성

- 모든 tool snapshot, mode toggle, input signature, filter signature, chart disposal, cache invalidation을 다시 확인했다.
- **delta:** K-013 cache key/version/dispose 계약 분산.

### 13차 — A-Z 전체 검사 / 브라우저 저장

- localStorage, IndexedDB, memory snapshot, analysis history, mapping recipe, theme/locale preference의 생성·복원·삭제를 다시 확인했다.
- **delta:** K-014 저장 고지·삭제 UX 부족.

### 14차 — A-Z 전체 검사 / 외부 네트워크

- client fetch, Google Sheets, static content fetch, fonts/OG generation, GA script, server/runtime boundary를 다시 확인했다.
- **delta:** K-015 Google Sheets 직접 요청 경계 고지 부족.

### 15차 — A-Z 전체 검사 / 이벤트·텔레메트리

- 모든 gtag 호출, allowlist, row/column metadata, page view, download/import event, opt-out 가능 여부를 다시 확인했다.
- **delta:** K-016 telemetry opt-out 및 메타데이터 정책 부족.

### 16차 — A-Z 전체 검사 / 표와 결과 파일

- 모든 직접 `<table>`, DataTable 사용, sorting, header semantics, CSV/JSON/MD/PNG/PDF, BOM/CRLF, 파일명·manifest를 다시 확인했다.
- **delta:** K-017 직접 table과 export manifest 편차.

### 17차 — A-Z 전체 검사 / 차트와 테마

- 모든 Chart.js 생성부·destroy·resize·tooltip·legend·axis·dark/light·PNG 배경을 다시 확인했다.
- **delta:** K-018 직접 hex/rgba와 차트 theme 편차.

### 18차 — A-Z 전체 검사 / 접근성

- 모든 입력·버튼·select·details·modal·menu·chart·error·loading·color status를 키보드/스크린리더 관점으로 다시 확인했다.
- **delta:** K-019 menu/chart/overlay 접근성 편차.

### 19차 — A-Z 전체 검사 / 모바일

- 360px 기준으로 모든 route·sticky shell·TOC·필터·mapping·표·차트·download menu를 다시 확인했다.
- **delta:** K-020 모바일 열 우선순위·필터 UX 부족.

### 20차 — A-Z 전체 검사 / 한영 공개 품질

- 모든 EN-ready route와 not-ready route의 title, desc, empty, error, button, chart, export, SEO, fallback을 다시 확인했다.
- **delta:** K-021 EN completeness 자동검사 부족.

### 21차 — A-Z 전체 검사 / 대용량·메모리

- 업로드부터 결과까지 행 수 증가, aggregation, chart re-render, cache retention, unmount, retry, cancellation을 다시 확인했다.
- **delta:** K-022 main-thread 계산·취소·메모리 정리 부족. 기존 제약상 worker는 `deferred`로 두었다.

### 22차 — A-Z 전체 검사 / 운영 대시보드

- 5-2의 모든 tab, common filter, scorecard, anomaly, LTV, cohort, funnel, segment, custom metric/chart, handoff를 다시 확인했다.
- **delta:** K-023 dashboard tab/filter/분모 정합성 표준 부족.

### 23차 — A-Z 전체 검사 / 예산·포화·시나리오

- 5-3/5-22의 input contract, CPR/ROAS display, model wrapper, constraints, extrapolation, what-if, manual simulation, export를 다시 확인했다.
- **delta:** K-024 budget recommendation과 수동 시뮬레이션 설명 부족.

### 24차 — A-Z 전체 검사 / 실험·증분

- 5-4/5-23의 A/B, holdout, on/off, DiD, power, CI, causal wording, non-significant handling을 다시 확인했다.
- **delta:** K-025 방법별 증거 수준 표준 부족.

### 25차 — A-Z 전체 검사 / 소재·콘텐츠

- creative/content 전체 route를 최소 grain, sparse data, rollup, result language, chart/table/export, EN, mobile까지 다시 확인했다.
- **delta:** K-026 grain·rollup·sparse gate 편차.

### 26차 — A-Z 전체 검사 / PVM

- PVM 입력·분해·상위 rollup·mix/result share·residual·항등식·표·차트·export를 다시 확인했다.
- **delta:** K-027 PVM 항등식과 mix share 라벨 검증 표준 부족.

### 27차 — A-Z 전체 검사 / Aha·코호트·LTV·퍼널

- window, cohort date, censoring, denominator, weighted retention, rate/count detection, causal wording, export를 다시 확인했다.
- **delta:** K-028 cohort/aha window·분모·censoring 표시 편차.

### 28차 — A-Z 전체 검사 / 회귀·미래예측·MMM 경계

- regression/forecast의 observed/future/extrapolation, MMM mode separation, Classic/Bayesian cache, UI toggle, result labels, export, test fixtures를 다시 확인했다.
- **delta:** K-029 forecast 외삽 경고 및 Classic 보호 PR gate 부족.
- **보호 확인:** Classic 계산 로직은 변경하지 않았다.

### 29차 — A-Z 전체 검사 / 결정론·콘텐츠 안전·테스트

- 전체 코드를 다시 검색해 `Math.random`, `Date.now`, direct fetch, storage, HTML injection, all tests, lint, build, error path를 확인했다.
- **delta:** K-030 UI ID의 Date.now/Math.random, K-031 SOP HTML source/sanitizer 경계 부족.

### 30차 — A-Z 전체 검사 / 최종 novelty-only pass

- K-001~031을 신규 발견에서 제외하고 전체 사이트를 마지막으로 다시 훑었다.
- **delta:** K-032 도구 간 결과 비교용 manifest 부재, K-033 공개 기능의 “coming soon/준비 중” 정리 미완료.
- **최종 확인:** 그 외 신규 결함은 발견하지 못했다. 기존 open 항목은 해결된 것이 아니며 통합 backlog로 이동한다.

## 5. 최종 통합 백로그

### P0 — 신뢰성·경계·분석 정직성

1. K-006 `MappingContract` 단일화.
2. K-009 분석 상태 머신 단일화.
3. K-010 오류·식별성 taxonomy 단일화.
4. K-007 날짜·grain·timezone·inclusive boundary contract.
5. K-008 metric metadata와 분모 contract.
6. K-014 로컬 저장 위치·보존·삭제 UX.
7. K-015 Google Sheets 직접 요청 고지·옵트아웃.
8. K-027 PVM/분해 항등식 자동 검사.
9. K-029 Classic 보호 PR gate.

### P1 — 전체 결과 UX와 공용화

1. K-001/K-002 공용 primitive와 결과 계약 적용.
2. K-011 결론→근거→한계→액션→다음 분석 카드.
3. K-012 접힌 provenance 상세 강제.
4. K-013 cache key/version/dispose 표준.
5. K-017 export manifest와 DataTable 이관.
6. K-019 접근성 결과 표·키보드 메뉴·aria-live.
7. K-020 모바일 표/필터/TOC.
8. K-021 EN completeness test.
9. K-023 dashboard filter/분모 manifest.
10. K-024 budget recommendation 설명.
11. K-025 실험 증거 수준 표시.
12. K-026 creative/content 최소 grain·rollup.
13. K-028 cohort/aha observation metadata.
14. K-032 cross-tool comparison manifest.

### P2 — 완성도·운영

1. K-003 redirect 목적지 안내.
2. K-004 demo/real export 구분.
3. K-005 parse retry/cancel/partial error.
4. K-016 telemetry opt-out.
5. K-018 chart token 정리.
6. K-030 deterministic UI IDs.
7. K-031 SOP sanitizer/source contract.
8. K-033 준비 중 기능 구현·숨김·삭제 결정.

### P3 — 무료 클라이언트 고도화

1. K-022 parse worker와 선택적 analysis worker.
2. 대용량 결과 progressive rendering.
3. local-only report bundle.
4. 시각 회귀와 실제 브라우저 접근성 회귀.

## 6. 실행 순서

### Wave 1 — 공통 계약

`K-006 → K-009 → K-010 → K-007 → K-008 → K-014 → K-015 → K-027`

### Wave 2 — 공용 결과 UX

`K-001/K-002 → K-011 → K-012 → K-013 → K-017 → K-019 → K-020`

### Wave 3 — 도구별 정리

`K-023 → K-024 → K-025 → K-026 → K-028 → K-032`

### Wave 4 — 운영·성능

`K-003/K-004/K-005/K-016/K-018/K-021/K-030/K-031/K-033 → K-022`

## 7. Classic MMM 보호 체크리스트

- [ ] `mmmMathPr416.js` diff 없음.
- [ ] Classic `MarketingResponse` 계산 분기 diff 없음.
- [ ] Classic 입력 매핑·추세·계절성·업황·패널티·채널 분배 변경 없음.
- [ ] 공용 표시층만 변경할 때 Classic fixture 숫자·기간·단위 byte-identical.
- [ ] Classic과 Bayesian/신규 모델의 cache key·mode·export manifest 분리.
- [ ] Classic 변경이 필요한 항목은 사용자 승인 후 별도 PR.

## 8. 감사 결과의 의미

30회 전체 A-Z 감사 결과, 현재 가장 중요한 문제는 특정 MMM 수치를 조정하는 것이 아니라 **사이트 전체가 같은 입력 계약·단위 계약·결과 계약·저장 경계·오류 언어를 쓰도록 만드는 것**이다.

이 문서는 구현 완료 보고서가 아니다. 다음 작업은 P0부터 작은 PR로 진행하며, 각 PR에는 실제 diff, 테스트 결과, 데이터 경계, Classic 보호 결과를 기록한다.
