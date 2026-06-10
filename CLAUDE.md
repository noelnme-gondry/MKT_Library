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
- **navigate 재렌더 시 스크롤 top 리셋** (PR #35): `navigate()`가 항상 `scrollTo(top:0)` 하면, 필터/토글/매핑 등 같은 페이지 in-place 재렌더마다 화면이 맨 위로 튐. **중앙 해결**: navigate 진입 시 `prevScrollY`+`prevHash` 캡처 → 끝에서 `newHash === prevHash`(같은 페이지)면 `scrollTo(prevScrollY)`, 다른 페이지면 top. 핸들러마다 rAF로 개별 보존하지 말고 navigate 한 곳에서 처리.
- **objective metric이 getAvailableMetrics에서 누락 → 조용히 reset** (PR #37): 5-3 ROAS 목표가 `metric=revenue_d7`를 세팅해도, §2 성과지표 select 렌더의 `if(!av[metric]) metric=firstAvailable` 가드가 `getAvailableMetrics()`에 revenue_d7 키가 없어 metric을 installs로 되돌림 → 라벨이 CPI로 표시. **교훈**: objective↔metric 매핑 추가 시 `getAvailableMetrics()` + dropdown option + firstAvailable 목록 3곳을 같이 갱신. availability 맵에 빠진 metric은 select 가드가 silently override.
- **ROAS 뷰 = display-invert (y=1/CPR), 배분은 CPR 공간 유지** (PR #37): 파이프라인 전체가 `y=cost/result`(CPR, 낮을수록 긍정) 기반. ROAS(높을수록 긍정)는 파이프라인을 뒤집지 말고 **표시층에서만** 반전: 차트 점/추세선 y=1/CPR(raw, 정규화 bypass), 축/툴팁 라벨, 표 값은 `fmtCostMetric(cpr, metric)`(ROAS면 1/CPR을 %로). 배분 greedy/weight는 CPR 그대로 → 수치 byte-identical. delta 화살표/색은 display-space에서 isRoas면 d>0이 긍정.
- **ROAS는 CSV/XLSX export도 같이 반전** (PR #43): display-invert(PR #37)는 화면만 고쳤음. export(`downloadChannelCSV`/`buildChannelSheetAOA`/`getModelFormula`)는 CPR 모델을 라벨만 ROAS로 바꿔 내보내 `predicted_cpr` 컬럼·CPR 값이 그대로 나옴 → 사용자 혼란. export도 ROAS면 컬럼명 `predicted_roas`/`roas`, 값 `1/CPR`, Excel 공식 `=1/(CPR식)`, marginal_cpr 컬럼은 ROAS 시트에서 생략. **교훈**: 표시 반전 작업 시 화면+export를 한 세트로 본다.
- **회귀/MMM 도구는 "기술용·인과 아님" 캐비엇을 UI+JSON+README 3곳에 강제** (PR #51~53, 5-17 MMR): association만 — cannibalization/incrementality 판정은 holdout(5-15) 전용. 코드로 강제한 가드레일: ① spec은 in-sample fit 금지·rolling-origin OOS 그리드서치로 θ·saturation 선택, ② bare p값/별표 금지·Newey-West HAC SE+95%CI 우선, ③ 영구 변화는 STEP 더미(단일주 더미=잔차≈0 자동 탐지·해석 제외), ④ Google ROI+CBUA 합산 금지·채널 분리, ⑤ raw CCF 금지·prewhiten(detrend+deseason) 후. chi2 CDF는 Lanczos lgamma+정규화 불완전감마(급수+연분수) 자체 구현. 클라이언트 도구라 채널 공통 θ 그리드(5^채널 폭발 회피)로 단순화 + README 명시.
- **희소·저커버리지 채널의 음수 탄력성은 "잠식"이 아니라 "노이즈"** (PR #62, Gemini 피드백): 비-0 주가 적은 채널(예: TikTok 6/127주)이나 커버리지<50%·최근 끊긴 채널(예: Meta 52/127+말미 0)은 회귀계수가 노이즈라 음수가 나와도 "잠식 의심"으로 표시하면 오판. 코드 가드: `mmmChannelCoverage`로 sparse/lowCov/trailingZero 판정 → 유의 음수라도 데이터 부실하면 "노이즈"로 강등, sparse는 "데이터 부족 ⊘"·예산결정 금지 경고, config 토글로 모델에서 제외(식별 정리). VIF 5~10 다수 군집도 "개별 기여 왜곡 가능" 경고(10+만 심각으로 보지 말 것).
- **외부 Python 통계 파이프라인을 클라이언트 JS로 충실 이식하는 법** (PR #54~56, 5-18 MMM 방법론): statsmodels/scipy/pymannkendall 의존 분석을 vanilla JS로 옮길 때 ① 로컬 venv에서 원 라이브러리 **소스·상수표를 직접 추출**(MacKinnon ADF p값표, KPSS 임계값·Hobijn nlags, pymannkendall Hamed-Rao 분산보정)해 추측 없이 이식 ② Monte Carlo는 **결정론 대체**(Shapley는 1500 perm MC 대신 subset-memoized 정확 LMG — 더 정확) ③ 검정 통계(OLS/HAC/AR1 Cochrane-Orcutt/MK/ADF/KPSS/Ljung-Box/Student-t incomplete-beta)는 `MMM_STATS`에 순수함수로 ④ **민감 실데이터는 커밋 금지**하고 로컬 검증 스크립트(`/tmp`)로 원 파이프라인 수치 재현 대조(AR1 elasticity 4자리·VIF·verdict 완전 일치) ⑤ rolling-origin CV는 학습창 0분산 열 드롭으로 statsmodels pinv 동작 재현 ⑥ STL은 짧은 시계열(<3주기)에서 본질적 불안정 → 보조지표로만, 1차 판정은 MK/ADF/KPSS.
- **audit가 전부 0·p1 = 설계행렬 특이(겹치는 더미·하드코딩 step과 동일 컬럼)** (PR #85, 5-18 §2): 임의 매핑에서 사용자가 겹치는 휴일 더미(LNY=PreLNY|Seollal, Chuseok=ChuseokOnly|PostChuWk)나 도구 하드코딩 step(line_off week55)과 동일한 컬럼을 넣으면 `mmmSheetDesign` 설계행렬이 완전공선 → `CREATIVE_MATH.inverse` pivot<1e-12 null → `mmmOls` null → `mmmFitNamed`이 **전 계수 coef0·p1·R²0**로 silent 디폴트(NaN 아니라 0이라 "—" 안 뜨고 "0.00"로 보임 → 진단 헷갈림). `_nonConstCols`(상수만 드롭)로는 못 막음. 수정: `_nonRedundantCols`(절편 포함 점진 Gram-Schmidt, 잔차노름/원노름<1e-8이면 드롭=statsmodels pinv 동치)로 교체 → 종속 열 자동 드롭, 나머지 정상 추정. 단일 플랫폼(Tinder)은 공선 없어 keep 동일 → byte-동일. MMM 본체(`mmmBuildFeatures`)는 더미 미사용이라 §3/§5는 멀쩡, audit(§2)만 깨짐 → "audit만 1로 도배"가 시그니처.
- **CSV 다운로드가 엑셀서 안 열림 = LF-only 줄바꿈** (PR #85): `lines.join("\n")`는 RFC4180 위반이라 Excel(특히 BOM+LF)에서 한 행으로 뭉치거나 깨짐. **`\r\n`(CRLF)** 로 조인 + BOM(`﻿`) 유지 + `text/csv;charset=utf-8`. 한글 깨짐 방지엔 BOM, 행 분리엔 CRLF 둘 다 필요. (decomp/cannib/regression export 전부 동일 패턴.)
- **log-log 탄력성 적합은 타깃에 0/빈값 1개만 있어도 전체가 NaN** (PR #82, 5-18): `target.map(Math.log)`에서 `log(0)=-Inf`(또는 빈값→num이 0으로)가 AR1 적합 전체를 오염 → **모든 채널 elas=NaN·p=1**(faRaw 기반 "주당 인원"은 멀쩡해 진단이 헷갈림). 수정: `_mmmLogFitAR1`로 **타깃≤0·비유한 주차를 제외**(log(0)은 관측 불가라 통계적으로 정당). 타깃 전부 양수면 모든 행 유지 → Tinder/골든 byte-동일. 임의 데이터(초기 램프·휴면 0주)에서 흔함. semi-log raw 적합(faRaw)은 0이 정상값이라 제외 불필요.

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
- **최근성 우선 정렬** 선호 (PR #36): 채널/항목 정렬 기본값은 전체 누적이 아니라 **최근 N일(예: 20일) 기준**. 과거 큰 지출이 상위를 점유해 최근 활성 항목이 안 보이는 걸 싫어함. 동률 시 전체 누적으로 2차 정렬.
- **검증 가능성** 중시 (참고값 재현 테스트, console 디버그 노출)
- **분석 결과 해석** 도움 요청 → 차트만 보고 끝나지 않음. 항상 의사결정에 어떻게 쓸지까지 정리.
- **메타-도구 사고** → 단순 기능 요청 외에도 "하네스/에이전트 자체를 어떻게 진화시킬지" 명시적으로 요구. 자가 업데이트 같은 self-referential 규칙을 명시적으로 선호 (PR #26~27 검증).
- **목표 우선 사고** → 분석 도구에 들어가기 전 "무엇을 최적화할지(CPI/CPA/ROAS)"를 먼저 명시적으로 선택받는 흐름 선호. 도구가 "전부 다 분석" 보다 "선택한 목표만 정밀 분석"하는 게 의사결정 부담 ↓ (PR #31 검증).
- **통계 입력 보조 선호** (PR #44): 마케터가 σ(표준편차) 같은 통계 입력을 직접 못 구하는 경우, 도구가 **붙여넣기→자동계산**(시트 컬럼 복붙 → 표본 stdev) + **프리셋 추정**(CV 1~3 → σ=CV×μ) 같은 입력 보조를 제공해야 함. 천단위 콤마: 줄바꿈/탭 있으면 콤마=천단위(제거), 한 줄이면 콤마=구분자.
- **결론-우선 + 평어 해석 (외부·대중 공개 도구)** (PR #59): 통계 도구가 외부/비전문가 대상이면 ① 분석 직후 **§0 "한눈에 보기" 히어로 카드**(accent gradient·맨 위)를 만들어 결론을 먼저 보여줌 — 어떤 채널이 잠식/증분인지, **주당 몇 명**(탄력성→semi-log 한계효과 `b/(1+현지출)*1000`로 환산), 통계 신뢰도(**●●●●○ dots** = p값/검정합의 매핑). ② 모든 섹션에 `💡 쉽게 말하면` 인라인 콜아웃으로 p값·HAC·VIF·Shapley·adstock 등을 평어로 1~2줄 설명. ③ "연관≠인과, 확정은 holdout" 캐비엇은 §0에도 눈에 띄게. 통계 지식 0인 사람도 결론만 읽고 의사결정하게.

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
- ❌ **`git add -A`/`git add .` 로 무차별 스테이징** (PR #54 사고): 워킹트리에 사용자가 드롭한 민감 데이터(예: `weekly.csv`)·Python venv 8천여 파일이 통째로 커밋·push됨 (§2 위반). 항상 `git status`로 확인 후 **변경한 파일만 명시적으로 `git add index.html CLAUDE.md docs/...`**. 외부 데이터/대용량 폴더는 먼저 `.gitignore`에 추가. main 히스토리에 들어간 민감 파일은 force-push 금지(§11)라 즉시 purge 불가 — 처음부터 안 올리는 게 유일한 방어.

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

### 12.6 도구 그룹 공유 CSV (하나 업로드 → 연속 처리)
`TOOL_GROUP` 맵으로 같은 데이터 grain 도구를 묶고, `loadCsvFromTool`이 본인 스냅샷 없으면
같은 그룹 형제의 CSV를 자동 이어받음(매핑은 본인 슬롯 복사로 독립 유지). 효율 그룹
(5-2/5-3/5-9~5-12)은 일별 캠페인 CSV 1개로 전부 동작. 신규 효율 도구는 `TOOL_GROUP`에
`"efficiency"`로 등록 + `TOOL_REQUIRED_FIELDS`/`OPTIONAL`만 정의하면 자동 공유.

### 12.7 squash-merge + 장수 feat 브랜치 충돌 처리 (반복 패턴)
main이 squash-merge라 feat 브랜치(누적)와 매 PR마다 index.html 충돌 발생. feat는 항상
main의 superset이므로 `git merge origin/main --no-edit` → `git checkout --ours index.html`
→ `grep -c "^<<<<<<<"`(0 확인) → syntax+골든 재실행 → `commit --no-edit` → push → 재 merge.
골든 테스트가 superset 무결성을 보증하므로 --ours가 안전.

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

### 12.8 표시 번호 ↔ 라우팅 id 분리 (display-only relabel) (PR #58)
TOC/사이드바/헤더에 보이는 번호를 바꿀 때 **내부 id(`5-2` 등)는 절대 건드리지 말 것** — hash·`PAGE_RENDERERS`·`navigate`·`AUTH`·`TOOL_*` 수백 곳이 의존하고 북마크·공유링크도 깨짐. 대신 `displayItemNumber(id)`/`displayGroupNumber(id)` 순수함수로 PHASES+IA 위치에서 표시 번호를 계산(초기1-x·중기2-x 평탄화·후기3-x·운영4-{그룹}-{항목})하고, 렌더 3곳(renderNav 항목·그룹index, pageShell eyebrow·footer, pageHome 카드)에 적용. `data-route`는 그대로 id. 하드코딩 eyebrow(page_1_1/1_2)도 같이 갱신.

### 12.9 필드 가이드 표 중복 제거 (필수 oneOf ↔ 옵션) (PR #58)
`renderInlineCsvUpload`의 가이드 표는 필수(oneOf 포함)와 `TOOL_OPTIONAL_FIELDS`를 둘 다 렌더 → 같은 키가 양쪽에 있으면 행이 2번 나옴(5-17/5-18 채널·타깃). render에서 `reqKeys` Set으로 옵션 중복 skip + 옵션 설명(`unlocks`)은 `optByKey`로 필수행에 병합해 설명 손실 없이 1행으로.

### 12.10 통계 도구 비전문가용 3종 세트 (PR #59·#61·#63, 5-18) — 외부 공개시 필수
대중 대상 통계/분석 도구는 결과만 던지지 말고 ① **결과해석 §0 헤드라인**(채널별 잠식/증분·주당 인원·신뢰도 dots) ② **주별 드라이버 분해 + 실제vs모델(fitted) 차트 + 튀는 구간 자동 진단**(잔차 2σ↑ 주를 baseline·계절 / 채널 스파크 / 모델 밖으로 분류 + 메모 입력) ③ **4단 클릭 툴팁/모달**(`MMM_GLOSSARY` + `mmmInfoIcon`/`mmmOpenInfo`, 글래스모피즘 vanilla; 각 통계 [이유/진행/해석/유의성]+예시+오해). 용어집 콘텐츠는 워크플로 병렬 작성+적대 검수로 일관성·평어 확보(전문용어 즉시 괄호 풀이 강제).

### 12.11 주별 기여 분해 (centered, semi-log-valid) (PR #61)
`contribution_jt = β_j·(X_jt − mean(X_j))`, `Σ + baseline(ȳ) = OLS fitted`(intercept OLS 항등식). 사용자 단위(명)로 "각 드라이버가 매주 baseline을 ±몇 명 흔드나" 표시. **준로그 수준-점유 분해(ln(1)=0 외삽)는 금지** — 평균-편차 분해만. 튀는 구간 분류는 `|residual| > |max driver contrib|`면 "모델 밖", 아니면 지배 드라이버가 baseline계열이면 "계절·기저", 채널이면 "채널 스파크".

### 12.12 공통 회귀 엔진 + Regression Lab (PR #65·66, 5-19)
범용 OLS는 `REG_STATS`(IIFE: ols/r2of/tSF, ridge fallback)·`REG_TRANSFORMS`(none/log1p/zscore/minmax/adstock_log) 공유 엔진으로. **헬퍼는 반드시 IIFE에 격리** — `_mean`·`mean` 등 기존 전역과 충돌(중복선언=SyntaxError). 5-19는 STANDARD_FIELDS가 아닌 **자체 가변 매핑**(role/type/transform per 컬럼 + 자동추정). 자동추정 시 **0/1 binary는 날짜명 오인("is_holiday"의 day) 방지 위해 independent 우선 판정**. 샘플 데이터는 seededNoise(Math.random 금지). 추출 CSV = 행별 actual·fitted·resid·contrib(β·x). 로그/adstock 사용 시 level-share 외삽 무효 경고.

### 12.13 방법론 도구 vs 범용 회귀 분리 원칙 (PR #67)
5-18처럼 **의미 기반 방법론 도구**(특정 채널=Google임을 알아야 audit·cannibalization·Shapley 동작)는 순수 role/dep/indep 가변매핑으로 바꾸면 방법론이 사라짐 → 범용 회귀는 **별도 도구(5-19)로 분리**하고 방법론 도구는 구조 유지. 방법론 도구에 **세그먼트(platform) 차원**을 더할 땐 행 필터 방식(매핑된 platform 값으로 subset 후 전체 파이프라인 재적합)이 비파괴적 — "All"·미매핑은 기존과 byte 동일해야(골든으로 보증).

### 12.14 분석 게이트 — 매핑 후 "분석하기" 명시 실행 (PR #70)
매핑만으로 자동 결과를 뱉으면 "매핑 바꿔도 되는지 신뢰 안 감". `TOOL_ANALYZED[id]=toolAnalyzeSig(매핑 시그)` + `isToolAnalyzed` 게이트로, 페이지 prereq 조건에 `|| !isToolAnalyzed(id)` 추가 → 매핑 완료해도 결과 숨김, `renderInlineCsvUpload`의 "▶ 분석하기" 클릭(`data-tool-analyze`→markToolAnalyzed+navigate) 후에만 결과. 매핑 변경=시그 달라짐=자동 숨김+재분석 요구. sig는 **매핑만**(타깃/플랫폼 토글은 탐색이라 제외). 게이트는 렌더층 전용 — `buildXxxCache`는 영향 없어 골든·로컬검증 그대로.

### 12.15 다중공선 흡수: 캠페인 유지 기본 + 방향 선택 (PR #71)
두 변수가 거의 동일하게 움직이면(corr≥0.9·VIF↑) 회귀가 식별 불가 → 하나를 흡수(드롭). **하드코딩 금지·자동 감지**(`mmmDetectCollinear` 채널 ln↔step 더미). 기본 흡수 대상 = **step(캠페인 채널 유지)**, `MMM_METH_STATE.absorbChoice`로 뒤집기. `cfg.absorbed` Set을 파이프라인 전체가 사용(채널·step 모두 스킵). ⚖ 노티스로 "X↔Y corr 0.98 — Y 흡수·X 유지" 표시 + 토글. 비즈니스 중요도에 따라 사용자가 무엇을 살릴지 결정.

### 12.16 카니발 채널 개별화 · 목차 필터 · 드래그앤드롭 매핑 (PR #75·76·77)
- **카니발 합산 금지**: `mmmCannibalization(…, channelKey)`로 채널마다 개별 삼각검증(precedence·detrend는 그 채널 spend, net은 그 채널 탄력성). `cannibByChannel` 전부 계산 + §4 채널 pill 셀렉터. "ROI는 안 떨어지는데 CBUA부터 떨어지나"를 채널별로.
- **페이지 전역 필터는 목차로**: `pageShell(opts.tocFilters)` 공용 슬롯(.toc-filters) — 타깃·플랫폼 같은 전역 컨트롤을 우측 목차 상단 고정 패널로. 채널 같은 분석-지점 필터는 본문 유지. 핸들러는 document 위임이라 위치 무관.
- **드래그앤드롭 매핑**(5-19): 컬럼 칩 → 종속Y/독립/그룹/라벨 drop zone(HTML5 DnD: dragstart setData / zone dragover·drop으로 role 설정, Y는 1개 강제, ✕ 미지정). 독립 칩에 type·transform·**perf/brand** kind. 적합 로직은 role/type/transform 모델 그대로 — DnD는 role 설정 UI일 뿐. **DnD 포인터 인터랙션은 headless 검증 불가 → 브라우저 확인 필요**.

### 12.19 채널별 수확체감 곡선 + 분석 결과 CSV 다운로드 (PR #85, 5-18)
- **saturation은 채널별로**: `mmmRunMmm`이 단일 `saturation`(골든 호환 유지)에 더해 `saturationByChannel`(brand·sparse·absorbed·미포함 제외, 각 {ln_coef, marginal_kpi_per_1k, label, recentMean}) 반환. §5에 **수확체감 곡선 차트**(`mmm-sat-chart`: x=지출, y=`b/(1+x)*1000` +$1k당 명, 음수=dashed 회색=노이즈, 색은 `MMM_DECOMP_PALETTE`/`mmmDriverColor`로 분해와 일치) + 채널별 표($10k/$35k/$60k/현지출). **음수 한계효과=노이즈(잠식 아님)** 캐비엇 필수(§7 PR#62). §0 weeklyPer1k(현 1점)와 중복 아님(여긴 곡선 전체).
- **decomp/cannib CSV**: decomp는 위(actual/baseline/predict)+아래(baseline+contrib_* 누적) 두 차트 데이터 모두 포함(이미 충분). 카니발은 `downloadMmmCannibCsv`로 전 채널×삼각검증(precedence/detrend/net)+탄력성·커버리지 1행씩. effects는 `effByKey` join, 캐시 lookup만(재계산 X). 버튼은 해당 § 헤더 우측, `bindMmmMethHandlers`에서 바인딩. adstock+saturation은 decomp 채널 기여에 이미 반영(=β·(log1p(adstock(x))−mean), level-share 금지 유지).

### 12.18 baseline-anchored 누적 분해 차트 + 기여 CSV (PR #82, 5-18 §5.5)
주별 드라이버 분해를 "baseline 위에 쌓아 예측(predict)과 같이"로 보여줄 때: centered 기여(`β·(X−mean)`, §12.11 level-share 금지 유지)를 **baseline부터 차례 누적**해 line dataset마다 `fill:"-1"`(직전 누적선까지 채움) → 맨 위 누적선 = fitted(예측), 음수 기여면 띠가 내려감(그 주 끌어내림). y축 `stacked:false`(직접 누적했으므로). 실제선 흰색 overlay. 표 색 스와치는 `MMM_DECOMP_PALETTE` + `mmmDriverColor(name,groupNames)`로 차트 띠와 일치. **CSV 다운로드**(`downloadMmmDecompCsv`): week·date·actual·baseline·predict·residual + `contrib_<드라이버>`(명) + `spend_<채널>` → 사용자가 CPR(=spend/contrib) 등 직접 계산. BOM(`﻿`) 붙여 한글 엑셀 깨짐 방지, 헤더/값 콤마는 `q()`로 따옴표 이스케이프.

### 12.17 방법론 도구를 임의 N채널로 일반화 (2단계: 동적 채널 → 콜맵 DnD) (PR #80·81, 5-18)
의미기반 도구(§12.13)를 고정 채널(`MMM_CHANNELS`)에서 임의 채널로 풀 때 **2단계로 안전하게**: ① **동적화** — 파이프라인 `MMM_CHANNELS`→`_mmmChans(panel)`(panel.channels=[{key,label,kind}]), Shapley 그룹·sheet lump(`kind!=="brand"`)·brand 합산을 panel 기반으로. UI 무변·결과 byte-동일(골든+validate_pipe로 보증) → 무위험 커밋. ② **콜맵 DnD** — `MMM_METH_STATE.colMap`(header→{role,kind}; role=week/reg/react/channel/dummy/platform)로 드래그앤드롭 매핑. `mmmGetPanel`은 colMap active면 그 경로, 아니면 STANDARD_FIELDS **fallback**(골든·로컬검증은 STANDARD라 그대로). 채널 key는 `_mmmSanKey(header)`(label=원본). 게이트·`checkRequiredForTool`은 해당 도구만 colMap special-case. **하드코딩 채널 키 의존 제거**: `mmmSaturation(…,"google_roi")`→panel 첫 perf 채널, `foldIntoRegime`/`combinedGoogle`은 fallback/vestigial이라 무해(라이브는 `mmmResolveAbsorb` 동적 흡수=키 무관). 검증: colMap 패널 = 수동 패널 **byte-동일**(동적 absorb 경로로 비교 — raw cfg는 foldIntoRegime fallback 타서 artifact 불일치). **자동 매핑은 기본 OFF**(PR #83) — 업로드 시 전부 `ignore`(헤더 순서대로 트레이), 사용자가 직접 드래그, `🪄 자동 추정` 버튼은 선택. `mmmColMapActive`는 헤더 있으면 항상 colMap 반환(미지정만 있어도 required가 missing 처리). **플랫폼이 단일 컬럼이 아니라 wide(컬럼명에 android/ios)인 데이터**(PR #84): colMap 항목에 `plat`(common/android/ios·`mmmGuessPlat`로 이름 추정) 추가, reg/react/channel은 플랫폼별 **여러 개 허용**(week·platform-col만 단일). `mmmColMapRoles`가 배열 반환, `mmmGetPanelFromColMap`이 활성 플랫폼(`MMM_METH_STATE.platform`)으로 타깃·채널 선택(정확>공통>첫째, 더미·week 공유). 상단 플랫폼 셀렉터(태그 모드는 "전체" 없음 — 스케일 혼합 불가)로 전환하면 캐시키 `pf:` 달라져 자동 재적합(게이트 무관 — 탐색). `mmmIsTagMode`=platform-col 없고 비-common 태그 ≥1. 단일 platform 컬럼이 있으면 기존 행 필터 모드.

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

---

## 16. 진행 중 백로그 (다음 세션 인계)

상세는 `docs/backlog.md` 참조 (CLAUDE.md 비대화 방지로 분리 보관).

- **남은 UI 작업**: ① SOP 콘텐츠 보강(1-2~4-4 인라인, 정확성 검수 기반·진행방식 미정) ② MMM.
- **MMM = Tinder KR Reg/React Marketing-Response Regression** 스펙(`docs/backlog.md` § B)이 정식 요구사항.
  착수 전 범위 확정 필요: 분석 파이프라인 실행 환경 + 결과 JSON을 본 대시보드(5-N)가 소비하는 연결 형태.
- 핵심 제약: 회귀는 **가설 생성·기술용**이며 인과/증분/cannibalization 판정은 **holdout 전용**. 계수를 인과로 제시 금지.
- 이미 완료(머지): 운영 그룹 재구조화 + 5-9~5-16 신규 도구 9종 + 5-3 시나리오·5-6 velocity. 골든 47/47.
