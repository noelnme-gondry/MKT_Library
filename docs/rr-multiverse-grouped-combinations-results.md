# RR Specification-Multiverse — grouped exhaustive combinations

실행일: 2026-07-24  
입력: `.local-data/MMM Data - MMM Data set for Prism.csv`  
data hash (SHA-256): `37e571f6b19ae5682fe38dec21bf3bb97efd829dbe54a9f8f7fc13ca4ff2c7b8`  
관측치: 208주 · 미디어 변수: 16개

## 실행 정의

기존 50개 post-selection wave를 holdout error 기준 source wave별로 묶고, 각 그룹에서 실제로 등장한 factor 값의 합집합을 만들었다. 각 그룹의 다음 Cartesian product를 전부 실행했다.

`trendBasis × seasonalBasis × industryHandling × adstock × saturation × channelSet × prior`

이 분석은 source wave 선택 자체가 post-selection exploratory 단계이므로 confirmatory 분석이 아니다. 그룹 내부 조합은 결과와 무관하게 전수 실행했고, 조기 종료하지 않았다.

## 그룹별 factor union 및 성능

| Group | Source wave | Source wave 수 | Trend | Season | Industry | Adstock | Saturation | Channel set | Prior | 조합 수 | Admissible | S FAIL | T FAIL | I FAIL | C ABSTAIN | Holdout 중앙값 | 추세 |
|---:|---:|---:|---|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 16 | 10 | 3 | 4 | 1 | 4 | 1 | LOO | ridge | 48 | 0 | 48 | 48 | 0 | 47 | 2,035.75 | down |
| 2 | 14 | 10 | 3 | 4 | 1 | 4 | 1 | full | ridge | 48 | 0 | 48 | 48 | 0 | 46 | 2,064.66 | down |
| 3 | 40 | 10 | 3 | 4 | 1 | 3 | 1 | LOO | ridge | 36 | 0 | 36 | 36 | 0 | 36 | 2,079.09 | down |
| 4 | 38 | 10 | 3 | 4 | 1 | 3 | 1 | full | ridge | 36 | 0 | 36 | 36 | 0 | 35 | 2,113.70 | down |
| 5 | 12 | 10 | 3 | 4 | 1 | 4 | 1 | LOO | ridge | 48 | 0 | 36 | 48 | 0 | 47 | 2,471.82 | down |

약어: `LOO` = leave-one-out channel set. 숫자는 각 factor에서 가능한 값의 개수다.

## 종합 판정

- hypothesis group: **5개**
- 전수 조합: **216개**
- exhaustive: **true**
- admissible: **0개**
- taxonomy: **INCONCLUSIVE**
- 조기 종료: **false**
- 모든 그룹에서 RR 추세 방향: **down**

Gate S/T는 전체 조합에서 실패했고, Gate C는 거의 모든 조합에서 `ABSTAIN`이었다. 이는 채널 성과 0이 아니라, 현재 데이터와 모델 구조에서 채널별 기여 식별이 보류된다는 뜻이다.
