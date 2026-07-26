# 전체 툴 개선 실행 전 준비 계획

> 기준 문서: [전체 사이트 A-Z 30회 반복 감사](./full-tool-improvement-30-pass-audit.md)  
> 기준 브랜치: `origin/main` / PR #452 머지 이후  
> 목적: 감사 목록을 바로 구현하지 않고, 선행 계약·검증·보호선·의존성을 먼저 고정한 뒤 안전한 PR 단위로 진행한다.

## 0. 최종 원칙

- **Classic MMM은 이번 실행 범위에서 변경하지 않는다.** Classic 엔진·추세·패널티·분배·숫자·매핑 로직은 별도 승인 전까지 freeze한다.
- **노서버·무비용을 유지한다.** 새 서버 API, 유료 API, 유료 DB, 서버 분석 파이프라인을 추가하지 않는다. 별도의 보안·저장 UX 확장은 이번 범위에서 제외한다.
- **기존 데이터 처리 경계만 유지한다.** 원본 CSV 처리 방식이나 기존 저장·전송 기능을 이번 개선에서 확장하지 않는다.
- **분석 엔진과 표시층을 분리한다.** 공용 UI 개선이 수치 계산을 조용히 바꾸지 않게 한다.
- **한 PR에는 한 종류의 변경만 담는다.** 계약, 공용 UI, 도구별 로직, 번역, 성능을 섞지 않는다.
- **동일 입력은 동일 결과를 낸다.** 분석 로직뿐 아니라 fixture·cache key·export metadata도 재현 가능해야 한다.

## 1. 구현 전에 먼저 고정해야 할 것

### 1.1 기준선 스냅샷

현재 main 기준의 숫자·품질 상태를 먼저 보관한다.

- [ ] `git fetch origin main` 후 최신 main과 현재 작업 상태 확인
- [ ] Classic 관련 파일의 기준 commit과 파일 hash 기록
- [ ] 현재 route 목록·EN 공개 목록·tool registry 스냅샷 생성
- [ ] 주요 demo fixture와 실제 테스트 fixture의 결과 JSON 보관
- [ ] `npm test`, `npm run test:smoke`, `npm run lint`, `npm run build` 결과 기록
- [ ] 다운로드 fixture의 열 순서·단위·CRLF/BOM 기준 기록
- [ ] 현재 localStorage/IndexedDB schema version 기록

**완료 기준:** 개선 전후에 “수치가 바뀐 것인지, 표시층만 바뀐 것인지” 판별할 수 있다.

### 1.2 Classic MMM 보호선

다음 파일과 동작은 보호 대상으로 지정한다.

| 보호 대상 | 허용 | 금지 |
|---|---|---|
| `mmmMathPr416.js` | 읽기·fixture 검증 | 계산·prior·trend·penalty·분배 수정 |
| Classic `MarketingResponse` 분기 | label·공용 표시 연결 검토 | 입력·fit·decomp·channel allocation 변경 |
| Classic 결과 cache | mode 구분 확인 | Bayesian과 cache 공유 |
| Classic export | provenance manifest 추가 검토 | 숫자·기간·단위 재계산 |

각 PR description에 아래 체크를 넣는다.

```text
Classic MMM touched? [ ] No
mmmMathPr416 diff? [ ] No
Classic fixture unchanged? [ ] Yes
Bayesian/new model cache separated? [ ] Yes / N/A
```

### 1.3 데이터 경계 — 기존 원칙만 유지

별도 보안·저장 UX를 이번 개선의 선행 작업으로 만들지 않는다. 기존 프로젝트 규칙만 유지한다.

- 원본 CSV를 서버로 보내지 않는다.
- 유료 API·서버 분석·새 저장소를 추가하지 않는다.
- 기존 Google Sheets·Analytics·로컬 설정 동작은 이번 개선에서 확장하지 않는다.
- 저장 정책을 바꾸는 기능은 사용자가 별도 요청할 때 별도 범위로 다룬다.

## 2. 핵심 선행 계약

감사 목록의 대부분은 다음 공통 계약이 먼저 있어야 구현할 수 있다.

### 2.1 `MappingContract`

현재 자동 후보 점수화와 도구별 필드 정의를 하나의 반환 구조로 묶는다.

```js
{
  toolId,
  mapping,
  candidates,
  conflicts,
  profiles,
  requiredMissing,
  typeWarnings,
  unitWarnings,
  confidence: "confirmed" | "review" | "blocked",
  userConfirmed: false,
  source: "csv" | "google_sheets" | "handoff",
}
```

필수 규칙:

- 도구 밖 필드는 자동 매핑 후보에서 제외한다.
- one-of 필드는 하나만 확정한다.
- 같은 컬럼을 두 의미로 쓰면 충돌로 막는다.
- 사용자가 확정하지 않은 low-confidence mapping은 분석을 열지 않는다.
- recipe를 재사용해도 현재 헤더·타입·단위를 다시 검증한다.

### 2.2 `AnalysisStatus`

```text
EMPTY → READY → ANALYZING → COMPLETE
                  ├→ BLOCKED
                  ├→ FAILED → RETRY
                  └→ CANCELED
COMPLETE → STALE (mapping/filter/input/mode 변경)
```

각 상태에 필요한 화면:

| 상태 | 표시 | 사용자 행동 |
|---|---|---|
| EMPTY | 필요한 입력과 예시 | 파일 업로드 |
| READY | 분석 가능 조건 | 분석 시작 |
| ANALYZING | 진행·취소 | 기다리거나 취소 |
| COMPLETE | 결과·신뢰도·다음 행동 | 탐색·다운로드 |
| STALE | 이전 결과가 현재 입력과 불일치 | 재분석 |
| BLOCKED | 차단 원인·수정 방법 | 매핑/데이터 수정 |
| FAILED | 오류 코드·재시도 | 재시도·새 입력 |

### 2.3 `StatisticalStatus`

수치 0과 추정 불가를 구분한다.

```text
READY
CAUTION
INSUFFICIENT_DATA
NOT_IDENTIFIED
ABSTAIN
ENGINE_ERROR
```

공통 메타데이터:

- sample size와 실제 denominator
- valid/missing/zero count
- 기간 수와 활성 기간 수
- rank/zero variance/공선 경고
- CI 또는 CI를 계산할 수 없는 이유
- 관측 연관인지 인과/증분인지
- 외삽 여부

### 2.4 `MetricContract`

모든 지표에 다음 메타데이터를 붙인다.

```js
{
  key,
  label,
  numerator,
  denominator,
  unit,
  currency,
  timeBasis,
  aggregation,
  zeroDenominatorPolicy,
}
```

`cost`와 `spend`, `CPA`와 `CPR`, `install`과 `user`, `calendar window`와 `cohort window`를 같은 키로 뭉개지 않는다.

### 2.5 `ResultManifest`

화면 결과와 export가 공통으로 갖는다.

```js
{
  toolId,
  mode,
  source,
  inputSignature,
  mappingSignature,
  filter,
  grain,
  metricDefinitions,
  engineVersion,
  seed,
  status,
  warnings,
  generatedAt,
}
```

고정 시드는 재현성을 보장하지만 결과 저장은 아니다. 이 둘을 카피에서 분리한다.

## 3. 우선순위와 의존성

### P0 — 구현 전 반드시 완료

| 순서 | 작업 | 선행 이유 | 영향 |
|---:|---|---|---|
| 0 | 기준선·Classic freeze | 변경 원인 분리 | 전체 |
| 1 | MappingContract | 모든 분석의 입력 SSOT | 업로드·handoff·도구 |
| 2 | AnalysisStatus | stale/실패/취소 오표시 방지 | 전체 결과 |
| 3 | StatisticalStatus | 0과 식별 실패 구분 | 전체 엔진 |
| 4 | MetricContract | 단위·분모 drift 방지 | 표·차트·export |
| 5 | 날짜/filter contract | 기간 숫자 재현 | 전체 필터 |
| 6 | 항등식·fixture harness | 결과 변경 감지 | PVM·분해·배분 |

P0가 끝나기 전에는 대규모 UI 리디자인이나 도구별 통계 개선을 시작하지 않는다.

### P1 — 공용 UX에 적용

| 순서 | 작업 | 의존성 |
|---:|---|---|
| 8 | ResultActionCard 적용 | Metric/Statistical/Manifest |
| 9 | AnalysisDetails 강제 | Statistical/Manifest |
| 10 | DataTable 통일 | Metric/Export |
| 11 | DownloadHub + ResultManifest | Manifest/Metric |
| 12 | handoff manifest | Mapping/Filter/Metric |
| 13 | 접근성 baseline | 공용 UI 계약 |
| 14 | 모바일 baseline | 공용 UI 계약 |
| 15 | EN completeness test | route/copy registry |

### P2 — 도구별 정리

| 순서 | 대상 | 필요한 선행 |
|---:|---|---|
| 16 | 운영 대시보드 | Metric/Filter/Result |
| 17 | 예산·포화도 | Statistical/Metric/외삽 경고 |
| 18 | A/B·증분 | Statistical/causal evidence |
| 19 | PVM | 항등식/rollup |
| 20 | 소재·콘텐츠 | grain/rollup/sparse gate |
| 21 | Aha·코호트·LTV | window/denominator |
| 22 | 회귀·미래예측 표시층 | forecast manifest/외삽 |

### P3 — 성능·선택 기능

- 대용량 parse worker
- 선택적 analysis worker
- local history 관리 화면
- cross-tool 결과 비교
- 시각 회귀·스크린리더 회귀

## 4. 필요한 코드 작업 단위

### PR-00: 기준선·보호 자동화

- Classic 파일 hash/fixture check
- route/EN/tool registry snapshot
- test/lint/build baseline 기록
- PR template에 Classic 보호 체크 추가

### PR-01: 데이터 계약

- `MappingContract`
- `MetricContract`
- 날짜/grain/filter signature
- existing `prepareDatasetForTool`와 store의 mapping 책임 정리

### PR-02: 분석 상태·통계 상태

- 상태 머신
- eligibility taxonomy
- `NOT_IDENTIFIED`와 zero 분리
- cancel/retry/stale 공통 처리

### PR-03: 결과 계약·export

- ResultManifest
- ResultActionCard/AnalysisDetails 적용
- DownloadHub 연결
- CSV/JSON/MD/PNG snapshot tests

### PR-04: 표·차트·접근성·반응형

- DataTable 이관
- direct format 제거
- chart theme factory
- keyboard/menu/aria/data-view
- 360px layout baseline

### PR-05 이후: 도구별 적용

- 한 PR에 한 도구 또는 한 도구군만 변경
- 계산 엔진을 건드릴 경우 별도 math PR
- Classic MMM은 대상에서 제외

## 5. 구현 전에 준비할 fixture

### 공통 데이터 fixture

- 정상 CSV: 날짜·채널·비용·결과·통화 포함
- 한글 헤더 CSV
- 콤마 포함 숫자 CSV
- 중복 헤더·빈 헤더 CSV
- 결측·0분모·음수·문자 숫자 CSV
- 날짜 gap·중복 기간·partial week CSV
- 단일 채널·단일 기간·0 variance CSV
- 강한 공선·rank deficient CSV
- 대용량 deterministic fixture
- Google Sheets와 동일한 표 구조 fixture

### 도구별 fixture

- Dashboard: 모든 tab이 같은 기간·분모를 쓰는지
- Budget/Saturation: wrapper 예측·외삽·최소/최대 제약
- A/B/Incrementality: 유의·비유의·저검정력·대조군 없음
- PVM: 합계 항등식·rollup·잔차
- Creative/Content: 최소 grain·sparse entity
- Aha/Cohort: cohort censoring·rate/count 구분
- Forecast: 관측 구간·미래 구간·외삽 경고
- Classic MMM: 수치 변경 금지 fixture만 실행

## 6. 검증 계획

### 필수 자동 검증

- `npm test`
- `npm run test:smoke`
- `npm run lint`
- `npm run build`
- route registry/EN completeness
- MappingContract fixture
- MetricContract fixture
- status transition fixture
- export byte/snapshot fixture
- Classic fixture unchanged check

### 수동 검증

- 360px·1024px·wide desktop
- dark/light theme
- KO/EN
- keyboard-only 흐름
- screen reader 핵심 흐름
- CSV upload→mapping→analysis→download
- 큰 파일 분석 중 취소

### 절대 통과시키지 않을 회귀

- 분석 불가 데이터를 0 효과로 표시
- 현재 입력과 다른 stale 결과 표시
- 공용 단위와 export 단위 불일치
- 원본 CSV의 localStorage 저장
- 사용자 동의 없는 제3자 요청
- `Math.random()` 기반 분석 결과
- Classic MMM 숫자·기간·분배 변화

## 7. 릴리즈·롤백 계획

### 단계적 적용

1. 공용 계약을 추가하되 기존 화면은 그대로 둔다.
2. 한 도구를 reference implementation으로 이관한다.
3. fixture·smoke·manual 검증 후 다음 도구로 확장한다.
4. 모든 활성 도구가 통과한 뒤 직접 구현을 deprecated 처리한다.

### 롤백 단위

- PR 단위로 revert 가능해야 한다.
- 공용 계약은 기존 결과를 바꾸지 않는 adapter를 먼저 둔다.
- UI 변경과 엔진 변경을 같은 PR에 넣지 않는다.
- 결과 숫자가 달라지면 즉시 중단하고 계산층/표시층/기간·단위 차이를 분리 조사한다.

## 8. 작업 시작 조건

다음 체크가 모두 완료되면 P0 구현을 시작한다.

- [ ] 최신 `origin/main` 확인
- [ ] 별도 feat 브랜치 생성
- [ ] 현재 변경·untracked 민감 파일 보호 확인
- [ ] Classic 보호 fixture와 hash 기록
- [ ] P0-01~P0-06의 담당 파일·테스트 파일 확정
- [ ] 공통 fixture 설계 확정
- [ ] PR 분할과 rollback 기준 확정
- [ ] baseline test/lint/build 결과 첨부

## 9. 지금 바로 시작할 작업과 하지 않을 작업

### 바로 시작

1. PR-00 기준선·Classic 보호 자동화
2. PR-01 MappingContract·MetricContract·filter signature
3. PR-02 AnalysisStatus·StatisticalStatus

### 아직 시작하지 않음

- 대규모 디자인 변경
- 도구별 분석 알고리즘 변경
- 새로운 유료/서버 인프라
- Classic MMM 계산 변경
- Bayesian MMM과 Classic MMM의 결과 합치기

## 10. 완료 정의

이 준비 단계의 완료는 기능이 많이 추가됐다는 뜻이 아니다. 다음을 만족하는 상태다.

- 어떤 도구가 어떤 입력·단위·기간·분모를 쓰는지 공통 계약으로 알 수 있다.
- 어떤 결과가 계산 중·stale·식별 불가인지 공통 상태로 알 수 있다.
- 기존 저장·전송 경계를 깨뜨리지 않는다.
- 공용 UI를 적용해도 Classic MMM 숫자는 변하지 않는다.
- 각 후속 PR을 독립적으로 테스트하고 롤백할 수 있다.

이 조건을 먼저 고정한 뒤 감사 목록을 구현한다. 그렇지 않으면 UI를 고치는 동안 숫자·기간이 다시 달라져 원인 추적이 어려워진다.
