# MMM Bayesian-Lookalike — Empirical-Bayes / Laplace Posterior 스펙

작성 기준: 2026-07-24
대상: `v2-migration` MarketingResponse MMM (`src/utils/mmmMath.js`)
상태: 1차 구현 완료 — full covariance·결정론적 4,000 draw·비음수 투영·채널 식별·그룹 교차검증
동반 문서: `docs/mmm-decomp-aggregate-redesign-plan.md`(아키텍처·PR분할). 본 문서는 그 계획의 §3.1·§4.4·§7.3·§8.2가 요구하는 **불확실성·식별 메커니즘**을 채운다. 두 문서 병합 구현.

---

## 0. 목적 & 비목적

**목적.** 서버 없이(브라우저), 결정론(`Math.random` 금지)으로 풀 NUTS의 **실무 산출**을 재현:
- 상위 그룹(Performance·Branding)은 **좁은** credible 구간
- 개별 채널은 **넓은** 구간
- 식별 실패 채널은 강제 0이 아니라 **`0 ~ X`**
- 개별 ABSTAIN이어도 그룹 효과는 식별

**방법.** 풀 posterior 샘플링 대신 **Laplace(Gaussian) posterior 근사 + Empirical-Bayes penalty + 절단정규 처리 + full-covariance 그룹 합산.**

**비목적(정직성, CLAUDE.md §8).**
- 풀 joint MCMC posterior 아님. 변환(adstock/Hill)·prior·noise 구조 불확실성은 **plug-in/조건부**라 충실도 낮음.
- 계층모형·geo pooling 없음.
- **명칭 강제**: "Bayesian MMM" 단정 금지. `Browser Empirical-Bayes MMM (Gaussian/Laplace posterior approximation, non-negative media)`.

### 0.1 충실도 (풀 Bayesian 대비, GPT 평가 반영·정직)

풀 NUTS와의 유사도. **주의(②)**: "그룹 CI 85~95%"는 **선택된 adstock/Hill 조건부**다. 변환 불확실성까지 통합한 marginal CI는 더 넓음 → 화면·문서에 "변환 고정 조건부" 라벨 명시.

| 영역 | 개선 후 유사도 | 비고 |
|---|---|---|
| 고정 변환 아래 계수 추정 | 90~100% | |
| 그룹 합산 효과·CI(공분산 사용) | 85~95% | **변환 고정 조건부(②)** |
| 공선 "개별 넓고 그룹 좁음" | 85~95% | `aᵀΣa`의 핵심 이득 |
| 경계 채널 `0~X`(절단분포) | 75~90% | 절단정규 제대로 써야 |
| adstock/Hill 변환 불확실성 | 60~80% | profile mixture로 일부만 |
| prior·noise·구조 전체 불확실성 | 50~70% | plug-in/조건부라 차이 큼 |
| 계층·geo pooling | 낮음 | 별도 구조 필요 |

**실무 의사결정 산출 종합: BMMM ~85~90% 근접**(208행·2그룹처럼 차원 작고 conditioning 좋을 때 더 높음). 통계적 풀 posterior 동일 아님.

---

## 1. 재사용 코드 자산 & 교체 지점

이미 있는 것(대부분 완성 — GPT 확인):
- `_mmmBayesianLinear` [mmmMath.js:3061](../v2-migration/src/utils/mmmMath.js:3061) — Gaussian prior penalty row + residual variance 반복 갱신(EB). **`XtXinv` 반환** [:3150](../v2-migration/src/utils/mmmMath.js:3150).
- posterior SD [:3143](../v2-migration/src/utils/mmmMath.js:3143) — 현재 `√(σ²·XtXinv_jj)`, **무제약 Hessian 대각만 사용** → 경계서 부정확(§3.1에서 교체 대상).
- 비음 좌표강하 MAP `_mmmNonNegativeMediaFit` [:3037](../v2-migration/src/utils/mmmMath.js:3037) — MAP는 0 제약하나 SD가 위 무제약값과 조합됨(GPT ①이 지적한 부정합).
- 변환 posterior 혼합 [:3281](../v2-migration/src/utils/mmmMath.js:3281) — adstock/Hill BIC 가중.
- 채널 기여 구간 [:4425](../v2-migration/src/utils/mmmMath.js:4425) — 현재 채널별 sd만(공분산 미활용 → §2.2에서 교체).
- 예측분산 [:4820](../v2-migration/src/utils/mmmMath.js:4820) — 이미 `aᵀΣa` 패턴 존재 → 그룹 CI에 재사용.
- 상관그룹 경계 half-normal 보정 [:5192](../v2-migration/src/utils/mmmMath.js:5192) — **프로토타입.** 전 채널 일관 절단으로 일반화(§2.3).

**GPT 3정정 (전부 채택):**
1. **clip 제거 ≠ HalfNormal.** MAP만 0 제약하고 SD는 무제약 Hessian 대각 → 경계서 대칭정규근사가 가장 부정확. `max(0,N)`≠절단정규, `abs(N)`은 0중심·독립일 때만 HalfNormal. 상관 채널에 각각 clip/abs = 공분산 파괴 → **`TruncatedNormal(mean,sd;lower=0)` 모멘트**로 다룸(prior mean=0이면 HalfNormal 특수 경우).
2. **그룹 CI = 기여함수 공분산** `aᵀΣa`, a = feature합(원계수 단위), 1벡터 아님.
3. **집계 refit ≠ posterior 합.** `Hill(A+B)≠Hill(A)+Hill(B)` → 별개 모델 → 대칭 교차검증(§4).

---

## 2. 핵심 수식

### 2.1 원단위 full covariance
`_mmmBayesFitColumns`는 표준화 feature(colScale)로 적합 → 공분산도 표준화 단위.
```
표준화:  Cov_std(β) ≈ σ² · (XᵀX + P)⁻¹          (P = diag(penalty), 절편 포함)
원단위:  Σ_ij = Cov_std(β_i, β_j) / (colScale_i · colScale_j)
```
- `XtXinv` = 이미 `(XᵀX + P)⁻¹`(penalty row가 augmented X에 포함). σ² = `posterior.sigma2`.
- 현 SD는 `XtXinv[j][j]` 대각만 씀 → 여기선 **전체 (p+1)×(p+1) 행렬**을 원단위 환원해 보존.

### 2.2 그룹 기여 posterior (핵심 개선, GPT ②)
```
a_j = Σ_t transformedFeature_j[t]     (기간합; 주별이면 그 주 feature). 그룹 g 미디어 열만, 그 외 0. 원계수 단위.
E[C_g]   = Σ_j a_j · E[β_j]
Var[C_g] = aᵀ Σ a = Σ_i Σ_j a_i a_j Σ_ij
CI95     = E[C_g] ± 1.96·√Var[C_g]
```
- A,B 음상관(`Σ_AB<0`) → `Var(A+B)=Var_A+Var_B+2Σ_AB` → **그룹 CI가 개별 합보다 좁아짐.** "개별 넓고 그룹 좁음"의 수학적 원천.
- 현 채널별 sd 합산([:4425](../v2-migration/src/utils/mmmMath.js:4425))은 이 상쇄를 놓침 → `aᵀΣa`로 교체.

### 2.3 절단정규 모멘트 (경계 채널, GPT ①)
미디어 계수 비음. MAP가 0에 붙어도 posterior는 `0~X`. 계수 j 주변 posterior = `TruncatedNormal(μ_j, σ_j; lower=0)`.
```
μ_j = 무제약 posterior 평균(원단위),  σ_j = √Σ_jj
α = -μ_j / σ_j,   λ(α) = φ(α) / (1 - Φ(α))
절단 평균:   E[β_j|≥0] = μ_j + σ_j·λ(α)
절단 분산:   Var[β_j|≥0] = σ_j²·[1 + α·λ(α) - λ(α)²]
분위수 q:    μ_j + σ_j·Φ⁻¹( Φ(α) + q·(1 - Φ(α)) )
```
- **기여는 clip된 MAP(=0) 아니라 절단 평균으로 계산** → 경계 point 편향 완화 + CI 일관.
- prior 평균 양수(외부 실험)면 `TruncatedNormal(mean>0)` 자연 처리.
- 현 `abs/max(0,·)` 프로토타입([:5192](../v2-migration/src/utils/mmmMath.js:5192))을 위 공식으로 대체·일반화.

### 2.4 다변량 절단 (그룹 point가 경계일 때)
```
2그룹(상위 Decomp): Classic은 MAP 가산 Decomp로 분리. Bayesian-like 비교층은 아래 결정론적
                     다변량 Laplace draw를 동일하게 사용한다.
≥3채널(귀속층):     닫힌형 없음 → 시드 PRNG로 Laplace 정규 draw 후 β<0 재투영(max(0,·)),
                     draw별 aᵀβ → 표본 평균·분위수
```
- 현재 제품은 Classic과 Bayesian-like를 명확히 분리한다. 따라서 Classic 2그룹 결과는 MAP,
  Bayesian-like 결과는 4,000 draw 조건부 posterior 근사다. 향후 Classic 화면에도 그룹 CI를
  붙일 때만 2변량 닫힌형 절단 모멘트를 추가한다.

### 2.5 결정론 (필수, CLAUDE.md §8.3)
```
seededRng(seed) = mulberry32 계열 순수 PRNG   (Math.random 금지)
seed = hash(dataHash + estimand + "posterior-mc")
draw = 4000 고정.  정규 draw = Box-Muller(seededRng)
```
같은 입력 → byte-identical(골든 §6).

---

## 3. 알고리즘 (Stage)

**순서 주의(③)**: GPT는 "①covariance 먼저 → ②경계 나중"을 권했으나, Prism은 채널이 0에 몰려 경계가 많다 → covariance CI만 있고 point가 경계편향이면 그룹 point가 여전히 틀림. **2그룹은 계산이 싸니 Stage A·B·C를 한 번에 landing**(직렬 분리 금지). 귀속층(16채널)만 나중.

### Stage A — 적합 & 공분산 보존
1. `_mmmBayesFitColumns` 실행 (same-data media prior OFF, redesign §5.4).
2. `Σ_raw` = §2.1 원단위 환원, 전체 행렬. `μ_raw` = 무제약 posterior 평균(clip 전). `μ_map`(비음 MAP)도 진단용 보존.

### Stage B — 계수별 절단 posterior
미디어 j: §2.3으로 `E[β_j|≥0]`·Var·5%/95%. 비미디어(추세·계절·업계·이벤트)는 무절단 정규.

### Stage C — 그룹 기여 posterior
`a_g`(기간합·주별) 구성 → 2그룹 bivariate 절단(§2.4) → `E[C_g]`·CI. 항등식 `Σ_g E[C_g] + 비미디어 + 절편 = fitted`(redesign §4.4·§10.1).

### Stage D — 채널 식별 태깅 (Gate C, 공분산 기반)
```
VIF_i = 1/(1-R²_i),  R²_i = i를 나머지 미디어 전체에 회귀(다변량, pairwise 근사 금지)
verdict:
  IDENTIFIED            : VIF_i<10 AND CI가 0 미포함 AND CI_width/|E| 좁음
  BOUNDARY/UNIDENTIFIED : E≈0 AND CI 상단>0  (0~X)
  ABSTAIN               : VIF_i≥10 OR (CI가 0 관통 & 넓음)
```

### Stage E — 대칭 교차검증 (GPT ③ + redesign §3.1)
```
group_via_joint     = Stage C (joint 모델 aᵀΣa 그룹합)
group_via_aggregate = 집계 refit Hill(Adstock(Σcost)) 모델(redesign §6.1)
rel_diff = |joint - aggregate| / max(|joint|,|aggregate|,ε)
  ≤ 0.15  → 일치 → 의사결정 등급 총량(양쪽 병기)
  > 0.15  → "그룹정의/포화가정 민감" → 그룹 ABSTAIN
```
**계층 아님(대칭).** 어느 쪽도 단독 SSOT 아니고 일치 구간만 승격. `Hill(A+B)≠Hill(A)+Hill(B)`라 둘은 다른 estimand.

---

## 4. estimand (redesign §4.4 정합)
- **1차 = 가산 component**: `groupContribution = aᵀ·E[β]`(절단 평균). fitted=Σ항 항등식.
- **반사실(옵션, ROI용)**: 그룹 cost 경로 전체 0 + adstock 상태 재계산 후 예측차. 화면·CSV·필드 분리. 본 스펙 1차 범위 아님.

---

## 5. 신규 순수 함수 (시그니처)
```js
// 전부 결정론·순수. src/utils/mmmMath.js 추가(수학 엔진, 골든 대상).
mmmPosteriorCovariance(fit, colScale) -> { sigma2, sigmaRaw: number[][], muRaw: number[] }
mmmTruncatedNormalMoments(mu, sigma) -> { mean, variance, q05, q95 }               // §2.3 닫힌형
mmmGroupContributionPosterior(sigmaRaw, muRaw, weightsByGroup, opts)               // §2.2 + §2.4
    -> { [group]: { mean, variance, ci95:[lo,hi], weeklyMean, weeklyCi } }
mmmChannelIdentificationTags(sigmaRaw, muRaw, mediaIndices, thresholds)            // Stage D
    -> { [channel]: { mean, ci95, vif, verdict } }
mmmMultivarTruncatedSample(muRaw, sigmaRaw, mediaIndices, seed, draws=4000)        // §2.4 ≥3채널
    -> number[][]
mmmAggregateCrossCheck(joint, aggregate, tol=0.15) -> { relDiff, verdict }         // Stage E
```
- 프리미티브: `mmmNormCdf`[statPrimitives], `Φ⁻¹`(Acklam 근사, 결정론) 추가.
- 행렬 역: 기존 재사용하되 **`I·M≈단위행렬` 검증**(CLAUDE.md §7). rank-deficient면 null → 그룹 ABSTAIN(가짜 숫자 금지).

---

## 6. 테스트 (골든, vitest)
1. **공분산 대칭·PSD**: `Σ=Σᵀ`, 대각≥0.
2. **절단 모멘트 정확성**: `(0,1)`→{mean≈0.7979, var≈0.3634}; `(2,1)` 알려진 값 1e-6.
3. **`aᵀΣa` = 시드 MC 일치**: bivariate 닫힌형 vs 4000 draw, rel<1%.
4. **음상관→그룹 tighten**: `Σ_AB<0` 합성 → `√Var(A+B) < √Var_A+√Var_B`.
5. **경계 vs genuine null 분리**: μ≈0·σ큰 → BOUNDARY(ci_hi>0); μ≈0·σ작은 → IDENTIFIED(tight 0).
6. **결정론**: 같은 seed·입력 → byte-identical(2회).
7. **다변량 VIF**: 3채널 완전공선 → VIF→∞ → ABSTAIN.
8. **cross-check**: `Hill(A+B)≠Hill(A)+Hill(B)` 합성서 rel_diff·판정 결정론.
9. **역행렬 가드**: 특이행렬 → null → 그룹 ABSTAIN.

특정 기여 숫자 근접은 통과 조건 아님(redesign §10 원칙).

---

## 7. 통합 지점 (redesign 계획에 어떻게 꽂히나)
| redesign 위치 | 본 스펙이 채움 |
|---|---|
| §3.1 대칭 교차검증 | Stage E |
| §4.4 그룹 기여 | Stage C `aᵀΣa` + 절단 평균 |
| §7.3 IDENTIFIED/BOUNDARY/ABSTAIN | Stage D |
| §8.2 불확실성 구간·경계0 | Stage B·C·D 출력 |
| 기존 [:3143](../v2-migration/src/utils/mmmMath.js:3143) sd | 절단 모멘트로 교체 |
| 기존 [:4425](../v2-migration/src/utils/mmmMath.js:4425) 채널 CI | `aᵀΣa`로 교체 |
| 기존 [:5192](../v2-migration/src/utils/mmmMath.js:5192) 경계보정 | 전 채널 일관 절단으로 일반화 |

**구현 순서**: 2그룹은 Stage A+B+C 동시(③) → Stage E cross-check → 귀속층 Stage D(대개 ABSTAIN).

---

## 8. 한계 (정직 고지)
- plug-in 변환 조건부 → 변환 불확실성 60~80%만(profile mixture 일부).
- Laplace = posterior 정규 근사. 경계·강비선형서 꼬리 부정확(절단으로 완화, 완전치 않음).
- 계층·geo pooling 없음.
- 결론: 실무 산출 BMMM ~85~90% 근접(작은 차원서 더). **통계적 풀 posterior 동일 아님** — 명칭·한계 화면 명시.
