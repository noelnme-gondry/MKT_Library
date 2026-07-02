# V2 Migration — 마스터 Task 트래커

> **목표**: `index.html`(단일 HTML, 49,303줄 / 2.41MB) → `v2-migration/`(Next.js) **완전 전환**. Next.js가 새 SSOT.
> **원칙**: index.html을 통째로 읽지 않는다. `grep`으로 필요한 함수 범위만 오려 v2 대응 파일과 1:1 대조.
> 각 항목은 실행될 때마다 `[ ]`→`[x]`로 체크. 딥다이브 필요 항목은 **⚡ULTRACODE** 표시.

**진행 규칙**: 한 Phase씩 순차 진행. Phase 완료 시 이 파일 체크 + 짧은 결과 메모.

---

## Phase 0 — 기반 정리 + 패리티 매트릭스 ✅ 완료 (0.3만 결정 대기)

- [x] 0.1 리포 위생: `v2-migration/.next` gitignore 확인 (이미 무시됨, 추적 0)
- [x] 0.2 레포 루트 디버그 잔재 `.gitignore` 처리 (삭제 X·로컬 보존, `*.patch`·brace-tracking 스크립트·로컬 CSV)
- [ ] 0.3 `page_5_22_raw.js`(2,542줄 미이관 원본 잔재) — 이관 대상 vs 폐기 확정 → **Phase 4.7에서 결정**
- [x] 0.4 **패리티 매트릭스** = 본 파일 아래 매핑표 (별도 파일 대신 여기서 상태 추적)

### 패리티 매핑 (index.html ↔ v2) — 0.4에서 상태 채움

| 영역 | index.html 심볼 (라인) | v2 파일 | 상태 |
|---|---|---|---|
| **수학엔진** | | | |
| 예산배분 | `ALLOC_MATH` (12473) | `src/utils/allocationMath.js` (429) | ⬜ 미검증 |
| PVM 변동 | `PVM_MATH` (31702) | `src/utils/pvmMath.js` (365) | ⬜ |
| 소재분석 | `CREATIVE_STATS` (16976) | `src/utils/creativeMath.js` (760) | ⬜ |
| 카니발 | `CANNIBAL_STATS` (14149)·`CANNIBAL_RANK` (21706) | `src/utils/responseMath.js`? | ⬜ |
| MMM/회귀 | `MMM_STATS` (21142)·`REG_STATS` (21320)·`REG_FORECAST` (29550) | `src/utils/responseMath.js` (220) | ⬜ |
| 포화도 | `SAT_MATH` (11344) | `src/utils/satMath.js` (163) | ⬜ |
| Aha | `AHA_STATS` (31031) | `src/utils/ahaMath.js` (152) | ⬜ |
| LTV | (LTV 테스트 37235) | `src/utils/ltvMath.js` (171) | ⬜ |
| A/B | (readout/incr 테스트) | `src/utils/abTestMath.js` (376) | ⬜ |
| 대시보드 집계 | (funnel/segment/scorecard) | `src/utils/dashboardAggregator.js` (116) | ⬜ |
| 차트 유틸 | (Chart.js 공통) | `src/utils/chartUtils.js` | ⬜ |
| CSV 상수 | `STANDARD_FIELDS`·`TOOL_*_FIELDS` | `src/utils/csvConstants.js` (1200) | ⬜ |
| **도구 UI** | | | |
| 5-3 예산배분 | `page_5_3` (11322) | `tools/BudgetAllocation.jsx` (395) | ⬜ |
| 5-21 PVM | `page_5_21` (33640) | `tools/CampaignPvm.jsx` (398) ⚠에러 | ⬜ |
| 5-6 소재 | `page_5_6` (17775) | `tools/CreativeAnalyzer.jsx` (279) | ⬜ |
| 5-4 실험 | `page_5_4` (14140) | `tools/AbTestHoldout.jsx` (316) | ⬜ |
| 5-18 마케팅반응 | `page_5_18` (25950) | `tools/MarketingResponse.jsx` (305) | ⬜ |
| 5-20 Aha | `page_5_20` (31640) | `tools/AhaMomentFinder.jsx` (207) | ⬜ |
| 5-22 포화도 | `page_5_22` (11631) | `tools/MarketingEfficiency.jsx`(386)? `page_5_22_raw.js` | ⬜ |
| **대시보드 5-2 (9탭)** | `page_5_2` (10909) | `components/dashboard/*` (2507) | ⬜ |
| **SOP 페이지** | `page_1_3`~`page_4_4` | `components/sops/SopContent.jsx` (3155) | ⬜ |
| **셸/공통** | | | |
| 사이드바 | (IA·nav) | `components/Sidebar.jsx` (146) | ⬜ 껍데기 |
| CSV 업로더+매핑 | `renderInlineCsvUpload` | `components/CsvUploader.jsx` (416) | ⬜ 매핑UI 유실 |
| 전역상태 | `CSV_STATE`·`TOOL_CSV_SNAPSHOTS` | `store/useDataStore.js` (196) | ⬜ |
| 이벤트마커 | `MonEventMarkerUI` | `tools/MonEventMarkerUI.jsx` (141) | ⬜ |
| **CSS 디자인시스템** | `<style>` 157~4633 (4,476줄) | `app/globals.css` (3,039) | ⬜ 격차 큼 |

**골든 테스트(≈30종)**: `runSatTests`·`runCannibalTests`·`runCreativeTests`·`runReadoutTests`·`runIncrTests`·`runMmmStatTests`·`runRegStatsTests`·`runRegForecastTests`·`runPvmTests`·`runAhaTests`·`runLtvCacTests`·`runPacingTests`·`runFunnelTests`·`runSegmentTests`·`runScorecardAnomalyTests`·`runMaturationTests` 등 → Phase 7에서 v2로 이식.

---

## Phase 1 — 수학엔진 패리티 ✅ 완료 (1.1~1.7 전부)

방법: index 엔진 블록 오려 공백정규화 diff. **모든 순수 수학 객체 = 충실 IIFE 복사**(차이는 주석 제거·prettier 멀티라인화뿐). 전역(CSV_STATE) 의존 함수만 store/인자 기반으로 각색.

- [x] 1.1 ALLOC_MATH ↔ allocationMath.js — **완전 일치**(diff 0, export 15개·상수 동일)
- [x] 1.2 PVM_MATH ↔ pvmMath.js — 일치(주석/포맷만, `Cbar` centering 로직 동일)
- [x] 1.3 CREATIVE ↔ creativeMath.js — `CREATIVE_MATH`·`CREATIVE_FATIGUE`·`CREATIVE_STATS` 3객체 모두 이관 ✅
- [x] 1.4 ⚡**ULTRACODE 완료** — 5-18 MMM/회귀/예측/regLab 코어 신규 이관. workflow(스카우트→계획→포트→vitest검증) + 권한거부로 실패한 mmmMath/regLabMath는 **결정론적 기계 추출**(plan.md 라인범위 기반, base-indent 닫힘 자동검출)로 재이관.
      **신규 모듈**: `statPrimitives.js`(t/chi2/beta/gamma 원시함수)·`regMath.js`(mmmOls·REG_STATS·REG_TRANSFORMS)·`mmmMath.js`(63심볼: MK/ADF/KPSS/AR1/Shapley/STL·MMM_STATS·mmm* 피처/적합/진단/예측)·`regForecastMath.js`(REG_FORECAST)·`regLabMath.js`(10심볼)·`testFixtures.js`(seededNoise·_mmrLcg).
      **검증**: 골든 6종 vitest GREEN(runCannibal/runMmmStat 12·runRegStats/runMmmMeth/runRegForecast/runRegLab). tolerance 완화·포트수정 0건(첫 실행 통과=충실 이관 입증). `docs/v2-migration-1.4-plan.md`에 심볼별 라인범위·경고 보존.
      **분리(Phase 4.5)**: UI/용어집 29종(`mmmTip`·`MMM_GLOSSARY`·`CANNIBAL_RANK`·평어·`regLabFromMmm`·`mmmDetectCollinear`·`mmmMacroFacts` 등 전역/DOM 의존). MarketingResponse.jsx는 현재 placeholder라 엔진 미연결 → 4.5에서 연결.
      **잔여 확인**: `_MMM_ROLES`는 미이관(deferred), abTest Math.random은 index 상속(별개).
- [x] 1.5 SAT_MATH ↔ satMath.js — 일치(주석/포맷만), `SAT_CONFIG` 값 동일(satHigh1.3·scaleLow0.85·deltaPct0.1)
- [x] 1.6 AHA/LTV/ABTEST/aggregator — `AHA_STATS`·`LTVCAC_MATH`·`STATS`·`getMappedRows/aggregateByKey/calculateKPIs` 일치.
      각색 래퍼: `buildLtvData`(인라인 LTV 캡슐화)·`getMonFilteredRows`(=idx `getMappedRowsForMon`, 인자화) → Phase 5/6 렌더 검증.
- [x] 1.7 csvConstants — `STANDARD_FIELDS`·`TOOL_REQUIRED/OPTIONAL_FIELDS` 이관 ✅. `TOOL_GROUP`·`TOOL_CSV_SNAPSHOTS`·`autoMapHeaders`→store/Phase6, `TOOL_TIER`→Phase2 제거.

### ⚠ Phase 1 발견 (기록)
- **abTestMath `Math.random`**(randGamma/randNormal/randBeta, bayesianAB MC): §8.3(결정론) 상충하나 **index.html에도 원래 존재**(idx 12205~). v2 도입 아님 → 이관 패리티엔 무관, 별개 이슈로 추후 검토.
- **index.html `runRegLabTests` T5 골든 assertion `Math.abs(b6-b3)>1e-6` 자체가 stale**: `regLabRun`이 진입 시 `REG_LAB_STATE.lambda=0`으로 덮고 자체 λ grid search → 외부 λ(0.6 vs 0.3) 무효 → b6===b3라 조건이 index에서도 false. v2 포트 버그 아님(원본 결함). index.html 별도 수정 후보.
- vitest 하네스 v2 부트스트랩 완료(`vitest.config.mjs`, 6개 `*.test.js`) → **Phase 7 선행 이득**.

## Phase 2 — Pro모드 삭제 + Supabase 주석화 ✅ 완료

전체 무료 전환 → Pro 인프라 무용. **v2엔 실제 네비 게이트 없음**(tier는 순수 시각적, 이미 부분 무료화됨). 순수 잔재 제거.

- [x] 2.1 Pro/paywall **삭제**: `GlobalModals.jsx` lead-modal(페이월)+store 구독 · `useDataStore.js` "(Pro)" 제목 2건+`isLeadModalOpen` 상태 · `VizTab.jsx` open-lead-modal CTA(알림 배너·메시지는 유지) · `SopContent.jsx` 데드 Pro 삼항 2건+중복 Pro 카피 2건 · `LandingPage.jsx`·`BudgetHealthCard.jsx` Pro 문구. (TOOL_TIER는 이미 전부 free·tierBadge "" — 원본값 주석 보존됨)
- [x] 2.2 Supabase **주석 처리**: `layout.js` `<Script supabase>` → `{/* TODO(B2B): 재활성 */}`. **실제 createClient/rpc 호출 없음**(스크립트 태그만) → 안전.
- [x] 2.3 device_token·@gondry DM·validate_access_key: v2엔 **원래 없음**(@gondry는 삭제한 페이월 모달에만 있었음). 추가 정리 불필요.
- 검증: eslint 편집 7파일 0 errors · 골든 27 테스트 GREEN 유지 · Pro 코드 잔재 0. 잔여 dead CSS(globals.css:2342 주석 등)는 Phase 3.

## Phase 3 — CSS/디자인 시스템 패리티 ✅ 완료 (⚡ULTRACODE)

격차 스코핑(스크립트): 토큰은 46개 중 **`--chart-h` 1개만 누락**(테마 골격 온전), 클래스는 **v2가 쓰는데 globals에 없는 것 A1=31개(index 有, 포트) + A2 v2신규 14개**.

- [x] 3.1 토큰: `--chart-h: 320px` :root 추가 (나머지 45개 이미 완비)
- [x] 3.2 공용 클래스 39개 index→globals.css **verbatim 포트** (+750줄, 3039→3789, 브레이스 555/555 균형): cmdk-*(⌘K 팔레트)·toast-*·alert-*·chart-container·csv-loaded/mapping-*·ab-stat/field/result-*·sidebar-feedback/sf-*·share-btn·moon/sun-icon·toc-filters·cann-card-header
- [x] 3.3 다크/라이트: `body.light-mode` 토큰 오버라이드 포트 확인. preview 토글 검증 — `--bg-1` #121212↔#f8f9fa, body 배경 전환 ✓
- [x] 3.4 v2 신규 클래스 14개(csv-dropzone·csv-drop-*·tab-pane/content·dashboard-content·hero*·landing-back-btn·sim-mode-toggle·alloc-card-title·ab-button) 최소 스타일 생성(토큰 재사용)
- **라이브 검증(preview)**: csv-dropzone(점선·40px·pointer)·chart-container(relative·260px)·⌘K 팔레트(블러 오버레이+패널+kbd, 다크·라이트 양쪽)·차트 렌더·테마토글 스크린샷 확인. CSS 컴파일 에러 0.
- 방법론 준수: 토큰·테마 전역 유지(CSS Modules 안 씀), verbatim 포트로 specificity 클래시 회피(리뷰 우려 대응).

## Phase 4 — 도구 UI 패리티 (7 도구) ⚡ULTRACODE(에러 도구)

- [x] 4.1 CampaignPvm.jsx **렌더 크래시 수정 완료** (라이브 검증). 근본원인: `chartCommonOpts().plugins`엔 `tooltip`만 있고 `legend` 없음 → trend 차트가 `...base.plugins.legend.labels` 스프레드 시 `undefined.labels` throw(`CampaignPvm.jsx:172`). 존재않는 legend 스프레드 2줄 제거. **상태(Zustand) 문제 아님 = Chart.js 렌더 버그**(예측 적중). preview로 CSV 주입→§0~§2 렌더·콘솔0·캔버스2 정상 확인.
      ⚠ **미완(후속)**: 컴포넌트가 아직 **MOCK**(₩0·하드코딩 차트, `PVM_MATH`·실 CSV 미사용). 실데이터 배선=5-21 파이프라인 전체 포트(§12.10: 최소grain Bennet·rollup·centering·§2/§3/§4 표·드릴다운·export) = 별도 대형 작업.
      ⚠ **동일 패턴 의심**: "CampaignPvm 등" — 병렬 서브에이전트 이관이라 타 도구 컴포넌트(MarketingResponse·CreativeAnalyzer·AbTestHoldout·AhaMomentFinder·MarketingEfficiency)에도 유사 `undefined 스프레드`/mock 잔존 가능 → 4.2~4.7에서 동일 preview 검증 필요.
      - 부수: `.claude/launch.json`에 v2 dev 서버 설정 추가(port 3000, `npm --prefix v2-migration run dev`).
- [x] **4.1b 전 도구 크래시 일괄 스윕 완료** (⚡ULTRACODE, 정적 색출 워크플로 6병렬 + preview 라이브 검증):
      **crash 수정 2건**: `CreativeAnalyzer.jsx:16`·`MarketingResponse.jsx:12` — `csvData && csvData.raw.length>0` (bug-class3, raw undefined 시 throw) → `csvData?.raw?.length>0`. 부수 eslint 4건(unescaped entities) 수정.
      **가드 일관성**: 남은 바레 가드 `CampaignPvm:20`·`BudgetAllocation:42`·`AhaMomentFinder:14`도 optional-chaining 통일(latent 크래시 차단, `setCsvData` 무가드라). 전 7도구 가드 통일.
      **라이브 검증(preview, csvData 주입)**: 5-3·5-22·5-6·5-4·5-18·5-20·5-21 전부 에러 오버레이 0·콘솔 에러 0. eslint tools/ 0 errors, 골든 27 GREEN 유지.
      ⚠ **광범위 mock 확인(수정 안 함, Phase 4.2~4.7)**: 전 도구가 대부분 placeholder/mock. `MarketingEfficiency`(5-22)만 실엔진(satMath) 연결. `CreativeAnalyzer`·`MarketingResponse`는 `Math.random()` mock 차트(§3 결정론 위반 — 실배선 시 제거 필수). 미사용 import 다수(STATS·CANNIBAL_STATS·AHA_STATS·CREATIVE_* 등).
**도구별 실/mock 그라운드-트루스 (grep+라이브, 2026-07-01)** — 크래시는 전부 해결됨(4.1b). 남은 건 mock→실엔진 배선:
- [x] 4.7 **5-22 MarketingEfficiency = 실엔진(satMath)** 작동. `page_5_22_raw.js`(2542줄 미사용 잔재)만 삭제하면 됨(경량).
**배치 1 완료 (2026-07-01, 라이브 검증)** — 패턴: `getMappedRows(csvData)`→엔진→실렌더. Math.random 4도구 전부 0, eslint 0, 골든 27 GREEN.
- [x] 4.2 5-3 BudgetAllocation — **완전 배선**: §2 검증(실 행수)·§3 채널표(실배분 ₩·설치·CPR·비중, TOTAL 합 정합)·§4 비중바(실%)·재계산·₩$토글. 라이브: ₩3,000,000→Meta36.6%/Google33.0%/TikTok30.4% inverse-CPR 정확.
- [x] 4.1c 5-21 CampaignPvm — **완전 배선**: PVM_MATH.decomposeFinest/Layer, §0~§4 실값. 라이브: COST 91,800→224,700원, CPA 546→513원, Mix/Rate 채널분해. deferred: 진단 hover-tip·PNG/CSV export·§4 페이지네이션.
- [x] 4.3 5-6 CreativeAnalyzer — **배선**: §1검증·§2소재지표(CTR/CVR/IPM/CPI 실측)·§4/§5 fatigue. §3 forest는 속성컬럼(hook_type/format) 있어야 산출(없으면 정직 "분석불가"). §6~8 deferred('준비 중').
- [x] 4.6 5-20 AhaMomentFinder — **배선**: AHA_STATS.gridSearch/lift, 자체 role 매핑. 이벤트 스키마(타겟0/1+action_dN) 필요 → 마케팅 CSV엔 정직 "분석불가"(fabricate 0). 실 compute는 이벤트 CSV 필요.
> **핵심 수정(§7 함정 재발)**: `getMappedRows`에 **cost↔spend 별칭** 추가 — 효율 CSV는 비용을 `cost`키로, PVM/creativeMath 엔진은 `spend` 읽음 → 불일치로 COST 0 버그. 단일 지점(dashboardAggregator)에서 둘 다 채워 해결(엔진·골든 무관).

### 배치 2 (특수 패턴)
- [x] 4.4 5-4 AbTestHoldout — **완전 배선**(단일 focused 에이전트 + 라이브 검증). Plan(sampleSizePerArm·budgetForTest)·Analyze(twoPropZTest+bayesianAB / continuousTest)·Threshold(mdeForSampleSize 매트릭스)·PowerCurve(powerCurve 차트)·readout/holdout(twoPropZTest 유의성+incrementality). 라이브: Plan n=31,235, Analyze z=1.894/p=0.0583/Bayes 96.96% (index 일치). eslint 0, 신규 Math.random 0(bayesianAB 내부는 엔진 상속). deferred: massReadout P(B>A)는 CREATIVE_STATS 미전달 시 "—"(index 동일).
- [x] 4.5 5-18 MarketingResponse — **완전 배선**(⚡ULTRACODE: 병렬 스카우트3→통합, 1440줄). Math.random 6→0. 라이브 검증:
      ② MMM=실(자동 colMap `deriveMmmPanel`: 표준 wide 경로 A + **LONG→WIDE 주간 피벗 경로 B**, mmmRunMmm/channelEffects/weeklyDecomp — 채널 탄력성·+$1k효과·예산가이드·5차트) · ③ 예측=실(mmmForecast R² 0.9987·밴드·OLS/Ridge) · 🧪 Lab=실(regLabRun R²=0.8509 골든 일치·60주 데모·역할매핑) · ① 진단=정직 안내(paid/organic 컬럼 필요 시).
      **발견(가드 갭)**: 완전 공선 데이터 시 ② MMM이 raw TypeError "reading 'beta'"(null-fit) 노출 — catch돼 크래시는 아니나 정직 메시지("공선 추정불가")여야. 실데이터 드묾이나 상관 예산서 근접 가능 → 후속 가드 추가 권장. (deferred: mmmResolveAbsorb 미이관으로 absorbed=∅)

## Phase 4 종합 — ✅ 전 도구 실배선 완료 (2026-07-01)
5-2 대시보드(기존 실) + 5-3·5-4·5-6·5-18·5-20·5-21·5-22 전부 실엔진 배선·라이브 검증. **Math.random 컴포넌트 0**(결정론 복원, abTestMath.bayesianAB 엔진 내부만 index 상속). eslint 0, 골든 27 GREEN. 크래시 0. 데이터 부족부는 정직 빈상태(§8).

### ⚠ 발견 — 사이드바 IA 라벨↔라우트 불일치 (Phase 6 라우팅)
`useDataStore` IA 라벨이 실제 마운트 컴포넌트와 어긋남: 라우트 5-4는 page.js가 AbTestHoldout 마운트(index ID 기준 정확)인데 사이드바 라벨은 "목표 및 LTV 달성 추적"; 5-6은 CreativeAnalyzer인데 라벨 "A/B 테스트". 즉 **사용자가 라벨 보고 클릭하면 다른 도구가 뜸**. page.js 라우팅은 index ID와 맞음 → **store IA 라벨을 컴포넌트/ID에 맞게 교정** 필요(Phase 6). 라우트 id 자체는 불변(§4.1).

## Phase 5 — 대시보드 5-2 (8탭) — ✅ 대부분 배선됨 (라이브 검증, 2026-07-01)

**정정(중요)**: 오래된 "9탭 build from scratch" 가정 폐기. **5-2는 이미 실데이터로 작동**:
- 8탭 전부 크래시 0 (viz·scorecard·pacing·anomaly·ltv·cohort·funnel·segment).
- `csvData.mapping` 소비해 실계산 — scorecard `비용 ₩39,000`·`설치 177` 업로드 CSV서 정확 산출. 채널 필터 실채널 추출.
- [x] 5.1 탭·필터·이벤트마커 렌더 (라이브 확인)
- [x] 5.2 8탭 크래시 0 확인
- [ ] 5.3 (잔여·소규모) 리치 CSV로 각 탭 수치 정합 정밀검증(코호트 Dn·LTV·퍼널 5단계·전역 분모 토글 §12.18) — 인라인 가능

## BCD 기능 파리티 배치 (2026-07-01, ⚡ULTRACODE — v2가 index 대비 빠진 기능 "덮어오기")
감사(9영역 갭 목록) → B1(HIGH 8도구 병렬) → B2(잔여 8병렬) → C(정리) → D(SOP).
- **B (도구 기능)**: 8도구 HIGH+잔여 대부분 이식. 예) 5-2 전역분모토글§12.18·LTV성숙예측·요일보정·이벤트마커·multi필터 / 5-3 진단·결론·검증스트립·시나리오·Min/Max·수동잠금·필터위저드·추세선컨트롤 / 5-6 Win-rate·Auto-Planner·ConceptMatrix·CPA/ROAS decompose(엔진확장) / 5-18 카니발랭킹·CEI·Granger/IRF·forecast편집·CSV export·흡수 / 5-21 CSV수식/PNG/진단툴팁/Top-mover/§4셀렉터 / 5-22 게이트·통화·템플릿 / 5-20 매핑편집·게이트·CSV / 5-4 massReadout P(B>A).
  - **실 버그 수정**: `creativeMath.decompose` FWL이 절편까지 demean→특이행렬(§7 P0) → index verbatim 교정 + cpa/roas 지원 + 골든 T12/T13.
- **C (정리)**: 리텐션 SSOT(computeWeightedRetention) + Cohort/Scorecard denom 구독 · SopContent Math.random 결정론화 · mkt-engineer.md v2 동기화(§15). dead CSS 비이슈.
- **D (SOP 콘텐츠)**: **정정 — 이미 완비**. 가이드는 하드코딩 `page_X` 함수에서 실콘텐츠 렌더(1-3 3937자 검증). JSON fetch 엔진은 dead code라 JSON 이식 시도는 되돌림. 유용분(코드블록 복사·정렬표) 유지.
- **검증**: `npm run test:all` **44파일·223 테스트 GREEN**(golden 26 + smoke 18) · eslint 0 · next build ✓ · 5-2/5-3 등 신규기능 preview 라이브 확인.
- **deferred(정직·소규모/인프라)**: 일부 PNG(전역 delegation 부재)·데모모드(v2 인프라 부재)·per-tool 피드백넛지(v2 아키 폐기)·데이터×기능 매트릭스·일부 툴팁 wording.

## 추가 작업 배치 (2026-07-01, 사용자 요청)
- [x] **IA 재배치**: 5-21(캠페인 성과 변동/PVM)을 효율 CSV 공유 family와 함께 **그룹 05(운영 대시보드·캠페인 분석)**로 이동(5-2·5-21·5-22·5-3), 그룹 07에서 제거. preview 확인.
- [x] **sum-to-상위그룹 수정**: creative_name 포함 CSV에서 분해 안 하는 도구(5-22·5-3)가 per-creative 점 찍던 버그 → **(사용 grain × 날짜) 먼저 합산 후 점 1개** 생성. `satMath.satBuildPoints`·`BudgetAllocation.buildByChannel` 수정. 검증: satBuildPoints 프로브(2creative→1점, cost 합산), 5-3 live(56행→§2 채널당 14점), 5-22 렌더 정상. 골든 27 GREEN.
- [x] **코드맵 `v2-migration/ARCHITECTURE.md` 생성**(~200줄): 트리·라우트↔컴포넌트↔엔진·SSOT·글로벌CSS·내비팁. CLAUDE.md §13 참조 + §15 동기화 의무 추가(큰 작업 전 읽기·기능 추가 시 갱신).
- [x] **CLAUDE.md 개정**: §2.1 단일HTML 폐기→이행체제·§3 v2스택·§12.20 마이그레이션 패턴·§13 코드맵·§15 코드맵 동기화·§16 현황.
- [x] **라이트/다크 초기 노출**: `.app.is-home .topbar{display:none}`가 랜딩에서 테마 토글까지 숨기던 문제 → 랜딩에선 **바 투명·breadcrumb만 숨김·우측 액션(테마·⌘K) 유지**. 첫 화면부터 테마 전환 가능(테마 init은 시스템선호/localStorage 존중, Header.jsx). preview 검증(랜딩 라이트 렌더 정상).

## 자동 진행 배치 (2026-07-01, 인라인·비-ultracode)
Phase 4 종료 후 명확한 인라인 정리 자동 수행. 전 항목 라이브/eslint 검증.
- [x] **사이드바 IA 정합화**(6.1): `useDataStore` IA가 구 17-도구 라벨이라 라우트↔라벨 불일치(5-4→AbTest인데"LTV", 5-6→Creative인데"A/B", 5-21→PVM인데"미래KPI", 5-20→Aha인데"상관분석") + phantom id 9개(빈 화면). → **8개 실도구로 재작성**(index §4.2 라벨, phantom 제거, 3그룹). preview로 라벨↔컴포넌트 일치 확인.
- [x] **5-18 null-fit 가드**: 공선 데이터 시 raw TypeError("reading 'beta'") → 정직 도메인 메시지("회귀 추정 불가 — 공선성/기간 부족"). preview 검증.
- [x] **`page_5_22_raw.js` 삭제**: 2,542줄 미사용 vanilla 잔재(import 0·React 아님·실 5-22는 MarketingEfficiency). tools/ 클린.
- [x] **build-blocking lint 4건 수정**(사전존재): CsvUploader unescaped `"` 2건, LtvTab·ScorecardTab setState-in-effect(조건부 리셋 — 안전 주석+정확 rule disable). **전체 src eslint 0 errors**(4 warnings 비차단).
- [x] **`npm test` 스크립트 추가**(Phase 7): `vitest run src/utils` — 골든 27 GREEN.

## Phase 6 — 셸·라우팅·상태 아키텍처 (사용자 결정 반영 2026-07-01)

- [x] 6.1 사이드바 IA 정합화 (자동 배치 완료 — 8도구·라벨↔라우트·phantom 제거)
- [x] 6.2 CsvUploader 매핑 UI — 실재·작동 확인 (자동매핑+수동 select+검증)
- [x] **6.3 CSV 그룹 스코프 상태 완료** ⚡ — `csvGroups`{efficiency/creative/experiment/response/aha} 슬라이스 + `TOOL_GROUP`(id→group) + `groupForRoute`. **미러 설계**(저위험): Path 라우팅으로 한 번에 한 도구만 렌더 → `csvData`를 활성 그룹 미러로 유지, `setCurrentRouteId`가 라우트 변경 시 미러 스왑, `setCsvData`는 활성 그룹+미러 기록. **소비자 21개·CsvUploader·page.js 무변경**(store만). 라이브 검증: 효율 family(5-2/5-21/5-22/5-3) 공유 · Aha 격리 · 양방향 유지 · build ✓·eslint 0·골든 GREEN.
- [x] **6.4 Path 라우팅 완료** ⚡ — Next 표준 Path 라우팅: `src/app/[[...slug]]/page.js`(optional catch-all)가 dispatch 대체(구 page.js 삭제), `src/lib/routeMap.js`(slug↔id SSOT, id 불변), Sidebar/LandingPage/BudgetHealthCard `<Link>`/`router.push`, `src/app/sitemap.js`(23 URL), `not-found.js`. slug: `/`·`/dashboard`·`/tools/<kebab>`·`/guide/<kebab>`. 검증: **next build ✓**, 홈·클라 nav(URL변경+렌더)·딥링크·404·sitemap 23·**store 유지(csvData 지속)** 전부 라이브 확인, eslint 0.

## Phase 7 — 테스트 하네스 (배포 게이트)

- [x] 7.0 vitest 부트스트랩 + `npm test`(=`vitest run src/utils`) — 러너 확정, 현 6종 27 GREEN
- [x] 7.1a **커버리지 감사 완료** (2026-07-01): index 골든 **20종** vs v2 vitest **6종**(cannibal·mmmStat·regStats·mmmMeth·regForecast·regLab).
      **미이관 15종** ⚡: `runAllocPoly2Tests`(ALLOC) · `runSatTests`(SAT) · `runCreativeTests`(CREATIVE) · `runAhaTests`(AHA) · `runLtvCacTests`(LTV) · `runReadoutTests`·`runMassReadoutTests`·`runIncrTests`(ABTEST) · `runFunnelTests`·`runSegmentTests`·`runScorecardAnomalyTests`·`runPacingTests`·`runMaturationTests`(대시보드 집계) · `runMmrCoreTests` · `runQualityTests`. (PVM은 `runPvmTests` 있으나 v2 vitest 미생성 — 포함).
      Phase 1에서 diff로 검증했으나 **자동 골든 회귀 부재** → 배포 게이트 위해 포트 필요.
- [x] 7.1b **골든 포트 완료** (⚡ULTRACODE 16병렬): **8종 신규 GREEN** — runAllocPoly2·runSat·runCreative·runMassReadout·runMmrCore·runPvm·runAha·runLtvCac. **전체 14 파일·102 테스트 GREEN**(27→102).
      **실 버그 잡음**: `creativeMath.betaProbGreater` 시그니처가 index와 diverge(5번째 인자를 config 객체로 오해석 → gridN 오류 → 0.5 폴백) → **index verbatim 복원**(`CREATIVE_BAYES` 모듈상수, `betaProbGreater(...,gridN=2000)`). abTestMath massReadout latent 버그도 함께 해소. 골든의 가치 입증.
- [x] 7.1c **embedded math 추출 완료** (⚡ULTRACODE 7병렬): 컴포넌트 inline math → 순수 util 추출 + 재배선 + 골든. 신규 util: `funnelMath·segmentMath·anomalyMath·pacingMath·cohortMath·incrMath` + `ahaMath.ahaParseActionWindow`. 골든 신규: runFunnel·runSegment·runScorecardAnomaly·runPacing·runQuality·runMaturation·runReadout·runIncr(+runAha T7). **전체 22파일·155 테스트 GREEN**. 재배선 7컴포넌트 preview 크래시 0. 부수 버그수정: SegmentTab 축 키잉(`r[mapping[axis]]`→`r[axis]`, 전 행 붕괴)·Pacing daysElapsed(day-of-month, index 정합).
- [x] 7.2 **렌더 스모크 완료** (⚡ULTRACODE): jsdom 하네스(vitest projects: golden node + smoke jsdom; `test`/`test:smoke`/`test:all`) + chart.js/next-navigation/ResizeObserver/matchMedia/canvas 목킹. 20 컴포넌트(도구 8·대시보드 탭 8·셸) 무데이터+데이터 마운트 not.toThrow() + 키노드 assert. 렌더 버그 0.
- **게이트 충족 ✅**: `npm run test:all` = **42 파일·202 테스트 GREEN**(골든 22 + 스모크 20)·eslint 0·next build ✓. Phase 8 배포 컷오버 준비 완료(실제 컷오버는 사용자 결정).

## Phase 8 — 배포 전환 ⏸ 대기 (Phase 7 100% 이후)

**결정**: 실제 배포 컷오버는 **Phase 7 골든 100% 통과 후로 보류**. 그 전까지 index.html이 라이브 유지.
- [ ] 8.1 Railway를 Next 빌드/구동으로 전환 (Railway 유지 결정)
- [ ] 8.2 Procfile·railway.json·package.json 정리 (Next `build`/`start`)
- [ ] 8.3 전 도구 최종 패리티 signoff
- [x] 8.4 CLAUDE.md 단일HTML 원칙 폐기 + Next 모듈화 개정 (지금 수행 — 사용자 결정)

## 결정 로그 (2026-07-01, 사용자 확정)
1. **라우팅**: Hash 폐기 → **Next Path 라우팅** + sitemap.xml. (Phase 6.4)
2. **CSV 상태**: **그룹별 스코프 공유**(TOOL_GROUP 기반, 이질 도구는 별도 슬라이스). (Phase 6.3)
3. **배포**: Phase 7 100% 후 컷오버(보류). **CLAUDE.md 단일HTML 원칙은 지금 폐기·개정**.
4. **자가 업데이트**: 승인 — 마이그레이션 패턴/함정/배선을 CLAUDE.md에 압축 문서화.

---

## 방법론 원칙 (리뷰 피드백 반영 — 전 Phase 적용)
1. **골든 테스트 먼저(TDM)**: 각 Phase에서 대상 모듈의 골든 테스트를 v2 vitest로 먼저 이식 → "테스트 통과까지 자체 검증" 지시. Phase 7은 몰아서가 아니라 Phase별 분산(1.4에서 vitest 부트스트랩 완료). 검증됨: 1.4가 tolerance 완화·수정 0건 통과.
2. **CSS는 토큰 전역·패리티 우선**(Phase 3): `:root` 토큰+다크/라이트 테마는 **전역 유지 필수**(CSS Modules는 `:root` 스코핑 불가→테마 붕괴). 공용 구조클래스(.chart-container 등)도 전역. **일회성 컴포넌트 스타일만** 선택적 `.module.css`. 스코핑 리팩토링은 패리티 확보 후 별도 패스(이관 중 혼입 시 원인분리 불가). Tailwind 미사용 확인.
3. **store-wiring 감사 = Phase 4/5 1급 단계**: index의 `CSV_STATE`/`getMappedRows` 읽던 함수를 컴포넌트 이관 시 반드시 `useAppStore`(Zustand) 구독으로 재배선. (1.4 수학코어는 전역 read 0건이라 무관. CampaignPvm은 이미 useAppStore 구독 중 → 그 에러는 상태 아닌 Chart.js/렌더 버그로 추정, 4.1에서 확인.)

## ⚡ULTRACODE 딥다이브 후보 (사용자 지시 시 workflow)
1. **Phase 1.4** CANNIBAL/MMM/REG 엔진 골든 대조 (최대 로직 밀도)
2. **Phase 3** CSS 디자인 시스템 전수 패리티 (4,476줄)
3. **Phase 4.1** CampaignPvm 에러 근본원인 + 4.5 회귀·예측
4. **Phase 5** 대시보드 9탭

## 결정 완료 / 대기 (사용자)
- ✅ 최종 목적지: **완전 전환** (Next.js = 새 SSOT)
- ✅ 8.1 배포 타깃: **Railway 유지** (Next를 Railway Node 서버로 빌드/구동, 기존 도메인)
- ✅ 다음 순서: Phase 0 완료 → **Phase 1 (수학엔진 골든 대조)**
- ⏳ 4.7 `page_5_22_raw.js` 이관 vs 폐기 (Phase 4 도달 시)
