# Performance Marketing Library — Agent Harness

이 프로젝트에서 작업하는 모든 Claude 인스턴스가 따르는 규칙·아키텍처·작업 방식.
2026-06 압축본. 과거 PR별 상세 내러티브는 git 히스토리·PR·`docs/*.md`에 보존됨.

---

## 1. 프로젝트 정체성

- **이름**: Performance Marketing Library (Ops Dashboard)
- **목적**: 앱 퍼포먼스 마케팅 SOP 문서 + CSV 기반 운영 데이터 분석 도구
- **배포**: Railway (`mktlibrary-production.up.railway.app`) — `main` 자동 deploy
- **저장소**: `https://github.com/noelnme-gondry/MKT_Library`
- **타겟**: 시니어 퍼포먼스 마케터 (KR 시장, 한글 UI)
- **데이터 민감도**: 마케팅 운영 데이터 = 사내 민감 자료. **클라이언트 사이드 처리만**, 서버 전송 금지.

---

## 2. 절대 원칙 (NEVER 깨지 말 것)

1. **단일 HTML 파일**: 모든 코드는 `index.html` 하나에. 별도 .js/.css 금지. 빌드 도구 없음. CDN 라이브러리만.
2. **클라이언트 사이드 100%**: 사용자 CSV는 브라우저 메모리에만. 서버 전송/저장 절대 금지.
3. **Supabase service_role key 절대 요청·저장·언급 금지**. anon public key만 (RLS 보호).
4. **main 직접 push 금지**. 반드시 feat 브랜치 → PR → squash merge.
5. **Force push to main 금지**. hook skip(`--no-verify`) 금지.
6. **`git add -A`/`git add .` 금지** — 사용자가 드롭한 민감 데이터·대용량 폴더가 통째로 커밋될 수 있음(PR #54 사고). 항상 `git status` 확인 후 **변경 파일만 명시적으로** `git add index.html CLAUDE.md ...`. 외부 데이터는 먼저 `.gitignore`.
7. **모호한 결정 임의 확정 금지** — 합리적 선택지 2개 이상이면 `AskUserQuestion`으로 묻기.
8. **정직성**: 동작 안 하는 기능·거짓 숫자·우리 보안모델과 모순되는 카피 금지. 추정 불가하면 "추정 불가"라고 정직하게.

---

## 3. 기술 스택

```
HTML/CSS/JS (Vanilla) — 빌드 도구 없음. `serve . -l $PORT` 가 전부.
├─ Chart.js 4.4.4       (CDN) — 모든 차트
├─ PapaParse 5.4.1      (CDN) — CSV 파싱
├─ Supabase JS 2.45.4   (CDN) — 접근 키 검증 (anon RPC만)
├─ SheetJS 0.18.5       (CDN) — XLSX export
└─ Inter / JetBrains Mono (Google Fonts) — Obsidian Flux 디자인 시스템
```

---

## 4. 아키텍처

### 4.1 페이지 라우팅
- Hash 기반 (`#5-3` 등). `PAGE_RENDERERS[id]` 디스패치 테이블 → 페이지 함수.
- `IA` 배열이 사이드바 구조(`IA → groups → items`). `findMeta(id)` 메타 조회.
- `pageShell(meta, { deck, chips, summary, toc, body, tocFilters })` 공통 레이아웃.
- **내부 id(`5-2`)는 절대 불변** — hash·렌더러·navigate·AUTH·TOOL_* 수백 곳 의존, 북마크 깨짐. 표시 번호만 바꾸려면 `displayItemNumber(id)`/`displayGroupNumber(id)` 순수함수 사용(§12.6).

### 4.2 현재 도구 (17→5/6 통합 완료)

| ID | 도구 | 티어 | 데이터 |
|---|---|---|---|
| 1-x~4-x | SOP 문서 | free | 정적 JSON |
| 5-2 | 운영 대시보드 (시각화·스코어카드·페이싱·이상탐지·LTV·성숙도·코호트·퍼널·세그먼트, 9탭) | **free** | 효율 CSV |
| 5-3 | 예산 배분 (절대 CPR/ROAS 가중 + 한계효용 그리디) | free | 효율 CSV |
| 5-4 | 실험 분석 (A/B·Test Readout·Incrementality, 3탭) | pro | 수동/CSV |
| 5-6 | 소재 분석 | pro | 소재 daily CSV |
| 5-18 | 마케팅 반응 분석 (MMM: 진단/기여/Forecast + Regression Lab) | pro | 주간 패널 CSV |
| 5-21 | 캠페인 성과 변동 탐지 (PVM 무잔차 분해) | pro | 소재 CSV 공유 |

티어: `TOOL_TIER`(free/pro) + `AUTH_PROTECTED_PAGES`. 흡수된 구 도구 id는 `navigate` redirect로 보존.

### 4.3 도구별 독립 CSV 상태
```js
TOOL_CSV_SNAPSHOTS = { "5-2": {...}, ... }   // 도구별 자체 snapshot
ACTIVE_CSV_TOOL                              // 현재 활성
CSV_STATE                                    // 활성 도구의 raw/headers/mapping 거울
```
- `navigate("5-N")` → `loadCsvFromTool("5-N")` → `CSV_STATE` 채움. 업로드/매핑 변경 → `saveCsvToTool(id)`.
- 필수/옵션: `TOOL_REQUIRED_FIELDS` + `TOOL_OPTIONAL_FIELDS`. 인라인 업로드 UI: `renderInlineCsvUpload(toolId)`.
- **공유 CSV**: `TOOL_GROUP` 맵으로 같은 grain 도구 묶음 → 형제 CSV 자동 이어받음(매핑은 본인 슬롯 독립). cross-grain은 distinct 그룹으로 분리(폴백이 잘못된 CSV 끌어오는 것 방지).

### 4.4 캐시 패턴
무거운 계산은 항상 캐시. 키 = 입력 시그니처 해시. 토글 클릭은 **lookup만**(재계산 X).
```js
function buildXxxCache() {
  const key = computeKey();             // mapping + data hash
  if (CACHE.key === key) return CACHE;  // hit
  /* rebuild */ CACHE.key = key;
}
```

### 4.5 접근 키 인증
- `AUTH_PROTECTED_PAGES` Set. 키 SHA-256 해시 후 Supabase `validate_access_key(hash, device)` RPC 검증. 평문 키 서버 전송 X.
- **디바이스 바인딩**: `device_token`이 최초 검증 기기에 바인딩, 다른 기기 사용 시 `device_mismatch` 거부. 클라이언트는 `getDeviceToken()`(localStorage `mkt_library_device_id`). 정당한 기기변경은 admin이 `device_token=NULL` 리셋.
- Pro 페이월: `pageAuthGate`(블러 데모 + 🔒Pro 카드 + Instagram DM @gondry__workshop). 키 발급/관리: `supabase/SETUP.md`.

---

## 5. 코드 컨벤션

- **JS**: `var` 금지·`const` 기본·재할당만 `let`. 순수 함수 우선, 사이드이펙트 명시. `camelCase`, boolean은 `is*`/`has*`/`can*`. 통계 함수는 `CANNIBAL_STATS`·`ALLOC_MATH` 같은 객체에 모음(단위 테스트 가능). DOM은 `getElementById`/`querySelectorAll` 직접(jQuery X).
- **CSS**: 의미적 변수(`--bg-1`·`--text-muted`·`--border` Obsidian Flux 토큰). 인라인 style은 일회성만. 공용은 클래스(`chart-container` 등).
- **한/영**: UI 표시=한글, 코드 식별자=영어, 주석=한글 OK. CSV 헤더 한글 alias 등록 가능.
- **Chart.js**: `responsive:true, maintainAspectRatio:false` 항상. 부모 `.chart-container`. 다크 테마 색 명시(`getCssVar`). 인스턴스 `CHART_INSTANCES[id]` 저장 후 재렌더 전 destroy. PNG 다운로드는 합성 캔버스에 배경(`--bg-1`) 깔고 export.

---

## 6. 작업 워크플로우 (PR 흐름)

### 6.1 기본 흐름
1. 요청 받음 → 모호하면 `AskUserQuestion`(옵션·트레이드오프 명시).
2. 작업 브랜치 `feat/poly2-bell-warning`(장수 feature 브랜치, 지속 사용).
3. 변경 후 **syntax check 필수**: `<script>` 블록 추출(ld+json 제외) → `new Function(total)`.
4. `git add <명시 파일>` + 커밋(Co-Authored-By 라인, HEREDOC).
5. push → `gh pr create --base main`. PR body: `## Summary` bullets + `## Test plan` checkboxes + `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
6. `gh pr merge <N> --squash`. 충돌 시 §6.2.

### 6.2 squash-merge 충돌 해결 (반복 패턴)
main이 squash-merge라 장수 feat 브랜치와 매 PR마다 index.html 충돌. feat는 보통 main의 superset:
```
git merge origin/main --no-edit → git checkout --ours index.html
→ grep -c "^<<<<<<<" index.html (0 확인) → syntax+골든 재실행
→ git commit --no-edit → push → 재 merge
```
**마커 남긴 채 커밋 금지**. 단, --ours 전에 `git diff origin/main -- index.html`로 **진짜 divergent 편집(같은 라인 다른 값)**이 없는지 확인 — 있으면 어느 쪽이 최신 의도인지 판단 후 수동 병합(맹목 --ours 금지). 티어/표시문구 같은 의사결정성 라인이 갈리면 사용자에게 보고.

### 6.3 commit 메시지
- 1행 요약(50자 이내, 한글 OK) + 본문 섹션별(사유·근거 중심) + 마지막 `Co-Authored-By:` 라인 필수.

---

## 7. 버그 트리아지 + 알려진 함정

**트리아지 5단계**: ① 증상 확인(스크린샷·콘솔) ② 재현(`/tmp` Node 스크립트로 사용자 CSV 직접 파싱+의심 함수 호출) ③ 근본 원인(line-by-line, edge case: 윤년/0/NaN/빈배열/타입) ④ 방어 코드 + 진단 패널(`<details>`) ⑤ syntax+validation 재실행 후 commit.

### 알려진 함정 (재사용 가능한 일반 교훈)
- **윤년**: `dayOfYear()` 1~366 반환 → 배열 길이 367 보장.
- **CSV 콤마**: `"2,488"` 쌍따옴표 안 콤마. PapaParse 사용(직접 split 금지). **dynamicTyping 없이** → 모든 값 문자열, `parseFloat`.
- **Chart.js transparent → PNG**: dark 배경 명시 합성 후 export.
- **localStorage 영속 금지**(요청 시에만). 새로고침 리셋이 기본.
- **로그-스페이스 수치**: 큰 파라미터 Beta PDF 등 underflow → log-space 계산 후 max 빼고 exp 정규화(PR #30).
- **CSV 다운로드 = CRLF + BOM**: `lines.join("\n")`는 Excel에서 한 행으로 뭉침(RFC4180 위반). **`\r\n` 조인 + BOM(`﻿`) + `text/csv;charset=utf-8`**. 콤마는 따옴표 이스케이프(`q()`). 날짜 문자열 컬럼은 `parseFloat`가 연도만 추출하므로 원본 라벨 별도 보존(`weekLabel`).
- **공유 CSS 클래스 + 전역 핸들러 = cross-page 점프 버그**(PR #33): 구 페이지의 `querySelectorAll(".shared-class")` 전역 핸들러가 신규 동일 클래스에도 바인딩. 신규 핸들러는 페이지 전용 `data-*`로 스코프 한정. fallback에 특정 페이지 id 하드코딩 금지.
- **페이지 제거 = renderer 함수 + `PAGE_RENDERERS` 등록 통째 삭제**(PR #34): IA·redirect만 비활성화하면 죽은 renderer 안의 중복 id·공유 클래스가 cross-page 버그 불씨. 흡수 시 redirect만 남기고 본문 통째 삭제.
- **navigate 재렌더 스크롤 리셋**(PR #35): navigate 진입 시 `prevScrollY`+`prevHash` 캡처 → 끝에서 같은 페이지면 `scrollTo(prevScrollY)`, 다른 페이지면 top. 핸들러마다 rAF로 개별 보존 말 것(navigate 한 곳에서).
- **render throw는 골든이 못 잡는다 → `/tmp` repro 필수**(PR #102): 골든은 순수함수만 검증. navigate가 단일 render throw에 통째로 죽어("분석하기 무반응"·"탭 멈춤") P0. render 추가 시 Chart 스텁(`afterDatasetsDraw` 직접 실행)으로 양쪽 분기·태그모드 패널 렌더 검증. 검증은 **주입식 harness**(`code+inject`로 내부 const 접근).
- **`const x = ... f(()=>...x...)` 자기 참조 = TDZ throw**(5-21): const 초기화식 안에서 자신을 참조(예 `byChannel.some(ch=>ch.key===sel)`로 `sel` 정의)하면 callback 실행 시 TDZ ReferenceError. `&&` 단락으로 안 도는 기본 경로는 멀쩡, 조건 truthy 되는 순간(다른 채널 클릭) render throw → 탭 멈춤. 상태 의존 분기는 **전 상태값(전 채널·전 토글)으로 repro**해야 잡힘.
- **innerHTML로 주입한 인라인 `<script>`는 실행 안 됨**(PR #169): 차트를 문자열 `<script>`로 그리면 영구 공백. 표준은 `bindXxxHandlers`에서 `renderXxxChart()` 직접 호출.
- **Chart.js v4 커스텀 `generateLabels`는 per-item `fontColor` 자동 주입 안 함 → 다크모드 범례 텍스트 안 보임**(5-21): 커스텀 legend item에 `fontColor: CHART_THEME.text`(다크/라이트 getter) 명시 안 하면 캔버스 기본색(검정)으로 그려져 다크 배경에서 사라짐(라이트는 멀쩡 → 한쪽만 검증하면 놓침). **차트 색·텍스트는 항상 `CHART_THEME` getter로**(하드코딩 hex는 모드 전환 시 깨짐). `toggleTheme`이 navigate 재렌더하므로 getter는 render-time 평가로 충분. 부호 구분 색쌍은 명도차 크게(예 Mix 진한/연한 블루, Rate 진한 앰버/연한 앰버 — 중간톤끼리는 구분 안 됨).
- **`position:fixed`도 `backdrop-filter` 조상 안에선 viewport 기준 아님 → body portal**(PR #170): sticky 바가 글래스 효과면 fixed 자손의 containing block이 됨(`offsetParent`가 sticky바). 드롭다운은 열 때 `document.body.appendChild`로 portal + `getBoundingClientRect` 정렬, navigate마다 orphan 제거.
- **단계 독립 분해는 grain별 부분합 비정합**(PR #190, 5-21): 채널/캠페인/소재 단계마다 따로 Bennet 분해하면 합산 grain이 달라 §2 Σ ≠ §3 Σ. 최소 grain(채널×캠페인×소재×일)에서 한 번만 분해 후 `rollup`(단순 합산)해야 모든 단계 항등식 정합.
- **계층 드릴다운 단일레벨 키 그룹핑 = 상위 over-merge**(5-21 §4): "캠페인 전체"인데 `keyFn=f=>f.crKey`로 묶으면 서로 다른 캠페인의 동일 소재가 한 행으로 병합(사용자엔 데이터 누락/오집계로 보임). 상위가 "전체"면 복합키(`cmp│cr`·`ch│cmp│cr`)로 — finest 합산이라 Σ 항등식은 불변, children[0]로 대표키 추출. "전체=합계" 펼침이 필요한지 펼침/병합 의도를 명확히.
- **CSV 살아있는 수식 2함정**(5-21): ① centering 공식(`mix=(cpāᵢ−C̄)·Δs`)은 **finest에서만** 정확 성립 — rollup mix는 Σ children이라 채널행에 같은 공식 쓰면 틀림 → 롤업은 "하위 소재 cell 합"으로 노출. ② 셀 수식에 **콤마(SUMIFS 등) 쓰면 CSV 컬럼 분리로 깨짐**(q()가 따옴표로 감싸 텍스트화) → 명시 셀 `+`합(`=Q5+Q8`)으로 콤마 회피. 차트도 하드코딩 rgba 말고 `chartCommonOpts()`+`CHART_THEME` 재사용해야 톤 통일.
- **렌더 함수에 상태 분기 추가 전 실제 호출부 확인**(5-20): 호출 조건 모르면 도달 불가 죽은 코드 생성.
- **공용 `td{vertical-align:top}`은 `<th>`엔 안 먹음**(5-12): 행헤더 `<th>`에 명시적 `vertical-align` 지정.
- **게이트 `requiresAny` 키는 `STANDARD_FIELDS` 정규키와 정확히 일치(단/복수)**(PR #168): `["click"]` vs 정규키 `clicks` 불일치 → 데모인데 영구 잠김(silent). 키는 추측 말고 복붙.
- **5-18 MMM 특이사항**: ROAS는 표시층 invert만(배분은 CPR 공간)·화면+export 한 세트. 회귀계수는 **연관≠인과**(확정은 holdout 5-15 전용). 전부-0/완전공선 컬럼 → 특이행렬 → `mmmBuildFeatures`의 `_nonRedundantCols`(Gram-Schmidt)로 드롭. 희소·저커버리지 채널 음수 탄력성은 "노이즈"지 "잠식" 아님. 상세는 §12.9·PR #51~190.

---

## 8. 통계적 엄밀성

1. **순수 함수 분리**: `CANNIBAL_STATS`·`ALLOC_MATH`·`MMM_STATS`·`PVM_MATH` 등 객체에 모음.
2. **합성 데이터 유닛 테스트**: `window.runXxxTests()`(예: `runCannibalTests` 5종, `runPvmTests` 36종). Node validate 스크립트로 통과 확인 후 commit.
3. **결정론 필수**: `Math.random` 절대 금지. MC 대신 고정 grid 수치적분/정확 계산. 같은 입력 → byte-identical(골든 테스트로 검증). 샘플 데이터는 `seededNoise`.
4. **신뢰구간 자동 계산**: 95% CI = `1.96/√n`. 차트·패널에 표시.
5. **자동 종합 해석**: 통계 지식 없이도 결론 읽게(색상 코드: 빨강 부정 / 초록 긍정 / 회색 무유의). 외부 공개 도구는 §0 히어로 카드 + `💡 쉽게 말하면` 평어 콜아웃.
6. **입증책임 비대칭 + non-sig≠무효과**: 관측 검정으로 "효과 없음"을 단정하려면 강한 증거 요구, 모호하면 보수적(INCONCLUSIVE). 식별 불가(공선)면 "추정≈0"은 *증거 없음*이지 *효과 없음* 아님 → 검정력 게이트로 긍정 판정 차단. 임계값은 config로 분리(결정론).
7. **단조 비감소 보정**: 한계효용은 running max로 artifact 차단.
8. **shift-share/mix 분해는 전체 평균 대비 centering**(5-21): `mix=cpāᵢ·Δsᵢ`는 비중↑ 엔티티를 무조건 +로 만들어(평균 대비 싼/비싼지 무관) per-entity 귀속이 무의미. `mix=(cpāᵢ−C̄)·Δsᵢ`(C̄=전체 평균)로 centering — ΣΔs=0이라 **합·중첩 항등식 불변**이면서 부호가 해석 가능해짐(비싼 쪽으로 예산 쏠림=+). 잔차 없는 분해라도 "합만 맞으면 OK" 아님, 각 항 부호가 직관과 맞는지 합성 데이터로 검증.

---

## 9. 사용자 의사결정 패턴 (관찰)

- **여러 선택지 + 트레이드오프** 제시 선호(A 추천 / B 절충 / C 최대). **"몇 줄 분량인가"**가 결정에 영향.
- **데이터양 기반 자동 추천** 선호(예: 18개월+면 STL 활성). **즉시 시각 피드백** 중시(토글 무거우면 캐시 요구).
- **최근성 우선 정렬**(전체 누적 아니라 최근 N일 기준, 동률 시 누적 2차).
- **검증 가능성** 중시(참고값 재현 테스트, console 디버그, 재현용 원자료 CSV export).
- **분석 결과 해석** 도움까지(차트로 안 끝남 — 의사결정에 어떻게 쓸지). **목표 우선 사고**(CPI/CPA/ROAS 먼저 선택).
- **메타-도구 사고**: 하네스/에이전트 자체 진화를 명시적으로 요구(self-update 선호).
- **통계 입력 보조**: 붙여넣기→자동계산, 프리셋 추정(마케터가 σ 직접 못 구함).
- **결론-우선 + 평어 해석**(외부 도구): §0 한눈에 보기 카드 + 평어. **절대 인원 병기**("몇 %"보다 "몇 명").
- **정직성**: 공선이면 절대 분해 거부하고 수치로 설명 + 대안 제시(거짓 숫자 만들지 말 것). 동작 안 하는 카피·가짜 인증 거부.
- **지표의 시간 의미 확인**: cohort-window(revenue_d7)를 캘린더-일별 분석에 섞지 말 것.
- **설계 스펙 먼저, 구현은 단순 모델 핸드오프**: 비용 큰 작업은 `docs/*.md` 자체완결 스펙(파일:줄·옵션·함정·검증) 확정 후 실행 위임.

---

## 10. 응답 스타일

- **한글 응답 기본**(코드/식별자는 영어 유지). 해석·요약·다음 단계는 한글.
- **구조화**: 표 우선(비교/매핑), 체크박스(검증 항목), 이모지 절제(✓ ❌ ⚠ 🔒 ★ — 의미 명확할 때만), 코드블록은 `파일:줄` 포함.
- **PR 머지 후 자동 제시**: ① 배포 시간(Railway 1~2분) ② 새 화면 설명 ③ 테스트 방법 ④ 다음 작업 옵션.

---

## 11. 안티패턴 (하지 말 것)

- ❌ React/Vue/Svelte 도입 (vanilla 유지) / 별도 .js·.css 파일 / 빌드 도구(vite·webpack)
- ❌ 새 라이브러리 사용자 확인 없이 추가
- ❌ 사용자 데이터를 서버에 전송 / Supabase service_role key 요청·언급
- ❌ main 직접 push / `--no-verify` / `--force` to main
- ❌ syntax check 안 하고 commit / 콘솔 에러 무시
- ❌ `git add -A`·`git add .` (§2.6)
- ❌ 모호한 결정 임의 확정 (2개+ 선택지면 묻기)
- ❌ 사용자 요청 외 페이지/기능 임의 추가 / 한국어 응답을 영어로
- ❌ `Math.random` 사용 (결정론 위반)

---

## 12. 자주 사용한 패턴 (Recipes)

### 12.1 새 분석 도구 추가
1. `IA`에 `{ id:"5-N", title, desc }` 추가 → 2. (Pro면) `AUTH_PROTECTED_PAGES`·`TOOL_TIER` → 3. `TOOL_REQUIRED_FIELDS["5-N"]`+`OPTIONAL` 정의 → 4. `page_5_N()`(시작에 `checkRequiredForTool`+`renderInlineCsvUpload("5-N")` fallback) → 5. `PAGE_RENDERERS["5-N"]=page_5_N` → 6. 핸들러 바인딩 → 7. PR.

### 12.2 새 통계 함수
`CANNIBAL_STATS`/`ALLOC_MATH` 등 객체에 순수 함수 추가 → `runXxxTests`에 합성 데이터 unit test 1개+ → Node validate 통과 후 commit.

### 12.3 차트 추가
HTML `<div class="chart-container"><canvas id="X"></canvas></div>` → 헤더에 `<button data-pngdownload="X">` → `renderXChart()`에서 `destroyChartIfExists("X")` 후 `new Chart` → `CHART_INSTANCES["X"]` 저장. **차트는 절대 인라인 script로 그리지 말 것**(§7).

### 12.4 토글 클릭 → 즉시 반영
데이터 변형은 캐시 사전 계산 → 핸들러는 lookup + `chart.update("none")` 또는 className swap. 페이지 full re-render 피하기(스크롤·포커스 손실).

### 12.5 분석 게이트 (매핑 후 "분석하기" 명시 실행)
`TOOL_ANALYZED[id]=toolAnalyzeSig(매핑시그)` + `isToolAnalyzed` 게이트. 페이지 prereq에 `|| !isToolAnalyzed(id)` → 매핑 완료해도 "▶ 분석하기"(`data-tool-analyze`) 클릭 후에만 결과. 매핑 변경=시그 달라짐=자동 숨김. sig는 **매핑만**(토글은 탐색이라 제외). 게이트는 렌더층 전용(`buildXxxCache` 무관 → 골든 byte-동일).

### 12.6 표시 번호 ↔ 라우팅 id 분리
표시 번호 변경 시 **내부 id 절대 불변**. `displayItemNumber(id)`/`displayGroupNumber(id)` 순수함수로 PHASES+IA 위치에서 계산, 렌더 3곳(nav·pageShell·pageHome)에 적용. `data-route`는 그대로 id.

### 12.7 도구 통합 — 탭형 단일 페이지 (SaaS 리팩토링)
같은/다른 grain 도구를 host `page_5_N` 탭으로 병합: ① 흡수 `page_5_M()`→`monXxxBody()`(섹션만 반환·게이트/pageShell 제거)+`PAGE_RENDERERS` 등록 삭제 ② host=게이트→else `pageShell(body: 매핑 details + 탭 + 활성탭 body)`, `XXX_TAB_STATE`+`data-xxx-tab` 핸들러 ③ 흡수 id는 `navigate` redirect+IA·AUTH 정리 ④ bind/chart/math 함수 전부 유지(DOM-gate 자동 발화). cross-grain은 `loadCsvFromTool(csvTool)` 탭별 스왑 + `TOOL_GROUP` distinct. 검증: 골든+주입식 `validate_*.js`.

### 12.8 데모 모드 (전 도구 샘플 미리보기)
`DEMO_STATE={tool,page}` 활성 시 안전성 코드 강제: `loadCsvFromTool`=실제 스냅샷 미접근·데모만 로드, `saveCsvToTool`/`markToolAnalyzed`=no-op, `isToolAnalyzed`=true. **`TOOL_CSV_SNAPSHOTS` 데모 중 무접근** → 종료 시 자동 복원. 데이터는 `seededNoise`. `DEMO_BUILDERS`(csvTool→빌더). 가드는 `DEMO_STATE.tool===id` 조건이라 비데모 시 byte-동일.

### 12.9 5-18 MMM 도구 (복잡 — 마케팅 반응 회귀)
Tinder KR Reg/React 회귀 기반. **2-stage**: ① 진단(카니발·추세·그랜저·변화점) ② MMM(adstock·saturation 기여 분해·Trend Forecast) + Regression Lab(범용 OLS) stage. 핵심:
- **회귀=가설 생성·기술용, 인과 아님**. cannibalization/incrementality 확정은 holdout(5-15) 전용. UI+JSON+README 3곳에 캐비엇 강제.
- **카니발 3-STATE 투표**(FOR/AGAINST/ABSTAIN) + 검정력 게이트 + 채널 prior + CEI 랭킹. 동시점 삼각검증(선행성·탈추세·net) + 그랜저(시차·방향) + IRF + 변화점.
- **colMap DnD**(header→role 매핑) 임의 N채널 일반화. `_nonRedundantCols`로 특이행렬 차단. 희소/저커버리지/공선 채널 가드.
- **decomp 3모델**(ols centered / merge / ridge level). adstock+saturation. baseline 토글.
- **Trend Forecast**: 관측+미래 결합패널에 동일 `mmmBuildFeatures`→적합→예측. 예산 시나리오·날짜 인식·step/더미 미래 제어. CSV는 엑셀 살아있는 수식(adstock 재귀 체인) + 평어.
- 상세: PR #51~190, `docs/backlog.md` §B.

### 12.10 5-21 PVM 중첩 분해 (캠페인 성과 변동 탐지)
최소 grain(채널×캠페인×소재×일) Bennet 분해 1회(`decomposeFinest`) 후 `rollup`으로 §2 채널→§3 채널·캠페인별→§4 소재별(모드 A) 드릴다운 항등식 정합. `mix=(cpāᵢ−C̄)·(s2−s1)`(전체 평균 대비 centering, §8.8)+`rate=s̄ᵢ·(cpa2−cpa1)`, `Σcontribution=ΔCPA_total`. 표시 라벨 "CPA/CPI 영향"(=mix+rate, 먼저 볼 값) + §2 Mix·Rate 설명 토글. **§4 계층 드릴다운은 `rollup` 복합 keyFn으로**: 채널전체=`ch│cmp│cr`/채널특정+캠페인전체=`cmp│cr`/둘다특정=`cr`(단일레벨 키로 묶으면 상위 over-merge 버그). 각 그룹=단일 finest → `children[0]`로 대표 ch/cmp/cr 추출(url·CTR·New). **§4는 ch/cmp/cr 고정 별도 컬럼**(`entityCols` 배열로 pvmTableHeader/Row 다중 엔티티 일반화 — 합친 라벨 X). §4 표 20행 페이지네이션(`crPage`, 필터변경 시 1리셋). New=이름 앞 상태 컬럼·링크=영향 뒤 컬럼. 기간 `weekBasis`(calendar/rolling7)×`lookback`(1/2/3). ₩/$ 토글(`pvmFmtMoney`). 소재 URL: `creative_url` 매핑 시 §4 링크 컬럼(`crUrlMap` 비용최대 변형, `pvmSafeUrl` http/https만=XSS 차단). §0 sleek 칩(`pvmImpactChip`)+Top-mover 카드, §1 Bridge 2줄(P1→P2=Δ%). §2 차트 2종(`renderPvmCharts` — `chartCommonOpts()`+`CHART_THEME` 재사용으로 5-2와 톤 통일): **0 기준 막대 브릿지**(CPA1/채널기여±/CPA2, 음수 0 아래, `afterDatasetsDraw` 값 라벨) + Mix·Rate 가로 누적막대(부호별 per-bar 색 — Mix 진한/연한 블루, Rate 진한 앰버 `#d97706`/연한 `#ffd98a`; 커스텀 legend item에 `fontColor: CHART_THEME.text` 명시해야 다크모드 보임 §7). 결과 CSV(`downloadPvmCsv`): META/SCORECARD/CREATIVE_FULL/CHANNEL/CAMPAIGN, **mix/rate 살아있는 엑셀 수식**(finest=centering 공식 `=(N-O)*(M-L)`, 롤업=하위 소재 cell `+`합 — SUMIFS는 콤마로 CSV 깨짐 회피), `_mmmDownload`+CRLF+BOM. **모드 B(소재만 merged) 제거**(`decomposeRows`도 삭제). `runPvmTests()` 36/36 + 확장 harness(전체계층 Σ·비병합·페이지네이션·차트·CSV 수식).

### 12.11 SaaS 셸
랜딩 2단계(`LANDING_STATE.track`: null/guide/analyze), freemium 티어(`TOOL_TIER`), Pro 페이월(`pageAuthGate`), ⌘K 명령 팔레트(`CMDK_STATE`, 전역 오버레이 — 사이드바 숨김 랜딩에서도 동작). 전부 render층 → 골든 byte-동일.

### 12.12 Forest plot
Chart.js 네이티브 없음 → `type:"bar", indexAxis:"y"` floating bar(`[ciLow,ciHigh]`) + `type:"scatter"` coef 점 overlay. pAdj 색상 코드. 높이 `n*26+80px`.

### 12.13 피드백 설문(VOC) 노출
외부 Google Form(`FEEDBACK_URL`) 링크. ① **상시 진입점**: 사이드바 하단 `.sidebar-feedback`(`.sidebar` flex column + `margin-top:auto`로 바닥 고정) + ⌘K 명령(`buildCmdkCommands` action`:"feedback"`→`runCmdkSelected`→`openFeedback`). ② **분석 후 넛지**: `pageShell`의 5-x 분기에서 `renderFeedbackNudge(meta.id)`(게이트 `/^5-/`+`isToolAnalyzed`+`!FEEDBACK_NUDGE.dismissed`) — 결과 하단 슬림 콜아웃, **세션당 1회**(`FEEDBACK_NUDGE.dismissed` 메모리 플래그, localStorage 영속 X→새로고침 리셋). 핸들러는 `bindFeedback`(전역 위임, `data-feedback-go`/`data-feedback-dismiss` 스코프). 링크는 `target=_blank rel=noopener noreferrer`(데이터 전송 0), `track("feedback_open",{from})`. **전부 render층**(골든 무관). 색은 semantic 토큰(`--text-primary/--text-muted/--primary/--surface-base`)만 → 다크/라이트 자동.

---

## 13. 참고 파일

- `index.html` — 모든 코드
- `package.json` — `serve . -l $PORT` / `Procfile`·`railway.json` — Railway 배포
- `supabase/SETUP.md` — 접근 키 발급 / `supabase/schema.sql` — `access_keys` 테이블+RPC
- `content/supabase-config.json` — URL+anon key(커밋됨, RLS 보호) / `content/pages/*.json` — SOP 콘텐츠
- `docs/backlog.md` — 진행 중 백로그 + MMM 스펙(§B) / `docs/*.md` — 기능별 설계 스펙
- `.claude/agents/mkt-engineer.md` — 본 CLAUDE.md의 압축판(에이전트용, 같이 동기화)

---

## 14. 마지막 점검 체크리스트 (모든 PR 직전)

- [ ] syntax check 통과 / validation tests 통과(해당 도구)
- [ ] conflict marker 없음 (`grep -n "^<<<<<<<" index.html`)
- [ ] PR 본문에 Summary + Test plan + Co-Authored-By 라인
- [ ] main 직접 push 안 함 / `git add` 명시 파일만
- [ ] 사용자 요청 범위 안에서만 변경

---

## 15. 하네스 자가 업데이트 (Self-Update Protocol) ⚙

**규칙**: 태스크 완료 시점에 본 `CLAUDE.md` + `.claude/agents/mkt-engineer.md`를 새 패턴으로 갱신.

- **트리거**: PR 머지 성공 / 사용자 작업 전환·확인 / 검증된 새 anti-pattern 발견.
- **기록 대상**: 새 함정(§7) · 새 recipe(§12) · 새 anti-pattern(§11) · 새 사용자 의사결정 패턴(§9) · 새 통계 표준(§8) · 새 절대 원칙(§2).
- **기록 안 함**: 기존 패턴 평범 적용 · 일회성 결정 · 일반 프로그래밍 지식 · 너무 좁은 변수명/경로 · "임시"라고 명시한 것.
- **형식**: 해당 섹션에 항목 추가, **태스크당 5줄 이내**, 다른 항목과 톤 일치. 압축본이므로 새 항목도 **간결하게**(과거 PR별 장문 내러티브 반복 금지 — 핵심 패턴만, 상세는 PR 참조).
- **용량 규율 (필수)**: 도구 추가·기능 갱신으로 본 파일/`agents/mkt-engineer.md`가 늘어나면 **추가와 동시에** 과거 PR별 장문 내러티브를 일반 패턴으로 압축해 전체 용량을 줄인다. 새 항목 추가 = 압축 1회 동반. 단순 append-only로 무한정 비대해지지 말 것(상세는 git·PR·docs/에 보존). 두 파일은 같이 동기화.
- **커밋**: 작업 PR에 같이 포함(선호) `docs(harness): ...` 또는 별도 docs 커밋.
- **사용자 우선**: 사용자가 "self-update 하지 마"면 즉시 중단(단 그 예외도 본 §15에 메모). **§15 자체를 삭제하지 말 것** — 메커니즘 사라지면 하네스 정체.
- **자기 검증**: 업데이트 후 `Read CLAUDE.md`로 자연스럽게 합쳐졌는지·길이 확인.

---

## 16. 현재 상태 + 다음 작업

**완료된 큰 흐름**:
- 도구 통합 17→5/6(탭형 병합, §12.7) · SaaS 셸(랜딩·페이월·⌘K, §12.11) · 전 도구 데모 모드(§12.8) · GA4 이벤트 트래킹.
- 운영 대시보드 5-2 9탭 통합 + sticky 필터 + 코호트 성숙도 예측 · 5-3 효율·배분 · 5-4 실험 분석 3탭 · 5-18 MMM 2-stage+Forecast · 5-21 PVM 변동 탐지.
- 골든 테스트 유지(byte-동일 보증). 상세 이력은 git·PR·`docs/`.

**다음 작업 (백로그, `docs/backlog.md` 참조)**:
- **SOP 콘텐츠 보강**(1-2~4-4 인라인, 정확성 검수 기반 — 진행방식 미정).
- **MMM 정식화**: Tinder KR Reg/React 마케팅 반응 회귀(`docs/backlog.md` §B). 회귀는 가설 생성·기술용, 인과 확정은 holdout 전용.
- **Pro 처방 레이어**: 증분 플래너·시나리오→MMM / 처방 페이싱·LTV 배분→5-3 / 이상치 근본원인→5-2.

---

*과거 상세(PR별 함정·recipe 풀버전)는 git 히스토리와 각 PR description, `docs/*.md`에 보존. 본 파일은 의사결정에 실제 쓰이는 규칙·패턴·현재 상태만 유지한다.*
