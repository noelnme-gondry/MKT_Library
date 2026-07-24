# RR Specification-Multiverse — Prism 20-wave run

실행일: 2026-07-24  
입력: `.local-data/MMM Data - MMM Data set for Prism.csv`  
data hash (SHA-256): `37e571f6b19ae5682fe38dec21bf3bb97efd829dbe54a9f8f7fc13ca4ff2c7b8`  
관측치: 208주 · 미디어 변수: 16개 · 기간: 2022-01-03~2025-12-22

## 실행 규칙

- 20개 wave plan은 실행 전에 고정했다.
- 각 wave는 독립 frozen pre-registration으로 실행했다.
- Gate 임계값은 wave 사이에 변경하지 않았다.
- 모든 wave와 모든 spec을 실행했으며 결과에 따른 조기 종료는 없었다.
- `holdout_error_median`이 `null`이면 해당 wave의 spec에서 rolling-origin 적합값을 계산할 수 없었다는 뜻이다.

## Wave별 성능 지표

| Wave | 설계 가설 | Specs | Admissible | S FAIL | T FAIL | I FAIL | C ABSTAIN | Holdout error 중앙값 | RR 추세 |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | baseline | 192 | 0 | 192 | 192 | 0 | 191 | 3,147.01 | down |
| 2 | seasonal basis 1–3 | 3 | 0 | 3 | 3 | 0 | 3 | — | down |
| 3 | seasonal basis 2–4 | 3 | 0 | 2 | 3 | 0 | 3 | — | down |
| 4 | trend basis ±SE | 3 | 0 | 3 | 3 | 0 | 3 | — | down |
| 5 | trend −SE | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 6 | trend +SE | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 7 | adstock 0/.2/.5 | 3 | 0 | 3 | 3 | 0 | 3 | — | down |
| 8 | adstock .5/.8 | 2 | 0 | 2 | 2 | 0 | 2 | — | down |
| 9 | Hill saturation | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 10 | linear + Hill | 2 | 0 | 2 | 2 | 0 | 2 | — | down |
| 11 | ridge prior | 1 | 0 | 1 | 1 | 0 | 1 | 5,125.98 | down |
| 12 | OLS + ridge | 2 | 0 | 2 | 2 | 0 | 2 | 5,125.98 | down |
| 13 | explicit industry | 1 | 0 | 1 | 1 | 0 | 1 | 234,374.04 | down |
| 14 | leave-one-out channel set | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 15 | season 1–2 + adstock 0/.5 | 4 | 0 | 4 | 4 | 0 | 4 | — | down |
| 16 | season 2–3 + Hill | 2 | 0 | 2 | 2 | 0 | 2 | — | down |
| 17 | trend ±SE + ridge | 2 | 0 | 2 | 2 | 0 | 2 | 5,456.50 | down |
| 18 | adstock 0/.8 + linear/Hill | 4 | 0 | 4 | 4 | 0 | 4 | — | down |
| 19 | season 1–4 + explicit industry | 4 | 0 | 4 | 4 | 0 | 4 | 234,374.04 | down |
| 20 | trend ±SE + adstock + prior | 18 | 0 | 18 | 18 | 0 | 18 | 5,829.50 | down |

## 종합 판정

- 총 spec: **250**
- admissible spec: **0**
- 전체 taxonomy: **INCONCLUSIVE**
- wave loop 조기 종료: **false**
- 모든 wave에서 RR 추세 방향은 **down**으로 유지됐다.
- 산업 Gate I는 모든 wave에서 실패하지 않았다.
- 계절성 Gate S와 추세 Gate T가 구조적으로 통과되지 않았고, 채널 Gate C는 대부분 `ABSTAIN`이었다.

이 결과는 채널 성과가 0이라는 의미가 아니다. 현재 데이터·모델 구조·사전등록 임계값 조합으로는 채널별 기여를 방어적으로 식별할 수 없다는 의미다.
