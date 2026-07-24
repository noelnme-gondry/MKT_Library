# MMM Decomp 상위 요소 분해 재설계 계획

작성 기준: 2026-07-24  
대상: `v2-migration` MarketingResponse MMM  
상태: 핵심 재설계 구현 완료 — 집계 엔진·동시 캐시·모델 토글·Trend freeze 반영

> **구현 범위**: Performance·Branding 원시 Cost 집계, 집계 후 Adstock·Hill,
> same-data media prior 비활성화, 절편/순수 추세 분리, 동일 rolling fold 채택 게이트,
> Classic/Bayesian-like 동시 계산·캐시 토글, 명시적 `52/78/104주 × 0/1/2개 꺾임`
> profile, `paidCostTotalNuisance` 전용 freeze를 반영했다.

> **동반 문서**: 본 계획은 *무엇을·어떤 순서로* 정한다. 불확실성·식별을 *어떻게 계산* 하는지(covariance·절단정규 메커니즘)는 `docs/mmm-bayesian-lookalike-spec.md`에 있다. §4.4·§7.3·§8.2가 요구하는 CI·`0~X`·경계판정은 그 문서 없이는 계산 불가 → **두 문서 병합 구현**(문제 A·F).

---

## 1. 결론

현재 Decomp는 16개 광고 채널을 각각 회귀한 뒤, 채널별 기여를 `Performance`와 `Branding`으로 사후 합산한다.

그러나 Decomp의 목적이 다음 상위 요소를 분해하는 것이라면 현재 구조는 목적과 맞지 않는다.

```text
기본 수요
+ 추세
+ 계절성
+ 업황
+ 이벤트
+ Performance
+ Branding
+ 잔차
```

Decomp는 주별 원시 Cost를 다음 두 그룹으로 먼저 합산한 뒤, 두 그룹을 각각 하나의 미디어 변수로 적합해야 한다.

```text
Performance Cost 합
Branding Cost 합
```

채널별 분석은 Decomp 총량을 다시 추정하는 별도 회귀가 아니라, 확정된 상위 그룹 총량 안에서 채널 몫을 귀속하는 하위 단계로 분리한다.

---

## 2. 기존 전제 정정

### 2.1 실제 Decomp 동작

현재 엔진은 각 채널에 대해 별도 설계열을 만든다.

```text
media_<channel>
= Hill(Adstock(channel cost))
```

모든 채널 설계열을 하나의 회귀에 동시에 넣고, 적합 후 다음처럼 그룹 표시값을 만든다.

```text
Decomp Performance
= Σ performance 채널별 기여

Decomp Branding
= Σ branding 채널별 기여
```

따라서 현재 Decomp는 `Performance cost-total`과 `Branding cost-total`을 직접 적합하는 상위 요소 모델이 아니다.

### 2.2 잘못된 논증 철회

다음 주장은 철회해야 한다.

```text
Decomp는 cost-total을 적합하므로 채널 공선성과 무관하다.
```

실제로는 16개 채널 변수가 동시에 들어가므로 다음 요소가 Performance·Branding 합계에 직접 영향을 준다.

- 채널 간 공선성
- 채널별 비음수 계수 제약
- 채널별 Adstock·Hill 변환 선택
- 채널별 prior
- 추세·계절성·업황과 채널 변수의 중첩

따라서 기존 Decomp의 약 88K를 정당한 하한으로 확정할 수 없다.

### 2.3 RRM 숫자 격리

RRM의 약 272K는 다음 조건이 통일되기 전까지 Decomp와 비교하거나 상·하한으로 사용하지 않는다.

- 동일 입력 파일
- 동일 데이터 해시
- 동일 분석 기간
- 동일 타깃
- 동일 기여 정의
- 동일 광고 변환 단위
- 동일 집계 윈도우

RRM의 z-score 기반 component는 수치상 타깃 단위를 가질 수 있지만, 평균 대비 signed component이므로 Decomp의 zero-spend 대비 비음수 기여와 estimand가 다르다.

---

## 3. 목표 아키텍처

```text
원본 주별 채널 Cost
├─ Σ performance_* → Performance Cost
└─ Σ brand_*       → Branding Cost

Performance Cost → 그룹 단위 Adstock·Hill ┐
Branding Cost    → 그룹 단위 Adstock·Hill ├─ 상위 Decomp 공동 적합
CV-frozen Trend                           │
Seasonality·Industry·Events               ┘

상위 Decomp
├─ Performance 총기여 → Performance 채널 내부 귀속
└─ Branding 총기여    → Branding 채널 내부 귀속
```

상위 Decomp와 채널 귀속의 역할은 엄격히 분리한다.

| 엔진 | 목적 | 총량 결정 권한 |
|---|---|---|
| 상위 Decomp | 기본 수요·추세·계절성·업황·이벤트·Performance·Branding 분해 | 있음 |
| 채널 귀속 | Performance/Branding 그룹 내부 채널 몫 산출 | 없음 |
| 채널 진단 | 채널별 포화·공선·변환·식별 가능성 진단 | 없음 |
| Forecast | 미래 예산 시나리오 예측 | Decomp와 별도 |

### 3.1 그룹 총량 SSOT — 대칭 교차검증 (계층 아님)

그룹 총량을 낼 수 있는 후보가 둘이다. **둘은 다른 estimand다**(`Hill(A+B) ≠ Hill(A)+Hill(B)`) → 어느 쪽도 단독 ground truth 아님. primary/secondary 계층을 두지 않고 **대칭 교차검증**한다.

| 후보 | 성질 |
|---|---|
| 집계 2그룹 모델 `Hill(Adstock(Σcost))` | clip 없음·2열이라 잘 식별. 단 saturation은 블렌드 |
| joint 16채널 모델의 covariance 합산 `aᵀβ` (bayesian doc §2.2) | 채널 구조 보존. 단 point가 채널 clip 편향 안음 |

```text
두 값 rel_diff ≤ 0.15  → 일치 → 의사결정 등급 그룹 총량으로 보고(양쪽 병기)
두 값 rel_diff > 0.15  → "그룹 정의/포화 가정 민감" → 그룹 ABSTAIN
```

즉 "상위 Decomp가 총량 권한을 갖는다"는 곧 **두 산출이 일치하는 구간에 한해서**다. 불일치는 억지 단일화 대신 보류(정직성).

---

## 4. 상위 Decomp estimand

### 4.1 Cost 합산

주별 그룹 Cost는 원시 채널 Cost를 먼저 합산한다.

```text
performanceCost[t]
= Σ performance channel raw cost[t]

brandingCost[t]
= Σ branding channel raw cost[t]
```

Prism 파일에서는 사용자 정의에 따라 `*_impressions` 컬럼도 전부 Cost로 취급한다.

### 4.2 변환 순서

Cost를 합산한 뒤 그룹 단위 Adstock·Hill 변환을 적용한다.

```text
Performance media variable
= Hill(Adstock(performanceCost))

Branding media variable
= Hill(Adstock(brandingCost))
```

고정된 동일 감쇠율 `α`와 동일 초기 상태를 사용하는 Adstock 연산은 선형이므로 채널 합산과 순서를 바꿔도 같다.

```text
Adstock(Σ Cost_i)
=
Σ Adstock(Cost_i)
```

채널마다 서로 다른 `α`를 사용하면 위 등식은 성립하지 않는다. 상위 Decomp는 그룹별 `α` 하나를 선택하므로, 채널별 서로 다른 잔효를 보존하는 모델이 아니라 그룹 전체의 평균적 잔효를 나타낸다.

그러나 Hill은 비선형이므로 다음 두 계산은 같지 않다.

```text
Hill(Adstock(Σ Cost_i))
≠
Σ Hill(Adstock(Cost_i))
```

상위 요소 Decomp의 estimand에는 전자를 사용한다.

집계 Hill은 여러 채널의 포화 곡선을 하나로 섞은 블렌드 반응이다. 과거 기간의 `Performance`·`Branding` 상위 총량 분해에는 사용할 수 있지만, 개별 채널의 미래 한계효용이나 예산 배분 근거로 사용하지 않는다.

```text
집계 Hill
→ 과거 상위 그룹 Decomp: 사용
→ 채널별 미래 예산 배분: 사용 금지
```

### 4.3 최종 상위 모델

```text
RR[t]
= intercept
+ frozenTrend[t]
+ seasonality[t]
+ industry[t]
+ events[t]
+ βperf  × Hill(Adstock(performanceCost[t]))
+ βbrand × Hill(Adstock(brandingCost[t]))
+ residual[t]
```

Performance와 Branding 두 그룹조차 식별되지 않으면 억지로 분리하지 않는다.

```text
Performance vs Branding: NOT IDENTIFIED
Paid Media combined: 별도 식별 판정
```

### 4.4 기여 정의

상위 Decomp의 1차 estimand는 가산 component다.

```text
groupContribution[g,t]
= β_g × transformedGroupCost[g,t]
```

이 convention을 사용하므로 다음 항등식이 정확히 성립한다.

```text
fitted[t]
= interceptContribution[t]
+ trendContribution[t]
+ seasonalityContribution[t]
+ industryContribution[t]
+ eventContribution[t]
+ performanceContribution[t]
+ brandingContribution[t]
```

이 값은 모델 예측값을 구성하는 가산 기여이며, 홀드아웃으로 식별된 인과 증분이나 ROI가 아니다.

향후 ROI·증분 분석이 필요하면 별도 estimand를 사용한다.

```text
counterfactualIncrement[g,t]
= prediction(observed cost path)
- prediction(group g cost path = 0)
```

Adstock carryover가 있으므로 반사실은 해당 주의 Cost만 0으로 바꾸는 것이 아니라 그룹의 전체 Cost 경로를 0으로 둔 뒤 상태를 다시 계산해야 한다.

가산 Decomp와 반사실 증분은 화면·CSV·코드 필드를 공유하지 않는다.

| 목적 | estimand | 사용처 |
|---|---|---|
| 상위 요소 분해 | `β × transformed feature` | Decomp |
| 인과 증분·ROI 후보 | 관측 경로 예측 − zero-cost 경로 예측 | 별도 증분 화면 |

---

## 5. 추세와 regularization 원칙

### 5.1 현재 WIP 격리

다음 미검증 변경은 프로덕션에 병합하지 않는다.

- `trendPenalty = mediaPenalty × 4`
- straight-trend reference prior
- business-contribution prior의 프로덕션 강제 활성화
- 통제변수 잔차 상관을 이용한 채널별 변환 선선택
- 16개 채널 합산값을 상위 Decomp 총량으로 사용하는 경로

현재 WIP는 비교 실험용 스냅샷으로만 보존한다.

### 5.2 Trend flexibility freeze

추세 유연성은 미디어 기여를 확인하기 전에 rolling-origin CV로 선택한다.

현재 엔진의 추세 관련 노브를 다음처럼 구분한다.

| 노브 | 후보 | Stage 3에서 freeze |
|---|---|---|
| 저주파 smoothing window | `52, 78, 104주` | 예 |
| 꺾임 개수 | `0, 1, 2개` | 예 |
| 꺾임 위치 | 각 학습 fold 안에서 결정론적으로 탐색 | 예 |
| 구간 방향 | 학습 fold 저주파 곡선의 부호로 결정 | 예 |
| 추세 basis | 방향 제약 hinge, 같은 방향 구간은 크기 공유 | 예 |
| Trend 전용 penalty multiplier | 사용하지 않음, 항상 `1` | 고정 |
| 공통 regularization | T1~T4에서 별도 검증 | 최종 config에 기록 |

Stage 3의 후보 하나는 다음 완전한 객체다.

```text
trendFlexCandidate
= {
  smoothingWindowWeeks,
  knotCount,
  knotLocations,
  segmentDirections,
  basis: "direction-hinge-shared"
}
```

각 rolling fold에서는 해당 fold의 학습 구간만 사용해 꺾임 위치와 방향을 생성한다. 검증 구간이나 전체 이력을 이용해 fold의 추세 구조를 미리 정하지 않는다.

후보 선택은 미디어 변수를 제외한 다음 non-media 모델의 rolling-origin WMAPE로 수행한다.

```text
Y
= intercept
+ trend candidate
+ seasonality
+ industry
+ events
+ paidCostTotalNuisance        # Performance+Branding 원시 cost 합, 잔효 없는 raw nuisance
```

**주의(FWL, 문제 B)**: media를 완전히 뺀 채로 추세 구조를 고르면, 추세와 강상관인 항(특히 Branding, 집행 패턴 vs 추세 r≈0.72)의 장기 모양이 frozen trend에 **미리 박힌다**(Performance는 r≈0.26이라 영향 작음). 이를 막기 위해 freeze 단계 non-media 모델에 **`paidCostTotalNuisance`(전체 유료 cost 합, 단일 raw 열)** 을 nuisance로 포함해 미디어 공통 장기 신호를 흡수시킨 뒤 추세 구조만 고른다. 이 nuisance는 추세 구조 선택에만 쓰고 본 적합에는 넘기지 않는다.

후보별 평균 WMAPE가 최소인 구조를 찾고, 최저 오차에서 1 standard error 안에 있는 후보 중 자유도가 가장 낮은 구조를 선택한다.

```text
trend_basis candidates
→ rolling-origin CV
→ one-standard-error parsimony rule
→ trendFlexFrozen
→ 이후 read-only
```

최종 객체는 다음 정보를 함께 저장한다.

```text
trendFlexFrozen
= {
  smoothingWindowWeeks,
  knotCount,
  knotLocations,
  segmentDirections,
  basis,
  foldWmapes,
  meanWmape,
  standardError,
  selectedBy: "rolling-origin-one-se-rule",
  dataHash,
  frozen: true
}
```

후속 단계가 다음 값을 변경하면 assert 실패로 처리한다.

- smoothing window
- 꺾임 개수
- 꺾임 위치
- 구간 방향
- basis
- Trend penalty multiplier

### 5.3 Penalty falsification과 운영값

아래 표는 원인 확인용 진단 실험으로 보존한다. **운영 모델은 Classic과
Bayesian-like 모두 Media penalty를 `0`으로 강제**하고 자동 선택 후보도 `[0]`으로
고정한다. 식별이 약한 채널은 coefficient를 임의 수축하지 않고 posterior 범위와
`ABSTAIN`으로 표시한다.

| 실험 | Trend penalty | Media penalty | 목적 |
|---|---:|---:|---|
| T1 | 4 | 4 | 대칭 |
| T2 | 8 | 4 | ×2 민감도 |
| T3 | 16 | 4 | 현재 WIP ×4 |
| T4 | 공통 CV 선택 | 동일 값 | 정식 후보 |

각 실행에서 다음을 기록한다.

- Performance 기여
- Branding 기여
- Paid Media 합산 기여
- Trend 이동
- Industry 이동
- rolling WMAPE
- 그룹 계수와 불확실성 구간
- Performance와 Branding의 상관·VIF
- penalty 변화에 대한 기여 민감도

원하는 회사 숫자와 가까운 penalty를 고르지 않는다. rolling-origin 예측 성능과 관심량 안정성으로 선택한다.

### 5.4 Same-data prior 금지

상위 Decomp에서는 같은 타깃 데이터에서 만든 다음 prior를 사용하지 않는다.

- business-contribution prior
- straight-trend reference prior

단, 전체 유료 미디어가 3주 이상 사실상 0이 된 뒤 재가동된 자연실험은 다음
cross-fit 계약을 모두 만족할 때만 Bayesian-like의 약한 채널 prior로 사용할 수 있다.

- blackout 직전 데이터만으로 pilot 모델과 변환을 고정
- blackout·재가동 outcome은 검증 전용으로 보류
- 다른 재가동 채널의 pilot 예상 lift를 먼저 차감
- 후보 채널의 양(+) 효과 확률이 80% 이상일 때만 prior 생성
- prior 생성에 사용한 blackout·재가동 주는 최종 likelihood에서 제외
- gate 실패 시 prior를 전달하지 않고 `ABSTAIN` 유지
- flexible-trend reference prior

외부 홀드아웃 실험이나 독립 참고시장처럼 타깃 데이터와 분리된 근거만 명시적 외부 prior 후보가 될 수 있다.

### 5.5 집계 모델 채택 게이트

상위 2그룹 집계가 단순하다는 이유만으로 자동 채택하지 않는다. 동일한 rolling-origin fold에서 다음 두 모델을 비교한다.

```text
Aggregate model
= Performance total + Branding total

Channel model
= 16 individual media channels
```

fold별 비교값:

```text
delta[f]
= WMAPE_aggregate[f] - WMAPE_channel[f]
```

판정은 paired one-standard-error rule을 사용한다.

| 조건 | 판정 |
|---|---|
| `mean(delta) <= SE(delta)` | `AGGREGATE ACCEPT` — 예측력이 동등한 단순 모델 채택 |
| `mean(delta) > SE(delta)`이고 aggregate가 3개 fold 중 2개 이상 열세 | `STRUCTURAL LOSS` |
| fold 부족 또는 결과 불안정 | `ABSTAIN` |

`STRUCTURAL LOSS`이면 채널 모델을 Decomp로 되돌리지 않는다. 채널 mix가 실제 예측 신호를 담고 있다는 뜻이므로 상위 estimand와 예측 구조의 충돌을 보고하고, 그룹 mix 진단이나 추가 데이터 설계를 수행한다.

**운영 정의(문제 D — 이 상태에서 무엇을 배포하나)**: `STRUCTURAL LOSS`여도 화면은 **집계 2그룹 Decomp를 계속 표시하되 상단에 명시적 경고 배너**를 단다("채널 mix가 예측 신호를 담고 있어 집계 총량이 예측력에서 열세 — 총량은 참고용, 인과 해석 보류"). 집계를 차단(빈 화면)하지 않는다. 단 이 상태에서는 **예산·의사결정 등급 숫자로 승격 금지**(§3.1 ABSTAIN과 동일 취급), CSV/문서 provenance에 `structural_loss:true` 기록.

최종 산출물에는 다음을 함께 기록한다.

- 두 모델의 fold별 WMAPE
- 평균 차이와 standard error
- fold 승패
- aggregate 채택·보류 사유

---

## 6. 코드 구조 변경

### 6.1 상위 Decomp 전용 진입점

현재 `mmmBayesianRun`을 모든 목적에 공유하지 않고 다음 순수 진입점을 추가한다.

```text
buildMmmAggregateMediaPanel()
mmmBayesianDecompRun()
```

`buildMmmAggregateMediaPanel()`은 기존 채널을 다음 두 pseudo-channel로 변환한다.

```text
__performance_total
__branding_total
```

상위 Decomp 실행 시 다음 조건을 강제한다.

- 미디어 설계열은 최대 2개
- Performance·Branding Cost는 원시 Cost 합계
- 합계 이후 그룹 단위 Adstock·Hill 적용
- 내부 same-data media prior 비활성화
- Performance·Branding에 동일한 regularization 체계
- CV로 고정한 추세만 사용
- 경계 0과 genuine null을 구분

### 6.2 앱 모델 상태 분리

현재 `mmm.run` 하나에 여러 역할이 결합된 구조를 분리한다.

```text
mmm.decompRun
  상위 요소 분해 전용

mmm.channelAttribution
  상위 그룹 총량 내부 채널 귀속

mmm.channelDiagnosticRun
  채널별 포화·공선·반응 진단

forecastModel
  미래 시나리오 예측 전용
```

채널 진단 모델은 상위 Decomp 총량을 변경할 수 없다.

---

## 7. 채널 귀속 엔진

### 7.1 총량 보존

채널별 숫자는 독립적으로 새로운 광고 총량을 만들지 않는다.

```text
Σ performance channel contribution[t]
= Decomp Performance contribution[t]

Σ branding channel contribution[t]
= Decomp Branding contribution[t]
```

기간 합계에서도 같은 항등식이 성립해야 한다.

**주의(문제 E)**: 이 항등식은 §7.2에서 채널 share를 합 1로 정규화한 뒤 그룹 총량에 곱하기 때문에 **구성상(by construction) 자동 성립**한다. 즉 이 항등식이 통과했다는 사실은 "채널이 올바르게 추정됐다"는 검증이 **아니다** — 단지 배분이 총량을 보존한다는 회계 항등식일 뿐이다. 채널 추정의 타당성은 §7.3 Gate C(식별 태깅)로 별도 판정한다.

### 7.2 권장 귀속 절차

1. 그룹 내부 채널 변환으로 상대 신호만 추정한다.
2. Gate C로 채널별 식별 가능성을 먼저 검사한다.
3. 식별 가능하면 nonnegative constrained share를 산출한다.
4. 주별 채널 share 합계를 1로 정규화한다.
5. 상위 그룹 기여에 채널 share를 곱한다.
6. 식별 실패 시 채널별 유저 수 확정을 보류한다.

```text
channelContribution[i,t]
= groupContribution[g,t] × channelShare[i,t]
```

### 7.3 식별 실패 처리

다음 조건에서는 채널별 성과를 0으로 표시하지 않는다.

- 높은 VIF
- 높은 pairwise correlation
- 넓은 계수 구간
- 비음수 제약 경계에 붙은 계수
- 활성 주 부족
- 변환된 관측 범위 부족

표시 taxonomy:

```text
IDENTIFIED
BOUNDARY / UNIDENTIFIED
ABSTAIN
```

기존 `signal share`와 `spend share`의 볼록결합은 정식 기여 공식으로 사용하지 않는다. 필요하면 `참고 배분`으로만 별도 표시한다.

### 7.4 사용자 기대치

Prism처럼 채널 수가 많고 집행 패턴이 함께 움직이는 데이터에서는 채널별 Gate C가 대부분 `ABSTAIN`일 수 있다.

이는 빈 화면이나 계산 실패가 아니다. 이 설계의 기본 산출물은 다음 상위 총량이다.

```text
Performance 총기여
Branding 총기여
```

채널별 유저 수는 추가 식별 조건을 통과한 경우에만 제공한다.

UI 기본 문구:

```text
상위 그룹 총량은 추정됐지만 채널별 분리는 공선성 때문에 보류됐습니다.
이는 채널 성과가 0이라는 뜻이 아닙니다.
```

---

## 8. UI 변경

### 8.1 Decomp 화면

다음 요소를 독립적으로 표시한다.

- 기본 수요·절편
- 순수 추세
- 계절성
- 업황
- 이벤트
- Performance
- Branding
- 잔차

절편을 `Trend`에 숨겨 합치지 않는다.

### 8.2 채널 분석 화면

다음을 노출한다.

- Performance·Branding 상위 그룹 총량
- 그룹 내부 채널 귀속
- 채널 합계와 그룹 총량의 검산 행
- 식별 가능 여부
- 공선으로 인한 보류
- 비음수 경계 0 여부
- 귀속 방식과 신뢰도

채널별 숫자는 `독립 Decomp 결과`가 아니라 `상위 그룹 내부 귀속`이라고 명시한다.

### 8.3 Penalty UI

Media penalty 조정 UI와 자동 선택 카피는 제거한다. 모델 토글 옆에는
`Media penalty 0`을 고정 표시한다. 완전 중단 구간이 있으면 `Blackout prior 적용`
또는 `Blackout 감지 · prior 보류`를 함께 표시하고, export provenance에도 판정 근거와
제외 기간을 기록한다.

---

## 9. Prism 고정 검증 계약

입력:

```text
/Users/gondry/Downloads/MMM Data - MMM Data set for Prism (3).csv
```

기간:

```text
모델 적합: 2022-01-03 ~ 2025-12-22
기여·Cost 집계: 2024-01-01 ~ 2025-12-22
```

고정 원자료 합계:

| 항목 | 값 |
|---|---:|
| Performance Cost | 2,448,444 |
| Branding Cost | 10,014,138 |
| 전체 Cost | 12,462,582 |
| 실제 RR | 5,296,514 |

2026-07-25 구현 검증:

| 항목 | 결과 |
|---|---:|
| 선택 smoothing window | 104주 |
| 선택 꺾임 | 0개 |
| 선택 방향 | 하락 |
| Trend freeze WMAPE | 2.73% |
| Classic aggregate rolling WMAPE | 3.20% |
| Bayesian-like channel rolling WMAPE | 3.83% |
| 동일 fold cut | 104 / 150 / 196주 |
| 채택 게이트 | `AGGREGATE ACCEPT` |

위 숫자는 특정 기여 총량에 맞춘 선택값이 아니라, 고정 Prism 파일에서 rolling-origin
예측 검증으로 재현된 진단값이다.

모든 결과에는 다음 provenance를 기록한다.

- 파일명
- SHA-256 데이터 해시
- 분석 시작일·종료일
- 모델 적합 시작일·종료일
- 코드 버전
- 설정 JSON
- estimand 정의

---

## 10. 필수 테스트

### 10.1 상위 Decomp 항등식

주별·전체 기간에 대해 다음을 검증한다.

```text
fitted
= intercept
+ trend
+ seasonality
+ industry
+ events
+ performance
+ branding

actual
= fitted + residual
```

### 10.2 채널 귀속 항등식

```text
Σ performance channels
= performance group

Σ branding channels
= branding group
```

주별·전체 허용오차는 `1e-8` 수준으로 둔다.

### 10.3 구조 테스트

- Decomp 설계행렬의 미디어 열이 정확히 2개인지
- Performance Cost가 4개 Performance 채널의 주별 원시 합인지
- Branding Cost가 12개 Branding 채널의 주별 원시 합인지
- Cost 합산 후 Adstock·Hill이 적용되는지
- 내부 same-data prior가 Decomp에 들어오면 실패하는지
- frozen trend config를 후속 단계가 변경하면 실패하는지
- 같은 입력이 결정론적으로 같은 결과를 내는지
- Performance·Branding 공선 시 ABSTAIN하는지
- clip 경계와 genuine null이 구분되는지
- 기간 필터 변경 후에도 채널 합계 항등식이 유지되는지
- Adstock은 합산과 교환되지만 Hill은 교환되지 않는 합성 데이터 검증
- 집계 Hill 결과가 채널별 예산 배분 API로 전달되지 않는지
- rolling fold의 꺾임 위치·방향이 학습 구간만으로 생성되는지
- `trendFlexFrozen`의 모든 필드가 후속 단계에서 read-only인지

### 10.4 집계 모델 채택 게이트

Aggregate 모델과 16채널 모델을 정확히 같은 rolling fold로 평가한다.

- fold별 WMAPE 배열 길이와 기간이 같은지
- paired `delta`와 standard error가 정확한지
- one-standard-error 판정이 결정론적인지
- aggregate가 동등하면 더 단순한 aggregate를 채택하는지
- aggregate가 반복적으로 열세면 `STRUCTURAL LOSS`로 중단하는지
- `STRUCTURAL LOSS`를 이유로 16채널 모델을 상위 Decomp에 자동 대입하지 않는지

특정 기여 숫자에 가까워지는 것은 테스트 통과 조건이 아니다.

---

## 11. RRM 격리 및 별도 수정

RRM은 현재 프로덕션 Decomp에 연결되지 않은 독립 엔진이다.

다음 문제를 해결하기 전에는 Gate 결과와 272K를 신뢰하거나 Decomp와 비교하지 않는다.

### 11.1 SE

현재 방식:

```text
σ² / (X'X)[i,i]
```

수정:

```text
Var(β_i)
= σ² × ((X'X)^-1)[i,i]
```

### 11.2 Ridge 표준화

Ridge 적용 전에 intercept를 제외한 회귀열을 표준화하고, 적합 후 원 단위로 복원한다.

현재 no-op 변환은 제거한다.

### 11.3 VIF

최대 pairwise correlation으로 근사하지 않고, 각 채널을 나머지 전체 채널에 회귀한 다중 `R²`를 사용한다.

```text
VIF_i
= 1 / (1 - R²_i)
```

### 11.4 RRM 재현 조건

- 동일 Prism 파일
- 동일 104주
- 동일 타깃
- 동일 Cost 매핑
- 동일 기여 기준
- 동일 transform 단위
- 데이터 해시와 spec ID 기록

조건을 통일한 뒤 새 결과를 생성하고, 기존 272K와 26K가 왜 달랐는지 provenance로 설명한다.

---

## 12. PR 분할

### 12.1 1차 MVP 범위

1차 구현은 핵심 가치를 가장 빨리 검증할 수 있는 PR 1과 PR 2로 제한한다.

```text
1차 MVP
= PR 1 전제 정정·WIP 격리
+ PR 2 상위 2그룹 Decomp
```

PR 2에서 pseudo-channel 두 개로 기존 수학 코어를 재사용해 다음 인사이트를 먼저 확보한다.

- Performance·Branding 상위 총량
- 기존 16채널 모델 대비 holdout 예측력
- Trend·Industry·Media 배분 변화
- 그룹 수준 식별 가능성
- penalty 민감도

PR 3~5는 PR 2 결과와 aggregate 채택 게이트를 확인한 뒤 진행한다.

### PR 1 — 전제 정정 및 WIP 격리

- 런북의 cost-total 오류 정정
- 88K 하한 주장 철회
- 272K 인용 격리
- WIP prior·trend penalty ×4 비프로덕션 처리
- 동일 파일·기간·해시 계약 추가

### PR 2 — 상위 Decomp 엔진

- `buildMmmAggregateMediaPanel`
- `mmmBayesianDecompRun`
- Performance·Branding Cost 합산
- 그룹 단위 Adstock·Hill
- Trend CV freeze
- 상위 Decomp 항등식 테스트

### PR 3 — 채널 귀속 엔진

- 그룹 총량 고정 채널 share
- Gate C
- 경계 0·UNIDENTIFIED·ABSTAIN
- 채널 합계 항등식 테스트

### PR 4 — UI·CSV·문서

- 절편과 순수 추세 분리
- Decomp·채널 엔진 구분
- 검산 행
- 모델 provenance
- 진단 CSV export

### PR 5 — RRM 복구

- SE 수정
- Ridge 표준화
- 다중 `R²` VIF
- 동일 입력 재현
- 기존 결과 폐기 또는 provenance별 분리

---

## 13. 완료 기준

- [ ] Decomp가 16개 채널 계수를 합산해 Performance·Branding 총량을 만들지 않는다.
- [ ] Performance·Branding 원시 Cost 합계가 각각 하나의 상위 미디어 입력이 된다.
- [ ] Cost 합산 이후 그룹 단위 Adstock·Hill을 적용한다.
- [ ] Adstock의 선형성과 Hill의 비선형성을 문서·테스트에서 구분한다.
- [ ] 집계 Hill을 채널별 미래 예산 배분 근거로 사용하지 않는다.
- [x] 추세 flexibility가 미디어 결과 확인 전에 rolling-origin CV로 고정된다.
- [x] smoothing window·꺾임 개수·위치·방향·basis가 `trendFlexFrozen`에 기록되고 이후 변경되지 않는다.
- [ ] 상위 Decomp에서 same-data contribution/reference prior를 사용하지 않는다.
- [ ] `trendPenalty ×4` 같은 비대칭 하드코딩이 없다.
- [x] 동일 fold에서 aggregate와 16채널 모델을 비교하고 one-standard-error 채택 판정을 기록한다.
- [ ] 절편과 순수 추세가 별도로 표시된다.
- [ ] 채널 귀속 합계가 상위 그룹 총량과 주별·전체 모두 일치한다.
- [ ] 식별되지 않은 채널은 0명으로 표시되지 않는다.
- [ ] 채널별 결과가 대부분 ABSTAIN일 수 있음을 정상 상태로 안내한다.
- [ ] Performance·Branding 그룹도 식별되지 않으면 ABSTAIN한다.
- [ ] Decomp 기여가 가산 component이며 인과 증분·ROI가 아님을 명시한다.
- [ ] 반사실 증분이 필요하면 별도 zero-cost 경로 estimand를 사용한다.
- [ ] 모든 결과에 파일 해시·기간·코드 버전·설정·estimand가 기록된다.
- [ ] 88K나 272K 중 원하는 숫자에 맞추지 않는다.
- [ ] 동일 파일·동일 기간·동일 단위에서 재현 가능한 결과만 보고한다.
