# 5-17 Marketing-Response Regression — README

> defensible MMM-style 주간 회귀. **가설 생성 + 기술(description) 도구.**
> ⚠ 어떤 계수도 측정된 인과/증분 효과가 아니다. cannibalization·incrementality
> 판정은 **holdout 실험(5-15)에서만**. 본 도구는 "무엇을 holdout으로 검정할지"를 좁힌다.

---

## 0. 무엇을 주장할 수 있고, 무엇은 못 하는가

| 구분 | 의미 | 본 도구 출력 |
|---|---|---|
| **Described (association)** | 데이터에서 관찰된 상관·기술 통계 | β, CI, R², 진단, ITS 기울기, CCF |
| **검정할 가설 (hypothesis)** | 이 association이 시사하는, 다음에 실험할 질문 | cannibalization 신호(§5), ramp 기울기 변화 |
| **holdout 필요 (causal)** | 인과/증분 판정 — 본 도구로 불가 | "Google이 React를 잠식한다" 같은 결론 |

선행 내부 분석("Spec 18")의 blended weekly OLS "Google cannibalizes (54% AOS / 94% iOS)"는
incremental(Reg) + cannibalistic(React) 프로세스를 평균내 오도. 본 도구는 이를 **프로세스별
(Reg vs React) · 플랫폼별(iOS/AOS)** 로 분리해 더 날카로운 가설을 제시한다.

## 1. 데이터 입력
- `docs/mmr-data-contract.sql` 로 주간 per-platform tidy CSV 생성 (파라미터화, 하드코딩 경로 없음).
- 5-17 도구에 업로드 → **브라우저 메모리에서만 처리, 서버 전송 없음**.
- 필수: `iso_week_start` + (`org_reg` 또는 `org_react`) + spend 채널 1개. 나머지는 매핑 시 항 자동 활성.

## 2. 모델 (PRE-REGISTERED — fit 기반 spec 탐색 금지)
platform × {Organic Reg, Organic React} 별 별도 모델:
```
Y_t = β0 + Σ f(adstock→saturation(channel spend))         # 채널 효과
        + β_t·t + γ·(t×postRamp) + δ·postRamp_level         # CORE TEST (ITS)
        + Fourier(52w, K=2 matched sin+cos)                 # 계절성
        + holiday 더미 + STEP 더미 + ε_t
```
- **CORE TEST:** post-ramp organic 기울기(β_t+γ)가 pre-ramp(β_t)보다 더 음수인가? 아니면 organic 감소는 secular(ramp 무관).
- **iOS 우선** — 2024 paid≈0 = 가장 깨끗한 자연실험(선행 deck이 "94%"로 가장 강하게 공격한 컷).

## 3. Spend transforms (순서 = adstock THEN saturation)
1. Adstock(기하 carryover): `a_t = spend_t + θ·a_{t-1}`.
2. Saturation: log 또는 Hill (adstocked 값에 적용).
3. **θ·saturation은 rolling-origin OUT-OF-SAMPLE RMSE 그리드서치로 선택** (in-sample R² 아님). validation curve(`gridCurve`) 보고.
   - ⚠ 단순화: 본 클라이언트 도구는 채널 공통 θ를 그리드(5 θ × 2 sat)에서 선택 (채널별 독립 θ는 5^채널 폭발 회피). 채널별 θ가 필요하면 서버 파이프라인에서 확장.

## 4. Diagnostics (필수 보고 — §4 패널)
- **Newey-West HAC SE**로 모든 추론 (별표 대신 95% CI). Durbin-Watson + Breusch-Godfrey 자기상관 검정.
- **VIF**(>5 flag) + `corr(transformed spend, t)` 공선성 점검 (선행 분석의 corr≈0.90 footgun).
- **Prewhitened CCF** (detrend+deseasonalize 후) spend→outcome lag profile — raw CCF의 spurious 회피.
- **단일관측 더미**(잔차≈0) 자동 탐지 → 해당 계수 **해석 제외**(회색 처리). 영구 변화는 STEP으로.
- OOS RMSE/MAPE를 in-sample R²/adjR²와 병기.

## 5. Cannibalization 가설검정 (§6.1)
`org_react ~ adstock(spend_react) + trend + season + steps`:
- **음수 계수 + 95% HAC CI가 0 제외 = substitution(잠식 신호)** · 0 포함 = riding · 양수 = incremental.
- ⚠ 신호일 뿐. 가설: "잠식은 React에 집중, Reg엔 미미"를 **holdout(5-15)으로 검정**하라.

## 6. Results JSON
§6 패널의 ⬇ 버튼 → `mmr_results_*.json` (coeffs, CI, 진단, 선택 하이퍼파라미터 + 캐비엇). 리포트/대시보드 소비용.

## 7. Guardrails (DO NOT) — 코드로 강제됨
- ❌ in-sample fit로 spec 선택 (→ OOS 그리드서치로 강제)
- ❌ HAC SE·CI 없이 bare p값/별표 (→ CI 우선 표기)
- ❌ 영구 변화를 단일주 더미로 (→ STEP 더미 + 단일관측 자동 제외)
- ❌ Google ROI + CBUA 합산 (→ 항상 분리 채널)
- ❌ prewhitening 없이 raw CCF (→ prewhitenResiduals 선처리)
- ❌ 산출물을 causal/incremental/(비)cannibalization 증명으로 기술 (→ UI·JSON 전면 캐비엇)
