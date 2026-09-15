# R0 · 배선 인벤토리 + 퇴화 입력 픽스처

- **실측일**: 2026-09-15
- **대상 커밋**: `18b11f0` (origin/main) 기준, 브랜치 `claude/tool-feature-checklist-wqg1qu`
- **실행한 것**
  - `scripts/audit/tool-inventory.mjs` — 레지스트리 배선 칸 파생
  - `scripts/audit/tool-surface.mjs` — 결론카드·다운로드·차트 계약·가드 두께 파생
  - `scripts/audit/degenerate-fixtures.mjs` — 퇴화 입력 6종 생성
  - 임시 스모크 탐침 8건(5-18 서브툴 isolated 렌더) — **실행 후 삭제**
- **대상**: `routeMap.publishedToolIds()` 파생 **20개** (손 목록 아님)

---

## 0. 한눈에 보기

| # | 심각도 | 축 | 도구 | 한 줄 |
|---|---|---|---|---|
| F-0-01 | **P2** | J 가드 | `5-18-mmm` `5-18-forecast` | 발행 라우트의 실제 렌더 경로(`isolated`)를 어떤 테스트도 렌더하지 않는다 (현재 throw 없음은 실측으로 확인) |
| F-0-02 | **P2** | N 차트 | 10개 도구 · 차트 14개 | `chartCommonOpts()` 없이 `new Chart()` — `5-18-paid-organic`은 `CHART_THEME`조차 없음 |
| F-0-03 | P3 | A 계약 | (전역) | `TOOL_REQUIRED/OPTIONAL_FIELDS`에 삭제된 도구 id 11개 잔존 |
| F-0-04 | P3 | J 가드 | `5-26` | 필수 필드 5개 도구인데 스모크 단언 7개 — 발행 도구 중 가장 얇음 |
| F-0-05 | **P1** | J·M | `9-6` | `test:all`이 **부하에 따라 뒤집힌다** — 9-6 EN 데모 렌더가 5초 타임아웃 경계에 있다 |

**P0 없음 · P1 1건.** 배선 칸은 사실상 다 차 있다 — 아래 §2가 "봤다"의 목록이다.

---

## 1. 발견 상세

### F-0-01 [P2][축J] 응답 5형제 중 2개는 실제 렌더 경로가 검사된 적이 없다

- **입력**: 전 테스트에서 `render(<MarketingResponse …>)` 호출을 전수 집계
  ```
  13  render(<MarketingResponse />);              ← 기본 stage=trend, isolated 아님
   3  render(<MarketingResponse initialStage="hub" />);
   2  render(<MarketingResponse initialStage="lab" />);      ← isolated 없음
   2  render(<MarketingResponse locale="en" />);
   1  render(<MarketingResponse initialStage="trend" isolated />);
   1  render(<MarketingResponse initialStage="trend" isolated locale={locale} />);
   1  render(<MarketingResponse initialStage="diagnose" isolated locale={locale} />);
   1  render(<MarketingResponse locale="ko" />);
  ```
- **기대**: 발행 라우트 4개(`5-18-trend` `-cannibal` `-mmm` `-forecast`)는 `PageClient`가
  `<MarketingResponse initialStage=… isolated />`로 디스패치한다(`PageClient.jsx:113~`).
  네 조합 모두 렌더되어야 한다.
- **실제**: `initialStage="mmm"`은 **0건**, `lab`은 `isolated` 없이만 2건.
  `isolated`는 죽은 prop이 아니다 — 최소 3곳에서 분기한다:
  `MarketingResponse.jsx:3373`(탭 전체 `return null`) · `:4306`(다음 단계 컨트롤) · `:4440`(안내 Card).
  e2e도 이 네 slug를 열지 않는다(`mmm-contribution`·`marketing-forecast`·`marketing-trend`·`cannibalization-diagnosis` 검색 0건).
- **증상 여부**: **없다.** 임시 탐침으로 4 stage × KO/EN = 8건을 직접 렌더했고 8/8 통과했다.
  즉 지금 깨져 있다는 뜻이 아니라, **깨지면 아무도 모른다**는 뜻이다
  (§7 "render throw는 골든이 못 잡는다 → 단일 render throw가 페이지를 통째로 죽인다").
- **원인**: 스모크가 허브 화면 기준으로 자랐고, 승격(PR #696) 때 라우트만 늘고 렌더 케이스가 따라오지 않았다.
- **처방 후보**: 아래 15줄을 `MarketingResponse.smoke.test.jsx`에 추가(예상 15줄, 실행 6.3초).
  ```jsx
  describe("발행 라우트 isolated 렌더", () => {
    for (const [stage, id] of [["trend","5-18-trend"],["diagnose","5-18-cannibal"],["mmm","5-18-mmm"],["lab","5-18-forecast"]]) {
      it(`${id} (stage=${stage})`, () => {
        expect(() => render(<MarketingResponse initialStage={stage} isolated />)).not.toThrow();
      });
      it(`${id} EN`, () => {
        expect(() => render(<MarketingResponse initialStage={stage} isolated locale="en" />)).not.toThrow();
      });
    }
  });
  ```
  **단, 이 목록도 손으로 쓴 배열이다.** 더 나은 형태는 `PageClient`의 디스패치 표에서
  `(routeId → stage)`를 파생하는 것이다 — 라우트가 늘면 케이스가 자동으로 는다. R14에서 결정.

### F-0-02 [P2][축N] 차트 14개가 공용 옵션 없이 생성된다

- **입력**: 도구 컴포넌트에서 주석 제거 후 `new Chart(` 와 `chartCommonOpts(` 동시 집계
- **실제**

  | 도구 | `new Chart` | `chartCommonOpts` | `CHART_THEME` |
  |---|---|---|---|
  | `5-22` `5-4` `5-23` `9-1` `9-6` | 있음 | **없음** | 있음 |
  | `5-18-*` (MarketingResponse 11 + model 3) | 14 | **없음** | 있음 |
  | `5-18-paid-organic` | 1 | **없음** | **없음** |
  | `5-3` `5-21` `5-20` `5-24` `5-27` `5-28` `5-29` | 있음 | 있음 | 있음 |

- **기대**: §12.3은 `chartCommonOpts()`+`CHART_THEME`를 도구 차트의 기본으로 정한다.
  다만 같은 절이 "전역 룩은 `Chart.defaults`+플러그인으로 붙여 덮어쓰기와 무관하게 상속시킨다"고도 한다 —
  **그래서 이 표만으로는 결함이라고 단정할 수 없다.**
- **`chartCommonOpts()`가 실제로 무엇을 주는가**(`chartUtils.js:58~`): 범례 라벨 `color: CHART_THEME.text` ·
  폰트 스택 · `usePointStyle` · 레이아웃 패딩 · 모션축소 애니메이션 · 툴팁 폴백 색.
  이 중 **범례 글자색**이 위험하다 — §7에 "Chart.js v4 커스텀 `generateLabels`는 per-item `fontColor`를
  자동 주입하지 않아 다크모드 범례 텍스트가 실종된다(라이트는 멀쩡 → 한쪽만 검증하면 놓침)"가 이미 있다.
- **추가 확인 필요(?)**: 위 차트들이 범례 색을 각자 설정하는지, `Chart.defaults`가 이미 덮는지.
  → **R12에서 다크·라이트 양쪽으로 실제 렌더해 범례 글자색을 읽는다.** 표를 세는 것으로는 못 가른다.
- **`5-18-paid-organic`의 다운로드 부재는 결함이 아니다** — `PaidOrganicTrend.jsx:360`에
  "이 화면의 산출물은 판정 한 줄과 수치 3개뿐"이라는 **명시 사유 주석**이 있다(의도적 제외 · §7 "빠진 것과
  의도적으로 뺀 것은 코드에서 구분돼야 한다"를 지킨 자리).

### F-0-03 [P3][축A] 삭제된 도구의 필드 계약이 남아 있다

- **실제**: `TOOL_REQUIRED_FIELDS` · `TOOL_OPTIONAL_FIELDS`에 발행 도구가 아닌 키 15개 —
  `5-5 5-6 5-7 5-8 5-9 5-10 5-11 5-12 5-13 5-14 5-15 5-16 5-18 9-3 9-7`.
  이 중 `5-5 5-8~5-14 5-16` 9개는 `routeMap`·`next.config.mjs` 어디에도 없다(전수 grep 0건).
- **영향**: 소비처 14곳이 전부 `TOOL_REQUIRED_FIELDS[toolId]` 인덱스 접근이라 **목록을 순회하지 않는다**
  → 화면·템플릿·연결표에 새지 않는다. 지금은 무해하다.
- **왜 그래도 적는가**: §12.19의 데이터×기능 연결표는 이 상수에서 자동 생성하는 것이 원칙이라,
  누군가 `Object.keys()`로 도는 순간 없는 도구 9개가 표에 뜬다. 그리고 계약이 실제보다 차 있어 보인다.
- **처방 후보**: 죽은 9개 삭제(약 60줄 감소) + `csvConstants` 키가 `routeMap`에서 파생됨을 단언하는 정합 테스트.
  `5-6`(9-6 방어적 alias) `5-7`/`5-15`(5-4 legacy) `5-18`(허브) `9-3`/`9-7`(preview)는 **살아 있는 예외**라 남긴다.

### F-0-04 [P3][축J] 5-26 가드가 가장 얇다

- **실제**: 발행 도구별 스모크 단언 수 — 최소 `5-26` **7개**(70줄), 다음 `5-24` 10 · `5-3` 12 · `5-25` 12,
  최대 `5-18-*` 381(2,088줄) · `9-1` 56 · `5-2` 51.
- **기대**: `5-26`은 필수 필드 5개 · 옵션 8개로 계약이 두꺼운 축(전 도구 중 필수 필드 최다)인데 가드는 최소다.
- **판정**: 숫자만으로는 결함이 아니다(단언 수 ≠ 커버리지). **R8에서 5-26 스모크를 정독해
  "무엇을 단언하는가"를 확인한 뒤** 결론낸다. 여기서는 읽을 순서를 정하는 신호로만 쓴다.

### F-0-05 [P1][축J·M] `npm run test:all`이 지금 이 저장소에서 실패한다 (부하 의존)

- **입력**: 이 감사의 베이스라인으로 `npm run test:all`을 소스 변경 없이 실행
- **실제**
  ```
  Test Files  1 failed | 461 passed | 1 skipped (463)
       Tests  1 failed | 3757 passed | 2 skipped (3760)   EXIT=1
  × EnglishToolLocale.smoke > 'Creative analyzer' … demo analysis results  5136ms
    Error: Test timed out in 5000ms.
  ```
- **단독 실행하면 통과한다**: 같은 파일만 돌리면 25/25 통과.
  즉 **테스트가 틀린 것도 코드가 깨진 것도 아니고, 한도가 빠듯한 것**이다.
- **왜 하필 이 케이스인가** (같은 파일 per-test 실측, 단독 실행 기준)

  | 케이스 | 소요 |
  |---|---|
  | **`Creative analyzer`(9-6) EN 데모 결과** | **3,446ms** |
  | `Dashboard`(5-2) EN 데모 결과 | 1,235ms |
  | `Marketing efficiency`(5-22) | 279ms |
  | 나머지 22건 | 9~115ms |

  9-6 하나가 다음 순위의 **2.8배**다. 단독 3,446ms → 전체 부하 5,136ms로 밀리면서 5,000ms를 넘겼다.
- **두 갈래로 읽어야 한다** — 한쪽만 고치면 다시 나온다.
  1. **가드 신뢰성**: 기준선이 한도의 69%라 "코드와 무관하게" 빨강이 뜬다. §7에 이미
     *"정착 전 중간 상태를 단언하면 DOM이 조금만 무거워져도 깨진다 — 원인은 그 커밋이 아니라 테스트였다"*가 있다.
     지금은 그 변형(시간 한도판)이다. 붙은 커밋이 범인으로 몰리게 되어 있다.
  2. **성능 신호**: 9-6 데모 렌더가 jsdom에서 3.4초다. R11에서 **실제 브라우저 기준**으로
     이 렌더가 무엇에 쓰이는지 재야 한다(차트 4개? 포레스트 플롯 높이 `n*26+80`? 피로도 전 소재 순회?).
     테스트만 느린 것인지 사용자도 느린 것인지는 아직 **모른다** — 지금 단정하지 않는다.
- **처방 후보**
  - A안(즉효, 1줄): 그 케이스에 `{ timeout: 15000 }`. 빨강은 멈추지만 **느린 이유는 그대로 덮인다.**
  - B안(권장): A를 하되 **R11에서 9-6 렌더를 실측**하고, 원인이 렌더라면 고친 뒤 한도를 되돌린다.
    한도 완화는 조사 기간의 임시 조치라고 코드에 사유를 남긴다.
  - C안: 하지 않는다 — 부하에 따라 뒤집히는 상태로 두면 다음 사람이 자기 커밋을 의심한다.
  - **결정은 사용자 몫**(§2.7). 이 회차에서는 고치지 않는다.
- **검증 기록**: `npm run lint` — **0 errors**(정상). 실패는 위 1건뿐.

---

## 2. 확인했으나 문제 없음 (봤다는 기록)

| 항목 | 결과 |
|---|---|
| 결론 카드 `ResultActionCard` | **20/20 채택** |
| 다운로드 `DownloadHub` | 19/20 — 1건은 명시 사유 있는 의도적 제외 |
| `TOOL_GROUP` 등록 | 20/20 · 데이터 그룹 16개 전부 `buildGroupMap` 파생 |
| 데모 픽스처 | 16개 그룹 **전부 `buildDemoCsv` 빌드 성공**(실제 호출로 확인) |
| `TOOL_GUIDE` KO/EN | 20/20 (5-23은 `5-23:<method>` 서브키 — `Incrementality.jsx:268`이 복합키로 조회) |
| `CONNECTED_TOOLS` · `NEXT_TOOL_IDS` | 20/20 · 전부 다음 도구 3개 |
| `toolSearchContent` KO/EN 답변 | 20/20 (서브툴은 `responseSubtoolContent` 폴백으로 채워짐) |
| `EN_READY_TOOL_IDS` | 20/20 |
| `routeSeo` 전용 메타 | 20/20 |
| `TOOL_JOURNEY` 질문 축 | 20/20 |
| 테스트 내 `?.()` | **0건** (아래 §3 참조 — 처음엔 1건으로 잡혔다) |
| `npm run lint` | **0 errors** |
| `npm run test:all` | 3,757 통과 / **1 실패**(F-0-05) / 2 스킵 |

---

## 3. 내 탐침이 틀렸던 3건 (같은 실수를 R1~R14에서 반복하지 않기 위해)

1. **데모를 도구 id로 grep했다** → 전 도구가 "없음"으로 나왔다. 데모는 **데이터 그룹**으로 등록된다
   (`BUILDERS[group]`). 고친 뒤 실제로 `buildDemoCsv(group)`를 호출해 판정하니 16/16 성공.
   *교훈: 레지스트리의 키가 무엇인지 확인하기 전에 세지 말 것.*
2. **스모크 파일에 주석 제거를 안 걸었다** → `5-25` 스모크가 "테스트 내 `?.()` 있음"으로 잡혔는데,
   실제로는 **그 사고를 설명하는 주석**이었다(`setAnalyzed?.()` — 이미 `setGroupAnalyzed`로 고쳐져 있고
   주석이 경위를 적어 둔 상태). §16 "소스를 문자열 포함으로 검사하면 자기 설명 주석에 속는다"가
   **하네스를 읽고 스크립트를 짠 자리에서 그대로 재발**했다.
3. **디스패치 라우트를 "파일 없음"으로 보고했다** → `5-18-trend` 등 4개는 `routeMap`의 `component`가
   문서용 태그라 파일이 없는 것이 정상이다(§16에 이미 기록). 컬럼을 `dispatch`로 바꿨다.

셋 다 **"세기 전에 판정식을 끝까지 읽는다"** 하나로 막힌다.

---

## 4. 퇴화 입력 픽스처 6종 (R1~R9 공유)

`scripts/audit/degenerate-fixtures.mjs` — 결정론(시드 고정, `Math.random` 없음).

| 키 | 행 | 무엇을 묻는가 |
|---|---|---|
| `empty` | 0 | 빈 상태가 정직한가, 0/NaN을 결과로 내는가 |
| `single` | 1 | 분산·기울기가 정의되지 않는 최소 입력에 `n<=k` 가드가 있는가 |
| `constant` | 30 | 종속변수 분산 0 → `sst>0` 가드 없으면 R²=-∞ · p≈0("극도로 유의")이 렌더된다 |
| `collinear` | 80 | 완전공선 → 역행렬 rank 판정(`maxErr`) 없으면 가비지 β·SE가 확정 숫자로 나온다 |
| `allZero` | 20 | 0 나눗셈이 Infinity로 새는가 · "계산 불가"를 좋은 등급으로 접는가(VIF=1 계열) |
| `sparse` | 90 | 빈 셀이 0으로 둔갑해 평균·비중을 조용히 왜곡하는가 |

각 도구 회차에서 **6종을 모두 통과**시키고, 화면에 뜬 숫자를 그대로 기록한다.

---

## 5. 다음 회차

**R1 · 5-2 운영 대시보드** — 탭 10개(스코어카드·페이싱·이상탐지·LTV·코호트·퍼널·세그먼트·시즈널리티·Viz·추천뷰),
분모 토글 전역 전파, 탭별 빈 상태, WoW 판정(`dashboardVerdict.js`).
스모크 단언 51개로 두꺼운 편이라 **무엇을 단언하는지 정독**이 먼저다.
