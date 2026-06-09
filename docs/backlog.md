# Backlog & 다음 세션 인계 (Hand-off)

> 이 파일은 진행 중·대기 작업을 다음 Claude 세션이 그대로 이어받도록 기록한 인계 문서입니다.
> CLAUDE.md § 16에서 이 파일을 참조합니다.

---

## A. 운영 대시보드 — 남은 UI 작업 (사용자 번호 기준)

### 이미 완료 (main 머지됨)
- 운영 그룹 기능별 재구조화(05~09) + 그룹 공유 CSV (#38)
- 5-9 LTV:CAC·Payback (#39) / 5-10 Pacing (#40) / 5-11 Funnel (#40) / 5-12 Segment (#41)
- 5-3 What-if 시나리오 (#45) / 5-6 Creative Win-rate·Velocity (#46)
- 5-13 Exec Scorecard + 5-14 Anomaly (#47) / 5-16 ROAS Maturation (#48) / 5-15 Incrementality(Holdout) (#49)
- ROAS export fix (#43), A/B σ 입력 도우미 (#44)
- 전체 골든 테스트 47/47 green

### 남은 것
1. **SOP 콘텐츠 보강 (사용자 우선순위 #1)** — 1-2 ~ 4-4(13개)는 `index.html` 내 `page_X_Y()` 인라인 콘텐츠(~1650줄), 1-1만 `content/pages/1-1.json`.
   전면 재작성이 아니라 **정확성 검수 기반 보강** (예: 1-4에 AdAttributionKit 등 2026 최신 추가).
   진행 방식 미정 — 샘플 1페이지 먼저 vs 전권 위임 일괄. (마지막 AskUserQuestion이 권한 에러로 미응답)
2. ~~**MMM (Marketing Mix Modeling)** → B의 Tinder 회귀 스펙 구현.~~ ✅ **완료 (PR #51~53, 5-17 도구).**
   엔진(MMR_MATH/MMR_STATS, 골든 11) + 파이프라인/페이지(위생게이트·OOS 그리드서치·HAC·진단·ITS·cannibalization·results JSON, 골든 5) + 데이터계약 SQL·README(`docs/mmr-*`). §8 가드레일 전부 코드 강제.

---

## B. (대기) Tinder KR Reg/React Marketing-Response Regression — defensible MMM-style

> 사용자가 2026-06-09에 전달. "지금은 기억만, 나중에 진행." 아래는 전달받은 스펙 원문 보존.
> ⚠ 이 프로젝트는 단일 HTML 클라이언트 도구지만, 본 스펙은 Redshift pull + 회귀 파이프라인까지 포함.
> 구현 착수 전 사용자와 범위 확정 필요: (a) 파이프라인 산출물 JSON을 본 대시보드(5-N)가 소비하는 형태인지,
> (b) 분석 파이프라인 자체를 어디서 돌리는지(별도 환경 vs 본 repo). 결과 JSON → 대시보드 시각화가 자연스러운 연결.

### 0. Framing (절대 위반 금지)
- 모델 목적 = **가설 생성 + 기술(description)**, 인과 증명 아님.
- Incrementality·cannibalization **판정은 holdout에서만**. 어떤 계수도 측정된 인과/증분 효과로 제시 금지.
- 선행 내부 분석("Spec 18")이 blended weekly OLS로 "Google cannibalizes (54% AOS / 94% iOS)" 결론. 이를 제대로 재구축하고
  **더 날카로운 프로세스별 가설**을 검정: cannibalization은 **Reactivation에 집중, Registration엔 미미**할 가능성.
  blended 숫자는 incremental(Reg)과 cannibalistic(React) 프로세스를 평균내 오도.

### 1. 선행 분석의 알려진 실패 — 반복 금지
- 날짜 컬럼 오염(MM/DD·DD/MM 혼재, 정렬 불가) → 먼저 시간순·행 정렬 검증.
- 단일주 이벤트 더미(추석, 추석후주, LINE-signoff)가 1관측에 정확히 fit(잔차≈0) → 무의미. **영구 변화는 STEP 함수로, 단일주 더미 금지.**
- spend↔trend 공선성(corr(LN spend, t)≈0.90) → 불안정·상쇄 계수(+1,224 spend / −20.6 trend 둘 다 "유의").
- 잔차 자기상관(DW≈1.28) + naive OLS SE → 유의성 과대.
- "best-fit spec 탐색"(Spec 18 = ≥18회 시도) → post-selection p값 무효.
- Google만 모델, Meta/TikTok/Brand 누락; Google ROI + CBUA 합산됨.
- 외톨이 sin(13w)+cos(52w): 주파수 불일치, 위상 고정.

### 2. 데이터 (source: Redshift; 파라미터화된 clean pull)
주간, **2024-01-01 → 2026-04-30 (~121 ISO weeks)**, **플랫폼(iOS, Android) 분리**.
tidy schema (platform × ISO-week 1행):
| col | meaning |
|---|---|
| `iso_week_start` | ISO 주의 월요일 |
| `platform` | ios / aos |
| `org_reg`, `paid_reg`, `org_react`, `paid_react` | outcome counts (organic vs paid 분리) |
| `spend_g_roi`, `spend_g_cbua`, `spend_meta`, `spend_tt`, `spend_brand` | 채널 spend (Google ROI·CBUA 분리 유지) |
| holiday flags | `seollal`, `chuseok`, `pre_lny`, `post_chuseok_wk`, `other_holiday` |
| event steps | `post_chuseok_step`(2025-10주~1), `line_signoff_step`(off-date~1), `attr_change_step`(SKAN/ATT/MMP/정의 변경) |
Primary DV = **Organic**(`org_reg`, `org_react`). Total = org+paid는 cross-check만.
**데이터 위생 검증 게이트 (모델링 전 통과 필수):**
1. 날짜 robust 파싱; 주간 인덱스 strictly increasing·정확한 n·gap 없음 assert.
2. Y/spend/dummy가 올바른 ISO week에 정렬됐는지 assert.
3. **React 좌측 절단(left-censoring):** lapse-window lookback(30/60/90d)이 2024 초기 주에 2023 히스토리로 완전 채워졌는지 확인; 미충족 선행주 drop/flag. lapse-window 정의가 전 기간 일정한지 확인, 바뀌었으면 step 더미 추가.

### 3. 모델 설계 (PRE-REGISTERED — fit 기반 spec 탐색 금지)
**platform × {Organic Reg, Organic React}** 별 별도 모델. **iOS 우선**(2024 paid≈0 = 가장 깨끗한 자연실험, 선행 deck이 "94%"로 가장 강하게 공격한 컷).
ITS/regime 구조:
```
Y_t = β0
    + f(adstock→saturation of each channel spend)      # §4
    + β_t·t + γ·(t × postRamp) + δ·postRamp_level       # CORE TEST
    + Fourier seasonality                               # matched sin+cos PAIRS
    + holiday dummies + step dummies
    + ε_t
```
- `postRamp` = spend-ramp 시작(≈2025-07, spend 시리즈로 검증)부터 1. **핵심: post-ramp organic 기울기(β_t+γ)가 pre-ramp(β_t)보다 더 음수인가?** 아니면 organic 감소는 secular(ramp 무관).
- **Seasonality:** Fourier **matched sin+cos pair**, annual(52w) + (a priori 정당화 시) quarterly(13w). 각 pair 양항 모두(위상 자유). (~2.3 annual cycles 확보)
- **Holidays:** Seollal(×3: 24/25/26), Chuseok(×2: 24/25) 더미 — 반복돼 추정 가능. pre/post 윈도우는 theory-driven만.
- **Steps(단일주 아님):** `post_chuseok_step`, `line_signoff_step`(date~1), `attr_change_step`.

### 4. Spend transforms (순서 = adstock THEN saturation)
1. **Adstock(기하 carryover):** `adstock_t = spend_t + θ·adstock_{t-1}`, θ∈[0,1) 채널별.
2. **Saturation:** Hill(또는 log)을 adstocked 값에 적용(diminishing returns).
3. **θ·saturation params는 OUT-OF-SAMPLE error GRID SEARCH로 선택**(time-ordered/rolling-origin split), in-sample R² 아님. validation curve 보고. (grid가 overfit 위험 재도입 → OOS 선택이 guard.)
4. **내생성 완화:** CCF(§5)에서 outcome이 spend를 선행하면 contemporaneous 대신 **lagged spend(t-1, t-2)** 선호.

### 5. Diagnostics (필수 보고)
- **Lead/lag CCF, 양방향, PREWHITENED 시리즈**에서(trend+seasonality+AR을 ARIMA filter 또는 detrend+deseasonalize로 먼저 제거 — 추세 시리즈 raw CCF는 spurious). (a) spend→outcome lag profile(adstock 정보), (b) outcome→spend(역인과/내생성 — 나타날 것으로 예상, 문서화).
- `corr(transformed spend, t)`와 모든 예측변수 **VIF**; VIF>5 flag.
- **Durbin-Watson + Breusch-Godfrey**; 모든 보고 추론에 **Newey-West(HAC) SE**.
- 단일관측 더미(잔차≈0) 탐지 → 해당 계수 **해석에서 제외**.
- **OOS fit metrics**(holdout folds RMSE/MAPE)를 in-sample R²/adj-R²와 병기.

### 6. Cannibalization tests (날카로운 질문) — sign + 95% HAC CI 보고(별표 아님)
1. `org_react ~ adstock(paid_react_spend) + trend + season + holidays + steps`. **음수 계수 + CI가 0 제외 = substitution = cannibalization 신호.** 0=riding. 양수=incremental.
2. **paid_react_spend × holiday interaction:** paid 효과가 holiday 주에 집중되면 → paid가 organic holiday surge에 편승(riding).
3. **Incrementality gap:** attributed paid React vs 모델이 함의하는 marginal Total React.
4. **2024 자연실험, 양방향 해석**(둘 다 2024→25 product/macro/step confound 주의):
   - *Reg(rebuttal):* 2024 paid≈0인데 organic Reg 감소 → paid가 organic 감소 원인 아님.
   - *React(cannibalization):* 2024 paid≈0에서 Total React 유지됐고 2025 paid 추가 시 lift 없으면 → paid React 비증분.

### 7. Deliverables
1. 재현가능·파라미터화 파이프라인(명확한 data contract; 하드코딩 경로 없음).
2. 계수 테이블(HAC SE + CI) 모델별.
3. Diagnostics 번들: CCF plot(양방향), VIF table, DW/BG, OOS validation curves, 선택된 adstock/saturation params, fitted-vs-actual + residual plots.
4. ITS plot: organic pre/post-ramp 기울기 + `t×postRamp` 검정 결과.
5. 구조화 **results JSON**(coeffs, CIs, diagnostics, chosen hyperparams) — 웹 대시보드 소비용.
6. 짧은 README: **described(association)** vs **검정할 가설** vs **holdout 필요** 구분. 어떤 계수도 검증된 인과/증분 추정이 아님을 명시.

### 8. Guardrails (DO NOT)
- in-sample fit로 spec 선택 금지; pre-register, OOS 검증.
- HAC SE·CI 없이 bare p값/별표 보고 금지.
- 영구 변화를 단일주 더미로 모델링 금지.
- Google ROI + CBUA 합산 금지; 모든 채널 분리.
- prewhitening 없이 raw CCF 금지.
- 어떤 산출물도 causal·incremental·(비)cannibalization 증명으로 기술 금지 — holdout 질문.
