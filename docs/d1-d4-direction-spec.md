# D1–D4 작업 방향성 스펙

**목적**: 4개 작업(D1~D4)을 다른 모델이 이 문서만 보고 구현할 수 있도록 방향성·설계·파일:줄·함정·검증을 자체완결형으로 정리. 이 세션(조율 전담)에서는 코드를 작성하지 않음 — 실행은 별도 모델이 맡음.

**전제**: 단일 `index.html`, 클라이언트 사이드 전용, 빌드 도구 없음 (CLAUDE.md §1~§2). 모든 변경은 feat 브랜치 → PR → squash merge (§6). 신규 통계 모듈은 합성 데이터 golden test 필수(§8.2).

---

## 0. 권장 작업 순서

| 순서 | 작업 | 이유 |
|---|---|---|
| 1 | **D3** (검증만) | 코드 변경 가능성 거의 0. 가장 먼저 닫고 가는 게 효율적. |
| 2 | **D1** (소규모 리팩터) | D2가 새 도구(`5-21`)를 추가하기 전에 랭딩 구조를 IA 기준으로 통일해두면, D2는 `ANALYZE_BUCKETS`를 따로 손볼 필요가 없어짐(아래 D1↔D2 의존성 참고). |
| 3 | **D2** (신규 도구, 가장 큰 작업) | 설계 완료. D1 이후에 진행하면 랭딩 노출이 자동으로 맞음. |
| 4 | **D4** (GA 이벤트 확인 + 소규모 추가) | D2가 기존 `[data-tool-analyze]` 컨벤션을 따르면 `run_analysis` 추적이 자동으로 따라옴 — D2 완료 후 같이 점검하면 효율적. |

**D1↔D2 의존성**: D1을 먼저 하면 D2는 IA에 `5-21` 한 줄만 추가하면 끝(랭딩 자동 반영). D1을 나중에 하면 D2 작업 시 `ANALYZE_BUCKETS`에도 임시로 `5-21`을 수동 추가해야 하고, D1이 진행되면 그 수동 추가분은 삭제됨 — 순서대로 가는 게 작업량이 적음.

---

## D1 — 사이드바/랜딩 그룹핑 통일

### 문제
랜딩 페이지(`#` 홈 → "분석" 트랙)의 버킷 구조가 사이드바(`IA`)와 다르게 보임. 구체적으로: 사이드바는 "운영 대시보드(5-2)"와 "예산 배분(5-3)"을 같은 부모 그룹(`05` 효율 & 예산 분석) 아래 두는데, 랭딩은 이걸 "운영 대시보드"와 "효율화·예산" 두 개의 별도 최상위 카드로 쪼개 보여줌.

### 근본 원인
`IA`(사이드바, line 3174~)와 `ANALYZE_BUCKETS`(랭딩 전용, line 3649~3655)가 **서로 독립적으로 유지되는 별도의 분류 체계**임. 둘 다 같은 도구 집합(5-2/5-3/5-4/5-6/5-18/5-20)을 다루지만 그룹 경계가 다름:

```js
// IA (사이드바, line 3218 기준) — group "05"
{ id: "05", title: "효율 & 예산 분석", items: [ "5-2", "5-3" ] }
// → group "06" 크리에이티브 분석: "5-6"
// → group "07" 실험 & 측정: "5-4"

// ANALYZE_BUCKETS (랭딩, line 3649~3655) — 다른 경계
{ id: "monitor",    label: "운영 대시보드", tools: ["5-2"] }       // 05를 쪼갬
{ id: "efficiency", label: "효율화 · 예산", tools: ["5-3"] }       // 05를 쪼갬
{ id: "experiment",  label: "실험 · 소재",   tools: ["5-4","5-6"] } // 06+07을 합침
```

이 두 체계는 새 도구가 추가될 때마다 둘 다 수동으로 갱신해야 하는데, 지금까지 한쪽만 갱신되며 drift가 누적됨. **이 drift 자체가 근본 원인** — `ANALYZE_BUCKETS`를 지금 스냅샷에 맞춰 다시 손으로 맞추는 건 증상만 고치는 것이고, 다음 도구 추가 시 또 벌어짐.

### 권장 해법
`ANALYZE_BUCKETS`를 **삭제**하고, 랭딩의 분석 트랙을 `IA`의 `OPS_GROUP_IDS`(line 3262, 현재 `{"05","06","07","10","11"}`)에 해당하는 그룹들로부터 **그 자리에서 파생**시킨다. 즉 "두 번째 진실"을 만들지 않고 `IA`를 유일한 source of truth로 둔다.

```js
// 기존 (line 3663 부근) renderLandingAnalyze()가 ANALYZE_BUCKETS를 순회하던 것을
// → IA.filter(g => OPS_GROUP_IDS.has(g.id))를 순회하도록 변경
// 각 IA 그룹 g에 대해 카드 1개: title=g.title, items=g.items(각 item.id가 tools)
// tier는 그룹 내 tools를 TOOL_TIER로 조회해 "그룹 내 free 도구가 1개라도 있으면 free 배지,
// 전부 pro면 pro 배지" 식으로 파생(아래 함정 참고) — 굳이 그룹 단위 tier를 따로 저장 안 해도 됨.
```

### 구현 가이드 (파일:줄)
- `IA` 배열: line 3174~ (그룹 정의, 변경 없음 — source of truth 그대로 유지)
- `OPS_GROUP_IDS`: line 3262 (이미 존재, "분석" 트랙에 해당하는 그룹 id 집합 — 그대로 재사용)
- `ANALYZE_BUCKETS`: line 3649~3655 (**삭제 대상**)
- `tierBadge()`: line 3657 (그대로 재사용, 배지 렌더링 로직 변경 불필요)
- `TOOL_TIER`: line 3645 (그대로 재사용 — 그룹별 배지를 여기서 파생)
- `renderLandingAnalyze()` (line 3663 부근, `pageHome()` 디스패치 안): `ANALYZE_BUCKETS` 순회 → `IA.filter(...)` 순회로 교체
- 각 그룹의 `icon`/`desc`: `ANALYZE_BUCKETS`에만 있던 필드라 IA 그룹에는 없음. `IA` 그룹 객체에 `icon` 필드를 추가하거나(그룹당 1개, 기존 5개 그룹 + 신규 그룹 추가 시마다 자연히 따라옴), 혹은 그룹 id→아이콘 매핑을 별도 소형 상수로 둬도 됨(이건 drift 위험이 낮음 — 아이콘은 새 그룹 생길 때만 1줄 추가, 도구 단위로 매번 안 건드림).

### 함정
- `tier` 파생 시 "그룹 안에 free 도구와 pro 도구가 섞여 있으면 배지를 어떻게 표시할지"가 모호함. 현재(D1 시점) 그룹 05는 5-2(free)+5-3(pro)이 섞여 있어 바로 이 케이스에 해당함. **권장**: 그룹 카드 배지는 "가장 낮은 티어"(free가 하나라도 있으면 무료 강조, 예: "무료 포함")로 표시하고, 그룹 안의 개별 도구 카드에는 각자의 `TOOL_TIER`를 그대로 뱃지로 보여줘 사용자가 클릭 전에 구분 가능하게. 그룹 단위 단일 배지보다 **도구별 배지가 항상 보이는 게 핵심** — 그룹 배지는 보조 정보.
- `displayGroupNumber`/`displayItemNumber`(CLAUDE.md §12.8) 패턴을 절대 건드리지 말 것 — 랭딩 카드의 표시 번호도 이 함수로만 계산해야 함(내부 `id`는 라우팅에 수백 곳 의존).
- `PHASES` 배열(line ~3293)도 `groups: ["05","06","07","10"]` 식으로 그룹 id를 참조함 — `IA`의 그룹 id 자체는 안 바꾸므로 영향 없음(그룹 *내부 items 재배치*가 아니라 *랭딩 렌더 소스*만 바꾸는 것이라 안전).

### 검증
- 골든/validate 스크립트 영향 없음(render층 변경, 수학 없음).
- 브라우저 확인 필수(헤드리스 검증 불가 영역): 랭딩 → "분석" 트랙 클릭 → 카드 그룹 경계가 사이드바와 1:1 일치하는지 시각 확인. 신규 도구(D2의 `5-21`) 추가 후 IA에만 등록하고 랭딩에 별도 코드 없이 자동으로 나타나는지 확인.

---

## D2 — 신규 액션형 대시보드: "성과 변동 진단" (가칭, `5-21`)

> 제목은 가칭. "성과 변동 진단" / "WoW 성과 드라이버" 등 후보 — 확정 아님, 실행자가 자유롭게 조정 가능(낮은 위험 결정).

### 확정 스코프 (사용자 결정 완료)
- **계층 깊이**: 채널 → 캠페인 → 소재 (3단계, ad_group 스킵)
- **티어**: Free
- **목표**: WoW(주간 대비) 전체 CPA(또는 CPI) 변동을 엔티티 단위로 분해해 "무엇이 비용을 얼마나 올리고 내렸는지"를 원화로 보여줌 + 내러티브 자동 생성.

### 데이터 소스 결정
**5-6(Creative Analyzer)의 소재-grain CSV를 그대로 재사용**한다. 5-2/5-3(efficiency grain)과 cross-grain join을 하지 않는다.

근거(코드 확인 완료):
- `TOOL_REQUIRED_FIELDS["5-6"]`(line 25241) = `["creative_id","date","channel","impressions","clicks","installs","spend"]` — **channel이 이미 필수 필드**로 들어있어 채널 단계는 항상 보장됨.
- `TOOL_OPTIONAL_FIELDS["5-6"]`(line 25289)에 `campaign_id`(unlocks: "캠페인 fixed effect")가 있음 — **캠페인 단계는 선택적**. 매핑 안 하면 캠페인 레이어가 빠짐(아래 함정 참고).
- `TOOL_OPTIONAL_FIELDS["5-6"]`에 `actions`(unlocks: "CPA decompose")도 있음 — 결과지표를 installs(CPI) 또는 actions(CPA) 중 선택 가능, 기존 5-9/5-11/5-12/5-13 등과 동일한 `{oneOf:["installs","actions"]}` 패턴 재사용.
- `TOOL_GROUP`(line 25402~25412)에서 `"5-6": "creative"`로 이미 독립 grain — 5-2/5-3("efficiency")과 분리됨. **`"5-21": "creative"`로 등록하면 5-6과 동일 그룹이 돼 §12.6 그룹 공유 메커니즘(`loadCsvFromTool`/`findGroupCsvSnapshot`, line 25427~25456)이 자동으로 작동** — 사용자가 5-6에 CSV를 한 번 올리면 5-21이 별도 업로드 없이 그 CSV를 이어받음. 반대로 5-21에 먼저 올려도 5-6이 이어받음.
- **5-6에는 revenue 필드가 전혀 없음**(필수/옵션 어디에도 없음) → ROAS 변형은 v1에서 **만들 수 없음**. 아래 ⛔ 참고.

```
⛔ 결정 전 코드 금지 — ROAS 변형
D2 v1은 CPA/CPI(cost ÷ {installs|actions})만 다룬다. ROAS 변형(cost ÷ revenue 가중)은
5-6에 revenue 필드를 추가하는 별도 결정이 필요하므로 v1 스코프에 넣지 말 것.
필요해지면 TOOL_OPTIONAL_FIELDS["5-6"]에 revenue_d* 키 추가 여부를 먼저 사용자에게 확인.
```

### 신규 등록 (파일:줄, §12.1 레시피 그대로 적용)
| 항목 | 위치 | 내용 |
|---|---|---|
| `IA` 그룹 "05" items | line 3223~3224 부근(5-3 다음) | `{ id: "5-21", title: "성과 변동 진단", desc: "WoW CPA 변동을 채널·캠페인·소재 단위로 분해 — 무엇이 비용을 올리고 내렸는지" }` |
| `AUTH_PROTECTED_PAGES` | line 5929 | **추가하지 않음** (Free 티어 — 5-2도 이 Set에 없음, 동일 패턴) |
| `TOOL_TIER` | line 3645 | `"5-21": "free"` 추가 |
| `TOOL_REQUIRED_FIELDS` | line 25237~25253 부근 | `"5-21": ["date", "channel", "creative_id", "spend", { oneOf: ["installs", "actions"] }]` — 5-6의 필수 목록 중 D2 계산에 실제로 쓰지 않는 `impressions`/`clicks`는 제외(5-16이 5-2/5-3와 같은 "efficiency" 그룹이면서도 완전히 다른/더 짧은 필수 목록을 갖는 것과 동일한 전례, line 25250 참고 — TOOL_GROUP과 TOOL_REQUIRED_FIELDS는 독립적인 두 메커니즘). |
| `TOOL_OPTIONAL_FIELDS` | line 25288 부근 | `"5-21": [{ key: "campaign_id", unlocks: "캠페인 단계 분해 — 매핑 안 하면 채널→소재 2단계로 동작" }]` |
| `TOOL_GROUP` | line 25402~25412 | `"5-21": "creative"` |
| 페이지 함수 | 적절한 위치(예: line 17580 `PAGE_RENDERERS["5-20"]` 등록 직후) | `function page_5_21() { checkRequiredForTool("5-21") 체크 → renderInlineCsvUpload("5-21") fallback → isToolAnalyzed 게이트(§12.14) → 본문 }` |
| 등록 | 페이지 함수 직후 | `PAGE_RENDERERS["5-21"] = page_5_21;` |

### 방법론 — PVM(Mix/Rate) Bridge 분해

**핵심 항등식** (증명 가능, 근사 아님): 임의의 기간에 대해, 전체 CPA는 항상 엔티티별 결과-비중으로 가중한 엔티티별 CPA의 평균이다.

```
CPA_total = Cost_total / Result_total = Σ_i ( s_i · cpa_i )
  where  s_i = result_i / Result_total   (엔티티 i의 결과 비중)
         cpa_i = cost_i / result_i        (엔티티 i 자체의 CPA)
```
(증명: Σ s_i·cpa_i = Σ (result_i/Result_total)·(cost_i/result_i) = Σ cost_i / Result_total = Cost_total/Result_total. 끝.)

**WoW 변화량의 무잔차 분해** (대칭/평균 가중 방식 — Bennet-type, 잔차항 없음, 수치로 검증됨 — 아래 골든 테스트 참고):

```
Δ_i = s_i2·cpa_i2 − s_i1·cpa_i1                    // 엔티티 i가 ΔCPA_total에 기여한 양(정의상 정확히 일치)
mix_effect_i  = cpā_i · (s_i2 − s_i1)               // "비중(예산) 변화" 효과 — cpā_i=(cpa_i1+cpa_i2)/2
rate_effect_i = s̄_i  · (cpa_i2 − cpa_i1)            // "그 엔티티 자체 효율 변화" 효과 — s̄_i=(s_i1+s_i2)/2
contribution_i = mix_effect_i + rate_effect_i        // = Δ_i  (정확히, 매 엔티티마다)

Σ_i contribution_i = ΔCPA_total                      // 정확히, 잔차 없음 — 전 엔티티 합산
```
ROAS 방향은 동일 공식에서 `s_i`를 비용 비중(`w_i = cost_i/Cost_total`)으로, `cpa_i`를 `roas_i = revenue_i/cost_i`로 치환하면 동일하게 성립(기존 §7 "ROAS는 display-invert" 패턴과 일관) — **단 위 ⛔ 박스대로 v1에서는 만들지 않음**, 공식만 기록.

**Shapley value 대신 이 방식을 쓰는 이유**: Shapley는 O(2^n) 조합 폭발이라 캠페인/소재 수백 개 단위에 비현실적(코드베이스의 기존 Shapley 활용은 5-18 MMM처럼 채널 수가 5~15개로 적은 경우에 한정, CLAUDE.md §12.10/§12.23/§12.26). 이 PVM 분해는 O(n) 닫힌 형태라 엔티티 수에 무관하게 즉시 계산되고, **완전히 결정론적**(Math.random 없음, §8.7 요구사항)이며, mix/rate 두 축이 사용자가 제시한 두 예시 내러티브와 정확히 대응됨(아래 내러티브 섹션).

### 신규(또는 소멸) 엔티티 처리 — 결측 분모 컨벤션
```js
function cpaOf(cost, result, fallback) {
  return result > 0 ? cost / result : fallback;
}
// 엔티티가 한쪽 기간에 result=0이면 그 기간의 cpa를 "다른 기간 값과 동일"로 간주.
// → 그 엔티티의 rate_effect는 자동으로 0이 되고, 효과 전부가 mix_effect로 귀속됨.
// (신규 진입/완전 소멸 엔티티는 "자체 효율이 변했다"라고 말할 수 없으므로 — 비중 변화로만 설명하는 게 맞음)
const cpa_i1_raw = result_i1 > 0 ? cost_i1/result_i1 : null;
const cpa_i2_raw = result_i2 > 0 ? cost_i2/result_i2 : null;
const cpa_i1 = cpa_i1_raw ?? cpa_i2_raw ?? 0;
const cpa_i2 = cpa_i2_raw ?? cpa_i1_raw ?? 0;
```
전체 분모 가드: `Result_total1 === 0 || Result_total2 === 0`이면 분해 자체를 건너뛰고 "데이터 부족(해당 기간 전환 0)" 메시지만 표시.

### 기간 정의 (WoW)
- `period2` = 데이터 내 최신 날짜 기준 최근 7일(캘린더 일수, ISO 주 정렬 불필요).
- `period1` = `period2` 바로 이전 7일.
- 전체 날짜 범위가 14일 미만이면 "최소 14일 데이터 필요" 안내로 분해를 막음(추측성 비교 방지).
- 7일 고정 외 옵션(14일 등)은 v1에서 토글 안 함 — 필요해지면 후속.

### 계층 단계 처리
- 단계 선택 UI는 pill 형태로 "채널 / 캠페인 / 소재" 3개. **캠페인 pill은 `campaign_id`가 매핑 안 됐으면 잠금** — 기존 MON_TABS의 `locked` pill 패턴을 그대로 재사용(line 6754: `disabled title="이 도구를 열려면 추가 컬럼을 매핑하세요"` vs `data-mon-tab="${d.id}"`). 새 패턴을 만들지 말 것.
- 각 단계는 **독립적으로** 원본 행을 그 단계 키로 groupBy해서 위 공식을 적용 — 채널 합과 캠페인 합이 서로 어긋나는 걸(계층 간 합산 불일치) 정상으로 간주. 이 분해는 "같은 단계 내 엔티티 합 = 전체 ΔCPA"만 보장하며, **단계를 넘나드는 합산 일관성은 보장하지 않음** — 이걸 보장하려는 시도(예: 캠페인 합이 채널 합과 일치하도록 강제)는 하지 말 것. 불필요한 복잡도.
- 기본 선택 단계: **채널**(가장 안정적/적은 엔티티 수) — 사용자가 드릴다운으로 캠페인/소재로 내려가는 흐름.
- 노이즈 가드: 두 기간 합산 `result_i1+result_i2`가 임계값(기본 10, 상수로 분리) 미만인 엔티티는 개별 노출 대신 "기타(소액)" 버킷으로 합쳐서 보여줌 — n이 너무 작은 엔티티가 헤드라인을 차지하는 걸 방지(§9 보수적 판정 철학과 일관).

### 내러티브 생성 로직
사용자가 제시한 두 예시를 다시 보면 **둘 다 mix_effect 사례**임(엔티티 자체 효율이 아니라 비중/예산 변화가 원인):
- "신규 소재 추가 → CPA 하락" = 새 소재가 낮은 자체 CPA로 비중을 얻음 → mix_effect 음수(개선)
- "기존 저활용 소재 예산 증가 → CPA 상승" = 기존에 비중이 작던(평균보다 비싼) 소재가 비중을 늘림 → mix_effect 양수(악화)

분류 규칙(엔티티별):
1. `|mix_effect_i|`와 `|rate_effect_i|` 중 큰 쪽을 "주된 원인"으로 리드.
2. 둘 다 `|contribution_i|`의 20% 이상이면 "이중 효과"로 합쳐서 서술.
3. 템플릿(부호별 4종, mix/rate × 악화/개선):
   - mix 악화(양수): "{entity}의 비중이 {s1%}→{s2%}로 늘었고 평균보다 비싼 편(CPA {cpa_i2}원)이라 전체 CPA를 {mix_effect}원 끌어올림"
   - mix 개선(음수): "{entity}의 비중이 {s1%}→{s2%}로 {늘었고/줄었고} 평균보다 {저렴/비쌈}해 전체 CPA를 {|mix_effect|}원 끌어내림"
   - rate 악화(양수): "{entity} 자체의 CPA가 {cpa_i1}→{cpa_i2}원으로 상승해 전체를 {rate_effect}원 끌어올림(소재 피로/경쟁 심화 가능성)"
   - rate 개선(음수): "{entity} 자체의 CPA가 {cpa_i1}→{cpa_i2}원으로 개선돼 전체를 {|rate_effect|}원 끌어내림"
4. `contribution_i` 기준 내림차순 정렬(절대값), 상위 5~10개를 "이번주 변동 원인" 리스트로 노출. 색상: 🔴(contribution>0, 악화) / 🟢(contribution<0, 개선) — 기존 빨강=악화·초록=호전 컨벤션과 일치(§8.4).
5. 항상 "Σ 기여 = 전체 ΔCPA" 재구성 라인을 표시해 숫자 신뢰성 확보(§9 검증가능성 선호).

### 함수/모듈 네이밍 (제안)
- 순수 통계 함수 모음: `PVM_MATH = { decompose(rowsPeriod1, rowsPeriod2, groupKey), classifyNarrative(entityResult), ... }` — 기존 `ALLOC_MATH`/`CANNIBAL_STATS`/`REG_STATS` 명명 컨벤션(§5.1) 그대로.
- `window.runPvmTests()` — 합성 데이터 golden test 진입점(§8.2 패턴).

### 검증 — 골든 테스트 (손계산 완료, 그대로 assert 가능)

**T1 — 대칭 swap (mix/rate 비0이지만 순효과 0)**
```
P1: A(cost=1000,installs=100,cpa=10) B(cost=1000,installs=50,cpa=20) → Total cpa=2000/150=13.333
P2: A(cost=1000,installs=50,cpa=20)  B(cost=1000,installs=100,cpa=10) → Total cpa=2000/150=13.333
기대값: mix_A=-5, rate_A=+5, contribution_A=0 / mix_B=+5, rate_B=-5, contribution_B=0
검증 포인트: 순효과는 0이지만 mix/rate 컴포넌트 자체는 비0이어야 함(분해가 退化하지 않았음을 증명)
```

**T2 — 신규 엔티티 진입(비싼 채널, result_i1=0 분기)**
```
P1: A(cost=900,installs=90,cpa=10)  [C 없음] → Total cpa=900/90=10
P2: A(cost=900,installs=90,cpa=10)  C(cost=300,installs=10,cpa=30,신규) → Total cpa=1200/100=12
기대값: mix_A=-1, rate_A=0, contribution_A=-1 / mix_C=+3, rate_C=0, contribution_C=+3
Σcontribution = -1+3 = 2 = ΔCPA_total(12-10=2) ✓
```

**T3 — 엔티티 소멸(비싼 채널, result_i2=0 분기, T2의 대칭)**
```
P1: A(cost=900,installs=90,cpa=10)  D(cost=300,installs=10,cpa=30) → Total cpa=1200/100=12
P2: A(cost=900,installs=90,cpa=10)  [D 소멸] → Total cpa=900/90=10
기대값: mix_A=+1, rate_A=0, contribution_A=+1 / mix_D=-3, rate_D=0, contribution_D=-3
Σcontribution = 1-3 = -2 = ΔCPA_total(10-12=-2) ✓
```

3개 모두 `Σ contribution_i === CPA2_total - CPA1_total` (부동소수 허용오차 1e-9) assert 필수 — 이게 깨지면 구현이 틀린 것.

### 함정 (사전 경고)
- **campaign_id 미매핑 시 캠페인 단계를 절대 강제로 만들지 말 것** — 빈 문자열/undefined를 "전체" 같은 가짜 캠페인 버킷으로 묶지 말고, pill 자체를 잠금(위 §"계층 단계 처리" 참고).
- **계층 단계 간 합산 일치를 보장하려 하지 말 것**(위에서 명시) — 시도하면 불필요하게 복잡해지고 버그 유발.
- **노이즈 가드 임계값(기본 10)을 빠뜨리면** 소수 표본 엔티티가 헤드라인을 오염시킴 — 반드시 적용.
- **demo 모드 연동**: `DEMO_BUILDERS`에 5-6용 `_demoCreativeData`(line 25621)가 이미 있음 — TOOL_GROUP을 "creative"로 공유시키므로 **추가 데모 빌더 없이 5-6 데모를 그대로 재사용 가능**(§12.32 패턴, `DEMO_STATE.tool`/`enterDemo` 로직 변경 불필요 — `csvTool` 매핑만 5-21→5-6 grain으로 자연히 해석됨). 별도 demo 빌더를 새로 만들지 말 것(중복).
- **CSV_STATE 공유 시 매핑 독립성**: §12.6대로 5-6 CSV를 이어받아도 매핑은 자기 슬롯에 복사되어 독립적으로 유지됨(`loadCsvFromTool` line 25436~ 기존 로직 그대로 작동, 코드 변경 불필요).

---

## D3 — 라이트모드 사이드바 다크 버그

### 조사 결과 (결론: 현재 코드에서 재현 안 됨)
- Playwright로 다크→라이트 토글을 confound 없이(`page.emulateMedia({colorScheme:'dark'})`로 OS 설정 영향 제거) 재현 테스트함. 결과: 토글 1회 클릭 후 `body.className === "light-mode"`, `.sidebar` 배경 정상적으로 `rgb(255,255,255)`(흰색), `.brand-name`/`.brand-sub`/nav 텍스트 전부 짙은 색으로 정상 렌더. 스크린샷으로 "Performance Marketing" 타이틀이 좌상단에 명확히 보이는 것까지 시각 확인 — 사용자가 보고한 정확한 증상(타이틀 안 보임)이 재현되지 않음.
- git 히스토리 확인: 현재 브랜치는 `origin/main`보다 11 commit 앞서 있고(0 behind), 그 안에 사용자 본인이 직접 커밋한 `3a5f263`(Jun 24, "라이트모드 개선·FOUC 사이드바 플래시 방지·sticky 필터 수정·disclaimer 정리")이 포함돼 있음 — 라이트모드 CSS contrast 보완이 다수 들어간 커밋.
- 다른 미머지 로컬 브랜치(`fix/light-mode-code-contrast`)도 확인했으나 스코프가 SOP 코드 블록 가시성/Swift·Kotlin 주석 마크업 깨짐이라 사이드바/타이틀과 무관.

### 권장 조치
**추가 코드 작업 불필요.** 사용자가 보고 있는 게 Railway 라이브 배포라면, `3a5f263`(이미 머지된 라이트모드 수정)이 배포에 반영되기 전 버전을 보고 있을 가능성이 높음 — **하드 리프레시 후 재확인**을 먼저 권장. 만약 하드 리프레시 후에도 실제로 재현되면(즉 이 조사가 놓친 경로가 있다는 뜻) 정확한 재현 스텝(브라우저/OS 다크모드 설정 여부, 새로고침 직후인지 토글 후인지 등)을 다시 받아서 재조사 필요 — 이 경우 본 문서의 "재현 안 됨" 결론은 보류.

---

## D4 — GA 이벤트 (5-2/5-3 탭 클릭 + 분석 run 분리)

### 기존 인프라 (line 21686~21865, `bindAnalytics`/`track`/`gaContentType`)
- `track("tool_view", { tool: id, content_type, group })` — **모든 페이지 진입마다 이미 발화**(`navigate()`가 실제 페이지 전환 시에만, in-place 재렌더는 제외). 5-2든 5-3이든 `tool` 파라미터로 이미 구분됨.
- `track("run_analysis", { tool: ... })` — `[data-tool-analyze]`("분석하기" 버튼) 클릭마다 **이미 발화**, 모든 CSV 게이트 도구(5-2/5-3 포함) 공통 컨벤션이라 자동으로 적용됨.
- `[data-mon-tab]`(line 21863)/`[data-mon-group]`(line 21865) — 5-2 내부 탭 전환 클릭 핸들러는 존재하지만 **GA 추적 없음**(확인된 유일한 진짜 공백).

### 결론
"탭 클릭"과 "분석 run"을 두 개의 구분되는 GA 신호로 보고 싶다는 요청은, **이미 `tool_view`(도구 진입)+`run_analysis`(분석 실행)로 사실상 충족됨** — GA4 컨벤션상 "도구별 이벤트 N개를 따로 만든다"(예: `tool_view_5_2`, `tool_view_5_3`...)보다 "이벤트 2종 + `tool` 파라미터로 구분"이 표준적이고 유지보수도 쉬움(신규 도구 추가 시 이벤트명 추가 없이 id만 넘기면 자동 포함, GA4 커스텀 이벤트 수 제한에도 안전). 5-3은 내부 탭이 없는 도구라 "탭 클릭"이라는 개념 자체가 없고, 그 경우 `tool_view`가 "그 도구를 열었다"는 의미로 자연스럽게 대응됨.

**⚠ GA4 Admin 설정 필요(코드 무관)**: `tool`/`content_type`/`group` 파라미터는 이벤트 payload에는 이미 실려가지만, GA4 **표준 보고서(탐색·비교)에서 분할 기준으로 쓰려면 GA4 Admin → 맞춤 정의에서 이 파라미터들을 "맞춤 측정기준"으로 등록**해야 함. 등록 전엔 DebugView·BigQuery export에서만 보이고 일반 보고서 UI에는 "도구별 분리"가 안 보여서 "이벤트가 도구별로 안 나뉜 것처럼" 보일 수 있음 — 이게 코드 문제가 아니라 GA4 콘솔 설정 문제라는 점이 헷갈리기 쉬운 부분.

### 권장 조치 (선택, 낮은 위험)
유일한 진짜 공백인 `[data-mon-tab]`/`[data-mon-group]`(5-2 내부 서브탭) 클릭에 한해 추가 추적을 붙이는 건 선택 사항:
```js
// line 21863 부근, 기존 핸들러 안에 한 줄 추가
document.querySelectorAll("[data-mon-tab]").forEach(b => b.addEventListener("click", () => {
  track("mon_tab_click", { tab: b.dataset.monTab });   // 추가
  MON_STATE.tab = b.dataset.monTab; navigate("5-2");
}));
```
이건 "탭 클릭"을 문자 그대로 더 세밀하게 보고 싶을 때만 필요 — `tool_view`/`run_analysis` 조합으로 충분하다고 판단되면 **코드 변경 없이 종료**해도 됨. D2(5-21)는 기존 `[data-tool-analyze]` 컨벤션을 그대로 쓰므로 별도 작업 없이 `run_analysis` 추적이 자동으로 따라옴(D2 작업의 부수 효과로 D4 검증까지 같이 끝남).

---

## 최종 체크리스트 (CLAUDE.md §14 표준 + 본 작업 전용 항목)

- [ ] D1: `ANALYZE_BUCKETS` 제거, `IA`/`OPS_GROUP_IDS` 기반 파생으로 교체. 그룹 배지 파생 로직(섞인 티어 처리) 결정.
- [ ] D2: `5-21` 전 항목 등록(IA/TOOL_TIER/TOOL_REQUIRED_FIELDS/TOOL_OPTIONAL_FIELDS/TOOL_GROUP/PAGE_RENDERERS), `PVM_MATH` 모듈 + `window.runPvmTests()` T1~T3 전부 통과.
- [ ] D3: 코드 변경 없음 — 사용자에게 하드 리프레시/라이브 재확인 요청만.
- [ ] D4: 기존 이벤트로 충족 확인 또는 `mon_tab_click` 1줄 추가.
- [ ] syntax check (`node -e "..."` 스크립트로 `<script>` 블록 추출 검증)
- [ ] `grep -n "^<<<<<<<" index.html` → 0
- [ ] PR 본문 Summary + Test plan + Co-Authored-By
- [ ] main 직접 push 금지, 작업 브랜치 → PR → squash merge
