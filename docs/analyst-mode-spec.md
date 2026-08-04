# 분석가 모드 (Analyst Mode) — 확장 설계 스펙

> 상태: 설계안 · 구현 전
> 대상 코드베이스: `v2-migration/` (Next.js 16 + React 19 + Zustand)
> 실행 방식: 워크스트림(W1~W6) 단위로 각각 독립 PR. 다른 세션이 이 문서만 읽고 착수 가능하도록 자체완결로 작성.
> 선행 필독: 루트 `CLAUDE.md`(§2 절대원칙 · §7 함정 · §12.21 디자인시스템), `v2-migration/ARCHITECTURE.md`(코드맵), `v2-migration/claude-ux.md`(UX 원칙)

---

## 1. 배경 — 왜 분석가인가

현재 앱은 **퍼포먼스 마케터의 의사결정**에 최적화돼 있다. §12.27 "결론 카드 먼저, 근거 접기" 원칙에 따라 모든 도구가 `ds/ResultActionCard`로 판정을 먼저 보여주고 근거를 `<details>`로 접는다. 마케터에겐 정답이다.

문제는 **엔진이 이미 분석가 수준인데 화면이 그걸 막고 있다**는 점이다. OLS(HC3 이분산 강건 SE 포함) · VIF · Durbin-Watson · Breusch-Godfrey · STL 분해 · 베이지안 prior · multiverse 민감도가 전부 구현돼 있으나, UI에는 정제된 결론만 노출된다.

| | 퍼포먼스 마케터 | 분석가 |
|---|---|---|
| 1순위 질문 | "그래서 뭘 해야 해?" | "이 숫자 **믿어도 돼?**" |
| 2순위 질문 | "얼마 올려?" | "내가 **다시 돌릴** 수 있어?" |
| 3순위 질문 | "언제까지?" | "**내 질문**으로 잘라볼 수 있어?" |
| 원하는 UI | 결론 → 근거 접기 | 결론 + **근거를 펼친 채로**, 가정 검증 가능 |

**핵심 전략**: 새 도구를 만들지 않는다. 기존 11개 도구 전부에 상속되는 **"분석가 모드" 토글** 하나를 만들고, 켜면 진단·프로파일링·재현 레이어가 붙고 끄면 현재 마케터 UX가 그대로 유지된다. 엔진 불변 → 골든 byte-동일.

---

## 2. 현재 자산 인벤토리 (★ 중복 구현 방지 — 착수 전 반드시 확인)

**이미 있는 것을 다시 만들지 말 것.** 아래는 실측 확인된 목록이다.

### 2.1 통계 엔진 (전부 순수 함수, 재사용 대상)

| 자산 | 위치 | 반환/기능 |
|---|---|---|
| `REG_STATS.ols(X, y)` | `src/utils/regMath.js:172` | `beta·se·tval·pval·ci·yhat·`**`resid`**`·R2·adjR2·n·k·df·sigma2·RSS·TSS·F·Fp·XtXi·regularized·`**`hc3Se·hc3Tval·hc3Pval·hc3Ci·hc3Valid·maxLeverage`** |
| `REG_STATS.r2of(X, y)` | `src/utils/regMath.js:260` | R² 스칼라 (VIF 계산에 사용됨) |
| `REG_STATS.tSF`, `ibeta` | `src/utils/regMath.js:265` | t 분포 survival, incomplete beta |
| VIF 계산 | `src/utils/regLabMath.js:280` | `REG_LAB_STATE.fits[depTag].vif` 배열로 이미 저장됨 |
| `durbinWatson(resid)` | `src/utils/mmmMath.js:412` | DW 통계량 (자기상관) |
| `breuschGodfrey(resid, X, p)` | `src/utils/mmmMath.js:421` | LM 검정 (고차 자기상관) |
| STL 분해 | `src/utils/mmmMath.js:954` 부근 | `trend·seasonal·residual·trendStrength` |
| multiverse 민감도 | `src/utils/rrMultiverse.js` | 사양 조합별 결과 분포 |

**즉 W1(모델 진단)의 수학은 90% 이미 존재한다. 남은 건 노출과 시각화.**

### 2.2 인프라 (재사용 대상)

| 자산 | 위치 | 비고 |
|---|---|---|
| `downloadJson(value, baseName, ext)` | `src/utils/download.js:48` | 설정 export에 바로 사용 |
| `downloadCsv` / `downloadText` | `src/utils/download.js:27,38` | BOM+CRLF 처리 완료(§7) |
| `persistPartialize` | `src/store/useDataStore.js:332` | persist allowlist — **원본 CSV 절대 제외**(§2.2) |
| `persistMigrate` | `src/store/useDataStore.js:351` | 스키마 버전 마이그레이션 훅 이미 골격 존재 |
| 분석 이력(IndexedDB) | `src/lib/data-import/localHistory.js` + `src/components/data-import/AnalysisHistory.jsx`(111줄) | `saveAnalysisRun`/`listAnalysisRuns`/`deleteAnalysisRun`. **W3 결과 diff의 기반** |
| 공용 UI | `src/components/ds/*` | `ResultActionCard`·`DownloadHub`·`DataTable`·`ModalDialog`·`AnalysisDetails`·`CsvGuide` |
| 포맷 | `src/utils/format.js` | `fmtCurrency·fmtPct·fmtNum·parseNum` — 수동 포맷 금지(§12.21) |
| 차트 | `src/utils/chartUtils.js` | `chartCommonOpts()`·`CHART_THEME`·`getCssVar` — 하드코딩 색 금지 |
| 커스텀 지표/차트 | `src/utils/metrics/customMetric.js`·`chartBuilder.js`·`metricRegistry.js` | **W4 피벗의 절반이 이미 깔려 있음** |

### 2.3 이미 스펙만 있고 미구현 (★ 중복 작성 금지)

| 문서 | 내용 | W3와의 관계 |
|---|---|---|
| **`docs/project-session-file-spec.md`** | `.gop.json` 프로젝트 설정 저장·복원 (schemaVersion·headerFingerprint·mapping·filters·viewConfig). **"설계 확정안 · 구현 전"** | **W3-a는 이 스펙의 구현이다.** 새로 설계하지 말고 그 문서를 그대로 따를 것 |

### 2.4 얇은 상태 (실체화 대상)

| 자산 | 현재 | 문제 |
|---|---|---|
| `DataQualityReport.jsx` | **17줄** — `AnalysisBasisBar`를 감싸기만 하는 래퍼 | 이름값을 못 함. W2의 대상 |
| `AnalysisBasisBar.jsx` | 144줄 — 매핑/결측 유도 + 기간 비교 | 컬럼 단위 프로파일링은 없음 |

---

## 3. 설계 원칙 (모든 워크스트림 공통 · 위반 금지)

1. **엔진 불변** — `src/utils/*Math.js`의 수학은 바꾸지 않는다. 골든 테스트가 오라클이며 **byte-동일**을 유지해야 한다(§2.1, §8).
   - 예외: **additive 노출**은 허용. 기존 반환 객체에 필드를 *추가*만 하는 것(선례: `regMath.js`의 `XtXi` — 주석에 "additive — 기존 호출부 무영향" 명시). 기존 필드의 값·타입·이름은 절대 변경 금지.
2. **클라이언트 사이드 100%** — 사용자 CSV는 브라우저 메모리에만. 서버 전송·저장 금지(§2.2). 재현 코드 생성도 전부 로컬 문자열 조립.
3. **통계적 정직성** — 진단 지표가 나쁘면 나쁘다고 말한다. "추정 불가"는 정직하게 표기. 무유의 = 증거 부족이지 효과 없음이 아니다(§8.6). OLS가 산출하지 않은 수치를 지어내지 않는다.
4. **KR/EN 동시 반영**(§2.11) — 외부 노출 UI·카피는 같은 작업에서 EN도 동등하게. `tr` 패턴 사용.
5. **디자인시스템 준수**(§12.21) — 숫자는 `format.js`, 표는 `ds/DataTable`, 차트는 `chartCommonOpts()`+`CHART_THEME`, 통화는 전역 `store.displayCurrency`.
6. **마케터 UX 무손상** — 분석가 모드 OFF일 때 기존 화면은 **DOM 수준에서 현재와 동일**해야 한다. 기존 smoke 테스트가 수정 없이 통과하는 것이 수용 기준.
7. **성능** — 무거운 계산은 `분석하기` 게이트 뒤에서만. 진단 계산도 마찬가지(§7의 "useMemo에 무거운 compute 금지" 함정).

---

## 4. 분석가 모드 토글 (W0 — 모든 워크스트림의 선행 작업)

### 4.1 상태

`src/store/useDataStore.js`에 추가:

```js
// 분석가 모드 — 진단·프로파일링·재현 레이어 노출 여부.
// persist 대상(설정이지 데이터가 아님, §2.2 위반 아님). 기본 false = 기존 마케터 UX.
analystMode: false,
setAnalystMode: (on) => set({ analystMode: !!on }),
```

`persistPartialize`(`:332`)의 allowlist에 `analystMode` 추가. **원본 CSV·필터 Set은 절대 추가하지 않는다.**

### 4.2 UI 진입점

- 전역 `Header`에 토글 1개(테마·EN 토글 옆). 라벨 KR `분석가 모드` / EN `Analyst mode`.
- 켜짐 상태를 시각적으로 명확히(배지 또는 pill). 켜져 있다는 사실을 사용자가 항상 알아야 함.
- ⌘K 명령 팔레트에 `분석가 모드 켜기/끄기` 명령 추가(`buildCmdkCommands` 패턴).

### 4.3 소비 패턴

각 도구는 `const analystMode = useAppStore((s) => s.analystMode)` 로 구독하고, 진단 섹션을 조건부 렌더한다.

```jsx
{analystMode && <ModelDiagnosticsPanel fit={fit} X={X} labels={labels} locale={locale} />}
```

**함정**: 조건부 마운트되는 차트는 최초 폭 0으로 측정된다(§7). `new Chart(...)` 직후 `requestAnimationFrame(() => instance.resize())` 1회 필수.

### 4.4 수용 기준

- [ ] OFF 상태에서 기존 smoke 테스트 20개 전부 **수정 없이** 통과
- [ ] 토글 상태가 새로고침 후에도 유지(persist)되고, 원본 CSV는 여전히 리셋됨
- [ ] EN 로케일에서 라벨 동등 노출

---

## 5. W1 — 모델 진단 패널 (신뢰 축, 최우선)

### 5.1 목표

회귀·MMM 결과에 "이 모델을 믿어도 되는가"를 판단할 재료를 붙인다. **분석가가 계수·CI만 보고 도구를 신뢰하는 일은 없다.**

### 5.2 산출물

**신규 순수 유틸**: `src/utils/modelDiagnostics.js` (+ `modelDiagnostics.test.js` 골든)

```js
/**
 * OLS 적합 결과에서 진단 지표를 계산한다. 순수 함수 · 결정론.
 * @param {object} fit - REG_STATS.ols() 반환 객체 (resid·yhat·XtXi·df·k·n 필요)
 * @param {number[][]} X - 설계 행렬 (leverage/Cook's D 계산용)
 * @returns {{
 *   dw: number|null,              // Durbin-Watson (mmmMath.durbinWatson 재사용)
 *   dwVerdict: "ok"|"positive"|"negative"|"unknown",
 *   leverages: number[],          // 대각 hat 값
 *   cooksD: number[],             // Cook's distance
 *   influential: number[],        // cooksD > 4/n 인 관측치 index
 *   bpStat: number|null,          // Breusch-Pagan 통계량 (이분산)
 *   bpP: number|null,
 *   hetVerdict: "ok"|"heteroskedastic"|"unknown",
 *   qq: {theoretical: number[], sample: number[]},  // Q-Q 플롯 좌표 (정규성)
 *   residVsFitted: {x: number[], y: number[]},
 *   scaleLocation: {x: number[], y: number[]},      // √|표준화 잔차|
 *   normalityVerdict: "ok"|"skewed"|"unknown"
 * }}
 */
export function computeOlsDiagnostics(fit, X) { ... }

/**
 * VIF 계산 (regLabMath.js:280 로직을 순수 함수로 추출 — 원본은 그대로 두고 새로 작성).
 * @returns {{vif: number[], maxVif: number, verdict: "ok"|"warn"|"severe"}}
 */
export function computeVif(Xcols) { ... }
```

**임계값은 상수 객체로 분리**(결정론·설정 가능, §8.6):

```js
export const DIAG_THRESHOLDS = {
  vifWarn: 5, vifSevere: 10,        // mmmMath.js:1108,1125 의 기존 값과 정합 유지
  cooksDMultiplier: 4,               // 4/n
  dwLow: 1.5, dwHigh: 2.5,
  bpAlpha: 0.05,
};
```

**신규 컴포넌트**: `src/components/ds/ModelDiagnosticsPanel.jsx` (+ smoke 테스트)

### 5.3 UI 구성 (claude-ux 원칙 준수)

패널 최상단은 **평어 한 줄 요약**(마케터도 읽을 수 있게), 그 아래 4분할 차트 + 지표 표.

```
┌ 모델 신뢰도 점검 ─────────────────────────────┐
│ ⚠ 자기상관 의심 (DW 1.21) — 시계열 패턴이 잔차에  │
│   남아 있어 표준오차가 과소평가됐을 수 있습니다.    │
├───────────────────────────────────────────┤
│ [잔차 vs 적합값] [Q-Q 플롯]                    │
│ [Scale-Location] [영향점 (Cook's D)]          │
├───────────────────────────────────────────┤
│ 지표표: DW · VIF(변수별) · BP p · 최대 Cook's D  │
│         · HC3 강건 SE 사용 여부                 │
└───────────────────────────────────────────┘
```

- 각 진단 항목에 **판정 배지**(ok/주의/심각) + `title` 툴팁으로 "왜 문제인가 / 어떻게 대응하나"(§12.14의 `formatMmmTipText` 3단 구조 재사용).
- **HC3 이미 계산돼 있음** — `fit.hc3Valid`가 true면 "이분산 강건 SE 적용됨"을 명시. 분석가가 가장 먼저 확인하는 항목이다.
- 차트 4개는 `chartCommonOpts()` + `CHART_THEME` 필수. 하드코딩 색 금지(다크모드에서 깨짐, §7).

### 5.4 적용 대상 도구

| 도구 | 컴포넌트 | 적합 객체 접근 경로 |
|---|---|---|
| 5-18 회귀·예측 탭 | `MarketingResponse.jsx` | `REG_LAB_STATE.fits[depTag].fit` (VIF는 `.vif` 이미 존재) |
| 5-18 MMM 기여분해 | `MarketingResponse.jsx` | `mmmMath` 적합 결과 |
| 9-1 콘텐츠 요소 분석 | `ContentElementAnalyzer.jsx` | `REG_STATS.ols` 직접 호출부 |

**1차 PR은 5-18 회귀 탭 하나만.** 검증 후 나머지 확산.

### 5.5 엔진 additive 변경 (1건만 허용)

`REG_STATS.ols`가 `leverages` 배열을 반환하지 않는다(내부 계산 후 `maxLeverage`만 반환, `regMath.js:207~211`). Cook's D에 필요하므로 반환 객체에 `leverages`를 **추가**한다.

```js
return {
  ...,
  maxLeverage,
  leverages,  // ← additive: hat 대각. Cook's D 계산용 (기존 호출부 무영향)
};
```

- 기존 필드 일절 불변 → 골든 byte-동일 유지되어야 함. `npm test`로 확인.
- 만약 이 변경으로 골든이 깨지면 **엔진을 되돌리고** 진단 유틸에서 `XtXi`와 `X`로 leverage를 재계산할 것(수학적으로 동일: `hᵢ = xᵢᵀ(XᵀX)⁻¹xᵢ`).

### 5.6 함정

- **잔차 플롯 y값에 `Math.round` 금지**(§7 — 작은 값이 0으로 뭉개짐). 소수 보존.
- Q-Q 플롯 이론 분위수는 결정론적 공식으로(`Math.random` 절대 금지, §8.3). Blom 근사 `(i - 0.375)/(n + 0.25)` 사용.
- `df <= 0`, `n < k+2`, `RSS === 0` 등 축퇴 케이스는 **`null` + "추정 불가"** 로 정직 처리(숫자 날조 금지, §8).
- VIF는 독립변수 2개 미만이면 정의되지 않음 → `1` 반환 또는 표시 생략(기존 `regLabMath.js:281` 동작과 정합).

### 5.7 검증

- [ ] `modelDiagnostics.test.js`: 합성 데이터로 (a) 정상 모델 → 전 지표 ok (b) 의도적 자기상관 데이터 → DW < 1.5 검출 (c) 의도적 이분산 → BP 유의 (d) 명백한 이상치 1개 → `influential`에 해당 index 포함 (e) 완전 공선 → null 반환·throw 없음
- [ ] `ModelDiagnosticsPanel.smoke.test.jsx`: 마운트 크래시 0 (§7 render-throw 함정), 축퇴 입력에서도 렌더
- [ ] `npm run test:all` 전체 GREEN, `npm run lint` 0 errors
- [ ] 분석가 모드 OFF에서 5-18 기존 smoke 무수정 통과

---

## 6. W2 — 데이터 프로파일링 리포트 (신뢰 축)

### 6.1 목표

업로드 직후 "이 데이터에 뭐가 들어 있고 어디가 구멍인가"를 컬럼 단위로 보여준다. 현재 `DataQualityReport.jsx`는 17줄 래퍼로 이름값을 못 한다.

### 6.2 산출물

**신규 순수 유틸**: `src/utils/dataProfile.js` (+ 골든 테스트)

```js
/**
 * 원본 CSV 행에서 컬럼별 프로파일을 계산한다. 순수 · 결정론.
 * 대용량 대비: 카디널리티 수집은 상한(기본 200)에서 중단하고 truncated 플래그.
 * @param {object[]} rows - PapaParse 결과 (모든 값 문자열)
 * @param {string[]} headers
 * @param {object} opts - {maxUnique=200, sampleForDist=5000}
 * @returns {{
 *   rowCount: number,
 *   columns: Array<{
 *     name: string,
 *     inferredType: "number"|"date"|"category"|"text",
 *     typeConfidence: number,        // 0~1, 파싱 성공률
 *     missingCount: number, missingPct: number,
 *     emptyStringCount: number,      // "" 와 진짜 결측 구분
 *     uniqueCount: number, uniqueTruncated: boolean,
 *     // number 전용
 *     min, max, mean, median, p25, p75, stdev,
 *     zeroCount, negativeCount,
 *     outlierCount,                  // IQR 1.5배 기준
 *     // category 전용
 *     topValues: Array<{value, count, pct}>,   // 상위 10
 *     // date 전용
 *     dateMin, dateMax, expectedDays, presentDays, missingDates: string[],
 *   }>,
 *   duplicateRows: number,
 *   warnings: Array<{level:"info"|"warn"|"severe", code: string, message: string, column?: string}>
 * }}
 */
export function profileCsv(rows, headers, opts) { ... }

/**
 * 매핑된 키 조합이 사실상 유일한지 검사 (grain 검증).
 * 예: date+channel+campaign 이 중복되면 사용자가 grain을 오해하고 있는 것.
 * @returns {{keyCols: string[], duplicateKeyCount: number, examples: object[]}}
 */
export function checkGrainUniqueness(rows, keyCols) { ... }
```

**경고 코드 목록**(고정 · 결정론):

| code | level | 조건 | 메시지 취지 |
|---|---|---|---|
| `HIGH_MISSING` | warn | 결측 > 20% | "이 컬럼 5개 중 1개가 비어 있습니다" |
| `ALL_MISSING` | severe | 결측 100% | "전부 비어 있어 분석에 쓸 수 없습니다" |
| `DATE_GAPS` | warn | 날짜 구멍 존재 | "N일이 빠져 있습니다 (목록)" |
| `DUPLICATE_ROWS` | warn | 완전 중복 행 존재 | "같은 행이 N개 중복됩니다" |
| `GRAIN_NOT_UNIQUE` | severe | 키 조합 중복 | "날짜+채널이 여러 번 나옵니다 — 합산이 필요할 수 있습니다" |
| `CONSTANT_COLUMN` | info | unique = 1 | "값이 하나뿐이라 분석에 기여하지 않습니다" |
| `HIGH_CARDINALITY` | info | unique > 행수 90% | "거의 모든 행이 다른 값 — ID 컬럼일 수 있습니다" |
| `NEGATIVE_IN_METRIC` | warn | 비용/전환 컬럼에 음수 | "환불·조정일 수 있습니다" |
| `TYPE_MIXED` | warn | 파싱 성공률 < 95% | "숫자와 문자가 섞여 있습니다" |

### 6.3 UI

`DataQualityReport.jsx`를 실체화한다. **기존 `AnalysisBasisBar` 렌더는 그대로 두고 그 아래에 프로파일 섹션을 추가**(기존 동작 무손상).

- 분석가 모드 OFF: 현재와 동일(`AnalysisBasisBar`만).
- 분석가 모드 ON: 아래에 `<details>` 프로파일 표(`ds/DataTable` 사용) — 컬럼별 행. severe 경고는 접힘 밖으로 승격.
- 날짜 구멍은 목록이 길 수 있으므로 상위 10개 + "N일 더" 접기.
- DownloadHub에 "데이터 프로파일 (CSV)" 항목 추가 — 분석가가 데이터 엔지니어에게 전달할 수 있게.

### 6.4 함정

- **성능**: 10~20만 행에서 컬럼 × 행 전수 순회는 무겁다. **업로드 직후 1회만** 계산하고 결과를 store에 캐시(§4.4 캐시 패턴, 키 = 헤더+행수+파일명 시그니처). 매핑 변경마다 재계산 금지(§7).
- 분포/이상치는 `sampleForDist` 상한으로 샘플링하되 **결정론적 샘플링**(균등 간격 stride, `Math.random` 금지).
- 값은 전부 문자열이다(PapaParse `dynamicTyping` 미사용, §7) → `parseFloat` 전에 콤마 strip 필요(`parseNum` 재사용).
- 날짜 파싱은 기존 `_mmmParseDate` 계열 로직과 **동일 규칙**을 써야 화면 간 불일치가 없다.

### 6.5 검증

- [ ] 골든: 각 경고 코드마다 합성 데이터 1개씩(9개 케이스) + 빈 CSV·1행 CSV·전부 결측 엣지
- [ ] 20만 행 합성 데이터에서 프로파일 계산 2초 이내 (그 이상이면 W6 Worker 선행)
- [ ] 분석가 모드 OFF에서 업로드 화면 DOM 동일

---

## 7. W3 — 재현성 (차별화 최대)

### 7.1 W3-a: 설정 저장/복원 — **기존 스펙 구현**

**`docs/project-session-file-spec.md`("설계 확정안 · 구현 전")를 그대로 구현한다. 새로 설계하지 말 것.**

- 파일 형식 `.gop.json`, `schemaVersion: 1`, `headerFingerprint` 일치 후 매핑 복원, 자동 분석 금지, 원본 CSV 미포함.
- 구현 도구: `downloadJson`(`download.js:48`) 이미 존재. import는 `<input type="file">` + `JSON.parse` + 스키마 검증.
- 스키마 불일치·버전 상위 파일은 **거부하고 이유 표시**(조용한 부분 복원 금지).

### 7.2 W3-b: 재현 코드 생성 (신규)

**목표**: 분석가가 결과를 자기 스택(pandas/R)에서 검증·확장할 수 있게 한다. 이것이 도구 신뢰의 결정타다.

**산출물**: `src/utils/reproCode.js` (+ 골든 테스트)

```js
/**
 * 현재 분석 설정을 재현하는 코드 문자열을 생성한다. 순수 · 결정론 · 전부 로컬 조립.
 * 사용자 데이터 값은 절대 포함하지 않는다 — 컬럼명과 파라미터만.
 * @param {object} spec - {toolId, mapping, filters, params, engine: "ols"|"mmm"|"pvm"|...}
 * @param {"python"|"r"} lang
 * @returns {string}
 */
export function buildReproCode(spec, lang) { ... }
```

생성 예시(5-18 회귀, python):

```python
# Growth Opt Playbook — 재현 코드 (자동 생성)
# 도구: 5-18 마케팅 반응 분석 · 회귀
# 생성일: 2026-08-04
import pandas as pd, numpy as np, statsmodels.api as sm

df = pd.read_csv("YOUR_FILE.csv")          # 업로드했던 파일 경로로 교체

# 1) 컬럼 매핑
df = df.rename(columns={"광고비": "cost", "설치": "installs"})

# 2) 필터
df = df[(df["date"] >= "2026-01-01") & (df["date"] <= "2026-06-30")]
df = df[df["channel"].isin(["Google", "Meta"])]

# 3) 변환 (도구 설정과 동일)
df["cost_adstock"] = ...   # adstock lambda=0.5
X = sm.add_constant(df[["cost_adstock", "week_sin", "week_cos"]])
y = df["installs"]

# 4) 적합 — 도구는 HC3 이분산 강건 표준오차를 사용합니다
model = sm.OLS(y, X).fit(cov_type="HC3")
print(model.summary())
```

**정직성 요구(§8)**: 생성 코드가 **도구와 완전히 동일한 결과를 낸다고 보장하지 말 것**. 헤더 주석에 명시한다 — "이 코드는 동일한 모델 사양을 재현합니다. 전처리 세부(이상치 제거 규칙 등) 차이로 소수점 수준의 차이가 있을 수 있습니다."

**엔진별 커버리지**(1차 범위):

| 엔진 | python | r | 비고 |
|---|---|---|---|
| OLS 회귀 (5-18 lab, 9-1) | ✅ | ✅ | statsmodels / `lm()` |
| A/B 검정 (5-4) | ✅ | ✅ | scipy / `prop.test()` |
| 코호트·리텐션 (5-2) | ✅ | — | pandas 피벗 |
| MMM (adstock+saturation) | ⚠ 사양만 | — | 완전 재현 불가 → 사양 서술 + "근사" 명시 |
| PVM Bennet 분해 | ✅ | — | 공식이 단순해 재현 용이 |

**커버 못 하는 엔진은 코드를 지어내지 말고 "이 도구는 재현 코드를 제공하지 않습니다 — 방법론 문서를 참고하세요"로 정직 처리.**

### 7.3 W3-c: 결과 diff (신규, 기존 이력 기반)

`AnalysisHistory.jsx`(111줄) + `localHistory.js`(IndexedDB)가 이미 run 요약을 저장한다. 여기에 **두 run 선택 → 비교** 뷰를 추가한다.

- 좌/우 체크박스로 2개 선택 → 지표별 이전/이후/증감 표(`ds/DataTable`).
- 파라미터 차이(무엇을 바꿨는지)를 상단에 명시 — "adstock λ 0.3 → 0.5".
- 저장 대상은 **요약 지표와 파라미터만**(원본 데이터 아님, §2.2 유지).

### 7.4 함정

- `.gop.json` import 시 **다른 CSV에 매핑을 자동 적용하지 말 것** — `headerFingerprint` 불일치면 거부하고 사용자에게 알린다(기존 스펙의 명시 결정).
- 재현 코드에 **사용자 데이터 값이 한 줄이라도 들어가면 안 된다**. 컬럼명·파라미터·필터 값(사용자가 고른 채널명 등)까지가 한계이며, 그조차 민감할 수 있으므로 "파일명은 제외"(기존 스펙 결정과 정합).
- 생성 코드 문자열은 `downloadText(code, name, "py")` 사용 — BOM 처리는 CSV 전용이므로 코드 파일엔 BOM 금지(파이썬이 깨진다). `download.js` 확인 후 필요시 ext별 분기 추가.

### 7.5 검증

- [ ] `reproCode.test.js`: 엔진별 생성 문자열 스냅샷 + **사용자 데이터 값 미포함** 단정(정규식으로 숫자 행 유출 검사)
- [ ] `.gop.json` round-trip: export → import → 상태 동일
- [ ] fingerprint 불일치 파일 import → 거부 + 명확한 메시지
- [ ] 생성된 python 코드가 **문법적으로 유효**(테스트에서 `ast.parse` 대신, 최소한 들여쓰기·따옴표 균형 검사)

---

## 8. W4 — 자유 탐색 워크벤치 (임팩트 큼 · 비용 큼)

> **W1~W3 완료 후 착수 권장.** 이것만 새 도구가 필요하다.

### 8.1 W4-a: Ad-hoc 피벗/크로스탭

- 신규 도구 id 필요(§4.1 — 내부 id는 확정 후 절대 불변). 제안: `5-30` 데이터 워크벤치.
- 임의 차원(행/열) × 임의 지표 × 임의 기간 그룹핑. 지표는 `metricRegistry.js`·`customMetric.js` 재사용(**절반 이미 구현됨**).
- 결과는 `ds/DataTable` + `CustomChartBuilder` 연결.
- 배선 체크리스트(§12.1·§12.23): `IA` 추가 → `routeMap` → `csvGroups` 그룹 결정 → `toolGuide` → `demoData` → PageClient 디스패치 → sitemap.

### 8.2 W4-b: 멀티 CSV 조인

- 2개 이상 CSV를 키로 조인(광고 + 앱 이벤트 + 매출).
- **조인 진단 필수**: 좌/우 매칭률, 미매칭 키 샘플, 카디널리티 폭발 경고(1:N 조인으로 행이 10배가 되면 지표가 조용히 부풀어 오른다 — 분석가가 가장 자주 당하는 사고).
- 현재 store는 도구 그룹별 단일 CSV 슬라이스 구조(§12.20)라 **상태 설계 변경이 필요**하다. 착수 전 `ARCHITECTURE.md` 갱신 계획 포함.

### 8.3 W4-c: 범용 통계 검정 워크벤치

- 두 그룹/다중 그룹 비교: Welch t · Mann-Whitney U · 카이제곱 · 일원배치 ANOVA.
- 상관 행렬 + 부분상관 히트맵.
- 다중비교 보정(BH/Bonferroni) — 이미 forest plot에서 `pAdj`를 쓰는 선례가 있다(§12.12).

---

## 9. W5 — 인과추론 심화 (선택)

현재 5-23이 통제군 홀드아웃·pre/post·DiD까지 커버한다. 분석가 관점의 다음 단계:

| 방법 | 가치 | 비용 |
|---|---|---|
| **CUPED** (사전 공변량 분산 감소) | 같은 표본으로 검정력 상승 — 실험 담당 분석가가 가장 원함 | 中 |
| **Synthetic Control** | 통제군이 없을 때 가중 합성 대조군 | 大 |
| **Propensity Score Matching** | 관측 데이터 편향 보정 | 大 |

**정직성 게이트 필수**: 무작위 배정이 아니면 인과를 단정하지 않는다(§12.22, claude-ux §7). PSM은 특히 "관측 공변량만 보정 — 미관측 교란은 남는다"를 화면에 명시해야 한다.

---

## 10. W6 — 규모 (Web Worker)

분석가는 수십만 행을 던진다. 현재 compute는 메인 스레드이며 §7에 "진짜 논블로킹은 엔진 Web Worker화가 후속"으로 이미 기록돼 있다.

- CSV 파싱은 이미 `Papa {worker:true}`.
- 계산 엔진(`*Math.js`)은 전부 순수 함수이므로 Worker 이식이 구조적으로 쉽다.
- 우선순위: W2 프로파일링이 20만 행에서 2초를 넘으면 W6를 **선행**으로 끌어올린다.

---

## 11. 우선순위 · 의존성

```
W0 분석가 모드 토글  ← 모든 것의 선행
 ├─ W1 모델 진단 패널      [최우선 · 엔진 90% 존재 · 소~중]
 ├─ W2 데이터 프로파일링    [중 · 전 도구 공통 이득]
 └─ W3 재현성
     ├─ W3-a .gop.json    [소 · 기존 스펙 구현일 뿐]
     ├─ W3-b 재현 코드      [중 · 차별화 최대]
     └─ W3-c 결과 diff      [중 · 기존 이력 인프라 활용]

W4 워크벤치 (피벗/조인/검정)  [대 · W1~W3 이후]
W5 인과추론 심화             [선택]
W6 Worker                   [W2 성능 미달 시 승격]
```

**권장 1차 PR 범위**: W0 + W1(5-18 회귀 탭 한정). 이것만으로 "분석가가 신뢰할 수 있는 도구"라는 포지션이 성립한다.

---

## 12. 공통 검증 절차 (모든 PR)

```bash
cd v2-migration
npm run test:all      # golden + smoke 전부 GREEN
npm run lint          # 0 errors 유지
npm run build         # next build 성공
```

체크리스트:

- [ ] 골든 테스트 **byte-동일** (엔진 수학 불변 확인). additive 변경이면 기존 테스트 무수정 통과
- [ ] 분석가 모드 OFF에서 기존 smoke 20개 무수정 통과
- [ ] 신규 순수 함수마다 합성 데이터 골든 1개 이상 + 축퇴 케이스(빈 배열·n<k·전부 결측·완전 공선)
- [ ] 신규 컴포넌트마다 smoke 테스트(render-throw 방지, §7)
- [ ] KR/EN 양쪽 라벨 확인(§2.11)
- [ ] 다크/라이트 양쪽 차트 확인 — 하드코딩 색 0(§7)
- [ ] `Math.random` 0건 (§8.3)
- [ ] `git add` 명시 파일만 (§2.6), main 직접 push 금지 (§2.4)
- [ ] 새 도구·엔진·경로·상태 추가 시 `v2-migration/ARCHITECTURE.md` 동반 갱신 (§15)

---

## 13. 비범위 (하지 말 것)

- ❌ **엔진 수학 변경** — additive 필드 추가 외 일절 금지(§2.1)
- ❌ **서버 전송** — 재현 코드 생성·프로파일링 전부 클라이언트에서(§2.2)
- ❌ **원본 CSV persist** — `.gop.json`에도 store persist에도 포함 금지
- ❌ **마케터 UX 훼손** — 분석가 모드 OFF는 현재와 DOM 동일
- ❌ **`docs/project-session-file-spec.md` 재설계** — 이미 확정. 구현만
- ❌ **없는 수치 생성** — 모델이 산출하지 않은 확률·신뢰도를 지어내지 않는다(§8)
- ❌ **새 라이브러리 무단 추가** — 사용자 확인 필수(§11). 진단·프로파일링은 전부 자체 구현 가능

---

## 14. 열린 결정 (착수 전 사용자 확인 필요)

| # | 항목 | 선택지 |
|---|---|---|
| 1 | 분석가 모드 진입점 | (a) Header 전역 토글 (b) 도구별 `<details>` 상시 노출 (c) URL 쿼리 `?analyst=1` |
| 2 | 재현 코드 언어 우선순위 | (a) Python만 1차 (b) Python + R 동시 |
| 3 | W4 워크벤치 도구 id | `5-30` 신규 vs 5-2 대시보드 내 탭 추가 |
| 4 | `analystMode` persist 여부 | persist(편의) vs 세션 휘발(새로고침 리셋 원칙 일관성) |

---

*이 문서는 설계안이며 구현 전이다. 착수하는 세션은 §2 인벤토리를 먼저 실측 확인(파일:줄이 이동했을 수 있음)한 뒤 §11 우선순위대로 진행할 것.*
