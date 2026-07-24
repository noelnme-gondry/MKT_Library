# RR Specification-Multiverse — Prism 50-wave run

실행일: 2026-07-24  
입력: `.local-data/MMM Data - MMM Data set for Prism.csv`  
data hash (SHA-256): `37e571f6b19ae5682fe38dec21bf3bb97efd829dbe54a9f8f7fc13ca4ff2c7b8`  
관측치: 208주 · 미디어 변수: 16개 · 기간: 2022-01-03~2025-12-22

## 사전등록·고유성

- 50개 wave plan은 실행 전에 생성했다.
- 각 wave는 독립 frozen pre-registration이다.
- 50개 wave의 `factor_config` JSON이 모두 달랐다(`uniqueGrids=50`).
- Gate 임계값은 wave 사이에 변경하지 않았다.
- 결과에 따른 조기 종료는 없었다.
- `—`는 해당 wave의 rolling-origin holdout error가 추정되지 않았음을 뜻한다.

## Wave별 성능 지표

`S/T/I/C`는 각각 Gate S/T/I 실패 수와 Gate C `ABSTAIN` 수다. 모든 hypothesis ID는 코드에서 `pre-registered-structural-variant-N`으로 고정된다.

| Wave | Hypothesis | Specs | Admissible | S | T | I | C | Holdout error 중앙값 | RR 추세 |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | baseline | 192 | 0 | 192 | 192 | 0 | 191 | 3,147.01 | down |
| 2 | variant-2 | 1 | 0 | 1 | 1 | 0 | 1 | 4,549.06 | down |
| 3 | variant-3 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 4 | variant-4 | 1 | 0 | 1 | 1 | 0 | 1 | 4,035.48 | down |
| 5 | variant-5 | 1 | 0 | 1 | 1 | 0 | 1 | 248,698.44 | down |
| 6 | variant-6 | 1 | 0 | 1 | 1 | 0 | 1 | 2,847.57 | down |
| 7 | variant-7 | 1 | 0 | 1 | 1 | 0 | 1 | 241,484.22 | down |
| 8 | variant-8 | 1 | 0 | 1 | 1 | 0 | 1 | 2,811.59 | down |
| 9 | variant-9 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 10 | variant-10 | 1 | 0 | 1 | 1 | 0 | 1 | 2,503.55 | down |
| 11 | variant-11 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 12 | variant-12 | 1 | 0 | 1 | 1 | 0 | 1 | 2,437.59 | down |
| 13 | variant-13 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 14 | variant-14 | 1 | 0 | 1 | 1 | 0 | 1 | 2,041.67 | down |
| 15 | variant-15 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 16 | variant-16 | 1 | 0 | 1 | 1 | 0 | 1 | 2,021.34 | down |
| 17 | variant-17 | 2 | 0 | 2 | 2 | 0 | 2 | — | down |
| 18 | variant-18 | 2 | 0 | 2 | 2 | 0 | 2 | 4,549.06 | down |
| 19 | variant-19 | 2 | 0 | 2 | 2 | 0 | 2 | — | down |
| 20 | variant-20 | 2 | 0 | 2 | 2 | 0 | 2 | 4,035.48 | down |
| 21 | variant-21 | 2 | 0 | 2 | 2 | 0 | 2 | 248,698.44 | down |
| 22 | variant-22 | 2 | 0 | 2 | 2 | 0 | 2 | 2,847.57 | down |
| 23 | variant-23 | 2 | 0 | 2 | 2 | 0 | 2 | 241,484.22 | down |
| 24 | variant-24 | 2 | 0 | 2 | 2 | 0 | 2 | 2,811.59 | down |
| 25 | variant-25 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 26 | variant-26 | 1 | 0 | 1 | 1 | 0 | 1 | 5,125.98 | down |
| 27 | variant-27 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 28 | variant-28 | 1 | 0 | 1 | 1 | 0 | 1 | 4,443.23 | down |
| 29 | variant-29 | 1 | 0 | 1 | 1 | 0 | 1 | 234,374.04 | down |
| 30 | variant-30 | 1 | 0 | 1 | 1 | 0 | 1 | 3,194.90 | down |
| 31 | variant-31 | 1 | 0 | 1 | 1 | 0 | 1 | 234,262.32 | down |
| 32 | variant-32 | 1 | 0 | 1 | 1 | 0 | 1 | 2,984.43 | down |
| 33 | variant-33 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 34 | variant-34 | 1 | 0 | 1 | 1 | 0 | 1 | 2,837.79 | down |
| 35 | variant-35 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 36 | variant-36 | 1 | 0 | 1 | 1 | 0 | 1 | 2,666.91 | down |
| 37 | variant-37 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 38 | variant-38 | 1 | 0 | 1 | 1 | 0 | 1 | 2,219.64 | down |
| 39 | variant-39 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 40 | variant-40 | 1 | 0 | 1 | 1 | 0 | 1 | 2,128.05 | down |
| 41 | variant-41 | 2 | 0 | 2 | 2 | 0 | 2 | — | down |
| 42 | variant-42 | 2 | 0 | 2 | 2 | 0 | 2 | 5,125.98 | down |
| 43 | variant-43 | 2 | 0 | 2 | 2 | 0 | 2 | — | down |
| 44 | variant-44 | 2 | 0 | 2 | 2 | 0 | 2 | 4,443.23 | down |
| 45 | variant-45 | 2 | 0 | 2 | 2 | 0 | 2 | 234,374.04 | down |
| 46 | variant-46 | 2 | 0 | 2 | 2 | 0 | 2 | 3,194.90 | down |
| 47 | variant-47 | 2 | 0 | 2 | 2 | 0 | 2 | 234,262.32 | down |
| 48 | variant-48 | 2 | 0 | 2 | 2 | 0 | 2 | 2,984.43 | down |
| 49 | variant-49 | 1 | 0 | 1 | 1 | 0 | 1 | — | down |
| 50 | variant-50 | 1 | 0 | 1 | 1 | 0 | 1 | 6,050.77 | down |

## 종합 판정

- 총 wave: **50**
- 총 spec: **257**
- 고유 factor grid: **50**
- admissible spec: **0**
- 전체 taxonomy: **INCONCLUSIVE**
- wave loop 조기 종료: **false**
- 모든 wave에서 RR 추세 방향은 **down**이었다.
- Gate I는 모든 spec에서 실패하지 않았다.
- Gate S/T는 모든 spec에서 실패했고, Gate C는 모든 spec에서 `ABSTAIN`이었다.

이 결과는 채널 성과가 0이라는 뜻이 아니다. 현재 데이터와 사전등록된 모델 구조에서는 채널별 기여를 방어적으로 식별할 수 없다는 뜻이다.
