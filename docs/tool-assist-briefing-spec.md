# C3 데이터 기반 어시스트 브리핑 설계

> 상태: 설계 확정안 · 구현 전  
> 대상: 우측 ToolAssistRail

## 1. 목표

현재의 정적 “다음 도구” 안내를 실제 분석 결과 기반 브리핑으로 바꾼다. 사용자가 보고 있는 데이터에서 중요한 발견을 우선순위대로 보여주고, 다음 행동이나 적합한 도구로 연결한다.

## 2. 핵심 결정

| 항목 | 결정 |
|---|---|
| SSOT | Zustand의 비영속 `findingsByGroup` |
| 결과 수집 | 각 분석 엔진의 구조화 producer |
| 기존 DOM `data-assist-*` | 현재 섹션 감지 용도로만 유지 |
| 추천 정렬 | 순수함수, 고정 점수·고정 tie-break |
| 정적 추천 | 발견이 없을 때만 fallback |
| 컨텍스트 전달 | 같은 데이터 grain만 C4 필터 상속 |
| 원본 데이터 | 저장·전달 금지, 집계 결과만 허용 |

DOM 문구를 MutationObserver로 긁어 분석 결과처럼 쓰지 않는다.

## 3. 발견 계약

```ts
type FindingV1 = {
  schemaVersion: 1;
  id: string;
  toolId: string;
  dataGroup: string;
  kind: "anomaly" | "saturation" | "allocation" | "quality" | "opportunity";
  severity: "info" | "watch" | "action";
  score: number;              // 0~100, producer가 명시
  headline: string;
  detail: string;
  evidence: Array<{
    label: string;
    displayValue: string;
    rawValue?: number;
  }>;
  scope: {
    dateStart?: string;
    dateEnd?: string;
    channels?: string[];
    countries?: string[];
  };
  suggestedTargets: Array<{
    toolId: string;
    actionLabel: string;
    reason: string;
  }>;
  sourceSection?: string;
  inputSignature: string;
  locale: "ko" | "en";
};
```

금지: 원본 행, 전체 CSV, 파일명, URL, 이메일·광고 ID 등 row-level 식별자.

## 4. producer 규칙

1차 producer:

- 5-2 이상탐지: 급격한 효율 변동
- 5-22 포화도: 추가 예산 여유·포화
- 5-3 예산배분: 기대 개선과 재배분 액션
- 5-21 PVM: Mix/Rate 주요 기여

각 producer는 계산 결과와 동일한 `inputSignature`로 findings를 교체한다. 새 분석 전 기존 결과는 stale로 숨기고 삭제한다. 표본 부족·식별 불가는 “발견”이 아니라 명시적 분석 상태로 처리한다.

## 5. 정렬 규칙

```text
rank = severityWeight + score
action 200 / watch 100 / info 0
동률: toolPriority → kindPriority → id 오름차순
```

현재 시간, 랜덤값, DOM 위치는 순위에 쓰지 않는다. 한 번에 최대 3개를 보여주고 나머지는 `N개 더 보기`로 접는다.

## 6. 사용자 흐름

1. 도구가 분석을 완료하고 findings를 발행한다.
2. Rail은 현재 `dataGroup`의 유효한 findings를 읽는다.
3. 가장 높은 발견을 `지금 볼 것` 카드로 표시한다.
4. 카드 CTA를 누르면 같은 grain 대상에는 기간·채널·국가 필터를 상속한다.
5. 다른 grain 대상에는 `새 데이터가 필요합니다`를 먼저 표시하고 필터를 넘기지 않는다.
6. 발견이 없으면 기존 `NEXT_TOOL_IDS` 정적 추천을 보여준다.

이동 후 대상 도구는 자동 분석하지 않는다.

## 7. UI 구조

- `지금 볼 것`: 발견 headline, severity, 근거 수치 1~2개
- `왜 중요한가`: detail 한 문장
- `다음 행동`: 가장 적합한 CTA 1개
- `다른 발견`: 접힌 목록
- `분석 결과가 아직 없어요`: 현재 도구의 분석 CTA
- 정적 fallback: 기존 다음 도구 카드

색만으로 severity를 구분하지 않고 텍스트 배지를 병기한다.

## 8. 기존 코드 연결

- `src/components/ToolAssistRail.jsx`: 현재 DOM attribute와 정적 추천을 조합.
- `src/lib/toolConnections.js`: `NEXT_TOOL_IDS`, `getNextTools` fallback.
- `src/store/useDataStore.js`: `dashboardFilterGroups`와 데이터 group.
- C1+C2의 `analysisHandoff`: 같은 세션 전달 계약을 공유.

## 9. 파일 변경안

| 파일 | 변경 |
|---|---|
| `src/lib/assist/findingSchema.js` | 계약 검증·금지 키 검사 |
| `src/lib/assist/rankFindings.js` | 결정론적 정렬 |
| `src/lib/assist/findingProducers.js` | 1차 4개 producer |
| `src/store/useDataStore.js` | `findingsByGroup`, publish/clear 액션 |
| `src/components/ToolAssistRail.jsx` | store 소비, 정적 fallback |
| `src/components/ds/AssistFindingCard.jsx` | 브리핑 카드 |
| 각 지원 도구 | 분석 성공 시 producer 호출 |

## 10. 구현 단계

1. 계약·정렬·store 수명주기와 테스트
2. 5-2 producer + Rail 새 카드로 end-to-end 검증
3. 5-22, 5-3, 5-21 producer 확대
4. C4 필터·handoff 연결, KR/EN 검증
5. DOM 기반 결과 읽기 제거. 섹션 감지 observer만 보존

## 11. 예외와 안전

- 입력·필터 변경 즉시 해당 signature findings 제거.
- 한 producer 오류가 Rail 전체를 깨지 않도록 producer별 격리.
- score가 범위를 벗어나면 clamp가 아니라 validation 실패로 제외.
- 같은 발견 중복은 `id`로 교체.
- 텍스트 길이와 evidence 개수 제한.
- cross-grain 컨텍스트 유출 방지 테스트 필수.

## 12. 검증

- [ ] 입력 순서가 달라도 동일 순위
- [ ] stale finding 정리
- [ ] findings 0건일 때 정적 fallback
- [ ] 같은 grain만 필터 상속
- [ ] 원본 행·금지 키 발행 거부
- [ ] producer 실패 격리
- [ ] KR/EN 의미·CTA 동등
- [ ] 키보드 탐색·스크린리더 severity 전달
- [ ] 전체 `test:all`, lint 통과

## 13. 완료 기준

지원 도구 분석 후 Rail이 실제 수치 기반 발견을 결정론적으로 제시하고, 안전한 컨텍스트로 다음 도구까지 연결하면 완료다.
