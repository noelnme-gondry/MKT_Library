# 커스텀 지표 · 데이터 구성 기능 — 설계 스펙 (SSOT)

> 목적: 유저가 (A) CSV 컬럼으로 파생 지표를 만들고 (B) 지표 표시/순서를 조정하고
> (C) 그 설정을 브라우저에 저장해 지속 사용하게 한다.
> 계층: v2-migration (Next.js). 순수 수학은 골든 불변(§8·§12.20).
> 상태: 2026-07-07 — **A~D 완료·머지**(PR #245). §7 백로그 #1·#2·#4 완료(#2는 기 완료 확인). **#3(다른 도구 확장)만 보류**(다음 세션).

## 0. 확정된 결정 (유저 승인)

| 항목 | 결정 | 근거 |
|---|---|---|
| 저장 범위 | **설정(config)만** localStorage 저장. 원본 CSV는 인메모리 유지 | §2.2 민감데이터 서버·로컬 잔존 최소화. 체감 UX 대부분 확보 |
| 지표 자유도 | **1차 프리셋 토글 → 2차 자유 수식 빌더** 자연 연결 | 안전·빠른 배포 후 파워유저 자유도 확장 |
| 설정 scope | **도구별(per-tool)** config | 도구 성격 상이(CTR=퍼널, ROAS=LTV). CSV 그룹 스코프와 정합 |
| 1차 파일럿 | **운영 대시보드(5-2)** | 지표 최다·`calculateKPIs` 중심 → 레지스트리 효과 최대 |

## 1. 현재 구조 (걸리는 지점)

- **지표 = 코드(하드코딩)**: `src/utils/dashboardAggregator.js:151-165` `calculateKPIs`가
  ctr/cpc/cpm/cpi/cvr/roas 등을 고정식으로 계산. "지표 목록" 데이터 구조 없음 → 유저가 손댈 표면 없음.
- **표 = 데이터 주도적(이미 OK)**: `src/components/ds/DataTable.jsx`는 `columns` 배열을
  받아 순서대로 렌더. 단 각 컴포넌트가 columns를 하드코딩해 넘김 → config 필터/정렬 층만 없음.
- **상태 = 전부 인메모리**: `src/store/useDataStore.js` Zustand. persist 없음(§7 새로고침 리셋 기본).
- **CSV 그룹 스코프**: `csvGroups`(efficiency/creative/…) + `TOOL_GROUP`. per-tool config는 이 스코프와 정합.

## 2. 목표 구조 (신규 3모듈)

```
src/utils/metrics/
├─ metricRegistry.js   ★ SSOT — 지표를 순수 서술자로 정의
│    METRIC = { id, label, unit, category, source:"base"|"derived"|"custom",
│               deps:[표준필드…], compute:(agg)=>number|null, format:(v)=>string }
│    · base(cost·impressions·installs…) + derived(ctr·cpc·roas…) 큐레이션 이관.
│    · compute는 집계객체(agg)만 받는 순수함수. 기존 calculateKPIs 식 verbatim.
├─ formulaEngine.js    ★ (Phase D) 순수·결정론 수식 파서. NO eval.
│    · 화이트리스트 토크나이저 + shunting-yard(또는 안전 AST).
│    · 허용: 필드/지표 참조 · + − × ÷ · 괄호 · safeDiv(a,b)=b?a/b:null.
│    · 0나눗셈·NaN·빈배열 → null(거짓 숫자 금지 §8.6). deps 자동 추출.
└─ *.test.js           골든(기존 calculateKPIs 값 재현 + 수식 케이스)

src/store/useDataStore.js  (슬라이스 추가 + persist 미들웨어)
└─ viewConfig: { [toolId]: { order:string[], hidden:string[], customMetrics:METRIC[] } }
   · zustand persist(localStorage) + partialize → viewConfig·isDarkMode 등 config만.
   · raw CSV(csvGroups·csvData)는 partialize에서 제외(절대 저장 X).
   · version 필드 + migrate 훅(스키마 진화 대비, 장기 운영 필수).

src/components/ds/MetricConfigPanel.jsx  지표 편집 드로어
   · 진입점 "⚙ 지표 편집" → 드로어. 토글(표시/숨김) + 드래그 순서.
   · 프리셋 파생지표 목록(registry의 source!=="base") 체크.
   · (Phase D) <details> 고급 → 자유 수식 입력 + 라이브 검증·미리보기.
   · "기본값으로 초기화" 항상 노출(persist 복구 탈출구).
```

**렌더 파생**: 도구/대시보드는 `registry + viewConfig[toolId] → columns` 로 컬럼을 파생
(하드코딩 columns 제거). 엔진 불변 → 골든 byte-동일.

## 3. 단계별 플랜 (증분·안전 우선)

| Phase | 내용 | 계층 | 검증 | 위험 |
|---|---|---|---|---|
| **A** | 지표 레지스트리 리팩토링. calculateKPIs → metricRegistry 소비. UX 변화 0 | 엔진 | 골든(기존 값 재현) | 낮음 |
| **B** | 5-2 컬럼 표시/순서 조정 + viewConfig persist(설정만). MetricConfigPanel 기본판 | 렌더+상태 | 스모크·lint·persist 라운드트립 | 낮음 |
| **C** | 프리셋 파생지표 토글(registry 큐레이션 확장). 유저는 고르기만 | 렌더 | 골든(신규 compute)·스모크 | 낮음 |
| **D** | 자유 수식 빌더(formulaEngine). 라이브 검증·미리보기 | 엔진+렌더 | 골든(수식 케이스)·render-throw harness | 높음 |
| **E** | 저장 정책 강화: version 마이그레이션·리셋·(선택)원본 IndexedDB 옵트인 | 상태+저장소 | 스키마 마이그레이션 테스트 | 중 |

권장: **A→B→C**를 1차 릴리즈. D·E는 후속(각 별도 PR).

**실제 진행(2026-07-07, PR #245)**: A·B·C 계획대로 완료. **D는 계획과 다른 구현**으로 완료
— `formulaEngine.js`(자유 문자열 파싱) 대신 `customMetric.js`(N항 체인: 컬럼/숫자+부호 반복)
채택. eval도 파서도 없어 §4 규칙 그대로 지키면서 위험도 낮춤(원안 "위험:높음" 회피).
**E는 부분** — `useDataStore.js`에 `version:1`+`partialize` 있으나 `migrate` 훅 없음(버전 그대로라
아직 무증상). 리셋 버튼(§4)은 적용 3곳(스코어카드·Viz탭·LTV표) 모두 있음. IndexedDB 원본 옵트인
미착수(원래 선택 항목).
추가로 스펙 밖 확장: 커스텀 차트 빌더(`CustomChartBuilder.jsx`, 모양+행+값 조립) + 5-2 내
Funnel·Cohort·Pacing·Anomaly·Segment 탭에 커스텀 차트 **노출**(각 탭 `CustomChartsSection`) +
스코어카드/Viz탭 카드 인라인 드래그·on/off 편집(`InlineCardEditor.jsx`).

## 4. 불변 규칙 (반드시 준수)

- **수식 `eval` 절대 금지** — 보안+결정론(§3.3). 화이트리스트 파서만.
- **원본 CSV localStorage 저장 금지** — config만. 원본 저장은 IndexedDB+명시 옵트인(Phase E).
- **골든 보호** — 지표 이관 시 tolerance 완화·수학 변경 0. compute = 기존 식 verbatim(§12.20).
- **persist 버저닝** — viewConfig에 version + migrate. 포맷 변경이 구 config 안 깨게.
- **정직성** — 분모 0·데이터 부족 지표는 "계산 불가", fabricate 금지(§8.6).
- **저장 투명성 카피** — "이 설정은 이 브라우저에만 저장(데이터 서버 전송 없음)" 명시(§2.2 신뢰).

## 5. UX 원칙 (claude-ux·§15.5)

- 점진적 공개: 편집 UI는 진입점 뒤 드로어. 자유 수식은 드로어 내 `<details>` 고급.
- 프리셋 먼저·수식 나중: 다수는 켜기/끄기/순서면 충분. 자유 수식은 파워유저용.
- 탈출구: "기본값 초기화" 항상. render층만 손대 골든 byte-동일 유지.

## 6. 파일 착수 지도 (구현자용)

- 지표 정의 → `src/utils/metrics/metricRegistry.js` (신규) ← `calculateKPIs`(dashboardAggregator.js:119) 식 이관
- 수식 엔진 → `src/utils/metrics/formulaEngine.js` (신규, Phase D)
- 상태·저장 → `src/store/useDataStore.js` (viewConfig 슬라이스 + persist)
- 편집 UI → `src/components/ds/MetricConfigPanel.jsx` (신규)
- 파일럿 소비 → `src/components/dashboard/*`(5-2) columns를 registry+viewConfig에서 파생
- 코드맵 갱신 → `v2-migration/ARCHITECTURE.md` (§3 도메인 매핑에 metrics/ 추가, §15 규율)

## 7. 다음 작업 백로그 (2026-07-07 확정, 미착수)

PR #245 머지로 A~D 종결. 아래는 **같은 SSOT 이어서** 후속 PR로 진행할 항목(순서 무관, 병렬 가능).

| # | 항목 | 범위 | 비고 |
|---|---|---|---|
| 1 | ✅ **나머지 표 확장** (2026-07-07 완료) | FunnelTab §5(단계별 count/CVR 컬럼)·CohortTab §1(잔존율/잔존유저수)·AnomalyTab(값/기준평균/z-score/방향) — LTV표 패턴(`applyMetricView`+`MetricConfigPanel`+`resetViewConfig`) 적용, scope `5-2:funnel-table`·`5-2:cohort-table`·`5-2:anomaly-table`. **SegmentTab 매트릭스는 제외** — 행/열이 데이터값(국가·채널 등)이라 고정 metric-column 리스트 모델과 구조 불일치 |
| 2 | ✅ **나머지 탭 편집기** (기 완료 확인, 백로그 문서만 stale) | `CustomChartsSection`이 이미 `MetricConfigPanel`(⚙ 차트 편집)+`CustomChartBuilder`(＋ 커스텀 차트) 내장 — Funnel·Cohort·Pacing·Anomaly·Segment 5개 탭 전부 이미 적용됨(추가 작업 불필요) |
| 3 | **다른 도구로 확장** (보류) | 5-3(예산배분 2481줄)·5-6(소재분석 1302줄)·5-18(MMM)·5-21(PVM 1305줄) — 표 26개+, 도구당 규모 큼+§7 함정(PVM rollup 항등식·predictSafeCpr wrapper 등) 밀도 높아 별도 세션 필요. 도구별 `calculateKPIs` 상당 함수 확인 후 §2 렌더 파생 패턴 이식. scope 키는 도구 id 접두(`5-3:...`) |
| 4 | ✅ **Phase E 마무리** (2026-07-07 완료) | `useDataStore.js`에 `persistMigrate(persistedState, version)` export + persist `migrate` 훅 배선(현재 version=1 무동작, 골든 테스트로 확인) |

남은 항목: **#3만 잔존**(보류, 다음 세션).
