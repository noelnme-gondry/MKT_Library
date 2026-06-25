# 5-20 Aha-Moment Finder — 설계 스펙 (self-contained)

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

미확정(구현 중 만나면 STOP·AskUserQuestion):
- [ ] 데이터 grain = 이벤트 레벨(user_id, signup_date, event_date, action) vs 사전집계 윈도우 컬럼(`action_d7`)
  중 어느 쪽을 1차 지원? (§2 데이터 계약 — **현재 스펙 기본안은 이벤트 레벨**, 사전집계는 옵션)
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

### 2-A. 기본안: 이벤트 레벨 CSV (진짜 윈도우 aha)
유저 1명이 여러 행. 윈도우 내 count를 JS에서 집계.

| 필드(role) | 필수 | 의미 |
|---|---|---|
| `user_id` | 필수 | 유저 식별자 |
| `signup_date` | 필수 | 가입일(코호트 기준점). robust 파싱(§7 날짜 함정) |
| `event_date` | 필수 | 행동 발생일 |
| `action` | 필수 | 행동 종류(문자열) — 후보 액션이 됨 |
| `target` | 필수 | 타겟 달성 1/0 (유저 단위 — 첫 행 값 사용·assert 일관성) |
| `count` | 옵션 | 행당 횟수(없으면 1행=1회) |

집계: 각 유저×action에 대해 `windowCount = Σ count where (event_date − signup_date) ∈ [0, W)`.
타겟은 유저 단위라 윈도우 무관(라벨).

### 2-B. 옵션: 사전집계 wide CSV (윈도우 컬럼 직접)
유저 1명당 1줄. 컬럼명에 윈도우 내장(`feature_x_d7`). 윈도우 재계산 불가 → 업로드된 윈도우 그대로 사용.
| `user_id` 필수 / `target` 필수(1·0) / 나머지 숫자 컬럼 = 후보 액션(누적 또는 사전윈도우) |
→ 이 모드는 "기간"이 파일 속성. UI 윈도우 셀렉터 숨김.

**모드 자동 판정**: signup_date+event_date 매핑되면 2-A(이벤트), 아니면 2-B(wide).

---

## 3. 핵심 처리 로직 (벡터화)

```
입력: 유저별 { features: {actionName: windowCount}, target: 0|1 }, split: train|holdout
baseRate = mean(target)

각 후보 액션 a:
  vals = train 유저의 a 카운트 배열
  thresholds = sort(unique(vals where v>0))     # k 후보
  각 k:
    # train에서 평가
    TP = #(cnt>=k & target==1); FP = #(cnt>=k & target==0); FN = #(cnt<k & target==1)
    P = TP+FP>0 ? TP/(TP+FP) : 0
    R = TP+FN>0 ? TP/(TP+FN) : 0
    F1 = (P+R>0) ? 2*P*R/(P+R) : 0         # ⚠ P=R=0 가드(스펙 누락분)
    support = TP+FP
  bestK = argmax F1 over k (단, support>=minSupport 우선; 전부 미달이면 최대 support의 k)
  # holdout 재평가 (동일 bestK로 holdout 유저에 TP/FP/FN → P/R/F1/lift)
  결과[a] = { bestK, train{P,R,F1}, holdout{P,R,F1}, support_holdout, lift=holdoutP/baseRate }
```

- **성능**: 액션당 thresholds 정렬 1회 + 카운트 누적은 단일 패스(값 내림차순 정렬 후 누적합)로
  O(n log n). Float64Array·정수 카운트. 수십만 행도 메인스레드 OK(차트 전 캐시, §4.4 패턴).
- **캐시**: `AHA_CACHE.key = hash(mapping + window + minSupport + splitSeed)`. 토글은 lookup만.

순수함수 모듈 `AHA_STATS = { f1, prCurve, bestThreshold, splitDeterministic }` (단위테스트 가능).

---

## 4. UI (5-20 페이지)

### §0 한눈에 보기 (히어로 카드)
- 전체 유저 수 · 타겟 달성 유저 수 · baseRate.
- Top aha: "가입 {W}일 내 **{action}**를 **{bestK}번** 이상 → holdout F1 {x}, lift {y}배" 1줄.
- ⚠ "연관이지 인과 아님 · 확정은 홀드아웃(5-4)" 캐비엇 박스.

### §1 컨트롤 (tocFilters)
- 윈도우 셀렉터(7/14/30/커스텀일 — 이벤트 모드만) · 정렬기준 토글(F1/lift/precision) ·
  minSupport 입력 · holdout split on/off.

### §2 Aha Scatter (Chart.js scatter)
- X=Recall, Y=Precision, 점=후보 액션(bestK 적용), 색=F1(또는 정렬기준) 그라데이션.
- 점 크기 ∝ support(표본). support<minSupport는 회색·반투명.
- Hover: 액션명 · Best k(>=) · Precision · Recall · F1 · Lift · support · (train vs holdout 둘 다).
- `destroyChartIfExists` → `CHART_INSTANCES["aha-scatter"]`, PNG 다운로드 버튼.

### §3 결과 테이블
- [액션 · Best k(>=) · holdout F1 · Precision · Recall · Lift · support · train F1(과적합 비교)],
  정렬기준 desc. 색코드: lift≥1.5 강함 초록 / support 부족 회색 / holdout≪train 빨강(과적합).
- CSV 다운로드(BOM+CRLF, §7): 행별 action·k·전 지표·support·train/holdout.

---

## 5. 검증 자산 (신규 작성)

- in-page `window.runAhaTests()` — 합성 데이터 골든:
  - T1 F1 항등식(P=R=1 → F1=1; P=R=0 → F1=0 가드)
  - T2 bestThreshold 단조: 완전 분리 신호(k≥k0에서 target=1) → bestK=k0·F1=1
  - T3 split 결정론: 같은 seed → 같은 분할(재호출 byte-identical)
  - T4 lift 정확: baseRate 0.5·precision 0.75 → lift 1.5
  - T5 support 게이트: 전부 minSupport 미달 → 최대 support k 선택(크래시 없음)
  - T6 윈도우 집계: signup+W 경계(=W일째 포함/미포함 규약 [0,W)) 정확
- syntax check(§6) + render-throw repro(`/tmp` — 이벤트모드·wide모드·빈 후보 각각, §12.22 교훈).

## 6. 더미 데이터 (generate_dummy 대체)
- Streamlit `generate_dummy.py` 대신 **데모모드 빌더**(`DEMO_BUILDERS["5-20"]`, §12.32)로:
  `seededNoise` 고정 seed, 액션별 분포 다양(일부는 강한 aha 신호 심고, 일부는 노이즈).
  이벤트 레벨 행 생성(user_id·signup_date·event_date·action·target). 데모는 실제 스냅샷 불변.

## 7. 알려진 함정 (§7 본진 등록 예정)
- **F1 0/0**: P=R=0 → F1 분모 0. 반드시 가드(스펙 원문은 P,R만 0가드).
- **날짜 파싱**: signup/event MM-DD·DD-MM 혼재 → robust 파싱·정렬 검증(§B 선행분석 실패 재발 방지).
- **타겟 누수(leakage)**: 타겟 자체와 동일·후행 액션을 후보로 넣으면 F1≈1 가짜. 후보=선행행동만 권장(캐비엇).
- **윈도우 경계**: `[0, W)` 규약 고정(가입일=0일째 포함, W일째 제외). 골든 T6로 못박음.
- **support 작은 Best k**: precision 우연 변동 → minSupport 게이트 + holdout 재평가로 이중 방어.

## 8. 통합 절차 (§12.1)
1. IA에 새 그룹(예 id "11" "행동 분석") + `{id:"5-20", title:"Aha-Moment Finder", desc}` / OPS_GROUP_IDS 추가
2. AUTH_PROTECTED_PAGES += "5-20" (Pro 티어 — TOOL_TIER)
3. TOOL_REQUIRED_FIELDS/OPTIONAL["5-20"] (§2)
4. page_5_20() — checkRequiredForTool + renderInlineCsvUpload fallback + 분석게이트(§12.14)
5. PAGE_RENDERERS["5-20"]=page_5_20 / 핸들러 바인딩
6. AHA_STATS·AHA_CACHE·buildAhaCache / 차트 / CSV / runAhaTests
7. DEMO_BUILDERS["5-20"] (§12.32)
8. PR 흐름(§6) — 단, 현재 push 블로커(proxy 403) 미해결 시 로컬 커밋만
