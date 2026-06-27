# 코드·아키텍처 건강성 감사 (2026-06)

전체 툴 개선 준비 — 단일 `index.html`(SaaS SPA)의 건강 상태 실측 + 우선순위 정리 로드맵.
원칙: **단일 HTML 파일·클라이언트 100%·골든 byte-동일**(CLAUDE.md §2)을 깨지 않는 선에서 유지보수성·안정성·개발속도를 올린다.

---

## 0. 요약 (TL;DR)

- 규모: **28,474줄 / 1.64MB**. JS 단일 `<script>` 블록 **1.36MB**, CSS 단일 `<style>` **101KB**. 함수 ~1,000개(`function` 680 + arrow ~386).
- 안전망: 순수함수 단위테스트 **18종**(`runXxxTests`, stats 잘 커버) + 골든 byte-동일 + syntax check. **단, 전부 세션마다 Node 주입 harness로 즉석 실행 — 커밋된 러너·CI 없음.**
- 권고 순서: **① 테스트 러너 커밋(안전망 고정) → ② 문서 드리프트·중복 CSS(저위험 정리) → ③ 대형 함수 분해(골든 보호 하)**. 안전망부터 깔아야 이후 정리가 안전.

---

## 1. 지표 스냅샷

| 항목 | 값 | 비고 |
|---|---|---|
| 총 줄/바이트 | 28,474줄 / 1.64MB | 단일 파일 |
| JS 블록 | 1,357,622 chars (1블록) | block 10 |
| CSS 블록 | 100,797 chars (1블록) | style 1 |
| 함수 | `function` 680 + arrow ~386 | |
| 테스트 함수 | 18× `runXxxTests` | stats 순수함수 커버 |
| console.log | 31 (대부분 테스트 출력) | 잔재 아님 |
| TODO/FIXME/debugger | 0 | 클린 |
| 활성 분석 도구 | 7 (5-2·5-3·5-4·5-6·5-18·5-20·5-21) | |
| 흡수 구 id | 13 (5-5·5-7~5-19) | navigate redirect 보존 |

---

## 2. 발견 (심각도별)

### P1 — 안전망·정합성 (먼저)

**2.1 커밋된 테스트 러너·CI 부재** 〔효과 高 / 노력 中 / 위험 低〕
18개 `runXxxTests` + 골든이 있으나 **세션마다 `/tmp` Node 주입 스크립트로 즉석 재작성** → 재현·회귀 감지가 사람 손에 의존. render-throw(§7 PR#102)는 골든도 못 잡음.
- **제안**: 루트에 `validate.js`(Node) 커밋 — index.html에서 `<script>` 추출→`vm`로 로드→전 `runXxxTests()` 실행 + syntax check, 실패 시 nonzero exit. `package.json`에 `"test": "node validate.js"`. (선택) GitHub Action 1개.
- **규칙 충돌 확인 필요**: §2.1 "별도 .js 금지"는 **앱(배포) 코드** 대상. `validate.js`는 dev 도구(배포 X)지만 NEVER 원칙이라 **사용자 승인 후** 진행.

**2.2 CLAUDE.md §4.2 문서 드리프트** 〔효과 中 / 노력 極低 / 위험 低〕
§4.2 표가 **6개 도구만 + "17→5/6 통합"**으로 기재 — 실제로 **5-20 Aha-Moment Finder가 활성**(IA `index.html:3468` · `page_5_20` 17889 · `runAhaTests` · `docs/aha-moment-finder-spec.md` 존재). 표에 5-20 누락, "17→7"로 수정 필요. 하네스가 한 도구 뒤처져 후속 작업 오도 위험.

### P2 — 죽은/중복 코드 (저위험 정리)

**2.3 중복 CSS 셀렉터** 〔효과 低 / 노력 極低 / 위험 低〕
`.alloc-budget-alert-banner` **2회 정의** (`index.html:491`, `:2460`). 충돌·혼란 — 하나로 통합.

**2.4 console.log 감사** 〔효과 低 / 노력 低 / 위험 低〕
31개 중 대부분 `runXxxTests` 출력(의도적, 유지). 비-테스트 잔재만 선별 제거(전수 11곳 확인 결과 테스트가 다수). 낮은 우선순위.

### P3 — 유지보수성 (골든 보호 하 리팩토링)

**2.5 대형 함수 분해 후보** 〔효과 中 / 노력 中 / 위험 中〕
`renderAllocatorScatter`(395줄, `:24526`) · `bindBudgetAllocatorHandlers`(385줄, `:27113`) · `page_5_4`(269줄) · `bindABCalculatorHandlers`(267줄) · `bindCSVPageHandlers`(265줄) · `monAllocBody`(261줄) · `renderInlineCsvUpload`(251줄). 거대 함수는 §7 함정(상태 분기·cross-page 핸들러) 온상. **순수 추출 위주**, 렌더/핸들러는 골든+주입 harness로 양 분기 검증 후.

**2.6 CSS/JS 단일 대형 블록 항법** 〔효과 低 / 노력 低 / 위험 低〕
1.36MB JS·101KB CSS 단일 블록 — 분할 불가(§2.1). **섹션 인덱스 주석**(`// ===== [N] 5-3 예산배분 =====`) 표준화로 점프 비용↓.

### 컨텍스트 (결함 아님 — 과장 금지)

- **흡수 id navigate redirect**: 5-5/5-8/5-19 등 렌더러 0인데 navigate 다수 호출 → `navigate()` 상단 if-체인(`:23371~23388`)이 host+탭으로 **정상 redirect**. 북마크 보존 의도(§4.2), 버그 아님. 내부 핸들러가 host 직접 호출로 단순화 가능하나 저효과·redirect는 외부 북마크용으로 유지 필요.
- docs/ 13종 풍부(스펙·백로그·worklog) — 문서 문화는 건강. CLAUDE.md 표만 동기화 필요(2.2).

---

## 3. 우선순위 로드맵

| # | 작업 | 효과 | 노력 | 위험 | 선행 |
|---|---|---|---|---|---|
| 1 | 테스트 러너 `validate.js` + `npm test` 커밋 (§2.1 승인 필요) | 高 | 中 | 低 | — |
| 2 | CLAUDE.md §4.2 + agents 5-20 반영·"17→7" | 中 | 極低 | 低 | — |
| 3 | 중복 CSS `.alloc-budget-alert-banner` 통합 | 低 | 極低 | 低 | — |
| 4 | 섹션 인덱스 주석 표준화(항법) | 中 | 中 | 低 | 1 |
| 5 | 대형 함수 순수 추출(scatter·bind류) | 中 | 中 | 中 | 1 |
| 6 | console.log 비-테스트 잔재 선별 | 低 | 低 | 低 | — |

**핵심**: 1번(안전망)을 먼저 깔면 4·5번 리팩토링이 골든+자동테스트로 byte-동일 보증되어 위험이 낮아진다. 1번 없이 5번부터 가면 §7 render-throw 함정에 노출.

---

## 4. 안전 작업 원칙 (모든 정리에 적용)

1. 변경 전후 `node validate.js`(또는 즉석 harness)로 전 `runXxxTests` + syntax 통과 확인.
2. 순수함수 추출은 골든 byte-동일 검증, 렌더/핸들러 추출은 주입식 harness로 양 분기·태그모드 검증(§7 PR#102).
3. 한 번에 한 종류만(중복제거 / 추출 / 주석) — 섞으면 회귀 원인 격리 불가.
4. `git add` 명시 파일만(§2.6), 커밋 단위 작게.
