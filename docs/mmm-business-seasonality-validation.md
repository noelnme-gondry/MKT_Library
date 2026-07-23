# MMM business seasonality validation

검증 대상: `MMM Data - MMM Data set (1).csv` 103주, 타깃 `RR`, 이벤트 더미 사용, Brand/Performance 채널 분리.

## 반복 라운드

### 라운드 1 — 최종 채널 설계행렬 재평가

기존에는 집계 패널에서 후보를 먼저 줄인 뒤 일부 후보만 원 채널 단위 BIC를 계산했다. 집계 단계와 최종 채널 단계의 순위가 달라질 수 있으므로, `none`부터 `annual-4`까지 모든 후보를 동일한 최종 설계행렬에서 재평가하도록 변경했다.

결과: 실제 자동 선택이 `annual-1`에서 `annual-4`로 변경됐다.

### 라운드 2 — rolling 안정성 가드

full-history 적합도만 높은 후보가 과적합으로 선택되지 않도록, 각 후보를 12주 horizon의 3개 chronological fold에서 순방향 검증한다. 무계절 모델 대비 WMAPE 악화가 2%p를 넘는 후보는 분해 후보에서 제외한다. 예측 모델 자체의 rolling 선택과 분해용 seasonality 선택은 분리한다.

실제 데이터에서 `annual-4`의 3-fold 평균 WMAPE는 2.117%, `none`은 1.619%로 차이는 0.499%p였다. 허용범위 안이므로 seasonality를 유지했다.

### 라운드 3 — 외부시장 통제 합의 검증

외부시장 변수를 포함한 모델과 제외한 모델을 각각 평가해 같은 seasonality 후보가 선택되는지 확인한다. 외부시장 지표가 우연히 가진 계절성을 RR의 계절성으로 오인하지 않기 위한 검증이다.

결과: 두 조건 모두 `annual-4`를 선택했다.

### 라운드 4 — 최종 통합 모델

최종 선택 조건은 다음 네 가지를 모두 사용한다.

1. Brand/Performance 집계 패널에서 구조적 BIC 개선
2. 원 채널 패널에서 최종 BIC 재평가
3. 52주 lag seasonal-shape correlation 및 seasonal RMS
4. rolling stability와 외부시장 통제 합의

## 실제 CSV 최종 결과

| 지표 | 기존 자동 결과 (`annual-1`) | 최종 (`annual-4`) |
|---|---:|---:|
| R² | 0.96328 | 0.98344 |
| RMSE | 574.9 | 386.0 |
| 잔차 ACF(1) | 0.525 | 0.243 |
| 최종 BIC 개선 | 기준 | 65.41 |
| 52주 seasonal correlation | 기준 | 0.999 |
| 계절성 범위 | 약 -754 ~ +754 | 약 -1,013 ~ +1,888 |

최종 모델은 `Trend`, `Seasonality`, `Holidays & Events`, `Performance`, `Brand`를 분리한다. 현재 데이터는 103주에 비해 채널·제어변수가 많고 최대 매체 상관이 0.915이므로, 결과는 분해·해석용으로 사용하며 예산 최적화는 계속 차단한다.

## 구현 검증

- `npm run test:all`
- `npm run lint`
- `npm run build`
- 제공 CSV를 실제로 읽어 `RR` 타깃으로 자동 선택·분해 실행
