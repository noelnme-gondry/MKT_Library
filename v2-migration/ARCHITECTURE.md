# V2 CODE MAP — 어디에 무엇이 있는가

> 목적: 최소 토큰, 즉시 파일 탐색. 설명 최소, **경로 매핑** 집중.
> 이행 중: `index.html`(레거시, Phase 8 컷오버 전 라이브) → `v2-migration/`(Next.js). 상세 계획·현황: `../docs/v2-migration-tasks.md`.

## 1. 디렉토리 트리 (핵심)
```
v2-migration/
├─ src/
│  ├─ app/
│  │  ├─ [[...slug]]/page.js # ★ Path 라우팅 dispatch (URL→routeMap→컴포넌트) + not-found.js
│  │  ├─ blog/page.js·[slug]/page.js # 블로그(SEO 마케팅 컬럼) — fs MD 파이프라인, routeMap 밖
│  │  ├─ sitemap.js·rss.xml/route.js # SEO: routeMap ROUTES + getAllPosts(블로그) 파생
│  │  ├─ layout.js          # <head>·SEO 메타(SITE_URL)·GTM/GA4/AdSense·naver·rss alternate + <GaPageviews/>(SPA page_view)
│  │  ├─ ../../next.config.mjs # 보안헤더(X-Frame-Options·CSP frame-ancestors·nosniff·Referrer-Policy)
│  │  ├─ globals.css        # ★ 전 디자인 시스템 (Obsidian Flux 토큰·다크/라이트·전 클래스)
│  │  └─ page.module.css    # 랜딩 일부 스코프 스타일
│  ├─ lib/routeMap.js·blog.js # routeMap=slug↔id SSOT(id 불변, §4.1) / blog.js=fs MD 로더(server 전용, gray-matter+marked, content/blog/*.md 읽음)
│  ├─ store/
│  │  └─ useDataStore.js    # ★ SSOT: Zustand — IA·csvGroups(스코프)·csvData(미러)·TOOL_GROUP·필터·currentRouteId·테마·adGate/adFree(광고 §12.26)
│  ├─ utils/                # ★ 순수 통계엔진 (ESM, 수학 불변, vitest 골든) + 데이터층 + 추출 math(funnel/segment/anomaly/pacing/cohort/incr)
│  └─ components/
│     ├─ ds/            # ★ 디자인시스템 공용(design-system-baseline.md): DataTable·CsvGuide·AnalyzingOverlay·ResultActionCard(결론카드)·DownloadHub(다운로드 드롭다운, §12.27)
│     ├─ landing/       # 랜딩 히어로 조각: ProductPreview(라이브 제품 미리보기·mp4 교체가능)·ToolCarousel(질문 슬라이드)·ToolCardMock(SVG 목업)·LiveMiniChart
│     ├─ GaPageviews.jsx     # SPA 라우트 변경 시 GA4 page_view(usePathname, 최초 로드 제외)
│     ├─ AdInterstitial.jsx·AdFreeInit.jsx # 분석하기 전면광고 모달(store adGate·requestAd/closeAd) + 광고제외 비밀 URL(?adfree=토큰). §12.26
│     ├─ Sidebar/Header/LandingPage/CsvUploader/GlobalModals/Dashboard.jsx  # 셸
│     ├─ tools/             # 8개 Pro 도구 (route별 1 컴포넌트)
│     ├─ dashboard/         # 5-2 운영 대시보드 8탭 + 필터바 + 이벤트마커
│     └─ sops/SopContent.jsx # SOP 가이드(1-x~4-x) + 랜딩 IA 렌더
├─ ARCHITECTURE.md (이 파일) · package.json (test=vitest run src/utils)
```

## 2. 라우트 → slug → 컴포넌트 (Next Path 라우팅)
**Next 표준 Path 라우팅**: `src/app/[[...slug]]/page.js`(optional catch-all) URL 받음 → `src/lib/routeMap.js`(slug↔id SSOT)로 id 해석 → 컴포넌트 렌더. `src/app/sitemap.js`(23 URL)·`not-found.js`. route id §4.1 불변, slug↔id 매핑층뿐. 사이드바=`<Link href>`, store `currentRouteId`는 URL 미러.

| slug (URL) | id | 컴포넌트 |
|---|---|---|
| `/` | home | LandingPage |
| `/dashboard` | 5-2 | Dashboard → dashboard/* (8탭) |
| `/tools/campaign-variance` | 5-21 | tools/CampaignPvm.jsx (PVM) |
| `/tools/campaign-saturation` | 5-22 | tools/MarketingEfficiency.jsx (포화도) |
| `/tools/budget-allocation` | 5-3 | tools/BudgetAllocation.jsx (예산) |
| `/tools/creative-analysis` | 5-6 | tools/CreativeAnalyzer.jsx (소재) |
| `/tools/experiment-analysis` | 5-4(+5-7,5-15) | tools/AbTestHoldout.jsx (A/B 설계+판독) |
| `/tools/incrementality` | 5-23 | tools/Incrementality.jsx (증분: 통제군·전후 on/off) |
| `/tools/marketing-response` | 5-18 | tools/MarketingResponse.jsx (MMM·회귀·예측·Lab) |
| `/tools/aha-moment` | 5-20 | tools/AhaMomentFinder.jsx (Aha) |
| `/content/element-analysis` | 9-1 | tools/ContentElementAnalyzer.jsx (요소 중요도, regMath 신규 UI) |
| `/content/killer-content` | 9-2 | tools/KillerContentFinder.jsx → AhaMomentFinder domain="content" |
| `/guide` | guide-index | GuideIndex.jsx (SOP 목록, 블로그처럼 자체 주소) |
| `/guide/<kebab>` | 1-x~4-x | sops/SopContent.jsx (SOP) |

**Content Analytics(9-x)**: 퍼포먼스 엔진을 콘텐츠 도메인 라벨로 리라벨. 라벨팩 SSOT=`utils/contentDomain.js`. CSV 격리 그룹 `content_*`. PageClient 폴백 가드 `!startsWith("9-")`(SopContent 누수 차단). **콘텐츠는 SECTIONS `analysis`로 흡수**(별도 카테고리 제거, 사이드바 자동 반영). slug `/content/*`는 SEO·북마크 보존.
**가이드 인덱스**: `/guide`=`guide-index`(routeMap) → PageClient(KR·EN) 분기 → `GuideIndex.jsx`. 랜딩 무주소 track(guide/content) 제거 → 뒤로가기 정상.

## 3. 도메인 매핑 (도구 UI ↔ 순수 엔진)
| 도구 (UI) | 엔진 (수학, utils/) | 비고 |
|---|---|---|
| BudgetAllocation.jsx | `allocationMath.js` (ALLOC_MATH) | fitBest·predictSafeCpr·removeOutliers |
| MarketingEfficiency.jsx | `satMath.js` (SAT_MATH,satBuildPoints) + allocationMath | 포화지수 |
| CampaignPvm.jsx | `pvmMath.js` (PVM_MATH) | Bennet 분해·rollup |
| CreativeAnalyzer.jsx | `creativeMath.js` (CREATIVE_MATH/FATIGUE/STATS) | WLS·피로도 |
| AbTestHoldout.jsx | `abTestMath.js` (STATS) | z-test·bayesian·powerCurve (A/B만) |
| Incrementality.jsx (5-23) | `incrMath.js`(통제군 INCR_MATH)+`incrPrePostMath.js`(전후 on/off·DiD·Welch) | 3방법 탭·CSV 그룹 독립 |
| MarketingResponse.jsx | `mmmMath.js`(MMM 기여분해+`mmmForecast` §7 미래예측)+`regMath.js`(mmmOls)+`responseCannibRank.js` | ①진단·②기여분해·③회귀예측 3탭, 단일 CSV/colMap. ③예측=`mmmForecast`(②계수 외삽+95%밴드). `regForecastMath`=날짜포맷 헬퍼뿐, `regLabMath`=테스트 전용(앱 미사용) |
| AhaMomentFinder.jsx | `ahaMath.js` (AHA_STATS) | gridSearch·F1/Lift. `domain` prop(§contentDomain)로 5-20(perf)·9-2(content) 공용 |
| ContentElementAnalyzer.jsx (9-1) | `regMath.js` (REG_STATS.ols) | 콘텐츠 요소 다변량 회귀·중요도(|t| 랭킹)·forest plot. 신규 UI(엔진 재사용) |
| KillerContentFinder.jsx (9-2) | `ahaMath.js` (AHA_STATS) | AhaMomentFinder domain="content" 얇은 래퍼 |
| dashboard/* (5-2) | `dashboardAggregator.js`(getMappedRows·KPI)·`ltvMath.js`·`funnelMath.js`·`segmentMath.js`·`anomalyMath.js`·`pacingMath.js`·`cohortMath.js`·`responseMath.js`(CANNIBAL_STATS) | 탭별 순수 math 추출 끝(골든 커버) |
| AbTestHoldout 증분 | `incrMath.js`(홀드아웃 증분)·abTestMath.js | readout/incr 추출 |
| (공통) | `chartUtils.js`·`testFixtures.js`(seededNoise)·`format.js`(fmtCurrency/Pct/Num·§7 콤마)·`toolGuide.js`(TOOL_GUIDE) | 차트·픽스처·표시포맷 SSOT·업로드 설명 |
| (필드 정의) | `csvConstants.js` (STANDARD_FIELDS·TOOL_REQUIRED/OPTIONAL_FIELDS) | 매핑 스키마 |
| (지표 정의) | `metrics/metricRegistry.js` (BASE_FIELDS·DERIVED_METRICS·getMetricRegistry·computeMetrics) | ★ 파생지표 SSOT(ctr·cpc·roas… + 프리셋 profit·profitMargin 서술자). `calculateKPIs`가 소비. 커스텀 지표 병합 지점. 스펙: `../docs/custom-metrics-data-config-spec.md` |
| (커스텀 지표) | `metrics/customMetric.js` (CUSTOM_OPS·defToTerms·evalTerms·customMetricCompute·customMetricToDescriptor·isValidCustomMetricDef) | 유저가 실제 컬럼/숫자를 N항 좌→우로 조립(eval 없음, 순수·결정론). def.terms[]. UI=`ds/CustomMetricBuilder.jsx`(항 추가·컬럼/숫자 토글·라이브 미리보기, body portal). 소비: VizTab KPI·**ScorecardTab**(정의 스코프 `5-2:viz-kpi` 공유 — 한번 만들면 양쪽) |
| (커스텀 차트) | `metrics/chartBuilder.js`(CHART_TYPES·groupAggByDim·buildChartSeries 순수 집계) + `customChartConfig.js`(buildCustomChartConfig·buildChartFieldOptions·DIM_CANDIDATES, 컴포넌트층) | 유저가 "모양+행+값"로 차트 생성, 값=base/파생/커스텀 지표. UI=`ds/CustomChartBuilder.jsx`. 재사용 영역=`dashboard/CustomChartsSection.jsx`(자체 Chart.js 관리, 탭에 1줄 삽입 — VizTab §3·Segment·Funnel·Cohort·LTV·Pacing·Anomaly 탭. scope `5-2:<tab>-charts`, metricScope `5-2:viz-kpi` 공유) |
| (지표 뷰 설정) | `metrics/metricView.js` (materializeOrder·applyMetricView·moveInOrder) | 순수 리졸버 — viewConfig(hidden/order/**sizes**)를 후보에 적용. **카드=`ds/InlineCardEditor.jsx`**(그 자리 인라인 편집: ⠿드래그·👁표시/숨김·⤢크기2칸, 라이브 저장 — Scorecard·VizTab KPI). 차트/표=`ds/MetricConfigPanel.jsx`(모달 편집기, DnD+터치). 소비 scope: `5-2:scorecard`(ScorecardTab)·`5-2:viz-kpi`·`5-2:viz-charts`(VizTab KPI카드·차트)·`5-2:ltv-table`(LtvTab §2 지표 컬럼). 표면당 ⚙ 진입점(카드=지표 편집·차트=차트 편집·표=컬럼 편집) |

## 4. 상태 & 데이터 흐름 (SSOT)
- **전역 상태 = `src/store/useDataStore.js` (Zustand)**: `currentRouteId`(URL 미러) · `dashboardFilter` · `isDarkMode` · `isCmdkOpen` · `IA`·`PHASES` · **`TOOL_GROUP`·`groupForRoute`** · **`viewConfig`**(지표 표시/순서, scope별).
- **persist(Phase B/C)**: `persist` 미들웨어로 **`viewConfig`+`customMetrics`만** localStorage 저장(`partialize=persistPartialize`, name `mkt_view_config`). 원본 CSV·필터 Set은 **절대 저장 X**(§2.2). 서버/테스트엔 `noopStorage` 폴백. `customMetrics`={scope→조립정의[]}·`customCharts`={scope→차트정의[]}, add/remove 액션.
- **CSV 그룹 스코프 상태(Phase 6.3)**: `csvGroups`{efficiency·creative·experiment·response·aha} 슬라이스. `csvData`=활성 그룹 **미러**(`setCurrentRouteId`가 라우트 변경 시 스왑, `setCsvData`가 활성 그룹+미러 기록). 효율 family(5-2·5-21·5-22·5-3) 공유, 나머진 격리. **소비자는 `s.csvData`만 읽으면 끝**(미러라 무변경).
- **데이터 파이프라인**: 업로드(`CsvUploader.jsx`, PapaParse+자동매핑) → `csvData` → **`dashboardAggregator.js:getMappedRows(csvData)`** (raw행 → 표준키 행; **cost↔spend 별칭 채움 §7**) → 도구별 엔진 입력 구성 → 순수엔진 → 렌더.
- **함정**: 효율 CSV 비용=`cost`키, PVM/creative 엔진은 `spend` 읽음 → getMappedRows가 양쪽 채움. creative 등 하위 grain CSV, 분해 안 하는 도구(5-22·5-3)에선 (그룹×날짜) **sum 후 점 생성**(satBuildPoints·buildByChannel).
- **CSV 상태 스코프(Phase 6.3 예정)**: TOOL_GROUP 기반 — 효율 CSV family(5-2·5-21·5-22·5-3) 공유, 이질 도구는 별도 슬라이스.

## 5. 글로벌 스타일 (CSS/테마)
- **`src/app/globals.css`** — 전 디자인 시스템, 단일 파일. **CSS Modules로 쪼개지 말 것**(토큰 스코핑 불가).
- **Obsidian Flux 토큰**: `:root { --bg-1·--text-muted·--border·--primary... }`. **다크/라이트 = `body.light-mode` 오버라이드**(토큰 값 스왑).
- 공용 클래스 전역: `.chart-container`·`.callout`·`.block`·`.ab-pill`·`.cmdk-*`·`.toast-*`·`.pvm-*` 등. 차트 색은 `CHART_THEME` getter(하드코딩 hex 금지).
- 일회성 컴포넌트 스타일만 `*.module.css`.

## 6. 테스트 & 린트 (배포 게이트)
- vitest **2 프로젝트**: `npm test`=golden(node, `src/utils/*.test.js`, 순수엔진 골든 22파일) · `npm run test:smoke`=jsdom 컴포넌트 마운트(`*.smoke.test.jsx`) · `npm run test:all`=둘 다(**42파일·202 GREEN**). 골든=index `runXxxTests` verbatim(tolerance 완화 금지). 스모크 목킹은 `vitest.smoke.setup.js`(chart.js/next-navigation/ResizeObserver/matchMedia/canvas).
- `npm run lint` = eslint(0 errors) · `npx next build`(컴파일 게이트). 추가 렌더 검증은 preview 라이브.

## 7. 내비게이션 팁
- **수학/통계 고칠 땐 → `src/utils/*.js`** (엔진; 수학 변경 시 대응 `*.test.js` 골든 확인).
- **도구 UI 고칠 땐 → `src/components/tools/<도구>.jsx`** (표 §2에서 route→파일 찾기).
- **대시보드(5-2) 탭 고칠 땐 → `src/components/dashboard/<Tab>.jsx`**.
- **전역 상태·IA·라우트 → `src/store/useDataStore.js`**.
- **색/테마/레이아웃 → `src/app/globals.css`** (토큰은 `:root`+`body.light-mode`).
- **CSV 매핑/필드 스키마 → `src/utils/csvConstants.js` + `src/components/CsvUploader.jsx`**.
- **데이터 엔진에 안 들어감 → `getMappedRows`(dashboardAggregator.js) + 표준키/별칭 확인**.