# Growth Opt Playbook — 분석 정확성 QA 보고서

- **실측일**: 2026-09-16
- **대상 커밋**: `4d9b1ea` (origin/main)
- **범위**: `v2-migration/` 분석 파이프라인 (파싱 → 정규화 → 지표 → 통계 → 해석 → 저장 → export)
- **방법**: 코드 대조 + **실행 재현**. 추측은 결함으로 올리지 않았다 — 아래 모든 P0/P1은
  입력·기대·실제를 실제로 돌려 확인했다.
- **기준선**: `npm run test:all` = **3,938 passed / 0 failed**. 기존 스위트는 깨끗했다.
  즉 아래 결함은 **당시 가드가 보지 않는 자리**에 있었다.
- **수정 후**: `test:all` **4,025 passed / 0 failed** · `lint` 0 · `build` 성공.

> **상태 (2026-09-16 최종)**: 발견한 **P0·P1·P2·P3 전부 수정 완료**.
> C(브라우저 저장 migration) 감사·수정 완료 — 아래 §C.
> `test:all` **4,025 passed / 0 failed** · `lint` 0 · `build` 성공.

---

## Executive Summary

| 등급 | 건수 | 요지 |
|---|---:|---|
| **P0 Critical** | 1 | A/B 대량 검정(CSV 경로)이 근사 p로 "유의" 판정 — 같은 도구의 수동 경로와 판정이 반대로 갈린다 → **수정됨** |
| **P1 High** | 3 | 같은 화면·같은 라벨의 KPI가 두 값 (CVR·ROAS) · 같은 CSV 셀이 도구마다 다른 숫자로 파싱 → **전부 수정됨** |
| **P2 Medium** | 4 | 중복 매핑 무경고 · 음수 분모 · 모드 C 평균효율 배분 · 통화 파싱 → **전부 수정됨** |
| **P3 Low** | 1 | 모호 날짜(`03/04/2026`) 무고지 미국식 확정 → **수정됨** |
| **C: 저장 migration** | 3 | 미래 버전 동의 무조건 신뢰 · 모르는 변환 조용히 건너뜀 · 한 건 실패가 전체 복원 중단 → **전부 수정됨** |

### 한 줄 답

**핵심 KPI 엔진(`metricRegistry`·`calculateKPIs`)의 수학은 맞다.** 골든·불변식·변형검사 21건을
새로 걸어 전부 통과했다. 결함은 수학이 아니라 **① 같은 지표를 두 곳에서 따로 계산한 자리**와
**② 더 정확한 검정을 만들어 놓고 한쪽 경로만 배선한 자리**에 몰려 있다 — `AGENTS.md` §16이
"신호를 만들어 놓고 읽는 곳을 안 배선한 자리"라고 이름 붙인 바로 그 패턴의 재발이다.

---

## 0. 파이프라인 구조 (실측)

```
CSV/XLSX
 → decodeCsv / xlsxImportPolicy          (인코딩·BOM·시트)
 → PapaParse (dynamicTyping 없음 → 전 값 문자열)
 → detectHeaderRow · profileColumns
 → mappingContract (도구 스코프 자동매핑)
 → ┬ mapRowsToStandard  ─────→ 분석 경로 (도구가 실제로 읽는 것)
   └ buildCanonicalDataset ──→ 품질 리포트 경로 (AnalysisBasisBar 경고)
 → 분석 게이트 (analyzedByGroup / computeAnalyzeSig)
 → 도구별 엔진 (*Math.js 순수함수, 골든)
 → 결론 카드(ResultActionCard) · 차트 · 표
 → DownloadHub / analysisWorkbook / decisionReview(IndexedDB)
```

**구조적 관찰 — 파서가 갈리는 지점**: 위 그림의 두 갈래가 **서로 다른 숫자 파서**를 쓴다.
분석 경로는 `normalizeValues.normalizeNumericValue`(엄격, 거부 가능)를 쓰지만, 그 아래
개별 엔진 15곳 이상이 각자 `String(v).replace(/,/g,"")` 류의 자체 파서를 갖고 있다
(`pvmMath` · `budgetAllocTool` · `asoStoreMath` · `paidOrganicTrend` · `format.parseNum` ·
`periodComparison` · `decisionScore` · `snapshot` · `segmentPanel` · `forecastReview` …).
→ **P1-3**의 직접 원인.

### 분석 도구 인벤토리

| ID | 도구 | CSV 그룹 | 핵심 엔진 | 통계 방법 | 골든 |
|---|---|---|---|---|:-:|
| 5-2 | 운영 대시보드 | efficiency | `dashboardAggregator` + `metricRegistry` | 기술통계·WoW | ✓ |
| 5-21 | 캠페인 성과 변동 | efficiency | `pvmMath` | Bennet 무잔차 분해 | ✓ |
| 5-22 | 캠페인 포화도 | efficiency | `satMath` + `allocationMath` | 한계/평균 CPA 비 | ✓ |
| 5-3 | 예산 배분 | efficiency | `budgetAllocTool` + `allocationMath` | 곡선적합 + 그리디 | ✓ |
| 5-4 | 실험 분석 (A/B) | experiment | `abTestMath` | z·Fisher·Beta·Holm | ✓ |
| 5-23 | 증분 (홀드아웃) | incrementality | `incrMath` · `incrPrePostMath` | 2비율 z · DiD | ✓ |
| 5-24 | 브랜드 증분 | brand_incrementality | `brandIncrementalityMath` | ITS · AR(1) · HAC | ✓ |
| 5-18-* | 추세·유입·잠식·MMM·예측 | response | `mmmMath`(+`mmmMathPr416`) | 베이지안/OLS·adstock | ✓ |
| 5-20 | 핵심 가치 발굴 | aha | `ahaMath` | 윈도우×횟수 그리드 | ✓ |
| 5-25 | 다중공선성 | collinearity | `creativeMath.vif` | VIF·상관 | ✓ |
| 5-26 | ASA 키워드 | asa_keyword | `asaKeywordMath` | 승격 규칙 | ✓ |
| 5-27 | ASO 스토어 전환 | aso_store | `asoStoreMath` | 퍼널·Mix/Rate | ✓ |
| 5-28 | 액션 생존·이탈 | subscription_survival | `subscriptionSurvivalMath` | KM·해저드·RMST | ✓ |
| 5-29 | 구성 변화 | segment_composition | `segmentCompositionMath` | Mix/Rate 무잔차 | ✓ |
| 9-6 | 소재 분석 | creative | `creativeMath` | 피로도·포레스트 | ✓ |
| 9-1/2/3/7 | 콘텐츠 계열 | content_* | 리라벨(수학 불변) | — | ✓ |

---

## P0 Findings

### [P0-001] A/B 대량 검정(CSV 경로)이 정규근사 p로 "유의"를 선언한다 — 같은 도구의 수동 경로와 판정이 반대

**Location**
- `v2-migration/src/utils/abTestMath.js:477` `massReadout()`
- `v2-migration/src/components/tools/AbTestHoldout.jsx:292` (CSV 판독 경로)
- 대조: 같은 파일 `AbTestHoldout.jsx:196-197` (수동 2-arm 경로)

**Current code**

수동 2-arm 경로는 근사를 못 믿는 구간에서 **판정 기준을 정확검정으로 옮긴다**:
```js
// AbTestHoldout.jsx:196
const preferExact = STATS.shouldPreferExactTest(nA, xA, nB, xB);
const exact = preferExact ? STATS.fisherExact2x2(nA, xA, nB, xB) : null;
```
바로 그 코드 위 주석이 이렇게 적혀 있다:
> *"더 정확한 검정이 '유의 아님'이라 말하는데 화면이 '유의'라고 하면 안 된다."*

그런데 CSV 대량 검정 경로는 `shouldPreferExactTest`를 **한 번도 부르지 않는다**:
```js
// abTestMath.js:498 (massReadout 내부)
const freq = twoPropZTest(control.n, control.x, a.n, a.x);
...
sig: freq.pValue < 0.05,        // ← 정규근사 p가 그대로 판정
```
전 코드베이스에서 `shouldPreferExactTest` 소비처는 `AbTestHoldout.jsx`와
`groupComparisonMath.js` 두 곳뿐이다(grep 전수 확인). `massReadout`은 빠져 있다.

**Reproduction** (`AGENTS.md` §8.11이 직접 지목한 픽스처)
```
A(control): n=50, 전환 0
B:          n=50, 전환 5
```

| 경로 | p-value | 화면 판정 |
|---|---:|---|
| 수동 2-arm (`shouldPreferExactTest`=true → Fisher) | **0.0563** | 비유의 |
| CSV 대량 검정 (`massReadout`) | **0.0218** | **`p < 0.05` 배지** |

실행 결과(실측):
```
n=50/50 x=0/5 | z-p=0.0218 preferExact=true fisher-p=0.0563 || massReadout p=0.0218 sig=true
n=10/10 x=1/2 | z-p=0.5312 preferExact=true fisher-p=1.0000 || massReadout p=0.5312 sig=false
n=1000/1000 x=100/120 | z-p=0.1529 preferExact=false fisher-p=-  || massReadout p=0.1529 sig=false
```

**User impact**
같은 도구, 같은 숫자인데 어느 화면으로 들어갔느냐에 따라 승자 선언이 뒤집힌다. CSV로
올린 쪽이 더 관대하다 — 즉 **없는 유의를 만든다**. 저전환 실험(설치→결제, ASA 키워드,
소재 변형)이 정확히 이 구간이고, 마케터는 이 배지를 근거로 소재·키워드를 확정한다.
`AGENTS.md` §8.6(입증책임 비대칭)과 §8.11에 정면으로 어긋난다.

**Suggested fix**
`massReadout`의 arm 루프에서 `shouldPreferExactTest`가 참이면 `fisherExact2x2`의 p를
Holm 입력으로 쓴다(수학 신규 없음 — 이미 있는 함수 배선). 표에 어떤 검정을 썼는지
열 또는 각주로 남긴다. 3-arm 이상에서 Fisher는 2×2 쌍별 비교이므로 현재의
control-vs-variant 구조와 그대로 맞는다.

**Regression test (fix와 함께 커밋)**
```js
it("저전환 구간에서 대량 검정이 수동 경로와 같은 판정을 낸다", () => {
  const { nA, xA, nB, xB } = AB_LOW_CONVERSION; // 50/0 vs 50/5
  const exactP = STATS.fisherExact2x2(nA, xA, nB, xB).pValue;
  const mass = STATS.massReadout([
    { name: "A", n: nA, x: xA, isControl: true },
    { name: "B", n: nB, x: xB },
  ]);
  const b = mass.rows.find((r) => !r.isControl);
  expect(STATS.shouldPreferExactTest(nA, xA, nB, xB)).toBe(true);
  expect(b.pValue).toBeCloseTo(exactP, 10);
  expect(b.sig).toBe(false);          // 지금은 true — 이 줄이 결함을 잡는다
});
```

---

## P1 Findings

### [P1-001] 결론 카드의 CVR이 전역 분모 기준(설치/가입) 토글을 무시한다

**Location** `v2-migration/src/utils/dashboardVerdict.js:74`

**Current code**
`buildDashboardVerdict`는 `denomBasis`를 **인자로 받아** CPI/CPA 선택(`effKey`)과
가중 리텐션에는 적용하면서, CVR만 설치로 못박아 계산한다:
```js
const basis = effectiveDenomBasis(csvData, denomBasis);   // ← 받아서
...
cvr: clk > 0 ? inst / clk : null,                          // ← 안 쓴다 (항상 installs)
ret: computeWeightedRetention(arr, 7, basis).rate,         // ← 여기선 쓴다
```
SSOT인 `metricRegistry`의 정의는 `cvr = denom / clicks`이고, 같은 페이지의 KPI 카드
(`VizTab.jsx:289` → `calculateKPIs(fRows, selectedCohort, effBasis)`)는 그 정의를 따른다.

**Reproduction** — Installs 100 / Actions 25 / Clicks 500 (14일), 분모 기준 = **가입(actions)**
```
calculateKPIs (KPI 카드) CVR = 0.05   (25/500)
buildDashboardVerdict   CVR = 0.2    (100/500)
```
두 값이 **같은 화면에 동시에, 둘 다 "CVR"이라는 라벨로** 렌더된다
(`Dashboard.jsx`: 결론 카드 → `#dashboard-tabpanel` → `VizTab`). 4배 차이다.

**User impact** 가입 기반 캠페인(구독·리드)에서 화면이 CVR을 4배 부풀려 보여준다.
결론 카드가 화면 최상단 "결론 먼저" 자리라 사용자는 이쪽을 먼저 읽는다.

**Suggested fix** `cvr: clk > 0 ? (basis === "actions" ? act : inst) / clk : null`.
더 나은 방향은 `agg()`가 `metricRegistry.computeMetrics`를 소비해 정의를 한 곳으로
되돌리는 것이다(아래 P1-002와 같은 뿌리).

---

### [P1-002] 결론 카드의 ROAS·매출·이익이 코호트 선택(D7/D14/D30)을 무시하고 D7에 고정

**Location** `v2-migration/src/utils/dashboardVerdict.js:73, 240-245` · `src/components/Dashboard.jsx:96`

**Current code**
```js
// dashboardVerdict.js — cohort 인자가 아예 없다
const rev = sum(arr, "revenue_d7");                  // 하드코딩
roas: cost > 0 && rev > 0 ? rev / cost : null,
profit: mapped.has("revenue_d7") ? rev - cost : null,
```
```js
// Dashboard.jsx:96 — 호출부도 cohort를 넘기지 않고, deps에도 없다
buildDashboardVerdict({ csvData, filterState: dashboardFilter, denomBasis, ... });
}, [showResults, csvData, dashboardFilter, denomBasis, dataCurrency, dashWindowDays, locale]);
```
반면 KPI 카드는 `selectedCohort`(스토어 상태, 기본 7, 사용자 선택 가능)를 따른다.

**Reproduction** — `revenue_d7` 평평, `revenue_d30` 증가, 코호트 = **D30** 선택
```
VizTab KPI 카드 ROAS = 6      (600%)
결론 카드 ROAS       = 1      (100%)
```
표의 매출·리텐션 행은 `매출(D7)`·`리텐션(D7)`로 **정직하게 라벨링돼 있다**. 그런데
**ROAS 행만 라벨이 그냥 `ROAS`**라, 같은 화면의 KPI 카드 ROAS와 구분할 표식이 없다.
게다가 `selectedCohort`가 `useMemo` deps에 없어 코호트를 바꿔도 결론 카드는 **재계산조차
되지 않는다**.

**부수 관찰**: 표 행 자체가 `mapped.has("revenue_d7")` 게이트라, `revenue_d30`만 매핑한
CSV에서는 결론 카드에 ROAS가 통째로 사라지는 반면 KPI 카드에는 뜬다.

**User impact** D30 LTV 기준으로 판단하려던 사용자가 상단 결론에서 D7 ROAS를 읽는다.
`AGENTS.md` §9 "지표의 시간 의미 확인 — cohort-window를 캘린더-일별 분석에 섞지 말 것"
위반이며, export(`verdict.export.csv`)도 같은 값을 내보내므로 보고서까지 전파된다.

**Suggested fix** `buildDashboardVerdict`에 `cohort` 파라미터를 추가하고 `Dashboard.jsx`가
`selectedCohort`를 넘기며 deps에도 넣는다. 최소 수정으로는 ROAS 라벨을 `ROAS (D7)`로
바꿔 라벨만이라도 정직하게 만들 수 있으나, 이는 불일치를 **표기**할 뿐 해소하지 않는다.

---

### [P1-003] 같은 CSV 셀이 도구마다 다른 숫자로 파싱된다 (유럽식 소수 구분자)

**Location** 파서가 15곳 이상 병존. 확인한 주요 분기:
- `src/lib/data-import/normalizeValues.js:55` (엄격 — 정답 경로)
- `src/utils/pvmMath.js:9` · `src/utils/budgetAllocTool.js:37` · `src/utils/format.js:85`
  · `src/lib/analysis-results/periodComparison.js:5` · `src/utils/asoStoreMath.js:19`

**Reproduction** — CSV 셀 `Cost = "1.000,25"` (실제 값 1,000.25). 같은 매핑, 같은 행:

| 소비처 | 결과 |
|---|---:|
| `normalizeNumericValue` (canonical) | `null` — **거부(정답)** |
| 5-2 대시보드 `calculateKPIs` | **0** |
| 5-21 PVM `PVM_MATH.aggregate` | **1.00025** |
| 5-3 `allocParseNum` | **1.00025** |
| `format.parseNum` (표시층) | **1.00025** |

같은 파일을 5-2에서 보면 비용 ₩0, 5-21에서 보면 ₩1.00025다. **둘 다 틀렸고, 서로 다르다.**
실제 값보다 1,000배 작다.

부차 발견(같은 실행):

| 입력 | canonical | 5-2 | 5-3 `allocParseNum` | `format.parseNum` |
|---|---:|---:|---:|---:|
| `₩1,000` | 1000 | 1000 | **null** | 1000 |
| `$1,000.25` | 1000.25 | 1000.25 | **null** | 1000.25 |
| `(100)` | −100 | −100 | **null** | **null** |

**User impact** 유럽·남미 로케일로 export한 매체 리포트(Meta·Google Ads는 계정 로케일을
따른다)가 무성하게 1,000배 축소된다. 예산 도구는 통화기호가 붙은 값을 아예 못 읽어
해당 채널이 배분에서 빠진다.

**완화 요인 (P0가 아닌 이유)**: `buildCanonicalDataset`가 `invalid_number` 이슈를 만들고
`AnalysisBasisBar`가 *"숫자 또는 날짜 형식이 아닙니다"* 경고를 렌더한다. 즉 **경고는
뜬다**. 다만 ① 분석은 그대로 진행되고 ② 그 경고를 만드는 경로(`canonicalData`)와 숫자를
쓰는 경로(`mappedRows`)가 **달라서** 경고와 실제 사용값이 연동돼 있지 않으며 ③ PVM·예산
경로는 경고 없이 1.00025를 그냥 쓴다.

**Suggested fix**
1. 숫자 파싱 SSOT를 `normalizeNumericValue` 하나로 모은다. 엔진들의 자체 파서는 이를
   호출하도록 바꾼다(반환 계약: `null` = 읽을 수 없음, 0으로 뭉개지 않는다).
2. 파서 소비처를 손으로 나열하지 말고 가드를 **파생**시킨다 —
   `grep -rn "replace(/\[?,"` 류가 `src/utils`·`src/lib`에서 0건임을 단언하는 테스트.
   (`AGENTS.md` §7: "같은 패턴의 파일을 전부 grep해서 한 번에 고칠 것".)
3. `invalid_number`가 1건이라도 있으면 분석 게이트에서 **읽을 수 없는 셀 수와 컬럼명**을
   고지한다(막지는 않되 숫자 옆에 표식).

---

## P2 Findings

### [P2-001] 중복 매핑이 경고 없이 마지막 컬럼만 남긴다 — **수정됨**
`src/utils/mappedRows.js:36` — 두 원본 컬럼이 같은 표준키로 매핑되면 뒤쪽이 앞쪽을 덮는다.
재현: `{Cost:"100", Spend:"999"}` + `{Cost:"cost", Spend:"cost"}` → `{cost:"999"}`. 100은 조용히 사라진다.

**수정**: `buildCanonicalDataset`가 매핑만으로(행 순회 없이) 중복 표준키를 세고,
품질 리포트가 `duplicate_mappings` 이슈로 올려 `AnalysisBasisBar`가 **어느 컬럼이 겹쳤는지
이름으로** 말한다(KR/EN). 덮어쓰기 자체는 그대로 둔다 — 어느 쪽이 맞는지는 사용자만 안다.

### [P2-002] 음수 분모가 falsy 가드를 통과해 음수 효율을 만든다 — **수정됨**
`src/utils/metrics/metricRegistry.js:22` `ratio = (num, den) => (den ? ... : null)`.
재현: `impressions: -50` → `CPM = -2000`, `denom: -2` → `CPI = -50`.

**왜 중요한가**: 음수 효율은 정렬에서 **최상위로 올라와 가장 좋은 채널로 읽힌다.**
"계산 불가"가 "아주 저렴함"으로 뒤집히는 방향의 실패다(§8.6).

**수정**: `den > 0`. 노출·클릭·설치·결제는 정의상 음수가 될 수 없는 카운트다.
양수 분모에서는 동작이 전과 같아 골든은 불변이다(테스트로 고정).

### [P2-003] 예산 배분 모드 C가 평균 CPR로 배분하면서 결과는 포화 곡선으로 보고한다 — **고지 추가**
`src/utils/budgetAllocTool.js:183` — 배분 가중치는 `1/avgCPR`(평균 효율)인데, 배분된 예산의
`results`는 `ALLOC_MATH.predictSafeCpr`(한계/포화 곡선)로 계산한다. 즉 **곡선이 "여기 더 넣지
마라"고 말하는 채널에 평균 효율만 보고 예산을 넣고, 그 결과는 곡선으로 되돌려 보고한다.**

**수정 범위 판단**: 모드 B(한계효용 그리디)가 별도로 존재하므로 모드 C의 배분 규칙은
**선언된 동작**이다. 배분 수학을 바꾸는 것은 §11(순수 엔진 수학 변경 금지)에 걸리고,
어느 쪽이 기본이어야 하는지는 제품 결정이다. 따라서 **수학은 그대로 두고 고지를 추가**했다 —
모드 토글 아래에 각 방식이 무엇을 보고 무엇을 안 보는지 한 문단으로 말한다(KR/EN).
"안정적 효율 가중"이라는 이름만으로는 포화까지 본다고 오해되기 때문이다.

### [P2-004] `allocParseNum`이 통화기호를 못 읽는다 — **P1-003 수정에 포함돼 해소**
`parseFloat("₩1000")` → `NaN` → `null`이라 해당 채널이 사유 없이 배분에서 제외됐다.
파서 단일화로 전 도구가 통화기호·괄호음수를 같은 규칙으로 읽게 되면서 함께 사라졌다.

---

## P3 Findings

### [P3-001] 모호한 숫자형 날짜를 고지 없이 미국식으로 확정 — **수정됨**
`src/lib/data-import/normalizeValues.js:143` — `03/04/2026`은 앞자리가 12 이하면 M/D로 읽는다
(`first > 12`일 때만 D/M). 로직 자체는 결정론적이고 존재하지 않는 날짜는 거부하지만,
**어느 규칙으로 읽었는지 화면이 말하지 않았다.** 유럽식 export에서 3월 4일 ↔ 4월 3일이 뒤집힌다.

**수정**: `parseDateValue`가 `ambiguous` 플래그를 함께 돌려주고(기존 `isoDate`·`canonical`
계약은 불변 — 추가만), 품질 리포트가 `ambiguous_date_format`으로 올려 화면이
*"월/일(미국식)로 읽었습니다 — 일/월 형식이라면 YYYY-MM-DD로 바꿔 다시 올리세요"* 라고 말한다.
**읽는 규칙은 바꾸지 않았다** — 데이터만으로는 판별할 수 없으므로 추측을 바꾸는 대신
무엇으로 읽었는지 밝힌다(§8: 판별기가 못 가르는 건 화면이 사유를 말하게 할 것).

---

## Analysis Coverage

| 검증 항목 | 결과 |
|---|---|
| KPI 공식 (CPM·CTR·CPC·CPI·CPA·CVR·ROAS·ARPU·ARPPU·CPP) | ✅ SSOT `metricRegistry` 정의 정확, 골든 통과 |
| 가중 집계 (Σ비용÷Σ결과 vs CPA 단순평균) | ✅ 비대칭 픽스처로 확인 — 가중이 맞다 |
| 집계 불변식 (그룹합 = 전체합) | ✅ |
| 행 순서 / 차원 리네임 불변 | ✅ |
| 변형검사 (2배 복제 · 금액 10배) | ✅ |
| 분모 0 → `null` (Infinity·NaN 금지) | ✅ |
| 기간 비교 base=0 처리 | ✅ `periodComparison.js:31`·`dashboardVerdict.js:18` 모두 `null` + `Math.abs(prev)` |
| DiD (증분) | ✅ 사전추세 게이트 + 차분의 차분으로 유의성 계산 — 올바르다 |
| PVM 무잔차 분해 | ✅ 최소 grain 1회 분해 + rollup, 양의 비용·0 결과 계약 검증 |
| A/B 2-arm (z·Fisher·Beta·Holm) | ✅ 수동 경로 / ❌ CSV 대량 경로 (**P0-001**) |
| 리텐션 가중 (비율 vs 인원수 판별) | ✅ SSOT `computeWeightedRetention`, 0% 포함 |
| 숫자 정규화 (콤마·통화·괄호음수) | ⚠️ canonical은 정확, 엔진별 사본이 갈림 (**P1-003**) |
| 날짜 정규화 (윤년·주차·월·ISO·UTC) | ✅ strict 파서, rollover 거부 / ⚠️ 모호 로케일 (**P3-001**) |
| 지표 정의 단일성 (화면 간) | ❌ CVR·ROAS 이중 계산 (**P1-001·002**) |
| 데이터 유출 (CSV 원본의 외부 전송) | ✅ `analytics.js` 44개 이벤트 전수 확인 — raw row·캠페인명·금액 전송 없음. 저장은 IndexedDB 로컬 한정 |
| 결정론 (`Math.random`) | ✅ 엔진에 0건 |

---

## Cross-tool inconsistencies (요약)

| 지표 | 도구 A | 도구 B | 원인 |
|---|---|---|---|
| CVR | 5-2 KPI 카드 `0.05` | 5-2 결론 카드 `0.2` | 분모 기준 미적용 (P1-001) |
| ROAS | 5-2 KPI 카드 `6` | 5-2 결론 카드 `1` | 코호트 미적용 (P1-002) |
| Cost | 5-2 `0` | 5-21 / 5-3 `1.00025` | 파서 분기 (P1-003) |
| 유의성 | 5-4 수동 `비유의` | 5-4 CSV `p<0.05` | Fisher 라우팅 누락 (P0-001) |

---

## Missing Tests (가드가 없는 자리)

1. **지표 정의 단일성** — 같은 CSV·같은 설정에서 `calculateKPIs`와 `buildDashboardVerdict`가
   같은 지표에 같은 값을 내는지 단언하는 검사가 **없다**. 있었다면 P1-001·002가 잡혔다.
2. **파서 단일성** — 자체 숫자 파서를 새로 만들면 막는 가드가 없다.
3. **통계 경로 정합** — `shouldPreferExactTest`를 부르지 않고 p를 판정에 쓰는 경로를 막는 가드가 없다.
4. **변형검사 전반** — 복제·스케일·순서 불변을 엔진별로 도는 검사가 없다(이번에 5-2만 추가).
5. **Simpson's paradox** — mix/rate 분해가 within-segment 개선과 구성 변화를 실제로
   가르는지 보는 픽스처가 없다(`pvmMath`·`segmentCompositionMath` 둘 다 수학은 맞으나
   "전체 악화 + 전 세그먼트 개선" 픽스처로 문구까지 검증한 적 없음).

---

## Recommended Test Architecture

```
src/utils/__fixtures__/qaFixtures.js     ← 재사용 픽스처 (이번에 추가)
src/utils/kpiInvariants.test.js          ← 골든·불변식·변형검사 (이번에 추가, 21건)
src/utils/parserSingleSource.test.js     ← [권장] 자체 파서 신규 생성 차단 (파생 가드)
src/utils/metricDefinitionParity.test.js ← [권장] 같은 지표 = 같은 값 (파생 가드)
src/utils/abTestRouting.test.js          ← [권장] 근사 p로 판정하는 경로 차단
```

가드는 **값이 아니라 근거**를 고정하고, 소비처 목록은 손으로 쓰지 말고
레지스트리에서 **파생**시킬 것(`AGENTS.md` §7 — "커버리지 가드가 손으로 쓴 배열을 돌면
가드가 아니다").

---

## 마지막 질문에 대한 답

**1. 현재 분석 결과 숫자를 신뢰할 수 있는가?**
핵심 KPI 엔진은 신뢰할 수 있다(골든·불변식·변형검사 통과). 단 **깨끗한 숫자 표기의 CSV**에
한한다. ① 5-2 결론 카드의 CVR·ROAS ② 유럽식 숫자 표기 파일 ③ 5-4 CSV 대량 검정의
유의성 배지 — 이 셋은 지금 신뢰할 수 없다.

**2. 가장 위험한 분석 도구 5개** (잘못된 결론이 나올 위험 기준)
1. **5-4 실험 분석 (CSV 대량 검정)** — 없는 유의를 만든다. 결론이 "이 소재를 쓴다"로 직결.
2. **5-2 운영 대시보드 (결론 카드)** — 최상단 "결론 먼저" 자리에서 CVR 4배·ROAS 코호트 불일치.
3. **5-3 예산 배분** — 통화기호 값 누락 시 채널이 사유 없이 빠지고, 모드 C가 포화를 무시.
4. **5-21 캠페인 성과 변동** — 수학은 무잔차로 견고하나 파서 분기로 입력이 틀릴 수 있다.
5. **5-18-mmm 채널 기여도** — 수학·가드는 가장 두껍지만(공선 드롭·릿지 플래그·커버리지),
   출력이 인과로 읽히기 가장 쉬운 도구다. 결함은 못 찾았으나 위험 노출이 가장 크다.

**3. 동일 KPI가 여러 곳에서 다르게 계산되는가?** 예 — CVR·ROAS(P1-001·002). 원인은
`dashboardVerdict.agg()`가 `metricRegistry`를 소비하지 않고 공식을 다시 적은 것.

**4. 가장 위험한 aggregation bug 가능성은?** 발견된 실제 결함은 없다. 구조적으로 가장
위험한 자리는 `mapRowsToStandard`의 **중복 표준키 덮어쓰기**(P2-001) — 합계가 조용히 줄어드는데
어떤 화면도 말하지 않는다.

**5. 데이터 입력/column mapping에서 silent error가 발생할 수 있는가?** 예 — 세 갈래:
중복 매핑(P2-001) · 유럽식 숫자(P1-003) · 모호 날짜(P3-001).

**6. 분석 결과와 recommendation이 모순되는가?** 문구 방향성(CPA↑=악화, CTR↑=개선)은
`dashboardVerdict`에서 지표별로 올바르게 분기하고, 공용 비교 함수에 방향이 다른 KPI를
밀어 넣는 패턴은 없었다. 모순은 **숫자 층**에서 발생한다(결론 카드 CVR/ROAS가 아래 KPI
카드와 다름). 근거 강도 표현(관찰/추론/가능성/인과)은 전반적으로 잘 지켜져 있다 —
"무유의 ≠ 효과 없음", DiD 사전추세 게이트, 매개분석 거절 등.

**7. statistical method 구현 오류가 있는가?** 구현 자체의 수학 오류는 못 찾았다. 오류는
**라우팅**에 있다(P0-001: 더 정확한 검정이 있는데 한 경로만 쓴다).

**8. 분석 결과와 Weekly Review/Report가 달라질 가능성이 있는가?** 예 — 결론 카드의
`export.csv`가 같은 잘못된 CVR·ROAS를 내보내므로 P1-001·002가 보고서까지 전파된다.
결정 스냅샷(`decisionReview` v11)은 관측을 덮어쓰지 않고 쌓는 구조라 그 자체는 건전하다.

**9. 브라우저 저장 데이터 migration 문제가 있는가?** (2026-09-16 갱신 — §C에서 실측)
결정 스키마 v9→v11 폴백, 손상 payload 내성, 원본 CSV 미저장 불변식은 **전부 견고했다**.
결함은 3건이었고 전부 같은 모양이다: **모르는 미래 값을 거절하지 않고 조용히 지나간다.**
미래 버전의 저장 동의를 그대로 믿었고(C-001), 모르는 변환을 건너뛰어 변환 안 된 표를
정상처럼 내보냈으며(C-002), 한 건 실패가 전체 복원을 죽였다(C-003). 셋 다 수정했다.

**10. 지금 배포 전에 반드시 고쳐야 할 것**
- **P0-001** (massReadout → Fisher 라우팅) — 배선 한 줄 수준, 위험 대비 비용이 가장 낮다.
- **P1-001** (결론 카드 CVR 분모 기준) — 한 줄.
- **P1-002** (결론 카드 코호트) — 파라미터 1개 + deps 1개.
- **P1-003** (파서 단일화)은 소비처가 15곳 이상이라 별도 PR 권장.

---

## C. 브라우저 저장 · migration 감사 (2026-09-16 추가)

1차 보고에서 **"미검증"**으로 남겼던 영역이다. 이번에 실제로 재현해 확인했다.

### 잘 되어 있던 것 (재현으로 확인)

| 검증 | 결과 |
|---|---|
| `persistPartialize`가 원본 CSV를 흘리는가 | ✅ 안 흘린다. `csvData`·`csvGroups`·`mappedRows` 전부 제외. 카나리 문자열로 확인 |
| 손상된 localStorage payload (`null`·문자열·숫자·불리언) | ✅ throw 없이 안전한 기본값 |
| `version`이 `NaN`·`undefined`·`null` | ✅ 안전 |
| 결정 레코드 오염 필드 (`episodes`가 객체·배열·숫자) | ✅ 레코드를 버리지 않고 필드만 정리. 여러 건 중 하나가 오염돼도 나머지 보존 |
| `status` 이상값 | ✅ `pending`으로 정규화 |
| 과도하게 긴 `id` | ✅ `FIELD_LIMITS`로 절단 |
| 결정 스키마 v9(구세대) → v11 | ✅ `actual`을 첫 관측으로 세우는 폴백 동작 |
| IndexedDB 저장 데이터셋의 스키마 드리프트 | ✅ 표를 저장하지 않고 **원본 blob을 다시 파싱**하고 헤더 수를 검증한다 — 설계가 자가 치유적이다 |
| 저장 실패 코드 (`QUOTA`·`BLOCKED`·`UNAVAILABLE`) | ✅ 분류돼 있고 5초 open 타임아웃까지 있다 |

### 찾은 결함 3건 (전부 수정)

#### [C-001 · P1] 미래 버전에서 되돌아온 payload의 저장 동의를 그대로 믿는다

**재현**: `persistMigrate({ decisionPersistenceEnabled: true, ... }, 6)` →
`decisionPersistenceEnabled: true`가 그대로 통과. version 99도 같다.

**왜 위험한가**: 이 코드는 **정확히 이 위험을 앞 방향으로는 이미 막고 있다.** v2~v4의
ON은 "결정 요약" 저장 동의였는데 v5에서 원본 CSV/XLSX까지로 범위가 넓어졌고,
`needsExpandedStorageConsent`가 그 소급 확대를 막는다. 그런데 **뒤 방향**(미래 버전이
쓴 payload를 옛 번들이 읽는 경우)은 무방비였다. Railway가 `main`을 자동 배포하므로
롤백은 실제 운영 경로이고, v6이 동의 범위를 또 넓혔다면 v5 번들이 그 동의를 **더 좁은
의미로 해석해 사용자가 동의한 적 없는 상태로** 동작한다.

**수정**: 미래 버전의 ON은 기존 확대 분기와 **같은 자세**로 처리한다 — 동의를 내리고
`preferenceSet=false`로 되물으며, 기존 기록은 종전 범위로 보존한다(동의를 되묻는
것이지 데이터를 버리는 게 아니다). 부수적으로 배열 payload가 인덱스 키(`{0:1,1:2}`)로
스토어를 오염시키던 것도 같이 막았다.

#### [C-002 · P1] 모르는 변환(transform)을 조용히 건너뛴다

**Location** `src/lib/workspace-storage/readTable.js:29`

**재현**: `transform: "long_to_wide"`(미래 값)인 레코드를 읽으면 `entry.transform === "wide_to_long"`
등식이 거짓이라 **아무 변환도 적용하지 않고** 표를 돌려준다. 바로 다음 줄의 헤더 수
검증은 변환 전 헤더 수와 비교하므로 **통과할 수 있다**. 즉 변환되지 않은 표가
정상인 것처럼 분석에 들어간다 — 거짓 숫자가 되는 가장 조용한 경로다.

**수정**: 모르는 transform은 `WORKSPACE_DATASET_UNKNOWN_TRANSFORM`으로 거절한다.
못 읽는 건 못 읽는다고 말하는 편이 틀린 표를 그리는 것보다 낫다(§8).

#### [C-003 · P2] 저장 데이터 한 건이 못 읽히면 전체 복원이 실패한다

**Location** `src/store/useDataStore.js` `restoreWorkspaceDatasets`

**재현**: `Promise.all`이라 한 건이 거부하면 나머지가 전부 버려지고
`workspaceRestoreStatus: "failed"`가 된다. 손상된 파일 하나가 멀쩡한 작업 전부를
가져간다. C-002 수정으로 거부가 더 자주 도달 가능해지므로 함께 고쳤다.

**수정**: 건별로 격리해 읽히는 것은 복원하고, 못 읽은 그룹을 `workspaceUnreadableGroups`에
남겨 `/storage` 화면이 "N건을 열지 못했다 — 손상됐거나 이 버전이 읽을 수 없는
형식"이라고 KR/EN으로 말한다(§2.11). 조용히 사라지게 두지 않는다.

### 남은 관찰 (수정 안 함)

- **저장 데이터셋 레코드에 스키마 버전 필드가 없다.** 지금은 원본 blob 재파싱 설계라
  실질 위험이 낮고, C-002로 모르는 변환은 거절하게 됐다. 다만 `sourceKind`·`series` 같은
  메타에 미래 값이 생기면 같은 종류의 조용한 오독이 가능하다. 버전 필드를 추가하려면
  **읽기 정책까지 함께 정해야 한다**(모르는 버전을 버릴 것인가, 읽어볼 것인가) — 제품
  결정이라 보고만 한다.
- **IndexedDB는 `WORKSPACE_DB_VERSION = 1`**이고 `onupgradeneeded`가 없는 스토어만
  만든다. 스토어 추가는 안전하지만 기존 레코드 **형태**를 바꾸는 변경에는 마이그레이션
  경로가 없다. 그때 필요한 것이 위의 버전 필드다.

---

## 이번 작업에서 실제로 한 것

### 1차 — 감사 (커밋 `a0775e5`, 수정 없음)
- `src/utils/__fixtures__/qaFixtures.js` — 재사용 픽스처
- `src/utils/kpiInvariants.test.js` — 21건. 골든 · 집계 불변식 · 변형검사 · 숫자 표기 계약

### 2차 — P0·P1 수정 (커밋 `eff9e14`)
- `massReadout`이 수동 경로와 같은 규칙으로 정확검정에 라우팅. 표에 "검정" 열 추가(KR/EN·CSV export 동반)
- `dashboardVerdict`가 `metricRegistry`(SSOT)를 소비하고 `cohort`를 받는다. `Dashboard`가 `selectedCohort`를 넘기고 deps에도 넣는다
- `src/utils/parseNumeric.js` — 숫자 해석 SSOT. 13곳의 자체 파서를 해석만 공유하고 폴백은 각자 유지하도록 전환
- `analysisConsistency.test.js` 21건 · `parseNumericSingleSource.test.js` 17건 (둘 다 소스에서 파생)

### 3차 — 저장 migration 수정 (§C)
- 미래 버전 동의 되묻기 · 모르는 변환 거절 · 건별 복원 격리 + `/storage` KR/EN 고지
- `src/store/storageMigration.test.js` 18건

**모든 수정은 일부러 되돌려 가드가 깨지는지 확인했다**(§7 — 가드를 만들면 실제로
부러뜨려 볼 것). 총 13건이 예상대로 실패했고 복원 후 전부 통과했다.

**검증**: `test:all` 4,015 passed / 0 failed · `lint` 0 · `build` 성공.

### 4차 — P2·P3 수정
- 중복 매핑 감지 → 어느 컬럼이 겹쳤는지 이름으로 고지(KR/EN)
- `ratio`의 분모 가드를 `den > 0`으로 — 음수 효율이 정렬 최상위로 올라오던 것 차단
- 예산 배분 모드 토글에 각 방식이 무엇을 보고 무엇을 안 보는지 고지(수학 불변)
- 모호한 날짜에 `ambiguous` 플래그 + 화면 고지(읽는 규칙 불변)
- `importDiagnostics.test.js` 10건

### 남은 것 (의도적으로 안 함)
- **저장 데이터셋 스키마 버전 필드** — "모르는 버전을 버릴 것인가 읽을 것인가"라는
  읽기 정책을 함께 정해야 하는 제품 결정이라 보고만 한다(§2.7).
- **예산 배분 모드 C의 배분 규칙 자체** — 모드 B가 별도로 있으므로 선언된 동작이다.
  수학을 바꾸는 것은 §11에 걸리고 어느 쪽이 기본이어야 하는지는 제품 결정이다.
- **중복 매핑의 덮어쓰기 동작** — 어느 컬럼이 맞는지는 사용자만 안다. 알리되 고르지 않는다.
