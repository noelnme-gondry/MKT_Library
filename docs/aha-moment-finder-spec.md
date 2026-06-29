# 5-20 핵심 가치 발굴 — 설계 스펙 (self-contained)

> 목적: 유저별 **행동 횟수(count) + 가입일** 데이터에서, 어떤 선행 행동을 **가입 N일 내 몇 번(k) 이상** 하면
> 타겟 액션(리텐션/전환) 달성과 가장 강하게 연관되는지를 Precision/Recall/F1 + Lift로 탐색.
> ⚠ **가설 생성·기술용**(association). 인과/증분 확정은 holdout(5-4) 전용 — UI·캐비엇으로 강제.

본 도구는 외부 Streamlit 스펙(app.py/Plotly/Pandas)을 본 프로젝트 규칙(§2 단일 index.html · 클라이언트 100% ·
vanilla JS · Chart.js)으로 이식한 것. selectbox/multiselect → 매핑 UI, Plotly scatter → Chart.js scatter.

---

## 0. ⛔ 결정 전 코드 금지 (3중 게이트)

다음은 사용자 확정 완료 — 구현 진입 가능:
- [x] 구현 형태 = **5-20 신규 도구로 index.html 통합** (Streamlit 아님)
- [x] 기간 차원 = **가입일 + 윈도우(7/14/30일) 추가** (누적 count 단순화 아님)

확정 추가(사용자):
- [x] 데이터 grain = **사전집계 wide 멀티윈도우** (가입일·이벤트일 컬럼 없음).
  액션 1개당 윈도우별 컬럼 여러 개(`invite_d0`, `invite_d3`, `invite_d7`, `invite_d14`).
  → 최적화는 **윈도우 × k 2D 그리드** (Best window* + Best k* 동시 선택).
- [x] 컬럼명 규약 = **suffix 자동파싱(`_d{N}`) + 수동 보정 UI** 둘 다.
- [x] count 의미 = **누적(cumulative)** — d7 = 가입 0~7일 총 횟수, d0⊆d3⊆d7⊆d14.

미확정(구현 중 만나면 STOP·AskUserQuestion):
- [ ] 최소 표본 게이트 기본값(support 최소 인원) — 기본 제안 30, config 토글

---

## 1. 절대 원칙 (이 도구 한정)

1. **연관≠인과**: 어떤 Best k도 "k번 하면 리텐션 오른다"로 단정 금지. §0 히어로 카드·각 섹션에
   "engaged 유저는 모든 액션을 많이 함(공통원인) → 확정은 holdout" 캐비엇 명시.
2. **In-sample 최적화 편향 가드**: Best k를 *고르고* 그 F1을 *보고*하면 낙관 편향.
   기본 **train/holdout 50:50 split**(seed 고정)으로 train에서 k 선택 → holdout에서 F1/Precision/Recall 재평가.
   두 값 병기(train F1 vs holdout F1). holdout이 크게 낮으면 "과적합 — 신뢰낮음" 경고.
3. **Support 병기 필수**: Best k의 임계치 통과 유저 수(support)가 minSupport 미만이면 "표본 부족 ⊘",
   산점도에서 회색 처리, 정렬 하위로.
4. **Lift 병기**: `lift = precision / baseRate`. precision 단독 착시(높은 base rate) 방지.
5. **결정론**: split·dummy 데이터 모두 `seededNoise`(Math.random 금지, §8.7). 같은 입력 → byte-identical.

---

## 2. 데이터 계약 (TOOL_REQUIRED_FIELDS["5-20"] / OPTIONAL)

### 사전집계 wide 멀티윈도우 (확정 — 유일 모드)
유저 1명당 1줄. 가입일·이벤트일 컬럼 **없음**. 각 후보 액션은 윈도우별 누적 count 컬럼 묶음.

| 필드(role) | 필수 | 의미 |
|---|---|---|
| `user_id` | 필수 | 유저 식별자(분석엔 미사용·중복검증용) |
| `target` | 필수 | 타겟 달성 1/0 |
| 액션 윈도우 컬럼들 | 필수(≥1) | `{action}_d{N}` 형태. 예: `invite_d0, invite_d3, invite_d7, invite_d14` |

**컬럼 자동 그룹핑**: 정규식 `^(.*?)[_-]?d(\d+)$`(대소문자 무시)로 `(action="invite", window=7)` 파싱.
- 같은 action의 여러 window가 한 액션의 그리드 축이 됨.
- suffix 없는 숫자 컬럼은 `window=∞`(누적 전체) 단일 윈도우 액션으로 취급.
- **수동 보정 UI**: 자동파싱이 틀리면 컬럼별 action명·window를 드롭다운으로 재지정.
  매핑 상태 `AHA_COLMAP = { header: { action, window } }`.

**count = 누적(cumulative)** 가정: d0⊆d3⊆d7⊆d14. (구간 합산 불필요 — 컬럼 값 그대로 임계치 비교)
기본 후보 액션 = target·user_id 제외 모든 그룹.

---

## 3. 핵심 처리 로직 (벡터화)

```
입력: 유저별 { features: {action: {window: cumCount}}, target: 0|1 }, split: train|holdout
baseRate = mean(target)

각 후보 액션 a:
  best = null
  각 window w (a가 가진 윈도우 컬럼들):           # ← 그리드 축 1
    vals = train 유저의 a@w 카운트 배열
    thresholds = sort(unique(vals where v>0))      # ← 그리드 축 2 (k 후보)
    각 k:
      # train에서 평가
      TP = #(cnt>=k & target==1); FP = #(cnt>=k & target==0); FN = #(cnt<k & target==1)
      P = TP+FP>0 ? TP/(TP+FP) : 0
      R = TP+FN>0 ? TP/(TP+FN) : 0
      F1 = (P+R>0) ? 2*P*R/(P+R) : 0       # ⚠ P=R=0 가드(스펙 누락분)
      support = TP+FP
      best = argmax F1 over (w,k) (support>=minSupport 우선; 전부 미달이면 최대 support)
  (bestW, bestK) = best
  # holdout 재평가 (동일 bestW·bestK로 holdout 유저에 TP/FP/FN → P/R/F1/lift)
  결과[a] = { bestW, bestK, train{P,R,F1}, holdout{P,R,F1}, support_holdout, lift=holdoutP/baseRate }
```
- ⚠ **윈도우×k 2D 그리드**라 그리드가 (윈도우 수 × 임계치 수)로 커짐. 누적이라 윈도우↑면 count↑·
  thresholds도 많아짐 → 액션당 윈도우별 정렬 1회씩. 그래도 컬럼·임계치 수는 작아 부담 없음.

- **성능**: 액션당 thresholds 정렬 1회 + 카운트 누적은 단일 패스(값 내림차순 정렬 후 누적합)로
  O(n log n). Float64Array·정수 카운트. 수십만 행도 메인스레드 OK(차트 전 캐시, §4.4 패턴).
- **캐시**: `AHA_CACHE.key = hash(mapping + window + minSupport + splitSeed)`. 토글은 lookup만.

순수함수 모듈 `AHA_STATS = { f1, prCurve, bestThreshold, splitDeterministic }` (단위테스트 가능).

---

## 4. UI (5-20 페이지)

### §0 한눈에 보기 (히어로 카드)
- 전체 유저 수 · 타겟 달성 유저 수 · baseRate.
- Top aha: "가입 **{bestW}일** 내 **{action}**를 **{bestK}번** 이상 → holdout F1 {x}, lift {y}배" 1줄.
- ⚠ "연관이지 인과 아님 · 확정은 홀드아웃(5-4)" 캐비엇 박스.

### §1 컨트롤 (tocFilters)
- 정렬기준 토글(F1/lift/precision) · minSupport 입력 · holdout split on/off.
  (윈도우는 그리드에서 자동 선택 — 전역 셀렉터 없음. 액션별 Best Window가 결과로 나옴.)

### §2 Aha Scatter (Chart.js scatter)
- X=Recall, Y=Precision, 점=후보 액션(bestW·bestK 적용), 색=F1(또는 정렬기준) 그라데이션.
- 점 크기 ∝ support(표본). support<minSupport는 회색·반투명.
- Hover: 액션명 · **Best Window(d{N})** · Best k(>=) · Precision · Recall · F1 · Lift · support · (train vs holdout).
- `destroyChartIfExists` → `CHART_INSTANCES["aha-scatter"]`, PNG 다운로드 버튼.

### §3 결과 테이블
- [액션 · **Best Window** · Best k(>=) · holdout F1 · Precision · Recall · Lift · support · train F1(과적합 비교)],
  정렬기준 desc. 색코드: lift≥1.5 강함 초록 / support 부족 회색 / holdout≪train 빨강(과적합).
- CSV 다운로드(BOM+CRLF, §7): 행별 action·window·k·전 지표·support·train/holdout.

### §4 (옵션) 액션 드릴다운 — 윈도우×k 히트맵
- 선택 액션 1개의 `윈도우 × k` F1 그리드를 Chart.js 매트릭스(또는 색배경 표)로 → "어느 조합이 핫한지" 한눈에.
  Best 셀 강조. 윈도우/임계치 민감도 확인용(과적합 의심: 단일 셀만 튀면 신뢰낮음).

---

## 5. 검증 자산 (신규 작성)

- in-page `window.runAhaTests()` — 합성 데이터 골든:
  - T1 F1 항등식(P=R=1 → F1=1; P=R=0 → F1=0 가드)
  - T2 bestThreshold 단조: 완전 분리 신호(k≥k0에서 target=1) → bestK=k0·F1=1
  - T3 split 결정론: 같은 seed → 같은 분할(재호출 byte-identical)
  - T4 lift 정확: baseRate 0.5·precision 0.75 → lift 1.5
  - T5 support 게이트: 전부 minSupport 미달 → 최대 support 조합 선택(크래시 없음)
  - T6 윈도우×k 그리드: 좁은 윈도우(d3)에 강신호·넓은 윈도우(d14) 노이즈 심으면 bestW=3 선택
  - T7 컬럼 그룹핑: `invite_d7` 정규식 파싱 → (action="invite", window=7) 정확
- syntax check(§6) + render-throw repro(`/tmp` — 이벤트모드·wide모드·빈 후보 각각, §12.22 교훈).

## 6. 더미 데이터 (generate_dummy 대체)
- Streamlit `generate_dummy.py` 대신 **데모모드 빌더**(`DEMO_BUILDERS["5-20"]`, §12.32)로:
  `seededNoise` 고정 seed. wide 멀티윈도우 행 생성: user_id·target·`{action}_d{0,3,7,14}`(누적·단조↑).
  액션별 분포 다양 — 일부는 특정 윈도우에 강한 aha 신호(예 invite_d3에서 분리), 일부는 노이즈.
  데모는 실제 스냅샷 불변.

## 7. 알려진 함정 (§7 본진 등록 예정)
- **F1 0/0**: P=R=0 → F1 분모 0. 반드시 가드(스펙 원문은 P,R만 0가드).
- **컬럼 그룹핑 오인**: `revenue_d7` 같은 매출/금액 컬럼이 count 아닌데 `_d{N}` 정규식에 걸림 →
  수동 보정 UI로 제외 가능. 자동파싱은 제안일 뿐, 사용자가 후보 확정.
- **타겟 누수(leakage)**: 타겟 자체와 동일·후행 액션을 후보로 넣으면 F1≈1 가짜. 후보=선행행동만 권장(캐비엇).
- **누적 단조 위반**: d3>d7 같은 비단조 행(데이터 오류) 탐지 시 경고(누적 가정 위배). 분석은 값 그대로 진행.
- **support 작은 Best 조합**: 윈도우×k 그리드가 커 우연 최고 F1 셀이 나오기 쉬움 →
  minSupport 게이트 + holdout 재평가 + §4 히트맵(단일 셀만 튀면 신뢰낮음)으로 삼중 방어.

## 8. 통합 절차 (§12.1)
1. IA에 새 그룹(예 id "11" "행동 분석") + `{id:"5-20", title:"핵심 가치 발굴", desc}` / OPS_GROUP_IDS 추가
2. AUTH_PROTECTED_PAGES += "5-20" (Pro 티어 — TOOL_TIER)
3. TOOL_REQUIRED_FIELDS/OPTIONAL["5-20"] (§2)
4. page_5_20() — checkRequiredForTool + renderInlineCsvUpload fallback + 분석게이트(§12.14)
5. PAGE_RENDERERS["5-20"]=page_5_20 / 핸들러 바인딩
6. AHA_STATS·AHA_CACHE·buildAhaCache / 차트 / CSV / runAhaTests
7. DEMO_BUILDERS["5-20"] (§12.32)
8. PR 흐름(§6) — 단, 현재 push 블로커(proxy 403) 미해결 시 로컬 커밋만
