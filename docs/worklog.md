# 작업 로그 (Worklog)

> **목적**: 2026년 6월 한 달간 토큰 제약으로 **안티그래비티(Antigravity)로 작업을 진행**하며, PR은 하지 않는다.
> 대신 **어떤 작업을 언제·왜 했는지**를 이 파일에 시간순으로 기재한다.
> 토큰 복구 후 Claude 세션에서 **이 로그를 읽고 → 체크하고 → 묶어서 업로드(PR)** 한다.
>
> **기재 규칙** (안티그래비티에게):
> 1. 새 작업마다 맨 아래에 `## YYYY-MM-DD — 한 줄 제목` 블록 추가 (기존 항목 수정·삭제 금지).
> 2. 각 블록에 ① 무엇을 ② 왜(근거) ③ 건드린 함수/심볼·대략 위치 ④ 검증 여부(syntax/골든) ⑤ 미해결/주의 를 적는다.
> 3. **민감 데이터(CSV 내용·수치·키) 금지** — 코드·심볼·의사결정만.
> 4. `index.html` 단일 파일 원칙·`Math.random` 금지 등 `CLAUDE.md` 규칙 그대로 유지.

---

## 미해결 (업로드 시 처리)

- **⚠ 미푸시 혼합 커밋 `d2199a5`**: poly2 예산배분 작업(안티그래비티) + GA4 SOP 세분화(Claude)가 한 커밋에 섞여 있고 **origin/main에 미푸시**. 동시편집 중 `git add index.html`이 양쪽을 흡수한 사고(§11 footgun).
  - **업로드 시**: 둘로 분리 PR. poly2 = 5-3 영역 hunk(`@@ 6444 / 6569 / 7082(ALLOC_MATH) / 7196(ALLOC_STATE) / 20293~22963`), GA4 = `navigate`(tool_view content_type) + `bindAnalytics`(gaContentType·sop_copy·scroll_depth, 약 19718~19790).
  - 이후 안티그래비티 작업은 이 위에 쌓이므로, 업로드 시점에 통합 분리.

- **⚠ 별도 브랜치 `claude/jolly-curie-4zjla6`의 GitHub 권한 차단**: 이 클라우드 컨테이너의 GitHub 자격증명이 `noelnme-gondry/MKT_Library`에 **읽기조차 안 됨**(git push 403 + MCP `get_file_contents`/`list_branches` 404, `get_me`는 성공 — 즉 인증은 되는데 이 레포에 대한 권한이 없음). 이 브랜치 위 커밋들은 patch 파일로 추출해 사용자에게 전달하는 방식으로 핸드오프 중(아래 "패치 핸드오프" 절 참조). poly2/GA4 워크로그(위)와는 **다른 브랜치·다른 차단 원인**이므로 혼동 주의.

---

## 패치 핸드오프 — `claude/jolly-curie-4zjla6` 브랜치 (이 컨테이너, GitHub 권한 차단)

> 이 섹션은 위 안티그래비티 워크로그와 별개. 이 컨테이너에서 작업한 내용은 `main`에 push가 안 되므로,
> 완료된 작업을 모아 **patch 파일**로 추출해 사용자가 다른 계정/세션에 적용하게 한다.
> PR 준비되면 아래 "적용할 파일" 항목을 그대로 안내.

### 2026-06-25 — 5-20 Aha-Moment Finder (윈도우×k 그리드 탐색)
- **무엇**: 신규 분석도구 5-20 "Aha-Moment Finder" — 사용자 행동 데이터에서 리텐션과 가장 상관관계 높은 "초기 행동 윈도우 × 횟수(k)" 조합을 그리드 탐색.
- **커밋**: `35e9f19`(설계 스펙) → `5c1565f`(스펙 갱신: wide 멀티윈도우) → `8501b3d`(구현: 윈도우×k 그리드 탐색).
- **검증**: syntax check 통과, `window.runAhaTests()` 등 골든 테스트 통과(구현 커밋 시점 확인됨).
- **하네스 업데이트**: 미반영 — 다음 커밋에서 CLAUDE.md §3/§13(신규 도구 등록)·mkt-engineer.md에 보강 필요.
- **패치**: `main..claude/jolly-curie-4zjla6 -- index.html docs/aha-moment-finder-spec.md` 추출본을 `SendUserFile`로 전달함(2026-06-25, 1786 insertions/100 deletions, 8개 커밋 전체 포함). 사용자가 다른 계정에 적용 시 이 patch 1개로 5-20 전체 + 본 worklog 이전 작업까지 한꺼번에 들어감(브랜치 전체 diff이기 때문 — 개별 분리 아님).

### 2026-06-25 — 5-12 Segment Explorer Cost 고정 + 정렬 수정 (미커밋)
- **무엇**: §1 세그먼트 효율 매트릭스(5-12) ① Cost를 지표 선택 pill에서 제외(CPI/CPA/ROAS/CTR/CVR만 선택) ② "Cost 분배 (고정)" 섹션을 선택 지표와 무관하게 항상 하단에 추가 렌더 ③ 행 헤더(`<th>`, 국가 라벨) vertical-align 불일치 수정.
- **근본원인**: 전역 CSS `table.data tbody td{vertical-align:top}`가 `<td>`에만 적용되고 `<th>`엔 안 먹어 기본값(middle)로 어긋남. → CLAUDE.md §7에 함정 기재 완료.
- **심볼**: `renderSegmentMatrix()` → `renderSegmentMatrix(metric)`로 파라미터화(no-arg 호출부 없음을 Grep으로 확인), `monSegmentBody()`에서 `metBtns` cost 필터 + 2회 호출(선택 지표 + 고정 `"cost"`).
- **검증**: syntax check 통과, conflict marker 0, `renderSegmentMatrix()` no-arg 잔존 호출 없음(Grep), 독립 Node 하네스로 `runSegmentTests(false)` 5/5 PASS.
- **상태**: **아직 git add/commit 안 됨** (diff만 확인). `git diff --stat -- index.html` → `1 file changed, 10 insertions(+), 8 deletions(-)`.
- **하네스 업데이트**: CLAUDE.md §7에 vertical-align 함정 추가 완료(2026-06-25).

---

## 2026-06-21~22 — poly2 예산배분(5-3) 안전장치 4종 (안티그래비티)

- **무엇**: 5-3 예산 배분 그리디 알고리즘에 ① 종모양(bell)/U자형(u) 곡선 감지 + ⚠ 배지 ② 극점(vertex) 이후 CPR 외삽 차단(`predictSafeCpr`) ③ 소프트 외삽 한도(`extrapolateMode` 1.0/1.3/1.5x/fallback) ④ 채널별 최소/최대 집행 제약(`allocMinSpend`/`allocMaxSpend`).
- **왜**: 하드 xMax 제한으로 잔여 예산 미배분 + poly2 수확체증 착시. 설계문서 `docs/budget-allocation-improvements.md` 개선안 ①②.
- **심볼**: `ALLOC_MATH.detectPoly2Shape`(vertex=−b/2a, a<0=bell), `ALLOC_MATH.predictSafeCpr`(vertex·xMax 클램프), `ALLOC_STATE.extrapolateMode/allocMinSpend/allocMaxSpend`, `calculateAllocationModeB`(그리디 cap·선배분), 배지/경고 render(21716·21971·22023).
- **검증**: syntax OK. (당시 골든 테스트 없음 → 2026-06-24 추가)
- **주의**: `predictSafeCpr`가 cost>xMax를 xMax로 고정 = 설계문서 ① "마지막 관측 효율 유지" fallback 의도와 일치(문제 아님).

## 2026-06-22~24 — GA4/GTM 분석 설치 (Claude, 미푸시분 d2199a5 일부)

- gtag.js(`G-DK12TNR0GW`) + GTM 컨테이너(`GTM-T6C7QW75`) 설치. (gtag.js·GTM·페이월 너비·이벤트 트래킹은 PR #178~181로 일부 이미 머지됨 — `CLAUDE.md §12.40` 참조)
- **미푸시분**: SOP/대시보드 세분화 — `tool_view`에 `content_type`(sop/tool)+group, `sop_copy`(.copy-btn), `scroll_depth`(25/50/75/100%). `gaContentType` 헬퍼.

## 2026-06-24 — poly2 골든 테스트 추가 (Claude)

- **무엇**: `window.runAllocPoly2Tests()` 신설 — `detectPoly2Shape`(bell/u/null) + `predictSafeCpr`(vertex·xMax 클램프·결정론) 합성 유닛테스트 10종. `ALLOC_MATH` IIFE 직후.
- **왜**: §8 통계 도구 표준(순수함수 합성 테스트). poly2 작업에 회귀 안전망 부재였음.
- **검증**: syntax OK, 10/10 ALL PASS (node inject).
- **주의**: 미푸시 상태 유지(6월 PR 안 함). 업로드 시 poly2 PR에 포함.

---

## 세션 상태 스냅샷 (2026-06-24 기준)

**origin/main에 머지 완료 (PR)**:
- #175 운영대시보드 Bundle A(#6 표정렬·#1 platform 멀티셀렉트·#2 코호트토글) / #176 Bundle B(#5 LTV D360 예측·ⓘ·곡선) / #177 Bundle C(#3 스코어카드·#8 퍼널 요일보정·#4 페이싱 요일예측·매출제거)
- #178 GA4 gtag.js / #179 GA4 이벤트 트래킹 / #180 GTM + 페이월 너비 / #181 GA4 SOP/대시보드 세분화

**로컬 미푸시 (feat/poly2-bell-warning, 6월엔 PR 안 함)**:
- `d2199a5` — poly2 예산배분(안티그래비티) + GA4 SOP 세분화(Claude) **혼합** → 업로드 시 분리
- `050e04b` — poly2 골든 테스트 + 본 워크로그 + 설계문서

**브랜치**: `feat/poly2-bell-warning` (장수 feature 브랜치, main은 squash merge)

---

## 다른 계정/세션에서 이어가기

새 계정·새 세션에서 이 작업을 그대로 이어가려면, 레포 클론(또는 동기화) 후 아래 프롬프트로 시작:

```
이 레포는 Performance Marketing Library (단일 index.html SPA, Railway 배포)다.
작업 규칙은 CLAUDE.md를, 6월 작업 이력은 docs/worklog.md를 먼저 끝까지 읽어라.

현재 상태:
- 브랜치 feat/poly2-bell-warning에 로컬 미푸시 커밋 2개(d2199a5, 050e04b)가 있다.
- d2199a5는 poly2 예산배분(안티그래비티 작업)과 GA4 SOP 세분화(Claude 작업)가
  한 커밋에 섞여 있다(§11 git add footgun). origin/main에 미푸시.
- 6월엔 토큰 제약으로 PR을 하지 않고 docs/worklog.md에만 기록하는 모드다.

내가 원하는 것: [여기에 목적 명시 — 예: "안티그래비티로 작업한 poly2를 마저 다듬고 싶다" /
"이제 토큰 복구됐으니 worklog 읽고 미푸시분을 poly2/GA4 둘로 분리해서 PR 올려줘" /
"5-3 예산배분에 X 기능 추가"]

진행 전 모호하면 AskUserQuestion으로 2~4지선다로 물어라.
변경 후 syntax check + window.runAllocPoly2Tests() 같은 in-page 골든 필수.
git add 전에 git diff로 내 변경만 들어가는지 확인할 것(동시편집 흡수 방지).
```

**업로드(분리 PR) 지시 예시** (토큰 복구 후):
```
docs/worklog.md의 "미해결" 섹션을 읽고, 미푸시 커밋(d2199a5)을 poly2(5-3 예산배분)와
GA4 SOP 세분화 둘로 분리해서 각각 PR로 올려줘. 분리 hunk 위치는 worklog에 적혀 있다.
각 PR 전 syntax check + 골든 테스트, CLAUDE.md §6 PR 흐름 준수.
```
