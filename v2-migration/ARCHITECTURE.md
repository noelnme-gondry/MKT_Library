# V2 CODE MAP — 어디에 무엇이 있는가

> 목적: 최소 토큰, 즉시 파일 탐색. 설명 최소, **경로 매핑** 집중.
> 규칙·함정·레시피는 루트 `../AGENTS.md`(정경). 이 파일은 "어디에 있나"만 답한다.
> **새 도구·엔진·경로·상태 슬라이스를 추가/이동/삭제하면 같은 작업에서 이 파일도 갱신**(AGENTS.md §15).

## 1. 디렉토리 트리 (핵심)
```
v2-migration/
├─ src/
│  ├─ app/                          # App Router — KR/EN을 route group으로 분리
│  │  ├─ (ko)/[[...slug]]/          # ★ KR dispatch: page.js + PageClient.jsx + error.js + not-found.js
│  │  ├─ (en)/en/[...slug]/         # ★ EN dispatch: page.js + PageClient.jsx + error.js
│  │  ├─ (ko|en)/blog/·glossary/    # 블로그·용어사전 (fs MD 파이프라인, routeMap 밖) + blog/tag/
│  │  ├─ (ko|en)/calculator/        # 계산기 허브 + [slug]
│  │  ├─ (ko|en)/diagnose/·contact/·privacy/·terms/·templates/
│  │  ├─ (ko|en)/weekly-review/·weekly-report/   # 결정 검토 루프 · 주간 리포트
│  │  ├─ sitemap.js·rss.xml/·(en)/en/rss.xml/·llms.txt/  # SEO 파생(공개 routeMap + 발행 콘텐츠, 개수 하드코딩 금지)
│  │  ├─ og-card.png/·og/tool/[id]/              # 전역/도구별 동적 OG 카드
│  │  ├─ layout.js·global-error.js               # 폰트·SEO 메타·GTM/GA4/AdSense·초기 테마·<GaPageviews/>
│  │  └─ globals.css                             # ★ 전 디자인 시스템 (단일 파일, 쪼개지 말 것)
│  ├─ store/useDataStore.js         # ★ SSOT: Zustand — IA·csvGroups·csvData 미러·필터·라우트·viewConfig
│  ├─ utils/                        # ★ 순수 통계엔진 (*Math.js, 수학 불변·골든) + 표시/데이터 헬퍼
│  │  └─ metrics/                   # 지표 SSOT: metricRegistry·customMetric·chartBuilder·metricView
│  ├─ lib/                          # 도메인 로직 (라우팅·SEO·데이터임포트·분석라우터·analysis/webr 고급엔진…)
│  ├─ workers/                      # dataPreparation·xlsxParse·dashboardVerdict·forecastSelection
│  └─ components/
│     ├─ ds/                        # ★ 공용 데이터 UI (§12.21·§12.27)
│     ├─ assistant/                  # 홈 전용 도치 데이터 접수·작업대 handoff UI (분석 엔진/원본 데이터 소유 안 함)
│     ├─ tools/                     # route별 도구 1 컴포넌트
│     ├─ dashboard/                 # 5-2 운영 대시보드 9탭 + 필터바 + 커스텀차트
│     ├─ data-import/               # 업로드 후 판정 UI (기준바·가능분석·품질리포트·이력)
│     ├─ landing/·seo/·calculators/·sops/
│     ├─ ToolPageOutro.jsx      # ★ 하단 마감 박스 = 경계선 + 다음단계·참고자료·관련글 (§12.30)
│     ├─ GuideAnswer.jsx        # 가이드 질문·한 문장 답 (본문 위, 접기 바깥)
│     └─ Header/Sidebar/Footer/CsvUploader/GlobalModals/StartGate/WeeklyReview…  # 셸
├─ content/blog(-en)/·glossary(-en)/   # 발행 원고 (fs가 SSOT)
├─ ARCHITECTURE.md (이 파일) · claude-ux.md (UX 원칙)
└─ package.json  # test=vitest --project golden · test:smoke=--project smoke · test:all=둘 다
```

## 2. 라우트 → slug → 컴포넌트
**Path 라우팅**: URL → `src/lib/routeMap.js`(slug↔id SSOT) → `PageClient`가 컴포넌트 디스패치. **route id 불변**(AGENTS.md §4.1), slug↔id 매핑층뿐. 사이드바=`<Link href>`, store `currentRouteId`는 URL 미러. `sitemap.js`는 `isRoutePublished()`+발행 콘텐츠에서 파생(개수 하드코딩 금지).
`publication` 필드: 없으면 공개 · `"subtool"`(5-18 하위 진입) · `"preview"`(9-2·9-3·9-7, IA에서 `hidden:true`) · `legacy:true`(구 id → 현 도구 redirect).

| slug (URL) | id | 컴포넌트 |
|---|---|---|
| `/` | home | LandingPage |
| `/dashboard` | 5-2 | Dashboard → dashboard/* (9탭) |
| `/tools/campaign-variance` | 5-21 | tools/CampaignPvm.jsx (PVM) |
| `/tools/campaign-saturation` | 5-22 | tools/MarketingEfficiency.jsx (포화도) |
| `/tools/budget-allocation` | 5-3 | tools/BudgetAllocation.jsx |
| `/tools/experiment-analysis` | 5-4 (+5-7·5-15 legacy) | tools/AbTestHoldout.jsx (A/B) |
| `/tools/incrementality` | 5-23 | tools/Incrementality.jsx (통제군·전후 on/off) |
| `/tools/brand-campaign-incrementality` | 5-24 | tools/BrandCampaignIncrementality.jsx (ITS·AR(1)) |
| `/tools/vif-multicollinearity` | 5-25 | tools/MulticollinearityChecker.jsx (채널 지출 VIF·상관) |
| `/tools/asa-keyword-finder` | 5-26 | tools/AsaKeywordFinder.jsx (Exact 승격·CPT 조정) |
| `/tools/aso-store-conversion` | 5-27 | tools/AsoStoreConversion.jsx (스토어 퍼널·믹스 vs 효율 분해) |
| `/tools/marketing-response` | 5-18 | tools/MarketingResponse.jsx (MMM·회귀·예측) |
| `/tools/paid-organic-trend` | 5-18-paid-organic | tools/PaidOrganicTrend.jsx |
| `/tools/marketing-trend` · `/tools/cannibalization-diagnosis` · `/tools/mmm-contribution` · `/tools/marketing-forecast` | 5-18-{trend,cannibal,mmm,forecast} | MarketingResponse.jsx (stage 진입) |
| `/tools/aha-moment` | 5-20 | tools/AhaMomentFinder.jsx |
| `/content/element-analysis` | 9-1 | tools/ContentElementAnalyzer.jsx |
| `/content/freshness` | 9-6 | tools/CreativeAnalyzer.jsx (소재, 구 5-6 통합) |
| `/content/killer-content` | 9-2 | tools/KillerContentFinder.jsx → AhaMomentFinder `domain="content"` |
| `/content/traffic-variance` | 9-3 | tools/ContentTrafficVariance.jsx → CampaignPvm `domain="content"` |
| `/content/dashboard` | 9-7 | tools/ContentDashboard.jsx → Dashboard `domain="content"` |
| `/start` | start-gate | StartGate.jsx (업로드 → 가능한 분석 추천) |
| `/guide` | guide-index | GuideIndex.jsx |
| `/guide/<kebab>` | 1-x~4-x·8-1 | sops/SopContent.jsx |
| `/weekly-review` | — | WeeklyReview.jsx (결정 검토 인박스) |
| `/weekly-report` · `/diagnose` · `/calculator[/slug]` | — | WeeklyReport · DiagnoseRouter · calculators/* |
| `/growth-funnel` | — | GrowthFunnelReport (noindex — sitemap 제외) |
| `/blog[/slug]` · `/blog/tag` · `/glossary[/slug]` | — | fs MD 파이프라인 (routeMap 밖) |
| `/templates` · `/templates/[slug]` | — | TemplateDownloadCard · 템플릿 상세(`lib/templateCatalog.js`) |
| `/compare` · `/compare/[slug]` | — | ComparePage.jsx · 방법 비교 SSOT(`lib/compareContent.js`) |
| `/manuals` · `/share` | — | 방법론 PDF 공개 · 결론 공유 수신(`SharedDecision`, noindex) |
| `/privacy` · `/terms` · `/contact` | — | PolicyPage |

**Content Analytics(9-x)**: 퍼포먼스 엔진의 도메인 리라벨 — 수학 불변, 라벨팩 SSOT=`utils/contentDomain.js`, CSV 격리 그룹 `content_*`. PageClient 폴백 가드 `!startsWith("9-")`(SopContent 누수 차단). SECTIONS는 `analysis`로 흡수(사이드바 자동), slug `/content/*`는 SEO·북마크 보존.

## 3. 도메인 매핑 (도구 UI ↔ 순수 엔진)
| 도구 (UI) | 엔진 (`utils/`) | 비고 |
|---|---|---|
| BudgetAllocation.jsx | `allocationMath.js` (ALLOC_MATH) | fitBest·predictSafeCpr·removeOutliers |
| MarketingEfficiency.jsx | `satMath.js`(SAT_MATH·satBuildPoints) + allocationMath | 포화지수 = 한계÷평균 |
| CampaignPvm.jsx | `pvmMath.js` (PVM_MATH) + `pvmExport.js` | Bennet 분해·rollup |
| CreativeAnalyzer.jsx | `creativeMath.js` (CREATIVE_MATH/FATIGUE/STATS) + `factorialAnovaMath.js` + `creativePredictiveModel.js` + `lib/analysis/webr/randomForest.js`·`svm.js` | WLS·피로도 + Concept Matrix 조합 상호작용(Type II ANOVA). 독립 소재 grain으로 집계한 뒤 표본·변수 조건을 충족할 때만 RF/SVM을 같은 5-fold에서 비교하고, 채널 통제 후 전역 Shapley R²를 속성별로 배분한다. RF 중요도와 Shapley R²는 예측/설명력이며 방향·인과·개별 소재 SHAP이 아님 |
| AbTestHoldout.jsx | `abTestMath.js` (STATS) | z-test·bayesian·powerCurve·`fisherExact2x2`(저전환 구간에서 판정 기준을 정확검정으로 이동)·`holmAdjust` |
| Incrementality.jsx (5-23) | `incrMath.js`(통제군) + `incrPrePostMath.js`(전후·DiD·Welch) | 3방법 탭, CSV 그룹 독립 |
| BrandCampaignIncrementality.jsx (5-24) | `brandIncrementalityMath.js` | ITS·AR(1) 추론·HAC 소표본 보정·rho 프로파일 구간 |
| MulticollinearityChecker.jsx (5-25) | `modelDiagnostics.js` (`computeVif`·`correlationMatrix`) | MMM 전 지출 패널의 VIF·Pearson/Spearman 상관 강건성 진단. 높은 VIF는 기여도 분리 거부 신호 |
| AsaKeywordFinder.jsx (5-26) | `asaKeywordMath.js` | 검색어별 Exact 승격·제외 검토, 예산 소진률·목표 CPA 기반 CPT 증감 후보 |
| AsoStoreConversion.jsx (5-27) | `asoStoreMath.js` → `pvmMath.js` | 조회=cost·설치=result로 PVM에 위임. 스토어 전환율 변화를 트래픽 구성(mix) vs 소스별 효율(rate)로 분해 + `dailyConversionSeries` 추이 차트. 유입 소스는 `store_source`(광고/오가닉 `source`와 다른 축) |
| SubscriptionSurvivalAnalysis.jsx (5-28) | `subscriptionSurvivalMath.js` | 핵심 액션 관측 에피소드별 Kaplan–Meier·Greenwood 구간·이산 해저드·RMST·log-rank·관측기간 반복 가치. 구독은 입력 프리셋 중 하나이며, 중도절단을 반영하고 분류 모델이나 장기 외삽은 하지 않음 |
| MarketingResponse.jsx + marketingResponseModel.jsx | `mmmMath.js`(기여분해+`mmmForecast`)·`regMath.js`·`regForecastMath.js`·`responseCannibRank.js`·`mmmPriorMath.js`·`mmmBusinessSeasonality.js` + `lib/analysis/webr/mmmElasticNet.js` | UI/상태와 모델·차트·export 분리. WebR glmnet은 동일 시간창의 **예측 챌린저**일 뿐 기여·인과 모델을 자동 대체하지 않음 |
| AhaMomentFinder.jsx (5-20·9-2) | `ahaMath.js` (AHA_STATS) | gridSearch·F1/Lift. `domain` prop로 공용 |
| ContentElementAnalyzer.jsx (9-1) | `regMath.js` (REG_STATS.ols) + `utils/outcomeType.js` + `lib/analysis/webr/logisticRegression.js`·`rateRegression.js`·`countRegression.js`·`mixedModel.js`·`randomForest.js` | **종속변수 척도로 모형을 고른다**: 0/1=binomial · 0~1 비율=beta(로짓) · 카운트=Poisson→과산포면 negbin · 그 외=기존 JS HC3·BH. 반복 단위 열을 고르면 lme4 random intercept(수동 실행). 100행+이면 Random Forest와 동일 교차검증으로 예측력 비교. RF 승리는 예측 레이어 후보일 뿐 회귀 추론은 유지 |
| dashboard/* (5-2) | `dashboardAggregator.js`(getMappedRows·KPI)·`ltvMath`·`funnelMath`·`segmentMath`·`anomalyMath`·`pacingMath`·`cohortMath`·`seasonalityMath`·`responseMath` | 탭별 순수 math 추출 완료(골든 커버) |
| 결론 카드 (전 도구) | `dashboardVerdict.js`·`analysis-results/*QuickSummary.js` | 판정은 **도구별 렌더 유틸**, 공용은 카드 셸뿐(§12.27) |
| (공통) | `chartUtils.js`·`format.js`·`download.js`·`toolGuide.js`·`demoData.js`(seededNoise)·`testFixtures` | 차트·표시포맷·CSV출력·업로드 설명·픽스처 SSOT |
| (공통 그룹 비교) | `groupComparisonMath.js` | Welch·대응 t·순위 검정·Welch ANOVA/Games–Howell·Kruskal–Wallis/Dunn-Holm·χ²/Fisher. 방법은 결과 척도와 사용자가 선언한 설계/추정대상으로만 선택 |
| (지표/커스텀) | `utils/metrics/`: `metricRegistry.js`(파생지표 SSOT)·`customMetric.js`(N항 조립, eval 없음)·`chartBuilder.js`·`metricView.js`(hidden/order/sizes) | UI=`ds/CustomMetricBuilder`·`CustomChartBuilder`·`InlineCardEditor`·`MetricConfigPanel`. 스펙: `../docs/custom-metrics-data-config-spec.md` |
| (모델 진단) | `modelDiagnostics.js` + `lib/analystCapabilities.js` | 기존 적합 불변, 잔차·영향점·VIF·HC3 민감도. capability 선언 화면만 `ds/ModelDiagnosticsPanel` 렌더(현재 9-1) |
| (데이터 임포트) | `lib/data-import/*` + `csvConstants.js` | V1 프로파일·정규화·**도구 스코프 매핑 후보/충돌**·xlsx·wide→long·헤더행 탐지. V2=`data-import/schema/*`(전역 canonical registry·legacy migration·파생 도구 인벤토리) → `profiler/*` → `semantic-mapper/*` → `canonical-v2/*`; 업로드 시 병행 생성하지만 V1 엔진 입력은 아직 불변 |
| (분석 라우터) | `lib/analysis-router/*` | 도구별 필수 개념·행수·기간 계약 → 가능/주의/불가 + 추천 우선순위. `analysisMethodRouter.js`는 canonical outcome profile·사용자 선언 설계·추정대상에서 방법 후보/명시 실행 WebR 메타를 고르며, `toolId`·원본 헤더로 설계를 추측하지 않는다. `foreignGrain` 계약(5-20·9-1)은 grain이 달라 항상 차단하되 필요한 컬럼을 `TOOL_GUIDE`에서 파생해 안내 |
| (WebR 고급 분석) | `lib/analysis/webr/*` | `kind:"advanced"` registry만 허용. `rateRegression`(betareg·0~1 비율)·`countRegression`(MASS·Poisson→과산포면 negbin)·`mixedModel`(lme4·random intercept, **가장 무거운 다운로드 — 자동 실행 금지**). 척도 판별은 `utils/outcomeType.js`. 단일 lazy R/Wasm runtime+직렬 작업 큐. `sandwich` 로지스틱·`randomForest` 예측 챌린저·`svm` RBF 비선형 챌린저·`glmnet` MMM 시간순 챌린저. 같은 검증창에서 5%+ 개선과 복수 fold가 있어야 예측 교체 **후보**, 기여·인과 엔진은 불변 |
| (결정 검토) | `lib/decisionReview.js`·`decisionComparableActual.js`·`decisionComparisonScope.js`·`forecastReview.js` | 결정 기록 스키마·기준일+N일 비교 후보·데이터 범위 스코프 |

## 4. 상태 & 데이터 흐름 (SSOT)
- **전역 상태 = `src/store/useDataStore.js`(Zustand)**: `currentRouteId`(URL 미러)·`IA`/`PHASES`·`dashboardFilter`·`isDarkMode`·`isCmdkOpen`·`viewConfig`·`decisionRecords`·`analyzedByGroup`. `requestAd(cb)`는 광고 제거 후 남은 no-op 래퍼(§12.26).
- **persist**: 설정만 localStorage(`viewConfig`·`customMetrics`·`customCharts`·`analystMode`, name `mkt_view_config`, `partialize=persistPartialize`). **원본 CSV·매핑·필터 Set은 절대 저장 X**(§2.2). 결정 요약은 사용자가 명시적으로 켠 경우만. 서버/테스트엔 `noopStorage` 폴백.
- **CSV 그룹 스코프**: `csvGroups` 슬라이스 = `efficiency`·`creative`·`experiment`·`response`·`aha`·`incrementality`·`brand_incrementality`·`collinearity`·`asa_keyword`·`aso_store`·`content_attr`·`content_aha`·`content_traffic`·`content_dashboard`. `csvData`=활성 그룹 **미러**(`setCurrentRouteId`가 스왑, `setCsvData`가 활성 그룹+미러 기록). **소비자는 `s.csvData`만 읽는다.**
  - `TOOL_GROUP`(`lib/toolGroups.js`)이 `라우트 id → 그룹`, **`DATA_GROUPS`(=그 값 집합)가 그룹 목록의 SSOT**. 세 맵(`csvGroups`·`analyzedByGroup`·`dashboardFilterGroups`)은 `buildGroupMap()`으로 **파생**하므로 라우트만 추가하면 자동으로 따라온다(PR #610). 손으로 나열하던 시절 누락된 키가 미러를 `undefined`로 만들어 도구가 렌더 throw로 죽었다(5-24, PR #608) — 다시 나열식으로 되돌리지 말 것. 구조 가드는 `useDataStore.test.js`.
  - CSV를 **쓰는** 라우트는 도구가 아니어도 `TOOL_GROUP`에 등록(`start-gate`→efficiency). 읽기·쓰기 그룹이 갈리면 업로드가 사라진다(PR #604).
- **데이터 파이프라인**: 업로드(`CsvUploader.jsx` — PapaParse/xlsx 워커 + **도구 스코프 자동매핑** `lib/data-import/mappingContract.js`) 또는 공개 시트(`GoogleSheetConnect.jsx`, 브라우저 직접 조회) → `csvData`+`canonicalData`(정규화 공통 레코드) → **`getMappedRows(csvData)`**(표준키 행, **cost↔spend 별칭 채움**) → 도구별 엔진 입력 → 순수엔진 → 렌더. 앱 서버 경유 없음, 원본 행·`canonicalData`는 영속화하지 않음.
- **계산 게이트**: `analyzedByGroup[group]` + `isGroupAnalyzed` 뒤에서만 무거운 compute. 매핑 변경=시그 변경=결과 자동 숨김.
- **WebR 게이트**: 기본 분석 완료 뒤 지원되는 고급 분석만 사용자가 별도 실행한다. `webr`는 동적 import하고 패키지는 runtime당 1회만 mount한다. 원본 헤더·CSV 문자열은 R 코드에 삽입하지 않고 검증된 숫자열을 안전한 내부 alias로 bind한다.

## 5. 글로벌 스타일 (CSS/테마)
- **`src/app/globals.css`** — 전 디자인 시스템, 단일 파일. **CSS Modules로 쪼개지 말 것**(토큰 스코핑 불가).
- **토큰**: `:root{--bg-1·--text-muted·--border·--primary…}`, 다크/라이트는 **`body.light-mode` 오버라이드**. `layout.js` 초기 스크립트가 첫 페인트 전 테마 반영, `refreshMountedChartThemes()`가 마운트된 canvas 갱신.
- **타입**: DM Sans(body)+Space Grotesk(display)+JetBrains Mono(data), `next/font` 변수만.
- 공용 클래스 전역: `.chart-container`·`.callout`·`.block`·`.ab-pill`·`.cmdk-*`·`.toast-*` 등. **차트 색은 `CHART_THEME` getter**(하드코딩 hex·CSS `var()` 리터럴 금지).
- **셸 통일**: 전 페이지(도구·SOP·홈·블로그·가이드)가 `Sidebar`+`Header`+`GlobalModals`. 슬림 헤더 재도입 금지. 분석 페이지 `h1`은 `ToolPageShell` 또는 `ToolIntro` 중 하나만.
- **홈 전용 도치 데이터 접수**: KR/EN 랜딩만 `assistant/DochiAssistant`를 mount한다. 도치는 CSV/XLSX 또는 전체 공개 Google Sheets URL을 브라우저에서 읽는 시작 장면이며, 실제 입력 준비 뒤에만 `/start` 통합 작업대로 handoff한다. 이동 장면은 `public/assets/dochi/`의 투명 PNG 포즈 세트(첫 인사·좌우 측면 A/B·후면 A/B·차트 운반·결과 제시·매핑 안내)를 `assistant/DochiSprite`가 선택하며, 교차 발걸음으로 화면을 대각선 탐색한 뒤 추상 차트 묶음과 화면 wipe를 이용해 `/start` 도착 모션으로 이어진다. `/start` 도착 장면에서도 운반·결과 제시 포즈가 차트 묶음과 함께 이어져 화면 전환과 캐릭터 동작이 분리되지 않는다. 홈 handoff에서만 현재 매핑으로 안전하게 실행 가능한 light baseline 어댑터를 자동 시작하며 확인·설계가 필요한 분석은 실행하지 않는다. `/start`는 데이터 접수 상태 바로 아래에 전역 매핑을 접힌 단일 토글로 먼저 두고, 도치가 토글을 하이라이트해 안내한다. 대화창의 확인은 매핑을 강제 확정하거나 토글을 여는 동작이 아니라 도치만 퇴장시키며, 이후 토글 상태는 사용자가 제어한다. 매핑이 바뀌면 기존 결과를 stale 처리하고 사용자가 다시 실행할 때 새 매핑으로 가능한 baseline 분석 전체와 반환 시각화를 다시 구성한다. `prefers-reduced-motion`에서는 장거리 이동·wipe와 반복 강조를 생략한다. `/start`는 연결된 어댑터에서 안전하게 계산 가능한 요약·표·차트를 모두 가져오는 분석 지도이며 고급 모형 설정과 추가 진단은 각 상세 분석 화면으로 넘긴다. 도구 화면에는 도치가 남지 않으며, 기존 `ToolAssistRail`은 도구별 보조 문맥으로 유지한다.
- **도구 목록 SSOT**: `lib/toolIndex.js`(발행 도구 + 이름·질문·답·필요 컬럼을 routeMap·IA·`toolSearchContent`·`TOOL_REQUIRED_FIELDS`에서 파생) → `ds/ToolIndex`(홈 compact·`/start` full). 갈래는 `lib/toolConnections.js`의 `TOOL_JOURNEY` 7개(점검·추세잠식·예산·요소·유입·검증·기여도) — 사이드바 분석 섹션도 같은 배열을 그린다.
- **응답 패널 다섯 분석**: `5-18-trend`·`-paid-organic`·`-cannibal`·`-mmm`·`-forecast`가 각각 도구(모두 `MarketingResponse`를 `isolated`로 렌더). CSV·매핑은 `response` 그룹 하나를 공유하고, 목록에 없는 `5-18`(publication="subtool")이 업로드·매핑 허브다. 필드 계약은 `csvConstants`의 `RESPONSE_PANEL_TOOL_IDS`가 5-18에서 파생.
- **워크스페이스 목적지 SSOT**: `lib/workspaceNav.js`(홈·내 CSV 분석·원인 찾기·지난 결정의 이름/설명/아이콘) → `Sidebar` 두 변형 + `Header` 브레드크럼·검토함 + `Footer` + `GlobalModals` ⌘K.
- **도구 목록 SSOT**: `lib/toolIndex.js`(발행 도구 + 이름·질문·답·필요 컬럼을 routeMap·IA·`toolSearchContent`·`TOOL_REQUIRED_FIELDS`에서 파생) → `ds/ToolIndex`(홈 compact·`/start` full). 갈래는 `lib/toolConnections.js`의 `TOOL_JOURNEY` 7개(점검·추세잠식·예산·요소·유입·검증·기여도) — 사이드바 분석 섹션도 같은 배열을 그린다.
- **응답 패널 다섯 분석**: `5-18-trend`·`-paid-organic`·`-cannibal`·`-mmm`·`-forecast`가 각각 도구(모두 `MarketingResponse`를 `isolated`로 렌더). CSV·매핑은 `response` 그룹 하나를 공유하고, 목록에 없는 `5-18`(publication="subtool")이 업로드·매핑 허브다. 필드 계약은 `csvConstants`의 `RESPONSE_PANEL_TOOL_IDS`가 5-18에서 파생.
- **워크스페이스 목적지 SSOT**: `lib/workspaceNav.js`(홈·내 CSV 분석·원인 찾기·지난 결정의 이름/설명/아이콘) → `Sidebar` 두 변형 + `Header` 브레드크럼·검토함 + `Footer` + `GlobalModals` ⌘K.
- **하단 마감**: 분석 아래는 `ToolPageOutro` 한 덩어리(`.tool-outro` 박스 + `.tool-outro__section` 구분선). 자식(`ToolConnections`·`ToolLongform`·`ToolEvidenceLinks`)은 자기 테두리·경계선을 그리지 않는다. 타이포 하한 9.5px는 `app/typographyFloor.test.js`가 강제(§12.30).
- 최종 결과는 `ds/ResultActionCard`(결론·근거·다음 행동) 공용 계약. 세그먼트 컨트롤은 `ds/PillGroup`(radiogroup+Arrow/Home/End) — `.ab-pillgroup` 생마크업 신규 추가 금지. 접근성: 실제 `h1/h2`·`tablist/tab/tabpanel`·Cmd-K combobox·CSV live semantics·`:focus-visible`. 라우트별 error boundary + `global-error.js`.

## 5.1 콘텐츠 SEO·전환 경로
- **공개 범위 SSOT**: `routeMap.isRoutePublished()` + `getAllPosts/getAllTerms`. preview·내부 route와 `draft:true`는 `noindex`, sitemap/RSS/허브에서 제외.
- **메타 SSOT**: `lib/routeSeo.js`가 route별 title/description/keywords/canonical/hreflang(`ko`·`en`·`x-default`) 생성. EN SOP도 `lib/sopData.js`로 서버 HTML에 실제 본문 포함. SOP 출처·검수일=`lib/sopEditorial.js`(화면+`TechArticle` citation), 공개 도구/가이드 sitemap 갱신일=`lib/publicationDates.js`, KR/EN RSS 본문=`lib/rssFeed.js`.
- **도구 검색 진입면**: `lib/toolSearchContent.js`(공개 도구 KO/EN 롱폼·FAQ SSOT → `ToolLongform` + FAQPage JSON-LD), 역링크는 `lib/toolContentLinks.js`(forward 레지스트리에서 파생) → `ToolEvidenceLinks`. 각 도구의 `question`/`answer`는 접기 **바깥**에 렌더하고 `getToolFaq()`가 FAQ JSON-LD 첫 항목으로 올린다.
- **가이드(SOP) 검색 진입면**: `lib/guideSearchContent.js`(15개 KO/EN `question`·`answer`·FAQ + `tool`·`posts`·`terms`) → `components/GuideAnswer.jsx`(본문 위·접기 바깥) + `page.js`의 FAQPage·BreadcrumbList + `buildGuideEvidenceLinks` → `ToolEvidenceLinks`의 `tool` 그룹. 가이드는 본문이 이미 롱폼이라 `sections`를 두지 않는다. 블로그 역방향은 같은 파일의 `guidesForPost()`(posts에서 파생) → `components/seo/RelatedGuideList.jsx`. **도구 전용 게이트(`isTool`)에 가이드를 빠뜨리면 15개가 통째로 배선 밖으로 나간다(AGENTS.md §7).**
- **브랜드 사실 SSOT**: `lib/brandFacts.js`(가격·데이터 처리·결정론 등 `BRAND_FACTS` + 한계 `BRAND_LIMITS`). `llms.txt`가 여기서 파생한다. 도구 이름·설명은 여기 적지 않고 `routeSeo`에서 조회한다.
- **방법 비교**: `lib/compareContent.js`(KO/EN `question`·`answer`·비교표·`guidance`·FAQ) → `components/ComparePage.jsx` + `/compare[/slug]` KO/EN. sitemap·llms.txt는 `COMPARE_SLUGS`에서 파생. 인바운드는 `getComparesForTool()` 역인덱스 → `buildEvidenceLinks` → `ToolEvidenceLinks`(도구 9개) + 푸터 + ⌘K 개별 항목 + 사이드바 LIBRARY.
- **전환 SSOT**: `lib/contentToolRegistry.js`(발행 글/용어 → 정확한 도구). ASA 키워드 글은 5-26, 다중공선성 용어는 5-25, ASO 글·용어는 5-27로 연결한다. `contentRegistry.test.js`가 누락·죽은 route·잘못된 EN 연결을 막는다. 글 발행·필라 통합 절차는 AGENTS.md §12.24.
- **흐름**: 검색 랜딩 → 용어/증거 → `seo/ContentActionPanel` → `/start?tool=<id>` 또는 직접 도구 → CSV 분석 → 결론 카드 → 다음 분석. Footer/Cmd-K/`/templates`가 공통 탈출구.

## 6. 테스트 & 린트 (배포 게이트)
- vitest **2 프로젝트**: `npm test`=golden(node — 통계·데이터·SEO registry), `npm run test:smoke`=jsdom 마운트, `npm run test:all`=둘 다. **골든 tolerance 완화 금지.** 스모크 목킹은 `vitest.smoke.setup.js`(chart.js·next-navigation·ResizeObserver·matchMedia·canvas).
- 통계 진실성 회귀 게이트: A/B 저전환·백만 표본 beta posterior, Holm 정확값·판정 반전, 회귀 역행렬 항등식, HC3 SE, BH export 의미.
- 구조 가드: `TOOL_GROUP`↔`csvGroups` 정합, 콘텐츠 레지스트리 3종 정합.
- **스모크 셋업이 버그를 가리지 않게** — `beforeEach`가 store 슬라이스를 직접 주입하면 실제 진입 경로를 우회한다. 진입 경로(`setCurrentRouteId`) 자체를 밟는 케이스를 따로 둘 것(5-24 사고).
- `npm run lint`=eslint(0 errors) · `npm run build`(컴파일 게이트).

## 7. 내비게이션 팁
- **수학/통계 → `src/utils/*Math.js`** (수학 변경 시 대응 `*.test.js` 골든 확인 — 원칙적으로 변경 금지).
- **도구 UI → `src/components/tools/<도구>.jsx`** (§2 표에서 route→파일).
- **대시보드(5-2) 탭 → `src/components/dashboard/<Tab>.jsx`** (viz·scorecard·pacing·anomaly·ltv·cohort·funnel·segment·seasonality).
- **전역 상태·IA → `src/store/useDataStore.js`** / **라우트 → `src/lib/routeMap.js`**.
- **색/테마/레이아웃 → `src/app/globals.css`**.
- **차트 전역 룩·인터랙션 → `src/utils/chartGlobals.js`** (defaults·기준선 플러그인·외부 HTML 툴팁). 도구는 `import Chart from "@/utils/chartGlobals"`로만 받는다 — `chart.js/auto` 직접 import 금지(셋업 누락). 차트별 옵션은 `chartUtils.js:chartCommonOpts()`.
- **랜딩 진입 모션 → `src/utils/motion.js`(anime.js 지연로더·모션축소 가드) + `src/utils/landingMotion.js`(오케스트레이션)**. 초기 숨김은 JS가 붙이는 `.is-motion-armed`로만.
- **CSV 매핑/필드 스키마 → `src/utils/csvConstants.js` + `src/lib/data-import/*` + `src/components/CsvUploader.jsx`**.
- **CSV 그룹/슬라이스 → `src/lib/toolGroups.js` + store `csvGroups`**.
- **퍼널 이벤트 → `src/lib/analytics.js`**: 허용된 구조 메타데이터만 GA4로. 파일명·원본 행·실제 지표값 금지.
- **데이터가 엔진에 안 들어감 → `getMappedRows`(dashboardAggregator.js) + 표준키/별칭 확인**.
