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
