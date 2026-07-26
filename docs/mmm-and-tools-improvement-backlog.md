# MMM·분석 도구 개선 백로그

> 작성일: 2026-07-26
> 대상: Performance Marketing Library v2
> 범위: MMM 추세·카니발라이제이션·회귀 모델 및 기타 분석 도구
> 목적: 현재 구현과 남은 개선사항을 분리하고, 후속 작업을 검증 가능한 단위로 정의한다.

---

## 0. 결론

가장 먼저 해결해야 할 문제는 다음 세 가지다.

1. **추세와 광고의 기여 경쟁을 데이터 밖의 penalty나 prior가 결정하지 않게 한다.**
2. **광고 그룹 총량 추정과 채널별 배분을 분리하고, 식별되지 않은 채널 수치를 억지로 만들지 않는다.**
3. **카니발라이제이션은 단일 음의 계수가 아니라 데이터 적격성·복수 신호·홀드아웃 근거로 판정한다.**

MMM 이후에는 예산 배분, 증분 분석, 운영 대시보드가 같은 지표 정의와 모델 provenance를 공유하도록 연결하는 것이 우선이다.

---

## 1. 공통 원칙

### 1.1 분석 권한 분리

| 산출물 | 모델 권한 | 허용 해석 |
|---|---:|---|
| Performance·Branding 총량 | MMM Decomp | 관측 데이터에서 설명된 그룹 기여 |
| 그룹 내 채널 배분 | Allocation model | 총량 보존형 참고 배분 |
| 채널별 인과·증분 효과 | Holdout/실험 | 실험 조건 내 증분 효과 |
| 미래 성과 | Forecast model | 조건부 관측 예측 |
| 예산 증액 효과 | 식별 게이트 통과 시 시나리오 | 관측 범위 내 참고값 |

### 1.2 모델 선택 규율

- in-sample R²만으로 추세·계절성·Adstock·Hill 파라미터를 선택하지 않는다.
- 시간순 rolling-origin 또는 holdout 검증으로 후보를 선택한다.
- 같은 데이터에서 추출한 광고 계수를 다시 강한 prior center로 사용하지 않는다.
- 추세·광고·업황·시즈널리티 중 한쪽에만 비대칭 penalty를 걸지 않는다.
- 공선성으로 식별되지 않은 채널은 `0명`이 아니라 `NOT_IDENTIFIED`로 표시한다.
- 관측 회귀 결과를 인과효과·증분효과로 표현하지 않는다.

### 1.3 항등식

다음 항등식은 모든 기간 필터에서 성립해야 한다.

```text
실제값 = 적합값 + 잔차
적합값 = 절편 + 추세 + 계절성 + 이벤트 + 업황 + Performance + Branding
Performance = Performance 채널 배분 합
Branding = Branding 채널 배분 합
```

채널 배분 합은 **구성상(by construction)** 그룹 총량과 같을 수 있지만, 그것이 채널별 효과가 식별됐다는 증거는 아니다.

---

## 2. 현재 반영된 주요 개선

### 2.1 MMM·추세

- 결측치와 이상치에 견고한 주간 STL 분해
- seasonal subseries smoothing과 LOWESS 추세
- robust iteration 및 추세·계절성 강도 진단
- 광고 그룹 총량과 채널 배분을 분리하는 구조
- Adstock·Hill 반응곡선과 posterior 기반 기여 구간
- GEO·Reach/Frequency 매핑 기반 마련

### 2.2 카니발라이제이션

- 최소 활성주·최소 flight·최소 저지출 블록 게이트
- 지출 변동 부족 및 희소 집행 채널 판정 보류
- 단일 음의 신호로 red 판정 금지
- 독립 신호 2개 이상이 일치할 때만 잠식 의심
- 식별 불가능한 경우 `NOT_IDENTIFIED`

### 2.3 회귀·예측

- 최근 Cost window·추세·계절성 후보 rolling 검증
- 잔차 ACF·drift·분산 변화 진단
- 모수 참고구간과 예측 참고구간 분리
- 기준·미디어 OFF·±10% 시나리오 비교
- 총예산·채널 최소/최대 예산 제약
- 추세 감쇠·미래 이벤트 가정과 provenance 표시

---

# Part A. MMM 개선

## 3. 추세 모델 개선사항

### 3.1 P0 — 추세와 광고의 공정한 경쟁

| 개선사항 | 문제 | 권장 구현 | 완료 기준 |
|---|---|---|---|
| `paidCostTotalNuisance` 기반 추세 선택 | media 제외 추세 선택은 Branding 장기 신호를 추세에 선점시킬 수 있음 | 추세 모양 선택 시 Performance+Branding Cost total을 nuisance로 포함 | nuisance 포함/제외 민감도와 선택 후보 기록 |
| 추세 penalty 대칭화 | 광고와 추세 중 한쪽만 강하게 누르면 기여가 penalty 함수가 됨 | 모두 동일 정규화 또는 모두 diffuse로 비교 | penalty 0/대칭/CV 선택 결과표 |
| same-data prior 금지 | 직선추세 회귀의 광고계수를 prior center로 쓰면 오염을 재주입 | 외부 실험 prior만 허용, 내부 참고값은 진단 전용 | 내부 prior가 계수 precision을 덮어쓰지 않음 |
| 추세 모양과 크기 분리 | Raw RR 모양을 그대로 고정하면 광고 신호까지 추세가 흡수 | 모양 후보만 먼저 선택하고 크기는 전체 모델에서 공동 추정 | 모양 고정 후 coefficient posterior 제공 |
| Trend sink 분해 | 절편·순수 추세·미분류 수요가 Trend 한 항목으로 뭉침 | 절편, 저주파 추세, 미분류 baseline을 분리 | 세 항목 주간값·합계·상관 표시 |

### 3.2 P0 — 추세 후보와 검증

- 52·78·104주 smoothing profile을 명시적인 후보로 제공한다.
- 추세 basis 후보를 다음처럼 고정한다.

  - 선형
  - 선형+slope change 1개
  - spline knot 1개
  - spline knot 2개
  - LOWESS 52주
  - LOWESS 78주
  - LOWESS 104주

- 선택 지표:

  - rolling OOS WMAPE
  - rolling OOS RMSE
  - persistence baseline 대비 승리 fold 수
  - 잔차 ACF
  - 추세 곡률 복잡도 penalty

- 단순한 후보가 복잡한 후보와 사실상 동률이면 단순 후보를 채택한다.
- 선택된 추세 후보와 탈락 후보 전체를 export한다.

### 3.3 P1 — 변곡점과 구조 변화

- changepoint 후보를 데이터 끝점에서 최소 12주 이상 떨어진 위치에서 탐색한다.
- RR 정의·MMP·SKAN·제품 정책 변경은 단일주 dummy가 아니라 step으로 처리한다.
- 추세 하락 가속·완화 구간을 slope segment로 표시한다.
- 변곡점 전후 slope와 credible interval을 제공한다.
- 변곡점이 광고 ramp 시점과 겹치면 `media-confounded changepoint`로 표시한다.
- 이벤트·업황을 제거하기 전후 changepoint 안정성을 비교한다.

### 3.4 P1 — 추세 민감도 패널

사용자 화면에 다음 결과를 동시에 제시한다.

| 프로필 | 설명 |
|---|---|
| Neutral | CV가 선택한 추세 |
| Rigid | 꺾임이 적고 장기 변화만 설명 |
| Flexible | 더 많은 곡률을 허용 |
| Cost-protected | Cost nuisance로 추세 모양 선택 |
| Raw-shape | Raw RR에서 선택한 모양, 크기는 공동 추정 |

각 프로필마다 다음을 표시한다.

- OOS WMAPE
- 추세 시작·종료 수준
- Performance RR
- Branding RR
- Trend 합계
- 잔차 ACF
- 기준 모델 대비 변화

### 3.5 P2 — 추세 불확실성

- 추세 coefficient covariance를 주간 추세 구간으로 전파한다.
- 추세 후보 간 불확실성을 model averaging으로 반영한다.
- 데이터 끝부분의 추세 구간을 더 넓게 표시한다.
- 미래 추세는 damping 0/25/50/75% 시나리오로 비교한다.

---

## 4. 카니발라이제이션 개선사항

### 4.1 P0 — 식별 가능성 게이트

채널별 판정 전에 다음 조건을 확인한다.

- 최소 활성주
- 최소 연속 flight 수
- 최소 flight 길이
- 최소 연속 저지출 또는 OFF 블록
- 지출 CV
- 결과값 변동성
- 채널 간 VIF 및 다중 R²
- 이벤트·업황과 지출의 중첩
- 분석에 필요한 잔여 자유도

하나라도 핵심 조건을 충족하지 못하면:

```text
판정 = NOT_IDENTIFIED
기여 = 0으로 확정하지 않음
권장 조치 = 채널 그룹화 또는 holdout
```

### 4.2 P0 — 복수 증거 판정

다음 중 독립적인 두 신호 이상이 같은 방향일 때만 `CANNIBAL_SUSPECTED`로 올린다.

1. 저지출/OFF 블록에서 자연 성과 상승
2. 추세·시즌·업황 통제 후 음의 동시효과
3. spend가 미래 organic 감소를 선행하는 lag 신호
4. 채널 on/off 전환 전후의 구조적 변화
5. 실험 또는 geo holdout의 음의 증분효과

단일 음의 회귀계수, 단일 lag, 단일 추세 상관은 `INCONCLUSIVE`다.

### 4.3 P1 — 시차 분석

- lag 0·1·2·4·8주를 비교한다.
- Raw CCF가 아니라 추세·계절성·AR을 제거한 prewhitened CCF를 사용한다.
- `spend → outcome`과 `outcome → spend` 양방향을 모두 계산한다.
- outcome이 spend를 선행하면 역인과 위험을 표시한다.
- Granger 결과는 단독 red 승격 근거로 사용하지 않는다.
- lag 후보 탐색에 대한 다중검정 보정을 적용한다.

### 4.4 P1 — 카니발과 시너지 분리

| 분류 | 조건 |
|---|---|
| Cannibal suspected | paid 증가 후 organic 감소, total lift 제한 |
| Riding | paid 증가가 기존 자연 수요 피크와 겹침 |
| Synergy suspected | paid 증가 후 organic·total 동반 증가 |
| No issue defended | 충분한 power에서 음의 효과 상한이 작음 |
| Not identified | 공선·희소·변동 부족 |

`non-significant`를 `효과 없음`으로 번역하지 않는다.

### 4.5 P1 — 사용자 근거 화면

- 채널별 active/flight/low-spend 주차 표시
- 실제 성과와 지출의 이중축 차트
- 통제 전·후 상관 비교
- lag별 coefficient 및 CI
- 판정에 사용된 신호 투표표
- 판정을 막은 식별 실패 사유
- 추천 실험 설계와 필요한 기간

### 4.6 P2 — 실험 연결

- 5-23 홀드아웃 결과를 카니발 진단 근거로 가져온다.
- 동일 채널·OS·기간·목표에만 연결한다.
- 실험 효과를 회귀계수의 강한 prior로 자동 적용하기 전 단위 변환을 검증한다.
- 관측 신호와 실험 결과가 충돌하면 실험을 우선하고 충돌 사실을 표시한다.

---

## 5. 회귀·Decomp 개선사항

### 5.1 P0 — 2단계 모델 권한

#### 1단계: 그룹 총량

```text
Performance total = Σ Performance Cost
Branding total = Σ Branding Cost
```

- 두 그룹의 Adstock·Hill feature를 공동 적합한다.
- 이 단계만 Decomp의 Performance·Branding 총량을 결정한다.
- 채널 공선성이 그룹 총량을 직접 0으로 만들지 않게 한다.

#### 2단계: 채널 배분

- 그룹 총량을 고정한 뒤 채널에 배분한다.
- 총량은 채널 배분 때문에 변하지 않는다.
- 배분 방법 후보:

  - 주별 adstocked spend share
  - positive posterior coefficient share
  - 계수+지출 혼합 share
  - 공선 그룹 내부 group-refit share
  - 실험 calibration share

- 모든 배분은 방법명과 `BY_CONSTRUCTION` 라벨을 표시한다.

### 5.2 P0 — 기여 정의

두 기여 정의를 명확히 분리한다.

| 정의 | 계산 | 용도 |
|---|---|---|
| 가산 기여 | `β × transformed feature` | Decomp 항등식 |
| 반사실 기여 | 현재 예측 − 해당 그룹 Cost=0 예측 | ROI·증분 시나리오 참고 |

- Decomp 기본값은 가산 기여를 사용한다.
- ROI/예산 시뮬레이션은 반사실 결과를 별도 표시한다.
- 두 숫자를 같은 열이나 같은 라벨로 혼합하지 않는다.

### 5.3 P0 — prior와 penalty

- business-contribution prior 기본 강도를 diffuse로 전환한다.
- straight-trend reference prior를 기본 동작에서 제거한다.
- 외부 실험 prior만 적용 가능하도록 provenance를 요구한다.
- media penalty가 실제 posterior precision에 반영되는지 단위 테스트한다.
- UI 슬라이더와 엔진 파라미터가 같은 값을 사용하는지 확인한다.
- `penalty=0`과 `penalty>0` 결과가 완전히 같으면 dead knob 경고를 표시한다.
- 추세·계절·이벤트·업황과 media의 정규화 스케일을 맞춘다.

### 5.4 P0 — 공선성 처리

- pair correlation이 아니라 다중 R² 기반 VIF를 사용한다.
- 채널별 VIF, condition number, posterior correlation을 제공한다.
- 공선 채널은 자동 그룹 후보로 제시한다.
- 그룹 총량은 추정하되 그룹 내부 채널은 `ALLOCATED`로 표시한다.
- 음의 계수를 0으로 clip하기 전 원계수·CI·clip 여부를 보존한다.
- `clip-zero`와 `genuine-null`을 구분한다.

### 5.5 P1 — 변환 선택

- Adstock 후 Hill 순서를 고정한다.
- 채널별 geometric/binomial adstock 후보를 비교한다.
- Reach/Frequency가 있으면 spend-only와 RF 모델을 비교한다.
- Adstock·Hill 파라미터는 시간순 OOS로 선택한다.
- transform 후보 간 기여 차이를 uncertainty에 반영한다.
- 관측 범위 밖 spend·adstock·frequency를 외삽하지 않거나 명시적으로 cap한다.

### 5.6 P1 — 회귀 진단

- in-sample R², adjusted R²
- rolling OOS WMAPE·RMSE·MAE
- persistence baseline 비교
- residual ACF 1·4·13주
- Durbin-Watson·Breusch-Godfrey
- 이분산 진단
- coefficient posterior·CI
- prior-to-posterior 이동
- 관측값의 90% 구간 포함률
- 영향점·고레버리지 주차
- 이벤트 단일관측 과적합 경고

### 5.7 P1 — 계층 모델

- GEO가 있는 경우 national 단일 회귀 외에 geo partial pooling을 적합한다.
- national·geo 모델의 예측력과 계수 안정성을 비교한다.
- 적은 표본 geo는 national posterior로 shrink한다.
- geo별 채널 효과를 직접 합산할 때 단위와 인구 규모를 맞춘다.
- GEO가 없으면 national 모델을 정상 실행하고 기능을 잠그지 않는다.

### 5.8 P2 — Bayesian 고도화

- analytical Gaussian posterior와 MCMC 결과를 구분한다.
- 가능하면 다중 chain MCMC, R-hat, ESS, trace 진단을 추가한다.
- full NUTS가 불가능하면 `Meridian-compatible` 또는 `Meridian-like`로 정직하게 표시한다.
- posterior predictive check를 목표 분포·잔차·극단 주차별로 제공한다.
- prior predictive check를 모델 실행 전에 제공한다.

---

## 6. 미래 예측 탭 남은 개선사항

현재 구현된 시나리오·구간·잔차 진단에 이어 다음을 진행한다.

### P0

- 4·8·12·26·52주 horizon별 rolling OOS 성능표
- 예측구간 empirical coverage의 fold 기반 calibration
- 미래 업황·이벤트·step 값을 직접 매핑하는 입력표
- 시나리오 캐시 키에 데이터·매핑·모델·가정·예산 포함
- CSV/XLSX export에 시나리오 비교·진단·provenance 포함
- Total OS 합산 구간에 OS covariance 또는 보수적 합산 규칙 적용

### P1

- Classic/Bayesian 예측 모델 비교 토글
- persistence·seasonal naive·회귀·Bayesian challenger 비교
- 모델 평균 앙상블
- Reach/Frequency 미래 입력
- GEO 계층 미래 예측
- 모델이 관측하지 않은 장기 OFF·급격한 증액 시나리오 차단

---

# Part B. 기타 분석 도구 개선

## 7. 운영 대시보드

### P0

- 모든 카드·차트·CSV export가 동일한 필터 범위를 사용하는지 항등 테스트
- 비용·성과·CPA/ROAS의 분모·분자 기간 일치 검증
- 날짜·OS·채널 필터 provenance 표시
- 이벤트·캠페인 변경 시점 annotation
- 이상치가 합계와 평균에 미친 영향 표시
- 대용량 CSV 계산을 Web Worker로 이동

### P1

- 경영진 요약과 실무 상세 화면 분리
- KPI 변화 원인을 PVM·MMM·소재 분석으로 deep-link
- 최근성 가중 이상탐지
- PDF/PNG/Excel 보고서 포맷 통일
- 데이터 최신성·누락주·중복행 건강 카드

---

## 8. 예산 배분

### P0

- MMM 그룹 총량/채널 배분 결과를 예산 배분 입력으로 연결
- CPR/ROAS 곡선의 OOS 적합 성능 표시
- 관측 spend 범위 밖 배분 차단
- 총예산·채널 최소/최대·변경폭·운영 필수예산 제약
- 공선·식별 실패 채널 추천 제외
- 결과 0 또는 비정상 급증 경로에 fail-safe 적용

### P1

- 최근 4·8·12주와 전체 기간 곡선 비교
- 반응곡선 drift 탐지
- 예산 이동 전·후 예상 성과와 불확실성
- greedy와 constrained optimizer 결과 비교
- 채널별 marginal ROI가 수렴하는지 검사
- 실험 효과로 곡선 calibration

---

## 9. 캠페인 포화도

- 평균 CPA/ROAS와 한계 CPA/ROAS를 명확히 분리한다.
- 저표본 캠페인은 포화 판정을 보류한다.
- 최근 곡선과 전체 곡선의 drift를 표시한다.
- 캠페인 OFF·재개 구간의 carryover를 반영한다.
- 비용 증가 없이 성과가 변한 구간을 업황·시즌 후보로 표시한다.
- 포화 판정과 예산 감액 권고를 별도 단계로 분리한다.

---

## 10. 실험 분석

### P0

- 다중 variant 일괄 검정
- 다중검정 보정
- sequential testing과 peeking 경고
- MDE·power·필요 표본 수 곡선
- ratio metric의 분모·분자 입력 지원
- 실험 기간 중 SRM·표본 누락·중복 유저 검사

### P1

- CUPED/사전기간 보정
- cluster randomization
- geo experiment
- Bayesian probability-of-superiority
- guardrail metric 동시 판정
- 결과를 MMM prior로 전달하는 단위 변환 계약

---

## 11. 증분 분석

### P0

- 통제군·신규 ON·종료 OFF 세 방법의 공통 결과 스키마
- pre-trend·parallel-trend 검증
- spillover·오염 가능성 경고
- 최소 검정력 미달 시 `INCONCLUSIVE`
- 절대 증분 유저·증분율·증분 CPA를 함께 표시
- 실험 단위와 MMM 채널·OS·목표 매핑

### P1

- synthetic control
- staggered DiD
- geo holdout
- 사전기간 자동 선택과 민감도
- 실험 결과를 카니발·MMM 화면에서 근거로 재사용

---

## 12. 소재 분석

### P0

- CTR 하락·Frequency 상승·CPM 상승을 결합한 피로도
- 소재 활성일·누적 spend·누적 impression을 함께 통제
- 캠페인·채널 fixed effect를 적용한 속성 효과
- 저표본 소재의 shrinkage와 판정 보류
- 소재별 성과 변화가 캠페인 믹스 변화인지 분리

### P1

- 소재 생존기간 예측
- 교체 예상일과 제작 필요량
- Concept Matrix 동적 축
- 속성 조합 interaction
- 신규 소재 cold-start prior
- 이미지/카피/포맷 태그 품질 검사

---

## 13. Aha-moment 분석

- 사용자 단위 train/holdout 분리 누수 검사
- 행동 발생 시점이 목표보다 반드시 선행하는지 검증
- window·횟수 grid 탐색에 다중검정 또는 nested validation 적용
- cohort·국가·OS별 안정성 비교
- support가 적은 고 lift 후보 경고
- F1뿐 아니라 precision·recall·lift·absolute users 병기
- 상위 후보 주변 grid 안정성 표시
- negative Aha 또는 이탈 선행 행동 분석
- 결과 export에 재현 가능한 조건식 포함

---

## 14. PVM 성과 변동 분해

- finest grain에서 한 번 분해한 뒤 모든 상위 단계 rollup 유지
- 모든 단계에서 합계 항등식 테스트
- 결과 비중과 비용 비중 라벨 분리
- Mix 효과의 전체 평균 centering 유지
- 신규/종료 캠페인의 분해 convention 표시
- 소재·캠페인·채널 drilldown 복합키 검증
- 기간 선택에 따른 base/current 정의 명시
- PVM 변화 원인을 소재·예산 배분 화면으로 연결

---

## 15. CSV·매핑·데이터 품질

### P0

- 도구별 필드 스코프 안에서만 자동 매핑
- Cost·Spend·Impressions의 의미와 단위를 매핑 화면에서 확정
- 숫자형 문자열의 콤마·통화기호·괄호 음수 처리
- 날짜 형식·주 시작일·중복주·누락주 검사
- OS·GEO·채널 명칭 정규화
- 매핑 변경 시 기존 분석 결과 무효화
- 원본 컬럼→역할→내부 feature provenance export

### P1

- 공통 CSV 건강 리포트
- 대용량 파싱 Web Worker
- 샘플 CSV 자동 생성
- 도구 간 호환 가능한 unified schema
- 민감 컬럼 탐지와 브라우저 외 전송 없음 안내

---

## 16. 공통 UX·리포팅

- 화면 상단에 결론·절대 인원·경고·다음 행동을 먼저 표시한다.
- 전문 진단은 접힌 상세 영역에 둔다.
- `0`, `추정 불가`, `식별 불가`, `데이터 없음`을 서로 다른 상태로 표시한다.
- 모든 숫자에 기간·OS·목표·통화·모델명을 붙인다.
- 화면과 CSV/XLSX export가 같은 계산 원천을 사용한다.
- 결과 다운로드에 모델 버전·커밋·입력 해시·매핑·필터·가정을 포함한다.
- 다크·라이트 모드에서 차트·범례·경고 색상을 검증한다.
- 조건부 마운트 차트는 최초 resize를 보장한다.

---

## 17. 공통 성능·테스트

### 테스트

- 순수 수학 함수 합성 데이터 테스트
- 기간 필터 항등식 테스트
- 그룹 총량=채널 배분 합 테스트
- 동일 입력의 byte-identical 결정론 테스트
- render smoke test
- 대용량 CSV 성능 테스트
- NaN·0·상수열·완전공선·희소집행 edge case
- Android·iOS·Total 합산 테스트
- GEO 없음/있음 양쪽 경로 테스트

### 성능

- 무거운 적합은 `분석하기` 이후에만 실행
- 데이터·매핑·모델·가정 signature 기반 캐시
- 토글은 캐시 lookup만 수행
- 후보 grid는 Web Worker에서 계산
- 브라우저 메모리 상한과 후보 수 cap을 UI에 표시

---

## 18. 권장 실행 순서

### Wave 1 — 모델 신뢰성

1. 추세 nuisance·penalty 대칭화
2. Trend sink 분해
3. 그룹 총량/채널 배분 계약 고정
4. prior·penalty dead-knob 테스트
5. 카니발 식별 게이트·복수 신호 판정

### Wave 2 — 검증과 불확실성

6. 52/78/104 추세 CV
7. 다중 horizon OOS
8. posterior·transform uncertainty
9. residual·coverage 진단
10. GEO 계층 모델 비교

### Wave 3 — 의사결정 연결

11. MMM→예산 배분 브리지
12. 홀드아웃→MMM/카니발 근거 브리지
13. 예측 시나리오 export
14. 운영 대시보드 deep-link
15. 통합 provenance

### Wave 4 — 기타 도구

16. 실험 다중검정·sequential testing
17. 증분 synthetic control/geo holdout
18. 소재 피로도·생존기간
19. Aha nested validation
20. PVM drilldown·항등식 강화

---

## 19. PR 분할 권장안

| PR | 범위 | 주요 검증 |
|---|---|---|
| PR-A | 추세 nuisance·52/78/104 profile | OOS·trend/media 민감도 |
| PR-B | Trend sink·항등식 | 주간 합·기간 필터 |
| PR-C | 그룹 총량/채널 배분 계약 | 그룹=채널합 |
| PR-D | prior·penalty 정리 | penalty 0/대칭 테스트 |
| PR-E | 카니발 식별·lag·투표 | 희소·공선 합성 데이터 |
| PR-F | 다중 horizon 예측 | rolling fold·coverage |
| PR-G | MMM↔홀드아웃↔예산 배분 브리지 | 단위·목표·OS 매핑 |
| PR-H | 기타 도구 P0 묶음 | 도구별 골든·render smoke |

---

## 20. 최종 완료 조건

- Performance·Branding 총량의 출처가 하나다.
- Decomp 총량과 채널 배분 합이 모든 기간에서 일치한다.
- 채널 배분이 추정인지 구성상 배분인지 화면에서 구분된다.
- 추세 후보가 시간순 검증으로 선택된다.
- 광고와 추세의 penalty가 비대칭으로 결과를 결정하지 않는다.
- 카니발 red는 적격 데이터와 복수 증거가 있을 때만 발생한다.
- 공선 채널은 0명이 아니라 식별 불가로 표시된다.
- 예측과 인과효과가 분리된다.
- 모든 export가 화면 숫자·필터·모델과 일치한다.
- 전체 테스트·lint·production build가 통과한다.
