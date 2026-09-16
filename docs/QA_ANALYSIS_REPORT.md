# Growth Opt Playbook — 분석 정확성 QA

**상태: Phase 0(구조 파악) 완료. P0 수학 검증은 미착수.**

이 문서는 진행 중인 QA의 기록이다. **실행하지 않은 검증을 완료로 쓰지 않는다**(AGENTS.md §16).
"코드가 이상해 보인다" 수준의 추측은 findings에 넣지 않으며, Input → Expected → Actual을
재현한 것만 bug로 올린다.

측정일: 2026-09-16 · 기준 커밋: `4d9b1ea` (main)

---

## Executive Summary

| | 건수 |
|---|---|
| P0 Critical | **0건 확정** (검증 미완 — 아래 "아직 답할 수 없는 것" 참조) |
| P1 High | 0건 확정 |
| P2 Medium | 2건 |
| P3 Low | 0건 |

지금까지 **확정된 결함은 없다.** 다만 이것은 "문제가 없다"는 뜻이 아니라
**P0 영역(수학적 정확성)을 아직 재현 검증하지 않았다**는 뜻이다.

---

## Phase 0 — 측정한 것

### 0.1 분석 엔진 ↔ 테스트 커버리지

엔진은 `src/utils/*Math*.js` 33개. 커버리지는 **파일명 규칙이 아니라 실제 import로** 셌다
(`<name>.test.js`가 있는지로 세면 `mmmMath`가 "테스트 없음"으로 나온다 — 실제로는 10개 파일이
import 한다).

| 엔진 | 줄수 | 이 엔진을 import 하는 테스트 파일 |
|---|---:|---:|
| `mmmMath` | 10,160 | 10 |
| `mmmMathPr416` | 5,489 | 2 |
| `attributedForecastLiveMath` | 1,332 | 1 |
| `creativeMath` | 1,113 | 6 |
| `mmmPriorMath` | 1,037 | 1 |
| `cohortMath` | 981 | 1 |
| `abTestMath` | 609 | 4 |
| `pvmMath` | 468 | 2 |
| `subscriptionSurvivalMath` | 447 | 3 |
| `allocationMath` | 438 | 3 |
| `brandIncrementalityMath` | 436 | 1 |
| `groupComparisonMath` | 433 | 1 |
| `segmentCompositionMath` | 422 | 2 |
| `segmentCausalMath` | 325 | 1 |
| `regMath` | 320 | 3 |
| **`regLabMath`** | **314** | **0** |
| `regForecastMath` | 313 | 2 |
| `ahaMath` | 304 | 2 |
| **`funnelMath`** | **282** | **0** |
| `segmentOpsMath` | 266 | 1 |
| `incrPrePostMath` | 260 | 1 |
| `responseMath` | 220 | 1 |
| `satMath` | 212 | 5 |
| **`ltvMath`** | **181** | **0** |
| `factorialAnovaMath` | 169 | 1 |
| `seasonalityMath` | 150 | 1 |
| `asoStoreMath` | 134 | 4 |
| `incrMath` | 126 | 3 |
| `asaKeywordMath` | 106 | 4 |
| `pacingMath` | 78 | 1 |
| `anomalyMath` | 75 | 1 |
| `segmentMath` | 72 | 1 |
| `efficiencyImpactMath` | 58 | 1 |

**[P2-001] 테스트가 한 건도 닿지 않는 엔진 3개** — `regLabMath`(314줄) · `funnelMath`(282줄) ·
`ltvMath`(181줄), 합계 777줄.

- 근거: 전 테스트 파일에서 `from "…<모듈>"` / `import("…<모듈>")` 패턴을 찾아 0건
- 영향: 이 엔진들의 수학이 바뀌어도 아무 테스트도 반대하지 않는다. 회귀가 조용히 배포된다
- 주의: **"테스트가 없다 = 틀렸다"가 아니다.** 아직 이 엔진들의 출력이 틀렸다는 증거는 없다
- 다음: 각각에 대해 손으로 답을 계산할 수 있는 fixture로 골든 작성

### 0.2 동일 KPI의 중복 계산 지점

정규식으로 센 계산식 사용처(주석·테스트 제외):

| 지표 | 계산식 패턴 | 지점 수 |
|---|---|---:|
| CPI | `cost / installs` | 8 |
| CPA | `cost / actions` | 7 |
| ROAS | `revenue / cost\|spend` | 7 |
| CTR | `clicks / impressions` | 9 |

공용 SSOT는 `utils/dashboardAggregator.js`의 `calculateKPIs(filteredRows, cohort, denomBasis)`와
`aggregateByKey`가 있다.

**[P2-002] 같은 case-switch가 두 파일에 복제돼 있다** — `dashboard/ScorecardTab.jsx:242-244`와
`dashboard/AnomalyTab.jsx:103-104`가 CPI/CPA 분기를 각자 갖고 있다. 현재 **두 곳의 공식과
가드가 동일**해 결과 불일치는 없지만, 한쪽만 고치면 갈린다.

### 0.3 0 분모 처리 — 검증된 음성 결과

CPI/CPA를 계산하는 실제 지점 **전부**가 다음 형태다:

```js
installs > 0 ? cost / installs : null
actions  > 0 ? cost / actions  : null
```

- 확인 지점: `BudgetAllocation.jsx:843-844` · `AnomalyTab.jsx:103-104` ·
  `ScorecardTab.jsx:242,244` · `asaKeywordMath.js:92` · `sampleSpendPreview.js:12-13` ·
  `segmentMath.js:20,22`
- **Infinity·NaN이 화면으로 새는 경로를 이 지점들에서는 찾지 못했다**
- 미상을 0이나 Infinity가 아니라 `null`로 두는 것은 AGENTS.md §7의
  "미상은 미상 버킷(null)으로"와 일치한다
- 한계: ROAS·CTR·CVR과 각 엔진 내부의 나눗셈은 아직 같은 방식으로 훑지 않았다

---

## 아직 답할 수 없는 것

스펙 §32의 10개 질문 중 지금 근거를 갖고 답할 수 있는 것은 일부뿐이다.

| # | 질문 | 현재 답 |
|---|---|---|
| 1 | 분석 결과 숫자를 신뢰할 수 있는가? | **모름.** 골든 fixture로 검증하지 않았다 |
| 2 | 가장 위험한 도구 5개 | **모름.** 위험도 평가 기준을 아직 적용하지 않았다 |
| 3 | 동일 KPI가 여러 곳에서 다르게 계산되는가? | **지점은 다수(0.2), 값이 다른지는 미검증** |
| 4 | 가장 위험한 aggregation bug | 미검증 (가중평균 invariant 미실행) |
| 5 | column mapping silent error | 미검증 |
| 6 | 결과와 recommendation 모순 | 미검증 |
| 7 | 통계 구현 오류 | 미검증 |
| 8 | Weekly Review/Report 불일치 | 미검증 |
| 9 | 저장 데이터 migration | 부분 — 스키마 v11까지 골든 있음(`decisionEpisodes.test.js`) |
| 10 | 배포 전 필수 P0/P1 | **현재 확정 0건** |

---

## 다음 단계 (제안 순서)

스펙 §31의 순서를 따른다. 각 단계는 fixture → 현재 코드 실행 → expected vs actual 비교다.

1. **가중평균 invariant** (§3) — `sum(cost)/sum(conv)` vs `avg(캠페인별 CPA)`.
   비대칭 fixture로. 스펙이 지적한 대로 대칭 fixture는 우연히 통과한다
2. **골든 fixture** (§2) — Spend 100 / Imp 1000 / Click 100 / Install 20 / Conv 10 / Rev 300
   → CPM 100 · CTR 10% · CPC 1 · CPI 5 · CPA 10 · ROAS 300%
3. **Metamorphic** (§25) — 10배 스케일 / 2배 복제 / row shuffle
4. **테스트 없는 엔진 3개** 골든 (`regLabMath`·`funnelMath`·`ltvMath`)
5. **기간 비교 0 기저** (§4) — `0 → 100` 에서 Infinity·무의미한 % 표시 여부
6. **Simpson's paradox** (§5) — mix shift를 within-segment 악화로 잘못 설명하는지
7. **Cross-tool 일관성** (§18) — 같은 CSV를 5-2·5-21·5-3·weekly-review에 넣고 KPI 대조

---

## 작업 원칙 (이 QA에서 지킨 것)

- 프록시로 결론 내지 않는다. 0.1의 커버리지 표는 파일명으로 한 번 세고 **틀렸음을 확인한 뒤**
  실제 import로 다시 셌다
- 스캐너에는 규모 단언을 둔다. 0건이 조용히 통과하지 않게
- 검증한 음성 결과(0.3)도 findings와 같은 급으로 기록한다. "확인했다"와 "안 봤다"는 다르다
