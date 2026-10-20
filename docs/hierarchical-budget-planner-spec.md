# 계층형 예산 배분·성과 예측 모델 설계 (CPR 기반)

2026-10-20 요청: 국가·플랫폼·채널·캠페인·광고그룹·소재 단위의 cost·결과 데이터로 CPR에 따라 예산을 나누는 모델.
반드시 다룰 것은 ① 지금 소진 중인 캠페인이 과거 cost–CPR 범위를 따르는가 ② 요일 ③ 예산·소재를 늘리거나 뺐을 때 성과 변화가 **예산 곡선 때문인지 소재 때문인지** ④ 그 결과로 나온 배분안과 성과 예측치.
규칙성 임계값은 전부 config 하나에서 관리한다.

> 상태: **설계만**. 구현 전 결정 4건(§10)이 남아 있다. 수학 엔진(`*Math.js`) 기존 골든은 건드리지 않고, 새 판단은 새 순수 모듈에 둔다.

---

## 0. 한 장 요약

```
CSV(일 × 국가 × 플랫폼 × 채널 × 캠페인 × 광고그룹 × 소재)
  │
  ├─ [A] 전처리      — 계층 집계, D7 성숙, 명절 표시
  ├─ [B] 요일 모형   — 노드별 요일 계수(지출·CPR), 부모 쪽으로 수축
  ├─ [C] 반응 곡선   — 배분 단위별 cost→CPR 곡선 (기존 ALLOC_MATH 재사용)
  ├─ [D] 범위 적합성 — 최근 소진이 곡선·관측 범위 안인가 (IN_RANGE / EXTRAPOLATING / DRIFT)
  ├─ [E] 변화 원인   — ΔCPR = 곡선 위 이동(예산) + 곡선 이동(소재·시장·퍼널)
  ├─ [F] 배분       — 한계 CPR 그리디 + 제약(학습 하한·일 변경폭·외삽 상한·진단 결과)
  └─ [G] 예측       — 요일별 일 예측 + 잔차 기반 구간 + 백테스트 오차
                         ↑
                 plannerConfig (모든 임계·규칙)
```

결과물: **배분안 표**(노드별 현재→제안 일예산, 변경 사유), **성과 예측**(기간 합·요일별, P10–P90), **진단 표**(노드별 범위 적합성·변화 원인 판정), 사용한 config 버전.

---

## 1. 입력 데이터 계약

| 필드 | 필수 | 비고 |
|---|---|---|
| `date` | ✓ | 일 단위. 주간 입력은 기존 `allocationObservations` 규칙(주 1관측, 7배 복제 금지) |
| `cost` | ✓ | `parseNumeric` 경유 |
| 결과 1개 (`installs`·`actions`·`revenue_d7`) | ✓ | CPR = cost ÷ 결과. ROAS 모드는 표시층에서 역수 |
| `country`·`platform`·`channel`·`campaign_name` | 최소 `channel` | 비면 상위 레벨로 접힘(기존 `getRowGroupKey` 규칙) |
| `adgroup_name`·`creative_id` | 선택 | 없으면 [E]의 소재 분해를 건너뛰고 "소재 분해 불가"를 말한다 |
| `impressions`·`clicks` | 선택 | 있으면 [E]에서 CPM·CTR·CVR 퍼널 분해 |
| `daily_budget` | 선택 | 있으면 예산 변경 이벤트를 지출 변화 추정 대신 실제 설정값으로 잡는다 |

전부 기존 효율 CSV 그룹의 필드다. 새로 추가되는 표준키는 `daily_budget` 하나(§10 결정 3).

---

## 2. 계층과 "배분 단위"

계층: `country > platform > channel > campaign > adgroup > creative`.

모든 레벨을 같은 방식으로 배분하지 않는다. 레벨마다 **역할**을 config가 정한다.

| 역할 | 의미 | 기본 레벨 |
|---|---|---|
| `allocate` | 예산 숫자를 제안하는 단위(곡선 적합 대상) | `campaign` |
| `constraint` | 하위 합의 상·하한을 거는 단위 | `country`, `channel` |
| `diagnose` | 예산은 안 주고 원인 진단만 | `adgroup`, `creative` |

이유: 광고그룹·소재 예산은 대개 플랫폼 자동 최적화(CBO·Advantage+ 등)가 나누므로 숫자를 줘도 실행할 수 없다. 대신 "이 캠페인의 CPR 악화는 소재 B 때문" 같은 진단으로 쓴다.

**희소 노드 처리(부분 풀링)**: 배분 단위 노드의 관측이 `curve.minPoints` 미만이면 곡선 모양을 부모(채널)에서 빌리고 수준만 노드 것으로 맞춘다.
`CPR_node(x) = CPR_parent(x) × k_node`, `k_node = median(관측 CPR_node ÷ CPR_parent(관측 cost))`. 화면에 "부모 곡선 차용"을 표시한다.

---

## 3. [B] 요일 모형

두 가지 요일 효과를 분리한다.

- **지출 요일 계수** `f_cost[d]`: 같은 일예산이어도 요일별로 소진이 다르다 → 예측 시 일 지출 분배에 사용.
- **CPR 요일 계수** `f_cpr[d]`: 같은 지출이어도 요일별 효율이 다르다 → 곡선 적합 전에 제거, 예측 시 다시 곱한다.

### 추정
1. 7일 중심 이동평균 대비 비율(ratio-to-moving-average)로 추세를 걷어낸다 — 성장 중인 계정에서 요일 효과가 추세에 오염되지 않게.
2. CPR 요일 계수는 **곡선 잔차에서** 뽑는다(백피팅 2회, 결정론):
   1회차 곡선 적합 → 잔차 `ln CPR − ln f(cost)`를 요일별 중앙값 → `f_cpr[d] = exp(중앙값)` → CPR을 나눠 2회차 적합.
   이렇게 해야 "토요일에 지출이 커서 CPR이 높은 것"과 "토요일이라 CPR이 높은 것"이 섞이지 않는다.
3. **계층 수축**: `f_node[d] = (n_d · raw_d + K · f_parent[d]) / (n_d + K)` (`K = dow.shrinkK`), 부모는 채널 → 전체 순. 마지막에 7개 평균이 1이 되도록 정규화.
4. 요일당 표본 `dow.minPerDay` 미만이면 그 요일은 부모 값. 명절 주(`utils/krLunarHolidays`)는 추정에서 제외.

요일 인덱스는 `getUTCDay()`(§7 함정). 기존 `anomalyMath` 요일 계수·`pacingMath.weekdayProfile`과 같은 정의를 쓰도록 공용 함수 하나로 뽑는다.

---

## 4. [C] 반응 곡선

**새 수학 없음.** 요일 보정된 점 `(cost_t, CPR_t / f_cpr[d_t])`을 기존 `fitAllocationChannel`에 넣는다.
- 모형 4종(Linear·Log·Power·Poly2) + R² 선택 — `ALLOC_MATH`
- 운영 패턴 구간 분리 — `selectAllocationRegime`
- 이상치 — `removeOutliers`(IQR·modZ)
- 최근성 가중 — `calcDateWeights`
- 예측 — `predictSafeCpr`(관측 범위 clamp·Poly2 꼭짓점 차단). 직접 `model.predict` 호출 금지(§7).

곡선 신뢰도는 기존 `allocConfidence`. 추가로 [D]의 잔차 폭 `σ`를 곡선과 함께 저장한다.

---

## 5. [D] 범위 적합성 — "지금 소진이 히스토리를 따르는가"

노드별 최근 `conformity.recentDays`일을, 그 이전 구간으로 적합한 곡선과 비교한다(최근을 학습에 넣으면 자기 자신과 비교하게 된다).

- 로그 잔차 `r_t = ln(CPR_t / f_cpr[d_t]) − ln f(cost_t)`
- 잔차 폭 `σ = 1.4826 × MAD(학습 구간 잔차)` (이상치에 강함)
- `z_t = r_t / σ`

| 판정 | 조건 (config) | 뜻 |
|---|---|---|
| `INSUFFICIENT` | 학습 점 < `curve.minPoints` | 판정 불가. 배분에서 "현행 유지" |
| `EXTRAPOLATING` | 최근 cost 중앙값 > `xMax × (1 + extrapolationTol)` 또는 < `xMin × (1 − tol)` | 관측해 본 적 없는 지출 수준. 곡선 예측은 추정치 |
| `DRIFT_WORSE` / `DRIFT_BETTER` | `|z| > zBand`인 날 비율 ≥ `breachShare` **그리고** 최근 잔차 중앙값이 같은 방향으로 `medianShift` 이상 | 같은 지출인데 CPR이 곡선에서 벗어남 → 곡선 자체가 움직였다 |
| `IN_RANGE` | 나머지 | 히스토리 범위 안 |

`DRIFT_*`가 뜨면 [E]가 원인을 찾고, 배분은 그 노드에 기존 `regimeMode:"auto"`(최근 구간 곡선)를 강제한다.

---

## 6. [E] 변화 원인 진단 — 예산 때문인가, 소재 때문인가

기준 구간 B와 최근 구간 R(또는 이벤트 전/후)의 CPR 변화를 **잔차 없이** 나눈다. 곡선 `f`는 B로만 적합한다.

### 6.1 1단: 곡선 위 이동 vs 곡선 이동

```
ln CPR_R − ln CPR_B
  = [ln f(c_R) − ln f(c_B)]                         ← 예산 효과 (같은 곡선 위에서 지출이 바뀐 몫)
  + [(ln CPR_R − ln f(c_R)) − (ln CPR_B − ln f(c_B))] ← 곡선 이동 (지출 말고 다른 것이 바뀐 몫)
```

CPR은 요일 보정값, `c`는 구간 평균 일 지출. `c_R`이 B의 관측 범위 밖이면 예산 효과는 외삽이므로 표시한다.

### 6.2 2단: 곡선 이동을 쪼갠다

**① 시장 공통분 (대조군)** — 같은 기간, 이벤트가 없던 다른 노드(같은 국가의 다른 채널 등, `diagnosis.controlScope`)의 곡선 이동 중앙값.
`노드 고유 이동 = 곡선 이동 − 시장 공통분`. 대조군이 `minControls` 미만이면 이 분리는 생략하고 "시장 요인 분리 불가".

**② 퍼널 (impressions·clicks 있을 때)** — 항등식 `CPR = CPM/1000 ÷ (CTR × CVR)`이라
`Δln CPR = Δln CPM − Δln CTR − Δln CVR` (무잔차).
- CPM ↑ → 경매·입찰 압력 (지출 증가로도 생김 → 1단 예산 효과와 함께 읽는다)
- CTR ↓ → 소재
- CVR ↓ → 랜딩·트래픽 품질·소재-랜딩 불일치

**③ 소재 (creative_id 있을 때)** — 노드 안 소재들로 Bennet 분해(5-21 PVM과 같은 결과량 비중·centering 규칙):
- **구성(mix)**: 비싼 소재로 비중이 옮겨간 몫 — 예: 신규 소재 투입, 좋은 소재 OFF
- **소재 내부(rate)**: 같은 소재가 나빠진 몫 → 소재 나이로 다시 나눈다
  - `age < creative.learningDays`: 신규 학습 구간
  - `age ≥ fatigue.minAgeDays` + CTR 하락: 피로 (기존 `CREATIVE_FATIGUE` 위험 판정 재사용)
  - 그 외: 미분류

### 6.3 이벤트 탐지
- **예산 이벤트**: `daily_budget` 변경, 없으면 7일 이동 지출이 `events.budgetChangePct` 이상 변한 날
- **소재 추가**: 소재 첫 지출일, 그 소재 지출 비중이 `events.minCreativeShare` 이상
- **소재 제거**: 마지막 지출일 이후 `events.removedAfterDays`일 무지출
- 이벤트 전후 `events.windowDays`일씩 비교. **창 안에 이벤트가 둘 이상이면 분리하지 않고 "혼재"** — 섞인 걸 나누는 척하지 않는다(§8.10).

### 6.4 판정 규칙 (모두 config)

각 성분이 전체 `|Δln CPR|`에서 차지하는 비율 `share`로 판정한다.

| 판정 | 규칙 | 화면 문장 예 |
|---|---|---|
| `BUDGET_CURVE` | 예산 효과 share ≥ `budgetDominant` | 증액으로 곡선의 비싼 구간에 들어감 |
| `CREATIVE` | 노드 고유 이동 중 (CTR 하락 + 소재 mix + 피로) share ≥ `creativeDominant` | 소재 B 피로·신규 소재 C 학습 중 |
| `MARKET` | 시장 공통분 share ≥ `marketDominant` | 같은 기간 다른 채널도 같이 나빠짐 |
| `FUNNEL_POST_CLICK` | CVR 하락 share ≥ `cvrDominant` | 클릭 이후 전환이 떨어짐(랜딩·트래픽 확인) |
| `MIXED` | 위 중 둘 이상이 각각 `mixedFloor` 이상 | 원인 여럿 |
| `INCONCLUSIVE` | 변화가 `σ × noiseMultiple` 이내, 또는 이벤트 혼재 | 노이즈 범위 |

판정 순서는 config `diagnosis.priority`. 이것은 **원인 후보**이지 인과 추정이 아니다 — 화면 문구도 "가능성이 큼"까지만(§8.6).

---

## 7. [F] 배분

목표: 총 일예산 `B`에서 예측 결과 합 최대(=혼합 CPR 최소). 기존 한계효용 그리디(`calculateAllocationModeB`·`improveAllocationFromCurrent`·`allocationDeltaPlan`) 위에 제약만 더한다.

### 7.1 노드별 상·하한 (config에서 파생)
| 제약 | 규칙 |
|---|---|
| 외삽 상한 | `max ≤ xMax × (1 + optimizer.extrapolationHeadroom)` |
| 일 변경폭 | `현재 × (1 − maxDailyDecrease) ≤ 제안 ≤ 현재 × (1 + maxDailyIncrease)` — 학습 리셋 방지 |
| 학습 하한 | 제안 지출에서의 예측 결과가 주 `learningMinWeeklyResults` 미만이면: 그 이상으로 올리거나 0(OFF 후보)으로. 중간값 금지 |
| 그룹 제약 | `constraint` 레벨(국가·채널)의 비중 `[minShare, maxShare]` |
| 고정 | `locked` 노드는 현재값 |

### 7.2 진단 결과 반영
| 노드 상태 | 배분 처리 |
|---|---|
| `INSUFFICIENT` | 현행 유지(배분 대상 제외) |
| `EXTRAPOLATING` | 증액 금지, 감액만 허용 |
| `DRIFT_*` | 최근 구간 곡선만 사용 |
| `CREATIVE`(피로) | 증액 상한 `creativeBlockedIncrease` (소재 교체 전엔 늘려도 같은 소재가 더 빨리 닳는다) |
| `BUDGET_CURVE`(악화) | 정상 — 곡선이 이미 반영. 별도 처리 없음 |

### 7.3 출력
노드별 `현재 → 제안`, 변화율, **제약에 걸렸으면 어떤 제약인지**, 예측 결과·CPR, 관측 범위 안/밖. 기존 5-3처럼 "현행 유지 + 증감분" 안과 "전체 재배분" 안을 같은 총예산으로 나란히 둔다.

---

## 8. [G] 성과 예측

기간 `H`일, 노드 `n`, 날짜 `t`(요일 `d`):

```
cost[n,t] = plan[n] × f_cost[n,d]         (config forecast.spendPacing = "dow" | "flat")
CPR[n,t]  = predictSafeCpr(f_n, cost[n,t]) × f_cpr[n,d] × fatigueMult[n,t]
result[n,t] = cost[n,t] / CPR[n,t]
```

- `fatigueMult`: 기본 1. `forecast.applyFatigue = true`이고 노드 주력 소재가 피로 예측(`CREATIVE_FATIGUE.projectThreshold`) 기간에 들어가면 그 날부터 `1 + fatiguePenalty`. 시나리오로만 켠다.
- **구간**: 노드별 학습 잔차의 경험 분위수(`forecast.lowerQ`·`upperQ`)를 로그 공간에서 적용. 몬테카를로 없음(§8.3 결정론).
- **노드 합산 구간**: 독립 가정은 폭을 과소평가한다(시장 충격은 노드끼리 같이 온다). `forecast.intervalAggregation`
  - `comonotonic`(기본): 분위수를 그대로 합 → 보수적 상한
  - `independent`: 분산 합 → 좁음. 고를 때 화면에 가정을 적는다.
- **백테스트**: 마지막 `backtest.holdoutDays`일을 빼고 같은 절차로 예측해 실제와 비교. MAPE와 구간 적중률을 함께 보여 준다. 적중률이 `backtest.minCoverage` 미만이면 구간 옆에 "실제보다 좁을 수 있음".
- 외삽 노드가 들어 있으면 예측 합에 "관측 범위 밖 N개 포함" 표시.

### 8.1 시나리오 (예산·소재 추가/삭제)
| 시나리오 | 계산 |
|---|---|
| 예산 ±X% | 같은 곡선에서 재배분·재예측 |
| 소재 OFF | 그 소재를 빼고 노드 CPR을 남은 소재들의 결과 가중 CPR로 재계산(구성 효과만). 남은 소재의 증액분 효율은 모름 → 표시 |
| 신규 소재 투입 | 그 노드의 과거 신규 소재 첫 `learningDays`일 CPR ÷ 노드 CPR 비율의 중앙값을 학습 구간 패널티로. 과거 신규 소재가 `creative.minHistoricalLaunches` 미만이면 "추정 불가" |

---

## 9. config 설계

### 9.1 원칙
1. 엔진 코드에 임계값 리터럴 금지. 모든 규칙은 `PLANNER_CONFIG`에서 읽는다.
2. **얼린 기본값 + 계층 덮어쓰기**: `defaults → channel → country×channel` 순서로 병합. 예: Meta만 학습 하한 50.
3. **검증**: `validatePlannerConfig(cfg)`가 모르는 키·범위 밖 값·타입 불일치를 거절한다(조용히 무시 금지, §7 "모르는 미래 값은 거절").
4. `version`을 분석 시그와 다운로드 README에 넣는다 — 같은 CSV + 같은 config = 같은 결과.
5. 사용자 화면에서 고칠 수 있는 키와 개발자만 고치는 키를 `editable` 목록으로 가른다.

### 9.2 스키마 (기본값은 출발점이며 실데이터 백테스트로 조정)

```js
// src/lib/budgetPlanner/plannerConfig.js
export const PLANNER_CONFIG = Object.freeze({
  version: "1.0.0",

  hierarchy: {
    levels: ["country", "platform", "channel", "campaign_name", "adgroup_name", "creative_id"],
    roles: { allocate: "campaign_name", constraint: ["country", "channel"], diagnose: ["adgroup_name", "creative_id"] },
  },

  metric: { result: "installs", view: "cpr" },        // "cpr" | "roas"

  dow: {
    enabled: true,
    lookbackWeeks: 8,
    minPerDay: 3,           // 요일당 최소 표본, 미만이면 부모 값
    shrinkK: 4,             // 부모 쪽 수축 강도
    excludeHolidays: true,
    backfitIterations: 2,
  },

  curve: {
    minPoints: 6,
    models: ["Linear", "Log", "Power", "Poly2"],
    outlier: { method: "iqr", strength: "standard" },
    weightMode: "exponential", halfLifeDays: 30,
    regimeMode: "auto",
    borrowParentBelow: 6,   // 이 점 수 미만이면 부모 곡선 모양 차용
  },

  conformity: {
    recentDays: 7,
    zBand: 2.0,
    breachShare: 0.5,
    medianShift: 0.15,      // 로그 잔차 중앙값(≈15%)
    extrapolationTol: 0.1,
  },

  events: {
    budgetChangePct: 0.2,
    minCreativeShare: 0.1,
    removedAfterDays: 3,
    windowDays: 7,
  },

  diagnosis: {
    controlScope: "same_country_other_channels",
    minControls: 2,
    noiseMultiple: 1.0,
    budgetDominant: 0.6,
    creativeDominant: 0.5,
    marketDominant: 0.5,
    cvrDominant: 0.5,
    mixedFloor: 0.3,
    priority: ["INCONCLUSIVE", "MARKET", "BUDGET_CURVE", "CREATIVE", "FUNNEL_POST_CLICK", "MIXED"],
  },

  creative: {
    learningDays: 7,
    minHistoricalLaunches: 3,
    fatigue: { minAgeDays: 14, useRiskEngine: true },   // CREATIVE_CONFIG.fatigueRisk 재사용
  },

  optimizer: {
    stepPct: 0.002,
    maxDailyIncrease: 0.2,
    maxDailyDecrease: 0.3,
    extrapolationHeadroom: 0.1,
    learningMinWeeklyResults: 0,      // 기본 끔, 채널별로 켬
    creativeBlockedIncrease: 0.0,
    groupShares: {},                  // { "country:KR": [0.4, 0.8] }
    locked: [],
    statePolicy: {
      INSUFFICIENT: "hold",
      EXTRAPOLATING: "decrease_only",
      DRIFT_WORSE: "recent_regime",
      DRIFT_BETTER: "recent_regime",
    },
  },

  forecast: {
    horizonDays: 14,
    spendPacing: "dow",
    lowerQ: 0.1, upperQ: 0.9,
    intervalAggregation: "comonotonic",
    applyFatigue: false, fatiguePenalty: 0.15,
  },

  backtest: { holdoutDays: 14, minCoverage: 0.7 },

  overrides: {
    channel: {
      Meta:   { optimizer: { learningMinWeeklyResults: 50, maxDailyIncrease: 0.2 } },
      Google: { optimizer: { maxDailyIncrease: 0.3 } },
    },
    country_channel: {},
  },

  editable: [
    "metric.result", "forecast.horizonDays", "optimizer.maxDailyIncrease", "optimizer.maxDailyDecrease",
    "optimizer.groupShares", "optimizer.locked", "forecast.intervalAggregation",
  ],
});
```

`learningMinWeeklyResults: 50`, `maxDailyIncrease: 0.2`는 업계에서 흔히 쓰는 운영 가이드를 옮긴 예시값이다. 계정마다 다르므로 채널별 덮어쓰기로 둔다.

### 9.3 함수 계약
```js
resolvePlannerConfig(base, userPatch)       // 병합 + 검증, 실패 시 { ok:false, errors:[{path, reason}] }
configFor(cfg, { country, channel })        // 노드에 적용될 실효 config
plannerConfigSignature(cfg)                 // 분석 시그에 포함
```

---

## 10. 구현 전 결정할 것 (§2.7)

| # | 질문 | 선택지 | 추천 |
|---|---|---|---|
| 1 | 어디에 붙이나 | A. 5-3 예산 배분 확장 / B. 새 도구(5-30) | **A** — 같은 효율 CSV 그룹, 곡선·배분 코드 재사용. [D][E]는 5-3 "확인" 탭과 5-22·9-6 링크로 |
| 2 | 기본 배분 단위 | campaign / channel | **campaign** — 데이터가 얇으면 부모 곡선 차용으로 버틴다 |
| 3 | `daily_budget` 표준키 추가 | 추가 / 지출 변화로만 추정 | **추가(선택 필드)** — 예산 이벤트 탐지 정확도가 크게 다르다 |
| 4 | 합산 구간 기본값 | comonotonic / independent | **comonotonic** — 좁은 구간이 틀리는 쪽이 더 해롭다 |

---

## 11. 한계 (화면·문서에 그대로 적을 것)

- **관측 곡선은 인과 곡선이 아니다.** 플랫폼은 효율 좋은 날 더 쓰므로 cost와 CPR이 역방향으로 얽힌다. 예산 변경 이벤트 전후([E] 6.3)가 상대적으로 깨끗한 근거이고, 이벤트 기반 탄력성이 쌓이면 곡선 검증에 쓴다. 증분 자체는 5-23 홀드아웃이 답이다.
- 소재·예산이 같은 창에서 바뀌면 분리하지 않는다("혼재").
- 관측 최대 지출 밖의 예측은 추정치다(외삽 상한으로 제한).
- 요일 계수는 최근 `lookbackWeeks` 기준이라 시즌 전환기엔 늦게 따라온다.

---

## 12. 모듈 배치와 기존 코드 재사용

| 새 모듈 (순수) | 내용 | 재사용 |
|---|---|---|
| `lib/budgetPlanner/plannerConfig.js` | §9 | — |
| `utils/dowProfile.js` | §3 공용 요일 계수 | `anomalyMath`·`pacingMath`의 요일 정의를 여기로 수렴(기존 골든 byte-identical 확인) |
| `utils/plannerHierarchy.js` | §2 계층 집계·부모 곡선 차용 | `getRowGroupKey`, `allocationPointMap` |
| `utils/allocationConformity.js` | §5 | `fitAllocationChannel`, `predictSafeCpr` |
| `utils/performanceChangeDiagnosis.js` | §6 | PVM Bennet(5-21), `CREATIVE_FATIGUE` |
| `utils/plannerAllocate.js` | §7 제약 래퍼 | `calculateAllocationModeB`, `improveAllocationFromCurrent`, `allocationDeltaPlan` |
| `utils/plannerForecast.js` | §8 | `predictSafeCpr`, `krLunarHolidays` |

**기존 `allocationMath.js`·`satMath.js`·`creativeMath.js` 수학은 수정하지 않는다.**

---

## 13. 검증 계획

| 대상 | 골든·픽스처 |
|---|---|
| 요일 | 주말 CPR ×1.3을 심은 합성 데이터 → 계수 복원 / 주말에 지출만 큰 데이터 → CPR 계수 ≈1(백피팅이 혼동을 걷어내는지) |
| 범위 적합성 | 같은 곡선 데이터 → `IN_RANGE` / 곡선 ×1.4 이동 → `DRIFT_WORSE` / 지출 2배 → `EXTRAPOLATING` |
| 원인 분해 | ① 증액만(곡선 고정) → `BUDGET_CURVE` ② 지출 고정·소재 CTR 하락 → `CREATIVE` ③ 전 채널 동시 CPM 상승 → `MARKET` ④ 예산·소재 같은 주 변경 → `INCONCLUSIVE`(혼재). **각 성분의 부호와 크기**를 단언(Simpson 함정, §7) |
| 항등식 | 1단·퍼널·소재 분해 합 = 전체 Δln CPR (저장 정밀도 기준 tolerance) |
| 배분 | 일 변경폭·학습 하한(0 또는 하한 이상, 중간값 없음)·외삽 상한·잠금이 지켜지는지. 제약 없음 + 동일 곡선 → 기존 5-3 결과와 일치 |
| 예측 | 백테스트 적중률이 정답을 아는 합성 데이터에서 명목값 근처 |
| config | 모르는 키·음수 비율·`lowerQ ≥ upperQ` 거절 / 채널 덮어쓰기 병합 순서 / 같은 입력+config → byte-identical |
| 결정론 | `Math.random` 금지, 모든 정렬에 tiebreak |
