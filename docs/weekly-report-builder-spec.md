# B2 주간 보고서 빌더 설계

> 상태: 설계 확정안 · 구현 전  
> 대상: v2-migration · KR/EN 동시 지원

## 1. 목표

여러 분석 도구에서 나온 결론 카드와 핵심 수치를 한곳에 모아 주간 보고서를 만든다. 사용자는 항목 선택, 순서 변경, 메모 추가 후 Markdown 또는 인쇄/PDF로 내보낼 수 있다.

핵심 원칙:

- 원본 CSV 행은 보고서 상태와 내보내기 파일에 포함하지 않는다.
- 화면에 실제 계산된 결과만 수집한다. 값이나 결론을 새로 추정하지 않는다.
- 동일 입력에서 보고서 내용과 순서는 결정론적이어야 한다.
- 기존 `/weekly-review` 판단 회고 기능과 역할을 섞지 않는다.

## 2. 제품 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 위치 | `/weekly-report`, `/en/weekly-report` 신규 라우트 | `/weekly-review`는 과거 판단의 사후 검토 장부. 보고서 조립과 목적이 다름 |
| 수집 방식 | 각 결과 카드의 `보고서에 추가` 버튼 | DOM 캡처보다 구조화 데이터가 안정적 |
| 1차 지원 | 5-2, 5-21, 5-22, 5-3 | 공통 효율 CSV를 쓰고 주간 의사결정 연결성이 높음 |
| 저장 범위 | 현재 브라우저 세션 | 원본 데이터 영속화 위험 차단 |
| 내보내기 | Markdown + 인쇄/PDF | 기존 B3 인쇄 CSS 재사용. PNG 묶음은 후속 |
| 언어 | 현재 locale로 보고서 생성 | KR/EN 결과 혼합 방지 |

## 3. 기존 코드와 연결

- `src/lib/analysis-results/resultManifest.js`: 분석 결과 메타 목록. 실제 결론 블록 계약은 없음.
- `src/components/ds/ResultActionCard.jsx`: 공통 결론 UI. 여기서 구조화 결과를 수집 가능.
- `src/lib/analysis-results/pvmQuickSummary.js`: 정규화된 결과 어댑터의 선행 사례.
- `src/components/WeeklyReview.jsx`: Markdown 생성·다운로드 패턴만 재사용. 상태와 화면은 분리.
- `src/app/globals.css`: B3 인쇄/PDF 스타일 재사용.

## 4. 데이터 계약

```ts
type ReportBlockV1 = {
  schemaVersion: 1;
  id: string;                 // toolId + inputSignature + blockKind
  toolId: string;
  toolTitle: string;
  blockKind: "summary" | "warning" | "recommendation" | "table";
  headline: string;
  points: string[];
  stats: Array<{
    label: string;
    displayValue: string;
    rawValue?: number;
    unit?: string;
  }>;
  scope: {
    dateStart?: string;
    dateEnd?: string;
    channels?: string[];
    countries?: string[];
  };
  inputSignature: string;
  locale: "ko" | "en";
};

type WeeklyReportDraftV1 = {
  schemaVersion: 1;
  title: string;
  period?: { start: string; end: string };
  blocks: ReportBlockV1[];
  notes: Array<{ id: string; text: string }>;
};
```

금지 필드: `raw`, `rows`, `csvData`, `canonicalData`, `mappedRows`, 파일 URL, 전체 레코드 배열.

## 5. 동작 흐름

1. 지원 도구가 계산을 완료한다.
2. 도구별 어댑터가 `ReportBlockV1`을 생성한다.
3. 사용자가 `보고서에 추가`를 누른다.
4. Zustand의 비영속 `reportDraft`에 블록을 추가한다.
5. `/weekly-report`에서 순서, 포함 여부, 메모를 편집한다.
6. 입력 시그니처가 바뀐 블록은 `오래된 결과`로 표시한다.
7. Markdown 다운로드 또는 인쇄/PDF를 실행한다.

중복 추가는 같은 `id`를 갱신한다. 자동으로 여러 결과를 수집하지 않는다.

## 6. 화면 구조

- 상단: 보고 기간, 제목, 포함 블록 수
- 본문: 도구별 블록 카드, 드래그 대신 위/아래 버튼으로 결정론적 순서 변경
- 각 카드: 출처 도구, 분석 범위, 결론, 핵심 수치, stale 경고, 제거
- 하단: 메모, Markdown 다운로드, 인쇄/PDF
- 빈 상태: 1차 지원 도구 링크와 “결과 카드에서 보고서에 추가” 안내

## 7. 파일 변경안

| 파일 | 변경 |
|---|---|
| `src/lib/reports/reportSchema.js` | 계약 검증, 허용 필드 직렬화 |
| `src/lib/reports/reportAdapters.js` | 4개 도구별 어댑터 |
| `src/lib/reports/renderMarkdown.js` | KR/EN Markdown 생성 |
| `src/store/useDataStore.js` | 비영속 `reportDraft`, 추가·삭제·정렬 액션 |
| `src/components/ds/ResultActionCard.jsx` | 선택적 `reportBlock`과 추가 버튼 |
| `src/components/WeeklyReport.jsx` | 보고서 편집 UI |
| `src/app/weekly-report/page.js` | KR 라우트·메타 |
| `src/app/en/weekly-report/page.js` | EN 라우트·메타 |
| `src/lib/routeMap.js` | 링크·사이트맵 등록 |

## 8. 구현 단계

1. 계약·allowlist serializer·순수 어댑터와 테스트
2. Zustand 세션 상태와 결과 카드 수집 버튼
3. 보고서 편집 화면·KR/EN 라우트
4. Markdown·인쇄/PDF 내보내기
5. 지원 도구 확대, PNG 묶음은 별도 후속

## 9. 예외와 안전장치

- 계산 전, 오류, 표본 부족 결과는 추가 버튼을 비활성화하고 이유 표시.
- `inputSignature` 변경 시 자동 덮어쓰지 않고 stale 경고.
- Markdown 셀과 제목의 `|`, 줄바꿈, HTML은 escape.
- 블록당 stats/points 개수와 문자열 길이에 상한 적용.
- 내보내기 직전 금지 키 재귀 검사. 발견 시 다운로드 중단.
- 기간이 다른 블록 혼합은 허용하되 카드와 보고서 머리말에 경고.

## 10. 검증

- [ ] 4개 어댑터 골든 테스트
- [ ] 원본 행·금지 키가 직렬화되지 않음
- [ ] 같은 입력은 byte-identical Markdown 생성
- [ ] 중복 추가, 삭제, 순서 변경, stale 판정
- [ ] 기간 혼합 경고
- [ ] KR/EN 의미·링크·메타 동등
- [ ] 인쇄 시 컨트롤 숨김, 결과 카드·표·차트 유지
- [ ] 렌더 smoke와 전체 `test:all`, lint 통과

## 11. 완료 기준

지원 도구 4곳에서 실제 결과를 선택해 `/weekly-report`에 모으고, 원본 CSV 없이 재현 가능한 Markdown과 PDF를 만들 수 있으면 완료다.
