# 시스템 전체 감사 — UI/UX부터 분석까지 (2026-08-12)

> 대상: `v2-migration` 전체 (main = PR #658 `4932384` 시점)
> 목적: **신규 개선 필요 항목 발굴**. 과거 K-registry 이행 대조는 이번 스코프 밖.
> 원칙: 발견은 `조건 → 기대 → 실제`로 쓴다. 재현한 것만 "확인됨", 나머지는 "추정"으로 명시한다.
> 산출물: 이 리포트 + **전 항목 반영**(사용자 지시로 스코프 확장). 조치 결과는 §5.5.

---

## §0. 실측 스냅샷

게이트는 추정이 아니라 실제로 돌렸다.

| 항목 | 명령 | 결과 |
|---|---|---|
| 테스트 | `npm run test:all` | **229 파일 전부 통과 · 1,655 통과 · 1 skip** (202.4s) |
| 린트 | `npm run lint` | **exit 0** (경고·에러 0) |
| 빌드 | `npm run build` | **exit 0** |

| 규모 | 값 |
|---|---|
| 골든 테스트 파일 (`*.test.js`) | 150 |
| 스모크 테스트 파일 (`*.smoke.test.jsx`) | 79 |
| `src/` JS·JSX 파일 | 565 |
| `routeMap.js` 라우트 | 41 |
| 공개 분석 도구 | 13 (5-2·5-3·5-4·5-18·5-20·5-21·5-22·5-23·5-24·5-25·5-26·9-1·9-6) |
| 블로그 KO / EN | 38 / 38 (파일명 집합 동일) |
| 용어사전 KO / EN | 26 / 25 (차이는 `_TEMPLATE.md` 뿐) |
| `globals.css` | 8,848줄 |

**해석**: 세 게이트가 전부 green이다. 아래 P0 3건은 **게이트를 통과한 채 살아있는** 결함이다. 즉 이 감사의 핵심 메시지는 "테스트가 깨졌다"가 아니라 **"현재 안전망이 못 보는 축이 어디인가"**다.

---

## §1. 요약

| 심각도 | 건수 | 성격 |
|---|---:|---|
| **P0** | 3 | 화면에 **틀린 숫자**가 뜬다 |
| **P1** | 15 | 실질 UX 피해 · 정확성 위험 · 정직성/고지 누락 |
| **P2** | 12 | 죽은 코드 · 문서 드리프트 · 하드닝 |

### 가장 중요한 3가지

1. **천단위 콤마가 들어간 CSV를 올리면 전 도구의 숫자가 0이 된다** (P0-1). Excel·GA·대시보드 내보내기의 기본 형태다. AGENTS.md §7이 이 함정을 명시적으로 경고하고 있는데, 정작 **모든 도구가 공유하는 단일 진입점**에서만 방어가 빠져 있다. 재현 완료.
2. **레지스트리 커버리지 테스트가 하드코딩 목록을 돈다** (P1-3·P1-4). `toolOg.test.js`는 스스로 "모든 공개 도구"를 검증한다고 선언하면서 손으로 쓴 11개 배열을 순회한다. 빠진 2개가 정확히 검증에서도 빠졌다. **가드가 있다는 사실이 가드가 없다는 사실을 가리고 있다.**
3. **UI 계약이 "채택 완료" 주장과 어긋난다** (P1-9~P1-14). AGENTS.md §12.27은 결론 카드·다운로드 허브가 "공개 분석 도구 전체 채택 완료"라고 적혀 있으나 실제로는 2개 도구에 결론 카드가 없고, `.ab-pillgroup` 47곳 전부가 ARIA·키보드 계약 0이다.

세 가지의 공통 원인은 하나다 — **"한 곳에 추가하면 다른 곳도 고쳐야 한다"는 구조가 아직 남아 있고, 그 구조를 지키는 테스트마저 같은 방식으로 손으로 쓰였다.** AGENTS.md §7이 이미 "그 주석이 보이면 그게 곧 다음 버그다"라고 적어둔 그 패턴이다.

---

## §2. P0 — 화면에 틀린 숫자가 뜬다

### P0-1. 천단위 콤마 CSV → 전 도구 지표가 0

- **위치**: `src/utils/mappedRows.js:3-14`
- **조건**: 값에 천단위 콤마가 있는 CSV (`"72,341,057"`). Excel·GA4·대부분 광고매체 내보내기의 기본 형태.
- **확신도**: **확인됨** (아래 실행 결과)

`mapRowsToStandard`는 `cost↔spend` 별칭만 채우고 **숫자 정규화를 전혀 하지 않는다**:

```js
// src/utils/mappedRows.js:3-14
export function mapRowsToStandard(raw = [], mapping = {}) {
  return raw.map((row) => {
    const mapped = {};
    for (const [origKey, value] of Object.entries(row || {})) {
      const standardKey = mapping[origKey];
      if (standardKey && standardKey !== "__ignore__") mapped[standardKey] = value; // ← 문자열 그대로
    }
    if (mapped.cost != null && mapped.spend == null) mapped.spend = mapped.cost;
```

**재현 (대조군 포함)** — PapaParse → `mapRowsToStandard` → `calculateKPIs` 실제 실행:

```
[콤마 있음]        mapped.cost="72,341,057"  Number()=NaN
[콤마 있음]        KPI → cost=0  installs=0  cpi=null  ctr=null
[콤마 없음(대조군)] mapped.cost="72341057"    Number()=72341057
[콤마 없음(대조군)] KPI → cost=140461957  installs=4789  cpi=29330.12  ctr=0.034
기대(양쪽 동일): cost=140461957  installs=4789
```

**기대**: 두 CSV가 같은 결과. **실제**: 콤마가 있으면 총비용 ₩0, 설치 0, CPI "계산 불가".

이 함수는 `getMappedRows`가 감싸는 **모든 도구의 공통 진입점**이다. 확인된 하류 영향:

| 소비처 | 코드 | 증상 |
|---|---|---|
| `dashboardAggregator.js:139-144` | `Number(r[key])` → `isFinite ? val : 0` | 5-2 KPI 전부 0 |
| `satMath.js:142-143` | `Number(r.cost) \|\| 0` | 5-22가 전 행을 `cost<=0`으로 버려 "분석 불가" |
| `ltvMath.js` · `creativeMath.js` · `segmentMath.js` · `budgetAllocTool.js` · `cohortMath.js` | 동일 패턴 | 동일 |

**왜 골든이 못 잡았나**: `mappedRows.test.js`의 케이스가 `{Amount:"10"} → {cost:"10"}` **1건**뿐이다. 콤마·공백·통화기호 입력이 0건이다.

**주목할 점**: 정규화 함수는 **이미 존재한다**. `lib/data-import/normalizeValues.js:3` `normalizeNumericValue`가 콤마를 제거하고, `buildCanonicalDataset`은 이를 통과시킨다. 즉 `canonicalData`(정규화됨)와 `mappedRows`(raw)가 **두 갈래로 갈려 있고, 도구는 raw 쪽을 읽는다.**

- **수정 방향**: `mapRowsToStandard`에서 숫자 필드에 `normalizeNumericValue`를 적용(별칭 채움 직전 1회). 단일 지점 수정으로 44개 소비처가 동시 해결되고 P1-6·P1-8도 함께 사라진다. `mappedRows.test.js`에 콤마 골든 추가 필수.

---

### P0-2. 상수 종속변수 → `R² = -Infinity` + 조작된 유의확률이 화면에 렌더

- **위치**: `src/utils/regMath.js:193-198` (`REG_STATS.ols`)
- **조건**: 종속변수가 전 기간 동일(예: 매출 변동 없는 구간), 또는 `n === k`
- **확신도**: **확인됨**

```js
// src/utils/regMath.js:193-198
const df = n - k, sigma2 = RSS / df;                        // ← df<=0 가드 없음
const R2 = 1 - RSS / TSS,                                   // ← TSS>0 가드 없음
  adjR2 = 1 - ((1 - R2) * (n - 1)) / df;
const se = beta.map((_, j) => Math.sqrt(sigma2 * XtXi[j][j])); // ← Math.max(0,…) 없음
const tval = beta.map((b, j) => b / se[j]);                 // ← se=0 가드 없음
```

**재현**:
```
[상수 y]  R2 = -Infinity   adjR2 = -Infinity
          se = [6.48e-14, 1.66e-14]   pval = [1.06e-60, 1]
[n = k]   se = [Infinity, Infinity]   tval = [0, 0]   R2 = 1
```

**기대**: `null` 또는 "추정 불가". **실제**: `R² = -Infinity`가 화면에 표시되고, 더 나쁘게는 **`p = 1.06e-60`이라는 "극도로 유의함"이 조작되어 나온다.** 상수 종속변수에는 설명할 분산 자체가 없으므로 이 p값은 의미가 없다.

**같은 파일에 정답이 있다.** `mmmOls`(`regMath.js:8-53`)는 네 가드를 전부 갖췄다 — `if (n <= k) return null` · `sst > 0 ? … : 0` · `Math.sqrt(Math.max(0, …))` · `se[j] > 0 ? b/se[j] : 0`. **두 OLS의 방어 수준이 갈린다.**

- **수정 방향**: `mmmOls`의 가드 4줄을 `REG_STATS.ols`에 복사. 수학 불변(가드 추가만) → 골든 byte-identical 유지.

---

### P0-3. 공선성으로 릿지 정규화된 계수가 "정상 추정치 + 95% 예측 밴드"로 표시

- **위치**: `src/utils/regMath.js:178-186` (플래그 생성) → `src/utils/regForecastMath.js:243` (미확인)
- **조건**: 5-18 회귀+예측에서 완전공선 컬럼(예: `총지출` = `채널A` + `채널B`) 또는 전부-0 더미
- **확신도**: **확인됨**

`inv()`는 항등식 검증(`maxError > 1e-6`, `regMath.js:99`)으로 rank-deficiency를 **정확히** 잡는다 — AGENTS.md §7의 요구사항을 제대로 구현한 부분이다. 문제는 잡은 **다음**이다:

```js
// src/utils/regMath.js:179-186
let regularized = false;
try { XtXi = inv(XtX); }
catch (e) {
  regularized = true;
  for (let i = 0; i < k; i++) XtX[i][i] += 1e-8 * (XtX[i][i] || 1);  // 몰래 릿지
  XtXi = inv(XtX);
}
```

플래그는 `:249`에서 반환된다. 그런데 **전체 코드베이스에서 이 플래그를 확인하는 곳은 딱 한 군데다**:

```
src/components/tools/ContentElementAnalyzer.jsx:399   ✓ if (!res || res.regularized || …) return { error: "singular" }
src/utils/regForecastMath.js:243                      ✗ try { fit = REG_STATS.ols(…) } catch { … }  ← throw만 잡음
src/utils/regLabMath.js:265                           ✗ fit.R2로 람다 선택, 미확인
```

**재현** (`x₂ = 2x₁` 완전공선):
```
regularized = true
beta = [-0.02, 1.01, 0.505]
se   = [0.1923, 153.1118, 76.5559]
pval = [0.9237, 0.9952, 0.9952]
→ regForecastMath.js:243은 이 플래그를 확인하지 않고 ok:true + 95% 밴드를 반환
```

**정직한 관찰**: 이 경우 SE가 153·76으로 폭발해 p값이 0.99가 되므로, **유의성 판정 자체는 보수적으로 나온다.** 즉 "가짜 유의"가 뜨지는 않는다. 문제는 **계수와 95% 예측 밴드가 확정 숫자로 화면에 표시된다**는 것 — AGENTS.md §8.6 "식별 불가(공선)면 '추정≈0'은 *증거 없음*이지 *효과 없음* 아님"의 취지에 어긋난다. 사용자는 "추정 불가"를 봐야 하는 자리에서 숫자를 본다.

- **수정 방향**: `regForecastMath.js:243` 뒤에 `if (fit.regularized) return { ok:false, reason:"공선성으로 계수 식별 불가", n:nHist, k };` 한 줄. `regLabMath.js:265`도 동일.

---

## §3. P1 — 실질 피해 · 정확성 위험 · 정직성

### 분석·통계

#### P1-1. 5-23 통제군(홀드아웃) 탭이 신뢰구간·유의성 검정 없이 인과를 단정
- **위치**: `src/utils/incrMath.js:10-43` + `src/components/tools/Incrementality.jsx:334`
- **확신도**: 확인됨

`compute()`가 반환하는 것: `tRate·cRate·expected·incrementalConv·liftAbs·liftRel·incrementalRev·iroas·cpia`. **p값 없음, CI 없음, 표본수 없음.** 그런데 헤드라인은 확정형이다:

> `광고가 실제로 만든 증분 전환은 {N}건입니다 (iROAS {x}×)`

AGENTS.md §8.4("95% CI. 차트·패널에 표시")를 충족하지 않는다. **`STATS.twoPropZTest`가 `abTestMath.js:124`에 이미 있고 `ciLow95/ciHigh95`를 반환하는데 호출하지 않는다** (`Incrementality.jsx`에 `twoPropZTest` 참조 0건).

형제 도구와 비교하면 격차가 분명하다 — 5-24(`brandIncrementalityMath.js:398`)는 `ci95` + `NOT_IDENTIFIED` 세분 사유를 갖췄고, 5-23의 ②③ 전후 탭(`incrPrePostMath.js:63-130`)은 pre-trend 평행성 t-검정까지 한다. **①통제군 탭만 뒤처져 있다.**

- **재현 조건**: 홀드아웃 100명 중 3전환 vs 노출 10,000명 중 320전환 → 완전한 노이즈 범위인데 "증분 20건, iROAS 1.4×"가 확정 문구로 출력.
- **수정**: `STATS.twoPropZTest(cD, cN, tD, tN)`를 함께 호출하고 CI가 0을 걸치면 헤드라인을 "판단 보류"로.

#### P1-2. 계산 불가한 포화지수를 "포화"로 단정
- **위치**: `src/utils/satMath.js:23-29` · **확신도**: 확인됨

```js
function classify(satIndex, cfg) {
  if (satIndex == null || !isFinite(satIndex)) return "saturated";  // ← 미상 → 확정 판정
```

`satVerdictMeta("saturated")` → `{ label:"포화", advice:"증액 위험" }`. `satIndex == null`은 **계산 자체가 안 된 상태**인데 `Infinity`(진짜 포화 신호)와 같은 버킷으로 떨어진다. `satVerdictMeta(null)`에는 이미 정직한 `"—"/"분석 불가"` 분기가 `:205`에 있는데 **도달하지 못한다.**
- **수정**: `if (satIndex == null) return null;` — `!isFinite`(=Infinity)만 `saturated` 유지.

#### P1-3. 5-3의 차트 곡선과 배분 계산이 서로 다른 예측 함수를 쓴다
- **위치**: `src/components/tools/BudgetAllocation.jsx:320-334` vs `src/utils/budgetAllocTool.js:143,209,258` · **확신도**: 확인됨

차트는 `model.predict(x)`를 직접 호출하고(vertex clamp 없음), 배분 엔진은 `ALLOC_MATH.predictSafeCpr`(vertex + xMin/xMax clamp, `allocationMath.js:353-386`)를 쓴다.

- **조건**: Poly2 종모양(a<0) 적합에서 vertex가 `[xMin, xMax]` 안에 있을 때
- **기대**: 곡선과 추천이 같은 모델을 말한다. **실제**: 차트는 vertex 이후 CPR이 치솟는 곡선을 그리는데 배분 엔진은 vertex 값에 고정된 CPR로 계속 증액을 추천 → "곡선은 나빠지는데 왜 증액하라고 하나".
- AGENTS.md §7의 `.model.predict` vs 래퍼 함정과 **같은 클래스**다. 다만 이번엔 `undefined`가 아니라 *다른 값*이라 더 잡기 어렵다.

#### P1-4. `satMath`/`MarketingEfficiency` 래퍼가 `xMin`을 빠뜨려 하한 clamp가 죽어 있다
- **위치**: `src/utils/satMath.js:54` · `src/components/tools/MarketingEfficiency.jsx:189` · **확신도**: 확인됨 (잠복)

```js
const chWrap = { model, poly2Shape, xMax };   // xMin 누락
```
`predictSafeCpr`는 `if (ch.xMin != null && evalCost < ch.xMin)`(`allocationMath.js:378`)로만 하한을 막는다. 주석(`:375-377`)이 "xMin 하한이 없으면 Log/Power/Poly2가 발산·음수로 튀어 predict(xMax) 폴백으로 스케일이 뒤바뀜"이라고 명시했는데 **정작 5-22가 그 필드를 안 넘긴다.** `budgetAllocTool.js`는 5곳 전부 넘긴다 — 배선 비대칭.
현재는 `currentCost ∈ [xMin, xMax]`라 실사고는 안 나지만 잠복 상태. `satMath.js:42`가 이미 `xMin`을 계산해 놓고 리턴 객체에만 넣는다.

#### P1-5. A/B 도구만 콤마를 못 읽어 **원인을 틀리게 진단하는** 에러 메시지를 띄운다
- **위치**: `src/components/tools/AbTestHoldout.jsx:44-47` · **확신도**: 확인됨

```js
// AbTestHoldout.jsx:44   ✗
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

// Incrementality.jsx:21  ✓
const num = (v) => { …; const n = Number(String(v).replace(/[,\s]/g, "")); … };
```
결과: `readoutData.invalidRows`가 전 행을 무효로 잡아 **"전환수는 0 이상 분모 이하여야 합니다"**를 띄운다. 데이터는 멀쩡한데 사용자는 자기 숫자가 틀렸다고 안내받는다. (P0-1과 같은 뿌리, 다른 표면.)

#### P1-6. `/start` 라우터는 콤마-safe, 실제 도구는 콤마-unsafe → "가능"인데 빈 화면
- **위치**: `src/lib/analysis-router/vifReadiness.js:3-4`(`normalizeNumericValue` 사용 ✓) vs `satMath.js:142`·`budgetAllocTool.js:76`(`Number(r.cost) || 0` ✗) · **확신도**: 확인됨
- `/start`가 "이 CSV로 5-22·5-3 분석 가능"이라고 추천 → 도구 진입 시 전 행이 걸러져 빈 화면. **읽기/쓰기 경로 비대칭.** P0-1 수정 시 자동 해소.

### 구조 정합성

#### P1-7. 9-6 소재 분석의 CSV 가이드 패널이 **아예 렌더되지 않는다**
- **확신도**: **확인됨** (실행 검증)

체인:
```
ContentFreshness.jsx:9      → <CreativeAnalyzer domain="performance" />
contentDomain.js:219        → uploaderToolId: "5-6"
CreativeAnalyzer.jsx:797    → <CsvUploader toolId={C.uploaderToolId} analyticsToolId="9-6" />
ds/CsvGuide.jsx:64          → const guide = getToolGuide(toolId); if (!guide) return null;
toolGuide.js:577-580        → return TOOL_GUIDE[toolId] || null;   // 별칭 없음
```
실행 결과:
```
getToolGuide('5-6') = null
getToolGuide('9-6') 존재? = true
```
`TOOL_GUIDE`·`TOOL_GUIDE_EN`에 `"9-6"` 키만 있고 **`"5-6"` 키는 없다**(`toolGuide.js:234`, `:515`).

- **기대**: `/content/freshness`에서 "CSV 변경" 후 필수 컬럼 목록 + "예시로 실행" 버튼. **실제**: 드롭존과 구글시트 박스만. 작성된 KO+EN 가이드 카피 ~70줄이 도달 불가.
- **왜 안 잡혔나**: `CsvGuide.smoke.test.jsx`가 `5-2`와 `5-18`만 렌더한다.

#### P1-8. `llms.txt`의 **한국어 운영가이드 섹션이 0건**, 영어는 15건
- **확신도**: **확인됨** (빌드 산출물 `.next/server/app/llms.txt.body` 직접 확인)

```
## Operating guides — Korean
                                    ← 항목 0개
## Practical articles — Korean

## Operating guides — English
- [Apple Search Ads (ASA) Operations Manual](…/en/guide/apple-search-ads): …
- [App Store Optimization (ASO) Basics](…)
  … 15건 전부
```

원인: `app/llms.txt/route.js:43-58`이 `readSopData(route.id, locale)?.title`로 필터하는데, `lib/sopData.js:7`은 KO에 대해 `${routeId}.json`만 찾는다. 실제 파일:
```
public/content/pages/ → KO json 2개(1-1, 8-1) / EN json 15개 전부
```
KO 가이드는 `SopContent.jsx`의 인라인 JSX에서 렌더되므로 화면은 멀쩡하지만, **LLM·AI 검색 진입면에서는 한국어 가이드 15개 중 13개가 존재하지 않는 것으로 보인다.** KR이 주 시장인 제품에서 EN만 온전한 역전 상태.
- **수정**: `guideEntries("ko")`에서 KO JSON이 없으면 IA의 `findMeta(route.id).title`로 폴백.

#### P1-9. 커버리지 가드 테스트가 **하드코딩 배열**을 돌아, 빠진 것을 못 잡는다
- **확신도**: **확인됨** (실행 검증)

```
[공개 도구 id] 5-2, 5-3, 5-21, 5-22, 5-4, 5-18, 5-20, 5-23, 5-24, 5-25, 5-26, 9-1, 9-6
[TOOL_OG_CONFIG 누락]     = 5-25, 5-26
[ITEM_KEYWORDS 누락]      = 5-24, 5-25, 5-26
[ITEM_KEYWORDS_EN 보유]   = 5-2, 5-21, 5-22, 5-3, 9-6, 5-4, 5-23, 5-18, 5-20  (5-24·5-25·5-26·9-1 누락)
```

가장 뾰족한 부분: `src/lib/toolOg.test.js:4`가
```js
const TOOL_IDS = ["5-2","5-3","5-4","5-18","5-20","5-21","5-22","5-23","5-24","9-1","9-6"];
```
를 순회하면서 테스트 이름은 *"uses a unique visual signature for **every published tool**"*이다. **빠진 2개가 정확히 검증에서도 빠졌다.**
`pageKeywords.js`는 테스트가 **아예 0건**이다(`grep -rn "ITEM_KEYWORDS" src --include=*.test.js` → 무결과).

- **영향**: 5-25·5-26은 도구별 OG 카드 대신 generic `/og-card.png`를 쓰고, `SoftwareApplication` JSON-LD의 `featureList`가 빈 배열. 4개 도구 페이지가 브랜드 일반 키워드만 싣는다.
- **수정**: 테스트가 `ROUTES.filter(isRoutePublished)`에서 목록을 **파생**하도록. 이건 AGENTS.md §7 "목록을 두 곳에 나열하지 말 것 — 파생시켜라"의 테스트 버전이다.

#### P1-10. 최신 도구 5-26에 전용 스모크가 없고, 있는 테스트는 진입 경로를 우회한다
- **확신도**: 확인됨
- `AsaKeywordFinder.smoke.test.jsx` 없음 (다른 도구는 전부 있음). 공유 스위트 2곳에서만 마운트되는데 둘 다 `useAppStore.setState({...})`로 슬라이스를 직접 주입한다.
- ARCHITECTURE.md:130이 경고한 바로 그 패턴 — "`beforeEach`가 store 슬라이스를 직접 주입하면 실제 진입 경로를 우회한다 … 5-24 사고". `setCurrentRouteId("5-26")` → 미러 스왑 경로가 한 번도 실행되지 않는다.

### 정직성 · 고지

#### P1-11. WebR 고급 분석의 제3자 요청이 개인정보처리방침에 미고지
- **위치**: `src/lib/analysis/webr/webRClient.js:12,36` vs `src/app/(ko)/privacy/page.js` · **확신도**: 확인됨

```js
const { WebR } = await import("webr");     // :12  R/Wasm 런타임 외부 로드
await runtime.installPackages(missing);    // :36  R 패키지 외부 다운로드
```
개인정보처리방침의 4개 섹션(업로드 데이터 / 브라우저 저장 / 방문 통계와 광고 / 이메일 구독) 어디에도 WebR 언급이 없다.

**중요 — 과장 금지**: 사용자 CSV는 전송되지 않는다. 기존 카피("CSV 원본은 서버로 전송되지 않습니다")는 **참이다.** 문제는 거짓말이 아니라 **"고급 분석을 실행하면 제3자에서 실행 런타임을 받는다"는 사실의 미고지**다. 사내 민감 데이터를 다루는 마케터가 네트워크 정책을 판단할 근거가 없다.

#### P1-12. 비-EEA 사용자에게 계측 opt-out 경로가 없다
- **위치**: `src/lib/consent.js:16-22, 26-35` · **확신도**: 확인됨
- `consentDefaultSnippet()`이 `region: EEA_UK_REGIONS`에만 기본 거부를 걸고 그 외는 `granted`로 시작. 배너도 `looksEeaVisitor()`가 참일 때만 노출.
- **주 타겟인 KR 사용자는 배너를 보지 못하고 opt-out UI도 없다.** 법적 요구는 아니다(구현 자체는 Consent Mode v2를 서버 없이 푸는 영리한 방식이고 잘 만들어졌다). 다만 "데이터 민감도 = 사내 민감 자료"를 표방하는 제품의 자기 기준과는 어긋난다.

### UI/UX

#### P1-13. 상태 색상이 raw hex라 **라이트 모드에서 대비가 무너진다**
- **위치**: `src/app/globals.css` (`#5ad19a`×12, `#ff8a8a`×14, `#f7b955`×23 = 49곳) · **확신도**: 확인됨

같은 CSS 블록 안에서 규칙이 갈린다:
```css
1749:  .map-status.ok            { color: #5ad19a; }        /* raw hex */
1755:  .map-status.warn          { color: #f7b955; }        /* raw hex */
1764:  .map-status.must_confirm  { color: var(--danger); }  /* token */
```
`--success`/`--danger`/`--warning`은 **라이트 모드 오버라이드를 갖고 있다**(`globals.css:109-111`, `:4868` `--success:#11866e`). raw hex는 없다. `#5ad19a`를 라이트 배경(`#fff`)에 올리면 대비 ≈1.9:1로 WCAG AA(4.5:1) 미달.
같은 문제가 디자인시스템 컴포넌트에도 있다 — `ds/AnalysisStatusBadge.jsx:8-10`의 `ANALYZING`/`COMPLETE`/`STALE`이 `#e0af68`·`#5ad19a`를 토큰 폴백 없이 쓰고, 같은 파일 `READY`/`BLOCKED`/`FAILED`는 `var(--primary, …)` 형태다. **`ds/`는 다른 도구가 베끼는 기준이라 전파 위험이 있다.**

#### P1-14. 차트 팔레트 하드코딩 → 테마 전환 시 색이 따라오지 않는다
- **위치**: `CreativeAnalyzer.jsx:648` · `AhaMomentFinder.jsx:803,846,1574,1636` · `LtvTab.jsx:533` · **확신도**: 확인됨
```js
// CreativeAnalyzer.jsx:648
const palette = ["#adc6ff", "#22c55e", "#f87171", "#fbbf24", "#a78bfa"];
```
이 값들이 `borderColor`/`backgroundColor`로 직행하므로 `refreshMountedChartThemes()`(`chartUtils.js:125`)의 갱신 대상에서 빠진다. AGENTS.md §12.3의 `CHART_THEME` getter 규약 이탈.
(참고: `satMath.js:202-205`의 `satVerdictMeta`도 하드코딩 hex를 **엔진에서** 반환한다 — 표시색이 순수 엔진에 들어간 케이스.)

#### P1-15. 세그먼트 컨트롤 47곳 전부가 ARIA·키보드 계약 0
- **위치**: `.ab-pillgroup` 47곳 (`MarketingResponse` 14 · `LtvTab` 7 · `CampaignPvm` 6 · `PacingTab`/`SegmentTab`/`FunnelTab` 3씩 …) · **확신도**: 확인됨
```
className="ab-pillgroup" 총 47곳 / role= 을 가진 곳 0
```
claude-ux.md §1.1이 명시적으로 관장하는 지표·기간·모델 선택기다. 마우스로는 동작하지만 키보드 화살표 이동·스크린리더 그룹 인식이 없다.

**같은 저장소 안에 정답이 있다** — `WebRMmmAdvanced.jsx:498,561-568`과 `WebRRandomForestPanel.jsx:122,148-155`가 `radiogroup`/`radio` + Arrow/Home/End를 정확히 구현했다. 패턴을 뽑아 47곳에 적용하면 된다.

관련 ARIA 계약 결함 2건:
- `dashboard/DashboardTabs.jsx:77-82` — `role="tablist"` > `role="group"` > `role="tab"`. 중간의 `group`이 소유 체인을 끊어 보조기술이 9개 탭을 탭으로 인식하지 못한다. (**단, 로빙 tabindex와 화살표 키는 정상 구현돼 있다** — 구조 문제지 조작 불가는 아니다.)
- `DiagnoseRouter.jsx:176-186` — `role="radio"` 버튼들이 `radiogroup` 부모 없이 맨 `<div>` 안에. CSV 없이 들어오는 진입 퍼널이다.

#### P1-16. `title=` 단독 어포던스 — claude-ux.md가 **이름을 지목해 금지한** 함정이 12곳 이상 생존
- **확신도**: 확인됨
- `.ab-pillgroup-label`(`globals.css:3300-3306`)에 `cursor:help`도 `border-bottom:1px dotted`도 없다. 이 클래스에 `title`을 단 곳: `BudgetAllocation.jsx:1792,1800,1808,1817,1826,1834,2888` · `MarketingResponse.jsx:3722,3754,3795` · `LtvTab.jsx:381` · `CohortTab.jsx:336`.
- 맨 span: `CreativeAnalyzer.jsx:1266`(`설명력(R²)`의 정의가 `title`에만), `:1666-1668`(범례 칩 3개), `FunnelTab.jsx:320`, `SeasonalityTab.jsx:263`(히트맵 셀의 연도·기간이 `title`에만 → 키보드·터치로 도달 불가).
- `Header.jsx:191` — **로드된 CSV 파일명**(어떤 데이터인지 확인하는 유일한 지점)이 `title`에만.
- claude-ux.md §0: *"실사용에서 확인된 함정"*이라고 못박은 항목이다. 정답 패턴도 이미 있다 — `MarketingResponse.jsx:3783`·`VizTab.jsx:925`의 `ⓘ` + `cursor:help` + `tabIndex="0"` + `aria-label`.

#### P1-17. §12.27 "전 도구 채택 완료" 주장과 실제가 다르다
- **확신도**: 확인됨
```
PaidOrganicTrend.jsx        ResultActionCard=0  download=0
WebRMmmAdvanced.jsx         ResultActionCard=0  download=0
ContentElementAnalyzer.jsx  ResultActionCard=2  download=0
MulticollinearityChecker.jsx ResultActionCard=2  download=0
```
claude-ux.md §6의 "상세 문서 받기" 탈출구는 14개 공개 도구 중 **2개**(`AhaMomentFinder.jsx:1714`, `MarketingResponse.jsx:4449`)에만 있다.
AGENTS.md §12.27은 "**공개 분석 도구 전체 채택 완료**"라고 적혀 있다 — **하네스가 사실과 다른 상태를 완료로 기록하고 있다.** AGENTS.md §15의 "틀린 규칙은 없는 규칙보다 해롭다"에 해당.

---

## §4. P2 — 죽은 코드 · 문서 드리프트 · 하드닝

| # | 항목 | 위치 | 근거 |
|---|---|---|---|
| P2-1 | `rrMultiverse.js`(665줄)가 자기 테스트에서만 참조 | `src/utils/rrMultiverse.js` | 앱 경로 참조 0. `docs/rr-multiverse-*.md` 6건이 이 모듈 전제로 잔존 |
| P2-2 | `regLabMath.js`(311줄) 전 export가 자기 테스트에서만 참조 | `src/utils/regLabMath.js` | 그런데 **ARCHITECTURE.md:88이 이를 라이브 엔진으로 명시** — 문서가 없는 의존성을 주장 |
| P2-3 | `lib/dateFilterContract.js` 참조 0 | — | 동일 검증 |
| P2-4 | `LocaleAutoRedirect.jsx`가 한 번도 렌더되지 않음 | `src/components/LocaleAutoRedirect.jsx` | 저장소 전체에서 정의부와 `localePref.js:2` 주석 언급뿐. 문서화된 "KR 홈 언어 자동 감지"가 무동작 |
| P2-5 | 삭제된 도구 id 9개의 필드 계약 ~150줄 잔존 | `csvConstants.js:1022-1083, 1241-1364` | `5-5·5-8~5-14·5-16` 각각 이 파일에서만 매치 |
| P2-6 | `content_freshness` 데모 빌더 고아 | `demoData.js:669-763, :838` | `DATA_GROUPS`(파생)에 없어 `demoData.test.js`도 못 돈다 |
| P2-7 | 한 라우트가 두 도구 id를 보고 | `CreativeAnalyzer.jsx:797` vs `:930` | 업로드 이벤트는 `9-6`, 다운로드·매니페스트는 `5-6`. 결과물이 존재하지 않는 라우트 id에 귀속 |
| P2-8 | `CUSTOM_TOOL_INTRO_IDS`가 두 PageClient에 동일 복제 | `(ko)…:46`, `(en)…:42` + `ToolIntro.jsx:3-43` | 지금은 일치하나 전형적 2-places-1-list |
| P2-9 | AGENTS.md §4.2 도구표에 **5-25·5-26이 아예 없음** | `AGENTS.md` | 파일 전체에서 `5-25`/`5-26` 매치 0. §4.3 격리 그룹 목록에도 `collinearity`·`asa_keyword` 누락 |
| P2-10 | AGENTS.md §16 "183파일·1257 통과" | `AGENTS.md` §16 | 실측 **229파일·1655 통과** |
| P2-11 | `docs/code-health-audit.md` 전체가 삭제된 레거시 앱 전제 | `docs/code-health-audit.md` | "단일 `index.html` 28,474줄"·`validate.js`·`runXxxTests` 기준 서술. AGENTS.md §13이 여전히 참고 파일로 안내 |
| P2-12 | ARCHITECTURE.md 드리프트 | `:104`, `:88`, 라우트표 | `content_freshness` 잔존(실제 13그룹), `regLabMath` 라이브 주장, `/growth-funnel` 누락 |

### 하드닝 (엔진, 잠복)

| # | 위치 | 내용 |
|---|---|---|
| H-1 | `pacingMath.js:30,65` · `funnelMath.js:40,69` | `new Date("2026-08-12")`는 UTC 파싱인데 `getDay()`는 로컬. 주석은 "getUTCDay와 동일"이라 적혀 있으나 코드는 `getDay()`. `anomalyMath.js:20,50`은 올바르게 `getUTCDay()` — 파일 간 불일치. KST에선 무해, UTC 이서 타임존에서 요일 하루 밀림 |
| H-2 | `creativeMath.js:150-152` | `wlsSolve`가 null이면 `r2=0` → **VIF=1("완전 깨끗")**. 식별 불가를 "문제 없음"으로 뒤집는다. `modelDiagnostics.computeVif:147-157`은 `null`+`verdict:"severe"`로 정직 — 두 VIF 구현의 정직성이 갈린다 |
| H-3 | `anomalyMath.js:53-55` | 기대값은 요일승수 보정(`expected = ema * m`)인데 분산 `emaVar`는 미보정 원계열 → z가 요일 변동만큼 왜곡 |
| H-4 | `ltvMath.js:12-14, 44-63` | 관측점 2개로 D360까지 외삽하면서 CI·밴드 없음. `predicted:true` 플래그는 있으나 불확실성 수치가 없다(§8.4) |
| H-5 | `segmentMath.js` | 세그먼트 승패 판정에 검정·CI·최소표본 게이트 없음. 소표본 셀이 "최고 CPA"로 뽑힐 수 있음 |
| H-6 | `dashboardVerdict.js:11` | `const SIG = 0.05; // 유의미한 변화 임계(±5%)` — 검정이 아니라 크기 임계인데 "유의"라는 통계 함의 단어 사용. "주목할 만한 변화"로 |
| H-7 | `incrMath.js:105-109` | `computeMetricVerdict`의 3·4번째 분기가 아래 기본값과 동일한 `"inconclusive"` 반환(죽은 분기). 결과는 정직한 방향이나 "두 방법 불일치" 구분 의도가 소실 |
| H-8 | `mmmMath.js:3023` | `const d = A[c][c] || 1e-9` — 절대 pivot 대체. λ≥0.5 릿지라 PD가 보장돼 실위험은 낮으나, `creativeMath.inverse`의 항등식 검증과 방어 수준이 갈림 |
| H-9 | `dashboardAggregator.js:118-119` | 날짜 필터가 정규화 없는 문자열 비교. 차원 필터 4축은 이미 `.trim()`으로 대칭 맞춰졌는데(`DashboardFilterBar.jsx:118-120`) **날짜만 예외**. 혼합 날짜 형식에서 조용히 행 소실 |
| H-10 | `webRClient.js:33-38` | `installedPackages`가 모듈 전역 Set. 런타임이 교체되면 스테일 엔트리가 재설치를 건너뛴다. 현재는 init 실패 시에만 교체되고 그땐 Set이 비어 있어 잠복 |

---

## §5. 문제 아님 — 이미 잘 된 것 (과장 방지)

감사가 결함만 나열하면 우선순위를 왜곡한다. 아래는 **확인 결과 건강한** 축이다.

### 통계적 정직성 — 이 축은 신규 발견 0

"무유의 ≠ 효과 없음"이 KO/EN 양쪽에 일관 배선돼 있다. `"효과 없음"` 단정 grep 결과 **위반 0건**, 오히려 반대 방향 명시가 다수:
- `AbTestHoldout.jsx:917` "비유의는 효과 없음의 증명이 아니라 현재 표본에서 판정 보류"
- `marketingResponseModel.jsx:1931-1932` ABSTAIN 정의 + **검정력 게이트로 강제 ABSTAIN**
- `ContentElementAnalyzer.jsx:142` "not significant ≠ no effect"
- `MarketingResponse.jsx:6128` 관측범위 밖 clamp를 "포화나 무효과를 뜻하지 않는다"고 명시
- `toolSearchContent.js:226,242,431,447` FAQ 레벨까지 KO/EN 동시

### 엔진

- **`Math.random` 0건.** MMM posterior도 `_mmmHashSeed(JSON.stringify(...))` 데이터 해시 시드, WebR RF는 `set.seed(20260811)`, glmnet은 시간순 fold. §8.3 결정론 완전 준수.
- **행렬 역행렬 rank 검증이 규칙대로 구현됨.** `creativeMath.js:65-76`·`regMath.js:91-99`가 `maxErr>1e-6 → null/throw`. **AGENTS.md §7의 1e-12 pivot 함정은 해결된 상태.** 골든도 있다(`runCreativeTests.test.js:301`).
- **로그-스페이스 완비.** `abTestMath.js:215-256` — Cook(2005) 정수 Beta 정확합, Lanczos `logGamma`, max 차감 후 exp 정규화, `shapes>80` 정규근사.
- **`abTestMath` 방어가 모범적.** `xA>nA` 거부, 대조군 0전환을 "0% lift"로 위조하지 않음, `ok:false` 5중 게이트, Holm step-down. 전부 95% CI 동반.
- **`incrPrePostMath`가 인과 조건을 실제로 검증.** pre-trend 평행성 t-검정 → 위반 시 `NOT_IDENTIFIED`로 DiD 거부. **날짜로 짝짓기**(인덱스 짝짓기 금지). DiD 유의성을 `(처리−대조) 일별 차이`로 계산해 공통 계절성 누수 차단.
- **`brandIncrementalityMath`(5-24)가 가장 엄밀.** `NOT_IDENTIFIED` 사유 4종 세분 + `ci95` + HAC 소표본 보정.
- **`modelDiagnostics.js` 전면 정직.** 계산 불가 시 `"unknown"`, 비유한 VIF는 `null`+`"severe"`, "Q-Q는 시각 증거"라며 자동 정규성 배지를 **일부러 안 만든다**.
- **`metricRegistry`가 0-나눗셈 SSOT.** `den ? (num/den)*mult : null` — "계산 불가를 null로"가 계약으로 명시.
- **`computeWeightedRetention`이 과거 사고를 전부 흡수.** 비율/인원 자동 판별, 0%와 결측 구분, 스프레드 RangeError를 reduce로 회피.

### 구조

- **라우트/ID 정합성 완전.** 39개 주 라우트 중 KO 미디스패치 0 · EN-ready인데 EN 케이스 없는 id 0 · IA에 있는데 ROUTES에 없는 id 0 · routeMap 5-/9- 중 `TOOL_GROUP` 누락 0. `SopContent` 폴백 누수 없음.
- **그룹 맵 3종이 진짜 파생.** `csvGroups`·`analyzedByGroup`·`dashboardFilterGroups` 전부 `buildGroupMap()` 경유 + `useDataStore.test.js:310-327` 구조 가드. **CSV를 쓰는 모듈 전부가 등록된 그룹을 가리킨다** — PR #604/#608 계열 사고 재발 없음.
- **콘텐츠 KR/EN 대칭.** 블로그 38/38 파일명 집합 동일, `draft:true` 집합도 동일. 공개 도구 13개 전부 KO+EN 롱폼(`toolSearchContent.test.js:60-68`이 강제).
- **SEO 파생 완전.** `sitemap.js`·`rss.xml`·`llms.txt` 전부 `isRoutePublished()`+발행 콘텐츠에서 파생, 개수 하드코딩 없음. `next.config.mjs` 리다이렉트 15건 전부 목적지 실재, 출발지 잔존 0, 죽은 슬러그 참조 0.
- **코드 분할 정상.** `PageClient.jsx:26-47`이 전 도구를 `next/dynamic`으로 분할. 콘텐츠 페이지 번들 누수 없음.
- **EN 라우트 한글 누출 없음** (PR #645 조치 유효). **광고 잔재 완전 제거** — `ProductPreview`·`ToolCarousel`·`AdInterstitial`·`adGate`·`supabase` 전부 매치 0. `src/` 전체 TODO 1개.
- **CI 게이트 정상.** PR·main push마다 `test:all`+`lint`+`build`.

### UI/UX — 이미 정답인 참조 구현

| 패턴 | 참조 위치 |
|---|---|
| 탭 계약 (id+`aria-controls`+로빙 tabindex+키보드+panel `aria-labelledby`) | `Incrementality.jsx:174-197`, `AbTestHoldout.jsx:380-388` |
| `radiogroup`/`radio` + Arrow/Home/End | `WebRMmmAdvanced.jsx:498,561-568`, `WebRRandomForestPanel.jsx:122,148-155` |
| 0px 캔버스 함정 처리 | `BudgetAllocation.jsx:2677`, `MarketingResponse.jsx:3314-3321`, `ScorecardTab.jsx:337-339` |
| 툴팁 어포던스 (`ⓘ`+`cursor:help`+`tabIndex`+`aria-label`) | `MarketingResponse.jsx:3783`, `VizTab.jsx:925` |
| CSV live region (양 분기 첫 자식 유지) | `CsvUploader.jsx:647,776` |
| 랜딩 §12.28 준수 | 1단 히어로·`.dc-instrument` 없음·질문형 카드가 주간 루프보다 앞·전 카드행 `repeat(N,minmax(0,1fr))`·유저수 날조 없음 |
| 진입 모션 안전장치 | `globals.css:6653-6672` — `opacity:0`이 JS가 붙이는 `.is-motion-armed`에만 걸림 + `prefers-reduced-motion` 이중 안전 |
| 결론 카드 2층 계약 | `ds/ResultActionCard.jsx:276-289` — **프리미티브 자체는 잘 만들어졌다. 갭은 채택률이지 설계가 아니다.** |

---

## §5.5 조치 결과 (2026-08-12, 같은 브랜치)

이 리포트 작성 후 **전 항목 반영**을 지시받아 아래 순서로 수정했다. 각 커밋은
`test:all`·`lint`(필요 시 `build`) green 상태에서만 올렸다.

| 커밋 | 반영 | 비고 |
|---|---|---|
| `86fadd8` | P0-1·P0-2·P0-3 · P1-1~P1-6 | 숫자 파싱 단일화, 회귀 가드, 증분 CI |
| `5a4f63f` | P1-7·P1-8·P1-9·P1-10 | 커버리지 가드를 파생으로 전환 |
| `fb51b74` | P1-13·P1-14·P1-15(일부)·P1-16 | 상태색 51곳 토큰화, ARIA 계약, `ds/PillGroup` 신설 |
| `4aaf777` | P1-11·P1-12 · P2 죽은 코드 · H-1·H-2·H-6 | 제3자 요청 고지, 계측 opt-out |

**작성 당시보다 심각했던 것**
- P1-7은 "가이드 키 누락"이 아니라 **도메인 문구 불일치**였다. 등록돼 있던 `9-6`
  항목은 콘텐츠 도메인 문구인데 라우트는 소재(performance) 도메인을 렌더한다 →
  소재용 `5-6` 가이드를 KO·EN 신설해야 했다.
- P1-8은 "KO 2건 vs EN 15건"이 아니라 **KO 0건**이었다. KO SOP JSON에는 `title`
  필드 자체가 없다. 빌드 산출물로 확인(수정 후 KO 15 / EN 15).
- 새 커버리지 테스트가 작성 즉시 리포트에 없던 5-23·5-24 계약(서브키·자체 dropzone)을
  드러냈다 — 파생 가드의 효과를 그 자리에서 보여준 사례.

**작성 당시보다 가벼웠던 것 (정정)**
- P0-3의 공선 케이스는 SE가 폭발해(153·76) p≈0.99가 나오므로 **가짜 유의는 뜨지
  않는다**. 문제는 계수·95% 밴드가 확정 숫자로 보이는 것. 리포트 본문에 이미
  명시했고 수정도 그 범위로 했다.
- P1-15의 `DashboardTabs`는 로빙 tabindex·화살표 키가 **이미 정상**이었다.
  결함은 ARIA 소유 체인뿐이라 조작 불가는 아니었다.
- 리포트가 언급한 `ResultActionCard` 제목 KO 누출(§4 P2 후보)은 **실제 누출이 아니다**.
  커스텀 제목을 넘기는 4개 도구가 전부 `tr`/`tx`로 번역해 넘긴다. 계약이 취약할 뿐.

**후속 반영 (2026-08-12)**
- **P1-15 나머지**: `LegacyPillGroupA11y` 호환 어댑터로 나머지 legacy `.ab-pillgroup`
  46곳에 radiogroup·roving tabindex·화살표/Home/End 키 계약을 일괄 적용했다. 복잡한
  조건부 버튼·disabled 계산은 그대로 보존하며, 새 화면만 `ds/PillGroup`을 직접 사용한다.
- **P1-17**: `PaidOrganicTrend`·`WebRMmmAdvanced`에 결론 카드를 추가하고,
  `ContentElementAnalyzer`·`MulticollinearityChecker`에는 각 분석 CSV 다운로드를
  `DownloadHub`로 연결했다. `ResultActionCard`에는 상세 분석 문서 다운로드를 추가해
  결과 카드를 사용하는 공개 분석 도구에 같은 탈출구를 제공한다.
- **H-3·H-4·H-5·H-7·H-8·H-9·H-10**: 잠복 위험이라 재현이 안 됐고, 일부는 엔진 수학
  변경을 수반한다(§11). 리포트에 근거를 남겨 별도 판단 대상으로 둔다.

---

## §6. 다음 작업 후보 (PR 단위)

각 항목은 독립 PR로 쪼갤 수 있게 묶었다. 실행은 이 리포트 범위 밖.

| # | PR 후보 | 포함 | 근거 |
|---|---|---|---|
| 1 | **숫자 파싱 단일화** | P0-1 · P1-5 · P1-6 | `mapRowsToStandard` 한 곳 + 콤마 골든. 44개 소비처가 동시 해결되고 P1 2건이 함께 사라진다. **가장 높은 효과/노력 비** |
| 2 | **회귀 엔진 가드** | P0-2 · P0-3 | `mmmOls`의 가드 4줄 복사 + `regularized` 전파 1줄. 전부 *가드 추가*라 골든 byte-identical |
| 3 | **커버리지 가드를 파생으로** | P1-9 | 테스트가 `ROUTES.filter(isRoutePublished)`에서 목록을 뽑도록. 고친 뒤 5-24·5-25·5-26 엔트리 추가. **이 PR이 다음 도구의 같은 사고를 막는다** |
| 4 | **9-6 가이드 복구 + llms.txt KO** | P1-7 · P1-8 | 사용자에게 바로 보이는 결손 2건 |
| 5 | **상태색 토큰화** | P1-13 · P1-14 | `globals.css` 49곳 치환 + `ds/AnalysisStatusBadge` + 차트 팔레트. sed 위주 |
| 6 | **세그먼트 컨트롤 접근성** | P1-15 · P1-16 | 공용 훅 1개 + `.ab-pillgroup` 47곳 + `title` 어포던스 CSS 1줄. `WebRMmmAdvanced`의 기존 핸들러 재사용 |
| 7 | **5-23 통제군 CI** | P1-1 · P1-2 | 기존 `twoPropZTest` 호출만 추가 + `satMath.classify` null 분기 |
| 8 | **5-3/5-22 예측 함수 통일** | P1-3 · P1-4 | `predictSafeCpr` 경유 통일 + `xMin` 전달 |
| 9 | **고지 보강** | P1-11 · P1-12 | 개인정보처리방침 제3자 요청 섹션 + 지역 무관 계측 opt-out |
| 10 | **죽은 코드·문서 정리** | P2 전체 | `rrMultiverse`·`regLabMath`·`dateFilterContract`·`LocaleAutoRedirect`·구 도구 필드 계약. **AGENTS.md §4.2에 5-25·5-26 추가, §16 수치 정정, §12.27 "채택 완료" 문구 정정, `docs/code-health-audit.md` 처리** |

**권장 순서**: 1 → 2 → 3 → 4. 1·2는 잘못된 숫자를 멈추고, 3은 같은 사고의 재발을 막는다.

---

## §7. 이 감사의 한계 (정직하게)

- **실제 브라우저에서 실행하지 않았다.** 정적 분석 + Node/vitest 재현 기반이다. 렌더 결과·실제 대비비·모바일 터치 동작은 육안 검증이 필요하다(Gondry님이 브라우저에서 확인하는 워크플로우 — AGENTS.md §6.1.3).
- **성능은 측정하지 않았다.** 10만 행 이상에서의 메모리·프레임 드랍은 실측 없이 판단하지 않았다.
- **P0-1의 하류 영향 범위는 코드 경로로 추적했고, 대시보드(5-2)와 포화도(5-22)만 실행으로 확인했다.** 나머지 도구는 동일 패턴 확인이지 개별 재현은 아니다.
- **H-1~H-10은 잠복 위험이다** — 현재 데이터·타임존에서 실제 오작동을 재현하지 못했고, 코드 비대칭과 주석-코드 불일치를 근거로 든 것이다.
- **1,655개 테스트가 통과했다는 사실이 정확성을 보증하지 않는다.** 이 리포트의 P0 3건이 그 증거다 — 골든은 순수함수의 입력-출력만 보고, 렌더층·배선·파싱 경계는 보지 않는다.
