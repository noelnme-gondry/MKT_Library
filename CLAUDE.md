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
- **전부-0 채널·완전공선 feature → 특이행렬 → `.resid` null 크래시** (PR #88, 5-18): 임의 매핑서 전부-0 컬럼(예: `apple_search_ads_android`=ASA는 iOS전용)을 채널로 넣으면 `ln_media`가 상수 0 열 → `mmmBuildFeatures` 설계행렬 특이 → `mmmOls` null → `mmmTrendExistence`의 `fit.resid`(무가드) 등에서 "Cannot read properties of null (reading 'resid')" 크래시. **근본수정**: `mmmBuildFeatures` 끝에서 `_nonRedundantCols`(절편 포함 Gram-Schmidt)로 상수·완전공선 열 드롭 → 전 파이프라인(trend/elasticity/decomp/shapley/VIF) 특이행렬 원천 차단. 드롭된 채널은 §3에서 "데이터 부족 ⊘". 추가로 `mmmTrendExistence`·`mmmElasticities`·`mmmChannelEffects`에 fit null 방어. Tinder/골든은 redundant 없어 byte-동일. (audit의 `mmmFitNamed`는 PR #85에서 이미 `_nonRedundantCols` 적용 — 같은 원리.)
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
9. **입증책임 비대칭 + non-sig≠무효과** (카니발 §4, PR #87): 관측 검정으로 "효과 없음/방어 OK"를 단정하려면 강하고 일관된 증거를 요구하고, 모호하면 기본값은 보수적(INCONCLUSIVE). p>.05 near-zero를 "효과 없음" 표로 세지 말 것(검정력 부족). 식별 불가(spend∥time 공선)면 "추정≈0"은 *증거 없음*이지 *효과 없음*이 아니므로 검정력 게이트로 긍정 판정을 차단. 임계값은 config로 분리해 결정론 유지(§9 구현 메모).

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
- **절대 기여(level) 선호하나 공선이면 불가 — 정직하게 거절+설명** (PR #91→#93): 사용자는 분해를 "그 주 지출이 만든 절대 유저"(level)로 보길 강하게 원함(centered "더했다 덜했다" 거부). 하지만 채널이 추세와 공선이면 절대 분해가 과대귀속으로 깨짐(Google +25,904 of 3,365·baseline −7,138). 이럴 땐 **사용자 요구라도 거짓 숫자를 만들지 말고, ① 왜 불가능한지 수치로 설명 ② centered+holdout 대안 제시**가 맞음(§15.6의 "honest 구현" 우선). 무작정 사용자 방식대로 구현→터무니없는 결과→재작업 루프를 피할 것. 절대 인원은 holdout(5-15)이 유일한 정답임을 명확히.

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

### 12.11 주별 기여 분해 — 3 모델 토글(기본·채널합치기·릿지) (PR #61, #91~#94)
**문제(PR #93)**: 채널이 추세와 공선이면 절대(level/$0/floor) 분해가 과대귀속으로 깨짐(β0=−7138, Google level +8825·누적 +25,904 of 3,365). centered만 무모순이나 사용자는 절대 기여를 원함. **해결(PR #94)**: `MMM_METH_STATE.decompModel` 3-way 토글, `mmmWeeklyDecomp(panel,cfg,t,lam,model)`:
- **ols**(기본): centered `β·(X−mean)`, baseline=ȳ(양수). 상대 기여(±변동). 안전 기본값.
- **merge**(채널합치기): `mmmMergedPanel`이 |corr(ln_media)|≥0.9 채널을 union-find로 합산(roi+cbua 등) → centered. 채널 간 상쇄/과대귀속 완화. **채널↔추세 공선은 못 고침**(합치기 단독으론 baseline 여전 — 그래서 centered 유지). 공선쌍 없으면 ols와 동일.
- **ridge**(릿지·절대): `mmmRidgeFit` 표준화 ridge로 과대귀속 계수 수축, **auto-λ=β0≥0 & 모든 채널 평균기여≤ȳ 최소 λ**(Tinder λ=50: baseline −7138→+304, Google +8825→+2242). LEVEL `β·X`($0 대비 절대 기여, baseline=β0≥0). 사용자가 원한 "그 주 지출이 만든 유저"를 비-absurd하게. ⚠ ridge는 biased 추정(근사) — 확정은 holdout.
- 활성 모델 분해는 `mmmGetDecomp(c)`(가벼운 메모, key=`cacheKey|target|model`)로 — 모델 토글은 분해만 재계산(무거운 파이프라인 캐시 유지). render·CSV 모두 이걸 사용. `decompModel`은 게이트 sig 제외(탐색). 표/캡션은 `d.level`로 분기(level=평균기여 signed, centered=±변동). 항등식 `baseline+Σ기여=(모델)fitted` 항상.
saturation도 **한계(+$1k) 곡선을 관측 지출 범위([floor,max])에서만**(절대 누적 b·ln(1+x)은 $0 외삽 폭발 25,904라 금지). baseline 토글(§12.18) 기본=비매체 포함.

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

### 12.20 카니발 보수적 판정 — 3-STATE + 검정력 게이트 + 채널 prior (PR #86~87, 5-18 §4)
관측 삼각검증은 **혐의를 벗기는 도구가 아니라 적색신호를 거르는 도구**다(입증책임 비대칭). 2-state "2/3 다수결"의 구멍(p>.05 near-zero를 organic 표로 셈)을 닫고 **3-STATE 투표(FOR 오가닉 / AGAINST 카니발 / ABSTAIN 보류)**로. 임계값은 `MMM_CANNIB_RULES` config(결정론 하드 규칙, LLM은 서술만). ① 시간선행성=**저지출 구간(spend≤p25)** slope 유의+누적≥10%(달력 초반 아님). ② 탈추세/차분: det&fd≥-0.10→FOR, det|fd≤-0.20→AGAINST, 사이 ABSTAIN. ③ NET: coef≥0&p<.05→FOR / ci_lo>-material→FOR(의미있는 카니발 배제) / coef<0&p<.05→AGAINST / 그 외 **ABSTAIN(non-sig≠무효과)**. **검정력 게이트**(VIF≥5 OR |corr(log-spend,t)|≥0.7 OR ③CI폭≥3×|점추정| OR n<30) 걸리면 ③ 자동 ABSTAIN + 판정 상한 INCONCLUSIVE(절대 OK 불가) — spend∥time이면 관측이 구조적으로 못 가름. **채널 prior**: 브랜드 가로채기(`mmmIsBrandIntercept`=kind brand 또는 이름 정규식 brand/asa/apple_search)는 bar=3(FOR=3 AND AGAINST=0), prospecting은 bar=2. 판정: AGAINST≥1→LEAN CANNIBAL / (FOR≥bar AND AGAINST=0 AND 게이트통과)→잠정 OK("카니발 없음" 단정 금지, "방어 가능성 높음·확정은 holdout") / else INCONCLUSIVE(기본값). 역인과(reverse_causality_risk: raw<-0.1&corr(spend,t)>0.3) 플래그로 "방어적 페이싱이면 음상관은 오가닉→광고(내생)" 경고. 골든 T6b(게이트 OK차단)·T6c(유의음→cannibal)·T6d(non-sig→ABSTAIN). 판정/투표/게이트는 채널·지표별 튜닝 가능(config). **검증=적대 워크플로 3렌즈 conforms**(결정표·게이트·prior 시나리오 실측 대조). 단일플랫폼 byte-동일(verdict만 보수화). **검정 원자료 CSV**(PR #96, `downloadMmmCannibSeriesCsv`): 사용자가 상관을 직접 재현하도록 주별 타깃·채널별 `ln(1+지출)`·탈추세 잔차(인덱스 OLS resid)·1차차분을 내보냄. §4 검정과 **동일 계산**이라 엑셀 `CORREL`로 raw/detrend/차분이 화면 값과 정확히 일치(검증: Tinder google_roi raw 0.140·detrend 0.271·diff 0.254 일치). 통계 도구는 결과뿐 아니라 **재현용 원자료 export**를 주면 신뢰↑(§9 검증가능성 선호).

### 12.19 채널별 수확체감 곡선 + 분석 결과 CSV 다운로드 (PR #85, 5-18)
- **saturation은 채널별로**: `mmmRunMmm`이 단일 `saturation`(골든 호환)에 더해 `saturationByChannel`(brand·sparse·absorbed·미포함 제외, {ln_coef, marginal_kpi_per_1k, label, recentMean}) 반환. **차트는 한계(`b/(1+x)`)가 아니라 누적 응답곡선 `b·ln(1+x)`로 그릴 것**(PR #90): 한계 hyperbola는 x→0에서 발산(b≈2448이면 2.5M)해 차트가 무용지물. 누적은 x=0→0, concave라 발산 없음 + "그 지출까지 쓰면 얻는 총 인원"으로 직관적. 선형 x축({x,y})+현지출 ◆마커. 표는 **현지출 누적기여(b·ln(1+현지출), 초록)** + 한계(+$1k) $10k/$35k/$60k 병기. **음수=회귀계수 음(데이터부실·공선 노이즈, 잠식 아님)** 캐비엇(§7 PR#62).
- **decomp/cannib CSV**: decomp는 위(actual/baseline/predict)+아래(baseline+contrib_* 누적) 두 차트 데이터 모두 포함(이미 충분). 카니발은 `downloadMmmCannibCsv`로 전 채널×삼각검증(precedence/detrend/net)+탄력성·커버리지 1행씩. effects는 `effByKey` join, 캐시 lookup만(재계산 X). 버튼은 해당 § 헤더 우측, `bindMmmMethHandlers`에서 바인딩. adstock+saturation은 decomp 채널 기여에 이미 반영(=β·(log1p(adstock(x))−mean), level-share 금지 유지).

### 12.18 baseline-anchored 누적 분해 차트 + 기여 CSV (PR #82, 5-18 §5.5)
주별 드라이버 분해를 "baseline 위에 쌓아 예측(predict)과 같이"로 보여줄 때: centered 기여(`β·(X−mean)`, §12.11 level-share 금지 유지)를 **baseline부터 차례 누적**해 line dataset마다 `fill:"-1"`(직전 누적선까지 채움) → 맨 위 누적선 = fitted(예측), 음수 기여면 띠가 내려감(그 주 끌어내림). y축 `stacked:false`(직접 누적했으므로). 실제선 흰색 overlay. 표 색 스와치는 `MMM_DECOMP_PALETTE` + `mmmDriverColor(name,groupNames)`로 차트 띠와 일치. **CSV 다운로드**(`downloadMmmDecompCsv`): week·date·actual·baseline·predict·residual + `contrib_<드라이버>`(명) + `spend_<채널>` → 사용자가 CPR(=spend/contrib) 등 직접 계산. BOM(`﻿`) 붙여 한글 엑셀 깨짐 방지, 헤더/값 콤마는 `q()`로 따옴표 이스케이프. **툴팁 함정(PR #89)**: 누적-area 차트는 dataset.data가 *누적값*이라 툴팁이 누적을 보여줘 "개별 기여로 오인→합이 predict 아님·고정처럼 보임" 혼동 유발. 해결: 각 띠 dataset에 `_indiv`(개별 기여 배열) 실어 `tooltip.callbacks.label`이 누적 대신 ±개별을, `footer`가 "baseline + 기여합 = 예측 (실제)" 항등식을 표시. 분해 수학(항등식·지출→기여 변동)은 정상 — 채널 기여는 `log1p(adstock)` 공간이라 지출 2배여도 기여는 체감(saturation), "고정처럼 보임"은 log 압축+누적 오버랩 때문이지 버그 아님(검증: 큰 지출 스윙 패널서 저지출 −225↔고지출 +225 변동 확인). **baseline 구성 토글**(PR #90, `MMM_METH_STATE.decompBaseline` mean|nonmedia): "비매체 포함"이면 baseline_t = ȳ + Σ`MMM_NONMEDIA_GROUPS`(Trend·Seasonality·Holidays·Regime) 기여로 시변, 매체 채널만 그 위에 쌓아 "광고 효과만" 봄. 항등식은 항상 ȳ+Σ(all)=fitted라 footer는 주평균 기준 그대로(검증: nonmedia baseline+매체=fitted). **centered 분해의 "$0 지출 주에 음(−) 기여" 함정**: 기여=`β·(X−mean)`이라 평균보다 적게(또는 0) 쓴 주는 음의 *상대* 기여 — "광고가 뺏음"이 아니라 "그 주가 평균보다 덜 기여"(baseline에 평균 매체수준 포함). $0→0으로 보이게 하려면 level-share(`β·ln(1+x)`)인데 §12.11 금지 → 설명으로 해소(캡션). decompBaseline은 탐색 토글이라 게이트 sig 제외.

### 12.17 방법론 도구를 임의 N채널로 일반화 (2단계: 동적 채널 → 콜맵 DnD) (PR #80·81, 5-18)
의미기반 도구(§12.13)를 고정 채널(`MMM_CHANNELS`)에서 임의 채널로 풀 때 **2단계로 안전하게**: ① **동적화** — 파이프라인 `MMM_CHANNELS`→`_mmmChans(panel)`(panel.channels=[{key,label,kind}]), Shapley 그룹·sheet lump(`kind!=="brand"`)·brand 합산을 panel 기반으로. UI 무변·결과 byte-동일(골든+validate_pipe로 보증) → 무위험 커밋. ② **콜맵 DnD** — `MMM_METH_STATE.colMap`(header→{role,kind}; role=week/reg/react/channel/dummy/platform)로 드래그앤드롭 매핑. `mmmGetPanel`은 colMap active면 그 경로, 아니면 STANDARD_FIELDS **fallback**(골든·로컬검증은 STANDARD라 그대로). 채널 key는 `_mmmSanKey(header)`(label=원본). 게이트·`checkRequiredForTool`은 해당 도구만 colMap special-case. **하드코딩 채널 키 의존 제거**: `mmmSaturation(…,"google_roi")`→panel 첫 perf 채널, `foldIntoRegime`/`combinedGoogle`은 fallback/vestigial이라 무해(라이브는 `mmmResolveAbsorb` 동적 흡수=키 무관). 검증: colMap 패널 = 수동 패널 **byte-동일**(동적 absorb 경로로 비교 — raw cfg는 foldIntoRegime fallback 타서 artifact 불일치). **부분 자동 매핑**(PR #88, #83 갱신) — 업로드 시 `mmmAutoMapPartial`이 **reg/react/채널 spend만** 강한 키워드로 자동 배치(+플랫폼·perf/brand 태그), week(t↔Week 모호)·더미·플랫폼·**파생컬럼(LN/sin/cos/Description)은 트레이에 남김**(이름 정규식 `derived`로 제외 — 파생을 채널로 오인 방지). `🪄 전부 자동 추정` 버튼은 week/더미/플랫폼까지 full guess. `mmmColMapActive`는 헤더 있으면 항상 colMap 반환(미지정만 있어도 required가 missing 처리). **플랫폼이 단일 컬럼이 아니라 wide(컬럼명에 android/ios)인 데이터**(PR #84): colMap 항목에 `plat`(common/android/ios·`mmmGuessPlat`로 이름 추정) 추가, reg/react/channel은 플랫폼별 **여러 개 허용**(week·platform-col만 단일). `mmmColMapRoles`가 배열 반환, `mmmGetPanelFromColMap`이 활성 플랫폼(`MMM_METH_STATE.platform`)으로 타깃·채널 선택(정확>공통>첫째, 더미·week 공유). 상단 플랫폼 셀렉터(태그 모드는 "전체" 없음 — 스케일 혼합 불가)로 전환하면 캐시키 `pf:` 달라져 자동 재적합(게이트 무관 — 탐색). `mmmIsTagMode`=platform-col 없고 비-common 태그 ≥1. 단일 platform 컬럼이 있으면 기존 행 필터 모드.

### 12.20 구조변화 step 일반화 — colMap step 역할 + 도구기본 가정 캐비엇 (PR #86, 5-18)
`cfg.steps={post_step:42,line_off:55}`은 **Tinder 전용 주차임계값 하드코딩 가정**(업로드 컬럼 아님). 임의 데이터에선 phantom 공선(`채널 ↔ line_off corr0.92`)으로 흡수 노티스가 혼란. 해결(Option A=byte-동일 우선): ① 세 소비처(`mmmDetectCollinear`·`mmmBuildFeatures`·`mmmSheetDesign`)를 `_mmmStepSeries(panel,cfg)`로 통일 — **panel.steps(colMap step 컬럼) 있으면 그것, 없으면 cfg.steps 주차임계값**. ② colMap에 `step` 역할 추가(`_MMM_ROLES`·`mmmColMapRoles.steps`·`mmmGetPanelFromColMap`→panel.steps, 0/1 플랫폼 공유, sheet는 panel.steps 있으면 LineOff 대체) → 사용자가 실제 구조변화 컬럼 지정 가능. ③ Config 체크박스 `disableSteps`(→`cfg.steps={}`)로 week 가정 수동 OFF(흡수·audit·feature 전부 제외, phantom 0). ④ 흡수 노티스에 캐비엇 1줄(`usingUserSteps=false && nt.step in cfg.steps`일 때만): "line_off/post_step은 도구 기본 가정·Config에서 조정". **Tinder(panel.steps 빈값→cfg.steps fallback)는 골든11/11·validate_pipe·validate_colmap byte-동일**. `cfg.steps.x` 직접 접근은 전부 `??`/`!=null`/`||`로 가드(={} 안전).

### 12.21 그랜저 인과(시차·방향) — 동시점 삼각검증 보완 ④ (PR #98, 5-18 §4)
"거의 전부 INCONCLUSIVE→홀드아웃"으로만 끝나 관측 신호가 부족하다는 불만 → **차분 VAR + 그랜저 인과 검정**을 §4 ④로 추가(동시점 ①~③이 못 보는 **시차·방향** 신호). `mmmGranger(y,x,maxLagCap)`: 두 계열 1차차분(Δy, Δln(1+x))→비정상성 제거 후, Δ타깃을 자기시차만 vs 자기시차+원인시차로 적합해 F-검정(lag는 AIC 자동선택, `REG_STATS.ols` RSS + `ibeta`로 p). 양방향(spend→organic, organic→spend) 동시 반환. 통합: `grangerCannibal`(spend→organic p<.05 & 시차계수합<0)이면 비-카니발 판정을 **LEAN CANNIBAL로 격상**(보수적·우려만↑), `pacing`(organic→spend 유의)이면 역인과 경고. **순수 추가**라 골든·validate byte-동일(verdict는 시차잠식 유의 시에만 보수화). n<24(차분 후)면 null→"데이터 부족" 생략. 골든 T6e(null가드·시차탐지·결정론). 글로서리 `granger`(4단 툴팁)+`cannib_overview` 보강. **캐비엇 필수**: 그랜저=예측 선행성이지 인과 확정 아님(빠진 공통요인·lag오류에 약함)→확정은 여전히 holdout. CSV에 granger 9컬럼 추가. 검증: 사용자 실데이터(Google ROI Android 126주) spend→organic p=0.19·신호없음으로 정직하게 나옴(결정론). **후속 검정력 개선(PR #101, 피드백 "거의 다 무의미")**: 차분(Δ)이 adstock 누적신호를 과하게 깎아 검정력↓ → `mmmGranger(...,{method})` 기본을 **prewhiten**(추세+계절[N≥60시 sin/cos52.18] 회귀 잔차 레벨, `_mmmPrewhiten`)으로 교체(method:"diff"는 호환용 보존). 공통추세(허위회귀)만 제거하고 누적신호는 남겨 더 민감. **거짓양성 검증=block-shuffle(autocorr 보존 null)이 정답**: 평범 셔플은 autocorr 파괴→15% 인플레(잘못된 null), 블록셔플(블록6)은 0/40(p<.05·.01 모두)로 잘 보정됨. Tinder Regs는 prewhiten서 lag6 시차잠식 탐지(diff는 못 잡던 진짜 신호)→LEAN CANNIBAL 격상. 코어 math(elas/shapley/sat/λ) byte-동일(granger는 verdict층 JS-only). 골든 T6e prewhiten 갱신.

### 12.22 변화점 탐지 — 추세가 "언제" 꺾였나 (데이터가 step을 찾음) (PR #99, 5-18 §3)
"거의 전부 holdout" 불만 후속(그랜저 다음 2순위 기법). 사람이 구조변화 step(42/55주)을 가정하지 말고 **데이터가 추세 꺾임 시점을 직접 찾게**. `mmmChangePoints(series,{minSeg,penaltyMult})`: 시계열 1차차분(Δ=성장률)→ 평균·분산 변화점을 **O(n²) 최적분할(optimal partitioning)**로 탐지(각 구간 Gaussian −2logL 비용 + BIC 페널티 `mult·ln N`로 과탐지 억제, 기본 minSeg=4·mult=2). 변화점 z-인덱스 s↔series 인덱스 s, `segments[i].meanGrowth`(/주)로 직전→직후 성장률 해석(반전/가속/감속). `buildMmmMethCache`에서 타깃+채널별 지출 CP 계산해 `byTarget[t].changePoints={target,spend}`에 저장(**순수 추가**→골든·validate byte-동일). §3: 표(변화시점·성장률·동기화) + STL 차트에 **인라인 플러그인**(annotation 라이브러리 없이 `afterDatasetsDraw`로 캔버스 직접 `getPixelForValue`)으로 ▲세로점선. **선행성 보조**: 오가닉 첫 상승→하락 반전 주 vs defCh 첫 증액 주 선후(오가닉 먼저=FOR 방향·광고 먼저=잠식 양립). 골든 T6f(null가드·V자반전 peak탐지·결정론). 글로서리 `changepoint`. **캐비엇**: 시점 겹침≠인과(동시 시장요인)→확정 holdout. 검증: 실데이터 Regs 변화점 [24,33,37,85,111] 결정론. **차트 캔버스 그리기는 headless 검증 불가→브라우저 확인 필요**. **후속 개선(PR #100, 피드백 "꺾임 지점만 보여주고 뭐가 튀었는지 안 보임" + "그랜저 거의 다 무의미")**: ① `mmmChangePoints`에 robust 이상치(rolling median±MAD)로 **spike(1주 이상치) vs shift(추세전환) 자동 분류**(`pointTypes`·`outliers` 추가) — 차트 ▲shift(점선)/◆spike(점선 다름)·카드도 구분. ② **드라이버 카드** `mmmChangePointDrivers(panel,target,cp,{window:4})`: 변화점 전후 ±4주 비교 — 타깃 ±%·**채널별 지출 변화(큰 순)**·동시 이벤트(더미)·이상치 여부 → "X 지출 +N% 시점에 타깃 ±M%(동반/역방향)" or "지출 변화 미미한데 타깃 급변→외부요인" 규칙 해석. `byTarget[t].changePoints.drivers`에 저장(순수 추가→byte-동일). 골든 T6g(spike 분류+드라이버). 검증: 실데이터 25주 타깃−19.5%·지출+14%(역방향)·38주 spike 정확 분류. **⚠ 함정(PR #102 핫픽스)**: `changePoints`는 `{target,spend,drivers}` 래퍼라 `points/pointTypes/segments`는 **`cp.target.*` 경유** 필수. renderMmmTrend에서 `cp.pointTypes[i]`(undefined)로 잘못 접근→변화점≥1개인 타깃(React)에서 `undefined[0]` throw→**renderMmmTrend가 navigate 중 죽어 "분석하기 무반응"**(변화점 0개인 타깃은 early-return으로 우회돼 증상이 타깃마다 갈림). **교훈: 골든은 순수함수만 검증→render throw는 안 잡힘**. render 추가 시 `/tmp` repro로 **양쪽 타깃(변화점 0개·≥1개) + 태그모드 패널** 렌더를 Chart 스텁(afterDatasetsDraw 직접 실행)으로 검증할 것. navigate가 단일 render throw에 통째로 죽는 구조라 P0.

### 12.23 식별성 단일 게이트 + confidence dot 재정의 + 전역 worst-case (PR #103, 5-18, 외부 비판 반영 Phase 1)
외부 비판: "방향은 맞는데 confidence·대표채널·gate가 identifiability와 디커플돼 잘못된 확신을 준다". 핵심 4건 동시 수정: ① **대표채널(defCh) = 최고 식별채널**(기존 `google_roi 우선/[0]`은 sparse 3/127주가 헤드라인 대표 됨 → vacuous FOR 3을 ●●●●●로 승격). 단일 식별성 게이트 `isIdentified(k)= !sparse && coverage≥0.5 && !trailingZero && !power_gate.blocked`(기존 신호 재사용 — VIF·공선·표본은 cannib power_gate가 이미 판정). defCh=식별채널 중 비-0 최다·VIF 최저, 없으면 least-bad 폴백. ② **`mmmGlobalCannib(cannibByChannel, identifiedKeys)`** = 식별채널 worst-case(cannibal>inconclusive>ok, 식별0이면 inconclusive·noIdentified). §0 헤드라인 ②·§6 종합이 이걸 사용(`mmmGlobalCannibPlain`) → §4 보수적 입증책임이 종합까지 유지(식별채널 하나라도 INCONCLUSIVE면 전역 OK 불가). ③ **confidence dot 재정의**: `mmmTrendConf`=raw가 아니라 **잔차(organic)·자기상관보정·탈계절 MK 3개 합의**(raw만 trend·잔차 no-trend면 media-confounded → ●●●○○ 이하, 만장일치+정상성만 ●●●●●). `mmmCannibConf(global)`=식별성 기반, **관측 OK 상한 ●●●○○**(무죄 증명 불가)·잠식 ●●●●○·식별0 ●○○○○. ④ `_mmmChans` 키 dedup(colMap 태그모드 중복행 버그). 검증: 합성 sparse google_roi+공선 apple → defCh=facebook·OK dot ●●○○○·식별0 ●○○○○·mixed추세 ●●●○○. 골든 17함수·validate byte-동일(defCh=google_roi 유지된 Tinder는 무변). render repro에 renderMmmSummary/Verdict 추가(§0·§6 throw 검증). **남은 Phase 2~4**(수확체감 efficiency·noise 태그 식별성기준·Shapley VIF게이트·λ경계·중복 SSOT·INCONCLUSIVE 번역)는 후속 PR.

### 12.24 5-18 2-stage 재구성 — ① 진단(잠식·추세) / ② MMM(기여·예측) + 개념 배치 (PR #104~)
사용자 요구: MMM 도구를 두 단계로 — ① 카니발·추세 진단(첨부 플로우차트식)·각 독립변수 드릴다운, ② decomp·예상증감. **개념 배치 원칙(사용자 혼동 해소)**: Lead/Lag(그랜저)=방향·시차→**진단(①)**, Adstock(잔효·carryover)·Saturation(수확체감)=기여·예산→**MMM(②)**. 구조는 **5-18 내부 2-stage 탭**(별도 도구 X — 라우팅·AUTH·colMap·캐시 공유, 내부 id 불변 §12.8). `MMM_METH_STATE.stage`(diagnose|mmm), `renderMmmStageTabs`+`data-mmm-stage` 핸들러(navigate 재렌더). body는 stage 분기: diagnose=Stage1Intro+Summary+Macro+Audit+Trend+Cannib / mmm=Stage2Intro(adstock·saturation 평어설명)+Config+MMM+Decomp+Verdict. toc도 stage별. **PR1=골격**(탭·재배치·개념 카드, render-only→골든·validate byte-동일). **PR2 예정**=카니발 플로우차트 드릴다운(채널 verdict 그리드→클릭 시 STEP0 게이트·A/B/C/D 검정·조합 펼침) + **다운로드는 활성 OS/채널만이 아니라 전 플랫폼×전 독립변수 전체**(사용자 명시). render repro에 stage 함수 3개 추가해 양 stage throw 검증. **PR2(부분, #106)**: 사용자 요구 — ① §0 ③ 채널별효과(지출+10%·+$1k·수확체감=MMM 성격)를 `renderMmmEffectsCard`로 분리해 **② MMM stage로 이관**, §0 Summary(①추세·②카니발 결론만)는 **진단 stage 맨 아래로** + "한눈에 보기→진단 결론 요약"으로 리네임. ② 카니발 §4 위에 `renderMmmCannibOverview`(verdict 버킷 4개[🔴있다/🟠못가린다/🟢없다/⊘데이터부족] + 채널×검정[STEP0·A탈추세·B선행성·C net·D그랜저·최종] 프로세스 결과 표) 추가 — 행 클릭=`data-mmm-cannibch`로 그 채널 드릴다운(기존 ①~④ 상세 재활용). 진단 stage 순서: Intro→Cannib(focus)→Trend→Macro→Audit→Summary(bottom). render-only→골든·validate byte-동일. **남은 PR2b**: 카니발 다운로드를 활성 OS/채널만이 아니라 전 플랫폼×전 독립변수 전체로.

### 12.25 식별성 게이트 과보수 완화(공선≠데이터부족) + 점수표·기준표 (PR #107, 5-18 §4, 피드백)
사용자 "거의 모든 매체가 데이터 부족·식별불가로만 나온다 — 너무 보수적". 원인: Phase 1(§12.23)의 `isIdentified`에 `!power_gate.blocked`를 넣어 **공선(spend↔time corr≥0.7·VIF≥5)이면 채널을 통째로 ⊘ 데이터부족으로 강등**. 램프업 데이터는 거의 항상 공선이라 전부 차단됨(facebook은 B=잠식·D=시차잠식인데도 묻힘). **수정**: `isIdentified`=데이터 충분성만(`!sparse && coverage≥0.5 && !trailingZero`), **power_gate 제거**. 공선은 채널을 빼지 않고 ③net만 ABSTAIN·판정 상한을 못가린다로 캡(mmmCannibalization 내부 그대로) → facebook→🔴있다, 나머지 공선→🟠못가린다, sparse만 ⊘. 안전성: power-gated 채널은 verdict가 ok가 될 수 없어(게이트로 차단) 전역 worst-case에 넣어도 거짓 OK 불가, 잠식만 surface. 표 step0=데이터충분(✓/⊘)·공선은 최종셀 `🔗공선` 태그로 별도. **+요청 2: 점수표·기준표**(`renderMmmCannibOverview`에 추가) — 프로세스 표(판정) 밑에 ① **점수 표**(채널×[B slope/p·누적, A raw→det·차분, C coef·p·CI, D lag·F·p·Σ, 게이트사유]) "그래서 어떤 숫자에서 나왔나" ② **기준표**(`MMM_CANNIB_RULES`서 동적 생성, `<details>` 접이식) "어떤 범위여야 FOR/AGAINST/ABSTAIN인가 + 게이트 임계 + 최종판정 규칙". 검증: 합성 공선·데이터충분→isIdentified true / sparse→false. 골든·validate byte-동일(render+게이트 정의만, 수학 무변).

### 12.26 §4.5 카니발 랭킹(CEI) + 적격 게이트 spec화 + Model Number 패널 (PR #108, cannibal_rank_spec, 피드백 "다 보류/데이터부족·숫자 의미 모름")
외부 spec(`cannibal_rank_spec.md`) 이식 + 사용자 보강. **순수모듈 `CANNIBAL_RANK`**(IIFE: spendCV·zFromR[Fisher-z]·twoSidedP[erfc 근사]·eligibility) + `RANK_CFG`(MIN_ACTIVE 12·MIN_DF 8·MIN_SPEND_CV 0.10·W{detrend,diff,net}=1:1:1, 상단 상수). **`mmmBuildCannibRank(panel,cannibByChannel,cov,chans)`**: 기존 §4 검정 재사용해 z2=zFromR(detrend r,n)·z2d=zFromR(diff r,n−1)·z3=net/se(게이트면 0), **CEI=Σ W·relu(−z)**(유의 음=잠식일 때만 가산, 양=증분은 0기여=무죄 아님). `byTarget[t].cannibRank` 저장(정렬: 적격→CEI desc→spendShare; Tier2→cannibSignal 우선→nActive). **적격 게이트 spec 교체**: `isIdentified`=`CANNIBAL_RANK.eligibility`(집행주≥12·CV≥0.10·df≥8) — 커버리지 휴리스틱 대체(버킷·globalCannib·defCh 일관). **render 일원화**: 기존 프로세스 표+점수 표 → **§4.5 랭킹 표 하나**(순위·판정·근거강도[강/중/약]·CEI bar·검정ABCD·탈추세r·net CI·검정력·권고). **Model Number 패널**(`renderMmmModelNumber`, 선택 채널): 지표별 [잠식 범위/무해 범위/이 채널 값/평어] — "무해(0.10)" 식. **스킵 없음**(사용자 핵심): Tier2(데이터부족)도 cannibSignal(유의 음·AGAINST·시차잠식) 있으면 ⚠로 surface(spec §3 수정). **iOS 단정 금지**(사용자 정정: iOS 탈락은 타 채널 spend 작아서일 수 있음, "렌즈 약함" 단정 X — 사실만). 검증: 골든 all green·validate byte-동일(랭킹/적격은 render+신규 모듈, 코어 math 무변). **남은**: RANK_CFG 슬라이더 UI·MDE12·전 플랫폼 다운로드(PR-C). **작성자 노트 합의**: MIN_ACTIVE/CV는 집행패턴 따라 튜닝·노출 / W 기본 1:1:1 유지(net이 공선 취약 → W.net 올리면 최악신호 증폭, 게다가 게이트 시 z3=0이라 자동으로 detrend·diff에 실림).

### 12.27 CEI 유의성 문턱 + 권고 게이트분기 + 검정요약 카운트 (PR #109, 피드백 "두 행이 똑같이 보임·애매")
피드백: 한 행은 검정 통과 패턴 다른데 둘 다 "못가린다/약/deprioritize"로 똑같이 보임. **두 버그**: ① CEI가 `relu(−z)`라 **비유의 노이즈 음(예 r=−0.125 p=0.16, z=−1.40)까지 가산** → CEI=1.40·빨간 1위인데 판정은 "약·deprioritize"(정면충돌). ② "deprioritize(증액 가능)"가 **공선(🔗) 채널에 잘못** — 공선=‘안전 확인’ 아니라 ‘못 봄’인데 증액 권고로 읽혀 위험. **수정**: ① CEI 기여=`relu(−z − 1.645)`(p<.10 유의 방향만, 노이즈→0; 검증 r=−0.125→0·−0.20→0.61·−0.25→1.20). ② `mmmCannibAction` 약 등급 게이트·방향 분기: gated→"공선·관측 식별불가, holdout 확인"(deprioritize 금지) / leanNeg(rDet≤detrendFor)→"음의 기미·검정력부족, 모니터/holdout" / 진짜 깨끗→"deprioritize 가능". ③ 검정 ABCD 글자열 → **"잠식 N·무해 M·보류 K" 카운트**(통과 패턴 한눈에). ④ 배지 약→ leanNeg면 "약·음기미"(amber)/아니면 "약(무해)"(green). 코어 math 무변(render+모듈층)→골든·validate byte-동일. **5단계 그라데이션(추가 피드백 "통과인데 못가린다·rank1≠rank3 구분 안 됨")**: 이진 "못가린다"를 `mmmCannibLevel(r)` 5단계로 — L1⊘데이터없음 / L2●적색신호없음(strict ok) / L3◐적색신호없음에 가까움(음 신호 없음·미확정=초록쪽, teal #2dd4bf) / L4◑못가리지만 신호조금(leanNeg=빨강쪽, amber) / L5●카니발(유의 음·AGAINST·CEI>0). §4.5 버킷·판정 컬럼을 5단계로. 효과: Brand raw(+0.247 비공선·brand bar3 미달)→L3(못가린다 아님), apple_search(−0.125)→L4 → rank1≠rank3 구분. §0/§6은 strict 3-state(globalCannib) 유지(다른 granularity). **⚠ 함정(PR #111)**: Model Number "해석"을 숫자에서 임계값 재계산하면 검정 요약 카운트(실제 vote)와 드리프트(예 precedence slope>0&유의=AGAINST인데 "무죄"로 오표시). **표시 해석은 반드시 실제 `cn.*.vote`에서 파생**(vread 헬퍼)해 카운트와 100% 일치시킬 것. precedence vote 규약: slope<0&유의&누적≤−10%=FOR(무죄) / slope>0&유의=AGAINST(광고 前 상승→이후 꺾임=잠식 양립) / else ABSTAIN. **선택 채널 지출 vs 타깃 이중축 차트**(PR #112): §4.5 랭킹표↔Model Number 사이에 `mmm-cannib-spend-chart` canvas — 선택 채널(`cannibChannel`/defCh) 지출(우축 #7aa2f7 fill) + 활성 타깃 실측(좌축). renderMmmCharts에서 그림(stage 무관 호출). 채널 클릭=`data-mmm-cannibch`로 전환 시 재렌더돼 차트도 갱신.

### 12.28 §4.5 마무리 배치 — RANK_CFG 라이브 + MDE12 + 전 플랫폼 다운로드 + IRF (PR #113·114·115)
사용자 "싹 가자"로 남은 4개 일괄. ① **RANK_CFG 라이브 슬라이더**(집행주·CV·df·CEI가중) — `MMM_METH_STATE.rankCfg` 오버라이드+`mmmRankCfg()` 머지, 캐시키 `rk:` 포함→변경 시 재계산·재정렬. `data-mmm-rankcfg` 핸들러. ② **MDE12**(coarse holdout 최소검출효과) — `mmmBuildCannibRank(panel,target,...)`서 타깃 12주 MDE=`√((1.96+.84)²·2·σ²/12)/mean·100`(σ=탈추세 잔차 std), 표 아래 노트·"자동 기각 금지". ③ **전 플랫폼×전 채널 다운로드**(`downloadMmmCannibAllCsv`) — 플랫폼 순회하며 `MMM_METH_STATE.platform` 세팅+`buildMmmMethCache()`(키에 pf→플랫폼별 캐시) 수집, finally 복원. 기존 로직 100% 재사용. ④ **IRF**(`mmmIRF(y,x,{horizon})`) — prewhiten 레벨 2변수 VAR(AIC lag)에 지출 +1SD 충격→오가닉 H주 반응 추적(reduced-form·spend-first). 음 누적=시차 잠식·양=시차 증분. §4 drilldown ⑤에 막대(주차반응)+선(누적) 차트(`mmm-cannib-irf-chart`). 그랜저(유의?)↔IRF(크기·지속) 보완. 골든 T6h(null·구조·결정론). 글로서리 `irf`. 검증: 실데이터 Google ROI Android 누적+654(시차 증분)·피크@5주(그랜저 신호없음과 일관). 골든 15/15·validate byte-동일. **차트 캔버스는 headless 불가→브라우저 확인**. **지출vs타깃 차트 계절·휴일 제거 토글**(PR #116·117): `mmmDeseasonHoliday(panel,target)` = 타깃~[1,t,sin/cos52.18,더미,step] OLS 후 계절(sin/cos)+휴일더미 기여의 **평균 대비 편차만** 제거(추세·레벨·step 유지). **부호 규약(사용자 명시)**: +기여(평균↑)면 빼서 내리고 −기여(평균↓)면 더해서 올림(양방향 평탄화), **base(평균) 불변**(Base 올리지 않음 — `v−(sh−mean(sh))`). `spendChartAdj` 토글. **전체 매체(Total) 토글**(PR #117): `spendChartTotal`·`data-mmm-spendtotal` — 지출선을 선택채널/전 채널 합으로. 타깃 트렌드가 개별 채널이 아니라 마케팅 전체 때문인지 확인. 골든 T6i(대칭·base보존·분산↓·결정론). 16/16. **산발(flighted) 집행 신뢰도 가드**(PR #118, 피드백 "산발 소진인데 잠식 단정 합리적?"): on/off 버스트(집행 비연속)면 저지출창(≤p25)=0지출 주가 시점 혼재→선행성 confounded(비판 H degenerate P25), 그랜저/IRF도 연속동역학 가정이라 취약. `mmmCannibalization`서 `flightTrans`(on/off 전환수)·`zeroFrac` 계산→`flighted=trans≥4&&zeroFrac≥0.2`. flighted&&p25≤0이면 **선행성 ABSTAIN**(degenerate), **그랜저 단독 LEAN CANNIBAL 격상 금지**(`&&!flighted`). rank row·Model Number·권고에 "⚡산발" 표시+"매칭 on/off·holdout 필요". 효과: facebook(52/127 산발)→AGAINST 사라지고 못가린다+⚡(과신 제거). 연속 채널(google_roi)은 flighted=false→무변(Tinder 골든 byte-동일). 골든 T6j(flighted 감지·선행성 ABSTAIN). 17/17. **⚠ leading/trailing 0주 = "데이터 없음" 제거**(PR #120, 피드백 "2025부터 넣었는데 앞쪽 0이 상승추세를 만듦"): iOS처럼 늦게 시작하는 데이터는 앞 주들이 타깃·채널 전부 0(미launch) → 그 0주를 분석에 넣으면 STL/변화점이 **가짜 상승추세**(−800→상승)를 그림. `_mmmTrimToActive(panel)` = 타깃(RR 제외)+채널 전부 0인 leading/trailing 주를 잘라 데이터 실재 범위만 사용(중간 0주는 유지). mmmGetPanel 양 경로 return에 적용. Tinder는 leading-0 없어 무변(골든·validate byte-동일). **§3 추세 CSV**(`downloadMmmTrendCsv`, PR #119)·**§4 지출vs타깃 CSV 전 채널 개별**(`downloadMmmSpendTargetCsv`: week·타깃 실측·계절휴일보정·total·채널별 spend열). **UI 정리(PR #121)**: ① §0 매핑을 분석 후 `<details>` 접기(정신없음 해소) ② Stage1Intro 설명문→제목 `?` 호버 툴팁(`mmmTip`)·로직 3카드+lead/lag→"로직 확인" 토글·좌측 패딩 ③ §4.5 판정 컬럼 긴 라벨 세로 줄바꿈→`short` 라벨+nowrap(L.short: 카니발/신호조금/거의없음/신호없음/데이터없음)·제목 옆+캡션→"랭킹 읽는 법" 토글 ④ §1 "주 인덱스 비연속 @1..@126" 폭주→mmmValidate가 1건 요약 경고(issues→warnings)·renderMmmMacro 경고목록 `<details>` 접기(Week가 날짜/연도면 흔함, 행순서 t로 분석) ⑤ 차트 x축 `c.panel.week`(날짜값→"2025" 반복)→**t=index+1**(STL·spend 차트·변화점 마커 모두). render-only→골든·validate byte-동일. **CSV/표 week 라벨 보존(PR #123, 피드백 "다운받으면 Week가 전부 2062-10-16")**: Week 컬럼이 날짜 문자열("2025-10-16")이면 `num()`의 `parseFloat`가 연도(2025)만 추출→전 주 동일값+`weekDate(2025)`≈2062 쓰레기. 수정: `mmmGetPanel`·`mmmGetPanelFromColMap`이 원본 Week 값을 `panel.weekLabel`로 보존(정렬 `re`·`_mmmTrimToActive` slice 동행), 4개 CSV(trend·spend_target·cannib_series·decomp)+spike 표 헤더를 `["week","date"]`→`["t","week"]`로 교체(t=i+1, week=`panel.weekLabel?.[i] ?? week[i]`, 가짜 `weekDate` 삭제). weekLabel은 순수 추가·표시층 전용→골든17·validate byte-동일.

### 12.29 5-18 2차 재구성 — 독립 Forecast 제거 + 3옵션 + 날짜 인식 + Trend Forecast (PR #124~)
사용자 요구: ① 독립 Regression Forecast(4-6-1, 5-17) 삭제→번호 당김 ② MMM 업로드 후 자동 분석 X, **3옵션 선택**[카니발 분석·MMM 기여 분해·Trend Forecast] ③ Trend Forecast 신규(과거 fit + 예산 시나리오 예측 + 전체 다운로드) ④ 날짜 인식(t만/week만이면 숫자 축→실제 날짜, 일/주/월 단위 감지). 예산 입력=**채널별 개별(기본=최근평균)**, horizon=**행 수 직접(기본 13)**.
- **5-17 제거(PR #124)**: IA 항목 삭제+`navigate` redirect `5-17→5-18`(북마크 보존, §12.8 내부 id 불변)+AUTH 제거+죽은 renderer 통째(§7 PR#34: page_5_17·regFc*·runRegFcTests). 표시번호 자동 당김(5-18→4-6-1·5-19→4-6-2).
- **날짜 인식(PR-A)**: colMap에 `date` 역할 추가(`_MMM_ROLES`·`mmmColMapRoles.date`·DnD 존·단일역할). 헬퍼 `_mmmParseDate`(ISO/DMY/MDY/YYYY-MM/엑셀serial→Date|null), `_mmmLooksDate`(구분자 있는 날짜만 true→순수 t는 false), `_mmmGranularity`(연속 간격 중앙값→일≤2/주≤10/월≤45/custom), `_mmmFmtDate`(월별 YYYY-MM·그 외 YY-MM-DD). `mmmGetPanelFromColMap`이 `r.date`면 `panel.dates`(Date[], `re`로 정렬)·`panel.granularity`·`panel.dateLabel` 세팅(분석은 여전히 행순서 t — date는 **표시·예측·단위환산 전용**). `_mmmTrimToActive`가 dates/dateLabel slice(+granularity 재계산). 자동매핑(`mmmGuessRole`·`mmmAutoMapPartial`)이 값이 날짜형이면 `date` 배치(순수 정수 week는 `week`). 차트 x축: `renderMmmCharts` 상단 `xlab=panel.dateLabel ?? t`로 spend·STL·fit·decomp 공유. **변화점 마커 함정**: 카테고리 축에 문자 라벨이면 `getPixelForValue(label)`이 중복라벨서 모호 → `getPixelForValue(xlab[i], i)`(index 2번째 인자)로 안전, fillText는 t-index(`i+1`)로 짧게. 검증: `validate_date.js`(주입식 — CSV_STATE 등 내부 const 접근 위해 테스트를 `code+inject`로 스코프 주입) 11/11 — date 매핑 패널 week/ch/targets가 미매핑과 **byte-동일**(date는 수학 무영향)+page_5_18/renderMmmCharts render-throw 가드. 골든17·byte-동일.
- **3옵션 + Trend Forecast(PR-B)**: `MMM_METH_STATE.stage` 기본값 `null`(분석 직후 옵션 카드)→`diagnose`(카니발 분석)/`mmm`(MMM 기여 분해)/`forecast`(Trend Forecast). `MMM_STAGE_DEFS`로 탭·카드 한 정의. `renderMmmOptionCards`(stage=null)·`renderMmmStage3Intro`·`renderMmmForecast`. `page_5_18` toc/body 4분기(null+3). stage=null이면 tocFilters·탭 숨김.
  - **forecast 엔진(`mmmForecast`)**: 관측+미래를 **이은 패널**에 동일 `mmmBuildFeatures`→관측구간 `mmmOls`/`mmmRidgeFit` 적합→미래행 예측. **OLS fitted는 컬럼 재척도/센터링에 불변**이라 결합패널 빌드해도 과거 적합=기존 MMM decomp fitted와 일치(검증 Δ<1). adstock 결합서 자연 이월·계절(Fourier 주인덱스)·추세(정규화 t) 연장. 미래 더미=0·step 영구. CI: OLS=`ŷ±t·√(σ²(1+leverage))`(XtXinv·외삽폭↑→밴드↑), ridge=±1.96σ(근사). `model`은 `decompModel`(ols/merge/ridge) 재사용.
  - **예산→spend**: `mmmGetForecast`(메모 key=cacheKey|target|model|lam|horizon|unit|budget) — 채널별 `fcBudget[sanKey]`(단위당)×`rowDays/unitDays`로 per-row 환산(미입력=최근8행평균). `rowDays`=`panel.granularity.days`(날짜 매핑) 또는 수동 `fcRowUnit`. horizon=행 수 직접(기본13). **채널 key는 `_mmmSanKey`(c_*)** — fcBudget·futSpendByKey 모두 sanKey, UI는 `data-mmm-fc-budget=ch.key`.
  - **다운로드**(`downloadMmmForecastCsv`): 메타+계수(독립변수별 coef·intercept)+계산식+시계열(과거 actual/fitted·미래 forecast/lo/hi·채널 spend). BOM+CRLF.
  - 검증 `validate_forecast.js` 23/23(구조·밴드확장·R²·fitted≈decomp·예산환산·결정론·3모델·forecast/null render·CSV throw). 골든17·date11 유지.
  - **이벤트(step)·휴일 미래 처리(PR-C, 사용자 질문)**: ⚠ `mmmBuildFeatures`는 `panel.dummy`(매핑 휴일)를 **안 씀** — 휴일은 도구 기본 `cfg.lunarWeeks`(주차번호 하드코딩)만, 매핑 더미는 §2 audit(`mmmSheetDesign`)에만. 그래서 **휴일은 forecast 미반영**(미래 주차가 cfg.lunarWeeks에 없음→0). step(LineOff류)만 모델/예측에 들어감. 사용자 결정: **step별 토글**(지속/N기간 뒤 끔), 휴일은 현재대로+캐비엇 명확. 구현: `mmmForecast`가 step 미래를 `panel.steps` 직접 연장이 아니라 **`_mmmStepSeries(panel,cfg)`로 관측 시리즈 materialize**(=비-forecast와 동일·fit 불변) 후 미래는 `stepOff[key]`(undefined=지속·N=N기간 켠 뒤 0). 이러면 cfg.steps(week-threshold) 경로도 통일 제어. `MMM_METH_STATE.fcStepOff{}` + memo key + `data-mmm-fc-stepoff` 핸들러(빈값=삭제=지속). renderMmmForecast에 step 표(현재 ON/OFF·켜둘 미래 N) + 휴일 미반영 캐비엇. fc.steps[{key,label,lastOn}] 노출. validate_forecast 27/27(step 인식·끔→예측변화·과거적합 불변·즉시끔≠N뒤끔).

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
