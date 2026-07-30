# 사이트 전체 점검 보고서 — 2026-07-30

> **대상**: `growthoptplaybook.com` (v2, `v2-migration/`)
> **규모**: 공개 라우트 37(sitemap URL 192) · 도구 11 · 대시보드 8탭 · SOP 17 · 블로그 32(EN 32) · 용어 25(EN 25)
> **방법**: 정적 분석 + 테스트 게이트 + 실제 브라우저(Chromium) 실측 3단계
> **심각도**: 🔴P1 사용자 영향 즉시 · 🟡P2 품질·리스크 · 🔵P3 개선 · ℹ️ 기록

---

# 1. 요약

## 1.1 검증 게이트 — 전부 통과

| 게이트 | 결과 |
|---|---|
| `npm run test:all` | **143 파일 / 957 통과 · 1 skip** ✓ |
| `npm run lint` | **0 errors** ✓ |
| `npx next build` | **성공** (전 라우트 프리렌더) ✓ |
| 브라우저 22 라우트 | **22/22 HTTP 200** · h1 각 1개 · 제품 유발 콘솔 에러 **0건** ✓ |

## 1.2 발견 사항 집계

| 심각도 | 건수 | 항목 |
|---|---|---|
| 🔴 P1 | **2** | 블로그 meta description SERP 잘림(32/32편) · 대시보드 차트 리사이즈 미동작 |
| 🟡 P2 | **6** | KO_TITLES 1건 누락 · 차트 하드코딩 hex · 시트연동 미문서화+API키 · 탭 ARIA 3곳 · MarketingResponse 732KB · 데모모달 ESC |
| 🔵 P3 | **1** | `AbTestHoldout` 로컬 `downloadCsv` 중복 |
| ℹ️ 기록 | **4** | 하네스 문서 표류 · preview 라우트 h1 · 오탐 방지 기록 · 하네스 자체 오류(수정 완료) |

## 1.3 조치 우선순위 (권장)

| 순서 | 항목 | 예상 규모 | 근거 |
|---|---|---|---|
| 1 | P2-6 데모모달 ESC | **4줄** | 비용 대비 효과 최대, 렌더층 전용 |
| 2 | P2-1 KO_TITLES 1건 | **1줄** | 즉시 |
| 3 | P1-1 description 파이프라인 | 수십 줄 | SEO 전면 영향, 32편 일괄 |
| 4 | P2-4 탭 ARIA 3곳 | 도구당 ~10줄 | `DashboardTabs.jsx`가 레퍼런스 구현 |
| 5 | P2-2 차트 hex | 파일 11개 | 라이트 모드 가시성 |
| 6 | P1-2 차트 리사이즈 | **미정** | 원인 미확정 — 디버깅 세션 필요 |
| 7 | P2-5 MarketingResponse 분리 | 대공사 | 별도 세션 권장 |
| — | P2-3 API 키 리퍼러 제한 | — | **코드 아님, Gondry님 콘솔 확인 사항** |

---

# 2. 발견 사항 상세

## 🔴 P1-1. 블로그 meta description이 전 글(32/32) SERP에서 잘림 — CTA가 영영 안 보임

**위치**: `v2-migration/src/lib/blogSeo.js:95`

```js
description: `${source.description || title}${suffix}`,
// suffix = " 먼저 기준 기간과 전환 정의를 고정한 뒤, 연결된 분석 도구에서 결과를 검증하세요." (45자)
```

**증상**: 원고 frontmatter description이 이미 **121~300자**인데 그 **뒤에** 45자 CTA를 덧붙여 최종 166~345자가 됩니다. Google 한국어 SERP 노출 한도는 약 80자(≈160바이트).

**영향**: 32편 **전부** 초과이며, 잘리는 위치가 항상 문장 끝이므로 **CTA suffix는 단 한 글자도 노출되지 않습니다**. 즉 "검색자에게 다음 행동을 제시한다"는 의도가 구조적으로 달성 불가능합니다. 하네스 §12.24의 `description≤80` 규칙도 32/32 위반입니다.

**측정**: 최단 글조차 121자(`cpi-cpa-cpm-difference`)라 예외가 없습니다.

**수정 방향 (택1)**
| 안 | 내용 | 비용 |
|---|---|---|
| ① | suffix를 **앞으로** 이동 | 1줄, 다만 설명이 뒤로 밀림 |
| ② | description 32편을 80자 이내로 재작성 + suffix 제거 | 원고 32편 손봐야 함 |
| ③ **권장** | suffix는 본문용 `answer`에만 남기고 meta `description`에서 분리 | 최소 변경 — `answer`는 페이지 본문이라 길이 제약 없음 |

현재 `description`과 `answer`가 **같은 문자열**(`:95-96`)이라 ③이 자연스러운 분리점입니다.

---

## 🔴 P1-2. 창 크기를 바꾸면 대시보드 차트가 따라오지 않음 (양방향 재현)

**위치**: `/dashboard` (캔버스 6개 중 5개)

**증상**: 뷰포트 변경 시 컨테이너(`.chart-canvas-wrap`)는 정상 리플로우되는데 **캔버스만 마운트 당시 크기를 유지**합니다.

| 시나리오 | 컨테이너 폭 | 캔버스 폭 | 결과 |
|---|---|---|---|
| 1440 로드 → 390 축소 | 846 → **324** ✓ | 846 → **846** ✗ | 페이지 가로 스크롤 **879px** (뷰포트 390의 2.25배) |
| 390 로드 → 1440 확대 | 324 → **846** ✓ | 324 → **324** ✗ | 차트가 빈 컨테이너 안에 작게 남음 |

**재현**: `/dashboard` 로드 → 브라우저 창 너비 변경 → **5초 대기해도 복구 안 됨**. `window.dispatchEvent(new Event("resize"))` 강제 발행도 무효.

**환경 아티팩트가 아님을 확인**:
- 같은 페이지에 ResizeObserver 대조군을 심어 **정상 발화 2회** 확인 → 브라우저 기능 살아 있음
- 캔버스 6개 중 **1개는 정상 리사이즈**됨 → 차트 인스턴스별 문제

**실사용 영향**: 모바일 최초 로드는 정상이므로 **모바일 사용자 무영향**. 영향받는 건 데스크톱 창 크기 변경 · 태블릿 회전 · 개발자도구 열기.

**원인 미확정** — 아래 두 가설을 세워 검증했으나 **둘 다 배제**되었습니다:
- ~~`chartCommonOpts()` 미사용으로 `responsive` 누락~~ → `buildCustomChartConfig`(`customChartConfig.js:132·135`)가 양 분기 모두 `responsive:true` 정상 설정
- ~~`.chart-canvas-wrap` 고정 폭~~ → 폭 지정 없음(`globals.css:2050` height만), 실측에서도 컨테이너는 정상 축소

정확한 원인은 차트 인스턴스 생성·파괴 타이밍 추적이 필요합니다. **정상 리사이즈되는 1개 캔버스와의 차이가 실마리**입니다.

---

## 🟡 P2-1. `adjust-vs-appsflyer` — SEO 제목 누락으로 원고 제목이 그대로 노출

**위치**: `v2-migration/src/lib/blogSeo.js` `KO_TITLES`

키 **31개** vs 발행글 **32편**. `blog.js:90`의 `title: seo?.title || data.title` 폴백이 걸려 42자 frontmatter 제목이 `<title>`로 나갑니다(다른 31편은 짧은 SEO 제목 사용). **EN 쪽 `EN_TITLES`도 동일 확인 필요**.

## 🟡 P2-2. 차트 색 하드코딩 — 라이트 모드에서 점이 사라질 수 있음

하네스 §5/§7: 차트 색은 `CHART_THEME`/`getCssVar` 사용, 하드코딩 hex 금지. 현재 **11개 파일**에서 위반.

**가장 위험** — `v2-migration/src/components/tools/CreativeAnalyzer.jsx:734-735`
```js
backgroundColor: "#ffffff",   // scatter 점 채움
borderColor: "#000",          // 테두리
```
라이트 모드 배경(warm paper)에서 흰 점 = 검은 테두리만 남고, 다크에선 반대로 검은 테두리가 묻힙니다.

**시급도 낮음**: `#7aa2f7`·`#22c55e`·`#e0af68` 등은 데이터 시리즈 브랜드 색.
**확인 필요**: 회색 계열 `#475569`·`#94a3b8`(`MarketingResponse.jsx:1179·7955`)은 모드에 따라 대비가 무너질 수 있음.

## 🟡 P2-3. Google Sheets 연동이 문서에 없음 + 공개 API 키

**위치**: `v2-migration/src/components/GoogleSheetConnect.jsx` (226줄)

시트 URL로 데이터를 직접 불러오는 기능인데 `ARCHITECTURE.md`·`CLAUDE.md` 어디에도 없습니다(§15 코드맵 동기화 누락).

- **데이터 흐름은 §2.2 위반 아님**: 구글 → 브라우저 방향 읽기만, 우리 서버로 가는 전송 없음. 랜딩 카피 "원본 데이터는 브라우저 안에 / RAW DATA STAYS LOCAL"도 **여전히 사실**.
- **다만** `NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY`는 클라이언트 번들에 그대로 노출됩니다(`NEXT_PUBLIC_` 접두사의 성질상 불가피).

> **⚠️ Gondry님 확인 사항**: Google Cloud 콘솔에서 **HTTP 리퍼러 제한(`growthoptplaybook.com/*`)**과 **Sheets API 전용 스코프 제한**이 걸려 있는지 확인이 필요합니다. 안 걸려 있으면 제3자가 쿼터를 소모할 수 있습니다. 제가 콘솔에 접근할 수 없어 **확인 불가**입니다.

## 🟡 P2-4. 도구 3개의 탭 UI에 ARIA 역할이 전혀 없음 (대시보드만 제대로 됨)

`ARCHITECTURE.md` §5 접근성 계약에 `tablist/tab/tabpanel`이 명시돼 있으나 실제 이행은 대시보드뿐입니다.

| 컴포넌트 | 탭 | tablist | tab | tabpanel |
|---|---|---|---|---|
| `Dashboard.jsx` + `dashboard/DashboardTabs.jsx` | 8탭 | ✓ | ✓ | ✓ |
| `tools/MarketingResponse.jsx` (5-18) | 3탭(진단·기여·예측) | ✗ | ✗ | ✗ |
| `tools/Incrementality.jsx` (5-23) | 3방법(통제군·on·off) | ✗ | ✗ | ✗ |
| `tools/AbTestHoldout.jsx` (5-4) | 2탭(설계·판독) | ✗ | ✗ | ✗ |

구현이 `className="ab-tab"` 버튼 + `stage === "..."` / `method === "..."` 조건부 렌더라, 스크린리더에는 그냥 버튼 여러 개로 읽히고 좌우 화살표 이동도 안 됩니다. 시각 사용자에겐 무영향 → P2.

**수정**: `DashboardTabs.jsx`가 이미 올바른 레퍼런스 구현(`role`·`aria-selected`·`aria-controls`↔`Dashboard.jsx:452`의 `id`/`role="tabpanel"` 쌍)이므로 그 패턴을 3곳에 이식. **렌더층만 변경 → 골든 불변**.

## 🟡 P2-5. `MarketingResponse.jsx` 10,761줄 / 732KB — 빌드 최적화가 꺼짐

빌드 로그:
```
[BABEL] Note: The code generator has deoptimised the styling of
.../MarketingResponse.jsx as it exceeds the max of 500KB.
```

| 파일 | 줄 수 |
|---|---|
| `tools/MarketingResponse.jsx` | **10,761** |
| `sops/SopContent.jsx` | 3,183 |
| `tools/BudgetAllocation.jsx` | 2,715 |
| `tools/CreativeAnalyzer.jsx` | 1,757 |

**영향**: ① 빌드 시간·번들 크기 ② `/tools/marketing-response` 진입 시 클라이언트 JS ③ 유지보수(§7 "상태 분기 추가 전 호출부 확인"이 사실상 불가능한 크기).

**수정 방향**: 3탭이 이미 `stage`로 갈리므로 탭 단위 분리(`MarketingResponseDiagnose/Mmm/Lab`)가 자연스러운 경계. `dyn()` 동적 import까지 붙이면 탭별 코드 스플리팅. **대공사라 별도 세션 권장 — 이번 점검에서는 기록만**.

## 🟡 P2-6. 데모 안내 모달만 ESC로 안 닫힘

**위치**: `v2-migration/src/components/DemoNoticeModal.jsx` — `/dashboard` 첫 진입 시 뜨는 전면 모달(z-index 1000, 뷰포트 전체 덮음)

| 닫기 경로 | 동작 |
|---|---|
| 배경 클릭 | ✓ (`:39 onClick={close}`) |
| "확인" 버튼 | ✓ (`:57`) |
| **Escape 키** | **✗ 핸들러 없음** |

다른 모달 5종(`ds/CustomChartBuilder:49` · `ds/CustomMetricBuilder:73` · `ds/MetricConfigPanel:48` · `ds/DownloadHub:47` · ⌘K `GlobalModals:48`)은 전부 Escape를 지원해 **이 모달만 예외**입니다. 모달이 열려 있는 동안 탭 전환 등 모든 조작이 막히므로 **탈출 경로가 마우스에 한정**됩니다.

**수정**: 다른 모달과 동일한 `useEffect` + `keydown` 핸들러 **4줄**. 렌더층 전용.

## 🔵 P3-1. `AbTestHoldout.jsx:21` 로컬 `downloadCsv` 중복 정의

동작은 정상(BOM + CRLF 확인). 하네스 §12.27이 "채택 시 공용 `utils/download.js`로 교체"라고 지정한 잔여 항목. 1곳뿐이라 정리 비용 낮음.

---

# 3. 통과 항목 (근거 포함)

## 3.1 정합성·무결성

| 항목 | 결과 |
|---|---|
| 테스트 | 143 파일 / 957 통과 · 1 skip |
| KR/EN 짝 | 블로그 32/32 · 용어 25/25 **완전 일치**. 차이로 보이던 1건은 `_TEMPLATE.md`(의도된 미발행) |
| EN 게이트 | `EN_READY_TOOL_IDS` 10개 + subtool 게이트, `routeMap.enCompleteness.test.js` 통과 |
| 레지스트리 3종 | `contentRegistry.test.js` 통과 (`contentToolRegistry`·`blogSeo`·`localizedHref`) |
| 라우트 응답 | 브라우저 실측 22/22 HTTP 200, 네비 실패 0 |

## 3.2 데이터 보안·프라이버시

| 항목 | 결과 |
|---|---|
| persist 범위 | `viewConfig`·`customMetrics`·`customCharts`만(`useDataStore.js:283`). **원본 CSV·필터 미저장** |
| 보안 헤더 | X-Frame-Options · CSP frame-ancestors · nosniff · Referrer-Policy 전부 존재(`next.config.mjs:54-62`) |
| 외부 전송 | 유저 CSV를 서버로 보내는 경로 없음. `fetch` 사용처는 Sheets 읽기(P2-3)와 로컬 콘텐츠 로드뿐 |
| 프라이버시 카피 | "원본 데이터는 브라우저 안에 / RAW DATA STAYS LOCAL" — 실제 동작과 **일치** |

## 3.3 통계 정직성

| 항목 | 결과 |
|---|---|
| 결정론 | `Math.random` 실사용 **0건**. 검출된 12건은 전부 "쓰지 말라"는 주석 |
| 골든 테스트 | 통계 진실성 회귀 게이트 통과(A/B 저전환·백만 표본 beta·Holm 판정 반전·회귀 역행렬 항등식·HC3 SE·BH export) |

## 3.4 기능

| 항목 | 결과 |
|---|---|
| 필터 trim 정합 | 옵션 생성(`DashboardFilterBar.jsx:120` `uniq`)과 비교(`dashboardAggregator.js:118-127`) **양쪽 다 `.trim()`** — 알려진 "선택해도 0행" 함정 해소 |
| CSV 다운로드 | 공용 `utils/download.js` BOM+CRLF. `AbTestHoldout` 로컬 재정의도 BOM·CRLF 정상 |
| 광고 게이트 | 분석 실행 경로 전부 `requestAd` 경유. `AhaMomentFinder.jsx:507`처럼 버튼이 아닌 **핸들러 내부**에서 감싸는 형태라 grep만으론 안 보여 개별 확인함 |
| 결론 카드 | **11개 도구 전부 `ResultActionCard` 채택**. 콘텐츠 4종은 얇은 래퍼라 상속 |
| 렌더 throw | `csvData.raw.length` 직접 접근 지점은 모두 상위 `hasData`/`hasFile` 분기 안 — 크래시 경로 없음 |

## 3.5 UI/UX·접근성

| 항목 | 결과 |
|---|---|
| h1 유일성 | `ToolPageShell`(5-2·5-3·5-21·5-22)과 `ToolIntro`(5-4·5-18·5-20·5-23·9-1·9-6) 집합 **교집합 0**. 브라우저 실측에서도 22/22 정확히 1개 |
| 대시보드 ARIA | `role=tablist/tab` + `aria-selected` + `aria-controls` → `Dashboard.jsx:452` `role="tabpanel"` **참조 정상 연결** |
| 모달 ESC | 6종 중 5종 지원(1건은 P2-6) |
| 모바일 최초 로드 | 10개 라우트 390px에서 **가로 오버플로 0** |
| 캔버스 초기 폭 | `zeroWidthCanvas` **0** — §7 "조건부 마운트 최초 width 0" 함정 재발 없음 |
| DOM 규모 | 최대 3,854노드(`/tools/creative-analysis`), 대시보드 1,858 — 정상 범위 |

## 3.6 SEO·계측

| 항목 | 결과 |
|---|---|
| sitemap 게이트 | `isRoutePublished()`로 preview·draft 제외 |
| GA4 소프트 내비 | `config`에 `send_page_view:false` + 수동 발화 → **이중 카운트 없음**. 소프트 내비 시 `page_view` **정확히 1회**(path·location·title 포함) |
| 콘솔 에러 | 45건 전부 `ERR_TUNNEL_CONNECTION_FAILED` = 샌드박스 프록시의 외부 리소스 차단. **제품 유발 에러·예외 0건** |

---

# 4. 오탐 방지 기록

점검 중 의심했다가 **정상으로 확인**한 항목. 재조사 낭비를 막기 위해 남깁니다.

| 의심 | 실제 |
|---|---|
| KR/EN 짝 1건씩 누락 | `_TEMPLATE.md`(의도된 미발행). 실제 짝은 완전 일치 |
| `Math.random` 12건 | 전부 "쓰지 말라"는 **주석**. 실사용 0 |
| `ToolPageShell`+`ToolIntro` 이중 h1 | 두 집합 교집합 0 |
| 필터 trim 불일치 | 양쪽 다 trim 적용됨 |
| 결론카드 미채택 도구 4개 | 얇은 래퍼라 상속. 11개 전부 채택 완료 |
| `DashboardTabs`의 `aria-controls` 끊김 | 대상 `id`는 `Dashboard.jsx:452`에 정상 존재 |
| 닫힌 ⌘K 팔레트의 `aria-modal="true"` | `.cmdk-overlay[hidden]{display:none}`(`globals.css:3316`)로 **렌더·접근성 트리 모두 제외**. `[hidden]`이 `display:flex`에 밀리는 흔한 함정이 이미 방어돼 있음 |
| 1440→390 시 `.tool-connection-card` 오버플로 | **캔버스가 진범**(P1-2). 카드는 정상 리플로우(280px) |
| `/tools/marketing-response` 넘침 요소 24개 | `overflow-x:auto` 캐러셀 내부, 의도된 가로 스크롤 |
| `CustomChartsSection` responsive 누락 | `buildCustomChartConfig`가 정상 설정 |

---

# 5. 문서 표류 (코드가 앞서 있음)

수정 대상 아님. **문서만 갱신**하면 됩니다.

| 문서 기술 | 실제 |
|---|---|
| `CLAUDE.md` §12.27 "결론카드 채택: 5-2·5-23만, 다음 5-22→5-20→…" | **11개 도구 전부 채택 완료** |
| `ARCHITECTURE.md` 라우트표 | `/privacy`·`/terms`·`/templates`·`/weekly-review` 및 EN 짝 라우트 누락 |
| `ARCHITECTURE.md`·`CLAUDE.md` | `GoogleSheetConnect.jsx`(시트 연동) 자체가 미기재 → P2-3 |

## 5.1 이번에 수정한 하네스 자체 오류

커밋 `ab1a9af` (CLAUDE.md 439→153줄 초압축과 함께):
- §4.2 도구 목록에서 **5-21 PVM 누락** → 복원
- §16이 "Phase 8 컷오버 진행 중"으로 정지 → 완료 상태로 갱신
- 유저 레벨 `/home/user/CLAUDE.md`에 **동일 439줄 중복본**이 있어 매 턴 이중 로드 → 포인터 8줄로 축소(저장소 밖이라 미커밋)

## 5.2 발행 전환 시 주의

`9-2`(killer-content) · `9-3`(traffic-variance) · `9-7`(content/dashboard)는 `publication:"preview"`라 sitemap·색인에서 제외됩니다. 이 중 **`9-2`는 `ToolPageShell`도 `ToolIntro`도 없어 h1이 0개**입니다. 미발행이라 현재 영향은 없으나 **발행 전환 시 반드시 h1 추가**가 필요합니다.

---

# 6. 점검 범위 커버리지

최초 리스트업한 항목 대비 실제 수행 범위입니다. **미실시 항목을 정직하게 표시**합니다.

| 그룹 | 항목 | 상태 |
|---|---|---|
| **A 정합성** | A1 라우트 디스패치 · A2 KR/EN 짝 · A3 EN 게이트 · A4 레지스트리 · A6 빌드·테스트 | ✅ 완료 |
| | A5 죽은 링크 전수 | ⚠️ **부분** — 레지스트리 테스트가 커버하는 범위만. 본문 내부 링크 전수 크롤링은 미실시 |
| **B 기능** | B5 필터 · B7 다운로드 · B8 광고게이트 · B9 렌더 throw | ✅ 완료(코드 경로) |
| | B1~B4 빈/데모/실CSV/매핑실패 상태별 **실제 실행** | ❌ **미실시** — CSV 업로드 후 분석 실행까지의 시나리오 테스트는 안 함 |
| | B6 CSV 그룹 공유·격리 실동작 | ❌ 미실시 |
| **C UI/UX** | C1 결론카드 · C5 차트 렌더 · C8 모바일 · C9 셸 통일 | ✅ 완료 |
| | C4 다크/라이트 | ⚠️ **부분** — 하드코딩 hex는 코드로 검출. **실제 두 모드 육안 비교는 미실시** |
| | C2 평어화 · C3 시각적 계층 · C6 로딩 체감 · C7 죽은 카피 | ❌ **미실시** — 사람의 판단이 필요한 영역 |
| **D 접근성** | D1 시맨틱 · D2 키보드·모달 · D3 live region | ✅ 완료 |
| | D4 색 대비 WCAG AA 수치 측정 | ❌ 미실시 |
| **E SEO** | E1 canonical·hreflang · E2 title/desc 길이 · E4 sitemap · E6 robots | ✅ 완료 |
| | E3 JSON-LD **스키마 유효성 검사** | ⚠️ 부분 — 존재 여부만 확인, 구글 검사 도구 미실행 |
| | E5 OG 이미지 실제 렌더 | ❌ 미실시 |
| **F 보안** | F1 서버 전송 · F2 persist · F3 카피 정합 · F4 헤더 | ✅ 완료 |
| **G 정직성** | G6 결정론 | ✅ 완료 |
| | G1~G5 인과 단정·무유의 처리·CI 라벨·비중 라벨 | ⚠️ **부분** — 골든 테스트가 엔진 레벨은 커버. **화면 카피 전수 검토는 미실시** |
| **H 성능** | H3 캔버스 초기폭 · DOM 규모 | ✅ 완료 |
| | H1 실제 LCP·번들 | ❌ **미실시** — localhost 측정은 실사용 대리값이 아님. **배포본 Lighthouse 필요** |
| | H2 대용량 CSV(10~20만행) 블로킹 | ❌ 미실시 |
| **I 콘텐츠** | I1 블로그 32편 오탈자 · I2 용어 정의 정확성 · I3 SOP 17 내용 · I4 KR/EN 의미 동등성 | ❌ **전부 미실시** — 내용 품질은 도메인 판단 영역 |
| **J 계측** | J1 GA4 page_view | ✅ 완료 |
| | J2 퍼널 이벤트 전수 · J3 AdSense 실제 노출 | ❌ 미실시 — 외부 리소스가 샌드박스에서 차단됨 |

---

# 7. 방법 · 재현

## 7.1 1차 — 자동 검증
정적 분석(grep/파일 diff) + `npm run test:all` + `npm run lint` + `npx next build`.

## 7.2 2차 — 코드 경로 검토
도구 11개 · 대시보드 8탭의 상태 분기, 공용 계약(`ds/*`) 준수 여부, 하네스 §7 함정 목록 대조.

## 7.3 3차 — 실제 브라우저
`next build` 산출물을 `next start`(포트 3000)로 띄우고 Playwright + Chromium으로:
- 22개 대표 라우트 로드 → status · h1 · 콘솔에러 · DOM · 캔버스 폭
- 모바일 390×844 **최초 로드**(리플로우 아티팩트 배제) 가로 오버플로
- 뷰포트 양방향 리사이즈 + ResizeObserver 대조군
- `dataLayer`/`gtag` 스텁 주입 후 소프트 내비 `page_view` 가로채기
- 모달 닫기 경로 3종(ESC · 배경 · 버튼)

스크립트는 scratchpad에 두고 **저장소에 커밋하지 않았습니다**(일회성 감사 도구).

## 7.4 환경 한계 (명시)

| 한계 | 영향 |
|---|---|
| localhost 측정 | FCP 236~968ms는 **실사용 대리값 아님**(네트워크 0). 실제 성능은 배포본 Lighthouse 필요 |
| 샌드박스 프록시 | GTM·AdSense·구글폰트 차단 → 실제 광고 노출·폰트 CLS 확인 불가 |
| 콘솔 접근 불가 | Google Cloud API 키 제한 설정(P2-3) 확인 불가 |
| CSV 미업로드 | 실제 데이터로 분석 실행하는 시나리오(B1~B4) 미검증 |

---

*작성: 2026-07-30 · 관련 커밋 `ab1a9af`(하네스 압축) · `273daf9`(1·2차) · `478fb71`(3차)*
