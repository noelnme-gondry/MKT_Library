# 운영 대시보드 8개 항목 실행 스펙

## 목적·전제

본 문서는 5-2 운영 모니터링(통합 대시보드) 관련 8개 피드백 항목을, **단순 모델이 재조사 없이 그대로 구현**할 수 있도록 파일:줄 수준으로 정리한 실행 스펙이다. 모든 줄 번호는 조사 시점의 `index.html` 기준이며, 구현 전 해당 심볼명으로 grep해 위치를 재확인할 것(편집으로 줄이 밀릴 수 있음).

**절대 전제 (CLAUDE.md §2·§11)**

- 모든 코드는 **단일 `index.html`** 한 파일에. 별도 `.js`/`.css` 생성 금지, 빌드 도구 금지, 새 라이브러리 금지.
- **vanilla JS** — `var` 금지(`const`/`let`), 순수 함수 우선. `Math.random` 절대 금지(§8.7 결정론).
- 작업 브랜치 `feat/poly2-bell-warning` → PR → squash merge. **main 직접 push·`--no-verify`·`--force` 금지.**
- 변경 후 **syntax check 필수**(`<script>` 블록 추출 후 `new Function`).
- ~~design-only 항목(#3·#4·#8)은 사용자 결정 전 구현 착수 금지~~ → **결정 완료 (2026-06-22)**: 각 항목의 "✅ 결정 확정" 박스 참조. 이제 8개 전부 구현 착수 가능.
- 차트 캔버스·DnD·키보드 등 포인터/시각 요소는 **headless 검증 불가 → 브라우저 확인 필수**(§12.22).

**검증 자산 현황 (착수 전 필독 — 실재 여부 확정)**

| 자산 | 실재 여부 | 용도 |
|---|---|---|
| `/tmp/validate_mon_filter.js` | ✅ 실재 (29/29) | 항목 1 sticky 필터 회귀 |
| `/tmp/test_cohort.js` | ✅ 실재 | 항목 2 코호트 distinct 산식 확인 |
| `/tmp/test_reset.js` | ✅ 실재 | 항목 2 토글 리셋 재현 |
| `/tmp/validate_mon.js` | ❌ **존재하지 않음** | 참조 금지 — 필요 시 **신규 작성**(아래 항목별 명시) |
| `/tmp/validate_funnel2.js` | (재확인 필요) | 항목 8 — 없으면 신규 작성 |
| in-page `window.run*Tests()` | ✅ 실재 | byte-동일 회귀의 1차 기준 |

> **⚠ 검증 원칙**: byte-동일 회귀는 **in-page golden 함수**(`window.runScorecardAnomalyTests()`·`window.runFunnelTests()`·`window.runLtvCacTests()`·`window.runPacingTests()`·`window.runSegmentTests()`·`window.runQualityTests()`·`window.runMaturationTests()` 등 실재 확인됨)를 **1차 기준**으로 한다. `/tmp/validate_*.js`는 **존재하는 파일만** 사용하고, 없는 것(`validate_mon.js` 등)은 "신규 작성" 단계로 명시하거나 in-page golden으로 대체한다. **존재하지 않는 검증 파일을 통과 기준으로 삼지 말 것.**

**구현 금지 / 주의 항목**

| 항목 | 사유 |
|---|---|
| ~~#3·#4·#8 코드 작성~~ | **결정 완료** — 각 항목 "✅ 결정 확정" 박스대로 구현 가능 |
| #4 매출(revenue) 페이싱 | **페이싱에서 제외 결정** — revenue_d7은 cohort-window라 일별 페이싱 부적합. 일별 매출 별도 컬럼 업로드 권장(추후) |
| #7 신규 색 로직 추가 | 요청 기능이 **이미 구현됨** — 신규 코드 0줄, 브라우저 확인만 |
| `ALLOC_FILTER_STATE`(5-3) 수정 | 본 작업 범위는 5-2 한정. 5-3은 별개 상태·별개 함수 |

---

## 항목별 우선순위·상태 요약

| # | 제목 | 상태 | 난이도 | 비고 |
|---|---|---|---|---|
| 1 | Platform 필터 multi-select 통일 | 구현 | 소 (25~35줄) | 기존 `mon-multisel` 인프라 재사용 |
| 2 | 코호트 토글(D0/D7/D14) D7 고정 버그 | 버그픽스 | 소 (2~10줄) | 옵션 A+B 또는 C 결정 권장 |
| 6 | 리텐션 §1 표 헤더/값 정렬 불일치 | 버그픽스 | 매우 소 (1~2줄) | th 우측/td 좌측 미스매치 |
| 7 | 세그먼트 매트릭스 색상(나쁜=빨강) | 버그픽스(확인) | 0줄 | **이미 구현됨** — 브라우저 확인 |
| 5 | LTV:CAC D360 예측·미마감 툴팁·곡선 차트 | 구현 | 중 (150~250줄) | 예측 모델 B/C 결정 선행 |
| 3 | 스코어카드 탭형 드릴다운(D30 제거+일별 차트) | **구현(결정 완료)** | 중 (60~90줄) | 혼합차트·cost클릭허용·있는만큼+경고 |
| 4 | 페이싱 요일 계절성 예측 + 액션 정의 토글 | **구현(결정 완료)** | 중 (80~140줄) | 최근4~8주·산식A·라벨토글·**설치/액션만(매출 제외)** |
| 8 | 퍼널 CVR 요일 계절성 보정 | **구현(결정 완료)** | 소~중 (40~60줄) | C(WoW강조+토글)·**평일/주말 2그룹**·additive |

---

## 항목 1 — Platform 필터를 국가·채널과 동일한 multi-select(체크박스 드롭다운)로 통일

**상태**: 구현 (bugfix성 통일, 즉시 진행 가능)

**현재 동작**
5-2 sticky 필터 바(`renderMonFilterBar`, `index.html:6204`)에서 국가·채널은 커스텀 multi-select(`.mon-multisel` 체크박스 드롭다운, body portal)인데 **Platform만 네이티브 `<select>`**(전체/단일값 택1, `6238-6245`)로 형식·작동이 다르다. 상태도 `MON_FILTER_STATE.platform`이 `"all"|문자열`(`6149`)로, 국가·채널의 `Set|null` 패턴과 어긋난다. 필터링은 `getMappedRowsForMon`(`5876`)에서 단일 정확매치만 한다(`5881`). 결과적으로 사용자는 Android/iOS 중 **하나만** 고를 수 있다.

**목표**
Platform을 국가·채널과 동일한 `.mon-multisel` 체크박스 드롭다운으로 바꿔 다중 선택(Android+iOS, 전체)을 가능하게 한다.

**변경 위치**

| 심볼 | 종류 | 줄 | 메모 |
|---|---|---|---|
| `MON_FILTER_STATE` | const object 선언 | **6146** | 객체 선언 시작은 6146. `platform:"all"` **키는 6149** |
| `renderMonFilterBar` | function | 6204-6280 | 옵션추출(6215 유지)·active카운트(6224)·`<select>`블록(6238-6245)을 countries(6246-6258) 동형 체크박스로 교체 |
| `getMappedRowsForMon` | function | 5876-5885 | 5881 필터 로직을 `f.platforms.has(...)`로 교체 |
| `monFilterKey` | function | 5869-5874 | 캐시키 `${f.platform}` → `${f.platforms?...:"*"}` |
| `MON_FILTER_KEY` | function | 17808-17812 | **두 번째 캐시키 함수 — 같이 갱신 필수(SSOT 아님)** |
| 멀티셀렉트 핸들러 | closure | 19407-19475 | change 핸들러(19449-19459)는 무수정 / data-mon-filter platform 분기(19418-19420) 제거 / reset(19470) 수정 |

**구현 단계**

1. `index.html:6149` — `platform: "all"` 줄을 `platforms: null, // null=전체 | Set(선택 platform 값)`로 교체.
2. `index.html:6215` — `const platforms = hasPlatform ? uniq(...) : [];` **그대로 유지**(옵션 추출, raw 값 정렬).
3. `index.html:6224` — active 카운트 `if (f.platform !== "all") active++;` → `if (f.platforms) active++;`.
4. `index.html:6238-6245` — platform `<select>` 블록 전체를 countries(6246-6258)와 **동형** 멀티셀렉트로 교체. countries 코드를 복붙해 변수만 `platforms`로 바꾸고 `data-multisel="platforms"`, `data-multisel-toggle="platforms"`, `data-ms-list="platforms"` 부여. 라벨은 `f.platforms===null ? \`전체 (${platforms.length})\` : \`${f.platforms.size}개 선택됨\``. **value·라벨에 `escapeHtml`(3135) 적용 필수.** ⚠ **마크업(체크박스·라벨·portal 구조)만 복붙하고, 필터 매칭 로직은 단계 5의 `String(r.platform||"")`(trim 없이)을 쓸 것 — countries의 `.trim()`을 따라 복사하지 말 것**(아래 단계 5·주의 참조).
5. `index.html:5881` — `if (f.platform !== "all") rows = rows.filter(r => String(r.platform || "") === f.platform);` → `if (f.platforms) rows = rows.filter(r => f.platforms.has(String(r.platform || "")));`. **`.trim()` 추가 금지** — 근거: 기존 platform 필터(5881)는 raw 정확매치(`===`, trim 없음)였고 옵션 추출(6215)도 raw 값을 그대로 쓰므로, Set 매칭도 동일하게 raw로 해야 후보값과 1:1 일치한다. (국가·채널 5882-5883은 `.trim()`을 쓰지만 그건 그쪽 데이터 정합성 관행이고, platform은 기존 raw 동작을 일관 유지한다. ※ 사용자가 platform 데이터에 공백 노이즈가 있어 trim 통일을 원하면 6215 옵션 추출에서도 함께 trim해 양쪽을 맞춰야 한다 — 이는 별도 결정 항목.)
6. `index.html:5873`(monFilterKey) — `|${f.platform}|` → `` |${f.platforms?[...f.platforms].sort().join(","):"*"}| ``.
7. `index.html:17811`(MON_FILTER_KEY) — `|${f.platform||"all"}|` → 동일 직렬화로 교체. **두 함수 모두 갱신했는지 grep `f.platform`으로 확인** (5-2 외 `ALLOC_FILTER_STATE` 등 다른 `f.platform`은 건드리지 말 것).
8. `index.html:19418-19420` — data-mon-filter change 핸들러의 `else if (key === "platform") {...}` 분기 제거(이제 dateStart/dateEnd만 data-mon-filter). 체크박스 핸들러(19449-19459)는 무수정(`data-ms-list="platforms"`로 자동 동작).
9. `index.html:19470` — reset의 `MON_FILTER_STATE.platform = "all";` → `MON_FILTER_STATE.platforms = null;`.

**주의(함정)**

- **trim 비대칭 주의** — countries/channels 필터는 `.trim()`을 쓰지만 platform은 raw `===`가 기존 동작. 단계 4에서 countries 마크업을 복붙할 때 **필터 매칭 라인까지 복사하면 `.trim()`이 따라와 단계 5와 충돌**한다. 마크업만 복붙하고 매칭은 단계 5 코드를 쓸 것.
- **캐시키 SSOT 아님** — `monFilterKey`(5869)와 `MON_FILTER_KEY`(17808) 둘 다 안 바꾸면 일부 캐시(funnel/wide-ret/maturation은 후자, pacing/ltv는 전자 계열) 무효화 누락 → 화면 안 바뀜.
- **`ALLOC_FILTER_STATE`(5-3) 절대 건드리지 말 것** — `f.platform`을 쓰지만 완전 별개 상태·함수(`getMappedRowsForAlloc`).
- **body portal + position 함정(§12.37 PR#170)** — 토글 시 `document.body.appendChild`로 portal하는 기존 핸들러(19440)가 `data-multisel-toggle="platforms"`에 자동 적용. backdrop-filter가 fixed의 containing block이 되는 문제는 portal로 해소됨.
- **navigate 재렌더** — 체크박스 change·reset이 `_monInvalidateCaches()` 후 `navigate("5-2")` 호출하는 기존 흐름 유지. stale portal 리스트는 19430에서 자동 제거.

**검증**
- Node inject(`/tmp/validate_mon_filter.js` **실재 — 갱신**, 현재 29/29 통과): (e) `MON_FILTER_STATE.platforms = new Set(["ios"])` → 결과 모두 ios. (h)·setUp reset도 Set/null로 교체. **신규**: `new Set(["ios","android"])` → 전체 30행, `null` → 전체 30행.
- 마크업 검증: `bar.includes('data-ms-list="platforms"')` && `!bar.includes('data-mon-filter="platform"')`.
- 캐시키 결정론: 두 함수 모두 Set 순서 무관(sort) 동일 문자열 반환.
- **브라우저 확인 필수**: (1) Platform 드롭다운이 국가·채널과 동일 체크박스 형태 (2) body portal로 viewport 정렬, 클리핑 없음 (3) Android만/둘 다/전체 즉시 반영(스크롤 보존) (4) 초기화가 platforms도 null로 리셋.

**수용 기준**
- [ ] Platform이 체크박스 드롭다운(`.mon-multisel`)으로 렌더
- [ ] Android+iOS 동시 선택 가능, 차트·표에 반영
- [ ] `monFilterKey`·`MON_FILTER_KEY` 둘 다 갱신, platform 변경 시 캐시 무효화
- [ ] 초기화 시 `platforms=null`
- [ ] `ALLOC_FILTER_STATE` 무변경
- [ ] syntax check 통과

---

## 항목 2 — 코호트 시점 토글(D0/D7/D14)이 KPI 요약을 안 바꾸고 D7 고정

**상태**: 버그픽스 (단, 수정 방식 A+B vs C 선택 권장)

**현재 동작**
5-2 '시각화' 탭(`monVizBody`) §1 코호트 시점 토글 D0/D7/D14를 클릭해도 §2 KPI(매출/결제수/CPA/ROAS/ARPU/잔존율)가 **매번 D7로 되돌아가고** active 버튼도 D7 고정. (단일 지표 비용/설치/CPI/CTR/CVR은 코호트 무관이라 안 바뀌는 게 정상.)

**문제(근본 원인)**
토글 핸들러(`19481-19483`)는 `CSV_STATE.selectedCohort=14`만 세팅하고 `navigate("5-2")` — `saveCsvToTool` 미호출이라 스냅샷에 persist 안 됨. navigate → `page_5_2`가 최상단(`6329`)에서 `loadCsvFromTool("5-2")`를 `monVizBody`보다 먼저 실행. `loadCsvFromTool`(`22525`)은 `CSV_STATE.selectedCohort = snap?.selectedCohort || 7`로 스냅샷 디폴트(7)로 덮어씀. 데모 모드는 더 확실히 죽는다: `_applyDemoToCsvState`(`22678`)가 `CSV_STATE.selectedCohort = 7`을 무조건 하드코딩 → 토글 100% 무효. **산식·데모 데이터는 정상**(D0 ROAS 53.8%/D7 123.75%/D14 166.79% distinct 검증됨) — 손대지 말 것.

**변경 위치**

| 심볼 | 종류 | 줄 | 메모 |
|---|---|---|---|
| cohort-toggle handler | event-handler | 19478-19486 | 19482에서 set 후 saveCsvToTool 누락이 직접 원인 |
| `loadCsvFromTool` | function | 22504-22526 | 22525 `\|\| 7`이 토글값 리셋 |
| `_applyDemoToCsvState` | function | 22674-22681 | 22678 `=7` 무조건 — 데모 토글 죽임 |
| `calculateKPIs` | function | 5888-5912 | 5890 `const cohort = CSV_STATE.selectedCohort` (소비처 단 1곳) |
| `saveCsvToTool` | function | 22482-22492 | 22490 persist, 데모 시 22484 early-return(no-op) |
| `CSV_STATE.selectedCohort` | state | 3128 | 기본 7 |

**구현 단계 — 옵션 결정 필요**

> 토글이 navigate 재렌더에서 살아남게 하는 게 유일한 수정 포인트. 두 접근이 있으며 사용자 선호('근본 격리' vs '최소 diff')에 따라 선택. **옵션 A+B를 기본 권장**(잔재 정리 위험 없음).

**옵션 A+B (최소 diff, 데모 가드 동반) — 권장 기본**
1. `index.html:19482` — 핸들러를 `CSV_STATE.selectedCohort = parseInt(btn.dataset.cohort,10); saveCsvToTool(ACTIVE_CSV_TOOL); navigate("5-2");`로.
2. `index.html:22678` — `CSV_STATE.selectedCohort = 7;` → `if (CSV_STATE.selectedCohort == null) CSV_STATE.selectedCohort = 7;` (데모 토글값 보존).
3. `index.html:22525` — `CSV_STATE.selectedCohort = snap?.selectedCohort ?? CSV_STATE.selectedCohort ?? 7;` (현재값 우선 폴백).
   - ⚠ A만 단독은 데모서 `saveCsvToTool` no-op이라 무효 → B(2·3) 병행 필수.

**옵션 C (통합·SSOT, navigate 재렌더 면역)**
1. UI 토글 상태를 별도 신설: `MON_STATE.cohort = 7` (또는 새 객체). `WIDE_RET_STATE.anchor`(16442) 패턴과 동일.
2. `index.html:5890` — `const cohort = MON_STATE.cohort`.
3. `index.html:19482` — `MON_STATE.cohort = parseInt(btn.dataset.cohort,10); navigate("5-2");`.
4. `monVizBody` 5938-5940/6094-6103의 `k.cohort`는 그대로(calculateKPIs가 반환).
5. **⚠ `selectedCohort` 잔재 — 제거가 아니라 '덮어쓰기 로직만 무력화'**: `CSV_STATE.selectedCohort` **키 자체와 스냅샷 직렬화(22490 persist)·형제 상속(22517 sibling 복사)은 그대로 둔다**(다른 코호트-grain 도구가 의존할 수 있음). 오직 `loadCsvFromTool`(22525)·`_applyDemoToCsvState`(22678)가 **그 값을 7로 덮어쓰는 라인만** 제거(또는 no-op화)해 UI state(`MON_STATE.cohort`)와 충돌 안 하게 한다. 3128 기본값도 유지. **단순 삭제(키 제거) 금지** — 형제 상속·스냅샷에서 키가 사라지면 코호트 grain 공유 동작이 깨진다.

**주의(함정)**
- **navigate 재렌더 함정의 변종** — 토글이 in-memory state만 바꾸면 `page_5_2` 최상단 `loadCsvFromTool`이 즉시 덮어씀. persist(A+B)하거나 별도 state(C)로 격리해야 살아남음.
- **데모 모드 별도 경로** — `_applyDemoToCsvState`(22678) 하드코딩 때문에 실CSV만 고치고 데모 놓치면 데모 미리보기에서 여전히 D7 고정. 사용자가 데모로 테스트할 가능성 큼(§12.32).
- **소비처는 calculateKPIs 한 곳뿐** — 리텐션 탭(`WIDE_RET_STATE.anchor`)·마투레이션(`COHORT_MAT_STATE`)은 완전 별개 state. 본 수정이 그쪽을 안 깬다.
- **산식·골든 무변경** — calculateKPIs 산식 손대지 않으므로 in-page golden byte-동일.

**검증**
- Node inject(**실재**): `/tmp/test_reset.js`(set 14 → 리셋 재현), `/tmp/test_cohort.js`(distinct 산식 확인). **수정 후**: navigate → page_5_2 top loadCsvFromTool → calculateKPIs 순서를 모사, set 14가 읽는 시점까지 14 유지(실CSV·데모 둘 다).
- **회귀 기준**: in-page `window.runQualityTests()`·`window.runMaturationTests()` 등 코호트 관련 golden 통과(byte-동일). `/tmp/validate_mon.js`는 **존재하지 않으므로 참조하지 말 것** — 필요하면 신규 작성.
- **브라우저 확인 필수**: ① 실CSV에서 D0/D7/D14 클릭 시 §2 매출/결제/CPA/ROAS/ARPU·§1 잔존율 변화+active 이동 ② **데모 모드**에서 동일 ③ 단일 지표 불변 ④ 토글 후 매핑 details 펼침·sticky 필터 상태 유지.
- syntax check.

**수용 기준**
- [ ] D0/D7/D14 클릭 시 코호트 의존 KPI·잔존율 변경, active 버튼 이동
- [ ] **데모 모드에서도 동작**
- [ ] 단일 지표(비용/설치/CPI/CTR/CVR) 불변
- [ ] in-page golden byte-동일

---

## 항목 6 — 리텐션 §1 표 헤더·값 정렬 불일치 수정

**상태**: 버그픽스 (매우 작음)

**현재 동작**
코호트(장기가치) 탭 §1 '전체 리텐션 곡선' 표(`renderWideRetentionSection`, `16546-16573`)에서 잔존율·잔존 유저 수 컬럼의 헤더는 우측 정렬(th 인라인 `text-align:right`, `16568`)인데 값은 좌측(td는 `class="tnum"`만, `16554-16556`). `.tnum`(106)은 `font-variant-numeric: tabular-nums`만 정의하고 `text-align`을 안 줘서 td가 HTML 기본값(좌측). 구간 컬럼은 둘 다 좌측이라 우측 2개 컬럼에만 미스매치.

**문제**
PR #171(§12.38) 의도("class=data+tnum으로 정렬 일관화, 헤더 우측+값 우측")와 어긋남 — td 우측 정렬이 누락됨.

**변경 위치**

| 심볼 | 종류 | 줄 | 메모 |
|---|---|---|---|
| `renderWideRetentionSection` | function | 16546-16573 | §1 표 생성 |
| `tableRows` | 지역변수 | 16554-16556 | 모든 td가 `class="tnum"`만 → 좌측 |
| thead th 인라인 | markup | 16568 | 잔존율·survLabel이 `text-align:right` |
| `.tnum` CSS | css-rule | 106 | text-align 없음 |

**구현 단계 — 옵션 A 권장(최소·PR#171 의도 부합)**

1. `index.html:16554-16556` — 잔존율·잔존 유저 수 td에 `style="text-align:right;"` 부여:
   - `<td class="tnum">${fmtPct(p.retentionRate)}</td>` → `<td class="tnum" style="text-align:right;">...`
   - `<td class="tnum">${(p.survivors||0).toLocaleString()}</td>` → `<td class="tnum" style="text-align:right;">...`
   - 구간 td(첫째)는 좌측 유지(헤더도 좌측).
2. 헤더(16568)는 이미 우측 — 무수정.

**대안(옵션 A-클래스화, §5.2 CSS 재사용)**: 106줄 부근에 `#s-retention table.data thead th.r, #s-retention table.data tbody td.r { text-align: right; }` 추가하고 th 2개·td 2개에 `class="r"` 부여. **반드시 섹션 id로 스코프 좁힐 것**(전역 `td.r`은 140+ 표에 영향).

**대안(옵션 B, 비권장)**: 헤더를 좌측 통일 — 16568 th의 `text-align:right` 제거. 숫자 좌측은 가독성↓·PR#171 의도 반대.

**주의(함정)**
- **전역 CSS 부작용** — 옵션 A-클래스화에서 `table.data tbody td.r`을 전역으로 만들면 다른 표에 영향. `#s-retention` 스코프 필수. 인라인(옵션 A)이 부작용 0이라 가장 안전.
- **§3 리텐션 예측 표(`renderWideRetPredictSection`, 16612-16615)도 동일 패턴** — th 우측+td 정렬없음. 요청은 §1 한정이나 같이 맞추면 한 PR로 일관성↑(범위 결정).
- **순수 표시층** — `buildWideRetentionCache` 무변경, 데이터 검증 byte-동일. innerHTML script 함정 무관(CSS/인라인style이라 script 의존 없음).

**검증**
- Node inject: `renderWideRetentionSection`을 code+inject로 스코프 주입(§12.29), 반환 HTML 문자열 검사 — (1) 우측 th 2개 유지 (2) 잔존율·잔존 유저 수 td에 `text-align:right` 추가됨 (3) 구간 th/td 좌측. wrc는 `{day,retentionRate,n,survivors}` 더미 + `anchor='installs'`로 스텁.
- syntax check.
- **브라우저 확인 권장**(시각): 5-2 → 코호트 §1 표 헤더와 숫자가 같은 우측 가장자리 정렬, anchor 토글(설치/가입) 전환 시 유지.

**수용 기준**
- [ ] §1 표 잔존율·잔존 유저 수의 헤더·값이 모두 우측 정렬
- [ ] 구간 컬럼은 좌측 유지
- [ ] 데이터 검증 byte-동일

---

## 항목 7 — 세그먼트 효율 매트릭스 색상(나쁜 값=빨강)

**상태**: 버그픽스(확인) — **요청 기능이 이미 구현됨, 신규 코드 0줄**

**현재 동작**
세그먼트 효율 매트릭스(`renderSegmentMatrix`, `18026-18049`, segment 탭)는 **이미 지표 방향(`better`)을 반영**해 셀 배경을 칠한다. `cellBg`(18033-18040): `t=(v-vmin)/span`(0..1) → `better==="low"`면 `t=1-t` 반전 → t=1(좋음)일 때 초록 `rgba(60,180,90,0.18)`, t=0(나쁨)일 때 빨강 `rgba(248,34,90,0.18)`. `SEGMENT_METRICS`(17965-17972)의 `better`: cpi/cpa=`"low"`, roas/ctr/cvr=`"high"`, cost=`"none"`(색 없음). **요청 사양과 코드 일치.**

**문제(또는 목표)**
신규 구현 불필요. 사용자가 "다르게 보였다"고 느낀 원인 확정이 우선. 미세 개선 여지(요청 범위 밖, 옵션):
- 현재는 **분포 기반 상대 그라데이션**(min/max) — 전부 우수해도 최악 셀이 빨강(절대 기준 아님).
- blue 채널 90 고정이라 중간값(t≈0.5)이 탁한 갈색.
- outlier 셀이 vmin/vmax를 끌어당김(robust 아님).

**변경 위치**

| 심볼 | 종류 | 줄 | 메모 |
|---|---|---|---|
| `SEGMENT_METRICS` | const | 17965-17972 | better 방향 정의 — 변경 불필요 |
| `renderSegmentMatrix` | function | 18026-18049 | vmin/vmax 계산·cellBg 적용 |
| `cellBg` | inner arrow | 18033-18040 | ★ 이미 방향 반영 정상 |

**구현 단계 — 먼저 확인, 개선은 선택**

1. **(필수) 현 동작 브라우저 확인** — 5-2 → segment 탭(또는 데모). 지표 pill CPI→ROAS 토글하며 색이 방향대로 바뀌는지 육안 확인. 사용자에게 "이미 동작 중"임을 알리고 스크린샷으로 원인 확정.
2. **(선택 A, ~3줄)** 중간색 정리: 18038 blue 고정 90을 t에 따라 보간하거나 중간 흰색 경유 2단계 보간.
3. **(선택 B, ~4줄)** robust 스케일: 18032 vmin/vmax를 p10/p90 분위수로 교체 + t를 [0,1] clamp.
4. **(선택 C, ~2줄)** 캡션 방향 명시: 18048에 `${met.better==='low'?'(낮을수록 우수)':met.better==='high'?'(높을수록 우수)':''}` 추가.

**주의(함정)**
- **★ 신규 코드 추가 전 반드시 현 동작 확인** — '없는 기능'으로 오인해 중복 로직 추가 시 회귀.
- `met.better==='none'`(cost) → transparent. 개선 시 이 가드 유지.
- 색 입력 `v`(`segmentMetricValue` raw 비율)와 표시값 `met.fmt(cell)`은 분리 — 색 수정 시 fmt 건드리지 말 것.
- blue 90 + 0.18 alpha라 다크 테마 채도 낮음. 선명하게 바꾸면 텍스트 대비 동시 점검(§5.2).
- `s-matrix` id가 3곳(18008 세그먼트·4826 SOP·10447 Concept Matrix). 수정 대상은 `renderSegmentMatrix`(18026) 하나뿐, 나머지 건드리지 말 것.

**검증**
- Node inject(cellBg 로직): `better:'low'` → cellBg(vmin) 초록(r<g)·cellBg(vmax) 빨강(r>g), `better:'high'`는 반대. cellBg가 클로저라 함수 본문을 inject-scope 평가하거나 `renderSegmentMatrix` 출력 HTML의 td background rgba 정규식 파싱.
- 개선 B 적용 시 `window.runSegmentTests()`(18056~) 재실행(색 미검증이면 통과).
- **브라우저 확인 필수**: 색 그라데이션 시각 품질(중간색 탁함·다크 대비)은 headless 불가.

**수용 기준**
- [ ] 현 동작이 의도대로임을 브라우저로 확인, 사용자에게 보고
- [ ] (개선 진행 시) 택1한 옵션 A/B/C 적용 + `window.runSegmentTests()` 통과

---

## 항목 5 — LTV:CAC에 D360(및 미마감 D180) 예측 모델 + 마감 미달 info 툴팁 + LTV D0~D360 차트

**상태**: 구현 (단, 작업 A 예측 모델은 옵션 B/C 결정 선행 / 작업 B·C는 즉시 구현 가능)

**현재 동작**
'장기 가치'(ltv) 탭 = `monLtvCacBody()`(17454) + `monMaturationBody()`(18398). LTV:CAC 쪽(`buildLtvCacCache` 17399)은 단위별 cost·denom·rev0/rev7/rev14만 집계하고 `LTVCAC_MATH.fitCumArpu(pts)`(17363)에 **D0/D7/D14 3점만** 넣어 power 곡선 `y=a·(day+1)^b` 적합. horizon 토글(`LTVCAC_STATE.ltvHorizon`, 기본14, 옵션 `[7,14,30,90,180]` — **D360 없음**, 17469)이 바뀌면 값은 변하나 **D30~D360 실측이 CSV에 있어도 fit에 안 쓰이고 항상 D0/D7/D14 외삽**. 차트는 LTV·maturation 양쪽 모두 없음(표만). 사용자 "안 변함"의 실체 = (a) 고-Dn 실측 미반영 (b) D360 옵션 없음 (c) maturation은 별개 동작.

**목표**
(A) LTV:CAC에 D360·미마감 D180 예측 모델("이전 기간 delta로 미마감 예측") (B) 예측 사용 시 LTV(Dn)/user에 info 아이콘+미마감 고지 툴팁 (C) LTV D0~D360 차트(단위·horizon 필터 공유, horizon=D180이면 차트 D180==표 D180).

**변경 위치**

| 심볼 | 종류 | 줄 | 메모 |
|---|---|---|---|
| `LTVCAC_STATE` | const | 17357 | horizon 옵션에 360 추가 |
| `LTVCAC_MATH.fitCumArpu` | method | 17363-17380 | D0/7/14만 — 예측 모델 개선 핵심 |
| `LTVCAC_MATH.paybackDay` | method | 17382-17388 | fit 바뀌면 자동 반영(골든 T2 주의) |
| `buildLtvCacCache` | function | 17399-17451 | rev0/7/14만 집계(17414-17416) → 전 Dn 확장 |
| `monLtvCacBody`/`renderLtvCacTable` | function | 17454-17517 | horizon pills(17469)·LTV/user 셀(17504) |
| `bindLtvCacHandlers` | function | 17519-17528 | renderLtvCacChart·PNG 추가 지점 |
| `runLtvCacTests` | function | 17530-17556 | 골든 T1~T5 |
| `MATURATION_MATH.empiricalRatios` | method | 18305-18319 | 비율법 재사용 후보(C안) |
| `renderWideRetCharts` | function | 16493-16528 | D0~D360 곡선 차트 템플릿 |
| `mmmTip`/`bindMmmInfoOnce` | function | 13333/14293-14316 | 호버 툴팁 — 5-18 전용 바인딩(함정) |
| `bindCSVPageHandlers` | function | 19385-19620 | 19574 wide-ret-curve 패턴 미러 |
| `_demoEfficiencyData` | function | 22579-22607 | revenue_d0~d360 전부 존재(미마감 없음) |

**★ SSOT 단일 함수 규약 (옵션 무관 필수)**
표 LTV(Dh) 셀(`renderLtvCacTable` 17504)과 차트의 D{h} 포인트(`renderLtvCacChart`)는 **반드시 동일한 단일 함수** `LTVCAC_MATH.ltvPredict(unit, day)`(또는 동등 단일 진입점)를 호출한다. 옵션 A/B/C 어느 것을 택하든 **이 함수 하나만 교체**하고 표·차트는 그 함수를 공유 호출하므로, `horizon=D180`일 때 차트 D180 포인트와 표 LTV(D180) 셀이 같은 산출식에서 나와 byte 일치한다. 표 셀이 `fit.predict(180)`을, 차트가 별도 보간식을 쓰는 식의 **이중 구현을 금지**한다.

**작업 A — 예측 모델 (design-only, 옵션 결정 필요)**

> **⛔ 사용자 결정 전 코드 작성 금지 — 아래 옵션 표·골격은 결정 후 참고용일 뿐.**
> `buildLtvCacCache`에서 rev0/7/14만 집계하는 부분을 `ALL_DNS=[0,7,14,30,60,90,180,360]` 전체로 확장(17410-17416 패턴 복제, hasN 플래그) + 단위별 관측 Dn 집합 저장. 어느 옵션이든 horizon pills(17469)에 360 추가.

| 옵션 | 방법 | 장점 | 단점 |
|---|---|---|---|
| A (최소) | fitCumArpu 유지 + 라벨만 '실측/외삽' 구분 | 수학무변·골든 영향 적음 | 고-Dn 실측 미활용, 정밀도 낮음 |
| **B (권장: 정밀)** | fitCumArpu에 관측된 모든 Dn 넣어 곡선 적합 → 미마감(D180/D360)만 외삽 | 실측 최대 활용·payback 정확 | fitCumArpu·runLtvCacTests 수정, 곡선 안정성 |
| **C (권장: 일관)** | `MATURATION_MATH.empiricalRatios` 재사용 — `arpu[base]×ratio[d]` | 같은 페이지 ROAS 성숙도와 방법론 통일·친숙 | 비표준 Dn은 비율 없음(LTV pills는 표준이라 OK), 곡선보다 거침 |

**옵션별 골든(runLtvCacTests T1~T5) 영향 — 사전 명기**

| 옵션 | T1~T5 영향 | expected 갱신 |
|---|---|---|
| A | **무변**(fitCumArpu 입력·산식 그대로, 라벨만 추가) | 불필요 |
| B | fitCumArpu 입력 points가 3점→N점으로 바뀌어 **T2(paybackDay)·T5(predict 값)** 변동 가능. T1(곡선 형태)·T3/T4(항등식류)는 합성 입력 설계에 따라 영향. | **T2·T5 expected 재계산** 필요. 신규 T6(관측마감 판정)·T7(표=차트 SSOT) 추가 |
| C | 비율법으로 산출 경로 자체가 달라져 **T5(predict)** 변동. payback도 곡선 아닌 비율 기반이면 T2 재정의. | **T2·T5 expected 갱신** + 비율법 전제 골든 추가 |

**작업 B — 미마감 info 툴팁 (구현 가능)**
1. `renderLtvCacTable`(17504) LTV(D${h})/user 셀에서, 선택 horizon이 그 단위 관측마감 Dn 초과 시(=예측) 값 옆에 info 아이콘.
   - 방법1(코드베이스 일관): `mmmTip('이 단위는 D{마감}까지만 실측·D'+h+'는 미마감 구간. 이전 Dn 추이로 예측한 값. 실측 누적되면 재확인.')`. **단 `bindLtvCacHandlers` 또는 `bindCSVPageHandlers`에 `bindMmmInfoOnce()` 1회 호출 추가 필수**(아래 함정).
   - 방법2(의존성 0): 네이티브 `title=` 또는 §2 캐션(17513)에 'ⓘ=미마감 예측' 범례.
2. 표 §2 제목(17487)·캐션에 전역 고지 1줄 권장.

**작업 C — LTV D0~D360 차트 (구현 가능)**
1. `monLtvCacBody`/`renderLtvCacTable`에 `<section id="s-ltv-curve">...<canvas id="ltvcac-curve"></canvas>` + PNG 버튼 `data-pngdownload="ltvcac-curve"`. `page_5_2` ltv toc(6347)에 `{id:"s-ltv-curve"}` 추가.
2. `buildLtvCacCache`에 차트용 곡선 `{day,ltv,predicted}` 저장. **예측은 ★SSOT 규약의 `LTVCAC_MATH.ltvPredict(unit,day)` 단일 함수 호출** → 표·차트가 같은 함수라 horizon=D180 지점이 표 LTV(D180)과 byte 일치.
3. `renderLtvCacChart()` 신규 — `renderWideRetCharts`(16493) 템플릿, labels=`D${day}`, y=LTV(원), 실측 실선/예측 점선, `interaction:{mode:"index"}`.
4. `bindCSVPageHandlers`(19574 패턴): `if(document.getElementById('ltvcac-curve')) renderLtvCacChart();`. PNG 핸들러는 `bindLtvCacHandlers`(17676 패턴).

**주의(함정)**
- **innerHTML `<script>` 미실행(§12.37)** — 차트를 `monLtvCacBody` 반환 HTML 안 `<script>`로 그리면 영구 공백. **신규 차트 함수는 내부에서 canvas 존재 가드 후 그리고, bind에서 호출**(아래 차트 호출 패턴 규약 참조).
- **mmmTip 리스너 스코프 함정** — 호버 툴팁 리스너(14302-14315)는 `bindMmmInfoOnce`(14293) 안에 있고 `bindMmmMethHandlers`(15376=5-18 전용)에서만 호출. **5-18을 안 거친 채 5-2 ltv 직접 진입 시 마우스오버 무반응.** mmmTip 쓰려면 `bindLtvCacHandlers`/`bindCSVPageHandlers` 초입에 `bindMmmInfoOnce()` 호출 추가(`window.__mmmInfoBound` 가드라 중복안전). 또는 네이티브 `title=`로 회피.
- **캐시 무효화** — 차트용 곡선은 horizon 독립이니 `ltvcacCacheKey`(17392)에 horizon 안 넣는 게 맞음(토글마다 곡선 재계산 낭비 회피). horizon 토글은 핸들러가 `LTVCAC_CACHE.key=null` 강제무효화.
- **데모 마감 미시연** — `_demoEfficiencyData`(22597)는 revenue_d0~d360 전부 채워 미마감 구간이 없음 → 예측 UI·info 아이콘이 데모에선 안 나타날 수 있음. 데모로 시연하려면 데모 일부 행의 고-Dn(D180/D360)을 비워야 함(데모 빌더만 수정, ~5줄).
- **ltv 탭 = 두 섹션 공존** — 차트 canvas id·CHART_INSTANCES 키가 maturation 쪽과 안 겹치게 `ltvcac-` 고유 prefix.
- **payback 자동반영** — fit 변경 시 `paybackDay`(17433)도 재계산(골든 T2 영향 주의).
- **§8 미마감 고지 필수** — 비전문가 평어로 "미마감→예측" 명시(§9 PR#59).

**차트 호출 패턴 규약 (코드베이스 표준 — #5·#3·#4·#8 공통)**
신규 차트 함수는 **내부에서 canvas 존재 가드 후 그린다**(`const cv=document.getElementById('id'); if(!cv) return;`). bind에서는 **무조건 호출(funnel 17940 패턴) 또는 element 가드 후 호출(19574 패턴) 둘 다 허용** — 둘 다 동작한다. **단 인라인 `<script>`로 그리는 것은 절대 금지**(innerHTML 미실행, §12.37).

**검증**
- Node inject(/tmp, **신규 작성**): ① horizon 토글별 LTV 변화 ② 관측마감 Dn 초과 시 `predicted=true` ③ **horizon=D180일 때 차트 D180 값 == 표 LTV(D180) byte 일치**(검증 시 표 셀 산출식과 차트 dataset 생성식이 **같은 `ltvPredict` 함수 참조인지 코드상 확인**) ④ 결정론. `_demoEfficiencyData` fixture.
- `runLtvCacTests`(17530)에 T6(관측마감 판정)·T7(표=차트 SSOT) 추가. 기존 T1~T5는 위 '옵션별 골든 영향' 표대로 갱신.
- syntax check + 기존 in-page golden(`window.runMaturationTests()` 등) 회귀.
- **브라우저 확인 필수**: ① 차트 렌더 ② horizon 토글 시 차트·표 동시 갱신+D180 일치 ③ info 툴팁(5-2 직접 진입 시나리오 포함) ④ 데모 예측 UI ⑤ 단위 필터 동기.

**수용 기준**
- [ ] horizon pills에 D360 추가
- [ ] (옵션 결정 후) 미마감 Dn에 예측 모델 적용, 마감 판정 정확
- [ ] LTV(Dn)/user 미마감 셀에 info 아이콘+고지 툴팁(리스너 바인딩 확인)
- [ ] LTV D0~D360 차트, horizon=D180 시 차트==표 byte 일치(단일 `ltvPredict` 함수 공유)
- [ ] 골든 회귀 없음(옵션별 expected 갱신 반영) + syntax check

---

## 항목 3 — 스코어카드 탭형 드릴다운 (D7/D14/D28, D30 제거 + 목표주 vs 비교주 일별 차트)

**상태**: 구현 (결정 완료 2026-06-22 — 아래 골격대로 착수 가능)

> **✅ 결정 확정 (2026-06-22)**
> - **차트 형태 = 혼합**: raw 지표(비용/설치/액션)는 **막대(bar)**, 비율 지표(CPI/CPA/CVR/ROAS)는 **선(line)**.
> - **비용(cost) 카드 클릭 = 허용** (예산 일별 증가량이 핵심 목적).
> - **데이터 부족(2×W 미달) = 있는 만큼 그리고 경고** (숨기지 않음).
> - 기본값으로 진행할 세부(미질문): 비교주 = 목표주 직전 동일 길이 구간(`slice(-2*W,-W)`, WoW 가정) · 목표주/비교주 경계는 **색 구분 + 세로 구분선** · 단일구간 모드 토글은 **두지 않음**.

**현재 동작**
'모니터링' 그룹 '스코어카드' 탭(`monScorecardBody()`, `18089-18137`). `SCORECARD_STATE = { windowDays: 7 }`(18088) 단일 상태. 윈도우 pill `[7,14,28,30]`(18119). `buildDailyAgg()`(18074)로 일별 집계 → `recent=daily.slice(-W)`, `prev=daily.slice(-2*W,-W)`로 WoW 2구간 비교. `agg()`(18095-18100)로 파생지표 → cards 배열. **카드는 정적 텍스트, 클릭 불가, 일별 차트 없음.** (힌트의 `buildScorecardCache`·`SCORE_STATE`는 코드에 없음 — 실제는 `SCORECARD_STATE`, 캐시 없음.)

**목표**
① 윈도우 pill에서 D30 제거(→ D7/D14/D28) ② 지표 카드 클릭 가능 ③ 클릭 시 그 지표 일별 데이터를 윈도우 2배 기간으로, 앞 절반(목표주=최근 W일) 파랑·뒤 절반(직전 비교주 W일) 주황 색구분. 매핑 D7→14일·D14→28일·D28→56일.

**변경 위치**

| 심볼 | 종류 | 줄 | 메모 |
|---|---|---|---|
| `SCORECARD_STATE` | const | 18088 | `selectedMetric` 추가 |
| `monScorecardBody` | function | 18089-18137 | pill 배열·cards 클릭속성·차트 섹션 |
| `agg`(클로저) | closure | 18095-18100 | 일별 파생도 동일 공식 재사용 |
| `buildDailyAgg` | function | 18074-18085 | 오름차순 정렬·getMappedRowsForMon 기반 |
| `bindScorecardHandlers` | function | 18138-18141 | metric 핸들러+차트 직접 호출 추가 |
| `renderFunnelTrendChart`/`renderAnomalyChart` | 참조 패턴 | 17920/18224 | 일별 차트 미러 |
| `runScorecardAnomalyTests` | test | 18256-18275 | ANOMALY_MATH만 검증 |

**옵션 + 트레이드오프 (결정 필요)**

| 옵션 | 결정 사항 | A | B | 권장 |
|---|---|---|---|---|
| 차트 형태 | bar vs line | 막대 — '예산 증가량·일별 상승' 직관 | 선 — 비율(CPI/CVR) 추이 자연 | **혼합**: raw(cost/inst/act)는 bar, 비율은 line (~3줄) |
| cost 클릭 | 허용 여부 | 허용 — '예산 증가량'이 핵심 목적 | better:none이라 제외 | **허용** |
| 데이터 부족 | 2*W 미만 | 있는 만큼 그리고 경고 | 숨기고 callout | **D1(있는 만큼+경고)** |

**추가 결정 질문**
- '직전 비교주' 정의: 목표주 직전 동일 길이 구간(slice(-2*W,-W)) = WoW 동일 가정이 맞는지(전년/전월 동기간 아님)?
- 목표주/비교주 경계 시각: 색 구분만 vs 세로 구분선/배경 음영 추가?
- 단일 구간 모드(목표주만 W일) 토글도 둘지?

**구현 골격 (결정 후 착수, ~60~90줄)**
1. `18119` — `[7,14,28,30]` → `[7,14,28]`. 18091 직후 `const W = [7,14,28].includes(SCORECARD_STATE.windowDays)?SCORECARD_STATE.windowDays:7;` 클램프(D30 잔존 방어).
2. `18088` — `{ windowDays: 7, selectedMetric: null }`.
3. 18122-18133 카드에 `data-score-metric="${c.k}"` + `cursor:pointer` + active 테두리.
4. selectedMetric!=null이면 `<section id="s-score-daily"><canvas id="scorecard-daily-chart">` 추가(anomaly 18206-18209 복붙).
5. `dailySeries(metricKey) = buildDailyAgg().slice(-2*W).map(...)` — 일별 파생 공식은 `monAnomalyBody` seriesVal(18165-18175)·sv(18250)과 동일.
6. `renderScorecardDailyChart()` 신설(`renderFunnelTrendChart` 미러, **차트 호출 패턴 규약 준수 — 내부 canvas 가드, 인라인 script 금지**): destroyChartIfExists → **pointBackgroundColor/pointBorderColor 인덱스 배열**(앞 W개 주황 #fbbf24=비교주, 뒤 W개 파랑 #adc6ff=목표주) → CHART_INSTANCES 저장.
7. `bindScorecardHandlers`: `[data-score-metric]` 클릭(재클릭 토글 닫기, navigate('5-13')) + PNG 핸들러 + **끝에 `renderScorecardDailyChart()` 직접 호출**.

**주의(함정)**
- **시간순 정렬** — `buildDailyAgg`는 오름차순(과거→최근). `slice(-2*W)`의 **앞 W개=과거=비교주(주황)**, **뒤 W개=최근=목표주(파랑)**. WoW의 recent=slice(-W)와 부호 일치 확인. 색 라벨 반대로 칠하지 말 것.
- **innerHTML `<script>` 미실행(§12.37)** — HTML 문자열 `<script>`로 그리지 말 것. `bindScorecardHandlers`에서 직접 호출.
- **navigate 재렌더가 destroyAllCharts(19264) 호출** — 매 재렌더 차트 재생성 필요. data-score-metric 클릭 → navigate('5-13') → 5-2 redirect, 같은 hash라 스크롤 보존(§7 PR#35).
- **일별 비율 NaN** — cpi/cvr/roas 분모 0인 날 null. pointBackgroundColor 배열 길이를 series.length와 정확히 맞춤(null 점도 인덱스 차지).
- **매핑 해제 reset** — selectedMetric이 매핑 해제 지표를 가리키면 render 전 `cards.find(c=>c.k===selectedMetric)` 없으면 selectedMetric=null(silent reset, §7 PR#37).
- **D30 잔존** — 이전 세션/데모에서 windowDays===30이면 STEP1 클램프로 방어.
- **골든 byte-동일** — ANOMALY_MATH·buildDailyAgg 수학 무변 → `window.runScorecardAnomalyTests()` 불변.

**검증**
- Node inject(§12.22 repro): `monScorecardBody`·`bindScorecardHandlers`·`renderScorecardDailyChart`·`buildDailyAgg`를 code+inject로, 합성 60일 CSV로 ① selectedMetric=null 렌더 throw 없음 ② 'cpi'·windowDays 7/14/28 각각 throw 없음 ③ Chart 스텁으로 dataset.pointBackgroundColor 배열 길이==series, 앞 W개 주황·뒤 W개 파랑 ④ slice(-2*W) 분할 인덱스.
- 데이터 부족(10일+D28) throw 없이 경고/skip. 매핑 해제 silent reset.
- `window.runScorecardAnomalyTests()` 4 케이스 ✓.
- **브라우저 확인 필수**: D30 없음·카드 클릭→차트 등장/재클릭 닫힘·앞 주황/뒤 파랑·기간 2배·sticky 필터 반영·PNG·스크롤 유지.

**수용 기준**
- [ ] (결정 후) 차트형태·cost클릭·부족가드 확정
- [ ] pill D7/D14/D28만, D30 없음
- [ ] 카드 클릭 시 일별 차트, 목표주(파랑)/비교주(주황) 색구분
- [ ] `window.runScorecardAnomalyTests()` byte-동일

---

## 항목 4 — 페이싱 월말 착지 예측에 요일 계절성 보정 + 메트릭별 예측 + 액션 정의(가입/구매) 토글

**상태**: 구현 (결정 완료 2026-06-22 — 단, **매출(revenue)은 페이싱에서 제외**)

> **✅ 결정 확정 (2026-06-22)**
> - **요일 프로필 추정 구간 = 최근 4~8주** (데이터 < 2주면 선형 폴백). 요일당 최소 관측 ≥3(미달 요일 보정 비활성).
> - **예측 산출 방식 = A** (요일별 일평균 합산 `mtd + Σ잔여일 wdMean[getDay()]`).
> - **액션 정의 = 라벨/용어만 토글** (가입/구매, `actions` 데이터 동일 — 옵션 X. 별도 컬럼 분리 안 함).
> - **요일 보정 적용 메트릭 = 설치(installs)·액션(actions) 만**. 비용(cost)은 **선형 유지**(원문 '예산 말고 전부 predict').
> - **⚠ 매출(revenue)은 페이싱에서 제외**: 현재 `revenue_d7`은 cohort-window(설치일+7일) 기준이라 "그 날 발생한 매출"이 아니어서 일별 페이싱/착지 예측에 부적합. **revenue 메트릭 pill 자체를 페이싱에서 제거**하고, 일별(캘린더) 매출 페이싱은 **별도 일별 매출 컬럼 업로드를 권장**하는 안내만 남긴다(사용자 추후 결정 — 본 항목 범위 밖).
> - 이로써 페이싱 메트릭 = **cost(선형) · installs(요일보정) · actions(요일보정+가입/구매 라벨)** 3종.

**현재 동작**
'페이싱' 탭(`monPacingBody`, `17604`)은 단일 메트릭(`PACING_STATE.metric` 기본 "cost")에 **순수 선형 run-rate 예측만**. `PACING_MATH.pace(daily)`(17563-17580): `mtd = Σvalue`, `runRate = mtd/daysElapsed`, `projected = runRate × daysInMonth`(윤년 안전 `new Date(y,mo,0).getDate()`, T4 검증). 즉 "남은 날도 일평균대로"라 요일별 변동 미반영. 메트릭 pill cost/installs/actions/revenue(=revenue_d7), 매핑된 키만 활성(17630-17633). '액션'이 가입/구매인지 구분 UI 없음(라벨 '액션' 고정, 17607). 차트(`renderPacingChart` 17656)는 당월 누적 실측+선형 목표선만.

**목표** (결정 반영)
(A) 요일 계절성 보정 예측을 **설치·액션**에 적용 (B) 액션=가입/구매 **라벨 토글** (C) **매출 메트릭은 페이싱에서 제거** + 일별 매출 별도 업로드 권장 안내. 비용은 선형 유지.

**변경 위치**

| 심볼 | 종류 | 줄 | 메모 |
|---|---|---|---|
| `PACING_STATE` | const | 17562 | forecastMode·actionDef 추가 후보 |
| `PACING_MATH` | const(순수함수) | 17563-17580 | `pace` 1개 — `paceWeekday` 추가 |
| `pacingCacheKey` | function | 17582-17586 | ⚠ **MON_FILTER_KEY 미포함(기존 버그)** |
| `buildPacingCache` | function | 17587-17603 | 요일 예측 사전계산해 캐시 |
| `monPacingBody` | function | 17604-17655 | metricLabel(17607)·pill·토글 |
| `renderPacingChart` | function | 17656-17670 | 요일 예측 점선 dataset 후보 |
| `bindPacingHandlers` | function | 17671-17678 | 토글 핸들러+차트 직접 호출 |
| `runPacingTests` | function | 17679-17692 | T1~T4 골든 |
| `CANNIBAL_STATS.weekdayDetrend` | function | 7939-7954 | ★ 7요일 버킷 평균 재사용 자산 |
| `STANDARD_FIELDS` | const | 2997-3031 | actions(3007)·revenue_d7(3011)·revenue_d0(3008) |

**옵션 + 트레이드오프 (결정 필요)**

| 결정 | 옵션1 | 옵션2 | 옵션3 | 권장 |
|---|---|---|---|---|
| 요일 프로필 추정 구간 | 당월만(노이즈 큼) | 최근 N주(4~8주, 안정·추세지연) | 당월 우선+부족 요일만 과거 | **옵션2** (데이터<2주면 선형 폴백) |
| 예측 산출 방식 | A: 요일별 일평균 합산 `mtd+Σ잔여일 wdMean`(직관·견고) | B: 요일계수 가중 run-rate | — | **A** |
| 액션=가입/구매 범위 | X: 라벨/용어만 토글(데이터 동일 actions, 저비용) | Y: STANDARD_FIELDS에 registrations·purchases 별도 키(진짜 분리, 매핑·게이트·골든 광범위) | — | **X** |

**추가 결정 질문**
- revenue 메트릭 요일 예측 시 revenue_d7(cohort-lag, 현재) 유지 vs revenue_d0(캘린더일 매출, 의미상 맞음)? 사용자 CSV가 d0 매핑하는지 확인.
- cost(예산)에도 요일 예측 적용? 사용자 원문 '예산 말고는 전부 predict'라 cost는 선형 유지, installs/actions/revenue만 요일 모드가 의도에 부합(확인).
- 요일 가드 임계값: 요일당 최소 관측 N(권장 ≥3, ~3주). 미만이면 선형 폴백+⊘.

**구현 골격 (확정: 추정구간=최근4~8주 / 산식=A / 액션=라벨토글 / 설치·액션만·매출 제외, ~80~140줄)**
0. **매출 메트릭 제거** — 메트릭 pill 배열(17630-17633 부근)에서 `revenue`(=revenue_d7) 항목 제외. 대신 그 자리(또는 캐비엇 영역)에 1줄 안내: "일별 매출 페이싱은 cohort-window(revenue_d7)가 아닌 **일별(캘린더) 매출 컬럼**이 필요합니다 — 별도 업로드 예정". `PACING_STATE.metric` 기본값이 revenue면 cost로 클램프. 요일 보정은 installs·actions에만 적용(cost·잔여 메트릭은 선형).
1. `17562` — PACING_STATE에 `forecastMode:'linear', actionDef:'registration'`.
2. `17563` — PACING_MATH에 순수함수 `weekdayProfile(daily)`(weekdayDetrend 7939 버킷 차용, raw value의 요일 평균/표본수)·`paceWeekday(daily, opts)`(당월 잔여일 순회 `wdMean[getDay()]` 합산, 부족 시 `{fallback:true}`).
3. `17587` — buildPacingCache에서 linear·weekday 둘 다 사전계산해 캐시(토글=lookup만, §12.4).
4. `17582` — pacingCacheKey에 `|mode:${forecastMode}|act:${actionDef}|${MON_FILTER_KEY()}` 추가. **MON_FILTER_KEY 누락 버그 같이 수정.**
5. `17604` — 메트릭 pill 아래 예측방식 토글(data-pacing-mode), metric==='actions'일 때만 액션정의 토글(data-pacing-actiondef). metricLabel(17607)을 actionDef로 분기(가입/구매). 요일 모드 데이터부족 시 disabled+캐비엇.
6. `17656` — 요일 모드면 '예측 착지(요일보정)' 점선 dataset. **bindPacingHandlers 내 직접 호출 유지(차트 호출 패턴 규약).**
7. `17671` — data-pacing-mode·data-pacing-actiondef 핸들러(STATE 세팅 → PACING_CACHE.key=null → navigate('5-10')).
8. `17679` — T5(요일 균등→linear와 일치)·T6(부족→fallback)·T7(결정론).

**주의(함정)**
- **pacingCacheKey MON_FILTER_KEY 미포함(기존 버그)** — sticky 필터 바꿔도 페이싱 안 바뀜. forecastMode 추가 시 같이 수정.
- **navigate('5-10') → 5-2 redirect**(19203-19204), MON_STATE.tab 유지(스크롤 보존). 토글 핸들러도 STATE→cache.key=null→navigate('5-10') 패턴. MON_STATE.tab 건드리지 말 것.
- **innerHTML `<script>` 미실행(§12.37)** — renderPacingChart는 bindPacingHandlers(17677)에서 직접 호출. 새 dataset도 인라인 script 금지.
- **`new Date('YYYY-MM-DD').getDay()` UTC 파싱** — weekdayDetrend(7943)·dayOfYear(7992)와 동일 패턴이면 일관(0=일). 다른 파싱 쓰면 불일치.
- **요일 표본 부족** — 당월만이면 요일당 4~5개로 노이즈 큼. 과거 N주 권장(§9 데이터양 자동 추천). 부족 시 토글 비활성+⊘(STL 잠금 패턴).
- **액션=가입/구매는 actions 키 1개에 매핑된 동일 시리즈** — 라벨만 변경(옵션 X). 진짜 분리(옵션 Y)면 매핑 UI·게이트·골든 광범위 변경.
- **§8.7 결정론 필수** — Math.random 금지, byte-identical 보장, runPacingTests에 결정론 골든.

**검증**
- Node inject(§12.29 주입식): paceWeekday 합성 데이터로 ① 모든 요일 동일값이면 weekday projected == linear(항등식) ② 특정 요일만 큰 데이터에서 다른 값 정확 산출 ③ 2회 호출 byte-동일 ④ 부족→fallback:true.
- `window.runPacingTests()` T1~T7 통과. syntax check.
- 기타 5-2 탭(viz/scorecard/anomaly/funnel) in-page golden byte-동일(PACING_* 격리).
- **브라우저 확인 필수**: 요일보정 예측선 렌더·토글 클릭 즉시 반영·페이싱 탭 유지·sticky 필터 갱신(캐시키 수정 후).

**수용 기준**
- [x] (결정) 추정구간=최근4~8주 · 산식=A · 액션=라벨토글 · 설치·액션만
- [ ] **매출(revenue) 메트릭 페이싱에서 제거** + 일별 매출 별도 업로드 권장 안내
- [ ] 요일보정 예측 토글(installs·actions), 데이터부족 시 잠금+선형 폴백
- [ ] 비용(cost)은 선형 유지
- [ ] 액션 가입/구매 라벨 토글(데이터 동일)
- [ ] pacingCacheKey에 MON_FILTER_KEY 포함(기존 버그 수정)
- [ ] `window.runPacingTests()` 결정론 골든 추가

---

## 항목 8 — 퍼널 진단에 요일(주말/평일) 계절성 보정 추가

**상태**: 구현 (결정 완료 2026-06-22 — 옵션 C·2그룹·additive)

> **✅ 결정 확정 (2026-06-22)**
> - **접근 = C**: WoW(§1)를 1차 신호로 강조 + §3 급락 탐지에 **요일보정 토글**(`weekdayAdj`, 기본 **OFF**, 데이터 충분 시만 활성).
> - **요일 그룹 = 평일/주말 2-bucket** (7요일 full 아님). `isWeekend = (getDay()===0||getDay()===6)`로 2그룹.
> - **보정 단위 = 요일(그룹) 평균 빼기(additive)**: `cvrAdj = cvr - groupMean[weekend?1:0] + dailyMean` 기준으로 −1σ 급락 재판정 (z-score 아님).
> - 기본값으로 진행할 세부: 가드 = **각 그룹(평일·주말) 최소 관측 ≥3** (미달 시 토글 비활성+⊘) · §4 세그먼트 랭킹은 **1차 미보정**(§3 급락만 보정) · 기본 OFF라 `runFunnelTests()` byte-동일.

**현재 동작**
퍼널 진단(host 5-2 효율진단 그룹 funnel 탭)은 `buildFunnelCache()`(`17706`)에서 선택 전이단계(`FUNNEL_STATE.cvrStep`, 기본 클릭→설치) CVR을 3가지로 진단: (1) **WoW**(17753-17773) — 최근 7 distinct 날짜 vs 직전 7 (2) **시계열 급락**(17775-17787) — 날짜별 CVR이 전체평균−1σ 이하면 `x.low` 플래그 (3) **세그먼트 랭킹**(17789-17797) — 채널/국가/OS별 vs 전체평균. **§3 급락·§4 세그먼트가 요일 무시한 단순 전체 평균** → 평일이 구조적으로 낮으면 거짓 플래그, 진짜 신호 묻힘. `CANNIBAL_STATS.weekdayDetrend`(7939-7954)가 7-bucket 평균 패턴으로 존재하나 퍼널 미적용.

**목표**
요일 효과(평일/주말 CVR 구조 차이)를 보정해 거짓 급락 신호를 줄인다.

**변경 위치**

| 심볼 | 종류 | 줄 | 메모 |
|---|---|---|---|
| `buildFunnelCache` | function | 17706-17807 | daily/dailyMean/dailySd(17775-17787)·segRank(17789-17797) 요일 미보정 |
| `funnelCacheKey` | function | 17701-17705 | 토글 추가 시 `\|w:` 포함 필요 |
| `FUNNEL_STATE` | const | 17699 | `weekdayAdj:false` 추가 |
| `CANNIBAL_STATS.weekdayDetrend` | method | 7939-7954 | 7-bucket(getDay 0=일) 평균 레퍼런스 |
| `renderFunnelWow` | function | 17815-17836 | 옵션 A: WoW 강조·캐비엇 |
| `renderFunnelTrendSection`/`renderFunnelTrendChart` | function | 17851-17861/17920-17935 | §3 급락 차트, bindFunnelHandlers 직접 호출 |
| `renderFunnelControls` | function | 17838-17850 | 요일보정 pill(data-funnel-wadj) |
| `bindFunnelHandlers` | function | 17936-17941 | 토글 핸들러+차트 |
| `runFunnelTests` | function | 17942-17952 | T1~T3 골든 |

**옵션 + 트레이드오프 (결정 필요)**

| 옵션 | 방법 | 분량 | 위험 | 비고 |
|---|---|---|---|---|
| A (최소·안전) | WoW(§1)를 '요일 정렬 1차 신호'로 강조 + §3에 '요일 영향일 수 있음, WoW로 교차확인' 캐비엇 | ~10줄 | 거의 0(수치 불변·골든 byte-동일) | WoW가 7일 단위라 요일 자연 상쇄 |
| B (§3 요일보정 z) | daily의 devPct/low를 전체평균 대신 **같은 요일 평균 대비**로 재정의 + 토글 | ~40~60줄 | 중(요일 표본 부족 시 노이즈, 해석 변경) | weekdayDetrend 패턴 재사용 |
| **C (A+B 결합, 권장 검토)** | WoW 강조(안전) + §3 토글(기본 OFF, 데이터 충분 시만 enable) | ~40~60줄 | 중 | §9 옵션·자동잠금 선호 정합 |

**결정 필요 질문**
1. A / B / C 중? (§9 옵션 선호상 C 자연스러우나 분량·해석 부담 차이)
2. 보정 단위: 요일 평균 빼기(additive, weekdayDetrend 패턴) vs 요일별 z-score(요일별 σ 표준화, 정확하나 표본 더 필요)?
3. 요일 가드 임계값: 요일당 최소 관측 N(권장 ≥3, ~3주). 미만이면 비활성+⊘.
4. 평일/주말 2-bucket vs 7요일 full 프로파일? 사용자 표현('주말/평일')은 2-bucket 시사, 7요일이 정밀(월요일 효과 등). 표본 적으면 2-bucket 안전.
5. §4 세그먼트 랭킹도 보정? **1차는 §3만 권장**(세그먼트×요일 표본 폭발).

**구현 골격 (확정: C · 평일/주말 2그룹 · additive, ~40~60줄)**
1. `17699` — FUNNEL_STATE에 `weekdayAdj:false` (기본 OFF).
2. `17704` — funnelCacheKey return에 `|wadj:${FUNNEL_STATE.weekdayAdj}`. (MON_FILTER_KEY는 이미 포함.)
3. `17776-17787` 직후 — daily 각 x에 `x.weekend = (function(){const d=new Date(x.date).getDay(); return d===0||d===6;})()`. **2-bucket** 평균: `grpMean=[평일 cvr 평균, 주말 cvr 평균]`(유효 cvr만)+표본수 `grpN=[평일N, 주말N]`. 가드 `weekdayAdjOk = grpN[0]>=3 && grpN[1]>=3`(평일·주말 각 ≥3). OK일 때만 additive 보정 `x.cvrAdj = x.cvr - grpMean[x.weekend?1:0] + dailyMean` → 이 `cvrAdj`로 `x.devPctAdj`(=`(cvrAdj-dailyMean)/dailyMean`)·`x.lowAdj`(cvrAdj < dailyMean − dailySd) 재산정. FUNNEL_CACHE에 `weekdayProfile={weekday:grpMean[0],weekend:grpMean[1],nWeekday:grpN[0],nWeekend:grpN[1]}`·`weekdayAdjOk` 저장.
4. `17851-17861`·`17920-17935` — §3 급락 섹션·차트가 `FUNNEL_STATE.weekdayAdj && c.weekdayAdjOk`면 `cvrAdj/devPctAdj/lowAdj` 사용(없으면 기존 cvr/low). 차트 제목·캐비엇에 '요일(평일/주말) 보정됨' 평어(§9 PR#59 콜아웃 패턴: '💡 같은 평일/주말끼리 비교한 결과').
5. `17845-17849`(renderFunnelControls) — 요일보정 ON/OFF pill(`data-funnel-wadj`), `!c.weekdayAdjOk`면 disabled+'평일/주말 표본 부족(각 3일↑ 필요) 🔒'(DETREND_STATE.weekdayOn UI 8205-8207 패턴).
6. `17936-17941`(bindFunnelHandlers) — `[data-funnel-wadj]` 핸들러: `FUNNEL_STATE.weekdayAdj = b.dataset.funnelWadj==='1'; FUNNEL_CACHE.key=null; navigate('5-11');`.
7. `17942`(runFunnelTests) — T4(합성: 평일 낮음·주말 높음 데이터 → 보정 OFF면 평일이 거짓 −1σ로 잡힘, ON이면 사라짐). 기본 OFF byte-동일도 확인.

**주의(함정)**
- **navigate 재렌더** — 토글 핸들러는 `FUNNEL_CACHE.key=null; navigate("5-11")`. 5-11은 navigate(19206)에서 `MON_STATE.tab="funnel"; id="5-2"`로 redirect(같은 hash, 스크롤 보존 §35).
- **캐시 무효화** — 새 토글을 funnelCacheKey(17704)에 안 넣으면 캐시 히트로 재계산 안 됨. MON_FILTER_KEY는 이미 포함.
- **innerHTML `<script>` 미실행(§12.37)** — 차트는 bindFunnelHandlers(17940)에서 `renderFunnelTrendChart()` 직접 호출. 새 dataset 추가 시 destroyChartIfExists(17925) 먼저.
- **요일 파싱 결정론** — r.date는 'YYYY-MM-DD' ISO(데모 22579 toISOString().slice(0,10))라 `getDay()` UTC 결정론. ⚠ 임의 CSV가 'MM/DD/YYYY'면 어긋날 수 있음(weekdayDetrend도 동일 가정).
- **데이터 길이/검정력 가드(§8·§9)** — 요일당 부족(7일치면 요일당 1관측)이면 보정 무의미. 요일당 ≥3 가드로 비활성(STL 18개월 잠금 패턴).
- **WoW 요일 정렬 가정** — uniqDates.slice(-7)이 연속 7일 아니면(결손) 요일 완전 정렬 안 됨 — 옵션 A 캐비엇에서 '연속 영업일' 과신 금지.
- **골든 byte-동일** — 보정은 weekdayAdj ON일 때만. 기본 OFF면 기존 경로 그대로 → `window.runFunnelTests()` T1~T3 byte-동일.
- **해석 변경** — devPct/low가 '요일 보정 후' 의미로 바뀌면 §10 평어 콜아웃('💡 같은 요일끼리 비교한 결과') 필요(§9 PR#59).

**검증**
- Node inject(`/tmp/validate_funnel2.js` 실재 — 갱신): `_demoEfficiencyData()`로 CSV_STATE 세팅 → buildFunnelCache 후 `c.weekdayProfile`(weekday·weekend·nWeekday·nWeekend)·`c.weekdayAdjOk` boolean. 토글 ON/OFF로 `lowAdj` vs `low` 수 변화(ON에서 평일 거짓 급락 감소). 데모 90일+이라 평일·주말 각 ≥3 → weekdayAdjOk=true.
- 결정론: 2회 호출 byte-동일(Math.random 미사용).
- **기본 OFF byte-동일**: weekdayAdj=false에서 daily/dailyMean/dailySd/segRank 현재와 동일(골든 보존).
- `window.runFunnelTests()` T4 추가, 3→4 통과.
- **브라우저 확인 필수**: 차트 요일보정 라인/색·토글 클릭 navigate 재렌더·요일 표본부족 시 disabled.
- syntax check.

**수용 기준**
- [x] (결정) 접근 C · 평일/주말 2그룹 · additive(요일 평균 빼기) · 가드 그룹당 ≥3
- [ ] 요일보정 토글(기본 OFF), 평일·주말 표본 부족 시 잠금+⊘
- [ ] funnelCacheKey에 `wadj` sig 포함
- [ ] WoW(§1)를 1차 신호로 강조(캐비엇 포함)
- [ ] 기본 OFF에서 `window.runFunnelTests()` byte-동일
- [ ] T4 골든 추가(평일 거짓 급락 보정)

---

## 부록 — 구현 순서 권장 (의존성·난이도 기준)

| 순서 | 항목 | 사유 |
|---|---|---|
| 1 | **#7 세그먼트 색상** | 브라우저 확인만(0줄). 원인 확정 + '이미 동작'을 사용자에게 먼저 보고 |
| 2 | **#6 리텐션 표 정렬** | 1~2줄, 의존성 0, 위험 최소. 빠른 win |
| 3 | **#1 Platform 멀티셀렉트** | 소규모(25~35줄), 기존 인프라 재사용. sticky 필터 전반의 일관성 확보 → 이후 항목의 필터 동작 기반 |
| 4 | **#2 코호트 토글 버그** | 소규모, 옵션 C(MON_STATE) 채택 시 navigate 재렌더 면역 — 이후 viz 탭 작업 안전판 |
| 5 | **#5 LTV:CAC 차트·툴팁(작업 B·C)** | 작업 B(툴팁)·C(차트)는 모델 결정 없이 구현 가능. 작업 A(예측 모델 B/C)는 사용자 결정 후 |
| 6 | **#3 스코어카드 드릴다운** | ✅결정 완료(혼합·cost허용·있는만큼+경고). #1의 sticky 필터·차트 패턴 의존 |
| 7 | **#8 퍼널 요일 보정** | ✅결정 완료(C·평일주말 2그룹·additive). weekdayDetrend 재사용, #4와 요일 프로파일 공유 |
| 8 | **#4 페이싱 요일 예측** | ✅결정 완료(최근4~8주·산식A·라벨토글·설치/액션만, 매출 제외). #8의 요일 프로파일 패턴 재사용 |

**병렬화 가능**: #6·#7은 다른 항목과 독립이라 언제든. #4·#8은 요일 프로파일(`CANNIBAL_STATS.weekdayDetrend` 재사용) 로직을 공유하므로 함께 구현하면 효율적.

**결정 게이트**: ~~#3·#4·#8 설계 결정~~ → **2026-06-22 전부 완료**(각 항목 ✅ 박스). 남은 결정은 **#5 작업A(예측 모델 옵션 B/C)** 1건뿐. 그 외 7개 항목(#1·#2·#3·#4·#6·#7·#8 + #5 작업B·C)은 즉시 착수 가능.

**미해결 1건 — #5 작업A 예측 모델**: LTV D360(및 미마감 D180) 예측을 ROAS 성숙도와 동일 메커니즘(옵션 B=경험적 비율법 / C=곡선폴백)으로 할지 선택 필요. #5 작업 B(미마감 info 툴팁)·C(D0~D360 LTV 차트)는 결정 없이 가능.

**별도 보류 — #4 일별 매출 페이싱**: 매출은 페이싱에서 제거하기로 결정. 향후 일별(캘린더) 매출 컬럼 업로드 방식은 사용자 추후 결정(본 스펙 범위 밖).
