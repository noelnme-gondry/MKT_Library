# 머지 감사 — 2026-08-27 (#760~#769)

> **범위**: 2026-08-26 21:44 ~ 2026-08-27 06:51 사이 `main`에 머지된 10건(`c0efec0..91445e5`).
> PR 본문의 주장을 diff 전체와 대조하고, 회귀·정직성(§8)·사생활 계약을 검증했다(§6.2).
>
> **성격**: 감사 기록. 코드 변경은 포함하지 않는다. 각 항목은 `파일:줄 → 기대 → 실제` 형태로 재현 가능하다.
>
> **검증(실제 실행)**: `npm run test:all` **340파일 · 2732 통과**(1 skipped) · `npm run lint` **0 errors/0 warnings** ·
> `npm run build` ✓. 셋 다 이 감사 환경에서 직접 돌렸다.
> → `AGENTS.md` §16의 "328파일·2670"은 낡은 수치다.

---

## 0. 대상 커밋

| 커밋 | PR | 제목 | 규모 |
|---|---|---|---|
| `c0efec0` | #760 | 로컬 저장·접근성 감사 후속을 반영 | 55파일 +1265/−418 |
| `1e5acfd` | #761 | 데이터 연속성과 도치 결과함을 정리 | 8파일 +248/−98 |
| `347cdc7` | #762 | 업로드 후속 판단을 안내한다 | 5파일 +221/−2 |
| `37c35f8` | #763 | 주간 보고서 XLSX를 제공한다 | 4파일 +105 |
| `f00ddb8` | #764 | A/B 중간 판독 계획을 추가한다 | 4파일 +94 |
| `6021517` | #765 | 도치 복귀와 구독 접점을 강화한다 | 8파일 +65/−7 |
| `1d3ab1a` | #766 | 차트 이벤트 주석을 공통화 | 9파일 +54/−57 |
| `e336544` | #767 | MMM 컨트롤 입력 계약 완성 | 15파일 +240/−8 |
| `e538959` | #768 | 저장 분석 복귀 흐름 연결 | 7파일 +124/−4 |
| `91445e5` | #769 | 저장 복귀 실패 경로 차단 | 3파일 +48/−2 |

## 0.1 요약

| # | 심각도 | PR | 항목 | 규모 |
|---|---|---|---|---|
| 1 | **P0** | #760 | 도구 화면 "CSV 지우기"가 IndexedDB 원본을 안 지운다 → 새로고침 시 부활 | 삭제 소비처 1곳뿐 |
| 2 | **P1** | #760 | 동의 토글 라벨이 실제 저장 범위와 불일치 + 기본값 OFF→ON | KO/EN 각 2문장 |
| 3 | **P1** | #762 | 업로드 후속 안내가 프로덕션에서 도달 불가(스모크만 통과) | 필터 1줄 |
| 4 | **P1** | #764 | O'Brien–Fleming 경계가 α를 초과(0.059@4회 · 0.063@6회) | 상수 1개 + 골든 1건 |
| 5 | P2 | #766 | 이벤트 종류 7종 중 4종이 차트 색으로 구분 불가 | 색 매핑 2쌍 |
| 6 | P2 | #767 | 소스 문자열 검사 테스트 + `ds/DataTable` 미사용 | 테스트 1 · 표 1 |
| 7 | P2 | #763 | XLSX 내보내기 실패가 조용함(catch 없음) | 1함수 |
| 8 | P3 | #760 | `workspace-storage` 에러 경로에서 `db.close()` 누락 | 6함수 |
| 9 | P3 | #760 | 만료가 `lastUsedAt` 슬라이딩 — "최대 90일" 카피와 불일치 | 카피 계약 |
| 10 | P3 | #760 | 새 인라인 hex 가드의 사각(현재 위반 0건) | 가드 1개 |

---

## 1. P0 — "지우기"가 지우지 않는다 (#760)

**파일**: `v2-migration/src/store/useDataStore.js:1023` (`clearCsvGroup`)

`clearCsvGroup`은 메모리 슬라이스·게이트·findings만 비우고 **IndexedDB에는 손대지 않는다**.
IndexedDB 삭제 소비처는 `/storage` 페이지 한 곳뿐이다.

```
$ grep -rn "removeWorkspaceDataset\|clearWorkspaceDatasets" src/ | grep -v "lib/workspace-storage"
  src/components/WorkspaceStoragePage.jsx:85,86   ← 유일한 삭제 진입점
  src/store/useDataStore.js:684,908,910,927,929
```

**재현**
1. 효율 CSV 업로드(기본 설정이면 IndexedDB에 저장됨)
2. 헤더 또는 업로더의 `⟳ CSV 변경` 클릭 → 화면이 빈 상태로 돌아감
3. 새로고침 → `RootDocument.jsx:39`의 `WorkspaceStorageBootstrap`이 `restoreWorkspaceDatasets()`를 실행
4. **같은 파일이 다시 로드된다**

**기대**: 사용자가 지운 데이터는 지워진 채로 남는다.
**실제**: 되살아난다. `csvClearedByGroup[group]=true`도 `persistPartialize` 대상이 아니라 억제도 못 한다
(`useDataStore.js:555~` allowlist에 없음).

사내 민감 자료를 "지웠다"고 믿은 상태에서 파일이 부활하므로 §2.2(클라이언트 사이드 100%)의 취지와
`/storage`가 약속한 삭제 통제에 정면으로 걸린다.

**수정 방향**: `clearCsvGroup`이 해당 그룹의 `removeWorkspaceDataset(g)`를 함께 호출하거나,
"화면만 비우기 / 이 기기에서도 지우기"를 명시적으로 가른다(후자는 §2.7 대상 — 선택지 2개).

---

## 2. P1 — 동의 라벨이 실제 저장 범위를 말하지 않는다 (#760, §8)

**파일**: `v2-migration/src/components/ds/DecisionReview.jsx` (KO/EN 각 `persistence`·`persistenceHint`)

같은 PR에서 `privacySaved` 문장은 "결정 요약과 직접 올린 원본 파일을 …최대 90일 저장 중"으로 고쳤는데,
**스위치 본체의 라벨과 설명은 안 고쳤다.**

| 항목 | 현재 문구 | 실제 동작 |
|---|---|---|
| 라벨(KO) | `이 기기에 결정 요약 저장` | 원본 CSV·XLSX **파일**까지 저장 |
| 라벨(EN) | `Keep decision summaries on this device` | 동일 |
| 힌트(KO) | `…채널·캠페인·소재·행동·분석 요소명과 요약 수치가 기록에 남습니다` | 원본 파일 저장 언급 0 |
| 힌트(EN) | `Channel, campaign, creative … remain in the record` | 동일 |

추가로 `useDataStore.js`에서 `decisionPersistenceEnabled: false → true`로 **기본값이 뒤집혔다**.

- 신규 설치: 아무것도 묻지 않은 상태에서 원본 파일이 IndexedDB에 저장된다.
- v1~v3 기존 사용자: `persistMigrate`가 보수적으로 OFF 유지 — **이 처리는 정확하다**(거절/미선택 구별 불가 문제를
  `decisionPersistencePreferenceSet`으로 인지하고 있음).
- **v2에서 "결정 요약"에만 명시 동의한 사용자**: 플래그가 그대로 `true`라 재동의 없이 원본 파일 저장까지 승격된다.
  플래그 하나가 두 개의 다른 동의를 겸하고 있는 것이 근본 원인이다.

`/storage`의 토글 라벨(`이 기기에 저장하기` + "올린 파일과 결정 기록을 90일 동안")과 개인정보 처리방침은
이미 정확하다 — **어긋난 곳은 `/weekly-review`의 토글 하나**다.

**수정 방향**: 라벨·힌트를 `/storage` 문구와 같은 SSOT에서 가져오거나(§12.29 브랜드 사실 패턴),
동의를 둘로 분리한다(요약 저장 ↔ 원본 파일 저장).

---

## 3. P1 — #762 업로드 후속 안내가 절대 뜨지 않는다

**파일**: `v2-migration/src/components/StartGate.jsx:126`

```js
// 쓰기 — DecisionReview.jsx:331
datasetSnapshot: serializeDatasetContinuitySnapshot(...)   // → JSON 문자열

// 읽기 — StartGate.jsx:126
.filter((record) => record.datasetSnapshot?.dataGroup === group)   // 문자열의 .dataGroup = undefined
```

`previousRecord`가 항상 `undefined` → `continuity === null` → `DecisionDataUpdateGuide`는
`shouldShowDecisionDataUpdateGuide(null) === false`로 **한 번도 렌더되지 않는다**.
PR이 추가한 126줄짜리 안내 컴포넌트와 KO/EN 카피 전체가 도달 불가다.

`classifyDatasetContinuity`는 문자열을 받아 `readDatasetContinuitySnapshot`으로 파싱하므로
**문제는 필터 한 줄뿐**이고, `WeeklyReview.jsx:356`(문자열을 그대로 넘김)은 정상 동작한다.

**스모크가 통과한 이유** — 테스트가 프로덕션이 만들지 않는 모양을 시딩한다:

```js
// StartGate.smoke.test.jsx (#762)
const datasetSnapshot = buildDatasetContinuitySnapshot(...);   // 객체 (serialize 안 거침)
decisionRecords: [{ id: "decision-1", toolId: "5-2", datasetSnapshot, ... }]
```

§7의 "데모 픽스처가 표준키를 헤더로 쓰면 자동매핑은 검사된 적이 없다"와 같은 클래스다 —
**자기가 만든 모양으로만 검사하면 실사용 실패는 영원히 안 보인다.**

**재현**(임시 vitest, 실행 후 삭제함)
```js
const stored = serializeDatasetContinuitySnapshot(buildDatasetContinuitySnapshot(
  { records: [{ date: "2026-08-01", metrics: { cost: 100 } }] },
  { dataGroup: "efficiency", mapping: { Date: "date" } },
));
typeof stored              // "string"
stored?.dataGroup          // undefined   ← StartGate 필터가 읽는 값
sanitizeDecisionReviewRecords([{ ..., datasetSnapshot: stored }])[0].datasetSnapshot
                           // "string"    ← 저장·복원 후에도 문자열
```

**수정 방향**: 필터를 `readDatasetContinuitySnapshot(record.datasetSnapshot)?.dataGroup === group`로 바꾸고,
스모크 픽스처를 `serializeDatasetContinuitySnapshot`을 거친 값으로 교체한다(둘 다 고쳐야 가드가 가드가 된다).

---

## 4. P1 — 순차검정 경계가 α를 지키지 않는다 (#764, §8)

**파일**: `v2-migration/src/utils/sequentialTest.js`

```js
const terminalZ = STATS.normalInverse(1 - safeAlpha / 2);   // = 1.95996
const boundaryZ = terminalZ / Math.sqrt(informationFraction);
```

canonical O'Brien–Fleming은 `Z_k ≥ c_K / √t_k`에서 **`c_K`를 K별로 α에 맞춰 푼다**.
단일 검정의 `z_{1-α/2}`를 그대로 c로 쓰면 최종 경계가 정확히 1.96이 되고, 앞선 판독에서 쓴 α만큼
전체 유의수준이 초과된다.

OBF 경계는 부분합 스케일에서 상수(`|Z_k| ≥ c/√t_k ⟺ |S(t_k)| ≥ c`)이므로 실제 α를 수치적분으로 계산했다
(격자 h=0.002, 브라운 운동 증분 합성):

| 사전 계획 판독 횟수 | 실제 양측 α | 명목 초과 |
|---|---|---|
| 2회 | 0.0523 | +4.6% |
| 4회 | **0.0588** | +17.6% |
| 6회 | **0.0632** | +26.4% |
| *(검산)* canonical `c=2.0243`, 4회 | 0.0499 ✓ | — |

명목 p 경계도 전부 느슨하다 — 4회 기준 **0.0001 / 0.0056 / 0.0236 / 0.0500**
(표준표: 0.00005 / 0.0042 / 0.0184 / **0.0412**).

화면은 이 표를 "사전 계획한 판독 횟수"에 대한 α=0.05 계획으로 제시하므로, 사용자가 계획대로 따라도
1종 오류가 선언한 값보다 크다. §8.6(입증책임 비대칭)·§8.11(근사가 못 미더우면 판정 기준을 옮길 것)에 걸린다.

**가드가 오류를 고정하고 있다** — `sequentialTest.test.js`:
```js
expect(plan.at(-1).nominalP).toBeCloseTo(0.05, 5);   // 정확히 이 값이 버그다
```
§7 "tolerance가 버그를 지키고 있었다"의 재발이다.

**수정 방향(택1)**
- (a) `c_K`를 K·α별로 수치해로 구한다(위 적분에 이분탐색 — 결정론적, `Math.random` 불필요). 골든은
  표준표 값(K=4 → 4.048/2.862/2.337/2.024)으로 다시 박는다.
- (b) 상수를 유지하되 화면이 "α를 정확히 소비하지 않는 보수적 안내"임을 명시하고 실제 α를 함께 표시한다.

---

## 5. P2 — 이벤트 종류를 차트가 구분하지 못한다 (#766)

**파일**: `v2-migration/src/utils/chartEventMarkers.js:14` (`eventMarkerColor`)

PR이 종류 선택기(`EVENT_TYPES` 7종)를 새로 붙였는데 색 매핑은 5색뿐이다.

| 종류 | 색 | 충돌 |
|---|---|---|
| `listing` | `CHART_THEME.primary` | ← **#766이 새로 추가한 줄** |
| `creative` | `CHART_THEME.primary` | 위와 **완전히 동일** |
| `price` | `CHART_THEME.success` `#65d3b3` | |
| `release` | `CHART_THEME.secondary` `#77dcaa` | 위와 **거의 같은 녹색** |

7종 중 4종이 사실상 2색이다. §7 "부호 구분 색쌍은 명도차 크게 — 중간톤끼리는 구분 안 됨"이 그대로 적용된다.
마커 목록의 `<small>` 텍스트로는 읽히므로 P2로 둔다.

**수정 방향**: `CHART_THEME`에 종류 수만큼의 구분 가능한 getter를 두거나, 색 + 선 패턴(dash 배열)을 함께 가른다.

---

## 6. P2 — 소스 문자열 검사 · DS 계약 이탈 (#767)

**파일**: `v2-migration/src/app/mmmResultWorkflow.test.js:59`
```js
expect(marketingResponse).toContain("mmmControlFitRows(mmm.panel, mmm.run)");
```
호출식 문자열이 소스에 있는지만 본다 — 인자를 바꾸면 잡지만 **동작은 하나도 지키지 않는다**.
§16 "소스를 문자열 포함으로 검사하면 자기 설명 주석에 속는다"와 같은 계열이다.

**파일**: `v2-migration/src/components/tools/MarketingResponse.jsx:5117~`
새 컨트롤 상태 표가 `ds/DataTable` 대신 `<table className="data">` 직접 사용 — §12.21 ③ 이탈.
(인라인 `fontSize: "11.5px"`는 §12.30 하한 9.5px 위이므로 문제 없음.)

**엔진 변경은 안전** — `mmmMath.js`/`mmmMathPr416.js` 변경은 `droppedFeatures` 노출과 진단 문구 추가뿐이고
수학은 손대지 않았다(§11 준수). `controls.dropped`는 랭크 결손이 있을 때만 생기는 필드라 `|| []` 폴백도 맞다.

---

## 7. P2 — XLSX 내보내기 실패가 조용하다 (#763)

**파일**: `v2-migration/src/components/WeeklyReport.jsx` (`downloadWorkbook`)
`try { ... } finally { setIsWorkbookExporting(false) }` — **catch가 없다**.
`xlsx` 동적 import 실패나 `XLSX.write` 예외 시 버튼만 원래대로 돌아가고 사용자는 아무 안내도 못 받는다
(unhandled rejection). Markdown 다운로드는 동기라 이 경로가 없었다.

**엔진 자체는 잘 만들었다** — `reportWorkbook.js`의 `safeCell()`이 모든 값을 `{ t: "s" }`로 강제해
Excel 수식 승격을 막고, 테스트가 `=Do not evaluate`와 원본 행 미포함(`not.toContain("never")`)을 함께 단언한다.

---

## 8~10. P3 (기록용)

- **`db.close()` 누락** — `lib/workspace-storage/datasets.js`의 6개 함수 모두 성공 경로에서만 `close()`한다.
  트랜잭션이 reject되면 커넥션이 열린 채 남아 향후 `WORKSPACE_DB_VERSION` 상향이 `blocked`될 수 있다.
- **만료 기준** — `readWorkspaceDataset`이 매 복원마다 `lastUsedAt`을 갱신하므로 계속 쓰는 데이터는 무기한 보관된다.
  "미사용 90일"로 읽으면 정합하지만 개인정보 처리방침의 "최대 90일 보관" 문장과는 어긋난다. 둘 중 하나를 맞출 것.
- **새 인라인 hex 가드의 사각** — `app/themeContrast.test.js`는 `color|background|borderColor|backgroundColor`
  4개 프로퍼티 · 큰따옴표 리터럴 · `src/components`만 훑는다. `border: "1px solid #hex"`·`boxShadow`·
  `fill`/`stroke`·`src/app`은 통과한다. **현재 위반 0건**(실측)이라 실해는 없고, 다음 위반을 못 잡을 뿐이다.

---

## 11. 검증했고 문제 없던 것

훑어보면 위험해 보이지만 실제로는 정확한 자리들 — 다음 감사에서 중복 조사하지 않도록 남긴다.

| 항목 | 확인 결과 |
|---|---|
| `workspaceSource` 커버리지 | 파일을 읽는 `setCsvData` 호출부 7곳 **전부** Blob을 넘긴다(누락 0). |
| `persistMigrate` v1/v2~v3 분기 | v1을 동의로 오독하지 않고, "거절 vs 미선택" 구별 불가를 인지해 보수적 OFF. 정확하다. |
| 데모 데이터 저장 | 데모 경로는 `workspaceSource`를 안 넘기므로 IndexedDB에 안 들어간다(`demo_` 접두 가드는 이중 안전장치). |
| `dataContinuity` 저장 내용 | 원본 행·헤더·지표값 없이 날짜 범위 + FNV-1a 지문만. 테스트가 값 미포함을 단언한다. |
| `/storage` SEO | `publication:"preview"` → `isRouteIndexable` false. sitemap 미포함. |
| `restoreWorkspaceDatasets` 덮어쓰기 | 현재 세션에서 이미 올린 슬라이스는 덮지 않는다(`raw.length` 확인). |
| `restore` 후 분석 게이트 | `analyzedByGroup`을 건드리지 않아 사용자가 다시 `분석하기`를 눌러야 한다(정직). |
| `themeContrast` 토큰 파싱 | `:root`가 파일에 여러 번 나오는 것을 `matchAll` 누적으로 처리 — §7 "마지막 정의를 볼 것"을 지켰다. |
| #765 NewsletterSignup | 제품 화면에 붙었지만 `metadata__marketing_consent[required]` 유지, 태그만 `source`별로 분리. |
| #768/#769 복귀 실패 경로 | 복원 실패 시 라우팅하지 않고 `state:"failed"` 계측 후 화면 유지. 정확하다. |

---

## 12. 다음 작업 옵션

1·2·3·4는 원인이 서로 독립이라 따로 고칠 수 있다.

- **(A)** 1·2 — 사생활 계약 정합(삭제 연동 + 라벨/기본값). 가장 급하다.
- **(B)** A + 3 — 죽은 기능 살리기(필터 1줄 + 스모크 픽스처 교체).
- **(C)** B + 4 — 통계 경계 교정(수치해 + 골든 재작성). 별도 PR 권장.
- **(D)** 5~7 정리.

수정에 착수하면 §7·§12에 재사용 가능한 교훈을 함께 기록한다(§15):
① "쓰기는 직렬화, 읽기는 객체" 비대칭 ② 픽스처가 프로덕션 모양과 다르면 스모크는 아무것도 안 지킨다
③ 동의 플래그 하나가 두 종류의 데이터를 통제하면 라벨은 반드시 낡는다.
