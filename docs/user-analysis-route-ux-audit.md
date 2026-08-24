# 유저 분석 루트 UX 감사

> **목적**: 사용자가 데이터를 올려 판단을 얻고, 다음 행동을 하고, 다음 주에 다시
> 돌아오기까지의 한 줄기 여정을 반복 가능한 방식으로 감사한다.
>
> **대상**: 진입(`/` · `/start` · `/diagnose` · 사이드바) → 업로드 → 매핑 → 분석
> 게이트 → 결과 → 다음 행동 → 재방문(`/weekly-review`).
>
> **원칙**: 발견은 파일:줄 또는 실측 수치를 남긴다. 근거 없는 인상 비평은 기록하지
> 않는다. 계산 불가·재업로드·비영속은 제품 결정일 수 있으므로, 관측 사실과 개선
> 판단을 분리해 쓴다.

`docs/automateaudit.md`는 **표면(surface)** 단위로 콘텐츠·SEO·공개 라우트의 전수
커버리지를 본다. 이 문서는 **여정 단계(stage)** 단위다. 같은 도구를 여러 번 보되,
한 사람이 실제로 지나는 순서로 본다. 단계와 단계 사이의 이음매에서만 보이는
결함(추천은 A인데 A를 열면 빈 업로드, 다음 카드를 누르면 재업로드 등)을 찾는 것이
목적이다.

---

## 0. 사용법

| 상황 | 할 일 |
| --- | --- |
| 정기 감사 | §3 R1~R7 실행 → §5에 새 로그 추가 → §6 상태 갱신 |
| 도구 1개 추가·변경 후 | R1·R2·R6 부분 실행 |
| 발견 항목 수정 완료 | §6 상태를 `해결`로 바꾸고 PR 번호를 적는다. 원 발견과 수치는 지우지 않는다. |

이 문서는 감사 기록이지 실행 계획이 아니다. 수정은 별도 PR로 하고, 이 문서에는
그 결과만 남긴다.

---

## 1. 감사 단위 — 여정 단계 × 이탈 조건

각 단계는 아래 세 조건에서 본다. 해피패스는 기존 스모크가 많이 다루므로, 이탈은
부족 조건과 앞 단계 상태가 넘어오는 이음매에서 찾는다.

| 조건 | 뜻 |
| --- | --- |
| 정상 | 계약을 만족하는 데이터로 통과한다. |
| 부족 | 컬럼·기간·행이 모자랄 때 무엇을 더 주면 되는지 정직하게 막는다. |
| 이음매 | 앞 단계의 CSV·매핑·분석 상태를 뒤 단계가 재업로드·재매핑 없이 이어받는다. |

샘플링은 이음매만 19개 발행 도구 전수로 본다. 정상·부족은 대표 3개
`5-2`(대시보드), `5-18-mmm`(최대 복잡도), `5-27`(최신 도구)을 직접 추적한다.

---

## 2. 렌즈 (J1~J6)

| 코드 | 판정 기준 |
| --- | --- |
| J1 경로 연속성 | 추천한 도구를 열면 같은 상태로 이어지는가. 같은 행동의 두 진입 경로가 같은 결과 상태가 되는가. 결과의 다음 단계가 현재 CSV로 갈 수 있는가. |
| J2 약속과 구현 | 카피·버튼이 실제 동작과 일치하는가. 데모/실데이터 표기가 결과 출처와 같은가. |
| J3 막힘의 정직성 | 부족 이유와 보완할 데이터를 말하는가. 계산 불가를 정상·0·좋은 등급으로 접지 않는가. 빈 화면에 안내·템플릿·예시가 있는가. |
| J4 대기와 반응 | 무거운 계산 전에 오버레이가 페인트되는가. 멈춤과 분석 중을 구별할 수 있는가. |
| J5 배선 커버리지 | 안내·게이트·결론·다운로드·결정 기록·다음 단계가 발행 도구 전수에 붙는가. 목록이 파생인지, 소비처 0인 화면이 없는가. |
| J6 재방문 루프 | 결과에서 판단을 기록하고 `/weekly-review`에서 다시 열 수 있는가. 비영속 CSV의 재업로드 비용을 무엇으로 보완하는가. |

---

## 3. 재실행 가능한 스윕

모든 명령은 `v2-migration/`에서 실행한다. 출력 수치가 바뀌면 §5에 새 로그를
추가한다. 정적 검색은 후보를 찾는 수단일 뿐이며, P1 이상은 해당 소비처를 직접
열어 확인한다.

### R1. 다음 단계의 데이터 연속성 (J1)

`NEXT_TOOL_IDS`의 상단 두 장은 `ToolConnections.jsx`에서 `slice(0, 2)`로 보인다.
따라서 순서 자체가 계약이다. 같은 그룹이면 재업로드 없이 이어갈 수 있다.

```bash
node --input-type=module <<'NODE'
import fs from "node:fs";
const connections = fs.readFileSync("src/lib/toolConnections.js", "utf8");
const groups = fs.readFileSync("src/lib/toolGroups.js", "utf8");
const group = Object.fromEntries([...groups.matchAll(/"([^\"]+)":\s*"([^\"]+)"/g)].map(([, id, value]) => [id, value]));
const body = connections.match(/export const NEXT_TOOL_IDS = \{([\s\S]*?)\n\};/)[1];
const rows = [...body.matchAll(/"([^\"]+)":\s*\[([^\]]+)\]/g)].map(([, id, values]) => [id, [...values.matchAll(/"([^\"]+)"/g)].map(([, value]) => value)]);
const links = rows.flatMap(([from, to]) => to.map((target) => ({ from, target, same: group[from] === group[target] })));
const topTwoNew = rows.filter(([from, to]) => to.slice(0, 2).every((target) => group[from] !== group[target])).map(([id]) => id);
console.log({ tools: rows.length, links: links.length, crossGroup: links.filter((link) => !link.same).length, topTwoBothNew: topTwoNew });
NODE
```

판정: `topTwoBothNew = 0`이 목표다. 같은 그룹 후보가 없는 도구는 상단에 “새
데이터 준비”를 분명히 알리는 카드가 와야 한다.

### R2. 단계 부품 배선 커버리지 (J5)

`TOOL_GUIDE`는 발행 도구에서 파생되거나, 예외가 코드로 명시돼야 한다. 5-18
서브도구가 허브 가이드를 공유하는 현재 계약은 `RESPONSE_SUBTOOL_IDS` 파생으로
검사한다.

```bash
npm run test:all -- src/utils/toolGuideCoverage.test.js src/components/ds/CsvGuide.smoke.test.jsx
rg -n 'RESPONSE_SUBTOOL_IDS|TOOL_GUIDE\[toolId\]' src/utils/toolGuide.js
```

판정: 발행 도구의 업로드 안내 누락 0건. 사용하지 않는 `NO_UPLOAD_GUIDE` 예외는
사유가 코드에 있어야 한다.

### R3. 죽은 부품 (J5)

컴포넌트 자체 스모크는 직접 `render()`하므로, 마운트되지 않은 화면도 초록일 수
있다. 테스트를 제외한 프로덕션 소비처를 확인한다.

```bash
rg -n '<ToolAssistRail|<AnalysisEligibilityList' src --glob '*.{js,jsx}' \
  | rg -v '\.(test|spec)\.'
```

판정: 화면에 있어야 하는 컴포넌트의 프로덕션 소비처 0건은 결함 후보다. 제거할지,
어느 여정 단계에 다시 마운트할지는 제품 결정을 먼저 남긴다.

### R4. 임포트 경로 파편화 (J3)

공용 업로더의 파일 크기 상한·CP949 복원 가드가 자체 드롭존에도 적용되는지 본다.

```bash
rg -n 'assertCsvFileSize|decodeCsvBuffer' src
rg -l 'type=["'"']file["'"']' src/components --glob '*.{js,jsx}' \
  | xargs rg -L 'assertCsvFileSize|decodeCsvBuffer'
```

판정: 자체 `type="file"` 경로가 공용 가드를 우회하면 P1 후보다. 파일별 파싱
흐름이 달라 일괄 치환하지 않고, CP949·과대 파일 회귀 테스트와 함께 나눈다.

### R5. 분석 중 피드백 (J4)

정적 수치는 후보 선별용이다. 실제 P1 판정은 대표 대용량 CSV로 메인 스레드
블로킹과 오버레이 선페인트를 프로파일링해서 내린다.

```bash
rg -l 'AnalyzingOverlay' src/components/tools --glob '*.jsx'
wc -l src/components/tools/{BudgetAllocation,CreativeAnalyzer,CampaignPvm}.jsx
rg -n 'useMemo' src/components/tools/BudgetAllocation.jsx | wc -l
```

판정: 무거운 분석 진입점에서 `AnalyzingOverlay`와 더블 `requestAnimationFrame`
디퍼가 없으면 개선 후보로 기록한다.

### R6. 자격 판정 엔진 정합 (J1·J2)

추천 화면 카탈로그와 도구 화면 게이트 계약은 같은 발행 도구를 덮어야 한다.

```bash
npm run test:all -- src/lib/assistant/analysisCatalog.test.js src/lib/analysis-router/evaluateEligibility.test.js
rg -n 'ANALYSIS_CATALOG|ANALYSIS_CONTRACTS|publishedToolIds' \
  src/lib/{assistant/analysisCatalog.js,analysis-router/evaluateEligibility.js,analysis-router/evaluateEligibility.test.js}
```

판정: 두 집합의 차집합 0이 목표다. 과도기 예외가 필요하면 도구 ID·이유·종료
조건을 코드와 이 문서에 함께 남긴다.

### R7. 결정 기록 루프 커버리지 (J6)

결론 카드가 있는 화면은 판단을 기록할 수 있어야 한다. 의도적으로 제외하는 경우
`decisionReview={false}`의 사유 주석이 필요하다.

```bash
rg -n '<ResultActionCard|decisionPrefill|decisionReview=\{false\}' src/components/tools --glob '*.jsx'
```

판정: 결론 카드 화면 수와 `decisionPrefill` 연결 수가 일치해야 한다. 예외는 제품
결정·사유를 코드에서 읽을 수 있어야 한다.

---

## 4. 발견 기록 스키마

| 필드 | 값 |
| --- | --- |
| 증거 등급 | `측정`(스윕 수치), `관찰`(코드 직접 확인), `추론`(실데이터 미확인 판단) |
| 심각도 | P0 거짓 숫자·프라이버시·화면 깨짐 / P1 경로 단절·이탈 / P2 이해 비용·일관성 / P3 다듬기 |
| 상태 | 미착수 / 진행 중 / 해결(PR 번호) / 제품 판단 대기 |

---

## 5. 실행 로그

### 2026-08-24 · 1차 정적 감사

- 기준 커밋: `477dbbe6` (내부 브랜드 마크 통일, PR #728)
- 범위: R1~R7 정적 스윕과 S1~S7 코드 추적(진입 3면 · 업로드 7경로 · 발행 도구 19개)
- 미수행: 라이브 브라우저, 실기기 모바일, GA4 실데이터, `npm run test:all`·`lint`·`build`.
  당시 컨테이너에 `node_modules`가 없어 스위트를 실행하지 못했다. 따라서 이 로그는
  테스트 통과를 근거로 삼지 않는다.

#### 통과 항목

| 단계 | 확인 내용 | 근거 |
| --- | --- | --- |
| S4 | 분석 게이트는 그룹 스코프 단일 소스이며, 매핑 변경 시 분석 상태가 숨겨진다. | `CsvUploader.jsx:264-265`, `useDataStore.js:isGroupAnalyzed` |
| S3 | 5-18 다섯 서브도구의 필수·옵션 필드가 허브에서 파생된다. | `csvConstants.js:1732-1735` |
| S5 | 결과와 참고 영역의 경계 소유자가 하나다. | `ToolPageOutro.jsx:44-48` |
| S5 | ToolIntro가 h1을 쓰는 도구는 셸 제목 수준을 낮춰 h1이 하나다. | `ToolPageShell`의 `titleLevel={0}` |
| S6 | 다음 단계 카드가 같은 CSV와 새 데이터 준비를 구분해 말한다. | `ToolConnections.jsx:79-81` |
| S7 | 데모 데이터에서는 결정 기록 루프를 숨긴다. | `ds/ResultActionCard.jsx:144` |
| S2 | 공용 업로더는 CP949 복원·파일 크기 상한·워커 파싱·XLSX 시트 선택을 가진다. | `CsvUploader.jsx:415-446` |
| S1 | 쓸 수 없는 도구도 목록에는 남긴다. | `ds/ToolIndex.jsx:41-46` |

#### 발견 항목

| ID | 단계·렌즈 | 증상과 근거 | 사용자 영향 | 심각도 |
| --- | --- | --- | --- | --- |
| U1 | S5·S7 / J5 | `ToolAssistRail`의 프로덕션 소비처가 0이다. PR #712가 KO/EN `PageClient`에서 마운트를 제거했으나 본체와 자체 스모크는 남았다. | 판단 직후 “지난 결정 검토” 진입점이 없다. | P1 |
| U2 | S6 / J1 | 다음 분석 링크 57개 중 41개(72%)가 다른 CSV 그룹이다. 상단 2장이 모두 재업로드인 도구는 19개 중 10개다. (`toolConnections.js:163-185`, `toolGroups.js`) | 다음을 누르면 빈 업로드 화면으로 간다. | P1 |
| U3 | S2 / J3 | `assertCsvFileSize`·`decodeCsvBuffer` 소비처는 `CsvUploader`뿐이다. 자체 입력 6경로(Aha, Brand incrementality, Content element, Incrementality, Paid/organic trend, Store event log)가 가드를 우회한다. | 한국 Excel CSV의 헤더가 깨진 채 파싱돼 매핑이 전멸하거나, 과대 파일이 탭을 멈출 수 있다. | P1 |
| U4 | S1 / J2 | `/start`는 “가능한 분석은 진하게, 부족하면 흐리게”라고 말하지만 `ToolIndex`에 `eligibleIds={null}`을 넘겨 전부 ready였다. `StartGate.jsx:29,191`, `ToolIndex.jsx:43`. | 17개가 모두 실행 가능해 보이고, 사용자는 빈 업로드로 이탈한다. | P1 |
| U5 | S4 / J4 | `AnalyzingOverlay` 소비처는 5-20·5-18 계열뿐이다. Budget allocation은 3,354줄·`useMemo` 29개, Creative analyzer 1,873줄, Campaign PVM 1,764줄인데 오버레이가 없다. | 대용량에서 클릭 후 멈춤과 분석 중을 구별할 수 없다. | P1 |
| U6 | S1↔S4 / J1·J2 | `/start` 추천은 `markAnalyzed:false`, Dochi dock은 기본 `true`였다. | 같은 CSV·동일 추천인데 시작 화면만 분석 버튼을 한 번 더 눌렀다. | P2 |
| U7 | S1↔S4 / J1·J2 | 추천 `ANALYSIS_CATALOG`은 19개, 도구 게이트 `ANALYSIS_CONTRACTS`는 15개였다. 차집합: `5-18-trend`, `5-18-paid-organic`, `5-18-cannibal`, `5-18-forecast`. | 추천과 직접 진입의 최소 행·기간 게이트가 다르다. | P2 |
| U8 | S2 / J3·J5 | `TOOL_GUIDE`가 손맵이고 5-18 서브도구 키가 없었다. `5-18-paid-organic`은 자체 ID로 `CsvGuide`를 호출해 `null`을 반환했다. | 컬럼 안내·템플릿·예시 실행이 없는 빈 업로드 안내가 생긴다. | P2 |
| U9 | S7 / J6 | `AsoStoreConversion.jsx:237`은 `decisionPrefill` 없이 `ResultActionCard`를 렌더한다. Paid/organic은 이유 없이 `decisionReview={false}`였다. | 5-27 판단을 다음 주에 기록·검토할 수 없다. | P2 |
| U10 | S1 / J5 | `AnalysisEligibilityList` 프로덕션 소비처가 0(67줄)이다. | 11개 도구의 “얻게 되는 답” KR/EN 카피가 화면에 도달하지 않는다. | P2 |
| U11 | S5 / J5 | `CUSTOM_TOOL_INTRO_IDS`에는 `5-28`이 있지만 `ToolIntro`의 `INTRO` 맵에는 키가 없어 `null`이다. | 5-28만 도구 소개 문단 없이 열린다. | P3 |

### 2026-08-25 · 재검증 및 1차 수정

- 기준 커밋: `be2933ba` (PR #729 squash merge)
- 검증: R1~R7 정적 재확인, 실 CSV `/start`→대시보드 운영 확인, 단위·스모크·E2E·lint·build 실행
- 수치: R1은 도구 19개·링크 57개·다른 그룹 41개·상단 2장 모두 재업로드 10개로
  1차와 동일했다. R6은 카탈로그 19개·계약 15개(누락 4개)로 동일했다.

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| U4 | 해결 (PR #729) | `StartGate`가 현재 CSV의 eligibility snapshot을 `AssistantWorkspace`에서 받아 `ToolIndex`에 전달한다. CSV가 바뀌면 stale 결과를 쓰지 않는다. |
| U6 | 해결 (PR #729) | 추천 도구가 현재 eligibility를 통과할 때만 `markAnalyzed:true`다. 미자격 도구는 결과를 날조하지 않고 게이트를 유지한다. `/start` 실 CSV→대시보드는 추가 “데이터 분석하기” 없이 결과 카드까지 확인했다. |
| U8 | 해결 (PR #729) | `RESPONSE_SUBTOOL_IDS`에서 5-18 서브도구 가이드를 파생하고 커버리지 테스트로 고정했다. |
| U1·U2·U3·U5·U7·U9·U10·U11 | 미해결 | 1차 수치와 코드 근거를 재확인했다. 아래 우선순위와 제품 판단에 남긴다. |

PR #729 검증 결과: `npm run test:all` 318 files / 2,508 passed / 1 skipped,
`npm run lint` 통과, `npm run build` 통과, Playwright E2E 21 passed. 원격 PR의
Railway·browser-quality·validate도 통과했다.

### 2026-08-25 · 2차 수정

- 기준 커밋: `7a9a63c3` (PR #731 squash merge)
- 범위: 남은 U1·U2·U3·U5·U7·U9·U10·U11의 공용 진입 경로 보완과 R1·R3·R4·R5·R6·R7 회귀 고정
- 검증: `npm run test:all` 318 files / 2,503 passed / 1 skipped, `npm run lint`,
  `npm run build`, Playwright E2E 21 passed. PR 원격 `validate`·`browser-quality`·Railway도 통과했다.

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| U1 | 해결 (PR #731) | 실제 CSV 결과의 `ResultActionCard`에 `/weekly-review` 진입 링크를 두고, 소비처 0인 `ToolAssistRail`과 자체 스모크를 제거했다. 데모는 계속 제외한다. |
| U2 | 해결 (PR #731) | 서로 다른 그룹만 상단에 오는 경로는 대상 CSV 템플릿 카드를 먼저 보이고 직접 이동 카드는 하나만 남긴다. 이전의 57개 링크·41개 다른 그룹이라는 데이터 grain 자체는 유지되며, 이를 “같은 CSV”라고 위장하지 않는다. 전수 파생 스모크가 이 상단 계약을 고정한다. |
| U3 | 해결 (PR #731) | `prepareCsvParseInput`이 파일 크기·빈 파일 차단과 CP949 복원을 공용/자체 업로드에 함께 적용한다. 감사 대상 자체 CSV 경로 6곳은 소스 커버리지 테스트로 고정했다. |
| U5 | 해결 (PR #731) | `CsvUploader`의 분석 확인은 오버레이를 먼저 렌더한 뒤 double rAF 후 그룹 게이트를 연다. 따라서 공용 업로더를 쓰는 5-3·5-21·9-6 등 무거운 도구가 같은 피드백 계약을 공유한다. |
| U7 | 해결 (PR #731) | `5-18-trend`·`paid-organic`·`cannibal`·`forecast`의 최소 행·기간 계약을 추가해 카탈로그 19개와 도구 게이트 19개의 차집합을 0으로 만들었다. |
| U9 | 해결 (PR #731) | 5-27과 5-18-paid-organic이 실제 데이터 결과에서만 보수적인 `decisionPrefill`을 제공한다. 결과 카드의 주간 검토 링크와 함께 다음 주 검토 루프가 열린다. |
| U10 | 해결 (PR #731) | 소비처 0인 `AnalysisEligibilityList`와 자체 스모크를 제거했다. 화면에 도달하지 않던 11개 카피를 살아 있는 기능으로 오인하지 않게 한다. |
| U11 | 해결 (PR #731) | `ToolIntro`에 5-28 KR/EN 소개를 추가하고 렌더 스모크로 고정했다. |

이번 수정은 정적·E2E 경로 계약을 복구한 것이다. U2의 실제 재업로드 이탈률, U5의
행 수별 대기 시간, U1/U9의 4주 재방문 효과는 아래 측정 항목의 데이터가 쌓이기 전에는
추정하지 않는다.

---

## 6. 우선순위 백로그

우선순위는 `(사용자 영향 × 심각도) ÷ 난이도`다. 이 표는 전부를 한 번에 고치려는
계획이 아니라 다음 실행 후보만 둔다.

| 순위 | 항목 | 난이도 | 상태 |
| --- | --- | --- | --- |
| 1 | U4 `/start`에 실제 `eligibleIds` 배선 | S | 해결 (PR #729) |
| 2 | U8 5-18 서브도구 업로드 가이드 파생·누락 방지 | S | 해결 (PR #729) |
| 3 | U6 두 핸드오프의 분석 완료 상태 정합 | S | 해결 (PR #729) |
| 4 | U1 판단 지점에 결정 검토 진입점 복구 | M | 해결 (PR #731) — 실제 결과 카드의 주간 검토 링크로 통합 |
| 5 | U2 상단 재업로드 두 장을 템플릿 준비 경로로 교체하고 R1 테스트화 | M | 해결 (PR #731) — 다른 그룹 링크 자체는 정직하게 유지 |
| 6 | U3 자체 드롭존 6경로를 공용 파일 가드 경유로 전환 | M | 해결 (PR #731) |
| 7 | U5 무거운 도구에 오버레이·double rAF 디퍼 적용 | L | 해결 (PR #731) — 공용 업로더 게이트에서 적용 |
| 8 | U7 자격 계약 커버리지 정합 | M | 해결 (PR #731) — 카탈로그·게이트 차집합 0 |
| 9 | U9 결정 기록과 U11 소개 문단 누락 해소 | S | 해결 (PR #731) |
| — | U10 죽은 `AnalysisEligibilityList` 처리 | S | 해결 (PR #731) — 소비처 없는 코드 제거 |

---

## 7. 측정으로 승격해야 할 것

정적 감사만으로 효과를 단정하지 않는다. 다음 측정이 쌓이기 전에는 “이 수정이
전환을 올린다”는 결론을 내리지 않는다.

| 질문 | 필요한 데이터 | 단계 |
| --- | --- | --- |
| 업로드 후 실제 분석 시작 비율 | GA4 `data_import_* → analysis_started` 퍼널 | S2~S4 |
| 다음 단계 클릭률과 재업로드 화면 이탈률 | `tool_connection_pick`의 `data_continuity` 분해 | S6 |
| U5의 실제 멈춤 시간 | 실기기 프로파일링(행 수 × 도구) | S4 |
| 결정 기록 사용자의 4주 재방문율 | GA4 재방문 + 결정 기록 이벤트 | S7 |
| 새로고침으로 CSV를 잃는 사람의 비율 | 세션당 업로드 횟수 분포 | S2 |

CSV 비영속은 클라이언트 전용 원칙에 따른 결정이다. 이 감사는 서버 저장을 처방하지
않는다. 대신 매핑 기억·시트 재조회처럼 재업로드 비용을 어떻게 줄이는지 J6에서
검토한다.

---

## 8. 이번 감사의 범위 밖

- 수학 엔진의 정확성: 골든 테스트가 오라클이며 이 여정 감사의 대상이 아니다.
- `docs/automateaudit.md`가 이미 다루는 콘텐츠·SEO·구조화 데이터.
- 실기기 모바일, 라이브 브라우저의 전체 경로, GA4 실데이터: 확보 전에는 추론으로만
  기록한다.
- 감사 항목의 구현: 별도 PR에서 수행하고 이 문서에는 결과만 반영한다.

과거 수치는 해당 실행 시점의 커밋에 묶인다. 이후 감사는 기존 로그를 고치지 않고
§5 아래에 새 로그를 이어 붙인다.
