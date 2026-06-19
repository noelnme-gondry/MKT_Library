# P1–P4 실행 스펙 — 무료 대시보드 통합 + Freemium 퍼널 (예산 과소진 탐지)

> 이 문서는 **다른 모델/세션이 그대로 실행**하기 위한 자체 완결형 스펙이다.
> 작업 전 반드시 `CLAUDE.md`(특히 §2 절대원칙·§6 PR흐름·§8 통계엄밀·§11 안티패턴·§12.30 탭병합·§12.32 데모·§14 체크리스트·§15 self-update)를 먼저 읽는다.
> 모든 식별자/라인번호는 **착수 시점에 직접 재확인**한다(이 문서는 2026-06-19 기준 스냅샷).

---

## 0. 전략 (왜)
- **무료(5-2)** = 설명(descriptive) 대시보드 — 뭐가 일어났나. 최대한 풍부하게 → freemium 초입 매력 + 다음 툴로 가는 징검다리.
- **Pro** = 처방(prescriptive)·모델 기반 — 그래서 뭘 해야 하나. 예산 배분(5-3)·실험(5-4)·소재(5-6)·MMM(5-18). 지속 추가 예정.
- **전환 hook** = 무료 5-2가 백그라운드로 **진짜 예산 배분을 돌려** 과소진을 탐지 → "재배분 여지 ₩X" 알림 → Pro 예산 배분(5-3) 페이월로 유도.
- 원칙: **거짓 알림 금지**(§8·§9). 탐지는 보수적으로, 진짜 신호일 때만. 전환률보다 신뢰 우선.

## 1. 목표 도구 맵 (after P1–P4)
도구 **6 → 5개**:
| id | 이름 | 티어 | 구성 |
|---|---|---|---|
| **5-2** | 운영 대시보드(개명 검토) | **무료** | 탭: 시각화·스코어카드·페이싱·이상탐지 + **LTV·ROAS성숙도·코호트(흡수)** + **퍼널·세그먼트(흡수)** + **예산 건강 알림 카드** |
| 5-3 | 예산 배분 | Pro | alloc 단일(퍼널/세그먼트 5-2로 이관). **기본값=절대 CPR/ROAS**, 그리디 강등 |
| 5-4 | 실험 분석 | Pro | 변경 없음 |
| 5-6 | 소재 분석 | Pro | 변경 없음 |
| 5-18 | 마케팅 반응 분석(MMM) | Pro | + **증분 예산 가이드**(그리디 성격, 반응곡선 기반) |
- **5-9 제거**: LTV·성숙도·코호트를 5-2로 통째 흡수.
- redirect 갱신: `5-9→5-2`, `5-16→5-2`, `5-8→5-2`(현재 →5-9), `5-11→5-2`, `5-12→5-2`(현재 →5-3).
- IA에서 5-9 항목 삭제, AUTH에서 5-9 제거. `TOOL_TIER`·`ANALYZE_BUCKETS`·`DEMO_BUILDERS`·`demoKeyForPage` 정합성 갱신.

---

## 2. P1 — 통합 (기계적, §12.30 패턴, render-only 지향)

### 2.1 탭
- `MON_TABS`에 추가: `ltv`, `maturation`, `cohort`, `funnel`, `segment` (총 9탭). 본문은 **기존 함수 그대로 라우팅**:
  - `monLtvCacBody` / `monMaturationBody` / `monCohortBody` (현 5-9), `monFunnelBody` / `monSegmentBody` (현 5-3).
- `MON_STATE.tab` 디스패치에 5개 추가. `LTV_TAB_STATE`·`ALLOC_TAB_STATE`(funnel/segment 부분)는 `MON_STATE`로 흡수/정리.
- **UX 권장(필수 아님)**: 9탭은 많음 → 탭을 3묶음 시각 구분(모니터링 | 가치: LTV/성숙도/코호트 | 효율: 퍼널/세그먼트). `renderMonTabs`에 그룹 라벨만 추가.

### 2.2 cross-grain (§12.30 LTV 패턴 그대로)
- `page_5_2` host에서 활성 탭으로 `csvTool` 결정: `cohort` 탭 → `"5-8"`(코호트 CSV), 그 외 전부 → `"5-2"`(효율 CSV).
- `loadCsvFromTool(csvTool)`로 CSV_STATE 스왑(저장 없이 로드만 = grain 안전). 게이트·업로드·`renderInlineCsvUpload`·`checkRequiredForTool`·`isToolAnalyzed` **전부 csvTool 기준**.
- `TOOL_GROUP`: 5-8 = `"cohort"`(distinct) 유지, 5-2 = `"efficiency"`.

### 2.3 통일 CSV 스키마 (5-2) — **B안: 코어 필수 + 기능 잠금**
`TOOL_REQUIRED_FIELDS["5-2"]` (코어):
```
["date", "channel", "campaign_name", "platform", "cost", { oneOf: ["installs", "actions"] }]
```
`TOOL_OPTIONAL_FIELDS["5-2"]` (매핑 시 기능 켜짐):
| 컬럼 | unlocks |
|---|---|
| country | 세그먼트 국가 차원, 예산 건강 country×OS 분할 |
| impressions, clicks | **퍼널 분석**(노출→클릭→설치→액션) |
| revenue_d0 / revenue_d7 / revenue_d14 | **LTV:CAC · ROAS 성숙도** |
| pu_d7 / ret_d7 등 | 기존 viz 코호트 지표 |
- (코호트 리텐션 탭은 **별도 코호트 CSV** 필요 — 위 효율 CSV와 무관, cohort 탭에서 안내)

### 2.4 업로드 화면 노티스 (사용자 명시)
- `renderInlineCsvUpload`(5-2 경로) 또는 5-2 게이트에 표:
  - **"컬럼을 많이 매핑할수록 더 많은 탭이 켜집니다"** + 위 unlock 표를 눈에 띄게(기능별로 어떤 컬럼이 필요한지).
  - **"모든 데이터는 브라우저 메모리에서만 처리되며 서버로 전송·저장되지 않습니다"** 명시(기존 "도구 전용 저장" 문구를 이걸로 교체/보강 — '저장'이라는 단어가 오해 소지).

### 2.5 viz 원본 데이터 테이블 삭제
- `monVizBody`의 §5 "원본 데이터 (전체 N행)" 섹션 제거(현 index.html:6035 부근). toc의 `s-data`도 제거.

### 2.6 P1 검증
- syntax + 골든 7/7 byte-identical(흡수 본문은 기존 함수라 math 무변).
- `validate_mon` 확장: 9탭 전부 render throw 가드 + cross-grain(cohort=코호트 grain, 나머지=효율 grain) 전환 확인 + 게이트.
- redirect 회귀: `#5-9·#5-8·#5-16·#5-11·#5-12` 전부 5-2로.
- **데모 정합**: `DEMO_BUILDERS`에서 5-9 키 정리, 5-2 효율 데모가 LTV/퍼널/세그먼트 탭까지 커버하도록 컬럼 보강(revenue_d*·impressions·clicks·country 포함). cohort 탭 데모는 `_demoCohortData`(5-8). `validate_demo` 갱신.

---

## 3. P2 — 5-3 기본값 = 절대 CPR/ROAS, 그리디 강등

- 현재 `ALLOC_STATE.allocMode` 기본 `"b"`(그리디). 모드 `"c"` = 절대 CPR 가중(1/avgCPR 비례) 이미 존재.
- **변경**: 기본값 `"c"`로. ROAS 목표일 땐 동일 모드가 ROAS 가중으로 동작(파이프라인 CPR-space + ROAS display-invert 유지, §ROAS 노트).
- **그리디(`"b"`) 강등**: "고급(실험적)" 라벨 + 캐비엇("채널별 spend 변동이 작으면 곡선 적합이 불안정 → 기본은 절대 CPR/ROAS 권장. 증분 배분은 MMM 반응곡선 가이드 참고").
- **최근 윈도우**: `weightMode`(none/linear/exponential 최근 가중) 이미 존재. 추가로 "최근 일/주/월" 집계 윈도우 선택을 예산 입력부에 노출(기본 최근 4주 등). §9 최근성 우선.
- 검증: ALLOC math 함수 무변 → 골든 byte-identical. 기본 state·라벨·윈도우 UI만 변경. `validate_alloc` 기본 모드 c 확인 추가.

---

## 4. P3 — 예산 과소진 탐지 (무료 5-2, 신규)

### 4.1 방법 (절대-CPR 벤치마크 — 곡선 적합 없음, 정직)
1. 최근 윈도우(일/주/월, 기본 최근 4주)로 효율 CSV를 **country×OS×campaign** 집계. country 미매핑 → **OS-only** fallback.
2. 각 캠페인 **절대 CPR**(또는 목표가 ROAS면 ROAS) 산출 → 세그먼트 내 **효율 가중 목표 배분** 계산(= 5-3 mode "c"와 **동일 로직 재사용**).
3. **현재 배분 vs 효율 목표 배분** 차이 = 재배분 가능액.
4. **알림 트리거 — 아래 전부 충족할 때만(보수)**:
   - 플래그 캠페인의 **cost share가 큼**(세그먼트 비용의 ≥ 임계, config 상수).
   - CPR이 동료 대비 **유의하게 나쁨**(단순 노이즈 아님 — 임계·표본 게이트).
   - 최근 윈도우 **데이터 충분**(집행일·행수 게이트). 미달 → **"데이터 부족 ⊘"**(알림 아님).
5. **무료 노출 깊이(미끼)**: "N세그먼트 M캠페인이 효율 구간 초과 · 약 ₩X 재배분 여지" 알림 카드(시각화/스코어카드 탭 상단). 캠페인별 정확 plan·시나리오·export는 **숨김**.
6. **Pro 브리지**: 알림 [예산 배분에서 보기] → `navigate("5-3")` → 기존 Pro 페이월(키 입력) → 5-3에서 동일 절대-CPR 결과(무료 알림과 일치 → 신뢰).

### 4.2 구현 메모
- `BUDGET_HEALTH_RULES`(임계 상수: minCostShare·minCprGap·minDays·minRows) 상단 분리(결정론, §8).
- `buildBudgetHealthCache()`(시그니처 캐시, ALLOC_CACHE 패턴) — 무거우면 1회 계산. 활성 매핑·윈도우 시그.
- 5-3의 mode "c" 가중 로직을 **공유 순수함수로 추출**해 무료 탐지와 Pro 배분이 같은 코드 사용(드리프트 방지).
- `DEMO_STATE` 활성 시에도 동작(데모 효율 데이터로 알림 카드 미리보기) — 단 데모는 실제 스냅샷 미접근(§12.32 가드 그대로).

### 4.3 검증
- `validate_budgethealth`(신규, 주입식): (a) 합성 — 한 캠페인에 cost 몰림+CPR 나쁨 → 알림 ✓ (b) 균등·효율적 데이터 → 알림 없음 (c) sparse 세그먼트 → ⊘ 보류 (d) 결정론 2회 동일 (e) country 미매핑 → OS-only fallback. render throw 가드.

---

## 5. P4 — MMM 증분 예산 가이드 (그리디 성격을 반응곡선 위로)

- MMM은 이미 `saturationByChannel`(`marginal_kpi_per_1k`, §12.19)을 계산 → "현 지출점에서 +₩X 시 채널별 한계 인원".
- mmm-stage(②기여 분해)에 **"추가 예산 배분 가이드"** 뷰 추가: 채널별 한계수익 내림차순 → "다음 예산은 X·Y 순서로" + 누적 응답곡선(§12.19, 한계 hyperbola 금지).
- **라벨/캐비엇 필수**: "가설 가이드 — 인과/증분 확정은 holdout(§16). 채널 단위(캠페인 아님)." 5-3(현재 재배분)과 역할 구분 캡션.
- 5-3 그리디 강등부(P2)에서 "증분은 여기로" 링크 → MMM.
- 검증: 기존 캐시 lookup 위주(render) → 골든 byte-identical. MMM render repro에 가이드 뷰 throw 가드 추가.

---

## 6. 공통 — PR/검증 규율 (모든 Phase)
- Phase별 1 PR (P1은 크면 P1a 통합 / P1b 데모·노티스로 분할 가능).
- 매 PR: syntax → 골든 7/7 → 해당 validate_* → conflict 0 → `feat/poly2-bell-warning` 커밋 → PR(Summary+Test plan+Co-Authored-By) → squash merge → main sync.
- **render throw는 골든이 못 잡음**(§12.22) → 신규/변경 페이지는 `/tmp/validate_*.js` 주입식 repro 필수(Chart 스텁+plugins.afterDatasetsDraw 실행, DOM 스텁).
- byte-identical 기대: 흡수 본문·math는 함수 재사용이라 무변이어야 함. 깨지면 무언가 잘못 옮긴 것.
- **차트·DnD·키보드는 headless 불가 → PR 본문 Test plan에 "브라우저 확인" 체크 명시**.
- self-update(§15): 각 PR에서 새 함정/패턴을 CLAUDE.md §12에 5줄 이내 기록.

---

## 7. P1–P4 후 논의 — Pro 추가 기능 "배치" (사용자: 1:1 대응이라 기존 Pro에 어떻게 넣을지)
브레인스토밍한 Pro 후보를 **신규 도구 X, 기존 Pro 도구의 처방 레이어로** 배치(시작점):
| Pro 추가 | 들어갈 곳 | 형태 |
|---|---|---|
| 증분 예산 플래너 | **5-18 MMM** | P4 가이드의 확장(예산액 입력→채널 배분 plan) |
| 시나리오 시뮬레이터 | **5-18 MMM** | spend ±% → 예상 설치/매출(forecast 엔진 재사용) |
| 처방형 페이싱 플래너 | **5-3 예산 배분** 또는 5-2 페이싱의 Pro 레이어 | 목표 대비 일일 캡 추천·말일 예측 |
| 이상치 근본원인 분해 | **5-2 이상탐지의 Pro 레이어** | 무료=탐지 / Pro=차원 분해(어느 채널·OS·국가) |
| LTV payback 타깃 배분 | **5-3 예산 배분** | LTV:CAC + 회수기간 목표로 배분 가이드 |
- 패턴: **무료 탭=설명 / 같은 도구 Pro 레이어=처방.** 무료 탭마다 "자동 최적화는 Pro" hook → 전환 면적 확대. (P1–P4 완료 후 이 표를 사용자와 확정)
