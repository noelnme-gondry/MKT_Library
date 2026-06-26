# 5-21 "캠페인 성과 변동 탐지" 전면 재설계 스펙 (PR #190 핸드오프)

> 작성: 2026-06-26 세션. 다른 세션(저비용 실행자)이 **이 문서만 보고** 구현할 수 있게 자체완결형으로 작성.
> 대상 파일: `index.html` 단일. 라인 번호는 작성 시점 기준(드리프트 가능 — 함수/식별자명으로 재탐색).
> 기존 도구 id `5-21`(내부)·표시번호 `4-1-3` 유지(§12.8 — 내부 id 절대 변경 금지).

---

## 0. 확정된 의사결정 (사용자 합의 완료)

| # | 결정 | 비고 |
|---|---|---|
| D1 | **티어 변경**: 5-3 예산 배분 → **무료**, 5-21 → **Pro** | freemium 초입을 예산 배분까지 확장 |
| D2 | **개명**: "성과 변동 진단" → **"캠페인 성과 변동 탐지"** | 사이드바·홈·meta·chips 전부 |
| D3 | **URL 표기**: 내부 id `#5-21` **유지** (표시번호 별칭 URL 안 함) | 화면/breadcrumb은 이미 `4-1-3`로 보임. §12.8 안정성 |
| D4 | **통화**: 도구 설정 **₩/$ 토글** (단일 통화 가정, 기본 ₩) | CSV 통화 컬럼 없음 |
| D5 | **1차 범위 = CPI/CPA만**. ROAS는 **후속 PR** | revenue가 코호트-lag(revenue_dN)뿐 → 갓 마감 주 D7 미성숙. §9 함정. ROAS는 캘린더-일별 매출 컬럼 확보 후 |
| D6 | **중첩 분해**: 단계별 독립 분해 폐기 → **최소 grain 전역 분해 후 롤업** ✓**사용자 승인(2026-06-26)** | 사용자 요구 "모든 값 더하면 절대 변화량과 일치 + 드릴다운 정합" 만족 (§4 상세) |
| D7 | **유의성 임계값**: `max(3%,15%)` 폐기 → **`AND(15%·ΔCPA, 1%·CPA2)`** ✓**사용자 검토 반영** | 분산 변동 억제 함정 수정 (§6 상세) |

**범위 밖(이번 PR 금지)**: ROAS, URL 별칭, CSV 통화 컬럼, 일별 매출 업로드.

---

## 1. 현재 코드 상태 (재설계 대상)

| 위치 | 현재 | 변경 |
|---|---|---|
| `PVM_STATE` (L17600) | `{ level: "channel" }` 유저가 pill로 단계 선택 | 가이드 드릴다운 state로 교체 (§5) |
| `PVM_MATH` (L17602) | `aggregate`/`applyNoiseGuard`/`decompose`/`decomposeRows`/`classifyNarrative` — **단계별 독립** 분해(액션-비중 Bennet) | `decompose` 유지(소재-only 모드용) + **`decomposeFinest`·`rollup` 신규**(§4) |
| `buildPvmCache` (L17758) | 마지막 **14일**을 7일씩 둘로 split | **달력 월~일 완전 마감 주** vs 직전 주 (§3) |
| `renderPvmLevelPills`/`renderPvmBody` (L17783/17801) | 단일 표 + 단계 pill | §0~§4 전면 재작성 (§5) |
| `page_5_21` (L17870) | 게이트 + 매핑 details + `renderPvmBody` | 본문 교체. 게이트/매핑 details 골격 유지 |
| 통화 | `"원"` 하드코딩 (L17681 등 다수) | `pvmFmtMoney(v, cur)` 헬퍼 (§6) |
| `window.runPvmTests` (L17693) | T1~T3 (Σ기여=ΔCPA 항등식) | **T4~T6 중첩·롤업 추가** (§4.4) |
| `TOOL_REQUIRED_FIELDS["5-21"]` (L25576) | `["date","channel","creative_id","spend",{oneOf:["installs","actions"]}]` | `creative_id` **필수→옵션** (§8) |
| `TOOL_OPTIONAL_FIELDS["5-21"]` (L25719) | `campaign_id`만 | `creative_id`·`impressions`·`clicks` 추가 (§8) |
| `DEMO_BUILDERS["5-21"]` (L25948) | `_demoCreativeData` (5-6와 공유) | **신규 `_demoPvmData`** (§7, 5-6 데모는 불변) |
| `TOOL_TIER`/`AUTH_PROTECTED_PAGES` | 5-3 pro·protected / 5-21 free·unprotected | **뒤집기** (§9) |

**데모 버그 근본 원인**(사용자 "캠페인·소재 분해 작동 안 함"): `_demoCreativeData`(L25880)가
① 채널·캠페인 1:1 공선(`C1`=Meta, `C2`=TikTok), ② 매주 동일 6개 소재만 반복(week2 신규 소재 0,
변동 단조), ③ 채널당 캠페인 1개 → 드릴다운할 게 없음. → §7 신규 데모로 해결.

---

## 2. 도구 정체성 / 개명 (D1·D2·D3)

- IA(L3243): `{ id:"5-21", title:"캠페인 성과 변동 탐지", desc:"이번주 vs 지난주 CPA/CPI 변동을 채널→캠페인→소재로 드릴다운 — 무엇이 비용을 올리고 내렸는지 무잔차 분해" }`
- `findMeta("5-21")` title·deck·chips·summary 전부 "캠페인 성과 변동 탐지" 반영.
- chips: 무료 배지 → **`🔒 Pro` 배지**로 교체 (page_5_21 L17887의 `<span class="chip ok">무료</span>` 제거).

---

## 3. 기간 정의 — 달력 월~일 완전 마감 주 (`buildPvmCache` 재작성)

사용자 명시: **"이번주 = 마감된 최신 주. CSV 내에서도 마감된 날짜 기준 최신 주 월~일이 마감되어야 함."**

```
1. rows = getMappedRows(); dates = 고유 날짜 오름차순; maxDate = dates 마지막.
2. ISO 주(월요일 시작). 주 키 = 그 날짜가 속한 주의 월요일(YYYY-MM-DD).
   - getMonday(d): d의 요일(0=일..6=토)에서 월요일로 당김. JS getUTCDay() 기준,
     offset = (day === 0 ? 6 : day - 1), monday = d - offset*86400000. (UTC 고정 — 타임존 드리프트 방지)
3. "완전 마감 주" = 그 주의 일요일(월+6일)이 maxDate 이하인 주.
   - thisWeekMon = maxDate가 속한 주의 월요일. 단 그 주 일요일(thisWeekMon+6) > maxDate 이면
     (= maxDate가 일요일 아님 = 미마감) → thisWeekMon -= 7일 (직전 완전 주).
   - prevWeekMon = thisWeekMon - 7일.
4. rowsP1 = prevWeek 주에 속한 행, rowsP2 = thisWeek 주에 속한 행 (각 행 date의 getMonday로 매칭).
5. 가드: prevWeek/thisWeek 둘 중 하나라도 행 없으면 insufficientData. dates에 완전 마감 주가
   2개 미만이면 insufficientData (메시지: "최소 2개의 완전 마감 주(월~일)가 필요합니다").
6. 표시용: p1Range/p2Range = [주월요일, 주일요일] 문자열.
```

⚠ 한 주 내 일부 요일 누락은 허용(있는 행만 합산). 단 thisWeek가 7일 미만이면 캡션에 "이번주 N/7일 데이터" 경고.
⚠ 14일 split(현재) 완전 폐기. 주 경계가 핵심.

---

## 4. 수학 — 중첩 분해 (D6, **핵심**)

### 4.1 왜 바꾸나
현재 `decomposeRows`는 단계(channel/campaign/creative)마다 **독립**으로 전역 분해 → 각 단계 Σ기여=ΔCPA_total은
맞지만, **채널 기여 ≠ 그 채널 캠페인들의 기여 합**(Bennet은 blending에 비선형이라 부분합이 grain마다 다름).
코드가 이미 caveat로 고지 중(L17891 "단계 사이 합산 일치 보장 안 함"). 사용자는 **드릴다운 정합**을 요구 → 이 방식 폐기.

### 4.2 새 방식 = 최소 grain 전역 분해 → 롤업 (완벽 중첩)
- **최소 grain** = 매핑된 것 중 가장 세분 = `creative_id` 있으면 (channel,campaign,creative) 튜플,
  없고 `campaign_id`만 있으면 (channel,campaign), 둘 다 없으면 (channel).
- 최소 grain **엔티티 i**: `{ chKey, cmpKey, crKey, cost1,result1,cost2,result2 }`.
  전역 비중 `s_i = result_i / Result_total`, `cpa_i = cost_i/result_i`(누락 주는 타주 fallback, 현재 decompose L17646~17649 로직 유지).
  `mix_i = cpaBar_i·(s2_i−s1_i)`, `rate_i = sBar_i·(cpa2_i−cpa1_i)`, `contribution_i = mix_i+rate_i`.
  **Σ contribution_i = ΔCPA_total** (Bennet 항등식, 잔차 0). ✓
- **롤업**: 임의 키 함수(예: chKey)로 최소 엔티티를 그룹핑 →
  - 표시값: `cost1,cost2,result1,result2`는 **합산** → 그룹 blended `cpa1=Σcost1/Σresult1`, `cpa2`, `s1=Σresult1/Result_total`, `s2`.
  - **기여: `mix`/`rate`/`contribution`는 그룹 내 최소 엔티티 contribution을 단순 합산.**
  - ⇒ 채널 기여 = Σ(그 채널 캠페인 기여) = Σ(그 캠페인 소재 기여). **완벽 중첩.** ✓
- 결과: §2 채널표 Σ = ΔCPA_total, §3 채널 딥다이브(그 채널 캠페인) Σ = 그 채널 기여,
  §4 소재 딥다이브(그 캠페인 소재) Σ = 그 캠페인 기여. 드릴다운이 전부 정합.

⚠ **트레이드오프(스펙에 명시·정상)**: 롤업한 채널 기여는 "채널만으로 독립 분해한 Bennet"과 미세하게 다를 수 있음
(최소 grain이 채널 내부 mix까지 포착 → 더 정확). 사용자 요구(정합)가 우선. 단계 독립 분해는 버림.

### 4.3 `PVM_MATH` 변경
```js
// 유지(소재-only 모드 §5.4-B + 골든 호환): decompose(agg1, agg2), aggregate, applyNoiseGuard
// 신규:
decomposeFinest(rowsP1, rowsP2, keys /* {ch:"channel", cmp:"campaign_id"|null, cr:"creative_id"|null} */, threshold)
  // → { CPA1, CPA2, deltaCpa, Cost1,Cost2,Result1,Result2, finest:[{chKey,cmpKey,crKey, cost1,result1,cost2,result2, cpa1,cpa2,s1,s2, mix,rate,contribution}] }
  // 내부: 튜플 키(`ch|cmp|cr`)로 aggregate → applyNoiseGuard(소액 버킷, 단 버킷도 부모키 보존 위해 grain별 주의)
  //       → 전역 비중 Bennet. Result1<=0||Result2<=0 → null.
rollup(finestArr, keyFn, Result1, Result2)
  // → [{ key, cost1,cost2,result1,result2, cpa1,cpa2, s1,s2, mix,rate,contribution, children:[finest...] }]
  //   기여=Σchildren; cpa/s=합산 재계산. contribution desc 정렬 후 반환은 호출부에서.
```
⚠ `applyNoiseGuard`의 "기타(소액)" 버킷팅을 최소 grain에 적용 시 **부모 키가 섞이면 롤업이 깨짐**.
→ 노이즈 가드는 **롤업 후 표시 단계**에서 각 뷰별로 적용(예: 채널표에서 result 합<threshold인 채널만 "기타"로),
최소 grain 분해 자체는 가드 없이(전부 유지) 수행해 중첩 무결성 보존. (threshold 기본값은 기존 `PVM_NOISE_THRESHOLD` 재사용.)

### 4.4 골든 테스트 (`window.runPvmTests` 확장)
- **T1~T3 유지** (기존 `decompose` 항등식 — 소재-only 모드 보증).
- **T4 (중첩 항등식)**: 2채널×2캠페인×2소재 합성. `decomposeFinest` →
  ① Σ finest.contribution ≈ deltaCpa, ② rollup(by channel) Σ ≈ deltaCpa,
  ③ 각 채널 rollup.contribution ≈ Σ(그 채널 캠페인 rollup.contribution) ≈ Σ(그 캠페인 소재 finest.contribution). (1e-9)
- **T5 (롤업 합산 보존)**: rollup 채널의 cost2 = Σ children.cost2, result 동일 (1e-9).
- **T6 (결정론)**: 같은 입력 2회 → byte-동일(JSON.stringify). `Math.random` 미사용 확인.
- 통과 로그 형식 기존 유지(`[PVM Tests] n/n passed`).

---

## 5. UI 구조 (renderPvmBody 전면 재작성)

> 가이드 드릴다운. 단계 pill 선택(현재) 폐기. 상→하 흐름: §0 Summary → §1 절대 변화량 → §2 채널 결과표 → §3 채널 딥다이브 → §4 소재 딥다이브.
> State: `PVM_STATE = { metric:"cpa"|"cpi", currency:"krw"|"usd", drillChannel:null, crMode:"full"|"creativeOnly", crChannel,crCampaign, showNew:true }`.

### 5.0 §0 Summary 헤드라인 (맨 위, accent 카드)
- **지표 선택 토글**: CPI(설치 매핑 시) / CPA(액션 매핑 시). 둘 다 매핑이면 선택, 하나면 고정. (ROAS 자리만 비활성 "후속" 표기 가능.)
- **통화 토글**: ₩ / $ (`PVM_STATE.currency`). 변경 시 재렌더(in-place, navigate("5-21")).
- **헤드라인 문구**(유의성 §6 기준):
  - 전체: `이번주 {지표} {0.0}{단위} → {0.0}{단위} ({▲/▼} {Δ절대값}{통화}, {±%})` / 변동 미미하면 "큰 변화 없음".
  - 채널: **유의 채널 전부** 나열 — `{채널}에서 {기여%}({기여액}) {지표} {악화🔴/개선🟢}` (악화 빨강·개선 초록).
  - 캠페인: `{N}개 캠페인에서 변동 발견 (악화 {a}·개선 {b})` (aggregate).
  - 소재: `{M}개 소재에서 변동 발견` (기본 channel+campaign+creative grain).
  - 유의한 게 하나도 없으면 각 줄 "큰 변화 없음".

### 5.1 §1 절대 변화량 (스코어카드)
- 2×2 stat 카드: [지난주 Cost, 이번주 Cost, Δ Cost] · [지난주 {지표}, 이번주 {지표}, Δ {지표}].
- Δ는 **절대값 + 통화** (예: `Cost +1,250,000원`, `CPA +1,840원`). 부호·색(악화 빨강/개선 초록, 지표 방향 §6).
- 캡션: 기간 `{p1월}~{p1일}(지난주) vs {p2월}~{p2일}(이번주)`. thisWeek<7일이면 경고.
- 이 영역을 사용자 표현 그대로 **"절대 변화량"**으로 라벨.

### 5.2 §2 채널 결과표 (**결과표** 포맷)
`rollup(finest, byChannel)`. 컬럼 + 정렬(아래 5.5):
| 채널 | Cost (지난→이번) | {지표} (지난→이번) | 비중 (지난→이번) | Mix | Rate | **기여({통화})** |
- **기여 = 이 채널이 전체 Δ{지표}에 준 절대 영향**. Σ 채널 기여 = Δ{지표}_total (§1과 일치). 표 하단에 "Σ 기여 = 전체 Δ{지표} (잔차 없음)" 확인 줄.
- 기여 컬럼 색: 악화 빨강/개선 초록. 기본 정렬 = |기여| desc.
- Mix/Rate는 보조 컬럼(왜 = 비중 이동 vs 자체 효율). 내러티브는 `classifyNarrative` 통화 인자화해 재사용(선택).

### 5.3 §3 채널 딥다이브
- 채널 선택 UI(pill 또는 select, `data-pvm-drill-channel`). 기본 = |기여| 최대 채널.
- 선택 채널의 캠페인들을 `rollup(finest.filter(chKey==sel), byCampaign)` → **결과표** 동일 포맷.
- Σ(이 캠페인들 기여) = §2의 그 채널 기여 (정합). 표 하단에 "Σ = {채널} 기여 {액}" 확인 줄.
- 채널 바꾸면 그 채널 데이터로 교체(navigate 재렌더, 스크롤 보존됨).
- campaign 미매핑이면 이 섹션 잠금("campaign_id 매핑 시 캠페인 딥다이브").

### 5.4 §4 크리에이티브 딥다이브 (2모드 토글)
`data-pvm-cr-mode`: **A. 채널+캠페인+소재**(기본) / **B. 소재만(merged)**.
- **모드 A**: 채널·캠페인 선택 후 그 (채널,캠페인)의 소재 = `finest.filter(ch&&cmp)` → **결과표**. Σ = 그 캠페인 기여(정합).
  - **CTR 컬럼 추가**: `ctr = clicks/impressions` 지난→이번 + Δ%p. impressions·clicks 매핑 시만(없으면 컬럼 숨김).
  - **New 토글**: 이 소재가 prev주에 이 (채널,캠페인) 내 result=0/행없음인데 this주 등장 → `🆕 New` 배지. `showNew` 토글로 New만 필터 옵션.
- **모드 B**: `PVM_MATH.decompose`로 **소재키만**(채널·캠페인 무시 merge) 전역 분해 → Σ = Δ{지표}_total(다른 분할, 채널뷰와 **비정합 — 의도된 다른 렌즈**, 캡션 명시). New = prev주 전역 부재.
- creative 미매핑이면 전체 §4 잠금.

### 5.5 정렬 (**결과표** 공통)
- 각 결과표를 `<table class="data" data-sortable="1">` + 숫자 컬럼 `<th data-type="number">`로 → 기존 `bindSortableTables()`(L22106) 자동 바인딩(navigate가 호출). 클릭 토글 asc/desc.
- ⚠ `innerText` 파싱 정렬이라 "1,250,000원"·"+1,840"·"12.3%" 같은 셀은 `parseFloat`가 콤마/기호에서 끊김.
  → 정렬 정확도를 위해 숫자 `<td>`에 `data-sortval="{원시숫자}"` 부여 + `bindSortableTables`가 `dataset.sortval` 우선 사용하도록 **소폭 보강**(없으면 기존 innerText fallback). 1줄 분기 추가, 타 페이지 영향 없음.

---

## 6. 유의성 임계값 (config 상수, §8 결정론) — 사용자 검토 반영(D7)

```js
const PVM_SIG_RULES = {
  overallFlatPct:    0.02, // 전체: |Δ지표| < 2%·지난주지표 → 헤드라인 "큰 변화 없음"
  entityShareMin:    0.15, // 엔티티: |기여| ≥ 15%·|Δ지표_total| (이번 변동의 1/7 이상 설명)
  entityAbsFloorPct: 0.01, // 엔티티: |기여| ≥ 1%·이번주지표 (미세 노이즈 절대 바닥)
};
// 전체 판정(헤드라인): |deltaCpa| < overallFlatPct*CPA1 → "큰 변화 없음".
// 엔티티 "유의 변동" = 둘 다(AND) 만족:
//   |contribution| ≥ entityShareMin*|deltaCpa|   AND   |contribution| ≥ entityAbsFloorPct*CPA2
// 방향: CPI/CPA contribution>0=악화(빨강)/<0=개선(초록). (ROAS 후속: 부호 반전, display-invert PR#37/#43.)
// 헤드라인 기여%: |contribution|/|deltaCpa|. |deltaCpa|≈0이면 % 생략, 절대액만.
// 노이즈 가드(작은 엔티티 "기타"): result 합<PVM_NOISE_THRESHOLD는 §4.3대로 표시 단계에서 묶음(유의 판정과 별개).
```

⚠ **원래 `max(3%·CPA2, 15%·|Δ|)` (3% floor) 폐기 이유**: 변동이 여러 엔티티에 **고루 분산**되면
floor가 share를 눌러 바가 높아짐 → 진짜 변동을 전부 억제(예: ΔCPA +1,000을 5채널이 각 +200 →
max(330,150)=330 > 200 → 전부 미표시인데 헤드라인은 "+10%" = 모순). → **share(설명력) 우선 +
작은 절대바닥의 AND**로 교체: 분산 변동도 잡고(각 200 ≥ 150 & 110 → 5개 표시) 미세 노이즈는 차단.

세 상수(2%/15%/1%)는 `PVM_SIG_RULES`로 분리(LLM은 서술만, 판정은 하드 규칙) → 결정론·데이터 보고 튜닝.

**동작 요약**:
| 상황 | ΔCPA | 동작 |
|---|---|---|
| 큰 집중 변동 | 몇 채널이 주범 | 주범 2~3개만 색칠(나머지 1/7 미달로 침묵) |
| 분산 변동 | 고루 퍼짐 | 15% 넘는 것 다 표시 → "특정 주범 없이 전반 변동" |
| 거의 평평 | <2% | "전체 큰 변화 없음"(내부 큰 상쇄 시 "단, A악화·B개선 상쇄" 부가 가능) |

---

## 7. 데모 데이터 재작성 (신규 `_demoPvmData`)

- **별도 빌더** 신설(5-6 데모 `_demoCreativeData` 불변). `DEMO_BUILDERS["5-21"] = _demoPvmData`로 교체(L25948).
- 결정론 `seededNoise(고정seed)`. `Math.random` 금지(§8).
- 구조(중첩·드릴다운·New·CTR 전부 시연되게):
  - **3 채널**: Meta, Google, TikTok. 각 채널 **2~3 캠페인**, 각 캠페인 **2~4 소재**.
  - **4주치 일별**(28일) → 완전 마감 월~일 주가 ≥2개. 마지막 날짜를 **일요일로** 맞춰 thisWeek 완전 마감.
  - **의도된 WoW 시그널**: ① 한 채널 CPA 악화(rate↑·소재 피로), ② 한 채널 볼륨 확대(mix↑), ③ week2에 **신규 소재 1개 진입**(New 배지 시연), ④ 한 소재 효율 개선(개선 초록 시연).
  - 컬럼: `date, channel, campaign_id, creative_id, spend, impressions, clicks, installs, actions, revenue_d7`(ROAS 후속 대비). headers·rows 반환 형식은 기존 데모 빌더 패턴(L25913) 그대로.
- 데모 가드(§12.32): `DEMO_STATE.tool==="5-21"` 조건 분기는 기존 공통 가드가 처리 → 추가 작업 불필요(스냅샷/분석상태 불변 자동).

---

## 8. 매핑 필드 (TOOL_REQUIRED / OPTIONAL 변경)

```js
// L25576 — creative_id를 필수에서 제거(채널·캠페인만으로도 동작)
TOOL_REQUIRED_FIELDS["5-21"] = ["date", "spend", "channel", { oneOf: ["installs", "actions"] }];
// L25719 — 점진 잠금해제
TOOL_OPTIONAL_FIELDS["5-21"] = [
  { key: "campaign_id", unlocks: "캠페인 딥다이브 — 없으면 채널→소재 단계로" },
  { key: "creative_id", unlocks: "소재 딥다이브 + New 소재 탐지" },
  { key: "impressions", unlocks: "소재 CTR 증감 (clicks와 함께)" },
  { key: "clicks",      unlocks: "소재 CTR 증감 (impressions와 함께)" },
];
```
- `TOOL_GROUP["5-21"]="creative"` 유지(5-6 CSV 공유) — 변경 없음.
- 게이트(`checkRequiredForTool`)·분석 게이트(`isToolAnalyzed`, §12.14) 기존 흐름 유지.

---

## 9. 티어 / AUTH / 페이월 (D1)

```js
// L3657 TOOL_TIER
"5-3": "free",   // pro → free
"5-21": "pro",   // free → pro
// L5942 AUTH_PROTECTED_PAGES
//   "5-3" 제거, "5-21" 추가  → new Set(["5-4","5-6","5-18","5-20","5-21"])
```
- 5-3 페이지: 페이월(`pageAuthGate`) 대상에서 빠짐 → 키 없이 진입. chips "무료" 배지.
- 5-21 페이지: 페이월 적용. 데모 버튼은 페이월에서도 노출(freemium 훅, §12.32 — `demoKeyForPage`/`renderDemoButton` 기존 경로 자동).
- 사이드바 nav 배지(`TOOL_TIER` 기반 🔒Pro/FREE)·랜딩 버킷·⌘K 태깅 자동 반영(IA/TOOL_TIER 소스). 추가 작업 없음.

---

## 10. #1 캡션 수정 (5-3 업로드 안내의 하드코딩 "5-2")

- **L7092**: `"...퍼널·세그먼트 진단은 무료 운영 대시보드(5-2)에서 확인하세요."`
  → 내부 id 노출 제거, 표시번호 사용:
  `` `...퍼널·세그먼트 진단은 운영 대시보드(${displayItemNumber("5-2")})에서 확인하세요.` ``
  (정적 문자열이면 템플릿 리터럴로 전환. `displayItemNumber("5-2")` → `"4-1-1"`.)
- 코드베이스 전역에서 사용자 노출 카피에 `(5-N)` 하드코딩 있으면 같이 `displayItemNumber`로(grep `대시보드(5-`, `(5-` 카피). 라우팅/주석/`data-route`는 건드리지 말 것(§12.8).

---

## 11. 구현 순서 (권장)

1. **수학 먼저**: `PVM_MATH.decomposeFinest`·`rollup` + T4~T6 골든. `node`로 `runPvmTests` 6/6 확인.
2. **기간**: `buildPvmCache` 월~일 마감 주로 교체 + insufficientData 메시지.
3. **통화/지표 state** + `pvmFmtMoney(v,cur)` + `PVM_SIG_RULES`.
4. **렌더**: §0~§4 + 정렬(`data-sortval` 보강). 핸들러 바인딩(`data-pvm-metric/currency/drill-channel/cr-mode/cr-channel/cr-campaign/show-new`) — `bindCSVPageHandlers` 위임 블록에 5-21 분기 추가(navigate 재렌더).
5. **데모** `_demoPvmData` + `DEMO_BUILDERS` 교체.
6. **티어/AUTH/개명/캡션**(§9·§10·§2).
7. **검증**(§12) → 커밋 → PR #190.

---

## 12. 검증 (PR 전 필수)

- [ ] **syntax check**: `node -e "<script> 추출(ld+json 제외) → new Function(total)"` 통과.
- [ ] **`window.runPvmTests()` 6/6** (T1~T3 기존 + T4 중첩 항등식 + T5 롤업 보존 + T6 결정론).
- [ ] **렌더 throw 가드(headless)** — `validate_pvm.js`(주입식 `code+inject`, §12.22 패턴): 데모 패널 주입 →
      ① 게이트 화면, ② 분석 후 §0~§4 전부 render throw 없음(채널 0개·1개·다채널·creative 미매핑·campaign 미매핑 케이스), ③ 통화 ₩/$ 양쪽.
- [ ] **중첩 정합 수치 확인**(데모): §2 각 채널 기여 = §3 그 채널 캠페인 기여 합 = §4 그 캠페인 소재 기여 합 (1e-6).
- [ ] **데모 안전성**(§12.32): 데모 진입/종료 후 `TOOL_CSV_SNAPSHOTS`·`TOOL_ANALYZED` 불변.
- [ ] conflict marker 0 (`grep -n "^<<<<<<<" index.html`).
- [ ] **브라우저 확인 필요**(headless 불가): 정렬 버튼 클릭, 드릴다운 채널/모드 토글, New 배지, CTR 컬럼, 통화 토글.
- [ ] PR 본문 Summary + Test plan + Co-Authored-By.

---

## 13. 함정 / 주의 (CLAUDE.md 교차 참조)

- **§12.22 render throw**: 골든은 순수함수만 검증 → 렌더 throw 안 잡힘. 드릴다운/모드별 분기 전부 repro로 (특히 creative/campaign 미매핑 시 잠금 분기, 채널 1개일 때).
- **§9 코호트-캘린더 함정**: ROAS 후속 사유. revenue_dN은 설치일+N lag → 캘린더 WoW에 부적합. CPI/CPA(비용·설치·액션)는 캘린더-일별이라 안전.
- **§12.32 데모 가드**: 신규 데모도 가드가 `DEMO_STATE.tool==="5-21"` 조건이라 자동 보호. 단 빌더는 결정론(seededNoise) 필수.
- **§8 결정론**: `Math.random` 절대 금지. `PVM_SIG_RULES`로 임계값 분리.
- **정렬 함정**(§5.5): `bindSortableTables` innerText `parseFloat`가 콤마/통화기호에서 끊김 → `data-sortval` 보강.
- **노이즈 가드 × 중첩**(§4.3): "기타(소액)" 버킷을 최소 grain에 적용하면 부모키 섞여 롤업 깨짐 → 표시 단계에서만 묶기.
- **§12.8**: 내부 id `5-21`·라우팅·`data-route` 절대 불변. 사용자 노출 번호만 `displayItemNumber`.
- **§11 git**: `git add index.html docs/pvm-campaign-variance-spec.md`만 명시 스테이징(`-A` 금지).

---

## 14. 하네스 자가 업데이트 (§15) — PR #190 머지 시
- §12에 recipe 1줄: "12.x 5-21 PVM 중첩 분해 — 최소 grain 전역 Bennet 후 롤업으로 채널→캠페인→소재 드릴다운 정합(단계 독립 분해 폐기), 달력 월~일 마감 주 비교, ₩/$ 토글, 정렬 `data-sortval` 보강."
- §7 함정에 "단계 독립 Bennet은 grain별 부분합 비정합 → 드릴다운 정합 필요 시 최소 grain 롤업" 추가.
- `.claude/agents/mkt-engineer.md` 압축판 동기화.
