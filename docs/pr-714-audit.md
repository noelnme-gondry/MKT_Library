# PR #714 감사 보고서 — 도치 작업대 · 생존/이탈 분석 · RF·SVM · 데모 데이터

- **대상**: PR #714 `모든 도구 데모 데이터 깊이 검증 강화` (머지 커밋 `0cc3be4`)
  - 함께 본 하위 스택: #713(5-28 일반화) · #712(도치 작업대 + 생존 분석) · #711(분석 라우터)
- **기준 시점**: 2026-08-23, `main` = `0cc3be4`
- **검증 상태**: `npx vitest run` → **311 파일 · 2456 통과 (1 skipped)** — green
- **성격**: 아래 발견은 **테스트가 깨진 것이 아니라, 테스트가 보지 않는 자리**들이다.

## 요약 (심각도 순)

| # | 심각도 | 영역 | 한 줄 |
|---|---|---|---|
| 1 | **P0** | 도치 인테이크 | CSV 파싱 실패 시 화면이 "찾으러 가는 중"에 영구 정지, 에러·재시도 경로 동시 소멸 |
| 2 | **P0** | 첫 분석 진입 | `/start` 작업대가 렌더 중 동기 계산 19회 — 데모에서도 2.2초, 2만 행이면 11초 프리즈 |
| 3 | **P1** | RF·SVM | 배선은 정상이나 **데모로는 영구 실행 불가**(RF 360개 필요/73개, SVM 연속형 특성 0/2) |
| 4 | **P1** | 5-28 데모 | PR이 내세운 "세그먼트 비교"가 데모에서 작동하지 않음(액션 유형=계산 거부, 채널 p=0.992) |
| 5 | **P1** | 생존 엔진 | `logRankTest`의 0-이벤트 그룹 거부가 방향이 반대 — 가장 강한 차이를 "구분 불가"로 표시 |
| 6 | P2 | 5-28 데모 | 이탈/잔존이 기간으로 완전 분리 → 7기간 이후 해저드 0, 절단이 완전 비무작위 |
| 7 | P2 | 9-1 데모 | `title_len`이 주석(20~65)과 달리 **-2~42**, 24행이 0 이하(불가능한 값) |
| 8 | P2 | 데모 필드 | efficiency에 `source`·`snapshot_date` 없음, creative에 `actions`·제작특성 5종 없음 등 |
| 9 | P2 | 이번 PR의 가드 | 새 `DEMO_MINIMUM_ROWS`가 **원본 행 수만** 검사 → 위 3·4·7을 전부 통과시킴 |

---

## P0-1. 도치 인테이크 실패 = 복구 불가

**위치**: `v2-migration/src/components/assistant/DochiAssistant.jsx:88`

```jsx
{phase === "welcome" && <CsvUploader ... onImportStart={beginReading} onPrepared={finishReading} />}
```

`CsvUploader`는 **파싱 시작 시점에 `onImportStart`**(`CsvUploader.jsx:380`)를, **성공했을 때만 `onPrepared`**(`CsvUploader.jsx:370`)를 호출한다.
따라서 빈 CSV · 파싱 오류 · 용량 초과(`assertCsvFileSize`) · XLSX 오류 · 공개 시트 fetch 실패 중 무엇이든 발생하면:

1. `phase`는 `reading`에 머문다 (되돌리는 경로가 없음)
2. 그 순간 조건부 렌더로 **업로더가 언마운트**되면서 `setErrorMsg`가 그린 에러 메시지와 재시도 입력이 **함께 사라진다**
3. 화면에는 "좋아요. 파일을 들고 분석 가능한 도구를 찾으러 가는 중이에요."만 영구히 남는다 → 새로고침 외 탈출구 없음

특히 코피가 권하는 **"전체 공개 스프레드시트 주소"** 경로(`CsvUploader.jsx:793`)는 권한·네트워크 실패 확률이 높아 실사용 노출도가 크다.

### 재현

실제 실패 경로(= `onImportStart`만 호출)를 흉내낸 스모크:

```jsx
vi.mock("@/components/CsvUploader", () => ({
  default: ({ onImportStart }) =>
    <button onClick={() => onImportStart?.({ source: "csv" })}>파일 전달</button>,
}));
// 클릭 후
// data-phase === "reading"                      ← 기대대로
// screen.queryByRole("button", {name:"파일 전달"}) === null  ← AssertionError (업로더 소멸)
```

### 왜 안 잡혔나

`DochiAssistant.smoke.test.jsx:9`의 목이 `onImportStart`와 `onPrepared`를 **항상 같이** 호출한다. 실패 경로가 계약에서 통째로 빠져 있다.

### 제안

- `CsvUploader`에 `onImportFailed` 콜백을 추가하고, 도치는 그때 `phase`를 `welcome`으로 되돌린다.
- 또는 업로더를 언마운트하지 말고 CSS로만 감춘다(에러·재시도 DOM 보존).

### 부수 사항

정상 경로도 `Math.max(0, 3200 - elapsed)` + `1450ms` = **최대 4.65초 강제 대기**(`DochiAssistant.jsx:62~72`)이며 스킵 수단이 없다.

---

## P0-2. `/start` 도착 직후 메인 스레드 프리즈

**위치**: `v2-migration/src/components/assistant/AssistantWorkspace.jsx:504` (`preparations` useMemo)

렌더 중 `ANALYSIS_CATALOG` **19개 전부**에 대해 `prepareDatasetForTool` → `applyGlobalMapping`(= `buildCanonicalDataset` + `buildLegacyRows`)을 동기로 실행한다. 디퍼도, `AnalyzingOverlay` 같은 선(先)페인트도 없다.

### 실측 (efficiency 데모를 배수로 늘려 같은 함수 직접 호출)

| 행 수 | `analysisInputSignature` | preparations ×19 |
|---|---|---|
| 2,160 (데모 기본) | 5 ms | **2,211 ms** |
| 21,600 | 27 ms | **10,998 ms** |
| 108,000 | 88 ms | 32 s+ (prepare 단계만) |

- `analysisInputSignature`(전 셀 해시)는 우려와 달리 저렴하다 — 병목은 19회 재구성이다.
- 의존성이 `csvData.mapping`이므로 **매핑 리뷰에서 컬럼 하나를 고칠 때마다 19회 전부 재실행**된다.
- 도치 경로에서는 4.65초 애니메이션 직후에 이 정지가 이어져 체감이 가장 나쁜 지점에 놓인다.

### 제안

AGENTS §7·§4.4 규율 그대로 — (a) 무거운 재구성을 분석 게이트/큐 뒤로 미루고, (b) 더블 rAF 디퍼로 스피너를 먼저 페인트하며, (c) 카탈로그 19개를 한꺼번에 준비하지 말고 **큐가 실제로 실행하는 항목만** lazy 준비한다(자격 판정은 `mappingContract`만으로 가능).

---

## P1-3. RF·SVM — "반영"은 됐지만 데모로는 절대 실행되지 않는다

배선 자체는 정상이다.

- 9-1 `ContentElementAnalyzer.jsx:1136` → `WebRRandomForestPanel`
- 9-6 `CreativeAnalyzer.jsx:1384` → `CreativePredictiveModelPanel` (RF + SVM을 같은 5-fold로 비교)

문제는 **게이트 임계값과 데모 데이터의 불일치**다. `creative` 데모로 자격 판정을 직접 돌린 결과:

```
creative demo rows: 1774 / 독립 소재(분석 단위): 73 / 연속형 제작특성: []
metric=ctr  design.ok=true  n=73  predictors=18
RF : {ok:false, reason:"insufficient_observations", n:73, requiredObservations:360}
SVM: {ok:false, reason:"insufficient_continuous_features", numericFeatureCount:0, requiredNumericFeatures:2}
```

- **RF**: `max(100, predictorCount × 20)` = **360 소재** 필요, 데모는 73개
- **SVM**: `duration_seconds · text_length · scene_cut_count · face_screen_ratio · speech_rate` 중 **2개 이상** 필요, 데모는 **0개**(`duration_bucket`은 범주형이라 카운트되지 않음)

→ 9-6 예시를 눌러 본 사용자는 "예측 모델 비교" 카드 두 장이 **영구히 "데이터 기준 미달"** 인 상태만 본다.
→ 9-1(`content_attr`, 260행 × 5피처)은 `prepareRandomForestInput` `ok:true`로 **정상 동작**한다.

### 엔진 코드 리뷰 (`lib/analysis/webr/randomForest.js`, `svm.js`)

견고한 부분:

- `set.seed(20260811)` 고정 → 결정론 유지(§8.3)
- 같은 fold로 baseline(`glm`/`lm`) 동시 적합 → 비교가 공정
- 분류 = Brier + 정확도 / 회귀 = RMSE + OOS R²(SST 기준, 올바름)
- 비유한 CV 예측이면 `stop("non_finite_cv_prediction")`
- 결과 정규화에서 `relativeGain` ±0.05 밴드로 "차이 없음" 구간을 명시

보완이 필요한 부분:

1. **상한 n 가드가 없다.** 하한만 있고 최대치가 없다. SVM은 fold당 `tune.svm` 3×3 그리드 × 3-fold(≈45적합) × 최대 5 fold이라, wasm에서 큰 CSV가 들어오면 탭이 사실상 정지한다.
2. **baseline `glm`의 완전분리·미수렴이 보고되지 않는다**(`suppressWarnings`). 그 경우 baseline Brier가 나빠져 RF/SVM이 이긴 것처럼 보인다 — §7의 "`regularized` 플래그를 만들어 놓고 소비처를 안 배선한다"와 같은 계열의 함정.

---

## P1-4. 5-28 데모: PR이 내세운 "세그먼트 비교"가 데모에서 작동하지 않는다

**위치**: `v2-migration/src/utils/demoData.js` `buildActionSurvival`

```js
const actionType = index % 3 === 0 ? "첫 구매" : index % 3 === 1 ? "주간 핵심 기능 사용" : "14일 내 재방문";
const churnAtRiskPoint = index % 3 !== 0 && index % 5 !== 0;   // ← actionType과 완전 교락
```

`churnAtRiskPoint`가 `actionType`과 같은 `index % 3`에 묶여 있어 **"첫 구매" 그룹은 구조적으로 이탈이 0건**이다.

### 실측 (데모 → `getMappedRows` → `normalizeSurvivalRows` → `logRankTest`)

| 세그먼트 | 그룹별 n / 이벤트 | log-rank |
|---|---|---|
| `event_type` (액션 유형) | 첫 구매 36/**0** · 주간핵심 36/21 · 재방문 36/21 | `ok:false, group_without_events` → 화면: "일부 그룹의 이탈이 너무 적어 세그먼트 차이를 구분하기 어렵습니다" |
| `channel` | 36/14 · 36/14 · 36/14 | χ²=0.016, **p=0.992** (신호 0) |
| `campaign_name` | 54/15 · 54/27 | χ²=3.51, p=0.061 (경계, 무유의) |

가장 자연스러운 축(액션 유형)은 **계산 거부**, 채널은 **완전 무차이**, 유일하게 방향이 있는 캠페인도 무유의다.
PR 본문의 "세그먼트 비교를 함께 보이는 데이터"는 데모에서 성립하지 않는다.

### 제안

`churnAtRiskPoint`를 `index % 3`에서 분리하고(예: `index % 7`), 채널·액션 유형별 위험에 실제 계수 차이를 심는다. 공유 픽스처가 아니므로 형제 도구 회귀 위험은 없다.

---

## P1-5. `logRankTest`의 0-이벤트 그룹 거부는 방향이 반대다

**위치**: `v2-migration/src/utils/subscriptionSurvivalMath.js:311`

```js
if (usable.some((group) => group.rows.every((row) => row.event !== 1)))
  return { ok: false, reason: "group_without_events" };
```

한 그룹의 이벤트가 0이라는 것은 "차이를 알 수 없다"가 아니라 **가장 강한 차이 신호**다. 전체 이벤트 > 0이고 공분산이 가역이면 score 검정은 정의된다.
지금은 그것을 화면에서 "이탈이 너무 적어 차이를 구분하기 어렵다"로 뒤집어 말한다 — 판단을 보류하는 방향이라 위험도는 낮지만 **문구가 사실과 다르다**(§8.6 "무유의 ≠ 무효과"의 거울상).

### 제안

거부 자체를 유지하더라도 사유 문구를 정정한다: "한 그룹에 관측된 이탈이 없습니다. 검정 대신 생존곡선으로 차이를 확인하세요."

---

## P2-6. 5-28 데모의 생존 구조가 인위적이다

이탈행은 tenure 2~6, 잔존행은 tenure 7~14로 **완전히 분리**되어 있다. 실측 KM:

```
2: n=108 d=6  | 3: n=99 d=8 | 4: n=89 d=8 | 5: n=79 d=10 | 6: n=65 d=10
7~14: d=0 (해저드 정확히 0)      median: 미도달   RMST(14)=9.96   evidence: READY
```

- 7기간 이후 **해저드가 정확히 0** → 위험 차트 후반이 통째로 비고, "중앙 생존기간에 도달하지 않았습니다"가 항상 뜬다.
- 절단이 완전한 비무작위(informative censoring) — KM의 독립절단 가정을 **데모가 스스로 위반**한다.
- 좌측절단 12행이 전부 "절대 이탈하지 않는" 그룹에만 몰려 있어, 좌측절단 기능이 결과에 아무 영향도 주지 않는다.
- **날짜 모드**: 모든 이탈일이 관측종료일과 같은 `2025-12-01`(`Action Exit Date` distinct=2, 빈 문자열 포함), `Action Observation End Date` distinct=1. CSV를 열어본 사람에게는 "전원이 마지막 날 이탈"로 읽힌다.
- 관측종료일을 그보다 앞 날짜로 입력하면 42개 이벤트가 전부 `churn_after_observation_end_date`로 제외되고 생존율이 100% 직선이 된다(제외 사유 콜아웃은 정상 노출되므로 정직성 위반은 아님).

**긍정 확인**: 기간 모드와 날짜 모드가 **완전히 동일한 KM 표**를 만든다(모드 전환 회귀 없음).

---

## P2-7. 9-1 데모에 불가능한 값이 들어 있다

**위치**: `v2-migration/src/utils/demoData.js:698`

```js
const titleLen = round(20 + rnd() * 45); // 20..65자
```

`seededNoise`가 0~1이 아니라 ±0.5 범위를 돌려주므로 실제 분포는 **-2 ~ 42**이고, **24행이 0 이하**다(제목 글자수 음수).
부수적으로 `(titleLen - 40) * -0.012` 센터링도 의도(평균 42.5 기준)와 달리 거의 항상 음수 쪽으로만 들어간다.

---

## P2-8. 데모 필드 공백 — 도구 기능 체험 범위

`TOOL_REQUIRED_FIELDS` + `TOOL_OPTIONAL_FIELDS` 대비 전 데모 커버리지를 전수 대조한 결과 중 실질적인 것:

| 그룹 | 빠진 옵션 필드 | 데모로 못 써보는 기능 |
|---|---|---|
| efficiency (5-2 · start-gate) | `source`, `snapshot_date` | 유료·오가닉 분리, 리텐션 Dn 마감 판정 |
| creative (9-6 · 5-6) | `actions` + 제작특성 5종 | CPA 지표, RF/SVM 패널 전체(P1-3) |
| asa_keyword (5-26) | `country`, `target_cpt` | 42행 · 검색어 3개 · adgroup 1개라 승격 표가 3행 |
| brand_incrementality (5-24) | `cost`, `country`, `channel` | 투자 규모 병기 |
| aso_store (5-27) | `country` | `event`·`event_type`은 일부 행이 빈 값 |

(5-18 계열은 wide 패널 헤더를 쓰므로 이 대조에서 제외했다 — 실사용상 문제 없음.)

---

## P2-9. 이번 PR이 추가한 가드가 구멍을 가린다

새 `DEMO_MINIMUM_ROWS`(`demoData.test.js`)는 **원본 행 수만** 본다. 그래서 다음이 전부 통과한다:

- creative 1,774행은 통과하지만 **실제 분석 단위는 73 소재**(RF 요구치 360) → P1-3
- `title_len` 음수 24행 → P2-7
- 세그먼트 한 그룹의 이벤트 0건 → P1-4

AGENTS §7의 **"가드가 있다는 사실이 가드가 없다는 사실을 가린다"** 가 그대로 재발한 형태다.

### 제안 — 검사를 옮긴다

1. **행 수**가 아니라 **분석 단위 수**(고유 소재/개체/키워드 수)를 본다.
2. **값 범위 불변식**을 건다(길이·비율·기간은 > 0, 비율은 0~1 등).
3. **기능 신호**를 파생 검사한다: 세그먼트 후보마다 그룹별 이벤트 ≥ 1, 각 도구의 자격 판정 함수(`prepareRandomForestInput` 등)가 데모에서 `ok:true`인지.

---

## 문제 없음으로 확인한 것

- **브랜드 증분 데모 통합 (#714의 나머지 절반)**: 공용 `buildBrandIncrementality`가 구 인라인 `brandDemo()`와 값이 **완전히 동일**(49행, `index >= 35`부터 on, 동일 요일 패턴, 동일 공식). `fileName`만 `demo_brand_campaign_its.csv` → `demo_brand_incrementality.csv`로 바뀌는데 `demo_` 접두가 유지되므로 `isDemo` 판정과 `startMyData`의 데모 슬라이스 정리도 그대로다. ITS 실행 결과 `status: "ESTIMATED"` 정상.
- **생존 엔진 수식 자체** (`subscriptionSurvivalMath.js`): Kaplan–Meier(동시점에서 이벤트 우선 적용), Greenwood 분산 + log(-log) 변환 CI, RMST의 우연속 계단 적분, 로그랭크 초기하 공분산(마지막 그룹 제거로 full-rank), 이산 해저드 = d/n — 전부 표준대로 맞다.
- **날짜 처리**: UTC 고정 파싱, 월말 클램프(1/31 → 2/28을 1개월로 계산), 0일 에피소드를 1기간으로 밀어 올리지 않음 — 정확하다.
- **정직성 배선**: `hasSmallRiskSet`(위험집합 < 5)일 때 결정 핸드오프(`decisionPrefill`) 차단, 제외 행 사유 노출, 관측 범위 밖 외삽 금지, `averageCac`가 일부 결측이면 평균 내지 않고 보류 — 전부 §8 규율대로 되어 있다.
- **전체 검증**: 311 파일 · 2456 통과 · 1 skipped (green).

---

## 권고 작업 순서

1. **P0-1** 도치 실패 복구 경로(`onImportFailed` 또는 업로더 보존)
2. **P0-2** 작업대 준비 계산의 지연·게이팅 + 스피너 선(先)페인트
3. **P1-3 / P1-4** 데모가 기능을 실제로 보여주도록 재설계
   - creative 데모에 제작특성 컬럼 2개 이상 + `actions` 추가 (RF는 소재 수 또는 임계 재검토)
   - 5-28 데모의 이탈 규칙을 액션 유형과 분리, 채널별 위험 차이 부여
4. **P1-5** 로그랭크 거부 문구 정정
5. **P2-7** `title_len` 범위 수정
6. **P2-9** 데모 가드를 행 수 → 분석 단위 · 값 범위 · 기능 신호로 이관

---

*이 문서는 감사 결과만 담는다. 코드 수정은 포함되어 있지 않다.*
