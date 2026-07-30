# 사이트 전체 점검 — 2026-07-30

> 대상: `growthoptplaybook.com` (v2, `v2-migration/`). 공개라우트 37 · 도구 11 · 대시보드 8탭 · SOP 17 · 블로그 32 · 용어 25.
> 파트별 완료 시마다 이 문서에 누적. 심각도 = 🔴P1(사용자 영향 즉시) / 🟡P2(품질·리스크) / 🔵P3(개선) / ℹ️(기록)

## 진행 현황

| 파트 | 범위 | 상태 |
|---|---|---|
| 1차 | A 정합성 · E SEO · F 보안 · G 정직성 (자동 검증) | ✅ 완료 |
| 2차 | B 기능 · C UI/UX · D 접근성 (코드 경로 검토) | ✅ 완료 |
| 3차 | H 성능 · J 계측 · 모바일 (브라우저 확인) | ⏳ 대기 |

---

# 1차 — 자동 검증 (완료)

## 통과 항목

| 항목 | 결과 |
|---|---|
| A6 테스트 | `test:all` **143 파일 / 957 통과 · 1 skip** ✓ |
| A2 KR/EN 짝 | 블로그 32/32 · 용어 25/25 **완전 일치** ✓ (차이로 보이던 1건은 `_TEMPLATE.md`, 의도된 미발행) |
| A3 EN 게이트 | `EN_READY_TOOL_IDS` 10개 + subtool 게이트, `routeMap.enCompleteness.test.js` 통과 ✓ |
| A4 레지스트리 3종 | `contentRegistry.test.js` 통과 ✓ |
| G6 결정론 | `Math.random` 실사용 **0건** (12건 전부 "쓰지 말라"는 주석) ✓ |
| F2 persist 범위 | `viewConfig`·`customMetrics`·`customCharts`만. 원본 CSV·필터 미저장 ✓ |
| F4 보안헤더 | X-Frame-Options·CSP frame-ancestors·nosniff·Referrer-Policy 모두 존재 ✓ |
| E4 sitemap 게이트 | `isRoutePublished()`로 preview·draft 제외 ✓ |
| D1 h1 유일성 | `ToolPageShell`(5-2·5-3·5-21·5-22)과 `ToolIntro`(5-4·5-18·5-20·5-23·9-1·9-6) 집합 **교집합 0** → 이중 h1 없음 ✓ |

## 발견 사항

### 🔴 P1-1. 블로그 meta description이 전 글(32/32) SERP에서 잘림 — CTA가 영영 안 보임

`src/lib/blogSeo.js:95`

```js
description: `${source.description || title}${suffix}`,
// suffix = " 먼저 기준 기간과 전환 정의를 고정한 뒤, 연결된 분석 도구에서 결과를 검증하세요." (45자)
```

원고 frontmatter description이 이미 **121~300자**인데 그 **뒤에** 45자 CTA를 덧붙임 → 최종 166~345자.
Google 한국어 SERP 노출 한도는 약 80자(≈160바이트). **32편 전부 초과**, 그리고 잘리는 위치가 항상 문장 끝이므로 **CTA suffix는 단 한 글자도 노출되지 않음**.

- 의도(검색자에게 다음 행동 제시)가 구조적으로 달성 불가
- 하네스 §12.24 규칙(`description≤80`)도 32/32 위반
- 최단 글조차 121자(`cpi-cpa-cpm-difference`)라 예외 없음

**수정 방향(택1)**: ① suffix를 앞으로 이동 ② description을 80자 이내로 재작성하고 suffix 제거 ③ suffix는 본문 `answer`에만 쓰고 meta description에서 분리(현재 `answer`와 `description`이 같은 문자열).
③이 최소 변경 — `answer`는 페이지 본문용이라 길이 제약이 없음.

### 🟡 P2-1. `adjust-vs-appsflyer` — SEO 제목 누락으로 원고 제목이 그대로 노출

`src/lib/blogSeo.js` `KO_TITLES` 키 **31개** vs 발행글 **32편**. 누락 1건.
`src/lib/blog.js:90`의 `title: seo?.title || data.title` 폴백이 걸려 42자 frontmatter 제목이 `<title>`로 나감(다른 31편은 짧은 SEO 제목 사용). EN 쪽도 동일 확인 필요.

### 🟡 P2-2. 차트 색 하드코딩 — 라이트 모드에서 점이 사라질 수 있음

하네스 §5/§7: 차트 색은 `CHART_THEME`/`getCssVar` 사용, 하드코딩 hex 금지.
현재 **11개 파일**에서 위반. 가장 위험한 건:

`src/components/tools/CreativeAnalyzer.jsx:734-735`
```js
backgroundColor: "#ffffff",   // scatter 점 채움
borderColor: "#000",          // 테두리
```
라이트 모드 배경(warm paper)에서 흰 점 = 검은 테두리만 남음. 다크에선 반대로 검은 테두리가 묻힘.
나머지(`#7aa2f7`·`#22c55e`·`#e0af68` 등)는 데이터 시리즈 브랜드 색이라 시급도는 낮으나, 회색 계열(`#475569`·`#94a3b8`, `MarketingResponse.jsx:1179·7955`)은 모드에 따라 대비가 무너질 수 있어 확인 필요.

### 🟡 P2-3. Google Sheets 연동이 문서에 없음 + 공개 API 키

`src/components/GoogleSheetConnect.jsx` (226줄) — 시트 URL로 데이터를 직접 불러오는 기능. `ARCHITECTURE.md`·`CLAUDE.md` 어디에도 없음(문서 표류, §15 코드맵 동기화 누락).

- **데이터 흐름 자체는 §2.2 위반 아님**: 구글 → 브라우저 방향 읽기만, 우리 서버로 가는 전송 없음. 랜딩 카피 "원본 데이터는 브라우저 안에 / RAW DATA STAYS LOCAL"도 여전히 사실.
- **다만** `NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY`는 클라이언트 번들에 그대로 노출됨(NEXT_PUBLIC_ 접두사의 성질). 이건 구조상 불가피하지만, **Google Cloud 콘솔에서 HTTP 리퍼러 제한(`growthoptplaybook.com/*`)과 Sheets API 전용 스코프 제한이 걸려 있는지 확인 필요** — 안 걸려 있으면 제3자가 우리 쿼터를 소모할 수 있음. (제가 콘솔을 볼 수 없어 확인 불가 — Gondry님 확인 항목)

### ℹ️ 기록 1. preview 라우트 3개는 h1 없음

`9-2`(killer-content)·`9-3`(traffic-variance)·`9-7`(content/dashboard)는 `publication:"preview"`라 sitemap·색인에서 제외됨. 이 중 `9-2`는 `ToolPageShell`도 `ToolIntro`도 없어 h1이 0개. 미발행이라 영향은 없으나 **발행 전환 시 반드시 h1 추가** 필요.

### ℹ️ 기록 2. 하네스 문서 자체 오류 2건 (이번에 수정)

- §4.2 도구 목록에서 **5-21 PVM 누락** → 복원
- §16이 "Phase 8 컷오버 진행 중"으로 정지 → 완료 상태로 갱신
- (커밋 `ab1a9af`, CLAUDE.md 439→153줄 압축과 함께)

---

# 2차 — 기능·UI/UX·접근성 (완료)

## 통과 항목

| 항목 | 결과 |
|---|---|
| 린트 | `npm run lint` **0 errors** ✓ |
| 빌드 | `npx next build` **성공** ✓ (SSG 포함 전 라우트 프리렌더) |
| B5 필터 trim 정합 | 옵션 생성(`DashboardFilterBar.jsx:120` `uniq`)과 필터 비교(`dashboardAggregator.js:118-127`) **양쪽 다 `.trim()`** — 알려진 "선택해도 0행" 함정 해소됨 ✓ |
| B7 CSV 다운로드 | 공용 `utils/download.js` BOM+CRLF ✓. `AbTestHoldout.jsx:21` 로컬 재정의도 BOM·CRLF 정상(중복일 뿐 버그 아님) |
| B8 광고 게이트 | 분석 실행 경로 전부 `requestAd` 경유 ✓ (`AhaMomentFinder.jsx:507`처럼 버튼이 아니라 핸들러 내부에서 감싸는 형태라 grep만으론 안 보임 — 개별 확인함) |
| C1 결론 카드 | **11개 도구 전부 `ResultActionCard` 채택** ✓ (콘텐츠 4종은 얇은 래퍼라 상속) |
| D 대시보드 ARIA | `role=tablist/tab` + `aria-selected` + `aria-controls` → `Dashboard.jsx:452`의 `role="tabpanel"` **참조 정상 연결** ✓ |
| D2 모달 ESC | CustomChart·CustomMetric·MetricConfig·DownloadHub·⌘K 전부 Escape 핸들러 있음 ✓ |
| B9 렌더 throw | `csvData.raw.length` 직접 접근 지점들은 모두 상위 `hasData`/`hasFile` 분기 안 — 크래시 경로 없음 ✓ |

## 발견 사항

### 🟡 P2-4. 도구 3개의 탭 UI에 ARIA 역할이 전혀 없음 (대시보드만 제대로 됨)

`ARCHITECTURE.md` §5 접근성 계약에 `tablist/tab/tabpanel`이 명시돼 있으나, 실제 이행은 대시보드뿐입니다.

| 컴포넌트 | 탭 | tablist | tab | tabpanel |
|---|---|---|---|---|
| `Dashboard.jsx` + `DashboardTabs.jsx` | 8탭 | ✓ | ✓ | ✓ |
| `MarketingResponse.jsx` (5-18) | 3탭(진단·기여·예측) | ✗ | ✗ | ✗ |
| `Incrementality.jsx` (5-23) | 3방법(통제군·on·off) | ✗ | ✗ | ✗ |
| `AbTestHoldout.jsx` (5-4) | 2탭(설계·판독) | ✗ | ✗ | ✗ |

구현이 `className="ab-tab"` 버튼 + `stage === "..."` / `method === "..."` 조건부 렌더라, 스크린리더에는 그냥 버튼 여러 개로 읽히고 좌우 화살표 이동도 안 됩니다. 시각 사용자에겐 무영향 → P2.

**수정 방향**: `DashboardTabs.jsx`가 이미 올바른 레퍼런스 구현이므로 그 패턴(`role`·`aria-selected`·`aria-controls`↔`id` 쌍)을 3곳에 이식. 렌더층만 변경 → 골든 불변.

### 🟡 P2-5. `MarketingResponse.jsx` 10,761줄 / 732KB — 빌드 최적화가 꺼짐

빌드 로그:
```
[BABEL] Note: The code generator has deoptimised the styling of
.../MarketingResponse.jsx as it exceeds the max of 500KB.
```

단일 컴포넌트 파일이 732KB로 Babel 임계(500KB)를 넘겨 **코드 생성 최적화가 비활성화**됩니다. 2위 파일(`SopContent.jsx` 3,183줄)의 3.4배.

| 파일 | 줄 수 |
|---|---|
| `tools/MarketingResponse.jsx` | **10,761** |
| `sops/SopContent.jsx` | 3,183 |
| `tools/BudgetAllocation.jsx` | 2,715 |
| `tools/CreativeAnalyzer.jsx` | 1,757 |

영향: ① 빌드 시간·번들 크기 ② `/tools/marketing-response` 진입 시 클라이언트가 받아야 할 JS ③ 유지보수(§7 "상태 분기 추가 전 호출부 확인"이 사실상 불가능한 크기).

**수정 방향**: 3탭이 이미 `stage`로 갈리므로 탭 단위 분리(`MarketingResponseDiagnose/Mmm/Lab`)가 자연스러운 경계. `dyn()` 동적 import까지 붙이면 탭별 코드 스플리팅. 단 대공사라 별도 세션 권장 — **이번 점검에서는 기록만**.

### 🔵 P3-1. `AbTestHoldout.jsx:21` 로컬 `downloadCsv` 중복 정의

동작은 정상(BOM+CRLF). 하네스 §12.27이 "채택 시 공용 `download.js`로 교체"라고 지정한 잔여 항목. 1곳뿐이라 정리 비용 낮음.

### ℹ️ 기록 3. 하네스 문서가 실제 구현보다 뒤처져 있던 항목

점검 중 발견한 문서↔코드 표류(수정 대상 아님, 문서만 갱신하면 됨):

| 문서 기술 | 실제 |
|---|---|
| §12.27 "결론카드 채택: 5-2·5-23만, 다음 5-22→5-20→..." | **11개 도구 전부 채택 완료** |
| `ARCHITECTURE.md` 라우트표 | `/privacy`·`/terms`·`/templates`·`/weekly-review` 및 EN 짝 라우트 누락 |
| `ARCHITECTURE.md`·`CLAUDE.md` | `GoogleSheetConnect.jsx`(시트 연동) 자체가 미기재 (P2-3) |

---

*3차(성능·계측·모바일)는 실제 브라우저 확인이 필요한 항목이라 별도 진행.*
