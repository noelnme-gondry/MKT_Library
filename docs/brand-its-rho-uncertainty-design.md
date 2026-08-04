# 브랜드 ITS — AR(1) 계수 불확실성 설계

상태: 설계 확정 전 · 구현 전  
대상: `v2-migration/src/utils/brandIncrementalityMath.js`, `BrandCampaignIncrementality.jsx`  
선행: `docs/brand-incrementality-ar1-inference-spec.md` (PR #591)

## 1. 문제와 결정

현재 ITS는 사전 OLS 잔차로 `rhoHat`을 한 번 추정하고, 이를 고정값처럼 넣은 Prais–Winsten AR(1) 예측구간을 쓴다. `df = n - 3`은 절편·추세·rho 사용을 반영하지만 `rhoHat`의 표본오차와 beta–rho 공분산을 반영하지 않는다.

`pre=24`, 실제 `rho=0.85`의 고정 시드 2,000회 무효과 검증에서 단측 거짓양성은 20.6%였다. 이 구간은 현재 UI에서 exploratory로 고지되지만, 수치 구간을 명목 95%라고 읽을 수는 없다.

결정: 기본 추론을 **AR(1) 프로파일 우도 기반의 보수적 예측구간(profile-envelope interval)** 으로 바꾼다. rho를 점추정으로 고정하지 않고 가능한 rho 집합 전체에서 효과구간을 포락(envelope)한다.

이 방식은 다음을 만족한다.

- 클라이언트 사이드·순수함수·결정론: 고정 rho 격자만 사용, `Math.random`·Monte Carlo 없음
- prior 없음: 베이지안 posterior를 몰래 도입하지 않는 빈도주의 설계
- rho 불확실성 노출: 점추정·프로파일 집합·구간 폭을 UI에 표시
- 보수성: rho 집합과 각 조건부 구간을 모두 고려해 좁은 plug-in CI를 방지

## 2. 통계 계약

### 2.1 모델

사전기간에서 다음 정상 AR(1) 오차 모형을 적합한다.

```text
y_t = beta0 + beta1 * time_t + e_t
e_t = rho * e_(t-1) + innovation_t
innovation_t ~ N(0, sigmaInnovation²), |rho| < 1
```

기존처럼 반사실은 마지막 사전 잔차를 이어 붙이지 않은 무조건부 추세다. 일시적인 사전 충격을 캠페인 기간의 기준선으로 가정하지 않는다.

### 2.2 고정 rho 적합

`rhoGrid = [-0.995, 0.995]`를 균등하게 1,593개 점(간격 0.00125)으로 평가한다. 각 rho에서:

1. Prais–Winsten 변환으로 beta를 GLS 적합한다.
2. 변환 잔차제곱합 `SSErho` 및 혁신분산 `sigmaHat² = SSErho / n`을 계산한다.
3. 정상 AR(1) Gaussian profile log-likelihood를 계산한다.

```text
logL(rho) = -n/2 * [log(2pi) + 1 + log(SSErho / n)] + 1/2 * log(1-rho²)
```

마지막 항은 Prais–Winsten 변환의 첫 관측치 보정에서 나온다. 계산 안정성을 위해 rho가 경계에 닿지 않도록 격자 끝은 ±1이 아니다.

### 2.3 rho 프로파일 집합

`rhoMLE`는 최대 log-likelihood의 격자점이다. 97.5% 프로파일 집합 `C_rho`는 다음 조건을 만족하는 모든 격자점이다.

```text
2 * [logL(rhoMLE) - logL(rho)] <= 5.023886
```

`5.023886`은 자유도 1 chi-square의 97.5% 임계값이다. 이 값은 상수로 정의하며 새 chi-square CDF를 구현하지 않는다.

프로파일 집합이 격자 경계에 닿으면 `rho_profile_unbounded`를 진단에 기록한다. 그 경우도 수치를 숨기지 않되, 결과의 방향 판정은 금지한다.

### 2.4 조건부 효과구간

각 `rho in C_rho`에서 다음을 계산한다.

```text
effect(rho) = actualPostTotal - sum(postX * betaHat(rho))
Var(effect | rho) = postX' Var(betaHat | rho) postX
                   + Var(sum(e_post) | rho)

Var(sum(e_post) | rho)
  = sigmaInnovation² / (1-rho²)
    * [m + 2 * sum_(k=1..m-1) (m-k)rho^k]
```

조건부 구간은 97.5% Student-t로 계산한다. 자유도는 `n - 3`이다.

```text
I(rho) = effect(rho) ± t_(0.9875, n-3) * sqrt(Var(effect | rho))
```

최종 표시 구간은 포락이다.

```text
profileInterval = [min_rho I_lower(rho), max_rho I_upper(rho)]
```

97.5% rho 집합과 97.5% 조건부 구간을 함께 사용해 union-bound 기준 최소 95%의 보수적 목표를 둔다. 이는 유한 표본의 정확한 coverage 보장이 아니라, plug-in 95% CI보다 정직한 근사임을 문서·UI에 명시한다.

### 2.5 점추정·p값

- 표시 증가분: `effect(rhoMLE)`
- 표시 구간: `profileInterval` (기존 `ci95`를 대체)
- p값: 제거한다. profile-envelope과 단일 t p값은 같은 추론 계약이 아니므로 p값을 남기면 다시 과신을 유도한다.
- `confidenceMethod`: `ar1_profile_envelope`

## 3. UI 계약

### 3.1 결과 카드

| 조건 | 헤드라인 | 방향 판정 |
|---|---|---|
| `pre < 50` | “추정치는 제공하지만, 사전기간이 짧아 증분 방향을 판정하지 않습니다.” | 항상 금지 |
| `pre >= 50`, profileInterval이 0 포함 | “AR(1) 계수 불확실성까지 반영하면 증가를 구분하기 어렵습니다.” | 증가 없음 단정 금지 |
| `pre >= 50`, profileInterval 하한 > 0, rho profile이 내부 | “AR(1) 계수 불확실성까지 반영한 관찰상 증가 신호입니다.” | 인과 확정 금지 |
| rho profile이 경계 도달 | “자기상관의 가능한 범위가 넓어 방향을 판정하지 않습니다.” | 항상 금지 |

카드 라벨은 `95% CI`가 아니라 **“95% AR(1) 프로파일 구간”**이다. 툴팁에 “rho 추정오차를 포함한 보수적 구간이며, 통제군 없는 인과 증명은 아님”을 적는다.

### 3.2 상세 진단

- `rhoMLE`와 97.5% profile 범위
- profile 구간의 하한·상한을 만든 rho 값
- 조건부 plug-in SE와 profile 구간 폭 (비교용; HAC는 참고 진단 유지)
- 사전기간, `exploratory`/`assumption_sensitive`/`reference`
- 경계 도달 여부와 왜 판정을 차단했는지

## 4. 구현 경계

### 신규 순수 함수

`brandIncrementalityMath.js` 안에서 private 순수 함수로 시작한다. public API는 `runBrandInterruptedTimeSeries()` 하나를 유지한다.

```js
fitAr1AtRho(pre, rho) -> {
  rho, intercept, slope, logLikelihood, innovationVariance,
  coefficientCovariance, df
}

buildAr1Profile(pre) -> {
  mle, acceptedFits, rhoInterval, hitsBoundary
}

profileEffectInterval(profile, postSeries, actualTotal) -> {
  estimate, interval, lowerDriverRho, upperDriverRho
}
```

기존 `ar1PraisWinstenUncertainty`는 삭제하지 않고 위 함수로 분해·대체한다. HAC 참고 진단도 유지하되 결과 CI·카피·p값에는 사용하지 않는다.

### 성능

1,593개 rho × 최대 수백 사전기간 × 2×2 행렬 계산이므로 메인 스레드에서 허용 가능한 작은 계산이다. 그래도 분석하기 버튼의 기존 double-rAF 게이트 뒤에서만 실행한다. 매핑 변경 중에는 실행하지 않는다.

### 금지

- 무작위 bootstrap 또는 `Math.random`
- 숨은 rho prior / 베이지안 credible interval
- profile 구간을 기존 plug-in `ci95`와 섞어 표시
- `pre < 50`에서 interval이 0을 배제한다는 이유만으로 증가 판정
- 통제군 없는 ITS를 인과 증명으로 표현

## 5. 검증 계약

### 골든·단위 테스트

- 고정 rho에서 `fitAr1AtRho`가 현 Prais–Winsten beta·분산과 일치
- profile MLE가 합성 AR(1) 데이터의 생성 rho 주변에 위치
- `profileInterval`이 해당 `rhoMLE` 조건부 구간을 포함
- 고 rho에서 profile 구간 폭이 plug-in 구간보다 작아지지 않음
- profile 경계 도달·완전 직선·특이 설계·짧은 데이터가 throw 없이 정직한 상태 반환
- `pre < 50` 결과는 interval 부호와 무관하게 `directionalVerdict: "withheld"`

### 오프라인 보정 스크립트 (CI 비포함)

고정 시드 AR(1) 혁신항 2,000회로 아래를 기록한다. 이 스크립트는 실패 시 CI를 깨지 않으며, 결과표를 PR 본문에 남긴다.

| 조건 | 지표 | 수용 기준 |
|---|---|---|
| pre=24, rho=.85, 효과=0 | 사용자에게 노출되는 증가 판정률 | 0% (방향 판정 withheld) |
| pre=50, rho=.85, 효과=0 | profile interval 단측 거짓양성 | 기존 plug-in보다 감소 |
| pre=150, rho=.85, 효과=0 | profile interval 단측 거짓양성 | 7% 이하 목표 |
| rho=0/.5/.85 | 구간 폭 | persistence 증가 시 비감소 |

2,000회에서 5% 비율의 Monte Carlo 표준오차는 약 0.5%p이므로, 작은 차이를 절대 통과/실패로 과해석하지 않는다.

## 6. PR 분할

1. **W7-a 엔진**: profile fit·interval·골든·오프라인 보정 스크립트. UI 불변, 기존 output은 additive 진단만 먼저 추가.
2. **W7-b UI**: 결과 카드·상세·KR/EN 카피를 profile interval 계약으로 전환하고 p값 제거.
3. **W7-c 문서/회귀**: 방법론 문서·tool guide·snapshot·전체 검증. W7-a/b가 한 PR로 작으면 병합 가능하나, 수학 골든과 UI smoke는 분리 검토한다.

## 7. 비범위

- 계절성·구조변화·복수 캠페인 구간을 AR(1)로 해결하지 않는다.
- 대조군 없는 ITS의 인과 식별을 주장하지 않는다.
- W6 Web Worker는 이 계산의 선행조건이 아니다.

## 참고

- Clements & Taylor (2006), *Interval forecasts and parameter uncertainty*, Journal of Econometrics, https://doi.org/10.1016/j.jeconom.2005.07.030
- Bottomley et al. (1980), *Estimating the autocorrelated error model with trended data*, Journal of Econometrics, https://doi.org/10.1016/0304-4076(80)90014-7
- Lindsley et al. (2024), *In praise of Prais–Winsten*, https://pmc.ncbi.nlm.nih.gov/articles/PMC10946734/
