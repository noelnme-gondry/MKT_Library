# C1+C2 이상치 원인 귀속 설계

> 상태: 설계 확정안 · 구현 전  
> 범위: 운영 대시보드 이상탐지(C1) + 원인 보기·도구 연결(C2)

## 1. 목표

이상치 점에 마우스를 올리거나 행을 펼쳤을 때 “무엇이 얼마나 변동을 만들었는지”를 즉시 보여준다. 계산은 PVM 무잔차 분해를 재사용하며, hover마다 다시 계산하지 않는다.

이 기능은 인과 추론이 아니다. 카피는 항상 “변동 기여”, “함께 변한 항목”으로 표현한다.

## 2. 적용 범위

| 조건 | 처리 |
|---|---|
| CPA/CPI 계열 + 날짜·비용·결과·채널 존재 | 원인 귀속 가능 |
| 캠페인·소재 존재 | 더 세밀한 드릴다운 제공 |
| 비용·클릭·노출 단일 합계 지표 | 귀속 미지원 사유 표시 |
| ROAS | 1차 범위 제외. CPA 공간 변환의 의미 검토 후 별도 |
| 표본 부족·기준 기간 부족 | 계산하지 않고 필요한 최소 기간 안내 |

임의의 상관계수나 추정값으로 빈 결과를 채우지 않는다.

## 3. 분석 정의

이상 발생일 `D`에 대해:

- 비교 기간 A: `D-13`부터 `D-7`까지 7일
- 비교 기간 B: `D-6`부터 `D`까지 7일
- 최소 데이터: 각 기간 4개 이상의 유효 날짜
- 최소 grain: `channel × campaign × creative × day`
- 분해: 기존 `PVM_MATH.decomposeFinest`
- 표시: 채널 → 캠페인 → 소재 rollup

기여도 합은 전체 CPA 변화와 허용 오차 `1e-9` 안에서 일치해야 한다. 데이터가 14일보다 짧으면 창을 임의 축소하지 않는다.

## 4. 캐시 계약

```ts
type AnomalyAttributionV1 = {
  schemaVersion: 1;
  anomalyDate: string;
  metric: "cpa" | "cpi";
  periodA: { start: string; end: string };
  periodB: { start: string; end: string };
  totalDelta: number;
  drivers: Array<{
    key: string;
    level: "channel" | "campaign" | "creative";
    label: string;
    contribution: number;
    shareOfAbsChange: number;
    direction: "up" | "down";
  }>;
  remainder: number;
  identityError: number;
};

type AttributionCacheV1 = {
  inputSignature: string; // 데이터+매핑+필터+지표+창
  byDate: Record<string, AnomalyAttributionV1 | AttributionUnavailable>;
};
```

캐시는 이상치 목록이 확정될 때 한 번 생성한다. 툴팁과 행 펼침은 `byDate[date]` lookup만 수행한다.

## 5. 사용자 흐름

1. 이상탐지 분석을 실행한다.
2. eligible이면 이상 날짜 전체의 귀속 캐시를 만든다.
3. 차트 점 hover: 상위 기여 3개와 나머지 표시.
4. 이상치 표의 `원인 보기`: 같은 캐시로 상세 rollup 표시.
5. `성과 변동 분석에서 자세히 보기`: 5-21로 이동하면서 비교 기간과 선택 범위를 세션 handoff로 전달.
6. 5-21은 handoff를 미리 채우되 자동 분석하지 않는다.

URL에는 채널명, 파일명, 원자료 값을 넣지 않는다.

## 6. UI 카피

- 제목: `이 변동에 크게 기여한 항목`
- 양수 CPA 기여: `CPA 상승 기여`
- 음수 CPA 기여: `CPA 하락 기여`
- 주의문: `통계적 기여 분해이며 원인·인과를 확정하지 않습니다.`
- 미지원: `현재 지표는 비용÷결과 구조가 아니어서 무잔차 분해를 적용할 수 없습니다.`

영문도 같은 강도의 비인과 표현을 유지한다.

## 7. 기존 코드 연결

- `src/components/dashboard/AnomalyTab.jsx`: anomaly 계산, 차트 tooltip, 이상치 표.
- `src/utils/pvmMath.js`: 최소 grain 분해와 rollup SSOT.
- `src/components/tools/CampaignPvm.jsx`: PVM 사용·표시 선행 구현.
- `src/lib/analysis-results/pvmQuickSummary.js`: 최근 두 기간 요약 패턴.
- `src/store/useDataStore.js`: 같은 grain 필터와 세션 handoff 상태.

## 8. 파일 변경안

| 파일 | 변경 |
|---|---|
| `src/utils/anomalyAttribution.js` | eligibility, 기간 생성, 캐시 빌드 순수함수 |
| `src/components/dashboard/AnomalyTab.jsx` | tooltip lookup, 원인 펼침, 상세 이동 |
| `src/components/dashboard/AnomalyDrivers.jsx` | 공통 상세 표시 |
| `src/store/useDataStore.js` | 비영속 `analysisHandoff` |
| `src/components/tools/CampaignPvm.jsx` | handoff 수신·확인 UI |
| `src/utils/__tests__/anomalyAttribution.test.js` | 항등식·캐시·경계 테스트 |

## 9. 구현 단계

1. eligibility·기간·PVM 캐시 엔진과 합성 데이터 테스트
2. C1 차트 툴팁에 상위 3개 lookup
3. C2 표 행 상세와 5-21 handoff
4. KR/EN 카피·접근성·전체 회귀 검증

## 10. 성능과 안전

- 캐시 키: 데이터 해시, colMap, dashboard filter, metric, window.
- hover 이벤트 안에서 PVM 호출 금지.
- 이상치가 많으면 절대 z-score 상위 20개까지만 선계산하고 나머지는 클릭 시 1회 계산 후 캐시.
- 계산 중 오버레이를 먼저 paint한 뒤 실행.
- 결과에는 집계값만 포함하며 원본 행을 store에 복제하지 않는다.
- cross-grain 이동이면 필터를 넘기지 않고 `새 데이터 필요` 안내.

## 11. 검증

- [ ] 모든 결과에서 `Σ contribution = totalDelta` 오차 `≤1e-9`
- [ ] 상위/하위 grain rollup 합 일치
- [ ] 14일 미만, 분모 0, 한쪽 기간 0건, NaN 처리
- [ ] hover 100회에도 계산 횟수 증가 없음
- [ ] 필터·매핑·지표 변경 시 캐시 무효화
- [ ] 5-21 handoff는 자동 분석하지 않음
- [ ] 비인과 KR/EN 카피 동등
- [ ] 전체 `test:all`, lint 통과

## 12. 완료 기준

지원 가능한 이상치마다 차트와 표에서 동일한 귀속 결과가 즉시 보이고, 사용자가 동일 기간을 5-21에서 재검증할 수 있으면 완료다.
