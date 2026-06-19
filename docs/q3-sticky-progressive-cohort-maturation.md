# Q3 작업 스펙 — 운영 대시보드 UX 개선 + 코호트 Dn 확장·마투레이션 예측

> **이 문서의 목적**: 다른 모델(실행자)이 컨텍스트 없이 그대로 착수할 수 있는 자체 완결형 스펙.
> 작성: 방향 설계 단계 (구현 전). 모든 파일 참조는 `index.html` (단일 HTML SPA).
> **반드시 `CLAUDE.md` 전체 규칙 준수** — 특히 §2(절대 원칙)·§8(통계 엄밀성)·§11(안티패턴)·§12.30(탭 병합 패턴)·§14(PR 체크리스트).

## 작업 개요 (3개 워크스트림, 독립 PR 권장)

| WS | 제목 | 난이도 | 위험 | 우선순위 |
|---|---|---|---|---|
| **WS1** | 운영 대시보드(5-2) 상단 sticky 필터 바 (날짜 range·platform·국가·channel) | 중 | 중 (실제 파이프라인 필터링 필요) | 1 |
| **WS2** | CSV 업로드 점진적 공개 + 데이터×기능 capability 매트릭스 | 중 | 낮 (render층 위주) | 2 |
| **WS3** | 코호트 Dn 동적 확장(Revenue/Retention/PUR) + 마투레이션 예측 | 높 | 높 (통계 정확성·grain) | 3 |

각 WS는 별도 feat 브랜치 PR로. WS3가 가장 큼 — 내부적으로 PR을 3-A/3-B/3-C로 쪼갤 것(아래 §WS3 참조).

---

## 현재 코드 지형 (조사 완료, 그대로 신뢰 가능)

### 페이지 셸 / 레이아웃
- `pageShell(meta, opts)` — `index.html:3892`. `opts.tocFilters` → 우측 `.toc-filters` 슬롯(`:3910`). 헤더는 `page-eyebrow`→`page-title`→`page-deck`→`meta-row`(chips)→`with-toc`(본문+aside) 순서.
- `.topbar` CSS — `:266`. 이미 `position: sticky; top: 0; z-index: 10` + blur. 홈(`is-home`)에서만 숨김(`:115`).
- `.sidebar` — `:120` `position: sticky; top: 0; height: 100vh`.

### 운영 대시보드 5-2
- `MON_STATE = { tab: "viz" }` — `:6036`.
- `MON_TABS`(9탭) — `:6043`. `MON_TAB_GROUPS`(모니터링/장기 가치/효율 진단) — `:6038`.
- `renderMonTabs()` — `:6054`, `data-mon-tab` 핸들러.
- `page_5_2()` 디스패처 — `:6068`. 게이트(미분석→`renderInlineCsvUpload`) → else `pageShell(body: 매핑 details + renderMonTabs() + 활성탭 body)`.
- 탭 body 함수: `monVizBody`(`:5827`)·`monScorecardBody`(`:16802`)·`monPacingBody`(`:16478`)·`monAnomalyBody`(`:16874`)·`monFunnelBody`(`:16612`)·`monSegmentBody`(`:16718`)·`monCohortBody`(`:6107`)·LTV/maturation은 별도 로직.
- **현재 5-2 효율 탭들은 필터 없음** — `getMappedRows()` 전체를 그대로 사용. 날짜 range/국가/플랫폼/채널 필터 UI 자체가 없음.
- `getMappedRows()` — `:5759`. `CSV_STATE.mapping` 역매핑 → 표준 키 객체 배열. number/percent는 `parseFloat`.
- `ALLOC_FILTER_STATE` — `:6950` (5-3 **전용**, 5-2 아님). 참고용: `objective/unit/selectedCountries/selectedChannelsFilter/platform/applied` 구조.

### CSV 업로드 / 필드 가이드
- `renderInlineCsvUpload(toolId)` — `:21128`. 드롭존 + 매핑 select + **필드 가이드 표**(`:21189`, 필수+옵션, `unlocks` 텍스트 + alias). 파일 로드 시 가이드 표는 `<details>` 접힘(`:21276`).
- `STANDARD_FIELDS` — `:2940` (~95개 키, 각 `{label, aliases, type, required?, group, oneOfGroup?, cohort?}`).
- `TOOL_REQUIRED_FIELDS`/`TOOL_OPTIONAL_FIELDS` — `:20734`. 5-2 필수 = `["date", {oneOf:["installs","actions","cost"]}]`. 옵션 = channel·campaign_name·platform·country·impressions·clicks·actions·revenue_d0/d7/d14·pu_d7·ret_d7 (각 `unlocks` 문구 보유).
- `checkRequiredForTool(toolId)` — `:20962`. 매핑된 키 Set 대비 필수/oneOf 검사.
- **"📌 컬럼을 더 매핑할수록…" 안내 표** — `page_5_2()` 내부 하드코딩 `:6077~6091`. 기능↔필요컬럼 매핑이 여기 1곳, 그리고 각 body 함수의 인라인 `mapped.has(...)` 체크에 흩어져 있음(SSOT 없음).

### 코호트 / LTV / 마투레이션 (WS3 핵심)
- **코호트 도구 5-8** (tall grain) — `QUALITY_CONFIG`(`:15713`), `QUALITY_STATE`(`:15730`), `buildQualityCache()`(`:15793`).
  - grain: **`cohort_date` × `day_offset`** 한 행. 필드: `cohort_date·day_offset·cohort_size·retained_users·cohort_revenue`.
  - **`day_offset`가 이미 임의 Dn** — D0/D7/.../D90/D180 자유롭게 행으로 들어감. 즉 tall 모델은 이미 임의 Dn 지원.
  - 누적 ARPU = `cohort_revenue / cohort_size`, day별 가중평균 → `fitPowerCurve`(`:15744`, y=a·x^b) 또는 `fitLogCurve`(`:15770`, y=a·ln(x)+b)로 외삽 [30,90,180,365].
- **ROAS 성숙도 5-16** (efficiency grain, wide) — `MATURATION_MATH`(`:16993`). 기존 마투레이션 패턴.
  - `fit(points=[{day,roas}])`: log-log 선형회귀 → `predict(d)=a·(d+1)^b`. `maturation90 = pred(90)/roas7` (= 성장 배수).
  - unit(`_all`/channel/campaign)별 cost·revenue_d0/d7/d14 합산 → D0/D7/D14 ROAS 3점 fit → D30/D90/D180 예측.
- **LTV:CAC 5-9** (efficiency grain, wide) — `LTVCAC_CONFIG`(`:16225`), `fitCumArpu`(`:16237`, y=a·(day+1)^b), `paybackDay`(`:16256`). cost·installs/actions·revenue_d0/d7/d14 합산 → ARPU 곡선 → payback.
- **revenue_d0/d7/d14** — `STANDARD_FIELDS:2951`, `{type:number, cohort:0|7|14}`. **wide 컬럼**(행=캠페인-일, D0/D7/D14가 별도 열). 73곳 참조.
- `TOOL_GROUP` — `:20893`. 5-2/5-3/5-9/5-16=`efficiency`, 5-8=`cohort`. navigate redirect `:17725` (5-8→탭 cohort, 5-9→탭 ltv, 둘 다 id=5-2).

---

## WS1 — 운영 대시보드(5-2) 상단 sticky 필터 바

### 목표
5-2 페이지 상단(스크린샷 1 = page-eyebrow + title + deck + chips 영역)을 sticky로 고정하고, 그 안에 **날짜 range · platform · 국가 · channel** 필터를 삽입. 스크롤해도 필터+탭이 고정.

### ⚠ 핵심 위험 (CLAUDE.md §12.32 보류 사유 재확인)
> "화면만 sticky는 가짜 — 실제 필터는 도구별 grain 파이프라인에 꽂아야 함."

이번엔 5-2 단일 페이지(대부분 efficiency grain)로 **스코프가 좁아져** 안전해짐. 단 **반드시 실제 데이터 필터링**까지 구현(시각적 고정만 ❌). cohort 탭은 grain이 달라 별도 처리.

### 구현 단계

**1) 필터 상태**
```js
const MON_FILTER_STATE = {
  dateStart: null,   // "YYYY-MM-DD" | null = 무제한
  dateEnd: null,
  platform: "all",   // "all" | 실제 platform 값들 (데이터에서 추출)
  countries: null,   // null = 전체 | Set(선택 국가)
  channels: null,    // null = 전체 | Set(선택 채널)
};
```
- platform/country/channel **옵션 목록은 매핑된 데이터에서 distinct 추출**(하드코딩 금지). 해당 컬럼 미매핑이면 그 필터 컨트롤은 숨김(렌더 게이트).
- 날짜 range는 `date` 매핑 있을 때만. 데이터 min/max를 기본값·placeholder로.

**2) 실제 필터링 — `getMappedRowsForMon()` 신설**
```js
function getMappedRowsForMon() {
  let rows = getMappedRows();
  const f = MON_FILTER_STATE;
  if (f.dateStart) rows = rows.filter(r => r.date >= f.dateStart);
  if (f.dateEnd)   rows = rows.filter(r => r.date <= f.dateEnd);
  if (f.platform !== "all") rows = rows.filter(r => String(r.platform) === f.platform);
  if (f.countries) rows = rows.filter(r => f.countries.has(r.country));
  if (f.channels)  rows = rows.filter(r => f.channels.has(r.channel));
  return rows;
}
```
- **efficiency 탭(viz/scorecard/pacing/anomaly/funnel/segment/ltv/maturation)의 모든 `getMappedRows()` 호출을 `getMappedRowsForMon()`로 교체.** 각 body·cache 빌더 안에서.
- **cohort 탭은 5-8 grain** — date range는 `cohort_date`에, country/platform/channel은 코호트 분리(segment)에 적용(매핑된 경우만). 또는 단순화: cohort 탭에서는 sticky 필터 바를 "코호트엔 적용 안 됨" 안내와 함께 비활성. **권장: date range는 cohort_date 필터로 연결, 나머지는 cohort 탭에서 비표시.** (안전 중간버전 존재 — grain 안 깨짐.)

**3) 캐시 무효화**
- 필터 변경 시 영향받는 캐시 key에 **필터 시그니처 포함** 또는 변경 시 `.key=null`. scorecard/anomaly/pacing/ltv/maturation/segment/funnel 각 캐시 확인. 필터 핸들러에서 관련 캐시 무효화 후 `navigate("5-2")` 재렌더.

**4) sticky DOM/CSS**
- 5-2 전용 sticky 래퍼 신설: 헤더(스크린샷 1 영역) + `renderMonTabs()` + 필터 행을 한 컨테이너 `.mon-sticky`로 묶고 `position: sticky; top: <topbar 높이>; z-index: 9; background: var(--bg-1); backdrop-filter`.
  - topbar(`z-index:10`)보다 낮게. topbar 높이만큼 `top` 오프셋(약 `48~52px`; 실측 후 CSS 변수로).
- ⚠ **pageShell 구조 제약**: 헤더는 현재 pageShell이 본문 밖에서 렌더. sticky 묶음을 위해 5-2만 `pageShell` 대신 커스텀 셸을 쓰거나, pageShell에 옵션(`opts.stickyHeader`)을 추가해 헤더+tocless 영역을 sticky 래퍼로 감싸기. **권장: pageShell에 `stickyTop` 옵션 추가**(다른 페이지 영향 0, 기본 off → 골든·validate byte-동일).
- **사용자 요구 정확 반영**: "스크린샷 1번까지의 저 부분만 고정" = eyebrow+title+deck+chips+탭+필터까지 한 덩어리 sticky. 단 세로 공간이 큼 → **권장 절충: 스크롤 시 title/deck은 축소(compact)되고 탭+필터만 남기는 2단계 sticky**는 과한 작업이므로 v1은 통짜 sticky, 세로 높이 우려를 캡션/여백 최소화로 완화. (사용자가 공간 답답하면 후속 compact PR.)

**5) 검증**
- `validate_mon.js` 갱신: `getMappedRowsForMon` 필터 적용 시 행 수 감소·각 탭 render throw 가드. 필터 미설정(전체)이면 기존과 동일 결과(byte 비교).
- cohort 탭에서 date range 적용 시 cohort_date 필터링 정상.
- 차트/sticky는 headless 불가 → **브라우저 확인 필수**(§12.22).

---

## WS2 — CSV 업로드 점진적 공개 + 데이터×기능 capability 매트릭스

### 목표
첫 업로드 화면에서 기능 설명 카드(스크린샷 2)와 장황한 alias 가이드 표(스크린샷 3)를 **전부 노출하지 않기**. 대신:
- (a) **드롭존 + 필요 컬럼 최소 리스트**만 먼저.
- (b) **데이터 × 기능 capability 매트릭스**: 기능(시각화/스코어카드/페이싱/이상탐지/LTV:CAC/ROAS 성숙도/퍼널/세그먼트/코호트)을 **가로 열**로, 각 데이터 필드를 **세로 행**으로. 셀 = ●(그 기능이 이 필드 사용) / ○(미사용). 필드가 매핑되면 행이 활성화, 기능별로 "활성/잠금" 표시.

### 구현 단계

**1) SSOT 신설 — `FEATURE_FIELD_MATRIX`**
현재 흩어진 기능↔컬럼 매핑(`:6077` 안내표 + 각 body의 `mapped.has`)을 한 객체로 통합:
```js
const MON_FEATURES = [
  { key: "viz",        label: "시각화",      need: ["date","cost"], boost: ["channel","platform","country","impressions","clicks"] },
  { key: "scorecard",  label: "스코어카드",  need: ["date"], boost: ["installs","actions","clicks","impressions","revenue_d7"] },
  { key: "pacing",     label: "페이싱",      need: ["date"], boost: ["cost","installs","actions","revenue_d7"] },
  { key: "anomaly",    label: "이상탐지",    need: ["date"], boost: ["cost","installs","actions","clicks","impressions","revenue_d7"] },
  { key: "ltv",        label: "LTV:CAC",     need: ["date","cost"], boost: ["revenue_d0","revenue_d7","revenue_d14","installs","actions"] },
  { key: "maturation", label: "ROAS 성숙도", need: ["cost"], boost: ["revenue_d0","revenue_d7","revenue_d14","channel"] },
  { key: "funnel",     label: "퍼널 진단",   need: ["impressions","clicks"], boost: ["installs","actions","channel"] },
  { key: "segment",    label: "세그먼트",    need: ["cost"], boost: ["country","channel","platform","installs","actions"] },
  // cohort는 별도 CSV(5-8 grain)라 매트릭스 각주로 분리 표기
];
```
- `need` = 그 기능이 동작하기 위한 최소 컬럼(전부 충족해야 "활성"). `boost` = 있으면 더 풍부.
- **이 SSOT로 기존 `:6077` 안내표 + body 인라인 체크를 점진 대체**(한 번에 다 바꾸지 말고, 매트릭스 렌더부터. body 게이트는 기존 유지 가능).

**2) 매트릭스 렌더 — `renderCapabilityMatrix(toolId)`**
- 표: 행 = STANDARD_FIELDS 중 5-2 관련 필드(date/cost/installs/actions/channel/campaign_name/country/platform/impressions/clicks/revenue_d0/d7/d14…), 열 = `MON_FEATURES`.
- 셀: 그 필드가 그 기능의 `need`면 ●(진하게), `boost`면 ◐(연하게), 무관이면 빈칸. **매핑된 필드 행은 초록 강조**, 미매핑은 회색.
- 열 헤더 아래 기능별 상태칩: `need` 전부 매핑 → "🟢 활성", 일부 → "🔒 N개 더 필요", 없음 → "🔒 잠금".
- 모바일/좁은 폭 대비 가로 스크롤(`overflow-x:auto`).

**3) 점진적 공개 재배치 (`renderInlineCsvUpload` 수정)**
- **파일 업로드 전**: 드롭존 + "필수: date + (cost·installs·actions 중 1)" 한 줄 + **capability 매트릭스**(바로 노출 — 무엇이 켜지는지 한눈에) + 데모 버튼. 기능 설명 카드(스크린샷 2)와 alias 전체 표(스크린샷 3)는 **`<details>` "📋 전체 컬럼·기능 안내"로 접어** 기본 숨김.
- **파일 로드 후**: 컴팩트 바 + 매핑 select + capability 매트릭스(현재 상태 반영, 활성/잠금 갱신) + 분석하기 버튼. alias 가이드 표는 기존대로 `<details>` 접힘.
- 기존 `page_5_2():6077` 하드코딩 안내표 → 매트릭스로 대체(삭제).

**4) 검증**
- `validate_mon.js`/신규 `validate_capmatrix.js`: 매핑 상태별 매트릭스 활성/잠금 셀 정확도, render throw 가드. render-only라 골든 byte-동일.

---

## WS3 — 코호트 Dn 동적 확장 + 마투레이션 예측 (핵심·통계)

### 사용자 요구 요약
1. 현재 매출 D7/D14만 → **Revenue Dn · Retention Dn · 결제건수(PUR) Dn 을 가능한 한 많이** 입력받아 활용.
2. **마투레이션 예측**: 2024-01-01부터 데이터를 넣었으면, **마감된(성숙한) 코호트의 성장률(예: D60→D90)을 평균내** 아직 마감 안 된 코호트의 **Predict D90** 등을 만들어 보여주기. Revenue·Retention·PUR 전부.

### 💡 마투레이션 예측 아이디어에 대한 판단 (사용자 질문 "이건 어떻게 생각해?")
**적극 추천. 이건 LTV 예측의 업계 표준 기법** ("cohort triangle completion" / "maturation curve" / "vintage completion"). 근거:
- 기존 ROAS 성숙도 도구(5-16)가 이미 **단순화 버전**(D0/D7/D14 3점 power fit)을 하고 있음. 이를 (a) 임의 Dn, (b) Retention·PUR로 확장, (c) **경험적 평균 완성비(empirical completion ratio)** 추가가 자연스러운 진화.
- **경험적 완성비가 parametric 곡선보다 강건**할 때가 많음 — 성숙 코호트가 충분하면 "D90/D30 비율의 가중평균"이 곡선 강제보다 정확. 단 관측 Dn 범위 **밖** 외삽(예: 관측 최대 D90인데 D180 예측)은 곡선 fit 필요.

### 2-트랙 자동 전환 규칙 (사용자 확정)
- **① 경험적 완성비 (주 방법)**: 그 Dn을 실측 보유한 **마감 코호트(window) 수 ≥ MATURED_MIN** 일 때.
- **② parametric 곡선 폴백** (`fitPowerCurve`/`fitLogCurve` 재사용): 마감 window 수 **< MATURED_MIN** 이거나 관측 Dn 범위 밖 외삽.
- **MATURED_MIN = config** (사용자 지정 30 또는 60). ⚠ **코호트 단위(일/주)에 따라 양 부담 다름**:
  - 일별 코호트: 30~60 window = 1~2개월 (현실적)
  - 주별 코호트: 30~60 window = 7~14개월 (부담 큼)
  - → `COHORT_MATUR_CFG = { maturedMinDaily: 30, maturedMinWeekly: 12, ... }` 식으로 단위별 기본값 분리 권장(둘 다 config 노출). 사용자 명시값(30/60)은 일별 기준으로 채택.
- 메서드 선택은 Dn별로 독립(가까운 Dn은 경험적, 먼 Dn은 곡선). 각 예측값에 `method:"empirical"|"curve"` 태깅.

### ⚠ 통계 가드레일 (CLAUDE.md §8 필수 준수)
- **결정론** — `Math.random` 금지(§8.7). 같은 입력 → byte-identical.
- **성숙 충족 게이트 / 메서드 전환** — Dn 예측 시 그 Dn을 실측 보유한 마감 코호트 수가 `MATURED_MIN` 이상이면 경험적, 미만이면 곡선 폴백(위 2-트랙 규칙). 곡선조차 점이 3개 미만이면 "⊘ 데이터 부족"(예측 금지).
- **단조성 보정** — Retention은 [0,1]·비증가(running-min), Revenue/PUR 누적은 비감소(running-max). artifact 차단(§8.5 패턴).
- **신뢰구간** — 완성비의 코호트 간 분산으로 예측 밴드. 실측 vs 예측 시각 구분(실선/점선·색).
- **캐비엇 강제** — "예측은 과거 성숙 코호트가 신규에도 재현된다 가정. 획득 믹스·시즈널리티 변하면 깨짐. 확정 아님." UI+다운로드에 명시.
- **합성 유닛 테스트** — `runQualityTests`에 마투레이션 케이스 추가: 알려진 완성비 합성 코호트 → 예측이 정답 복원(T 패턴), 성숙 부족 시 ⊘ 반환, 결정론.

### 데이터 모델 결정 (실행자가 확정 — 권장안 제시)
사용자 데이터는 **wide 형태일 가능성 큼**(코호트별 1행에 D0/D7/D14/D30/D60/D90 열). 두 경로:

- **경로 A (권장·신규) — 동적 wide 컬럼 자동 감지**:
  - `STANDARD_FIELDS`에 고정 d0/d7/d14만 두지 말고, 업로드 헤더에서 **정규식으로 `*_d<N>` 패턴 자동 감지**:
    - 매출: `revenue_d(\d+)` / `rev_d(\d+)` / `매출_?d(\d+)`
    - 리텐션: `ret(?:ention)?_d(\d+)` / `리텐션_?d(\d+)`
    - 결제건수: `pu(?:r)?_d(\d+)` / `payments?_d(\d+)` / `결제_?d(\d+)`
  - 감지된 N들을 **Dn 시리즈**로 묶어 코호트(행, `cohort_date` 또는 acquisition date 기준)별 곡선 구성.
  - 장점: 사용자가 가진 wide export 그대로. 단점: 신규 동적 매핑 경로 필요(STANDARD_FIELDS 고정 스키마와 공존하게 — `:21128` 매핑 UI에 "Dn 자동 그룹" 섹션).
- **경로 B (기존 재사용) — tall grain(5-8 코호트 CSV) 확장**:
  - 이미 `cohort_date × day_offset` + `cohort_size/retained_users/cohort_revenue`. 여기에 **`cohort_payments`(PUR)** 한 컬럼만 추가하면 Dn은 day_offset이 이미 임의.
  - 장점: 최소 변경·곡선 fit 재사용. 단점: 사용자가 tall로 데이터를 변환해야(피벗) — 마케터에게 부담.

**권장: 경로 A를 1차 목표**(사용자 데이터 형태에 맞음), 경로 B는 5-8에 `cohort_payments` 추가만(저비용 병행). 단 경로 A 동적 매핑은 작업량 큼 → 아래처럼 PR 분할.

### PR 분할
- **PR 3-A (저위험·선행)**: 5-8 코호트 tool에 **PUR(결제건수) 차원 추가**(`cohort_payments` 필드 + 리텐션처럼 PUR 곡선·외삽). 기존 retention/revenue 로직 복제 패턴. 골든에 PUR 테스트 추가. wide 변경 없음.
- **PR 3-B (핵심)**: **마투레이션 예측 엔진** `COHORT_MATURATION` 순수 모듈 신설:
  - 입력: 코호트별 Dn 시리즈(metric ∈ {revenue, retention, payments}) + asOf 날짜(데이터 max date 또는 명시).
  - 각 코호트 성숙도 = `asOf - cohort_date` (일). Dn 실측 = n ≤ 성숙일.
  - **완성비 행렬**: anchor(예 최신 공통 성숙 Dn, 또는 D7/D30)에 대해 각 목표 Dn의 비율 `value(Dn)/value(anchor)`를 성숙 코호트들에서 cohort_size 가중평균.
  - **예측**: 미성숙 코호트의 `predict(Dn) = value(anchor) × avgRatio(Dn/anchor)`. retention은 비율 대신 **레벨 보간**(비증가 곡선이라 비율 부적절 — `predict(Dn)=avg(retention_Dn)` 가중평균 또는 anchor 대비 잔존율). metric별 분기.
  - 관측 최대 Dn 밖(예 D180)은 `fitPowerCurve`/`fitLogCurve` 외삽 폴백.
  - 출력: 코호트별 `{actual:[{n,v}], predicted:[{n,v,lo,hi}], matured:bool, method:"empirical"|"curve"}`.
  - 결정론·게이트·단조 보정·CI 전부 §8 준수. 합성 골든 테스트.
- **PR 3-C (UI·소비)**: 5-8(또는 5-2 cohort 탭)에 마투레이션 뷰 —
  - 코호트 vintage 표(행=cohort_date, 열=Dn, 셀=실측 진하게/예측 점선·연하게/⊘ 부족), 마지막 열 = Predict D90/D180.
  - 차트: 성숙 코호트 평균 완성곡선 + 미성숙 코호트 예측 오버레이(실선/점선).
  - metric 토글(Revenue/Retention/PUR), anchor·MATURED_MIN·asOf config UI.
  - **다운로드 CSV**: 코호트×Dn 실측+예측+lo/hi+method, BOM+CRLF(§7 PR#85).
  - 캐비엇 콜아웃 강제.

- **PR 3-D (ROAS 성숙도 5-16 — 듀얼 메서드 + anchor 충분성 진단) [사용자 확정·핵심]**:
  - **두 방법 동시 표시**: 경험적 완성비 예측 + 곡선 fit 예측을 **같은 차트/표에 나란히**(체크박스로 각각 on/off). 일치할수록 모델 신뢰.
  - **사용할 Dn을 사용자가 선택**: 어떤 Dn까지 anchor로 쓸지 멀티셀렉트(예 `[D0,D7,D14,D30,D60]` 체크). 선택 Dn만으로 예측 재계산.
  - **🎯 anchor 충분성 진단 (사용자가 가장 원한 기능)**: D360(또는 목표 horizon) 예측을 anchor 집합을 점진 확장하며 계산 — `[~D30]` → `[~D60]` → `[~D90]` …. **예측이 안정되는 첫 Dn을 자동 탐지**해 직접 안내: 예) "✅ D60 이후 예측 변화 < 2% → D90+ 데이터 수집 불필요" / "⚠ D90까지도 예측이 흔들림 → 더 긴 데이터 필요". 임계(예 2%)는 config.
    - 두 진단 구분: ① **방법 일치도**(경험적 vs 곡선, 같은 horizon) ② **anchor 충분성**(같은 방법, anchor 점진 확장 → 수렴점). ②를 전면 배치(사용자 핵심 질문 = "D60이면 충분한가").
  - 표: anchor 집합별 D360 예측 + 직전 대비 변화율 + 수렴 여부(✓). 두 방법 컬럼 병기.
  - 기존 `MATURATION_MATH`(`:16993`) 재사용·확장, `COHORT_MATURATION`(3-B)와 공유 가능하면 공유.

- **PR 3-E (주차별 retention vintage + base 선택) [사용자 확정]**:
  - **현재**: retention 곡선이 전체 기간 통합(단일 평균 곡선).
  - **추가**: "주차별 보기" 토글 → cohort_date를 **월~일(Monday-anchored) 주 경계로 묶어** 주차 vintage별 곡선(최근 주가 과거 주보다 잘 남는지 = 코호트 품질 추세).
  - **retention base 선택**: `retained_users = base × retention_rate`, base ∈ {registration, install} 를 사용자가 선택. 주차별로 `Σretained_users / Σbase` = 주차 retention rate.
  - ⚠ **함정(§7)**: 주차 버킷팅은 Monday-anchored 주 경계를 정확히(타임존·`Date` 파싱·윤년 주의). `_weekStartMonday(dateStr)` 순수함수로 분리·유닛테스트.
  - ⚠ **base 절대값 필요**: 주차 sum이 의미 있으려면 registration/install **절대 수** 매핑 필요. rate만 있으면 base 가중평균으로 폴백 + 안내.
  - 곡선 fit·외삽은 기존 `fitPowerCurve`/`fitLogCurve` 그대로(전체 vs 주차별만 grain 분기).

### 검증
- `runQualityTests` 확장 + 신규 `validate_maturation.js`(주입식): 합성 완성비 복원·게이트·단조·결정론·render throw. 기존 골든 byte-동일(신규 모듈 추가라 코어 무변).
- **3-D**: anchor 점진 확장 수렴 탐지 — 합성(완성비 일정) 코호트로 "D60에서 수렴" 정답 복원. 듀얼 메서드 일치도. 결정론.
- **3-E**: `_weekStartMonday` 경계 유닛테스트(월요일 입력→자기 자신, 일요일→6일 전, 연말연시·윤년 경계). base registration vs install 분기 정확.
- 차트는 headless 불가 → 브라우저 확인.

---

## 실행 순서 권장
1. **WS2** (점진 공개·매트릭스) — 위험 낮고 사용자 첫인상 개선 즉효. SSOT(`MON_FEATURES`)가 WS1/WS3 게이트에도 재사용됨.
2. **WS1** (sticky 필터) — `getMappedRowsForMon` 파이프라인 작업. WS2의 매트릭스와 독립.
3. **WS3** (코호트·마투레이션) — 3-A→3-B→3-C→3-D→3-E 순. 가장 크고 통계 정확성 중요. (3-D ROAS 듀얼메서드·anchor 충분성, 3-E 주차별 retention vintage는 사용자 확정 추가.)

## 각 PR 공통 체크리스트 (CLAUDE.md §14)
- [ ] syntax check (`<script>` 추출 + `new Function`)
- [ ] 관련 validate_*.js + 골든 통과 (필터 미설정·매핑 무변 시 byte-동일 확인)
- [ ] conflict marker 0
- [ ] `git add`는 변경 파일만 명시(§11 — `-A` 금지)
- [ ] PR Summary + Test plan + Co-Authored-By
- [ ] 차트/sticky/DnD는 브라우저 확인 항목으로 Test plan에 명시(headless 불가, §12.22)
- [ ] 작업 후 CLAUDE.md self-update(§15)
