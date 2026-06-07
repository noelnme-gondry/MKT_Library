# Performance Marketing Library — Agent Harness

이 파일은 본 프로젝트에서 작업하는 모든 Claude 인스턴스가 따라야 할 규칙·아키텍처·작업 방식을
정리한 하네스입니다. 사용자의 의사결정 패턴과 이 세션에서 검증된 워크플로우 기반으로 작성됨.

---

## 1. 프로젝트 정체성

- **이름**: Performance Marketing Library (Ops Dashboard)
- **목적**: 앱 퍼포먼스 마케팅 SOP 문서 + 운영 데이터 기반 분석 도구 모음
- **배포**: Railway (`mktlibrary-production.up.railway.app`) — `main` 브랜치 자동 deploy
- **저장소**: `https://github.com/noelnme-gondry/MKT_Library`
- **타겟 사용자**: 시니어 퍼포먼스 마케터 (KR 시장 중심, 한글 UI)
- **데이터 민감도**: 마케팅 운영 데이터 = 사내 민감 자료. **클라이언트 사이드 처리만 허용**, 서버로 전송 금지.

---

## 2. 절대 원칙 (NEVER 깨지 말 것)

1. **단일 HTML 파일**: 모든 코드는 `index.html` 하나에. 별도 .js/.css 파일 생성 금지.
   빌드 도구 없음. 외부 CDN 라이브러리만 허용.
2. **클라이언트 사이드 100%**: 사용자가 올린 CSV는 브라우저 메모리에만. 서버 전송/저장 절대 금지.
3. **Supabase service_role key 절대 요청·저장·언급 금지**. anon public key만 사용 (RLS로 보호됨).
4. **main 브랜치 직접 push 금지**. 반드시 feat 브랜치 → PR → squash merge.
5. **Force push to main 금지**. hook skip(`--no-verify`) 금지.
6. **사용자가 명시적으로 commit 요청하기 전까진 commit 하지 말 것** (단, 본 프로젝트는
   "작업 → 즉시 PR" 흐름이라 작업 완료 후 commit/PR은 디폴트로 진행).

---

## 3. 기술 스택

```
HTML/CSS/JS (Vanilla)
├─ Chart.js 4.4.4         (CDN) — 모든 차트
├─ PapaParse 5.4.1        (CDN) — CSV 파싱
├─ Supabase JS 2.45.4     (CDN) — 접근 키 검증 (anon RPC만 사용)
├─ SheetJS 0.18.5         (CDN) — XLSX export
└─ Inter / JetBrains Mono (Google Fonts) — Obsidian Flux 디자인 시스템
```

빌드 도구 없음. `npm install` 없음. `serve . -l $PORT` 가 모든 것.

---

## 4. 아키텍처

### 4.1 페이지 라우팅
- Hash 기반 (`#5-3` 등)
- `PAGE_RENDERERS[id]` 디스패치 테이블이 페이지 함수 호출
- `IA` 배열이 사이드바 구조 정의 (`IA → groups → items`)
- `findMeta(id)` 로 페이지 메타 조회
- `pageShell(meta, { deck, chips, summary, toc, body })` 로 공통 레이아웃

### 4.2 도구 분류 (현재)

| ID | 도구 | 데이터 | 상태 |
|---|---|---|---|
| 1-x ~ 4-x | SOP 문서 | 정적 콘텐츠 (JSON) | 운영 |
| 5-2 | 시각화 대시보드 | CSV (도구 전용) | 운영 |
| 5-3 | Budget Allocator | CSV (도구 전용) | 운영 |
| 5-4 | A/B Test Calculator | 수동 입력 | 운영 |
| 5-5 | Cannibalization Analyzer | CSV (도구 전용) | 운영 |
| 5-6 | Creative Analyzer | CSV 소재 daily (도구 전용) | 운영 |
| 5-7 | Test Readout | CSV 실험 결과 (도구 전용) | 운영 |
| 5-8 | Quality Analyzer | CSV 코호트 daily (도구 전용) | 운영 |

### 4.3 도구별 독립 CSV 상태 (중요 패턴)

5-2/5-3/5-5 각각 자체 CSV snapshot 보유. 도구 간 데이터 간섭 없음.

```js
TOOL_CSV_SNAPSHOTS = { "5-2": {...}, "5-3": {...}, "5-5": {...} }
ACTIVE_CSV_TOOL = "5-5"  // 현재 활성 도구
CSV_STATE        // 활성 도구의 raw/headers/mapping을 거울처럼 반영

navigate("5-5") → loadCsvFromTool("5-5") → CSV_STATE 채워짐
업로드/매핑 변경 → saveCsvToTool(currentToolId) 로 persist
```

도구별 필수/옵션 필드는 `TOOL_REQUIRED_FIELDS` + `TOOL_OPTIONAL_FIELDS` 에 정의.
인라인 업로드 UI는 `renderInlineCsvUpload(toolId)` 가 자동 렌더.

### 4.4 캐시 패턴

무거운 계산은 항상 캐시. 캐시 키는 입력 시그니처 해시:

```js
const ALLOC_CACHE = { byChannel, outliers, weights, models, ... };
const DETREND_CACHE = { key, bySeries, dates, rangeDays, daily, validation };

function buildXxxCache() {
  const key = computeKey();  // mapping + data hash
  if (CACHE.key === key) return CACHE;  // hit
  // ... rebuild
  CACHE.key = key;
}
```

토글 클릭은 **lookup만**. 재계산 없음. 사용자 인지 무겁지 않게.

### 4.5 접근 키 인증

- `AUTH_PROTECTED_PAGES = Set(["5-2", "5-3", "5-4", "5-5"])`
- 키는 SHA-256 해시 후 Supabase `validate_access_key(input_hash)` RPC로 검증
- 평문 키는 절대 서버 전송 X
- 키 발급/관리: `supabase/SETUP.md` 참조

---

## 5. 코드 컨벤션

### 5.1 JavaScript
- **var 금지**, `const` 기본, 재할당 시 `let`
- **순수 함수 우선** — 사이드 이펙트는 최소화하고 명시
- 함수 이름: `camelCase`, `boolean`은 `is*`/`has*`/`can*`
- 통계 함수는 `CANNIBAL_STATS`, `ALLOC_MATH` 같은 객체에 모음 (단위 테스트 가능)
- DOM은 `document.getElementById` / `querySelectorAll` 직접 사용 (jQuery X)

### 5.2 CSS
- 의미적 변수 사용 (`--bg-1`, `--text-muted`, `--border` 등 Obsidian Flux 토큰)
- 인라인 style은 일회성 미세조정만. 재사용은 CSS 클래스로.
- `chart-container` 처럼 공용 클래스에 base style 정의

### 5.3 한글 / 영어
- **UI 표시**: 한글 (사용자 마케터가 한국인)
- **코드 식별자**: 영어 (`paid_regs`, `calcChannelHistorySummary`)
- **주석**: 한글 OK (특히 비즈니스 로직 설명)
- **CSV 헤더 자동 매핑**: 한글 alias 등록 가능

### 5.4 차트 (Chart.js)
- `responsive: true, maintainAspectRatio: false` 항상
- 캔버스 부모는 `.chart-container` 클래스 (사용자 resize 가능)
- 다크 테마 색상 명시 (`getCssVar('--text-muted')`)
- 차트 인스턴스는 `CHART_INSTANCES[id]` 에 저장 (재렌더 전 destroy 필요)
- PNG 다운로드: 합성 캔버스에 배경(`--bg-1`) 깔고 export (transparent 문제 회피)

---

## 6. 작업 워크플로우 (PR 흐름)

### 6.1 기본 흐름
1. 사용자 요청 받음
2. **모호하면 `AskUserQuestion` 으로 2~4지선다 질문** (옵션·트레이드오프 명시)
3. 작업 브랜치는 `feat/poly2-bell-warning` (장수 feature 브랜치, 지속 사용)
4. 변경 후 **syntax check 필수**:
   ```bash
   node -e "/* extract <script> blocks (skip ld+json), new Function(total) */"
   ```
5. `git add` + 커밋 (Co-Authored-By 라인 포함, HEREDOC 사용)
6. push → `gh pr create --base main --head feat/poly2-bell-warning`
7. PR body 형식 (필수):
   ```
   ## Summary
   - bullet 1
   ## Test plan
   - [ ] checkbox 1
   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   ```
8. `gh pr merge <N> --squash --delete-branch=false`
9. main과 충돌 시 `git merge origin/main` → 충돌 해결 → push → 재 merge

### 6.2 PR 충돌 해결 체크리스트
- `<<<<<<<`, `=======`, `>>>>>>>` 마커 grep 으로 확인
- 거의 항상 HEAD 채택 (feat 브랜치가 더 최신)
- **마커 남긴 채 커밋·푸시 금지** — `grep -n "^<<<<<<<" index.html` 으로 0 결과 확인 후 commit
- merge --continue 시 자동 commit 메시지 OK

### 6.3 commit 메시지 스타일
```
feat: 5-5 CCF 통계 유의성 가이드 + ±95% CI 신뢰선

# 섹션 헤더
- 변경 1
- 변경 2

# 다른 섹션
...

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```
- 1행 요약 (50자 이내 권장, 한글 OK)
- 본문은 섹션별 정리 (사유 + 근거 중심)
- 마지막 Co-Authored-By 라인 필수

---

## 7. 버그 트리아지 프로토콜

이 세션에서 검증된 5단계:

1. **증상 확인**: 사용자 스크린샷·콘솔 에러 그대로 받기
2. **재현**: 가능하면 사용자 데이터로 Node 환경에서 시뮬레이션
   ```bash
   cat > /tmp/test_X.js << 'EOF'
   /* user CSV 직접 파싱 + 의심 함수만 호출 */
   EOF
   node /tmp/test_X.js
   ```
3. **근본 원인 찾기**: 코드 line-by-line, edge case 검증 (윤년/0/NaN/빈 배열/타입 mismatch)
4. **방어 코드**: fallback 경로 + 진단 정보(`<details>` 디버그 패널) 추가
5. **검증**: syntax check + validation test 재실행 후 commit

### 알려진 함정
- **윤년**: `dayOfYear()` 가 1~366 반환. 배열 길이 367 보장.
- **CSV 콤마**: `"2,488"` 같은 쌍따옴표 안 콤마. PapaParse는 처리, 직접 split 금지.
- **PapaParse는 dynamicTyping 없이 사용** (모든 값 문자열 → `parseFloat`)
- **Chart.js 캐릭터** transparent → PNG export 시 다크 배경 명시 합성 필요
- **localStorage 영속 금지** (요청 시에만). 새로고침 리셋이 기본.
- **MA centered 경계**: 앞뒤 `half` 만큼 NaN. LOESS는 경계도 채움.
- **Beta PDF underflow** (PR #30): `Beta(α=101, β=9901)` 같은 큰 파라미터에서 `Math.pow(x, α-1) * Math.pow(1-x, β-1)` 가 underflow → 0. **log-space로 계산** (`(α-1)*ln(x) + (β-1)*ln(1-x)` → max 빼고 exp) 후 정규화. T1/T2 골든 테스트로 검증.
- **공유 CSS 클래스 + 전역 핸들러 + redirect = cross-page 점프 버그** (PR #33): 구 페이지(5-1)의 `.map-select → navigate("5-1")` 전역 핸들러가, 동일 `.map-select` 클래스를 쓰는 신규 매핑 select에도 바인딩됨. 5-1은 `navigate` 내부에서 5-5로 redirect되므로, 5-3에서 매핑만 바꿔도 Cannibalization(5-5)로 튐. **교훈**: 페이지 제거 시 그 페이지의 전역 `querySelectorAll(".shared-class")` 핸들러도 같이 제거. 신규 핸들러는 페이지 전용 `data-*` 속성으로 스코프 한정. 또 `handleCSVFile` 류의 fallback에 특정 페이지 ID 하드코딩 금지 (footgun).
- **dropzone 숨김 시 핸들러 unbound** (PR #33): bind 디스패치가 `[data-tool-dropzone]` 존재로만 게이트하면, CSV 로드 후 dropzone이 숨겨질 때 매핑 select가 unbound. 디스패치 조건은 그 핸들러가 다루는 **모든** 셀렉터(`[data-tool-csv]` 등)를 OR로 포함해야 함.
- **페이지 제거 = renderer + 등록 같이 제거** (PR #34): 페이지를 IA·navigate redirect로 비활성화해도 `page_5_N()` 함수 본문과 `PAGE_RENDERERS["5-N"]=...` 등록이 남으면, 그 안의 중복 id(`csv-dropzone` 등)·공유 클래스가 cross-page 핸들러 버그의 불씨로 남는다(PR #33 재발 위험). 비활성 시 redirect만 남기고 죽은 renderer 함수+등록을 통째로 삭제할 것.

---

## 8. 통계적 엄밀성

5-5 같은 통계 도구는 다음 표준 준수:

1. **순수 함수 분리**: `CANNIBAL_STATS = { linearFit, loess, stlDecompose, weekdayDetrend, pearson, crossCorrelation }`
2. **합성 데이터 유닛 테스트**: `window.runCannibalTests()` 5종 (T1 spurious 해소, T2 진짜 잠식 유지, T3 linearFit 항등식, T4 weekdayDetrend 항등식, T5 Pearson 정확)
3. **신뢰구간 자동 계산**: 95% CI = `1.96/√n`, 99% CI = `2.576/√n` 차트와 패널에 표시
4. **자동 종합 해석**: 사용자가 통계 지식 없이도 결론 읽을 수 있게 한 줄 요약 (색상 코드: 빨강 잠식 / 초록 동반 / 회색 무유의)
5. **단조 비감소 보정**: 한계효용 계산 시 running max로 artifact 차단
6. **Cohen's r 기준 가이드**: |r|<CI 노이즈 / 0.1~0.3 약함 / 0.3~0.5 중간 / 0.5~0.7 강함 / >0.7 매우 강함
7. **결정론 (Determinism) 필수** (PR #28 검증): `Math.random` 절대 사용 금지. Bayesian posterior 비교는 Monte Carlo 대신 **고정 grid 수치적분** (`betaProbGreater`). 같은 입력 → byte-identical 출력 보장. 골든 테스트 T6 패턴으로 검증.
8. **WLS impressions-weighted LPM** + FWL within-transformation (campaign_id 흡수) + VIF 기반 collinearity 제거 + BH 다중검정 보정 — 직접 구현 단순·안정. logistic IRLS는 v1 보류.

---

## 9. 사용자 의사결정 패턴 (관찰)

- **여러 선택지 + 트레이드오프** 제시 받는 걸 선호 (A 추천 / B 절충 / C 최대)
- **"몇 줄 정도 분량인가"** 가 결정에 영향 (수용 가능 비용 가늠)
- **데이터양 기반 자동 추천** 선호 (예: 18개월+면 STL 활성화, 미만이면 잠금)
- **즉시 시각 피드백** 중시 (토글 클릭 무거우면 캐시 추가 요구)
- **검증 가능성** 중시 (참고값 재현 테스트, console 디버그 노출)
- **분석 결과 해석** 도움 요청 → 차트만 보고 끝나지 않음. 항상 의사결정에 어떻게 쓸지까지 정리.
- **메타-도구 사고** → 단순 기능 요청 외에도 "하네스/에이전트 자체를 어떻게 진화시킬지" 명시적으로 요구. 자가 업데이트 같은 self-referential 규칙을 명시적으로 선호 (PR #26~27 검증).
- **목표 우선 사고** → 분석 도구에 들어가기 전 "무엇을 최적화할지(CPI/CPA/ROAS)"를 먼저 명시적으로 선택받는 흐름 선호. 도구가 "전부 다 분석" 보다 "선택한 목표만 정밀 분석"하는 게 의사결정 부담 ↓ (PR #31 검증).

---

## 10. 응답 스타일 (이 사용자에게 검증된 것)

### 10.1 한글 응답 기본
영어 코드/식별자는 그대로 유지하되 설명·해석·요약은 한글.

### 10.2 구조화된 출력
- **표(table)** 우선 — 비교/매핑/조건별 결과 정리에 효과적
- **체크박스 리스트** PR Test plan 등 검증 항목
- **이모지** 절제 사용: ✓ ❌ ⚠ 🔒 ⚓ ★ — 의미 명확할 때만
- **코드 블록** 정확한 파일경로:줄번호 포함
- **`상자` `inline code`** 식별자 강조

### 10.3 다음 단계 자동 제시
PR 머지 후엔 반드시:
1. 배포 시간 안내 (Railway 1~2분)
2. 사용자가 새로 보게 될 화면 설명
3. 테스트 방법
4. 다음 작업 옵션 (`AskUserQuestion` 또는 명시적 다음 단계 후보)

### 10.4 자주 쓰는 표현
- "배포 (1~2분) 후 확인 부탁드립니다"
- "이상한 거 있으면 알려주세요"
- "다음 작업 알려주시면 진행하겠습니다"

---

## 11. 안티패턴 (하지 말 것)

- ❌ React/Vue/Svelte 도입 (vanilla 유지)
- ❌ 별도 .js/.css 파일 생성
- ❌ 빌드 도구 추가 (vite/webpack/rollup)
- ❌ 새로운 라이브러리 추가 시 사용자 확인 없이 진행
- ❌ 사용자 데이터를 서버에 보내는 코드
- ❌ Supabase service_role key 요청·언급
- ❌ main에 직접 push, `--no-verify`, `--force` to main
- ❌ syntax check 안 하고 commit
- ❌ 콘솔 에러 무시
- ❌ 모호한 결정을 마음대로 정함 — 두 가지 이상 합리적 선택지가 있으면 묻기
- ❌ "임시" 라며 영구로 남는 코드 (디버그 panel은 의도적으로 유지된 것)
- ❌ 사용자 요청 외 페이지/기능 임의 추가
- ❌ 한국어 응답을 영어로 바꾸기

---

## 12. 자주 사용한 패턴 (Recipes)

### 12.1 새 분석 도구 추가하는 절차
1. `IA` 배열의 "Ops Dashboard" 그룹에 `{ id: "5-N", title, desc }` 추가
2. `AUTH_PROTECTED_PAGES` 에 ID 추가
3. `TOOL_REQUIRED_FIELDS["5-N"]` + `TOOL_OPTIONAL_FIELDS["5-N"]` 정의
4. `page_5_N()` 함수 작성 — 시작 부분에 `checkRequiredForTool` 체크 + `renderInlineCsvUpload("5-N")` fallback
5. `PAGE_RENDERERS["5-N"] = page_5_N` 등록
6. 핸들러 바인딩 (navigate 후 자동 호출)
7. PR 흐름대로 머지

### 12.2 새 통계 함수 추가 시
1. `CANNIBAL_STATS` 또는 `ALLOC_MATH` 객체에 순수 함수로 추가
2. `runCannibalTests` 에 합성 데이터 unit test 1개 이상 추가
3. Node `test_validation.js` 로 통과 확인 후 commit

### 12.3 차트 추가
1. HTML에 `<div class="chart-container"><canvas id="X"></canvas></div>`
2. 카드 헤더에 `<button class="ab-pill" data-pngdownload="X" data-pngname="...">⬇ PNG</button>` (다운로드)
3. `renderXChart()` 에서 `destroyChartIfExists("X")` 후 `new Chart(...)`
4. 인스턴스를 `CHART_INSTANCES["X"]` 에 저장

### 12.5 Forest plot (CI floating bar + coef scatter)
Chart.js 네이티브 forest 없음 → 가로 bar + scatter 2개 dataset 조합으로 구현 (PR #29):
- `type:"bar", indexAxis:"y"` + `data:[ciLow, ciHigh]` 형태 floating bar
- `type:"scatter"`로 coef 점 overlay (포인트는 흰색, border 검정으로 강조)
- pAdj 기반 색상 코드 (유의 양수 초록 / 유의 음수 빨강 / 기타 회색)
- 차트 높이는 effects 개수에 비례 (`--chart-h: ${n * 26 + 80}px`)

### 12.4 사용자 토글 클릭 → 즉시 반영
1. 데이터 변형은 캐시에 사전 계산
2. 토글 핸들러는 캐시 lookup + `chart.update("none")` 또는 className swap
3. 페이지 full re-render 피하기 (스크롤·포커스 손실)

---

## 13. 참고 파일

- `index.html` — 모든 코드
- `package.json` — `serve . -l $PORT`
- `Procfile` / `railway.json` — Railway 배포 설정
- `supabase/SETUP.md` — 접근 키 발급/관리
- `supabase/schema.sql` — `access_keys` 테이블 + RPC
- `content/supabase-config.json` — URL + anon key (커밋됨, RLS로 보호)
- `content/pages/*.json` — SOP 페이지 콘텐츠

---

## 14. 마지막 점검 체크리스트 (모든 PR 직전)

- [ ] syntax check 통과
- [ ] validation tests 통과 (5-5 작업 시)
- [ ] conflict marker 없음 (`grep -n "^<<<<<<<" index.html`)
- [ ] PR 본문에 Summary + Test plan 포함
- [ ] Co-Authored-By 라인 포함
- [ ] main 직접 push 안 함
- [ ] 사용자 요청 범위 안에서만 변경

이 모든 항목 통과 시에만 머지.

---

## 15. 하네스 자가 업데이트 (Self-Update Protocol) ⚙

**규칙**: 매 태스크 완료 시점에 본 `CLAUDE.md` 와 `.claude/agents/mkt-engineer.md` 를
새로 학습한 패턴으로 **반드시 자동 갱신**한다.

### 15.1 "태스크 완료" 시점 정의

다음 중 하나라도 발생하면 self-update 트리거:
- PR 머지 완료 (`gh pr merge` 성공) — 가장 일반적
- 사용자가 명시적으로 "다음 작업", "이제 X 하자" 등으로 작업 전환 시
- 사용자가 "이거 해결됐다", "잘 작동한다" 등 확인 메시지
- 검증된 새 anti-pattern 발견 (사용자가 명시적으로 "이건 하지 마" 등으로 지적)

### 15.2 어떤 종류의 학습을 기록하는가

본 PR/태스크에서 다음 중 하나라도 새로 생겼으면 기록:

| 카테고리 | 어디에 추가하나 | 예시 |
|---|---|---|
| 새 함정/edge case | § 7 "알려진 함정" | 윤년, PapaParse 콤마, Chart.js transparent |
| 새 작업 패턴/recipe | § 12 Recipes | 새 도구 추가 절차, 통계 함수 절차 |
| 새 anti-pattern | § 11 안티패턴 | "X 하지 말 것" 명시적으로 검증된 것 |
| 사용자 의사결정 패턴 | § 9 사용자 의사결정 | 새로 관찰된 선호 (예: "옵션 1+2 같이 하자") |
| 새 응답 스타일 패턴 | § 10 응답 스타일 | 검증된 표현·구조화 방식 |
| 새 통계 표준 | § 8 통계적 엄밀성 | 새로 추가한 합성 테스트 종류 등 |
| 새 도구/라이브러리 | § 3 기술 스택 + § 13 참고 파일 | 새 CDN 추가 시 |
| 새 절대 원칙 | § 2 절대 원칙 | 사용자가 "이건 절대 금지" 라고 한 것 |

### 15.3 무엇은 기록하지 않는가 (필터)

다음은 추가하지 말 것 — 노이즈만 늘림:
- 기존 패턴 그대로 적용한 평범한 작업
- 한 번만 일어난 일회성 결정 (반복 안 될 가능성 큼)
- 일반 프로그래밍 지식 (`null check`, `try/catch` 등)
- 너무 좁은 변수명/파일경로 (시점 지나면 stale)
- 사용자가 "임시" 라고 명시한 결정

### 15.4 업데이트 형식

1. 해당 섹션의 끝에 한 줄/한 항목 추가 (절대 기존 내용 삭제·재구성 금지)
2. 형식 일관성 유지 (다른 항목과 같은 표/리스트/문장 톤)
3. 길이 가이드: **한 태스크당 최대 5줄 이내**. 길어지면 핵심만 추출.
4. `.claude/agents/mkt-engineer.md` 도 같이 갱신 — CLAUDE.md의 압축판이므로 핵심만

### 15.5 커밋 방식

옵션 A (선호): 본 작업 PR에 같이 포함
- 작업 마무리 시 `Edit CLAUDE.md` 로 학습 사항 추가
- 같은 PR commit에 하네스 변경도 포함 (`docs(harness): ...` 섹션을 commit body에 명시)

옵션 B: 별도 docs 커밋
- 작업 PR 머지 후 즉시 `docs(harness): self-update from PR #N` 커밋 + 별도 PR
- 단일 라인 변경은 옵션 A 권장 (PR 분리 부담)

### 15.6 사용자 명시 지시 우선

사용자가 명시적으로 "하네스 업데이트 하지 마" 라고 하면 즉시 중단. 단, 새 세션에서 본 § 15가
다시 자동 실행되므로, 그 사용자 결정도 본 § 15.X 에 "예외 메모"로 추가해야 함.

### 15.7 자기 검증

업데이트 후 즉시:
- `Read CLAUDE.md` 로 새 내용 확인
- 추가한 줄이 기존 흐름에 자연스럽게 합쳐졌는지 확인
- 길이가 § 15.4 가이드(5줄) 초과 시 축약

### 15.8 메타 규칙

본 § 15 자체도 시간이 지나며 개선될 수 있음. 사용자가 "self-update 흐름이 어색하다" 등
피드백 주면 본 § 15 도 수정 대상. **단, § 15 자체를 통째로 삭제하지 말 것** —
self-update 메커니즘이 사라지면 하네스가 정체됨.
