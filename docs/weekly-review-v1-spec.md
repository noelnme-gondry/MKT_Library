# Weekly Review V1 — UI/로직 명세

> **상태**: 설계 확정본 (구현 전). 이 문서 하나로 개발 범위가 떨어지는 것을 목표로 한다.
> **전제**: `main` @ #809 기준. 수학 엔진은 **한 줄도 바꾸지 않는다** — 전부 기존 순수 엔진 호출 + 신규 판정/조립 레이어.

---

## 0. 한 문장 스펙

> 지난 2주의 캠페인 CSV를 올리면, Growth Opt이 KPI 변화를 찾고 → 원인을 캠페인 수준까지 좁히고 →
> 지난 결정의 결과를 평가한 뒤 → 이번 주 행동 하나와 공유 가능한 주간 보고서를 만든다.

### 0.1 설계 원칙 (기능 판단 기준)

| # | 원칙 | 판정 방법 |
|---|---|---|
| P1 | **결론 → 근거** 순서. Dashboard가 아니다 | 첫 화면에 차트가 있으면 실패 |
| P2 | **보는 것을 줄인다**. 분석을 늘려도 결론은 한 줄 | 기능 추가로 사용자가 볼 카드가 늘면 재검토 |
| P3 | **필요한 분석만 돌린다** | 신호 없는 분석은 실행도 렌더도 하지 않음 (§5 라우터) |
| P4 | **추천 ≠ 결정**. 시스템은 제안하고 사람이 정한다 | 저장되는 것은 항상 사용자가 고른 값 |
| P5 | **무유의를 경보로 만들지 않는다** | 변동 범위 안이면 "유지됐다"고 말한다 (§4) |

---

## 1. 라우트 재배치

| 현재 | 앞으로 | 처리 |
|---|---|---|
| `/weekly-review` (결정 검토함) | **`/decisions`** (Decision History) | 컴포넌트 이동, 라우트 id 유지 |
| — | **`/weekly-review`** (신규 핵심 제품) | 신규 라우트 id `weekly-review-v2` |
| `/weekly-report` | Review 결과 공유 화면 | 수동 카드 수집 경로는 유지(다른 도구용), Review 경유 시 자동 채움 |
| `/dashboard` 등 20개 도구 | 상세 분석 도구 (그대로) | 변경 없음 |

**주의**: `/weekly-review` URL의 의미가 바뀌므로 기존 북마크는 결정 검토함이 아니라 새 제품으로 간다.
이건 의도된 것(새 제품이 그 이름을 갖는 게 맞다). 다만 결정 검토함으로 가려던 사용자를 위해
새 화면 §3(Last Decision) 카드 하단에 `/decisions` 링크를 상시 노출한다.

---

## 2. 데이터 계약

### 2.1 최소 필드

| 필드 | 필수 | 없으면 |
|---|---|---|
| `date` | ✅ | 진행 불가 |
| `campaign` | ✅ | 진행 불가 (원인을 캠페인까지 좁히는 게 제품의 핵심) |
| `cost` | ✅ | 진행 불가 |
| `installs` 또는 `actions` | ✅ (oneOf) | 진행 불가 |
| `channel` | — | 채널 레이어 분해 생략, 캠페인 레이어만 |
| `impressions` | — | CPM·CTR 비활성 |
| `clicks` | — | CTR·CVR 비활성 |
| `revenue` | — | ROAS 비활성 |

기존 `TOOL_REQUIRED_FIELDS["5-2"]`(`utils/csvConstants.js:1212`)에 `campaign`을 더한 집합.
**미매핑 지표는 표에서 빼고, 없는 값을 만들지 않는다.**

### 2.2 기간 판정 — "오늘"이 아니라 **데이터 최대 날짜** 기준

원안(§5)은 오늘 날짜를 기준으로 잡았는데, 광고 플랫폼 export는 보통 어제까지이고 사용자가 과거
데이터를 올리는 경우도 있어 **오늘 기준으로 자르면 빈 주를 비교하게 된다.** 데이터가 기준이어야 한다.

```
maxDate  = 데이터의 최대 date
lastFull = maxDate가 속한 ISO주(월~일)가 7일 다 있으면 그 주, 아니면 직전 주
current  = lastFull
previous = lastFull - 7d
```

- 주 경계는 **ISO 주(월요일 시작)**. 날짜 문자열은 UTC로 파싱되므로 요일 판정은 `getUTCDay()`
  (`getDay()`는 UTC 이서 타임존에서 하루 밀린다 — 기존 함정).
- 두 기간의 **일수가 다르면 비교하지 않는다.** 부분 주 vs 전체 주 비교는 무조건 거짓 신호다.
- 화면에 **항상 비교 기간을 명시**한다. 자동 비교가 틀리면 Review 전체의 신뢰가 무너진다.

**부분 주 처리** — 진행 중인 주를 보고 싶다는 요구는 실재하므로 막지 말고 요일을 맞춘다:

> 이번 주는 아직 2일(월–화)만 집계되었습니다.
> 전주 같은 요일(월–화)과 비교할까요?  [ 같은 요일로 비교 ] [ 지난 완료 주로 보기 ]

같은 요일 비교를 고르면 **모든 카드 상단에 "월–화 부분 비교" 배지**를 고정한다.

### 2.3 스냅샷 (원본 CSV 저장 안 함)

Review 1회가 끝나면 **집계 스냅샷만** 저장한다. 원본 행은 저장하지 않는다.

```
snapshot = {
  weekStart, weekEnd, days,
  rows: [{ channel, campaign, cost, impressions, clicks, installs, actions, revenue }],  // 주 × 캠페인 집계
  kpi: { metric, value, direction },
  createdAt
}
```

50,000행 원본이 캠페인 수십 개짜리 한 줄 집계로 줄어든다. 저장은 기존 IndexedDB
워크스페이스(`lib/workspace-storage/`)를 재사용한다.

**따라서 업로드 경로가 둘이다:**
- **2주치 업로드** (기본, 무상태): 스냅샷 없이도 첫 방문자가 바로 Review를 완주한다.
- **1주치 업로드** (스냅샷 보유 시): 직전 스냅샷을 previous로 쓴다.

V1은 **두 경로를 모두 지원**한다. 전자가 없으면 첫 사용자가 아무것도 못 하고, 후자가 없으면
매주 2주치를 다시 올려야 한다.

---

## 3. 프로젝트 & KPI

```
project = {
  id, name,                       // "Korea Android"
  kpi: { metric: "cpa", basis: "actions", direction: "lower" },
  target: { value: 8.0, currency: "USD" } | null,
  secondary: ["ctr", "cvr", "spend"],
  mapping,                        // 컬럼 매핑 (기존 transform recipe 재사용)
  snapshots: [...], decisions: [...]
}
```

- KPI는 **첫 Review에서 한 번만** 묻는다. 이후 모든 문장이 이 기준으로 쓰인다.
- `target`이 있으면 guardrail 판정이 가능해진다(§7). 없으면 방향 판정만 한다.
- 매핑은 기존 `localHistory.getTransformRecipe/saveTransformRecipe`
  (`lib/data-import/localHistory.js:22,32`)를 그대로 쓴다 — 헤더 서명 기반이라 이미 동작한다.

---

## 4. 카드 1 — SNAPSHOT (무엇이 바뀌었나)

### 4.1 유의미한 변화 판정 — 이 제품의 품질이 갈리는 곳

**단순 WoW %로 경보를 울리면 안 된다.** 세 가지를 함께 본다.

```
significant(metric) =
     |Δ%| >= MIN_PCT                    // 크기
  && |z|  >= MIN_Z                      // 평소 변동성 대비
  && volume >= MIN_VOLUME               // 표본
```

| 상수 | 값 | 근거 |
|---|---|---|
| `MIN_PCT` | 5% | 이하는 운영 노이즈 |
| `MIN_Z` | 1.5 | 최근 8주 주간값의 표준편차 대비 |
| `MIN_VOLUME` | 전환 30건 | 이하는 CPA가 튄다 |
| `LOOKBACK_WEEKS` | 8 | z 계산용, 스냅샷이 3주 미만이면 z 판정 생략(크기+볼륨만) |

z는 기존 `ANOMALY_MATH.detect`(`utils/anomalyMath.js:40`)와 같은 방식으로 계산한다.
**스냅샷이 부족해 변동성을 모를 때 "정상"이라고 단정하지 않는다** — "비교 이력이 2주뿐이라
평소 범위를 아직 모릅니다"라고 말한다.

### 4.2 카피

**유의미할 때**
```
CPA +8.4% 악화
$7.42 → $8.04
전환 +3.1% · 비용 +11.8%
```

**유의미하지 않을 때** (P5)
```
성과는 사실상 유지됐습니다.
CPA +0.8% 변화는 최근 8주 변동 범위 안입니다.
```
→ 이 경우 **§5(Why)와 §7(Next Move)을 자동 접는다.** 원인을 찾을 변화가 없기 때문이다.
   대신 "이번 주는 확인할 것이 없습니다"를 결론으로 낸다. 이게 P2의 가장 강한 형태다.

**목표 대비** (target 있을 때만)
```
CPA $8.04 — 목표 $8.00 초과
```

### 4.3 보조 지표 표

매핑된 것만. 미매핑 행은 만들지 않는다.

| | 지난주 | 이번주 | 변화 |
|---|---|---|---|
| Spend | $83K | $93K | +11.8% |
| Conversions | 11.2K | 11.5K | +3.1% |
| CPA | $7.42 | $8.04 | +8.4% |
| CTR | 1.72% | 1.63% | −5.2% |
| CVR | 13.4% | 12.8% | −4.5% |

숫자는 전부 `utils/format.js` 경유. 통화는 전역 `store.displayCurrency`.

---

## 5. 카드 2 — WHY (원인)

### 5.1 엔진

`PVM_MATH.decomposeFinest(rowsP1, rowsP2, keys)` → `rollup(finest, keyFn, R1, R2)`
(`utils/pvmMath.js:226,395`). 이미 잔차 없는 Bennet 분해이고 mix/rate 항등식이 보장된다.

- `keys` = `[channel, campaign]` (channel 없으면 `[campaign]`)
- 반환 각 원소: `{ mix, rate, contribution, s1, s2, cpa1, cpa2 }`
- **분해는 최소 grain에서 한 번만** 하고 상위는 `rollup`으로 합산한다(단계별 재분해 금지 — 부분합이 안 맞는다).

### 5.2 화면

```
왜 CPA가 올랐나요?              +8.4%

  효율 저하   +6.3%p  (75%)   각 캠페인 자체 성과
  믹스 변화   +2.1%p  (25%)   어디에 돈을 더 썼는가

→ 예산 믹스보다 캠페인 자체 효율 저하가 더 큰 원인이었습니다.
```

**두 항이 비슷할 때**(각각 총변화의 20% 이상, 기존 `classifyNarrative` 기준과 동일)는
한쪽으로 단정하지 않고 "두 요인이 함께 작용했습니다"로 쓴다.

### 5.3 기여 상위

`|contribution|` 내림차순 상위 3개. **전체가 아니라 3개** (P2).

| 캠페인 | CPA 변화 | 전체 변화 기여 |
|---|---|---|
| Google UAC A | +22% | 48% |
| Meta AAP | +2% | 11% |
| ASA Brand | −7% | −8% |

`[ 더 자세히 보기 ]` → 기존 5-21(성과 변동) 도구로 같은 데이터를 들고 이동.

### 5.4 "비중"은 결과 비중이다

shift-share의 `s`는 비용 비중이 아니라 **결과(전환) 비중**이다. 비용 열 옆에 "비중"이라고
쓰면 비용 비중으로 오독된다 — 라벨을 **"결과 비중"**으로 명시한다. (기존에 실제로 났던 신뢰 사고)

### 5.5 분석 라우터 (P3)

**모든 분석을 돌리지 않는다.** 신호가 있을 때만 해당 분석을 실행하고 카드를 렌더한다.

| 신호 | 조건 | 실행 | V1 |
|---|---|---|---|
| KPI 변화 | `significant(kpi)` | PVM 분해 | ✅ |
| 비용 급변 | `|Δspend| ≥ 15%` | 믹스 강조 | ✅ |
| CTR 하락 + creative 컬럼 | `Δctr ≤ −10%` && creative 매핑됨 | 소재 피로도 | 나중 |
| 세그먼트 급변 | share 변화 ≥ 10%p | 구성 변화 | 나중 |
| 목표 존재 | target 있음 | 페이싱 | 나중 |
| **신호 없음** | — | **아무것도 안 함** | ✅ |

라우터는 `lib/weekly-review/router.js` 순수 함수로 두고 골든으로 고정한다.
**"신호 없음 → 빈 결과"가 정상 경로**이므로 그것도 골든에 넣는다.

---

## 6. 카드 3 — LAST DECISION (지난 결정은 먹혔나)

이 제품의 진짜 차별점. 일반 주간 보고는 `지난주 숫자 vs 이번주 숫자`에서 끝나지만
여기서는 **`지난 결정 vs 실제 결과`**를 본다.

### 6.1 Decision 스키마 확장 (v8 → v9)

현재 `DECISION_REVIEW_SAFE_FIELDS`(`lib/decisionReview.js:9`)에는 `action`이 자유 문자열이고
**guardrail이 없다.** 그래서 자동 판정이 불가능하다. 다음을 추가한다.

| 신규 필드 | 예 | 용도 |
|---|---|---|
| `actionKind` | `increase_budget` \| `decrease_budget` \| `hold` \| `replace` \| `investigate` | 판정 분기 |
| `actionTarget` | `Google UAC A` | 결과 조회 대상 |
| `actionAmount` | `+15%` | 실행 여부 확인 |
| `goalMetric` | `actions` | 성공의 정의 |
| `goalDirection` | `up` | 〃 |
| `guardrailMetric` | `cpa` | 실패의 정의 |
| `guardrailOp` | `lte` | 〃 |
| `guardrailValue` | `8.0` | 〃 |

**마이그레이션**: v8 레코드는 신규 필드가 전부 `null`이다. 이때는 자동 판정을 하지 않고
`판정 불가 — 이 결정에는 목표·가드레일이 기록되지 않았습니다`로 표시한다.
**옛 레코드를 추측으로 채우지 않는다.**

### 6.2 판정 로직

```
if (goal 없음 || guardrail 없음)        → UNSCORED  "판정 불가"
if (대상 데이터 없음)                    → NO_DATA   "대상 캠페인이 이번 주 데이터에 없습니다"
if (실행 안 됨: |actual Δ| < 1/3 예정)   → NOT_APPLIED "결정이 실행되지 않은 것으로 보입니다"

goalMet      = goalDirection 방향으로 significant하게 움직였는가
guardrailMet = guardrail 조건을 만족하는가

goalMet && guardrailMet   → WORKED        ✓ 효과 있었음
goalMet && !guardrailMet  → MIXED         △ 목표는 달성, 가드레일 이탈
!goalMet && guardrailMet  → NO_EFFECT     – 뚜렷한 변화 없음
!goalMet && !guardrailMet → BACKFIRED     ✗ 역효과
```

**`NO_EFFECT`를 "효과 없음"이라고 단정하지 않는다.** 화면 문구는
`뚜렷한 변화를 확인하지 못했습니다 (효과가 없다는 뜻은 아닙니다)`. 1주 표본으로 효과를 부정할
검정력이 없다. 입증책임 비대칭.

### 6.3 화면

```
지난주 결정                                     Sep 1
Meta AAP 예산 +15%
목표: 전환 증가 · 가드레일: CPA ≤ $8.00

  전환   +16.8%   ✓ 목표 달성
  CPA    $7.82    ✓ 가드레일 안
  비용   +14.1%   (예정 +15%)

✓ 효과 있었음 — 볼륨이 늘었고 CPA는 목표 안에 유지됐습니다.
```

기존 `buildComparableDecisionActual`(`lib/decisionComparableActual.js:58`)이 이미 결정 시점 이후
구간의 실제값을 뽑는다. 재사용하고 판정만 위 규칙으로 교체한다.

첫 사용자(결정 없음)는 이 카드를 **렌더하지 않는다.** 빈 상태를 만들지 않는다.

---

## 7. 카드 4 — NEXT MOVE (이번 주 행동)

### 7.1 추천은 하나 (P2)

`|contribution|` 1위 캠페인 하나만. 목록 14개를 주지 않는다.

```
Growth Opt 추천
Google UAC A 효율 저하 확인

  CPA +22% · 전체 CPA 악화의 48% 기여 · CTR −13%
```

### 7.2 결정은 사용자가 (P4)

추천과 결정을 **시각적으로 분리**한다. 추천 블록은 배경 없는 안내, 결정 블록은 입력 폼.

```
내 결정
[ 유지 ] [ 증액 ] [ 감액 ] [ 교체 ] [ 추가 확인 ]

대상    Google UAC A            (기본값 = 추천 대상, 변경 가능)
크기    -10%                    (actionKind가 증·감액일 때만)
목표    전환 유지               [ 전환 ▾ ]
가드레일 CPA ≤ $8.00            [ CPA ▾ ] [ ≤ ] [ 8.00 ]
검토일   다음 주 월요일          (자동)

[ 이 결정 저장 ]
```

- 목표·가드레일 기본값은 프로젝트 KPI에서 파생한다(빈 폼을 주지 않는다).
- **저장 전에 가드레일을 비울 수 있게 두되**, 비우면 "다음 주에 자동 판정할 수 없습니다"를 고지한다.
  강제하지 않는다 — 강제하면 사용자가 아무 값이나 넣고 판정이 거짓이 된다.

---

## 8. 카드 5 — REPORT (자동 생성)

Review를 끝내면 보고서 내용은 **이미 결정되어 있다.** 카드를 고르게 하지 않는다.

```
Weekly Performance Review — Korea Android
Aug 31 – Sep 6 (vs Aug 24 – Aug 30)

■ 성과
  CPA +8.4% ($7.42 → $8.04) · 비용 +11.8% · 전환 +3.1%

■ 무엇이 바뀌었나
  Google UAC A의 효율이 나빠졌습니다.

■ 왜
  효율 저하가 CPA 상승의 75%, 예산 믹스 변화가 25%를 설명합니다.

■ 지난 결정의 결과
  Meta AAP 예산 +15% (Sep 1) → 전환 +16.8% / CPA −2.3% · 효과 있었음

■ 이번 주 결정
  Google UAC A 예산 −10%

■ 다음 주 확인
  CPA ≤ $8.00
```

`[ 복사 ]` `[ Slack용 복사 ]` `[ PDF ]`

기존 `lib/reports/renderMarkdown.js`·`reportSchema.js`를 재사용하고, 수동 카드 수집 대신
Review 결과를 draft로 주입한다. 기존 `/weekly-report`의 수동 경로는 **다른 도구용으로 유지**한다.

---

## 9. 첫 사용자 경로

지난 결정이 없으므로 카드 3을 건너뛴다.

```
업로드 → 무엇이 바뀌었나 → 왜 → 이번 주 행동 → 보고서 → 결정 저장
                                                            ↓
                              "다음 주에 이 결정의 결과를 확인할 수 있습니다."
```

마지막 문장이 **retention trigger**다. "저장되었습니다"보다 훨씬 강하다.
저장 시 검토일(다음 월요일) `.ics` 다운로드를 제안한다 — 기존 `serializeDecisionReviewIcs`
(`lib/decisionReview.js:156`)가 이미 있다.

---

## 10. 재사용 엔진 대응표

| 필요 | 기존 자산 | 신규 |
|---|---|---|
| mix/efficiency 분해 | `utils/pvmMath.js:226,395` | — |
| 변동성 z 판정 | `utils/anomalyMath.js:40` | 주간 집계 어댑터 |
| 결정 실제값 조회 | `lib/decisionComparableActual.js:58` | — |
| 결정 저장/스키마 | `lib/decisionReview.js` | v9 필드 7개 |
| 매핑 기억 | `lib/data-import/localHistory.js:22,32` | — |
| 스냅샷 저장 | `lib/workspace-storage/` | 주간 집계 스키마 |
| 보고서 렌더 | `lib/reports/renderMarkdown.js` | Review draft 주입 |
| 결정 검토함 | `components/WeeklyReview.jsx` | `/decisions`로 이동 |

**신규 순수 모듈** (전부 골든 필요):
```
lib/weekly-review/period.js      기간 판정 (ISO주·부분주·UTC 요일)
lib/weekly-review/significance.js 유의미한 변화 판정 (§4.1)
lib/weekly-review/router.js       분석 라우터 (§5.5)
lib/weekly-review/decisionScore.js 결정 판정 (§6.2)
lib/weekly-review/snapshot.js     주×캠페인 집계
lib/weekly-review/reportDraft.js  보고서 조립
```

---

## 11. V1 범위

**포함**: 기간 비교 · KPI 스코어카드 · 캠페인 기여 · mix vs efficiency · 지난 결정 판정 ·
이번 주 결정 · 보고서 · 프로젝트/KPI 저장 · 스냅샷

**제외**(신호 라우터에 자리만 남김): 소재 피로도 · 예산 배분 · MMM · 예측 · Aha · 증분 ·
구성 변화 · 다중 프로젝트 · 계정/동기화/결제

---

## 12. 검증

| 항목 | 방법 |
|---|---|
| 신규 순수 모듈 6개 | 합성 데이터 골든. **"신호 없음"·"판정 불가"·"부분 주" 경로를 반드시 포함** |
| 기간 판정 | UTC 이서/이동 타임존, 연말 ISO주 경계, 부분 주, 데이터 1주뿐 |
| PVM 항등식 | `Σcontribution == ΔCPA` (기존 골든 유지, 재분해 금지 확인) |
| 결정 판정 | v8 레코드 → `UNSCORED` 로 떨어지는지 (마이그레이션) |
| 렌더 | 스모크 — 각 카드의 **문구**를 단언(렌더 성공만 보면 빈 카드를 통과시킨다) |
| 라우트 이동 | `/decisions` 실재 + 기존 링크 갱신 |
| KR/EN | 전 카피 동시 |

---

## 13. 미결 (구현 착수 전 확정 필요)

1. **`MIN_PCT` 5% / `MIN_Z` 1.5 / `MIN_VOLUME` 30** — 실제 캠페인 데이터로 튜닝 필요.
   config로 분리하되 초기값은 위로 간다.
2. **기존 `/weekly-review` 북마크** — 새 제품으로 보내는 것으로 정했으나, 결정 검토함을
   쓰던 사용자가 있다면 안내 배너가 필요할 수 있다.
3. **프로젝트 1개 vs 다중** — V1은 1개. 다중은 이름 충돌·전환 UI가 붙어 범위가 커진다.
