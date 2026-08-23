# PR #717 감사 보고서 — 도치 복구 · 작업대 지연 준비 · 데모/WebR 가드

- **대상**: PR #717 `도치 복구와 데모 분석 가드 강화` (머지 커밋 `5c00431`, 16파일 +289/-107)
- **기준 시점**: 2026-08-23, `main` = `5c00431`
- **성격**: PR #714 감사(`docs/pr-714-audit.md`)에서 제기한 9건에 대한 **후속 검증**
- **검증 상태**: `npx vitest run` → **311 파일 · 2462 통과 (1 skipped)** — green

## 판정 요약

| 이전 지적 | 심각도 | 판정 | 근거 |
|---|---|---|---|
| P0-1 도치 인테이크 실패 시 영구 정지 | P0 | **해소** | 업로더 상시 마운트 + `onImportFailed` 복구, 실패 경로 스모크 추가 |
| P0-2 작업대 첫 렌더 프리즈 | P0 | **해소** | 2,211ms → **213ms** (2,160행) · 10,998ms → **203ms** (21,600행) |
| P1-3 데모로 RF·SVM 실행 불가 | P1 | **해소** | 고유 소재 73 → **480**, 연속형 특성 0 → **5** · 4개 지표 전부 `ok:true` |
| P1-4 5-28 세그먼트 비교 미작동 | P1 | **부분 해소** | 계산 거부는 사라졌으나 세 축 모두 무유의(p=0.31·0.87·0.65) |
| P1-5 로그랭크 0-이벤트 거부 | P1 | **해소 (수치 검증 완료)** | 손계산 참조 χ²=9.000000·p=0.002700과 **완전 일치** |
| P2-6 5-28 생존 구조 인위성 | P2 | **해소** | 이벤트가 2~14 전 구간 분포, 중앙 생존기간 12로 도달 |
| P2-7 `title_len` 음수 | P2 | **해소** | 범위 20~65, 0 이하 0건 |
| P2-8 데모 필드 공백 | P2 | **해소 · 단 회귀 1건 동반** | 아래 신규 N-1 |
| P2-9 가드가 행 수만 검사 | P2 | **대부분 해소** | 실행 가능성·값 범위 파생 검사 추가 (잔여는 N-4) |
| WebR 상한 n 없음 / 분리 미보고 | 참고 | **해소 · 단 부작용 2건** | 아래 N-2·N-3 |

**신규 발견 4건** (이번 PR이 만들었거나 드러낸 것): N-1(P1) · N-2(P2) · N-3(P2) · N-4(P2) · N-5(P3)

---

## 해소 확인 (실측)

### P0-1 — 도치 인테이크 복구

- `CsvUploader.jsx`에 `onImportFailed` prop 신설, 모든 실패 지점을 `reportImportFailure()` 한 곳으로 모음(빈 파일 · 파싱 오류 · 용량 초과 · XLSX 오류 · 워크북/와이드 변환 실패 · 시트 오류 · 사용자 취소).
- `DochiAssistant.jsx`: 업로더를 **언마운트하지 않고** `<div hidden={phase === "sorting"}>`로 감싸고, `recoverFromImportFailure()`가 타이머를 비우고 `phase`를 `welcome`으로 되돌린다.
- `GoogleSheetConnect`의 실패 경로 4곳(`sheet_invalid_url` · `sheet_${error}` · `sheet_fetch`)이 모두 state를 넘기므로 `reportImportFailure`를 탄다 — 시트 경로도 복구된다.
- 실패 경로 스모크가 추가됐다(`DochiAssistant.smoke.test.jsx` — 실패 버튼 클릭 후 `data-phase="welcome"`, 업로더 존재, `push` 미호출).

### P0-2 — 작업대 첫 렌더

`preparations`(19개 도구 전수 재구성)를 `mappingContracts` + `mappingsByTool`로 대체하고, canonical/legacy 재구성은 `prepareHandoffForTool()`로 **클릭 시점**에만 수행한다.

| 행 수 | 이전(19회 전수 재구성) | 현재(계약 19회 + 자격판정) |
|---|---|---|
| 2,160 | 2,211 ms | **213 ms** (계약) + 9 ms (자격) |
| 21,600 | 10,998 ms | **203 ms** + 43 ms |
| 108,000 | 32 s+ | **163 ms** + 144 ms |

`buildMappingContract`는 행을 샘플링하므로 데이터가 커져도 거의 상수다. 어댑터 실행도 더블 rAF로 바뀌어 결과 카드가 먼저 커밋된다.

### P1-3 — RF·SVM

```
creative: rows=2181  고유소재=480  numericFeatures=[duration_seconds, text_length, scene_cut_count, face_screen_ratio, speech_rate]
  metric=ctr   n=480 p=23 numeric=5 | RF OK(req 460) | SVM OK(req 230)
  metric=cvr / cpa / roas          | RF OK           | SVM OK
```

매트릭스 셀(부족·미관측 조합)은 보존한 채 검증된 조합에만 소재를 추가해 480개를 채웠고, `actions`도 함께 들어와 CPA·ROAS 경로가 열렸다.

### P1-5 — 로그랭크 (수치 검증)

가드를 제거한 뒤 참조값과 대조:

| 케이스 | 기대 | 실제 |
|---|---|---|
| A: 5명 전원 t=1 이벤트 / B: 5명 전원 t=2 절단 | χ²=9.000000, p=0.002700 | **χ²=9.000000, p=0.002700** |
| 전 그룹 0 이벤트 | 계산 불가 폴백 | `ok:false, covariance_not_estimable` |

가장 강한 차이를 "구분 불가"로 뒤집던 문제가 사라졌고, 정말 추정 불가한 경우만 보류한다. 화면 문구도 "위험집합 변동이 충분하지 않아 검정을 계산하지 못했습니다"로 정정됐다.

### P2-6 / P2-7

```
5-28 KM: 2:d=3 | 3:d=5 | 4:d=4 | 5:d=8 | 6:d=2 | 7:d=2 | 8:d=7 | 9:d=1 | 10:d=3 | 11:d=3 | 12:d=5 | 13:d=8 | 14:d=1
  peak hazard t=13 (0.533, 위험집합 15) · median=12 · evidence=READY
  기간모드 ↔ 날짜모드 시간 불일치: 0행 (setUTCMonth 월말 롤오버 우려 → 실측 영향 없음)
content_attr: title_len 20~65, 0 이하 0건
```

---

## 신규 발견

### N-1 (P1). efficiency 데모에 "오가닉인데 광고비가 있는" 720행이 생겼다

`demoData.js:81` — `source: ci === 2 ? "organic" : "paid"`에서 **`ci`는 채널이 아니라 캠페인 인덱스**(`Prospecting`/`Retargeting`/`Lookalike`)다. 결과적으로 **모든 유료 채널의 Lookalike 캠페인이 오가닉으로 라벨링**된다.

실측:

```
paid    n=1440  채널=Google UAC/Meta AAP/TikTok/Apple Search Ads  cost합=1,454,878,770
organic n=720   채널=Google UAC/Meta AAP/TikTok/Apple Search Ads  cost합=  908,642,736
organic인데 cost > 0 인 행: 720 / 720
```

- "Apple Search Ads = 오가닉", "Google UAC - Lookalike = 오가닉"이라는 조합 자체가 모순이다.
- 소비처가 실제로 있다: `dashboard/SeasonalityTab.jsx:162~163`이 `classifySeasonalitySource`로 Paid/Organic 계열을 나눠 그리고, `DashboardFilterBar.jsx:117~130`이 소스 필터를 띄우며, `dashboardAggregator.js:131`이 그 값으로 행을 거른다. → 화면에 **오가닉 CPI·CPA·ROAS 9.09억원어치**가 계산돼 나온다.
- AGENTS §2.8(정직성) · §11(데이터 없는 상태를 채워 넣지 말 것)에 어긋나며, **P2-8을 고치는 과정에서 새로 들어온 회귀**다.

**제안**: 오가닉은 별도 행(채널 `Organic`, `cost: 0`, `impressions/clicks` 없음 또는 자체 값)으로 만들고, 유료 캠페인에는 `source: "paid"`를 유지한다. 새 가드(`new Set(source) == {paid, organic}`)는 값의 존재만 보므로, **`source === "organic" → cost === 0`** 불변식을 함께 넣어야 한다.

### N-2 (P2). `too_many_observations`에 전용 안내가 없어 반대로 말한다

`analysisRegistry.js`에 `maxObservations: 1000`이 추가돼 큰 데이터는 `{ok:false, reason:"too_many_observations"}`로 막힌다. 그런데 두 패널의 카드 본문은 여전히 하한 문구만 쓴다.

- `CreativePredictiveModelPanel.jsx:110` → `C.rfNeed(...)` = "RF는 현재 변수 수 기준 독립 소재 N개 이상이 **필요합니다**"
- `WebRRandomForestPanel` → `T.blocked(n, required)` 동일 형태

즉 소재가 5,000개인 사용자는 **넘쳐서 막혔는데 "부족하다"는 안내**를 본다. `baseline_regression_not_estimable`에는 전용 문구(`baselineUnavailable`)를 KO/EN 모두 붙여 놓은 것과 대비된다. 상한 사유에도 같은 급의 문구가 필요하다(예: "표본이 너무 커 브라우저 R 엔진에서 보류했습니다. 기간·세그먼트를 좁혀 다시 실행하세요").

### N-3 (P2). RF에 실행 불가능한 구간(dead zone)이 생겼다

RF는 하한 `max(100, p × 20)`, 상한 `1000`인데 **`maxPredictors`가 없다**. 따라서 `p ≥ 51`이면 하한(1,020)이 상한(1,000)을 넘어 **어떤 데이터로도 실행할 수 없다.**

```
RF p=51, n=1000 → {ok:false, reason:"insufficient_observations", requiredObservations:1020}
```

SVM은 `maxPredictors: 80`이라 하한이 최대 800으로 상한 아래에 머물러 안전하다. 9-6은 속성 인코딩으로 예측변수가 늘어나므로(데모 기준 이미 23개) 속성·레벨이 많은 실제 CSV에서 이 구간에 닿을 수 있다. RF에도 `maxPredictors`를 두거나 상한을 하한과 함께 계산해야 한다.

### N-4 (P2). 5-28 세그먼트는 "계산은 되지만 볼 것이 없다"

새 데모는 세 축 모두 검정이 성립하지만 차이 신호가 없다:

| 세그먼트 | 그룹별 n / 이벤트 | log-rank |
|---|---|---|
| `channel` | 36/14 · 36/23 · 36/15 | χ²=2.314, **p=0.314** |
| `event_type` | 36/19 · 36/17 · 36/16 | χ²=0.271, **p=0.873** |
| `campaign_name` | 54/26 · 54/26 | χ²=0.212, **p=0.645** |

생성기에 위험 계수(`channelRisk=[24,50,36]` 등)를 심었지만 결정론 해시(`(index*37 + …) % 100`)와 섞이면서 생존시간 분포가 겹쳐 그룹당 n=36으로는 검정력이 나오지 않는다. 무유의를 무유의로 표시하는 것 자체는 정직하지만(§8.6), **"세그먼트 비교를 체험시킨다"는 데모 목적은 여전히 미달**이다.

새 가드(`demoData.test.js`)도 이 상태를 통과시킨다 — 검사가 `모든 그룹에 이벤트 ≥ 1` + `logRankTest(...).ok === true`까지만 보기 때문이다. 위험 계수를 생존시간(tenure)에도 반영하거나 그룹 크기를 키워 최소 한 축은 유의하게 만들고, 가드에 "적어도 한 세그먼트 축은 p < 0.05" 같은 신호 조건을 넣는 편이 낫다.

### N-5 (P3). 남은 잔여 경로 2가지

1. `CsvUploader.jsx:546·552` `handleRefreshSheet`(🔄 최신 데이터 불러오기)의 실패는 여전히 `setErrorMsg` + `trackImportFailure`만 부르고 `onImportFailed`를 부르지 않는다. 이 경로는 `onImportStart`도 호출하지 않아 도치가 `reading`에 들어가지 않으므로 **실질 데드엔드는 아니다** — 일관성 차원의 잔여.
2. 핸드오프 준비가 클릭 시점으로 옮겨졌으므로, 대용량 CSV에서 "추가 차트·상세 분석 열기"를 누르는 순간 **1회분 블로킹**이 남는다(실측 108,000행 기준 3.0초, 스피너 없음). 19회 → 1회로 줄었지만 완전히 사라진 것은 아니다.

---

## 그 밖에 확인한 것

- `demoData.test.js`에 실행 가능성·값 범위 파생 검사가 추가돼 P2-9의 취지가 상당 부분 반영됐다(RF/SVM `ok:true`, 세그먼트 이벤트 존재, `title_len` 20~65, `source`/`snapshot_date`/`country`/`target_cpt` 존재).
- WebR의 baseline 비수렴 감지(`!isTRUE(converged) || any(abs(coef) > 25)` → `stop("baseline_regression_not_estimable")`)와 KO/EN 전용 문구는 "RF·SVM 우위로 해석하지 않습니다"까지 명시해 §8 기준을 충족한다.
- 5-28 화면의 검정 실패 문구가 사실에 맞게 정정됐다.
- `aso_store`·`asa_keyword`·`brand_incrementality` 데모에 `country`·`target_cpt`·`cost`/`channel`이 추가돼 P2-8의 나머지 항목이 채워졌다. 브랜드 데모의 `brand_search`·`campaign_on` 값은 그대로라 ITS 결과는 불변이다.
- `naturalCandidates`가 store의 canonical 레코드를 우선 사용하도록 바뀌어 중복 재구성이 사라졌다.

## 권고 작업 순서

1. **N-1** efficiency 데모의 오가닉 행을 비용 0인 별도 행으로 분리 + `organic → cost === 0` 불변식 가드 (거짓 숫자가 화면에 나오는 유일한 항목)
2. **N-2** 상한 사유 전용 안내 문구(KO/EN)
3. **N-3** RF `maxPredictors` 도입 또는 상·하한 동시 계산
4. **N-4** 5-28 세그먼트에 실제 신호 부여 + 가드에 신호 조건 추가
5. **N-5** 잔여 경로 정리(선택)

---

*이 문서는 감사 결과만 담는다. 코드 수정은 포함되어 있지 않다.*
