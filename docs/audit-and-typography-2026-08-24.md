# 오딧 결과 + 한글 타이포그래피 실행 스펙

> 2026-08-24 · **Codex 핸드오프 스펙** (AGENTS.md §9 "설계 스펙 먼저, 구현은 핸드오프")
> 대상: Growth Opt Playbook / `v2-migration/` · 감사 범위: 커밋 **#690~#722**
> PART 1은 Claude가 실행한 감사 결과(§6.2), PART 2~4는 미실행 스펙이다. **코드 변경 없음.**

---

# §0 미결정 3건 — 실행 전 여기부터 채울 것

| # | 항목 | 선택지 | 결정 |
|---|---|---|---|
| **D1** | 폰트 | `P` Pretendard **(추천)** / `I` IBM Plex Sans KR / `C` 응급 처치만 | ☐ |
| **D2** | mono 범위 | `ⓐ` 폴백만 추가(CSS 1줄) / `ⓑ` 한글 라벨을 sans로 이관 **(권장)** | ☐ |
| **D3** | F-1 수정 방식 | `등록` dochi-result를 TOOL_GROUP에 등록 / `전용그룹` 새 그룹 신설 | ☐ |

**결정 없이 선행 가능한 것** (어떤 선택지에서도 되돌릴 필요가 없다):
- PART 3 §3.1 폰트 응급 처치 (mono 한글 폴백 + preload)
- PART 1 F-1 회귀 가드 추가 (수정 방식과 무관하게 계약을 고정)

---

# PART 1 — 감사 결과 (실행 완료)

## 1.1 L0 기준선 — 실측 (2026-08-24)

| 검사 | 결과 |
|---|---|
| `npm run test:all` | ✅ **312 파일 · 2468 통과 · 1 skipped** |
| `npm run lint` | ✅ **0 errors** |
| `npm run build` | ✅ 성공 (exit 0) |

> ⚠ **AGENTS.md §16의 "276파일·2268 통과"는 낡았다.** 위 실측값으로 갱신할 것.

## 1.2 🔴 F-1 (P1) — `/dochi-result`의 읽기·쓰기 그룹 비대칭

**PR #603→#604와 정확히 같은 사고가 신규 라우트에서 재발했다.**

### 근거

`dochi-result`는 `routeMap.js:70`에 등록된 라우트인데 **`TOOL_GROUP`에 없다.**
그런데 이 라우트는 CSV를 **읽고 쓴다**:

| 동작 | 코드 | 그룹 결정 |
|---|---|---|
| **읽기** | `useDataStore.js:529-530` `TOOL_GROUP[id] \|\| state.activeDataGroup` | **sticky** — 마지막 도구 그룹 유지 |
| **쓰기** | `useDataStore.js:772` `groupForRoute(state.currentRouteId)` → `TOOL_GROUP[id] \|\| "efficiency"` | **efficiency로 강제** |

`DochiResultWorkspace.jsx:122` 가 `csvData`를 읽고,
`DochiResultWorkspace.jsx:~152` 가 `<CsvUploader toolId="start-gate" …/>` 를 렌더해 쓴다.

**두 경로가 서로 다른 그룹을 고른다** — `activeDataGroup ≠ "efficiency"`인 모든 경우.

### 재현 (3/3 통과 — 예측대로 재현됨)

```
1) setCurrentRouteId("5-28")        → activeDataGroup = "subscription_survival"
2) setCurrentRouteId("dochi-result") → sticky, 그룹 유지 (미러 = subscription 슬라이스)
3) setCsvData(DATA)                  → csvGroups.efficiency 에 저장됨 ⚠
                                       csvGroups.subscription_survival 은 빈 채
4) 다른 라우트 갔다가 /dochi-result 재진입
   기대: 방금 올린 CSV
   실제: csvData.fileName === ""  ← 업로드 소실
```

**동반 결함**: `DochiResultWorkspace.jsx:124`의 `setGroupAnalyzed("dochi-result")`도
`groupForRoute` 경유라 **무관한 `efficiency` 그룹의 분석 게이트를 연다.**
게다가 그 시그니처는 미러(= 다른 그룹의 데이터)에서 계산된다
(`useDataStore.js:859-862`) — 5-2 대시보드 등이 사용자가 "분석하기"를 누르지 않았는데
열린 상태가 된다.

### 왜 하네스가 못 잡았나

- `dochi-result`를 보는 테스트는 `DochiResultWorkspace.smoke.test.jsx` ·
  `DochiAssistant.smoke.test.jsx` **둘뿐**이고,
  둘 다 `csvGroups.efficiency`를 **직접 주입**한다(라인 41·58).
- 즉 **하필 폴백 그룹으로만 검사**해서 비대칭이 상쇄된다.
- §7 *"스모크 `beforeEach`의 상태 주입이 진입 경로를 우회한다"* 가 그대로 재발.
  `setCurrentRouteId` → 미러 스왑을 밟는 케이스가 없다.

### 전수 확인 — 이 라우트 하나만 빠져 있다

`TOOL_GROUP` 미등록 라우트 18개 중 CSV를 소비하는 것은 `dochi-result` **하나뿐**이다
(나머지는 SOP 문서 15개 · `home` · `guide-index`).
`start-gate`는 `toolGroups.js:10`에 **등록돼 있다** — #604의 교훈이 적용된 자리다.

> §16 *"다수가 맞으면 소수의 예외가 보이지 않는다"* — 계약은 표본이 아니라 전수로 검사할 것.

### 수정 방향 (D3)

- **`등록`**: `toolGroups.js`에 `"dochi-result": "efficiency"` 추가.
  가장 작다. 단 도치가 효율 CSV만 다룬다는 전제가 맞아야 한다.
- **`전용그룹`**: `"dochi-result": "dochi"` 신설. 슬라이스가 격리되지만
  도치가 여러 grain을 넘나드는 설계라면 오히려 어긋난다.

**어느 쪽이든 회귀 가드는 지금 추가할 것** — `TOOL_GROUP` 미등록 라우트 중
`csvData`를 읽거나 `CsvUploader`를 렌더하는 것이 없음을 **라우트에서 파생해** 단언.
목록을 손으로 적으면 다음 라우트에서 또 어긋난다(§7).

## 1.3 🟡 F-2 (P2, 미확인) — `invertMatrix`의 절대 pivot 임계

`subscriptionSurvivalMath.js:313`
```js
if (!(magnitude > Number.EPSILON * 100)) return null;   // ≈ 2.2e-14, 절대 임계
```

§7에 이미 기록된 함정이다 — *"Gauss-Jordan inverse는 절대 pivot 임계로
rank-deficiency를 못 잡는다. `maxErr = max|I·M−δ| > 1e-6`이면 null 반환"*.
`REG_STATS.ols`는 잔차 기반으로 판정하는데 **이 신규 코드는 절대 임계로 되돌아갔다.**
log-rank 공분산은 위험집합 카운트 기반이라 대용량에서 스케일이 커진다.

**정직하게 남긴다: 재현하지 못했다.** 스케일 1e0·1e3·1e5의 준특이 행렬을 넣어
봤으나 잔차 `max|I−M·M⁻¹|`가 0~1.2e-7로, 부동소수점이 감당해 가비지가 나오지 않았다.
실제 log-rank 공분산에서 도달 가능한 입력을 구성하지 못했으므로 **구조적 위험이지
확인된 버그가 아니다.** 판정 기준을 잔차 기반으로 맞추는 것은 정상 입력에서 no-op이라
골든 byte-identical로 넣을 수 있다.

## 1.4 ✅ 정상 확인된 것 (회귀 없음)

| 항목 | 결과 |
|---|---|
| **3맵 파생** (`csvGroups`·`analyzedByGroup`·`dashboardFilterGroups`) | ✅ `buildGroupMap(DATA_GROUPS)`로 파생. #608/#610 교훈 적용됨 |
| **5-28 배선** | ✅ 31개 파일. IA·routeMap·toolGroups·routeSeo·toolOg·csvConstants·toolGuide·demoData 전부 |
| **`toolIndex`·`sitemap`** | ✅ 5-28 문자열이 없지만 **정상** — `ROUTES.filter(isRoutePublished)`로 파생(§12.31) |
| **KR/EN 대칭** (§2.11) | ✅ 5-28·dochi-result 모두 EN PageClient·`EN_READY_TOOL_IDS`에 등록 |
| **5-28 정직성** (§8) | ✅ `status:"unavailable"` + `reason` 구조, `ok:false, reason:"covariance_not_estimable"`, 지평 밖 외삽 거부(`survivalBasedLtv`가 `null`), CAC 부분결측을 평균내지 않음. **"계산 불가를 좋은 등급으로 접는" 패턴 없음** |
| **테스트 내 `?.()`** | ✅ 검사를 무력화하는 자리 없음. `MulticollinearityChecker.smoke.test.jsx:22`에 과거 사고가 주석으로 기록돼 있음 |

## 1.5 🟡 F-3 (P2, 체계) — 소스 문자열 가드가 주석을 안 벗긴다

`readFileSync`로 소스를 읽어 문자열 검사하는 가드 **20개 중 18개가 주석을 제거하지 않는다.**
§16에 *"소스를 문자열 포함으로 검사하면 자기 설명 주석에 속는다"* 로
**한 세션에 3회** 기록된 클래스인데, 고친 2개(`downloadEscape`·`tabContract`) 외에는
같은 형태로 남아 있다.

> §7 *"교훈을 적용할 땐 같은 패턴의 파일을 전부 grep해서 한 번에 고칠 것 —
> 한 곳만 고치면 교훈이 기록됐다는 사실이 남은 구멍을 가린다."*

**전수 목록**: `toolDemoEntry` · `legacyPillRatchet` · `titleAffordance` ·
`appShellSemantics` · `mobileTaskIntegrity` · `privacy` · `buttonContrast` ·
`mmmResultWorkflow` · `dashboardKpiLayout` · `typographyFloor` · `focusVisible` ·
`cardCopyLayout` · `contentLinks` · `compareContent` · `blogFormatting` ·
`contentAssets` · `sopBlocks` · `mmmBusinessSeasonality`

**주의**: 전부가 위험한 건 아니다. **"없어야 한다"를 검사하는 가드**와
**"있으면 배선된 것으로 친다"는 가드**만 주석에 속는다. 공용 `stripComments` 하나를
만들어 그 부류부터 통과시키는 게 맞다 — 18개를 일괄 수정하는 건 과잉이다.

## 1.6 감사 요약

| 심각도 | 건수 | 항목 |
|---|---|---|
| 🔴 P1 | 1 | F-1 `/dochi-result` 그룹 비대칭 (재현 완료) |
| 🟡 P2 | 2 | F-2 절대 pivot 임계(미확인) · F-3 주석 미제거 가드 18개 |
| ✅ | 6 | 3맵 파생 · 5-28 배선 · 파생 목록 · KR/EN · 5-28 정직성 · 테스트 무력화 없음 |

**전반적으로 #690~#722의 배선 품질은 높다.** 과거 사고(#603·#608·#610)의 교훈이
실제로 코드에 남아 동작하고 있고, 5-28 엔진의 통계적 정직성은 §8 기준을 만족한다.
**단, 새로 생긴 라우트 하나(`dochi-result`)가 바로 그 교훈의 사각지대에 떨어졌다.**

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
