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

1. **아키텍처 이행 중 (단일HTML → Next.js 모듈, 2026-07~)**: 구 "단일 HTML·빌드도구 없음" 절대원칙은 **폐기**. 프로젝트는 이행 중 — `index.html`(단일 파일 레거시, **Phase 8 골든100% 컷오버 전까지 라이브 배포 유지**·버그픽스만) → `v2-migration/`(Next.js 16 App Router + React 19 + Zustand; `src/components`·`src/utils`(순수엔진)·`src/store`). **신규·이관 작업은 v2 모듈 구조**로, 어느 코드베이스 작업인지 명확히. 순수 수학은 `src/utils/*`(골든 검증), UI는 컴포넌트, 상태는 Zustand. 이행 계획·현황: `docs/v2-migration-tasks.md`(SSOT). (구 index.html 규칙은 §4~§12에 아직 유효 — 컷오버 전 index 유지보수용.)
2. **클라이언트 사이드 100%**: 사용자 CSV는 브라우저 메모리에만. 서버 전송/저장 절대 금지.
3. **Supabase service_role key 절대 요청·저장·언급 금지**. anon public key만 (RLS 보호).
4. **main 직접 push 금지**. 반드시 feat 브랜치 → PR → squash merge.
5. **Force push to main 금지**. hook skip(`--no-verify`) 금지.
6. **`git add -A`/`git add .` 금지** — 사용자가 드롭한 민감 데이터·대용량 폴더가 통째로 커밋될 수 있음(PR #54 사고). 항상 `git status` 확인 후 **변경 파일만 명시적으로** `git add index.html CLAUDE.md ...`. 외부 데이터는 먼저 `.gitignore`.
7. **모호한 결정 임의 확정 금지** — 합리적 선택지 2개 이상이면 `AskUserQuestion`으로 묻기.
8. **정직성**: 동작 안 하는 기능·거짓 숫자·우리 보안모델과 모순되는 카피 금지. 추정 불가하면 "추정 불가"라고 정직하게.
9. **병렬 사용 환경 동기화 의무**: Antigravity와 Claude Code가 병렬 작동 중이므로, 작업 시작 전 항상 `git fetch` 및 `git status`로 로컬 상태를 확인하고, 리모트와 다르면 반드시 사용자에게 "pull 후 진행할까요?"라고 확인.
10. **전체 파일 덮어쓰기 및 임의 포맷팅 금지**: 충돌과 작업 유실 방지를 위해 파일 전체를 삭제/재작성하지 말 것. 무관한 코드의 들여쓰기나 포맷을 임의 변경하지 말고, 정확히 타겟팅된 부분(Delta)만 수정.

---

## 3. 기술 스택

**레거시 (index.html, 컷오버 전 라이브)**:
```
HTML/CSS/JS (Vanilla) — 빌드 도구 없음. `serve . -l $PORT`.
Chart.js 4.4.4 · PapaParse 5.4.1 · Supabase JS 2.45.4(주석화) · SheetJS 0.18.5 · Inter/JetBrains Mono (Obsidian Flux)
```
**v2 (`v2-migration/`, 신규 작업 대상)**:
```
Next.js 16 (App Router, Turbopack) · React 19 · Zustand 5 (store) · Chart.js 4 · PapaParse 5 (npm)
├─ src/utils/*.js   순수 통계엔진 (ESM export, vitest 골든 검증) — 수학 절대 변경 금지
├─ src/components/  React 컴포넌트 (tools/·dashboard/·sops/)
├─ src/store/useDataStore.js  Zustand — IA·csvData·필터·라우트 상태
└─ 테스트: `npm test`(=vitest run src/utils) · 린트: `npm run lint`(eslint, 0 errors 유지)
```
- **CSS**: Obsidian Flux 토큰(`--bg-1`·`--text-muted`)+다크/라이트는 **전역 유지**(`globals.css`, `:root`+`body.light-mode`). CSS Modules는 일회성만(토큰 스코핑 불가). Tailwind 미사용.
- **Supabase**: 전체 무료 전환으로 미사용 — v2 `layout.js`에 스크립트 주석화(`TODO(B2B)`). service_role key 규칙(§2.3)은 불변.

---

## 4. 아키텍처

### 4.1 페이지 라우팅
- Hash 기반 (`#5-3` 등). `PAGE_RENDERERS[id]` 디스패치 테이블 → 페이지 함수.
- `IA` 배열이 사이드바 구조(`IA → groups → items`). `findMeta(id)` 메타 조회.
- `pageShell(meta, { deck, chips, summary, toc, body, tocFilters })` 공통 레이아웃.
- **내부 id(`5-2`)는 절대 불변** — hash·렌더러·navigate·AUTH·TOOL_* 수백 곳 의존, 북마크 깨짐. 표시 번호만 바꾸려면 `displayItemNumber(id)`/`displayGroupNumber(id)` 순수함수 사용(§12.6).

### 4.2 현재 도구 (17→8 통합 완료)

| ID | 도구 | 티어 | 데이터 |
|---|---|---|---|
| 1-x~4-x | SOP 문서 | free | 정적 JSON |
| 5-2 | 운영 대시보드 (시각화·스코어카드·페이싱·이상탐지·LTV·성숙도·코호트·퍼널·세그먼트, 9탭) | **free** | 효율 CSV |
| 5-22 | 캠페인 포화도 탐지 (채널·캠페인 한계 CPA/ROAS vs 평균 → 포화/여유 판정·응답곡선) | **free** | 효율 CSV 공유 |
| 5-3 | 예산 배분 (절대 CPR/ROAS 가중 + 한계효용 그리디) | **free** | 효율 CSV |
| 5-4 | 실험 분석 (A/B·Test Readout·Incrementality, 3탭) | free | 수동/CSV |
| 5-6 | 소재 분석 | free | 소재 daily CSV |
| 5-18 | 마케팅 반응 분석 (3탭: 카니발 진단·MMM 기여·**회귀+미래예측**[Cost·임의변수 자유매핑·OS별 분리·MMM브리지]) | free | 주간 패널 CSV |
| 5-20 | 핵심 가치 발굴 (Aha-moment — 선행 행동 윈도우×횟수 그리드 탐색, F1/Lift) | free | 이벤트 CSV |
| 5-21 | 캠페인 성과 변동 탐지 (PVM 무잔차 분해) | **free** | 소재 CSV 공유 |

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
2. **작업 시작 전 항상 `git fetch origin main` 및 `git status` 확인**: 리모트와 로컬 차이가 있으면 반드시 사용자에게 "pull 후 진행할까요?"라고 묻기. 이후 최신 main 위에서 **단명 브랜치**(`chore/xxx`·`feat/xxx`) 새로 생성. **장수 feature 브랜치 재사용 금지**(conflict·구버전 역행 위험).
3. 변경 후 **검증 필수**: `node validate.js`(= `npm test`) — syntax(vm compile) + 전 `runXxxTests` 한 번에 실행, 실패 시 nonzero. (순수함수 외 특정 분기·render-throw는 여전히 §7 주입식 harness로 보강.)
   **v2 preview MCP(스크린샷·스크롤·클릭 상호작용) 검증은 생략** — Gondry님이 브라우저에서 직접 확인(더 빠르고 정확함). `npm run test:all`+`npm run lint`+코드 리뷰까지만 하고 끝. 실행 자체가 필요한 디버깅(콘솔 에러 재현 등)엔 여전히 preview_eval/console_logs 사용 가능하나, "확인해보겠습니다" 식 스크린샷·스크롤 검증 루프는 하지 말 것(긴 스크롤 페이지에서 스크린샷 캡처 아티팩트 쫓다 시간 낭비했던 실사례 — §7에 함정으로도 기록).
4. `git add <명시 파일>` + 커밋(Co-Authored-By 라인, HEREDOC).
5. push → `gh pr create --base main`. PR body: `## Summary` bullets + `## Test plan` checkboxes + `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
6. `gh pr merge <N> --squash` → **머지 확인 후 브랜치 삭제**(`git push origin --delete <branch>`). 충돌 시 §6.2.

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
- **CSV 자동매핑·드롭다운은 도구별 필드로 스코프**(`toolFieldKeySet`): 전역 `autoMapHeaders`/전체 `STANDARD_FIELDS` 드롭다운은 그 도구가 안 쓰는 필드(코호트·MMM·국가 등)까지 매핑해 "매핑됐는데 기능엔 못 씀" 유발. `TOOL_REQUIRED_FIELDS`(oneOf 포함)+`TOOL_OPTIONAL_FIELDS` 합집합으로 자동매핑·드롭다운 제한, 형제 CSV 이어받을 때도(`loadCsvFromTool`) 복사 대신 본인 도구 기준 재자동매핑. 표준필드 겹침 0(colMap류 5-18)이면 null→전체 폴백. 스코프 밖 기존 선택값은 "(이 도구 미사용)" 옵션으로 보존(데이터 손실 방지). 주의: `cost`(효율)와 `spend`(Creative)는 별도 키 — 같은 "비용"이라도 도구 grain 따라 다름. `spend`에 `cost`/`비용` 별칭 부여(스코프가 충돌 차단 — 효율은 `cost`키 우선, creative는 `cost`키 스코프 밖이라 `spend`로 잡힘).
- **5-18 MMM 특이사항**: ROAS는 표시층 invert만(배분은 CPR 공간)·화면+export 한 세트. 회귀계수는 **연관≠인과**(확정은 holdout 5-15 전용). 전부-0/완전공선 컬럼 → 특이행렬 → `mmmBuildFeatures`의 `_nonRedundantCols`(Gram-Schmidt)로 드롭. 희소·저커버리지 채널 음수 탄력성은 "노이즈"지 "잠식" 아님. 상세는 §12.9·PR #51~190.
- **`type="number"`는 천단위 콤마 표시 불가**: 금액 입력은 `type="text" inputmode="numeric"` + blur 재포맷(`allocFmtNum`=toLocaleString) + **모든 read 사이트에서 콤마 strip**(`allocParseNum`=`replace(/[,\s]/g,'')` 후 parseFloat). `parseFloat("72,341,057")=72` 함정 — 입력 핸들러·검증·셀 핸들러 전부 교체 필수(하나라도 빠지면 분배 0 버그). NaN가드는 `==null`(allocParseNum이 null 반환, isNaN(null)=false). 5-3 예산/§5 cost 셀 적용(PR 예산배분 UX).
- **전문 진단은 결론 뒤로 접기(5-3)**: 마케터 대상 도구는 §0 평어 **결론·액션 카드**(computeAllocSummary 재사용으로 총합계 카드와 수치 일치) 맨 위 + 산점도·추세선 진단·이상치/정규화는 `<details>` 기본 접힘. 알림 callout 다발은 한 줄 칩(`⚠ N건 — 보기`)으로 fold. `<details>` 안 canvas는 0px로 그려져 펼칠 때 `chart.resize()` 필요(instance 키 확인: 캔버스 id≠인스턴스 키). vertex/종모양 등 용어는 평어+title 툴팁.
- **모델 래퍼는 `.model.predict`지 `.predict` 아님**(5-3 manual): `getCachedModels`가 주는 객체는 `{model,poly2Shape,xMax,…}` 래퍼 — 예측은 `ALLOC_MATH.predictSafeCpr(wrap, cost)`(CPR 반환)이고 결과=cost÷CPR. `meta.predict(cost)` 직접 호출은 **undefined→결과 0**(분배 후 예상 전부 0). 골든은 순수 math만 봐서 못 잡음 → manual/greedy/modeC **각 분배 경로를 데모로 repro**(실제 items[].results 확인).
- **지표 토글 추가 시 차트도 같이 전환**(5-22): 표만 metric 분기하고 차트가 한 지표(CPA) 공간 고정이면 "토글해도 곡선 안 바뀜". 차트 y변환·축라벨·점/곡선 전부 metric별 분기(ROAS=revPerRes÷CPR). 캡션의 단위 문자열도 같이.
- **`<thead>` 없는 표는 전역 `thead th` 정렬 규칙 미적용**(5-12 매트릭스): `<table>${header}${body}`처럼 thead 태그 없이 `<th>` 직접 쓰면 열 헤더=브라우저 기본 center, 데이터 `<td>`=left로 어긋남. 헤더·셀에 명시 `text-align`(숫자=right) 부여, 행 라벨/좌상단만 left.
- **`pageShell`의 `opts.deck`는 `5-x` 도구 페이지에서 항상 무시됨**(분석 도구=압축 sticky바라 eyebrow/deck 생략 분기, §4.1): "데이터 없음" 상태에 역할 설명 카피를 추가할 때 `deck`에 적으면 죽은 코드 — 실제 렌더되는 `summary`에 넣어야 함(5-6에서 발견·수정).
- **render-layer 변경은 골든이 못 잡음 → 주입식 harness로 직접 검증**(5-6): `validate.js`는 순수 통계함수만 보장. `page_5_N`·`renderXxx` 카피/분기 확인은 vm 샌드박스에서 probe 코드를 **같은 `vm.runInContext` 호출의 code 문자열에 이어붙여** 실행해야 함 — top-level `const`(`CSV_STATE` 등)는 함수선언과 달리 global object 프로퍼티가 안 되므로 별도 호출에서 `sandbox.CSV_STATE`로 접근 시 `undefined`. 결과는 `globalThis.__PROBE_RESULTS__`로 받기.
- **FWL within-transform은 절편을 demean하지 말고 제거**(5-6 decompose P0): campaign_id 등 고정효과를 그룹평균 차감(demean)으로 흡수할 때 절편(col 0, 항상 1)까지 demean하면 전 행이 0 → X'X 무조건 특이행렬 → fit null → `campaign_id`만 매핑하면 **데이터 무관 모든 분석이 n=0**으로 죽음. demean은 dummy 컬럼(1..p)만, within 후 절편은 **제거**(절편 남기면 가중치 큰 데이터서 대각항만 거대 → ill-conditioned → SE 폭발·음수 R²). 절편 유무는 `off` 오프셋으로 VIF·계수추출 인덱싱 통일.
- **Gauss-Jordan inverse는 절대 pivot 임계로 rank-deficiency 못 잡음 → `I·M≈단위행렬` 검증**(5-6): `max<1e-12` 절대 임계는 스케일 큰 행렬(가중치=노출수 등)에서 사실상 특이인데도 통과 → 가비지 inverse 반환(β·SE 엉터리·R²<0, 화면엔 거짓 숫자). inverse 말미에 `maxErr=max|I·M−δ|>1e-6`면 null 반환 → 호출자가 "추정 불가" 정직 처리. **데모 데이터는 full-rank로 설계**(소재 수 충분+속성 결정론 셔플 독립배치, rank 검증)해야 유의효과 산출.
- **shift-share/Bennet "비중"은 비용 아니라 결과량(분모) share**(5-21): CPA 분해 믹스효과는 `s=result/ΣResult`(전환 건수 비중)로 가중하는 게 정의 — COST 컬럼 옆 "비중"은 비용 비중으로 오독돼 "숫자 틀렸다" 신뢰 붕괴. 효율 좋아진 항목은 비용↓인데 결과 비중↑이 정상(수학 정확). 라벨을 "**결과 비중**"으로 명시 + 툴팁으로 비용 비중 아님을 고지(거짓 숫자 의심받는 카피=실질 버그).
- **차트 데이터 `Math.round` = 작은 ARPU 0 뭉개짐**(5-2 LTV 곡선): 곡선 y값을 `Math.round(value)`하면 USD 스케일·저객단가(<1)가 0/1/2로 뭉개져 0축에 붙음("왜 안 나오냐"). round 금지(소수 보존) + 표시층은 값 크기별 자릿수 적응(`fmtCurrencyPrecise`: |v|<10→2자리). 통화 토글(₩/$)도 같이.
- **리텐션은 모수 가중 + %-vs-인원수 컬럼 판별**(5-2): 행별 단순평균(`Σret/n`) 금지(코호트 크기 무시) · 비율 전용 clamp(`min(1,..)`)도 인원수 입력을 100%로 망가뜨림. SSOT `computeWeightedRetention`: 분모=Σ모수(설치/가입), 분자=비율컬럼이면 Σ(ret×모수)·인원수컬럼이면 Σret. **컬럼 max≤1→비율, 초과→인원수**(정수% 30=30%는 인원수로 잡고 경고). 스코어카드·리텐션탭 공유.
- **Chart.js에 CSS `var(--x)` 리터럴 직접 전달 금지**(v2 대시보드 차트 6개): canvas `strokeStyle`은 `var()` 문법을 못 읽어 불투명 검정으로 폴백(두꺼운 검정 그리드). `getCssVar("--border")`(렌더타임 실제 rgba 해석, `chartUtils.js`)로 항상 교체. `CHART_THEME.grid/muted/text`도 라이트/다크 getter로(정적 리터럴 금지).
- **조건부 마운트 캔버스는 최초 폭 0으로 측정됨**(§7 구 `<details>` 0px 함정과 동일 원인, v2에서도 재발): 토글로 새로 보이는 섹션·step 전환으로 새로 마운트되는 차트는 Chart.js 생성 시점에 부모가 아직 레이아웃 안 잡혀 width=0. `new Chart(...)` 직후 `requestAnimationFrame(() => instance.resize())` 1회 필수.
- **preview 스크린샷은 매우 긴 페이지(스크롤 20000px+)에서 캡처 아티팩트 남(빈 화면·이중노출)** — 스크롤 위치가 실제로 바뀌어도(`window.scrollY` 확인됨) 스크린샷이 빈 배경만 나올 수 있음. 실제 앱 버그가 아니라 툴 한계이므로, 판정은 `preview_snapshot`(접근성 트리, 픽셀 무관)이나 콘솔 에러 유무로 하고 스크린샷 하나만 믿고 "깨졌다" 결론 내지 말 것. (§6.1: 어차피 v2 preview 육안검증은 생략, Gondry님이 직접 확인.)

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

### 12.9 5-18 MMM (마케팅 반응 회귀)
2-stage: ① 진단(카니발·추세·그랜저·변화점) ② MMM(adstock·saturation 기여 분해·Trend Forecast) + Regression Lab. 회귀=가설 생성·기술용, **인과 아님**(확정은 holdout 전용). colMap DnD 임의 N채널, `_nonRedundantCols`로 특이행렬 차단. 상세: `docs/backlog.md` §B, PR #51~190.

### 12.10 5-21 PVM (캠페인 성과 변동 탐지)
최소 grain(채널×캠페인×소재×일) Bennet 분해 1회 → `rollup`으로 §2→§3→§4 항등식 정합. centering mix `(cpāᵢ−C̄)·Δsᵢ`. §4 복합 keyFn(over-merge 방지). 상세: `docs/pvm-campaign-variance-spec.md`.

### 12.11 SaaS 셸
랜딩 2단계(`LANDING_STATE.track`: null/guide/analyze), freemium 티어(`TOOL_TIER`), Pro 페이월(`pageAuthGate`), ⌘K 명령 팔레트(`CMDK_STATE`, 전역 오버레이 — 사이드바 숨김 랜딩에서도 동작). 전부 render층 → 골든 byte-동일.

### 12.12 Forest plot
Chart.js 네이티브 없음 → `type:"bar", indexAxis:"y"` floating bar(`[ciLow,ciHigh]`) + `type:"scatter"` coef 점 overlay. pAdj 색상 코드. 높이 `n*26+80px`.

### 12.13 피드백 설문(VOC) 노출
외부 Google Form(`FEEDBACK_URL`) 링크. ① **상시 진입점**: 사이드바 하단 `.sidebar-feedback`(`.sidebar` flex column + `margin-top:auto`로 바닥 고정) + ⌘K 명령(`buildCmdkCommands` action`:"feedback"`→`runCmdkSelected`→`openFeedback`). ② **분석 후 넛지**: `pageShell`의 5-x 분기에서 `renderFeedbackNudge(meta.id)`(게이트 `/^5-/`+`isToolAnalyzed`+`!FEEDBACK_NUDGE.dismissed`) — 결과 하단 슬림 콜아웃, **세션당 1회**(`FEEDBACK_NUDGE.dismissed` 메모리 플래그, localStorage 영속 X→새로고침 리셋). 핸들러는 `bindFeedback`(전역 위임, `data-feedback-go`/`data-feedback-dismiss` 스코프). 링크는 `target=_blank rel=noopener noreferrer`(데이터 전송 0), `track("feedback_open",{from})`. **전부 render층**(골든 무관). 색은 semantic 토큰(`--text-primary/--text-muted/--primary/--surface-base`)만 → 다크/라이트 자동.

### 12.14 5-3 예산배분 결론·검증 UX 레이어 (마케터 가시성: ①어디가 문제 ②어떻게 배분 ③맞게 분배됐나)
전문 진단은 §1 fold 유지, **결론층을 두껍게**. 전부 render층(골든 byte-동일).
- **§0 진단**(`renderAllocDiagnosis`, verdict 위): 최악(예산비중↑·결과비중↓·평균 대비 N배)·기회(저비용 고효율인데 예산 적음)·집중도(`topShare≥0.5 && ≥1.5/n` — 2채널 50/50 오탐 차단) 평어+절대값(₩·건). eff 통일=CPR 그대로/ROAS는 `1/ROAS`→`totCost/totResults` 동일 공간 배수(방향 무관). 효율차<1.2면 억지 처방 대신 "재배분 여지 작음, 채널 자체 효율 우선"(P0 정직). verdict neutral 텍스트는 §0가 대상 지목해주므로 현행 유지 가능.
- **§5 검증 스트립**(`renderAllocVerifyStrip`): 모드 C는 제약 없는 채널 효율↔배분 정합(eff asc 정렬 인접쌍 역전 플래그), 모드 B는 "한계효율 기준이라 평균 순서와 달라도 정상" 정직 안내(0배분 채널 명시). 잠금·min/max는 별도 note. free<2면 "점검 생략".
- **국가 단일 강제**(`normalizeAllocCountryFilter`): 채널·캠페인별(Country×Channel grain)은 타국가 혼입 방지 위해 국가 1개 강제(`allocTopSpendCountry` 최고지출 기본, 결정론 가나다 tiebreak). 위저드=single-select(`!ctrySel.multiple` 분기)·sticky=radio. unit 전환 시 국가 변하면 채널필터 cascading 리셋. 국가1개/국가별이면 무동작(byte-동일). 호출=unit핸들러+양 렌더 직전(idempotent).
- **라이브 콤마**(`allocLiveCommaFormat`): 입력 중 천단위 콤마+커서 보존(커서 왼쪽 숫자 개수로 위치 복원). `input` 이벤트는 포맷만, 재계산은 `change`/blur에서(키마다 재계산 방지). 예산·§5 cost 셀(`type=text`). `parseFloat(콤마)` 함정은 §7 그대로.
- **de-jargon**: 추세선 배지·헤드라인 평어화(우하향→"효율 거꾸로", 종모양(∩)→"증액 시 빗나감", U자(∪)→"감액 시 빗나감", Poly2 꼬리→"곡선 끝 신뢰 낮음"), 기술용어는 `title`·alert 본문에만. 긴 진단 툴팁은 `formatMmmTipText`로 "왜위험/왜발생/어떻게" 라벨 단락 구조화(`#mmm-hover-tip` innerHTML+escapeHtml, max-width 380·고대비). 마커 없으면 평문 escape.

### 12.15 회귀 ⊕ 미래예측 통합 (5-18 회귀·예측 탭, `docs/regression-forecast-merge-spec.md`)
TF와 범용회귀는 같은 OLS(`REG_STATS`)·차이는 "미래 투영"뿐 → 범용회귀에 예측층 이식해 단일 도구화(TF 탭 제거·`stage="forecast"`→`"lab"` redirect).
- **`REG_FORECAST`**(순수): `run(opts)`=변수별 미래스펙(연속=시나리오값/이벤트=지속·N후끔/시간=fourier·trend 자동연장)으로 설계행렬 미래연장→`REG_STATS.ols`→leverage 95% 밴드→종속 역변환(원스케일). `buildTimeFeatures`(날짜간격으로 연주기 자동추정). `runRegForecastTests` 골든.
- **변환은 hist+future 결합 1회 후 슬라이스**(`_transformCombined`) — adstock 이월·zscore/minmax 스케일 일관(fit·predict 같은 basis). `REG_STATS.ols`에 `XtXi` additive 노출(밴드용).
- **OS(group)별 분리 기본**: `fc.osMode="split"`+`osPick` pills 각 OS 독립모델+비교표, "전체 풀링" 토글. **MMM 브리지**(`regLabFromMmm`): CSV_STATE.raw+colMap 역할→회귀 역할 번역(채널→독립+adstock_log·더미→이벤트·week→time·platform→group·활성타깃→종속)로 "내 채널 데이터로 예측" 동선 보존. 전부 render층+순수엔진(골든 byte-동일), render-throw는 주입 harness로 양분기.

### 12.16 캠페인 포화도 탐지 (5-22, 효율 CSV 공유)
5-3 곡선 엔진 재사용한 진단 도구 — 신규 곡선/아웃라이어 구현 금지. `SAT_MATH.analyzeEntity`(순수)가 `ALLOC_MATH.removeOutliers·fitBest·predictSafeCpr·detectPoly2Shape` 호출. **포화지수 = 한계 CPA ÷ 평균 CPA**(ROAS는 평균÷한계, 둘 다 >1=다음 1원이 평균보다 나쁨), `≥satHigh` 포화·`<scaleLow` 여유·중간 적정(임계 `SAT_CONFIG` 분리·결정론). 한계는 현 지출점(최근 7일 평균 일예산)에서 +10% finite-diff. `satBuildPoints` 자체 grouping(채널/캠페인 토글)·ALLOC 캐시 미접근(unit 결합 회피). `runSatTests` 골든.
- **공유 데모 신호 부여**: 진단 도구 데모가 의미 있으려면 합성 패턴이 실제 신호를 띠어야 함 — 효율 데모 설치반응에 `cost^satExp` 수확체감 곡률 + 비용 램프 확대·노이즈 축소(노이즈 크면 Poly2가 멱법칙 곡률 덮어써 한계효율 납작). 공유 fixture 수정은 형제 도구(5-2/5-3) render 스모크로 회귀 확인. 골든은 합성 데이터라 demo 값 변경과 무관(byte-동일 불변).

### 12.17 쉬운말 우선 표기 (전문용어 변환, 5-6 전면 적용)
일반 유저 대상 라벨·헤딩은 **쉬운 말 먼저 + 전문용어는 괄호로 뒤에**(`데이터 점검 (검증)`·`영향력 (β)` — 역순 금지). 전문용어 자체는 유지 가능하나 항상 명확한 설명이 붙어야 함. 표 헤더처럼 공간 좁은 곳은 약어 유지 + `title` 툴팁(`<th title="노출수 (Impressions)">Impr</th>`). 방법론처럼 긴 설명은 본문에 늘어놓지 말고 짧은 평어 한 줄 + `<details><summary>...펼치기</summary>`로 접기(§12.14의 "결론 vs 진단" fold와 별개 축 — 이건 라벨 wording 순서 문제).

### 12.18 전역 분모 기준(설치/가입) 토글 (5-2 운영 대시보드)
운영 대시보드가 과도하게 설치(install) 베이스라 가입(action) 운영 데이터에서 CPI 비교·코호트 ARPU가 빈 차트/0으로 깨짐. `MON_DENOM_STATE.basis`("installs"|"actions") + `effectiveDenomBasis()`(미매핑 자동 폴백)로 통일 — CPI/CPA·CVR·ARPU·리텐션·LTV·퍼널이 sticky 필터 1토글로 함께 전환. 기존 per-탭 토글(리텐션 anchor·LTV denom)도 전역과 동기화. CPI 차트는 기준 따라 CPA로 라벨/값 전환. 퍼널: 기준별 단계(설치 4=노출·클릭·설치·구매 / 가입 5=+가입), 절대값=로그 스케일(노출 압도 해소), "절대↔전환율" 토글(단계별 앞단계 대비 %). 전부 render층(골든 무관), 검증은 주입식 harness.

### 12.19 도구별 데이터×기능 연결표 + 템플릿 CSV (CSV 통합)
업로드 화면의 전역 평면 필드 가이드(접힘)를 제거하고 `renderDataFeatureMatrix(toolId)` 범용 연결표(펼침)로 통일 — `TOOL_REQUIRED/OPTIONAL_FIELDS`+`STANDARD_FIELDS`에서 **자동 생성**(하드코딩 표 금지, 표류 방지). 통합 컬럼 순서=차원(date·country·platform·channel·campaign·adgroup·creative·url) 먼저 → 지표(cost·퍼널·PU/Rev/Ret Dn). 필드별 필수/필수(택1)/옵션/미사용+매핑✓, 효율&예산 4총사(`DFM_FAMILY`)는 미사용에 "어느 도구가 쓰는지" 고지(공유 grain). `buildToolTemplateCsv(toolId, scope)`=깨끗한 헤더만(BOM+CRLF §7, canonical, `creative_id`→`creative_name`), 4총사는 통합+도구별 둘 다 버튼. Dn 윈도우는 1행으로 묶어 표시.

### 12.20 v2 마이그레이션 (index.html → Next.js) — 패턴·함정 (2026-07)
index.html을 v2 Next.js 모듈로 이관하며 확립한 재사용 패턴. 상세 이력: `docs/v2-migration-tasks.md`.
- **순수엔진 이관 = 골든-폐포 기반**: index 엔진 블록을 ESM export로 verbatim 복사(선언→`export`만, 수학 불변). 경계는 **base-indent 닫힘 자동검출**(닫는 줄 뒤 주석 허용 정규식 — plan의 라인범위 off-by-one/멀티행 배열 자가교정). 골든 테스트가 오라클 — **tolerance 완화·엔진수정 0**이면 충실 이관. 실행: vitest(`npm test`), extensionless ESM은 raw node 불가라 vitest 리졸버 사용.
- **cost/spend 별칭 함정(§7 재발)**: 효율 CSV는 비용을 표준키 `cost`로 매핑하는데 PVM/creativeMath 엔진은 `r.spend`를 읽음 → COST 0 버그(결과 비중은 정상이라 놓치기 쉬움). **단일 지점 `getMappedRows`에서 cost↔spend 양쪽 채움**(엔진·골든 불변). 도구가 다른 표준키 읽는지 항상 확인.
- **도구 배선 표준 패턴**: `getMappedRows(csvData)`(raw+mapping→표준키 행) → 도구별 엔진 입력 구성(값은 문자열, `Number()`) → 순수엔진 호출 → 기존 표/차트/헤드라인에 실값 렌더. **mock·`Math.random` 전량 제거**(§3 결정론), 컬럼 부족 시 정직 빈상태(fabricate 금지, §8). 검증은 `test:all`+`lint`+코드 리뷰까지(§6.1 — preview 라이브 육안검증은 생략, Gondry님이 직접 확인).
- **CampaignPvm-class 렌더 크래시**(병렬 이관 산물): 존재않는 `...base.plugins.X.foo` 스프레드(`base.plugins`에 그 키 없음)→`undefined.prop` throw→Next 에러 오버레이. + `csvData && csvData.raw.length`(raw undefined 시 throw)→`csvData?.raw?.length`로 통일. 정적 색출 후 preview로 6도구 일괄 검증.
- **role-based colMap auto-derive**(5-18 MMM): index는 DnD colMap(채널/target/time/dummy 역할). v2엔 UI 없어 자동 유도 — 표준 wide 경로 + **LONG→WIDE 주간 피벗**(row-per-channel-per-week → 기간×채널 spend 패널). null-fit(공선/기간부족)은 raw TypeError 대신 **정직 도메인 메시지**.
- **IA 라벨↔라우트 정합**: store IA 라벨이 실제 마운트 컴포넌트와 일치해야(구 17-도구 라벨 잔재로 "클릭→다른 도구" 버그). 라우트 id 불변(§4.1), slug↔id 매핑층. Path 라우팅 전환 시 sitemap.xml 동반.
- **CSV 상태 = 그룹별 스코프 공유**: 단일 전역/완전 개별 아닌 `TOOL_GROUP` 기반 — 결 비슷한 도구는 슬라이스 공유, 이질 도구는 분리(Zustand).
- **5-18 MMM 3탭 단일 데이터 흐름**(Growth_Ops_Playbook v2, PR 1669e75): ①진단·②기여분해·③회귀예측 전부 **한 CSV+shared `mmmColMap`**로 게이트·계산. ③ lab이 별도 업로드·샘플·매핑을 갖고 shared 게이트를 early-return으로 우회하던 게 "화면이 다름"의 원인 → early-return 제거, ③도 동일 `MmmColumnMapper` 게이트·`controlBar` 사용. ③ 예측은 **`mmmForecast`(②와 동일 MMM 계수: adstock·trend·fourier계절·더미) 단일 엔진**으로 과거 적합+미래 외삽+95% 밴드; 별도 범용회귀(REG_FORECAST) 경로는 trend·계절 없어 fitted가 평평→제거. 죽은 `stage==="forecast"` 게이트로 §7 외삽이 영영 안 뜨던 것 → `stage==="lab"`로 연결. render층 memo는 `stage!=="lab"` 조기 return으로 비활성 탭 계산 차단.
- **`buildPanelFromColMap` 타깃=플랫폼 합산**(같은 PR): OS 태그 컬럼 다중 매핑 시 종속(reg/react)을 `pick`(첫 1개)하면 Total인데 한 OS만 나옴(X는 filter라 대칭 깨짐). **플랫폼 일치 컬럼 index별 벡터합**으로 교체 → Total=Android+iOS. `_labTagOf`류 OS 태깅 정규식은 `\b` 대신 `[^a-z]` 구분자(언더스코어 `_ios_` 오탐 방지). 이 합산이 ②·③ target·platform 토글 정합의 단일 소스.
- **패널 라벨 필드명 정합**: `mmmForecast`·차트는 `panel.dateLabel`·`panel.dates`·`panel.granularity`를 읽지 `weekLabel`이 아님 → `buildPanelFromColMap`이 `weekLabel`만 세팅하면 x축·미래라벨이 t 인덱스(1,2,+3…)로 폴백. 날짜 컬럼을 `_mmmParseDate`로 파싱해 `dateLabel`(=weekLabel)+`dates`+`granularity`(중앙 간격, days≥28 monthly/≥5 weekly)까지 세팅해야 실제 날짜로 표기. 엔진이 어떤 필드명 읽는지 항상 확인.
- **콤마 입력은 v2 `CommaNumberInput` 재사용**(MarketingResponse.jsx): `type=number`는 천단위 콤마 불가(§7). §12.14 라이브 콤마+커서 보존 로직을 컴포넌트화 — `value`(number)·`onCommit(number|null)` props, type=text·표시 콤마·읽기 strip·blur 재포맷. 금액 입력 신규 시 재포팅 말고 이 컴포넌트 사용.

---

## 13. 참고 파일

- **`v2-migration/ARCHITECTURE.md` — v2 코드맵** (경로 매핑 ~200줄): 라우트↔컴포넌트↔엔진, SSOT(store), 글로벌 CSS, 내비 팁. **v2 큰 작업 착수 전 먼저 읽어 위치 파악**(전체 파일 탐색보다 토큰 절약). 새 도구·엔진·경로·상태 추가/이동 시 **함께 갱신**(§15).
- `docs/v2-migration-tasks.md` — v2 마이그레이션 SSOT (Phase 현황·결정 로그·패턴)
- `index.html` — 레거시 앱 코드(컷오버 전 라이브)
- `validate.js` — 로컬 테스트 러너(§2.1 예외·비배포). `node validate.js`/`npm test` — index.html 인라인 로드 후 전 `runXxxTests` 실행·리포팅(실행·리포팅만, 비즈니스 로직·데이터는 index.html 유지)
- `package.json` — `serve . -l $PORT`(start)·`node validate.js`(test) / `Procfile`·`railway.json` — Railway 배포(index.html만)
- `docs/code-health-audit.md` — 코드·아키텍처 건강성 감사 + 정리 로드맵
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
- **v2 코드맵 동기화 (필수)**: v2에 새 도구·엔진·경로·상태 슬라이스를 추가/이동/삭제하면 **`v2-migration/ARCHITECTURE.md`(코드맵)를 같은 작업에서 갱신**. 큰 v2 작업 착수 전 코드맵을 먼저 읽어 위치 파악(전체 파일 탐색 대비 토큰 절약). 코드맵은 경로 매핑만(설명 최소·~200줄 유지).
- **기록 안 함**: 기존 패턴 평범 적용 · 일회성 결정 · 일반 프로그래밍 지식 · 너무 좁은 변수명/경로 · "임시"라고 명시한 것.
- **형식**: 해당 섹션에 항목 추가, **태스크당 5줄 이내**, 다른 항목과 톤 일치. 압축본이므로 새 항목도 **간결하게**(과거 PR별 장문 내러티브 반복 금지 — 핵심 패턴만, 상세는 PR 참조).
- **용량 규율 (필수)**: 도구 추가·기능 갱신으로 본 파일/`agents/mkt-engineer.md`가 늘어나면 **추가와 동시에** 과거 PR별 장문 내러티브를 일반 패턴으로 압축해 전체 용량을 줄인다. 새 항목 추가 = 압축 1회 동반. 단순 append-only로 무한정 비대해지지 말 것(상세는 git·PR·docs/에 보존). 두 파일은 같이 동기화.
- **커밋**: 작업 PR에 같이 포함(선호) `docs(harness): ...` 또는 별도 docs 커밋.
- **주기적 압축 및 개선 제안**: 문서가 지속 비대해지는 것을 막기 위해, 작업 전후로 사용자에게 "CLAUDE.md 파일을 압축·개선할까요?"라고 주도적으로 묻고 최적화를 수행한다.
- **사용자 우선**: 사용자가 "self-update 하지 마"면 즉시 중단(단 그 예외도 본 §15에 메모). **§15 자체를 삭제하지 말 것** — 메커니즘 사라지면 하네스 정체.
- **자기 검증**: 업데이트 후 `Read CLAUDE.md`로 자연스럽게 합쳐졌는지·길이 확인.

---

## 15.5. 유저 친화적 UI 개선 트리거 (필독) 🎨

사용자가 **"유저 친화적으로 개선"·"너무 복잡"·"이해 안 됨"·"전문용어 많음"·"직관적이지 않음"·"가독성"** 등 UX 단순화를 요구하면, **작업 전 반드시 `v2-migration/claude-ux.md`를 먼저 읽고** 그 원칙대로 진행. (핵심: 결론 먼저·근거 접기 2층 구조, 여정=질문 프레임, 상태별 칸반 그룹핑(배지 반복 금지), 지표=평어 질문+평어 답, 그룹배지↔상세 판정 모순 방지, grid 균등 정렬, 맨밑 상세문서 다운로드 탈출구, 통계적 정직성·엔진 불변). 5-18 카니발 UI 재설계에서 확립(비전문 마케터 대상).

## 16. 현재 상태 + 다음 작업

**최우선 진행 = v2 Next.js 마이그레이션** (SSOT: `docs/v2-migration-tasks.md`, 패턴: §12.20):
- ✅ Phase 1 수학엔진 이관 · Phase 2 Pro삭제+Supabase주석 · Phase 3 CSS 패리티 · Phase 4 전 도구 실배선 · **Phase 6.3 CSV 그룹 스코프 상태**(csvGroups+TOOL_GROUP 미러) · **6.4 Path 라우팅**(`[[...slug]]`+routeMap+sitemap) · **Phase 7 골든+스모크 하네스**(vitest golden+jsdom smoke).
- ✅ 검증: `npm run test:all` **42파일·202 GREEN**(golden 22+smoke 20)·eslint 0·next build ✓·전 도구/대시보드 preview 크래시 0. **Phase 8 배포 게이트 충족**.
- ✅ **Phase 8 컷오버 진행**(feat/v2-nextjs-cutover PR): v2를 별도 repo(Growth_Ops_Playbook)에서 개발 후 MKT_Library로 편입 — nested `.git` 제거·파일 복사, `index.html`·루트 `serve` package.json·`serve.json`·`validate.js`·`sitemap.xml`·`content/` 레거시 삭제. SOP가 런타임 fetch하는 `content/pages`·`schema.md`+`ads.txt`는 `v2-migration/public/`로 이동(v2 자기완결). 도메인 `mktlibrary.up.railway.app`로 교체(layout·routeMap).
- ⚠ **배포 수동 작업(사용자)**: Railway 서비스 **Root Directory=`v2-migration`**, Build=`npm run build`, Start=`npm start`(`next start -p $PORT`). 이 설정 없으면 루트에 package.json 없어 빌드 실패. 이후 v2 작업은 MKT_Library `v2-migration/`에서.

**레거시 백로그** (필요 시): 쉬운말 딥다이브 잔여(5-4→5-18→5-20 §12.17) · SOP 콘텐츠 보강 · 회귀·예측 후속(§12.15·§12.20) · Pro 처방 레이어. (index.html은 git 히스토리에 보존.)

---

## 17. 토큰 효율 규율 (컨텍스트 위생) 💰

파일 tool result = 매 턴 재전송(고정비용). 아래는 룩업 테이블, 장문 서술 금지(이 섹션 자체가 매 턴 실림).

| # | 규율 | 적용 |
|---|---|---|
| 1 | 파일/함수 단위로만 읽기 | 큰 파일 `wc -l`→`offset`/`limit`. ToC(`ARCHITECTURE.md`·§13)로 위치 파악 후 그 파일만. 이미 컨텍스트에 있으면 재Read 금지 |
| 2 | 무거운 탐색만 서브에이전트 | "영향범위·코드베이스 조사"류 → Task/Explore(요약만 회수). 작은 셸/git은 메인 직접(왕복 오버헤드 손해) |
| 3 | `.claudeignore` 우선 차단 | `node_modules`·`.next`·`*.csv`·디버그잔재. 시그널 레이어일 뿐(우회 가능) — 진짜 민감파일은 `.claude/settings.json` `permissions.deny`(자격증명·`.env`류는 지금 즉시, "필요 시" 아님) |

**세션 관리(Claude 규율 아님 — Gondry님 운영 체크리스트)**: 1~3은 세션 안에서 절약, 진짜 방지책은 **세션을 안 키우는 것**. `/compact`를 기능 종료마다, `/clear`를 작업 전환마다, `/rename <workstream>`+`claude --resume`으로 스트림 분리. 문서로 적어도 Claude가 대신 실행 못 함(권한 없음) — status line에 컨텍스트 % 경고 걸어두는 걸 강제 트리거로 권장.

---

*과거 상세(PR별 함정·recipe 풀버전)는 git 히스토리와 각 PR description, `docs/*.md`에 보존. 본 파일은 의사결정에 실제 쓰이는 규칙·패턴·현재 상태만 유지한다.*
