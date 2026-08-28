# 수정 감사 — 2026-08-27 (#771~#774)

> **범위**: `docs/merge-audit-2026-08-27.md`(#760~#769 감사)의 후속 수정 4건. 기준 `3ad720d`(= #774, 현재 `main` HEAD).
> 커밋 범위 `10c3ba3..3ad720d`.
>
> **성격**: 수정이 실제로 그 결함을 없앴는지 **재현으로** 검증한다(§6.2). 코드 변경은 포함하지 않는다.
>
> **후속(2026-08-27, #775 `d98b177`)**: 아래 지적 10건이 **전부 해소됐다**. 재검증 결과는 §13에 있다.
> 본문 §1~§10은 지적 당시 상태를 그대로 남긴다(수정 전후 대조용).
>
> **검증(실제 실행)**: `test:all` **344파일 · 2747 통과**(1 skipped) · `lint` **0** · `build` ✓.
> 통계·색·저장 동작은 테스트 통과와 별개로 **독립 재현**했다(아래 각 항목).

---

## 0. 요청 6개 항목 판정

| # | 확인 요청 | 판정 | 근거 |
|---|---|---|---|
| 1 | 저장 삭제 후 새로고침해도 부활 안 하는가 | ⚠️ **절반만** | 공용 경로 ✅ / 도구 4곳 ❌ (§1) |
| 2 | 구 동의 사용자의 원본이 자동 저장 안 되는가 | ✅ **해결** (단 부작용 1건) | §2 |
| 3 | OBF 실제 전체 α가 0.05인가 | ✅ **해결** | 독립 적분 0.04999 (§3) |
| 4 | XLSX 실패 후 안내·재시도 가능한가 | ✅ **해결** (스타일 1건) | §4 |
| 5 | MMM 컨트롤 상태가 실제 계산대로 표시되는가 | ❌ **아니다** | 3상태 중 1개가 도달 불가 (§5) |
| 6 | 이벤트 7종이 색+선 패턴으로 구분되는가 | ⚠️ **선 패턴만** | 색은 2쌍이 동일 수준 (§6) |

### 새로 발견 (요청 밖)

| # | 심각도 | 항목 |
|---|---|---|
| 7 | **P1** | `decisionPersistencePreferenceSet` 소비처 0곳 — 재동의 안내 장치가 없다 |
| 8 | P2 | 구 동의 사용자의 결정 기록이 안내 없이 소실된다 |
| 9 | P3 | `openWorkspaceDb`에 `onblocked` 없음 — 이제 삭제가 이걸 await 한다 |
| 10 | P3 | 소스 문자열 검사 테스트가 제거되지 않고 이동만 했다 |

---

## 1. ⚠️ 저장 삭제 — 공용 경로는 고쳐졌고, 도구 4곳이 남았다

**고쳐진 것**: `clearCsvGroup`이 `removeWorkspaceDataset(g)`를 await 한 뒤 슬라이스를 비운다.
`Header`(⟳ CSV 변경)·`CsvUploader`(초기화)·`DemoNoticeModal`이 전부 이 경로다. **여기까지는 정확하다.**

**남은 것**: 도구 4곳이 `clearCsvGroup`을 **거치지 않고** 빈 슬라이스를 직접 쓴다.

| 파일:줄 | 버튼 | 그룹 | 원본 저장? |
|---|---|---|---|
| `tools/AhaMomentFinder.jsx:478` | ⟳ CSV 변경 | `aha` | ✅ 저장함 |
| `tools/Incrementality.jsx:159` | ⟳ CSV 변경 | `incrementality` | ✅ 저장함 |
| `tools/ContentElementAnalyzer.jsx:323` | ⟳ CSV 변경 | `content_*` | ✅ 저장함 |
| `tools/BrandCampaignIncrementality.jsx:288` | CSV 변경 (인라인) | `brand_incrementality` | ✅ 저장함 |

넷 다 `setCsvData({ raw: [], headers: [], mapping: {}, fileName: "" })`만 호출한다.
**원본을 IndexedDB에 저장하는 도구는 6개인데 그중 4개가 삭제 계약 밖에 있다.**

**재현**(임시 vitest, 실행 후 삭제)
```
A-1 clearCsvGroup()            → removeWorkspaceDataset("aha") 호출됨      ✅
A-2 setCsvData(빈 슬라이스)     → removeWorkspaceDataset 호출 안 됨         ❌
C   다음 로드에서 restoreWorkspaceDatasets()
    → csvGroups.aha.fileName === "secret.csv" (부활)                       ❌
```
5-20에서 "⟳ CSV 변경"을 누르고 새로고침하면 **원본이 그대로 돌아온다**. #760의 P0가 이 4개 도구에서는 그대로다.

**수정 방향**: 네 곳을 `clearCsvGroup()`으로 통일하고, "빈 슬라이스 직접 쓰기"를 금지하는 파생 가드를 둔다
(§7 "한 곳만 고치면 교훈이 기록됐다는 사실이 남은 구멍을 가린다" — 같은 세션에서 재발했다).

---

## 2. ✅ 구 동의 사용자 — 소급 저장 없음 (부작용 1건)

`persistMigrate`에 `needsExpandedStorageConsent`(v2~v4 && enabled===true) 분기가 추가돼
기존 ON을 OFF로 내리고 `preferenceSet:false`로 되돌린다.

**재현**
```
persistMigrate({decisionPersistenceEnabled:true, decisionRecords:[…]}, 4)
  → decisionPersistenceEnabled: false          ✅
setCsvData({… workspaceSource:{blob} })
  → saveWorkspaceDataset 호출 안 됨             ✅
```
토글 라벨·힌트도 KR/EN 4곳 모두 "원본 파일과 결정 기록을 이 기기에 저장"으로 정정됐다. **정확하다.**

**부작용(§8, P2)** — 같은 재현에서:
```
migrated.decisionRecords.length === 1        ← 이번 세션엔 보인다
persistPartialize({...migrated}).decisionRecords === undefined   ← 다음 저장에서 소실
```
`persistPartialize`가 `enabled===true`일 때만 기록을 쓰므로, 기존 사용자의 결정 기록은 다음 persist에서 사라진다.
주석은 이를 의도라고 밝히지만 **사용자에게는 아무 안내가 없다** — 보이던 기록이 재방문 시 조용히 없어진다.

---

## 3. ✅ OBF 전체 α = 0.05 (독립 검증)

`obfBoundaryConstant(α, K)`가 생존확률 적분 + 이분탐색으로 `c_K`를 푼다. 캐시·결정론 모두 만족(§8.3).

배포 코드와 **다른 구적법**(Simpson, 2001점)으로 재계산:

| K | 배포 c | 실제 α | 표준표 |
|---|---|---|---|
| 2 | 1.9775 | **0.04999** | 1.978 ✓ |
| 4 | 2.0244 | **0.04999** | 2.024 ✓ |
| 6 | 2.0529 | **0.04999** | 2.053 ✓ |
| 12 | 2.0977 | 0.04998 | — |

격자 편차도 확인했다 — 배포 격자(241점)가 내는 `c`와 정확한 `c`의 차는 **5e-5 ~ 1.4e-4**로 α에 영향이 없다.
구 상수의 회귀값(0.0522 / 0.0586 / 0.0630)도 같은 코드로 재현돼, 검증 방법 자체가 맞다는 것도 확인된다.
골든도 `nominalP ≈ 0.05` 단언을 버리고 표준 경계값 4개를 박았다. **완전히 해결됐다.**

**P3 관찰**: `obfBoundaryConstant` 1회는 Node에서 **약 114ms**(24회 적분 × 241²). `<select>` 기반이라 조합 수가 적고
캐시가 있어 실사용 영향은 작지만, 첫 선택 시 메인 스레드에서 한 번 돈다(§7 "무거운 compute를 useMemo에").
`boundaryCache`는 상한이 없다 — 지금은 무해하나 α가 자유 입력이 되면 누수다.

---

## 4. ✅ XLSX 실패 안내·재시도

`catch → setWorkbookError(t.workbookError)` + `role="alert"` + `finally`로 버튼 재활성.
스모크가 `mockRejectedValueOnce`로 실패를 만들고 **알림 문구와 버튼 재활성을 함께** 단언한다. 정확하다.

**P3**: `.weekly-report-page__export-error`는 `globals.css`에 **정의가 0건**이다(형제인
`.workspace-storage-page__error`는 2건). 문구는 보이지만 오류로 보이지 않는다 — 색·간격이 없다.

---

## 5. ❌ MMM 컨트롤 상태 — 3상태 중 1개가 프로덕션에서 도달 불가

표를 `ds/DataTable` 기반 `MmmControlFitTable`로 옮긴 것은 §12.21 ③에 맞다. 렌더 스모크도 실제
`mmmControlFitRows` 계산을 통과시킨다. **그러나 계산 자체가 한 상태를 만들지 못한다.**

```js
// mmmMath.js:3548 — 랭크 결손 정보를 여기서 버린다
function _mmmBayesControlFeatures(panel, cfg) {
  const built = mmmBuildFeatures(panel, cfg, 0, cfg.includeTrend !== false);
  const keep = built.names.map((n, i) => (!n.startsWith("ln_") ? i : -1)).filter((i) => i >= 0);
  return { names: …, X: …, externalTransforms: built.externalTransforms || {} };
  //                                    ↑ built.dropped 를 넘기지 않는다
}

// mmmMath.js:5886 — 그래서 이 값은 항상 []
droppedFeatures: controls.dropped || [],
```

체인: `MarketingResponse` → `mmmBayesianLikeRun`(6825) → `mmmBayesianRun`(5256) → `controls`(5399) → 5886.

**재현**(완전공선 컨트롤 2개를 넣은 패널, 실행 후 삭제)
```
built.dropped        = [ 'industry_mirror_index' ]      ← 엔진은 정확히 안다
run.droppedFeatures  = []                                ← 전달이 끊긴다
rows                 = market_index:included | mirror_index:not-used
```
→ 화면에 **"적합에 사용되지 않음"**으로 뜬다. 정답은 **"독립 변화 부족으로 제외"**다.
식별 실패를 "안 썼음"으로 바꿔 말하는 방향이라 §7("계산 불가를 좋은 등급으로 접지 말 것")·§8.6에 걸린다.

**스모크가 못 잡는 이유** — `run`을 손으로 적었다:
```js
const run = { names: ["industry_price"], droppedFeatures: ["industry_holiday"], … };
```
프로덕션이 만들지 않는 모양이다. **#762에서 지적한 "픽스처 모양 ≠ 프로덕션 모양"이 그 감사의 수정 PR에서 그대로 재발했다.**

**수정 방향**: `_mmmBayesControlFeatures`가 `dropped: built.dropped || []`를 함께 반환하고,
스모크를 실제 `mmmBayesianLikeRun` 결과로 바꾼다(합성 공선 패널이면 충분하다).

---

## 6. ⚠️ 이벤트 종류 — 선 패턴은 해결, 색은 2쌍이 그대로다

dash 패턴 7종이 서로 다르게 배정된 것은 정확하고, 색각 차이까지 고려한 옳은 방향이다.
그러나 **색 자체는 여전히 두 쌍이 구분되지 않는다.** `globals.css`의 실효 토큰(마지막 정의)을 파싱해 CIELAB ΔE로 실측:

| 쌍 | 다크 | 라이트 |
|---|---|---|
| `creative`(accent) ↔ `external`(danger) | `#ff8d7e` vs `#ff8178` → **ΔE 6.0** | `#bc3f35` vs `#cf3d3d` → **ΔE 8.1** |
| `price`(success) ↔ `release`(secondary) | `#65d3b3` vs `#77dcaa` → **ΔE 9.9** | `#11866e` vs `#087a4f` → **ΔE 12.7** |

1.5px 점선에서 ΔE 10 미만은 나란히 놓고 봐도 같은 색으로 읽힌다.
게다가 `price [2,2]` ↔ `release [1,3]`은 **패턴도 가장 비슷한 조합**이라, 이 쌍은 두 채널 모두에서 약하다.
직전 감사가 지적한 `price↔release`는 남았고, `creative`를 `accent`로 옮기면서 `external`과 새 충돌이 생겼다.

**가드가 이걸 못 잡는다** — `chartEventMarkers.test.js`:
```js
expect(new Set(styles.map((style) => style.colorRole)).size).toBe(types.length);
```
비교 대상이 **역할 이름 문자열**이라 방금 적은 맵을 그대로 되읽는 항진명제다. 색을 한 번도 해석하지 않으므로
두 역할이 같은 hex로 끝나도 통과한다. §7 "가드가 있다는 사실이 가드가 없다는 사실을 가린다"의 재발이다.

**수정 방향**: 가드를 `CHART_THEME[role]`로 **해석한 뒤** 다크/라이트 양쪽에서 ΔE 하한을 강제한다.
색이 부족하면 `--chart-*` 토큰을 늘리거나, 겹치는 쌍의 패턴 차이를 최대로 벌린다(`[2,2]` ↔ `[10,3,2,3]` 등).

---

## 7. P1 — 만든 플래그를 읽는 곳이 없다

`decisionPersistencePreferenceSet`는 **4곳에서 쓰이고 0곳에서 읽힌다**(프로덕션 기준).

```
쓰기: useDataStore.js:561(partialize) · 599·605·610(migrate) · 691(toggle)
읽기: 없음   (참조는 useDataStore.test.js 4곳뿐)
```

"명시 거절 vs 한 번도 안 물어봄"을 구별하려고 v4에서 도입하고 v5 마이그레이션이 `false`로 되돌리는데,
**그 값을 보고 재동의를 묻는 화면이 없다.** 결과적으로 §2의 마이그레이션은 사용자에게
"저장 범위가 바뀌었으니 다시 선택해 달라"고 말하지 못하고, 기록만 조용히 사라진다(§8).

§16 "플래그·점수를 만들었으면 그것을 읽는 곳을 그 자리에서 배선할 것"이 세 번째로 재발한 자리다
(앞선 둘: `REG_STATS.regularized`, 5-3 채널 신뢰도).

**수정 방향**: `preferenceSet === false && 저장 대상 데이터가 있음`일 때 `/storage`·`/weekly-review`에
1회 안내를 띄우거나, 최소한 마이그레이션이 기록을 지우기 전에 내보내기를 권한다.

---

## 8~10. P2 · P3

- **결정 기록 소실 무고지** — §2 참조.
- **`onblocked` 없음** (`workspace-storage/db.js`) — `indexedDB.open`은 다른 탭이 연결을 쥔 채 버전이 오르면
  `blocked`로 **영원히 settle되지 않는다**. `WORKSPACE_DB_VERSION`이 1로 고정된 지금은 발생하지 않지만,
  #771이 `clearCsvGroup`을 이 open에 **await 시켰기 때문에** 스키마를 한 번이라도 올리는 순간
  "CSV 변경" 버튼이 멈추는 경로가 생긴다. `onblocked` + 타임아웃을 지금 넣는 편이 싸다.
- **문자열 검사 테스트 잔존** — `mmmResultWorkflow.test.js:59`가
  `toContain("mmmControlFitRows(mmm.panel, mmm.run)")` → `toContain("<MmmControlFitTable rows={controlFitRows} locale={locale} />")`로
  **바뀌었을 뿐 제거되지 않았다**. 이제 prop 순서만 바꿔도 깨지고, 동작은 여전히 하나도 안 지킨다
  (실제 검증은 새 `MmmControlFitTable.smoke.test.jsx`가 한다). 문자열 단언은 지우는 게 맞다.

---

## 11. 확인했고 정확한 것

| 항목 | 결과 |
|---|---|
| #772 StartGate 연속성 필터 | `readDatasetContinuitySnapshot(...)` 로 정정 + 픽스처도 `serialize…`로 교체. **완전히 정확하다.** |
| `db.close()` try/finally | 6개 함수 전부 예외 경로에서도 닫힌다. |
| 90일 보관 문구 | "마지막 사용 후 90일"로 KR/EN·SSOT·개인정보방침·brandFacts·guideSearchContent·compareContent까지 **전수 통일**. 잔여 불일치 0건(남은 "최대 90일"은 Apple PPO 설명으로 무관). |
| raw hex 치환 | `#f7b955`·`#e0af68` → `var(--warning)` (4곳). |
| themeContrast 가드 확장 | `.js` 포함 + 속성 8종 + 홑/역따옴표까지. |
| 가드 범위를 `src/components`로 제한 | **옳은 결정이다.** 밖의 hex는 OG 이미지·manifest(서버 렌더라 CSS 변수를 못 읽음)뿐이다. |
| XLSX 수식 인젝션 | `safeCell`의 `t:"s"` 강제 유지. |

**남은 가드 사각(현재 위반 0건)**: 값 패턴이 `["'`]#hex["'`]`라 `border: "1px solid #hex"`는 여전히 통과한다.
components 내 실측 위반은 0건(유일한 매치는 `AnalyzingOverlay`의 `var(--bg-1, #0b0d12)` 폴백으로 정당).

---

## 12. 착수 순서 제안

1. **§5 MMM `dropped` 전달** — 한 줄 + 스모크 교체. 식별 실패를 잘못 말하는 중이라 가장 급하다.
2. **§1 도구 4곳 삭제 경로 통일** — P0의 남은 절반.
3. **§6 색 가드를 해석 기반으로** — 가드부터 고쳐야 색 배정을 안전하게 바꾼다.
4. **§7 `preferenceSet` 배선 또는 제거** — 읽지 않을 플래그면 지우는 것도 답이다.
5. §4 CSS · §10 문자열 테스트 제거 · §9 `onblocked`.

---

## 부록 A. 「레퍼런스 대조 개선 지도」 P1~P12 반영 상태

아티팩트(`레퍼런스 대조 개선 지도`)의 우선순위 12개를 저장소 실측으로 대조했다.
**4개가 이번 배포들로 실제 해결됐고, 5개는 손대지 않았다.**

| # | 항목 | 상태 | 실측 근거 |
|---|---|---|---|
| P1 | 업로드 1회 → 다중 도구 자동 실행 "발견 요약" | 🟡 **대부분 반영** | 도치 워크스페이스(`AssistantWorkspace`·`DochiResultWorkspace`·`DochiAnalysisDock`)가 `dochiAnalysisSession.analyses`로 다중 분석을 돌린다. 다만 **"발견 N건" 형태의 결론 요약 문구는 없다**(`findingsByGroup`은 있으나 요약 카피 미노출). #761이 결과함에서 임베드 도구 뷰를 오히려 걷어냈다 |
| P2 | MMM ↔ 증분 대조 카드 | 🟡 **다른 형태로 반영** | `priorEvidence.experiment` 배선 20곳 + "실험 근거" UI(`MarketingResponse.jsx:5204`). 아티팩트가 권한 ①(사전정보 제약)에 가깝다. ②"MMM 추정 vs 실험 추정" **대조 카드는 없다** |
| P3 | 실험 설계기(MDE·검정력·기간·마켓 선택) | ❌ **미착수** | `geoLift`·`테스트 마켓`·마켓 매칭 관련 코드 0건 |
| P4 | 매체별 export 프리셋 자동 인식 | 🟡 **부분** | `detectDatasetSignature.js` + `storeConsoleMapping.test.js`·`asaSearchTermsMapping.test.js` 존재. Meta·Google Ads·**카카오모먼트·GFA 등 KR 매체 프리셋은 확인되지 않음** |
| P5 | 계산기 8 → 20+ | ❌ **미착수** | `CALCULATOR_ORDER` **정확히 8개** (ltv-cac, break-even-roas, target-cpa, ab-test-sample-size, expected-installs, cpa-roas-converter, required-cvr, budget-pacing) |
| P6 | 합성데이터 방법론 리포트 1편 | ❌ **미착수** | `content/blog`에 synthetic·methodology·합성 관련 글 0건 |
| P7 | "보고 1장" PNG/PDF + 다운로드 출처 표기 | 🟡 **출처만** | 출처: 텍스트 ✅(`withAttribution`) · XLSX ✅(`00_OVERVIEW` 출처 행) · **PNG ❌**(워터마크 없음). 보고 1장은 `window.print()`뿐, PNG/PDF 전용 뷰 없음 |
| P8 | peeking 경고 → 순차검정 | ✅ **완료** | #764 도입 → #773이 α까지 교정(§3). 아티팩트가 "최소한 경고"라고 한 것을 넘어 **경계표까지 제공** |
| P9 | 주간 검토 이메일 리마인더(옵트인) | 🟡 **접점만** | #765가 `NewsletterSignup`을 `/weekly-report`·`/weekly-review`에 배치(`source="product"`). **"검토일 N일 뒤 날짜만 발송"하는 리마인더 로직은 없다** — 일반 뉴스레터 구독이다 |
| P10 | 증상형 진단 랜딩 8~12개 | ❌ **미착수** | `/diagnose`는 **단일 페이지**(`page.js` 1개), 증상 **4개**가 그 안의 선택지로만 존재. 개별 랜딩 URL 0개 |
| P11 | 차트 이벤트 주석 | ✅ **완료** (색 결함 1건) | #766이 공용 플러그인으로 통합, #774가 종류별 dash 추가. 단 §6의 색 충돌 2쌍이 남음 |
| P12 | 컨트롤 변수(프로모션·가격) 지원 | 🟡 **입력은 되나 상태 표시가 틀림** | #767이 연속형 컨트롤 계약·템플릿·진단을 완성. 단 §5의 `dropped` 전달 누락으로 **식별 실패를 잘못 표시** |

**요약**: 이번 4개 PR이 아티팩트에서 실제로 밀어낸 것은 **P8·P11·P12(+P2 일부)** — 전부 "로직·디자인" 축이다.
아티팩트가 임팩트 최상위로 꼽은 **P1(발견 요약 문구)·P3(설계기)·P5(계산기)·P6(방법론 리포트)·P10(증상 랜딩)**,
즉 **유입·진입면 축은 한 칸도 움직이지 않았다.** 아티팩트의 판단("가장 큰 격차는 사전 설계층과 진입면")이
여전히 유효하다.

가장 값싼 미착수 2건:
- **PNG 다운로드 출처 한 줄** — 텍스트·XLSX에는 이미 있고 PNG만 빠졌다. 렌더층 한 줄이다.
- **계산기 확장** — 엔진 재사용이라 편당 비용이 가장 낮다고 아티팩트가 지목했고, 8개 그대로다.

---

## 13. 재검증 — #775 (`d98b177`) 이후

> **검증(실제 실행)**: `test:all` **348파일 · 2757 통과**(1 skipped) · `lint` **0** · `build` ✓.
> §1~§10의 지적을 같은 재현으로 다시 돌리고, 새로 생긴 가드는 **변이 테스트**로 실제 실패 여부를 확인했다.

### 13.1 지적 10건 판정

| § | 지적 | 판정 | 재검증 방법 |
|---|---|---|---|
| 1 | 도구 4곳이 삭제 계약 밖 | ✅ 해소 | 4곳 모두 `clearCsvGroup()` 경유(Brand 인라인 포함). 새 파생 가드 `csvClearContract.test.js` |
| 2·8 | 구 동의 사용자 기록 무고지 소실 | ✅ 해소 | `persistPartialize`가 보존 + `DecisionStorageConsentNotice`가 **CSV 내보내기 먼저** 제공 |
| 4 | XLSX 오류 스타일 없음 | ✅ 해소 | `.weekly-report-page__export-error` 정의됨 |
| 5 | MMM `dropped-collinear` 도달 불가 | ✅ 해소 | 완전공선 패널 → 실제 `mmmBayesianLikeRun` 실행 |
| 6 | 이벤트 색 2쌍 미구분 | ✅ 해소 | ΔE 재측정, 가드가 실제 토큰을 해석 |
| 7 | `preferenceSet` 소비처 0곳 | ✅ 해소 | `DecisionStorageConsentNotice`가 소비, 3화면 마운트 |
| 9 | `onblocked` 없음 | ✅ 해소 | `onblocked` + 5초 타임아웃 + **늦은 success는 `close()`** |
| 10 | 문자열 검사 테스트 잔존 | ✅ 해소 | `mmmResultWorkflow.test.js`에서 제거 |
| 3 P3 | OBF 캐시 무제한 | ✅ 해소 | `OBF_CACHE_LIMIT = 48` + FIFO 축출 |
| 11 P3 | 인라인 hex 가드 복합값 사각 | ✅ 해소 | 정규식이 복합값을 잡고 `var()` 폴백만 제외 |

### 13.2 MMM 컨트롤 — 재현 결과

같은 합성 공선 패널(`market_index`와 그 완전 복제 `mirror_index`)로 실제 적합을 돌렸다:

| | #774 (지적 당시) | #775 (현재) |
|---|---|---|
| `mmmBuildFeatures(...).dropped` | `["industry_mirror_index"]` | `["industry_mirror_index"]` |
| `run.droppedFeatures` | `[]` ❌ | `["industry_mirror_index"]` ✅ |
| 화면 표시 | `not-used`("적합에 사용되지 않음") | **`dropped-collinear`("독립 변화 부족으로 제외")** |

`_mmmBayesControlFeatures`가 `dropped`를 함께 반환하도록 고쳐졌고, 스모크도 손으로 적은 `run` 대신
**실제 `mmmBayesianLikeRun` 결과**를 쓴다(§5가 지적한 "픽스처 모양 ≠ 프로덕션 모양"의 근본 해결).

### 13.3 이벤트 종류 색 — ΔE 재측정

`globals.css` 실효 토큰(마지막 정의)을 파싱해 CIELAB로 전 쌍 재계산했다. 새 토큰 3종
(`--chart-marker-violet`·`--chart-marker-cyan`·`--chart-marker-neutral`)이 다크·라이트 각각 정의됐다.

| | #774 최소 ΔE | #775 최소 ΔE | ΔE<20 쌍 |
|---|---|---|---|
| 다크 | **6.0** (creative↔external) | **39.0** (listing↔creative) | 0건 |
| 라이트 | **8.1** (creative↔external) | **21.8** (listing↔creative) | 0건 |

배경(`--bg-1`) 대비도 다크 7.21~15.46:1 · 라이트 4.26~9.21:1로, 1.5px 선(비텍스트 3:1 기준) 전부 충족한다.

### 13.4 변이 테스트 — 새 가드가 진짜 가드인가

`#762`·`#774`에서 **통과하지만 아무것도 안 지키는 가드**가 두 번 나왔으므로, 이번에는 결함을 되돌려 넣고
가드가 실패하는지 확인했다(전부 원복, 작업트리 깨끗).

| 가드 | 주입한 변이 | 결과 |
|---|---|---|
| `csvClearContract.test.js` | Incrementality를 빈 슬라이스 직접 쓰기로 환원 | **실패함** ✅ |
| `chartEventMarkers.test.js` | creative를 `--danger`로 환원 | **실패함** — `ΔE 0.0` 지목 ✅ |
| `themeContrast.test.js` | `border: "1px solid #facc15"` 주입 | **실패함** ✅ |

세 가드 모두 **결함을 실제로 검출한다.** 특히 색 가드는 역할 이름이 아니라 `globals.css`에서 해석한
토큰 값으로 ΔE를 계산하므로, §6이 지적한 항진명제가 아니다.

### 13.5 새 하드코딩 상수 15개 — 독립 검산

`OBF_PRECOMPUTED`(α 3종 × 판독 5종)가 solver를 건너뛰므로, **배포와 다른 구적법**(Simpson)으로 전수 검산했다.

| α | 판독 2~6회 실제 α 범위 |
|---|---|
| 0.10 | 0.099984 ~ 0.099992 |
| 0.05 | 0.049988 ~ 0.049994 |
| 0.01 | 0.009995 ~ 0.009997 |

**최대 편차 1.58e-5.** 15개 전부 정확하다 — §7 "골든값을 눈으로 채우면 틀린다"에 걸릴 자리였다.

### 13.6 회귀 없음 확인

`persistPartialize`에 추가된 `isPendingExpandedConsent` 분기가 **동의한 적 없는 사용자의 기록을
보존하지 않는지** 마이그레이션 전 경로를 다시 읽었다.

| 사용자 | `enabled` | `preferenceSet` | 기록 |
|---|---|---|---|
| v1(동의 기능 이전) | false | false | `delete` — **보존 안 함** ✅ |
| v2~v4 ON(구 동의) | false | false | 보존 → 재동의 UI 노출 ✅ |
| 명시 거절 | false | **true** | 다음 persist에서 제거 ✅ |
| 신규 설치 | true | false | 정상 저장, 안내 미노출 ✅ |

`DecisionStorageConsentNotice`의 노출 조건도 `!enabled && preferenceSet !== true && records.length > 0`으로,
기록이 있는 마이그레이션 사용자에게만 뜬다(신규 사용자 무해).

### 13.7 남은 것 — P3 1건

**`WORKSPACE_STORAGE_BLOCKED`에 카피가 없다.**

```js
// WorkspaceStoragePage.jsx:114
const errorCopy = error === "WORKSPACE_STORAGE_QUOTA" ? T.quota : error ? T.unavailable : null;
```

`db.js`가 새 코드 `BLOCKED`를 만들었지만 소비처가 없어 `unavailable`로 폴백한다 →
다른 탭이 DB를 쥔 상황에서 **"이 브라우저에서는 저장이 안 돼요"**가 뜬다.
브라우저는 정상이고 실제 해법은 "다른 탭을 닫으세요"다. `CsvUploader`의
`storageUnavailable`도 같은 폴백이다. 카피 1줄 + 분기 1줄이면 끝난다.

§16 "신호를 만들었으면 그것을 읽는 곳을 그 자리에서 배선할 것"의 축소판이며,
이 저장소에서 같은 형태가 반복되는 자리다(`regularized` 플래그 · 5-3 신뢰도 · `preferenceSet`).

---

## 14. 기능 감사 — #776 (`0498a46`)

> **범위**: E2E 실패·수정만 보던 것을 넘어 기능 diff 19파일 전체(+457/−64). 기준 `0498a46`.
> **검증**: main CI `Quality gate` run 944 성공(`validate` + `browser-quality`). 아래 판정은 소스 추적으로 산출했다.

### 14.1 §8·§11 계약 — 통과

| 확인 | 결과 |
|---|---|
| `mmmMath.js` 변경이 수학인가 | ❌ 아니다 — 월/주 **라벨 스왑 3줄뿐**. §11 준수 |
| 성과 기준 자동 전환이 조용한가 (§8.8) | ❌ 조용하지 않다 — **정확히 옳게 처리했다**(아래) |
| 새 차트 props가 실제 데이터 모양과 맞는가 (§7) | ✅ 맞는다 |

**기준 자동 전환**은 §8.8("자동 라우팅은 조용하면 안 된다")을 그대로 지켰다.
`BasisCurrencyToggleBar`가 `BlockedOptionsNote`로 사유를 **화면 글자**로 낸다:

> 설치 — "양수 값이 없어 가입 기준을 자동 적용했습니다"

`disabled` 속성도 유지되고, `BlockedOptionsNote`는 사유가 하나도 없으면 `null`을 반환한다
(막힌 게 없을 때 빈 줄이 남지 않는다). 사유가 `title`이 아니라 본문 텍스트라 터치·키보드에서도 도달한다.

판정 기준도 정직하다 — `usableNumber`가 `> 0`을 요구하므로 "매핑됐다"가 아니라 "실제 양의 모수가 있다"로 가른다.

### 14.2 `hasCompatibleField`의 위험한 방향 — 하류 가드가 중화한다

`evaluateAnalysisEligibility.js`에 추가된 호환 규칙은 양방향이다:

```js
if (field === "week") return fields.has("date") || fields.has("iso_week_start");
if (field === "date") return fields.has("week") || fields.has("iso_week_start");   // ← 위험한 방향
```

`ANALYSIS_CATALOG` 전체(그룹 무관)를 훑으므로, **주간 패널 CSV가 `date` 요구 도구(5-2·5-5)의
필수 필드 심사를 통과**한다. 일별 계산(페이싱·이상탐지)이 주 단위 행으로 돌 위험이다.

추적 결과 **실제로는 막힌다**: `week`만 매핑된 입력에서 `detectedGrain`이 5-2에 대해
`"unknown"`을 반환하고(`supportedGrains`에 `weekly_panel` 없음 → 190행 건너뜀, `has("date")` false → 196행 건너뜀),
`profileProblems`의 `grain_mismatch`가 잡는다. **결함 아님.**

의도한 방향(`week` ← `date`)은 정확히 동작하고, `periodCount`도 일별 행 수가 아니라
`weeklyPeriodCount`(고유 ISO 주 수)를 쓴다 — PR 본문이 말한 "일별 행 수를 주차 수로 오인" 방지가 실제로 배선됐다.

### 14.3 P2 — 월간 경로에 불완전 기간 가드가 없다

**파일**: `MmmColumnMapper.jsx:1104 · 1122 · 1133`

부분 기간 탐지·제거가 **전부 `periodUnit === "weekly"` 조건 안에** 있다.

```js
if (r.date && periodUnit === "weekly") {
  const expectedDays = expectedDailyCadence(counts);
  // 경계(첫/마지막) 주가 기대 일수에 못 미치면 boundaryDrops에 넣어 제외
}
```

주간 경로는 잘려 있는 첫·마지막 주를 **찾아내 드롭**하고 `timeDiagnostics.boundaryPartialWeeks`로 보고한다.
**월간 경로는 이 블록 전체를 건너뛴다.**

- 월간 export에 **진행 중인 이번 달**이 포함되는 것은 흔하다("이번 달 지금까지").
- 그 행은 절반짜리 볼륨인데 완결된 한 달로 모델에 들어간다 → 마지막 달이 급락으로 보이고,
  adstock·트렌드가 그 급락을 적합한다.
- 같은 코드베이스가 `dataContinuity`에서 `maturity`(`provisional` / `likely_closed`)를 이미 다룬다 —
  이 문제가 중요하다는 것을 제품이 이미 알고 있다.

주간에서 막던 것을 월간에서 안 막으면, 월간 지원은 "되긴 하는데 덜 정직한" 경로가 된다.
**수정 방향**: 월간에도 경계 기간 완결성(일수 또는 마지막 날짜가 월말인지)을 확인해 드롭하거나,
최소한 `timeDiagnostics`에 남겨 화면이 "마지막 달은 미완결"이라고 말하게 한다.

### 14.4 P3 — `inferDateCadence`의 간격 임계에 구멍

```js
if (intervalDays <= 3) "daily";
else if (intervalDays >= 5 && intervalDays <= 9) "weekly";
else if (intervalDays >= 25 && intervalDays <= 35) "monthly";
else "irregular";
```

**4일 · 10~24일 · 36일 이상이 전부 `irregular`**다. 격주(14일) 패널이 대표적으로 여기 빠지고,
그 경우 `responseAnalysisAdapters`가 `periodUnit`을 `"weekly"`로 되돌려 격주 행을 주 단위로 취급한다.
현재 도구 계약에 격주가 없으므로 영향은 작지만, 임계 사이의 빈칸은 의도적 제외인지 누락인지 코드로 구분되지 않는다
(§7 "목록에서 빠진 것과 의도적으로 뺀 것은 코드에서 구분돼야 한다").

날짜 파싱 자체는 정확하다 — `Date.UTC`·`getUTCDay()`를 쓰고(§7 UTC 함정),
순번형 week(`1`,`2`,`3`)를 `Date.parse`가 2001년 월로 오해하는 함정을 **주석까지 달아 명시적으로 차단**했다.

### 14.5 P3 — `mmmMathPr416`에 같은 문구가 남았다

`mmmMath.js:1656`의 월/주 라벨 분기가 `mmmMathPr416.js:1272`에는 반영되지 않았다(주차 고정 문구).
다만 `mmmDataQualityAudit`은 **`mmmMath.js`에서만 export**되고 Pr416 쪽 블록은 어디서도 import하지 않으므로
**사용자에게 도달하지 않는다.** 중복 코드 정리 대상이지 결함은 아니다.
(#767은 같은 상황에서 두 파일을 함께 고쳤다 — 규칙이 갈린 자리다.)

### 14.6 확인했고 정확한 것

| 항목 | 결과 |
|---|---|
| `periodUnit` 배선 | `monthStartTimestamp` · `granularity` · `calendarGaps.unit`까지 일관 |
| 월간 계절성 | `mmmTrendExistence`에 `seasonalityPeriods: [12]` 전달 |
| 관측 단위 라벨 | "관측 주차" ↔ "관측 월"을 cadence로 분기 |
| `ResultBars` props 계약 | `options.{x,y}` = `{entity, saturationIndex}` — 실제 행 키와 일치(§7 props 모양) |
| `ResultBars` 정직성 | `max <= 0`이면 막대를 만들지 않고 표 또는 `null`. 값 표시는 `formatResultValue`(반올림 없음) |
| `period-comparison` variant | `AssistantWorkspace:438`에서 실제 렌더러에 연결 |
| 버튼 `type="button"` 4곳 추가 | 폼 내 의도치 않은 submit 방지 |
