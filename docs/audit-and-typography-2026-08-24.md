# 오딧 결과 + 한글 타이포그래피 실행 스펙

> 2026-08-24 · **Codex 핸드오프 스펙** (AGENTS.md §9 "설계 스펙 먼저, 구현은 핸드오프")
> 대상: Growth Opt Playbook / `v2-migration/` · 감사 범위: **앱 전역**(특정 커밋 아님)
> PART 1은 Claude가 실행한 전체 감사 결과(§6.2), PART 2~5는 미실행 스펙이다. **코드 변경 없음.**

---

# §0 미결정 4건 — 실행 전 여기부터 채울 것

| # | 항목 | 선택지 | 결정 |
|---|---|---|---|
| **D1** | 폰트 | `P` Pretendard **(추천)** / `I` IBM Plex Sans KR / `C` 응급 처치만 | ☐ |
| **D2** | mono 범위 | `ⓐ` 폴백만 추가(CSS 1줄) / `ⓑ` 한글 라벨을 sans로 이관 **(권장)** | ☐ |
| **D3** | F-1 수정 방식 | `등록` dochi-result를 TOOL_GROUP에 등록 / `전용그룹` 새 그룹 신설 | ☐ |
| **D4** | F-2 수정 우선순위 | `즉시` 필드 계약 3건 채우고 빈 스코프를 차단 **(추천)** / `보류` | ☐ |

**결정 없이 선행 가능한 것** (어떤 선택지에서도 되돌릴 필요가 없다):
- PART 3 §3.1 폰트 응급 처치 (mono 한글 폴백 + preload)
- PART 1 F-1·F-2 회귀 가드 추가 (수정 방식과 무관하게 계약을 고정)
- PART 1 F-5 차트 hex → `CHART_THEME` 교체 (5곳, 렌더층)

---

# PART 1 — 전체 감사 결과 (실행 완료)

> 범위: 특정 커밋이 아니라 **앱 전역**. L0 기준선 → 전 발행 도구 배선 전수 →
> 정직성 → 함정 패턴 스윕. 발견은 전부 **재현 또는 실측**으로 확인했고,
> 확인 못 한 것은 미확인이라고 표시했다.

## 1.1 L0 기준선 — 실측 (2026-08-24)

| 검사 | 결과 |
|---|---|
| `npm run test:all` | ✅ **312 파일 · 2468 통과 · 1 skipped** |
| `npm run lint` | ✅ **0 errors** |
| `npm run build` | ✅ 성공 (exit 0) |

> ⚠ **AGENTS.md §16의 "276파일·2268 통과"는 낡았다.** 위 실측값으로 갱신할 것.

## 1.2 발견 요약

| ID | 심각도 | 항목 | 상태 |
|---|---|---|---|
| **F-1** | 🔴 P1 | `/dochi-result` 읽기·쓰기 그룹 비대칭 → CSV 소실 | **재현 완료** |
| **F-2** | 🔴 P1 | 5-20·5-23·9-1 매핑 스코프 부재 → 못 쓰는 도구를 "적격"으로 판정 | **재현 완료** |
| **F-3** | 🟡 P2 | `invertMatrix` 절대 pivot 임계 | 미확인(구조적 위험) |
| **F-4** | 🟡 P2 | 소스 문자열 가드 18개가 주석을 안 벗김 | 실측 |
| **F-5** | 🟡 P2 | 차트 데이터셋 하드코딩 hex 5곳 → 테마 리프레시 누락 | 실측 |
| **F-6** | 🟢 P3 | CSV 조립기 3벌 병존 | 실측(현재 미파손) |

---

## 1.3 🔴 F-1 (P1) — `/dochi-result`의 읽기·쓰기 그룹 비대칭

**PR #603→#604와 정확히 같은 사고가 신규 라우트에서 재발했다.**

`dochi-result`는 `routeMap.js:70`에 등록됐는데 **`TOOL_GROUP`에 없다.**
그런데 이 라우트는 CSV를 **읽고 쓴다**:

| 동작 | 코드 | 그룹 결정 |
|---|---|---|
| **읽기** | `useDataStore.js:529-530` `TOOL_GROUP[id] \|\| state.activeDataGroup` | **sticky** — 마지막 도구 그룹 유지 |
| **쓰기** | `useDataStore.js:772` `groupForRoute(currentRouteId)` → `TOOL_GROUP[id] \|\| "efficiency"` | **efficiency 강제** |

`DochiResultWorkspace.jsx:122`가 `csvData`를 읽고, `:152`가
`<CsvUploader toolId="start-gate" …/>`를 렌더해 쓴다.
**`activeDataGroup ≠ "efficiency"`인 모든 경우 두 경로가 다른 그룹을 고른다.**

### 재현 (3/3 통과)

```
1) setCurrentRouteId("5-28")         → activeDataGroup = "subscription_survival"
2) setCurrentRouteId("dochi-result") → sticky, 그룹 유지
3) setCsvData(DATA)                  → csvGroups.efficiency 에 저장 ⚠
                                       csvGroups.subscription_survival 은 빈 채
4) 재진입
   기대: 방금 올린 CSV / 실제: csvData.fileName === ""   ← 업로드 소실
```

**동반 결함**: `DochiResultWorkspace.jsx:124`의 `setGroupAnalyzed("dochi-result")`도
`groupForRoute` 경유라 **무관한 `efficiency` 게이트를 열고**, 그 시그니처를
**다른 그룹의 데이터**로 계산한다(`useDataStore.js:859-862`).

### 왜 하네스가 못 잡았나

`dochi-result`를 보는 테스트는 스모크 2개뿐인데 **둘 다 `csvGroups.efficiency`를
직접 주입**한다(`DochiResultWorkspace.smoke.test.jsx:41,58`).
하필 **폴백 그룹으로만 검사**해서 비대칭이 상쇄된다 —
§7 *"스모크 `beforeEach`의 상태 주입이 진입 경로를 우회한다"*의 재발이다.

### 전수 확인

`TOOL_GROUP` 미등록 라우트 18개 중 CSV를 소비하는 것은 `dochi-result` **하나뿐**
(나머지는 SOP 15개 · `home` · `guide-index`). `start-gate`는 `toolGroups.js:10`에
**등록돼 있다** — #604의 교훈이 적용된 자리다.

> §16 *"다수가 맞으면 소수의 예외가 보이지 않는다"* — 계약은 전수로 검사할 것.

---

## 1.4 🔴 F-2 (P1) — 매핑 스코프가 없는 도구 3개가 "무엇이든 적격"이 된다

`mappingContract.js:4-12`의 `fieldKeysForTool`은
`TOOL_REQUIRED_FIELDS[toolId]` + `TOOL_OPTIONAL_FIELDS[toolId]`로 `allowedKeys`를 만든다.
**둘 다 없으면 빈 배열이 되고, 빈 `allowedKeys`는 "제한 없음"으로 동작한다.**

`TOOL_REQUIRED_FIELDS`에 **5-20 · 5-23 · 9-1이 없다**(복합키로도 없음).

### 재현 — 효율 CSV 1장을 19개 도구 전부에 물린 결과

헤더 `date, campaign, cost, impressions, clicks, installs, revenue`

| 도구 | 필수필드 | 매핑됨 | `requiredMissing` |
|---|---|---|---|
| 5-2 | 3 | 6/7 | `[]` |
| 5-4 | 3 | 1/7 | `["numerator","denominator","is_control/arm_id"]` |
| 5-18-mmm | 3 | 0/7 | `["week","mmm_reg/mmm_react",…]` |
| 5-28 | 2 | 1/7 | `["event_observed/churn_date/…"]` |
| 9-6 | 7 | 5/7 | `["creative_id","channel"]` |
| **5-20** | **❌ 없음** | **7/7** | **`[]`** |
| **5-23** | **❌ 없음** | **7/7** | **`[]`** |
| **9-1** | **❌ 없음** | **7/7** | **`[]`** |

**스코프가 제대로 걸린 도구는 전부 부분집합만 잡고 부족분을 정직하게 보고한다.
스코프가 없는 3개만 전 컬럼을 잡고 "부족한 필드 없음"이라고 답한다.**

### 실제 영향 — 도치(assistant)

`analysisCatalog.js:73`이 `toolId: route.id`로 **발행 도구 전체**를 순회하고,
`AssistantWorkspace.jsx:531`이 각 도구로 `buildMappingContract`를 부른다.
따라서 효율 CSV 한 장을 올리면 **5-20(Aha·이벤트 CSV 필요) · 5-23(증분·홀드아웃 필요) ·
9-1(콘텐츠 CSV 필요)이 "필요 컬럼 전부 충족"으로 판정된다.**

→ §7 *"전체 `STANDARD_FIELDS`로 매핑하면 그 도구가 안 쓰는 필드까지 잡아
'매핑됐는데 기능엔 못 씀'"* 그대로이며,
**§8 정직성 위반**이다 — 쓸 수 없는 도구를 쓸 수 있다고 화면이 말한다.
역설적으로 **배선이 빠진 도구일수록 적격도가 높아 보인다.**

### 수정 방향

`TOOL_REQUIRED_FIELDS`/`TOOL_OPTIONAL_FIELDS`에 세 도구를 채우고,
**빈 `allowedKeys`를 "제한 없음"이 아니라 "계약 없음"으로 취급**해
게이트가 통과되지 않게 한다. 가드는 발행 라우트에서 파생해
**전 도구가 필드 계약을 갖는다**를 단언할 것(하드코딩 배열 금지).

---

## 1.5 🟡 F-3 (P2, 미확인) — `invertMatrix`의 절대 pivot 임계

`subscriptionSurvivalMath.js:313`
```js
if (!(magnitude > Number.EPSILON * 100)) return null;   // ≈ 2.2e-14, 절대 임계
```

§7에 이미 기록된 함정이다 — *"Gauss-Jordan inverse는 절대 pivot 임계로
rank-deficiency를 못 잡는다. `maxErr = max|I·M−δ| > 1e-6`이면 null 반환."*
`REG_STATS.ols`는 잔차 기반인데 **이 신규 코드는 절대 임계로 되돌아갔다.**

**정직하게 남긴다: 재현하지 못했다.** 스케일 1e0·1e3·1e5의 준특이 행렬을 넣었으나
잔차가 0~1.2e-7로 부동소수점이 감당해 가비지가 나오지 않았다. 실제 log-rank
공분산에서 도달 가능한 입력을 구성하지 못했으므로 **구조적 위험이지 확인된
버그가 아니다.** 잔차 기반으로 맞추는 것은 정상 입력에서 no-op이라
골든 byte-identical로 넣을 수 있다.

---

## 1.6 🟡 F-4 (P2) — 소스 문자열 가드 18개가 주석을 안 벗긴다

`readFileSync`로 소스를 읽어 문자열 검사하는 가드 **20개 중 18개가 주석을 제거하지
않는다.** §16에 *"소스를 문자열 포함으로 검사하면 자기 설명 주석에 속는다"*로
**한 세션에 3회** 기록된 클래스인데, 고친 2개(`downloadEscape`·`tabContract`) 외에는
같은 형태로 남아 있다.

> §7 *"교훈을 적용할 땐 같은 패턴의 파일을 전부 grep해서 한 번에 고칠 것 —
> 한 곳만 고치면 교훈이 기록됐다는 사실이 남은 구멍을 가린다."*

**전부가 위험한 건 아니다.** *"없어야 한다"*를 검사하는 가드와
*"있으면 배선된 것으로 친다"*는 가드만 주석에 속는다.
공용 `stripComments` 하나로 그 부류부터 통과시키는 게 맞다 — 18개 일괄 수정은 과잉.

---

## 1.7 🟡 F-5 (P2) — 차트 데이터셋 하드코딩 hex 5곳

`CHART_THEME` getter를 안 쓰고 리터럴을 넣으면 `refreshMountedChartThemes`
대상에서 빠져 **테마를 바꿔도 그 데이터셋만 옛 색으로 굳는다**(§7).

| 파일 | 색 |
|---|---|
| `tools/AhaMomentFinder.jsx` | `#facc15` (pointBorderColor) |
| `tools/Incrementality.jsx` | `#22c55e` / `#ef4444` (borderColor) |
| `tools/marketingResponseModel.jsx` | `#7F77DD` (borderColor) |
| `tools/AbTestHoldout.jsx` | `#fbbf24`, `#22c55e` (backgroundColor) |
| `dashboard/ScorecardTab.jsx` | `#fbbf24`, `#adc6ff` (borderColor) |

→ `CHART_THEME.warning` · `.success` · `.danger` · `.colors`로 교체.

---

## 1.8 🟢 F-6 (P3) — CSV 조립기 3벌 병존

골든은 `utils/download.js:30` `csvBody` 하나인데, 같은 로직이 두 곳에 더 있다:

| 위치 | BOM | CRLF | 인용 | 판정 |
|---|---|---|---|---|
| `utils/download.js:30` `csvBody` | ✅ | ✅ | ✅ | **골든** |
| `tools/BrandCampaignIncrementality.jsx:160` | ✅ | ✅ | ✅ | 중복(정상) |
| `utils/storeEvents.js:146` `eventsToCsv` | ❌ | ✅ | ✅ | **BOM을 호출부가 붙임** |

`storeEvents`는 `StoreEventLog.jsx:166`이 `` downloadCsv(`\ufeff${eventsToCsv(...)}`) ``로
BOM을 직접 붙여 **현재는 깨지지 않는다.** 다만 조립과 BOM이 분리돼 있어
두 번째 호출자가 생기면 §7의 "한글 깨짐"이 그대로 재현된다.

---

## 1.9 ✅ 정상 확인 (회귀 없음)

| 항목 | 결과 |
|---|---|
| **결정론**(§8.3) | ✅ `Math.random` 실사용 **0곳**(전부 "쓰지 않는다"는 주석) |
| **Chart.js 전역 셋업** | ✅ `chart.js/auto` 직접 import 0(테스트 1건 제외) |
| **Chart에 CSS `var()` 전달** | ✅ 0곳 — 검출된 `var()`는 전부 DOM 인라인 스타일 |
| **UTC 요일**(§7) | ✅ `getDay()` 0곳 |
| **3맵 파생** | ✅ `buildGroupMap(DATA_GROUPS)`. #608/#610 교훈 적용됨 |
| **`TOOL_GUIDE` 커버리지** | ✅ 5-23은 `5-23:suppression/on/off` 복합키, 5-18-* 는 허브 `5-18` 공유 — **처음엔 6개 누락으로 보였으나 오탐이었다** |
| **5-18-* 승격 배선**(#696) | ✅ 5개 전부 `TOOL_REQUIRED/OPTIONAL_FIELDS`·`routeSeo`·`toolSearchContent` 보유 |
| **KR/EN 대칭**(§2.11) | ✅ 발행 도구 19개 전부 KO/EN `searchContent`·`routeSeo`·FAQ 보유(개수도 일치) |
| **5-28 정직성**(§8) | ✅ `status:"unavailable"`+`reason`, `ok:false, reason:"covariance_not_estimable"`, 지평 밖 외삽 거부, CAC 부분결측 평균 안 냄 |
| **`localStorage`**(§2.2) | ✅ 5종뿐 — theme·locale·consent·1회 플래그·**사용자가 명시적으로 켜는** 매핑 메모리. **사용자 CSV 영속 0** |
| **DS 채택**(§12.21·§12.27) | ✅ `ResultActionCard` 18 · `DownloadHub` 17 |
| **테스트 무력화** | ✅ 검사를 지우는 `?.()` 없음. 과거 사고는 `MulticollinearityChecker.smoke.test.jsx:22`에 주석으로 보존 |

## 1.10 총평

**배선 품질은 전반적으로 높다.** 과거 사고(#603·#608·#610)의 교훈이 실제 코드에
살아 동작하고, 5-28 같은 신규 엔진의 통계적 정직성은 §8 기준을 만족한다.
결정론·차트 셋업·UTC·데이터 영속 같은 절대 규칙은 **위반 0**이다.

**문제는 전부 "계약이 없는 자리"에서 나왔다.**
F-1은 `TOOL_GROUP`에 없는 라우트, F-2는 필드 계약이 없는 도구 3개다.
둘 다 *"없으면 폴백"*이 *"없으면 통과"*로 동작하면서, **빠진 쪽이 오히려
더 관대하게 판정되는** 같은 형태다. 가드를 추가할 때는 개수가 아니라
**전 라우트·전 도구가 계약을 갖는지**를 파생으로 단언해야 한다.

---

# PART 2 — 타이포그래피 진단 (코드 실측)

> 요청: *"데이터 보기가 너무 어지럽다, 특히 한글 폰트."*
> 결론: **폰트 선택이 아니라 스택 배선 문제다.**

## 2.1 캐스케이드 구조 — `:root`가 3곳, 레이어가 다르다

`globals.css:15` → `@layer reset, tokens, app;`

| 위치 | 레이어 | 승패 |
|---|---|---|
| `globals.css:19` `:root` | `tokens` (17행 시작) | ❌ **app에 짐 → 전체 사문화** |
| `globals.css:4796` `:root` | `app` (188행 시작) | △ mono만 실효 |
| `globals.css:8347` `:root` | `app` | ✅ sans·body·display 실효 (소스 순서 뒤) |

**실효값:**
```css
/* globals.css:8364-8366 */
--font-sans:    var(--font-dm-sans), var(--font-noto-sans-kr), system-ui, …
--font-body:    var(--font-sans);
--font-display: var(--font-space-grotesk), var(--font-noto-sans-kr), var(--font-dm-sans), …

/* globals.css:4860 — 8347 블록이 재정의하지 않아 여기가 실효 */
--font-mono:    var(--font-jetbrains-mono), ui-monospace, Menlo, monospace;
```

> ⚠ `globals.css:86-88`의 `--font-sans: "Inter", …`는 **`tokens` 레이어라 app에 지고,
> 게다가 Inter는 로드조차 되지 않는다.** 이중으로 죽은 선언이다.

## 2.2 로드되는 폰트 4종 (`src/components/RootDocument.jsx:11-14`)

| 변수 | 폰트 | subset | 한글 글리프 |
|---|---|---|---|
| `--font-dm-sans` | DM Sans | `latin` | ❌ |
| `--font-space-grotesk` | Space Grotesk | `latin` | ❌ |
| `--font-jetbrains-mono` | JetBrains Mono | `latin` | ❌ |
| `--font-noto-sans-kr` | Noto Sans KR | (미지정) `preload:false` | ✅ |

**한글 글리프를 가진 폰트는 Noto Sans KR 하나뿐인데, 어느 토큰에서도 1순위가 아니다.**

## 2.3 ⚠ 원인 1 (핵심) — `--font-mono`에 한글 폴백이 없다

**사용량 실측** (2026-08-24, `globals.css`):

| 토큰 | 사용처 |
|---|---|
| `var(--font-mono)` | **399** |
| `var(--font-display)` | 71 |
| `var(--font-sans)` | 34 |

mono가 걸린 셀렉터 — **전부 한글 라벨이다**:

```
table.data thead th          ← 모든 데이터 표 헤더
.kpi-card .label / .delta
.summary-label
.pill                        ← 칩·배지
.toc-title  .card-eyebrow  .nav-group-index  .brand-sub
.pvm-bridge .bl   .pvm-mover .mv
.phase-card-step / -tag / -meta
code.inline  pre
```

→ 이 한글은 전부 **OS 기본 고정폭 폰트**로 폴백한다.

| OS | 결과 |
|---|---|
| **Windows** | `ui-monospace`→Consolas에 한글 없음 → 시스템 폴백(맑은 고딕/굴림 계열). **가장 어지러운 조합** |
| **macOS** | `Menlo` → Apple SD Gothic Neo. 상대적으로 나음 |

> **개발 환경(맥)에서는 멀쩡해 보이고 실사용자(윈도우)에게만 깨진다.**
> 지금까지 안 잡힌 이유이자 "한글 폰트가 너무해"의 가장 유력한 정체.

## 2.4 ⚠ 원인 2 — 한 줄 안에서 폰트가 갈린다

`--font-display`(Space Grotesk)가 쓰이는 곳:
- `globals.css:5126` `.kpi-card .value`
- `globals.css:5435` `.result-action-card__stats strong`

한 줄에서 **숫자·영문 → Space Grotesk / 한글 → Noto Sans KR**로 갈린다.
획 굵기·x-height·베이스라인이 서로 다르다 → **"촌스럽다"의 물리적 근거.**
Space Grotesk는 헤드라인용 display face이지 데이터 표시용이 아니다.

## 2.5 ⚠ 원인 3 — 크기

`globals.css:8361-8362` → `--type-body: 13px` · `--type-meta: 10px`
Noto Sans KR은 x-height가 낮아 13px 이하 한글에서 획이 뭉갠다.
§12.30의 하한 9.5px 가드는 통과하지만 **통과하는 것과 읽히는 것은 다르다.**

## 2.6 ⚠ 원인 4 — `preload: false`

`RootDocument.jsx:14`의 Noto Sans KR이 `preload:false`라 **한글만 늦게 스왑**된다(FOUT).
첫 페인트는 시스템 폰트 → 잠시 후 Noto로 튐. 표가 많은 화면에서 레이아웃이 한 번 흔들린다.

> **요약: 폰트 하나를 바꾸는 문제가 아니라, 한글에 대해 4종 스택 전체가 설계되지 않은 상태다.**

---

# PART 3 — 실행 스펙 (Codex)

## 3.1 응급 처치 — **D1·D2와 무관하게 선행 가능**

**이 두 줄이 399곳을 고친다.**

**① `v2-migration/src/app/globals.css:4860`**
```css
/* before */
--font-mono: var(--font-jetbrains-mono), ui-monospace, Menlo, monospace;
/* after */
--font-mono: var(--font-jetbrains-mono), ui-monospace, Menlo, Consolas,
             var(--font-noto-sans-kr), monospace;
```

**② `v2-migration/src/components/RootDocument.jsx:14`**
```js
/* before */ preload: false
/* after  */ preload: true
```

**검증**: `test:all` · `lint` · `build` + **Windows Chrome**에서 데이터 표 헤더 육안 확인.

## 3.2 D1 = `P` (Pretendard) 경로

| | |
|---|---|
| 라이선스 | SIL OFL (상업 이용·수정·재배포 가능, 폰트 단독 판매만 금지) |
| 굵기 | 9종 / Variable `45~920` |
| 설계 | **Inter**(라틴) + Source Han Sans(한글) + M PLUS 1p(일문) 기반 재설계 |
| 근거 | 라틴이 Inter 기반 = 데이터 대시보드 1순위 폰트의 판독성 + **한글이 같은 파일** |

**절차:**
1. `v2-migration/public/fonts/PretendardVariable.woff2` **self-host** (CDN 금지)
2. `RootDocument.jsx`에서 `next/font/local`, **`weight: "45 920"` 명시**
   > ⚠ 생략 시 **WebKit에서 굵기가 어긋나는 알려진 이슈**
3. `DM_Sans` · `Space_Grotesk` · `Noto_Sans_KR` import 제거 +
   **`RootDocument.jsx:22`의 `<html className>` 변수 목록 동반 수정**
4. **`globals.css`의 `:root` 3블록 전부** 갱신 — 19 · 4796 · 8347행
   > ⚠ 하나만 고치면 안 된다(§2.1). 19행 블록은 이 기회에 **삭제**가 맞다
5. KR/EN 양쪽 확인 (§2.11)
6. `test:all` + `lint` + **`build`**
   > 문자열만 보는 가드는 import 누락을 못 잡는다 — build까지 돌릴 것(§16)

**목표 스택:**
```css
--font-sans:    "Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif;
--font-body:    var(--font-sans);
--font-display: var(--font-sans);        /* Space Grotesk 제거 — 위계는 굵기로 */
--font-mono:    var(--font-jetbrains-mono), ui-monospace, Menlo, Consolas,
                "Pretendard Variable", Pretendard, monospace;
```

## 3.3 D1 = `I` (IBM Plex Sans KR) 경로 — 최소 비용

| | |
|---|---|
| 라이선스 | OFL |
| 굵기 | 7~8종, **Google Fonts 제공** |
| 근거 | UI 환경 전용 설계 + **`IBM Plex Mono`와 한 가족** → mono 399곳 페어링이 자동으로 맞음 |

```js
import { IBM_Plex_Sans_KR, IBM_Plex_Mono } from "next/font/google";
```
self-host 불필요. 이후 §3.2의 4~6단계는 동일.

## 3.4 D2 = `ⓑ` (mono 범위 축소) 경로

mono 399곳 중 상당수가 **숫자가 아니라 한글 라벨**이다.
고정폭은 숫자 정렬에는 맞지만 **한글 라벨에는 이득이 없고 판독만 나빠진다.**

| 안 | 내용 | 규모 | 위험 |
|---|---|---|---|
| **ⓐ** | mono 체인에 한글 폴백만 (= §3.1 ①) | CSS 1줄 | 없음 |
| **ⓑ** | 한글 라벨을 `--font-sans`로 이관, mono는 **숫자·코드 전용** | 수십 곳 | 폭 변화 → 레이아웃 회귀 |

**ⓑ 수행 시 — 목록을 손으로 적지 말고 파생할 것**(§7):
```bash
grep -n -B3 "var(--font-mono)" v2-migration/src/app/globals.css | grep "{"
```
- **mono 유지**: `pre` · `code.inline` · `table.data td .mono` · `.kpi-card .value` (숫자·코드)
- **sans 이관**: `table.data thead th` · `.kpi-card .label` · `.pill` · `.toc-title` · `.card-eyebrow`

**⚠ 필수 회귀 확인**: 폰트 폭이 바뀌면 `white-space:nowrap` + `min-width` 자리가 잘린다.
`.dashboard-top-stat`(`globals.css:7574`, `min-width:72px`) 포함 전수.

## 3.5 공통 — 어느 경로든 반드시 함께

1. **`--font-display` 폐지.** 위계는 폰트가 아니라 **굵기(현재 650~690) + letter-spacing**으로.
2. **`--font-mono` 체인에 한글 폴백.** (원인 1)
3. **`font-variant-numeric: tabular-nums`** — 현재 **17곳**뿐. 숫자 자리 전수 확인.
4. **한글 라벨 최소 11~12px.** `--type-meta: 10px`은 한글에서 사실상 판독 불가.
   > ⚠ 인라인 `fontSize`가 jsx에 **600곳**. `globals.css`만 고치면 우회로가 남는다(§12.30 전례).

---

# PART 4 — 채택 전 검증 (추정 금지)

| # | 확인 항목 | 방법 |
|---|---|---|
| 1 | **Pretendard `tnum` 실지원** | 실제 표에 `tabular-nums` 적용 후 자릿수 다른 숫자 정렬 육안 확인 |
| 2 | 13px 한글 판독 | 데이터 표 렌더 후 **Windows Chrome**에서 확인 |
| 3 | 다크/라이트 양쪽 | 다크에서 굵기가 도드라짐 — 필요 시 `-webkit-font-smoothing` 조정 |
| 4 | 번들 증가 | variable woff2 self-host 시 초기 로드 증가량 실측 |
| 5 | 레이아웃 회귀 | `white-space:nowrap` + `min-width` 잘림 전수 (§3.4) |

> ⚠ **#1은 미확인이다.** Pretendard 공식 README에 `tnum` 지원이 **명시돼 있지 않다.**
> Inter 기반이라 있을 가능성이 높지만 **추정이며 채택 전 실측이 필요하다**(§8).

---

# PART 5 — 결론

| 선택 | 언제 |
|---|---|
| **Pretendard** | "깔끔하고 촌스럽지 않게"가 목표라면. 한국 실무 표준 + Inter 기반 판독성. self-host 필요 |
| **IBM Plex Sans KR** | 변경 비용 최소화 + mono 페어링을 한 가족으로 맞추고 싶다면 |
| **응급 처치만** | 폰트 교체는 나중에, 지금 어지러움만 줄이고 싶다면 (§3.1) |

> **어느 쪽이든 §3.5의 4가지가 실제 원인이다.
> 폰트 이름을 바꾸는 것만으로는 원인 1이 고쳐지지 않는다.**

---

## 참고 출처

- [Pretendard — GitHub (orioncactus/pretendard)](https://github.com/orioncactus/pretendard)
- [Best Fonts for Dashboards (Data-Legible UI)](https://madegooddesigns.com/best-fonts-for-dashboards/)
- [18 Best Fonts for UI Design — 2026 Guide](https://taqwah.agency/blog/best-fonts-for-ui-design)
- [IBM Plex Sans KR — Google Fonts](https://fonts.google.com/specimen/IBM+Plex+Sans+KR)
- [IBM Plex — Languages](https://www.ibm.com/plex/languages/)
- [프리텐다드 vs 노토산스 vs 스포카 vs 인터롭](https://brunch.co.kr/@smootart/9)
- [Pretendard 폰트 최적화 (velog)](https://velog.io/@shackstack/Pretendard-%ED%8F%B0%ED%8A%B8-%EC%B5%9C%EC%A0%81%ED%99%94)
- [한글 웹 폰트 용량 비교 (velog)](https://velog.io/@hyunbin/%ED%95%9C%EA%B8%80-%EC%9B%B9-%ED%8F%B0%ED%8A%B8-%EC%9A%A9%EB%9F%89-%EB%B9%84%EA%B5%90)
- [웹폰트 적용과 성능 — 한글 폰트 최적화](https://unwebs.co.kr/guide/design-webfont/)
