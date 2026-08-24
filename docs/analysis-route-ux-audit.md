# 유저 분석 루트 UX 감사 (방법론 + 실행 로그)

> **목적**: 사용자가 "데이터를 올려 판단을 얻고 다시 돌아오기"까지의 **한 줄기 경로**를 반복 가능한 방식으로 감사한다.
> **대상**: 진입(`/`·`/start`·`/diagnose`·사이드바) → 업로드 → 매핑 → 분석 게이트 → 결과 → 다음 행동 → 재방문(`/weekly-review`).
> **`docs/automateaudit.md`와의 차이**: 그쪽 단위는 **표면(surface)**이라 콘텐츠·SEO·라우트 커버리지에 강하고 도구 안쪽을 못 본다. 이 문서의 단위는 **여정 단계(stage)**다. 같은 도구를 여러 번 보는 대신, **한 사람이 한 번에 지나가는 순서**로 본다 — 이음매(단계와 단계 사이)에서만 보이는 결함이 있기 때문이다.
> **원칙**: 발견은 **파일:줄 또는 실측 수치**를 남긴다(§8 정직성). 근거 없는 인상 비평은 기록하지 않는다.

---

## 0. 이 문서의 사용법

| 상황 | 할 일 |
|---|---|
| 정기 감사 | §3 스윕 전부 실행 → §5에 새 실행 로그 추가 → §6 갱신 |
| 도구 1개 추가/변경 후 | R1·R2·R6만 부분 실행(배선 누락이 여기서 잡힌다) |
| 발견 항목 수정 완료 | §6 상태를 `해결`로 바꾸고 PR 번호 기재. **원 발견 문장과 수치는 지우지 않는다** |

이 문서는 **감사 기록이지 실행 계획이 아니다.** 수정은 별도 PR로 하고 결과만 반영한다.

---

## 1. 감사 단위 — 여정 단계 × 이탈 조건

```
S1 진입     어떤 분석이 필요한지 모르는 사람이 도착
S2 업로드   파일을 고르고 읽히기까지
S3 매핑     컬럼이 무슨 뜻인지 합의하기까지
S4 게이트   "분석하기"를 누르고 결과가 그려지기까지
S5 결과     결론을 읽고 믿기까지
S6 다음     이 결과 다음에 무엇을 할지 정하기까지
S7 재방문   다음 주에 다시 올 이유가 생기기까지
```

각 단계는 **세 가지 조건**에서 본다. 해피패스는 이미 여러 번 검증됐고, 이탈은 나머지에 산다.

| 조건 | 뜻 |
|---|---|
| `정상` | 계약을 만족하는 데이터로 통과 |
| `부족` | 컬럼·기간·행이 모자람 → 화면이 **정직하게 막는가** |
| `이음매` | 앞 단계에서 넘어온 상태를 뒤 단계가 **그대로 이어받는가** |

**이음매가 이 감사의 핵심이다.** 단계별로 보면 전부 멀쩡한데 이어 붙이면 끊기는 자리 — 추천은 A라 했는데 도구는 빈 화면, 카피는 흐리게 표시한다는데 실제로는 안 흐려짐, 다음 단계 카드를 눌렀더니 재업로드 — 가 실제 이탈 지점이다.

**샘플링**: 19개 발행 도구 전수로 보는 것은 `이음매`뿐이다(스윕으로 자동화 가능). `정상`·`부족`은 대표 3개(5-2 대시보드 · 5-18-mmm 최대 복잡도 · 5-27 최신 도구)만 손으로 본다.

---

## 2. 렌즈 (J1~J6) — 판정 기준을 문장으로 먼저 고정

### J1. 경로 연속성 (S1↔S2↔S4↔S6)
- 추천 화면이 "이걸 하세요"라고 한 도구를 열면 **그 상태 그대로** 이어지는가(재업로드·재매핑·재클릭 없이)
- 같은 행동에 두 개의 진입 경로가 있을 때 **결과 상태가 같은가**
- 결과 화면의 "다음 단계"가 **지금 가진 데이터로 갈 수 있는 곳인가**

### J2. 약속과 구현의 일치 (전 단계)
- 화면이 말하는 동작이 코드에 실제로 있는가 — **카피가 기능보다 앞서 있으면 그 자체가 버그다**(§2.8)
- 버튼 이름이 실제 일어나는 일과 같은가("분석 시작"인데 분석이 안 시작되면 어긋난 것)
- 데모/실데이터 상태 표기가 결과의 출처와 일치하는가

### J3. 막힘의 정직성 (`부족` 조건)
- 못 하는 이유가 **무엇을 더 주면 되는지**까지 말하는가
- 계산 불가를 좋은 등급(문제 없음·1.0·0)으로 접지 않는가
- 빈 화면이 "안내 없는 빈 화면"이 아닌가 — 안내·템플릿·예시 3종이 있는가

### J4. 대기와 반응 (S4)
- 무거운 계산 전에 **화면이 먼저 반응하는가**(스피너/오버레이 페인트 후 계산)
- 누른 것이 먹었는지 알 수 있는가(멈춤 vs 분석 중의 구분)

### J5. 배선 커버리지 (전 단계)
- 단계 부품(안내·게이트·결론 카드·다운로드·결정 기록·다음 단계)이 **발행 도구 전수**에 붙어 있는가
- 목록이 **파생인가 손으로 쓴 배열인가** — 손배열이면 그 자체를 결함으로 집계한다(§7)
- 소비처 0인 부품이 있는가(죽은 화면은 유지비만 남기고 사용자에게 도달하지 않는다)

### J6. 재방문 루프 (S5→S7)
- 결과에서 **판단을 기록**할 수 있는가, 그 기록이 다음 주에 다시 열리는가
- 재방문 비용(재업로드)을 무엇으로 갚아 주는가
- 루프의 진입점이 화면에 실제로 있는가

---

## 3. 재실행 가능한 스윕

`v2-migration/`에서 실행한다. 수치가 바뀌면 §5에 새 로그를 남긴다.

### R1. 다음 단계의 데이터 연속성 (J1)
```bash
node -e "
const fs=require('fs');
const gm=[...fs.readFileSync('src/lib/toolGroups.js','utf8').matchAll(/\"([0-9a-z-]+)\":\s*\"([a-z_]+)\"/g)].reduce((o,m)=>(o[m[1]]=m[2],o),{});
const t=fs.readFileSync('src/lib/toolConnections.js','utf8');
const b=t.slice(t.indexOf('NEXT_TOOL_IDS'),t.indexOf('};',t.indexOf('NEXT_TOOL_IDS')));
let same=0,cross=0,dead=[];
for(const m of b.matchAll(/\"([0-9a-z-]+)\":\s*\[([^\]]+)\]/g)){
  const from=m[1], ids=m[2].match(/\"[0-9a-z-]+\"/g).map(x=>x.replace(/\"/g,''));
  ids.forEach(n=>gm[from]===gm[n]?same++:cross++);
  if(!ids.slice(0,2).some(n=>gm[from]===gm[n])) dead.push(from);
}
console.log('같은 CSV로 이어짐:',same,'| 재업로드 필요:',cross);
console.log('상단 카드 2장이 모두 재업로드인 도구:',dead.length,dead.join(' '));"
```
판정: 상단 카드 2장이 모두 재업로드인 도구 = 0 목표. `ToolConnections`가 `slice(0,2)`로 자르므로 **순서가 곧 계약**이다.

### R2. 단계 부품 배선 커버리지 (J5)
```bash
for c in CsvGuide ResultActionCard DownloadHub ToolPageOutro AnalyzingOverlay; do
  echo "$c: $(grep -rl "$c" src/components --include=*.jsx | grep -v '\.test\.' | grep -v "/$c.jsx" | wc -l)"
done
grep -oE '^\s{2}"?[0-9a-z-]+"?:' src/utils/toolGuide.js | tr -d ' ":' | sort -u | tr '\n' ' '; echo
```
판정: `TOOL_GUIDE` 키 집합이 발행 라우트에서 **파생**되는가. 손으로 쓴 맵이면 새 도구가 조용히 빠진다.

### R3. 죽은 부품 (J5)
```bash
for f in $(ls src/components/**/*.jsx src/components/*.jsx 2>/dev/null | grep -v '\.test\.'); do
  n=$(basename $f .jsx)
  u=$(grep -rl "$n" src --include=*.jsx --include=*.js | grep -v '\.test\.' | grep -v "/$n.jsx" | wc -l)
  [ "$u" = 0 ] && echo "orphan: $f"
done
```
판정: orphan 0. **자기 스모크 테스트만 있는 컴포넌트는 통과 상태로 죽어 있다** — 테스트가 컴포넌트를 직접 렌더하므로 마운트 여부와 무관하게 초록이다.

### R4. 임포트 경로 파편화 (J3·정직성)
```bash
grep -rln 'type="file"' src/components/tools src/components/*.jsx | grep -v '\.test\.'
grep -rn "assertCsvFileSize\|decodeCsvBuffer" src/components --include=*.jsx | grep -v '\.test\.'
```
판정: 자체 `type="file"`을 가진 화면 전부가 공용 가드(크기 상한·CP949 복원)를 **함께** 쓰는가.

### R5. 분석 중 피드백 (J4)
```bash
for f in src/components/tools/*.jsx src/components/Dashboard.jsx; do case "$f" in *test*) continue;; esac
  printf "%-38s overlay=%s useMemo=%s lines=%s\n" "$(basename $f)" \
    "$(grep -c AnalyzingOverlay $f)" "$(grep -c useMemo $f)" "$(wc -l < $f)"; done
```
판정: `useMemo` 10개 이상 또는 2,000줄 이상인 도구에 오버레이가 없으면 후보로 올린다.

### R6. 자격 판정 엔진 정합 (J1·J2)
```bash
node -e "
const fs=require('fs');
const s=fs.readFileSync('src/lib/analysis-router/evaluateEligibility.js','utf8');
const i=s.indexOf('ANALYSIS_CONTRACTS = {'), j=s.indexOf('\n};',i);
const a=[...s.slice(i,j).matchAll(/^\s{2}\"([0-9a-z-]+)\":/gm)].map(m=>m[1]);
const b=[...new Set([...fs.readFileSync('src/lib/assistant/analysisCatalog.js','utf8').matchAll(/\"((?:5|9)-[0-9a-z-]+)\"/g)].map(m=>m[1]))];
console.log('router:',a.length,'| catalog:',b.length);
console.log('catalog에만:',b.filter(x=>!a.includes(x)).join(' '));
console.log('router에만:',a.filter(x=>!b.includes(x)).join(' '));"
```
판정: 두 집합이 같아야 한다. 다르면 **추천 화면과 도구 화면이 서로 다른 기준으로 막는다.**

### R7. 결정 기록 루프 커버리지 (J6)
```bash
grep -rn "decisionPrefill=" src/components --include=*.jsx | grep -v '\.test\.' | grep -v 'ds/' | wc -l
grep -rln "ResultActionCard" src/components/tools src/components/Dashboard.jsx | grep -v '\.test\.' | wc -l
```
판정: 결론 카드를 쓰는 화면 수와 `decisionPrefill`을 넘기는 화면 수가 같아야 한다(의도적 예외는 코드에 사유 주석).

---

## 4. 발견 기록 스키마

```
ID · 단계 · 렌즈 · 증상(1문장) · 증거등급 · 근거(파일:줄/수치) · 사용자에게 일어나는 일 · 심각도
```
**증거등급**: `측정`(스윕 수치) · `관찰`(코드 직접 확인) · `추론`(판단, 실데이터 없음)
**심각도**: `P0` 거짓 숫자·프라이버시·화면 깨짐 / `P1` 경로 단절·이탈 / `P2` 이해비용·일관성 / `P3` 다듬기

---

## 5. 실행 로그

### 2026-08-24 · 1차 (정적 감사)

**기준 커밋**: `main` `477dbbe`(내부 브랜드 마크 통일 #728).
**범위**: R1~R7 전 스윕 + S1~S7 경로 코드 추적(진입 3면 · 업로드 7경로 · 19개 발행 도구 배선).
**미수행**: 라이브 브라우저 확인, 실기기 모바일, GA4 실데이터, `npm run test:all`·`lint`·`build`. → 이 컨테이너에 `node_modules`가 없어 스위트를 돌리지 못했다. **문서만 바뀌므로 게이트에 영향은 없으나, 아래 판정 중 "테스트가 초록이다"에 의존하는 문장은 쓰지 않았다.**

#### 5.1 통과 항목 (기록해야 신뢰가 쌓인다)

| 단계 | 확인 내용 | 근거 |
|---|---|---|
| S4 | 분석 게이트가 그룹 스코프 단일 소스. 매핑 변경 → 시그 변화 → 자동 숨김 | `CsvUploader.jsx:264-265`, `useDataStore.js` `isGroupAnalyzed` |
| S3 | 5-18 다섯 subtool의 필수·옵션 필드가 허브에서 **파생** | `csvConstants.js:1732-1735` |
| S5 | 결과와 참고 영역의 경계 소유자가 하나 | `ToolPageOutro.jsx:44-48` |
| S5 | h1 단일성 — `ToolIntro`가 h1을 쓰는 도구는 `ToolPageShell`을 `titleLevel={0|2}`로 낮춤 | `MulticollinearityChecker.jsx:104`, `AsaKeywordFinder.jsx:62`, `AsoStoreConversion.jsx:219`, `BudgetAllocation.jsx:1633` |
| S6 | 다음 단계 카드가 재업로드 여부를 **화면에 명시**(`같은 CSV로 이어보기` / `새 데이터 준비`) | `ToolConnections.jsx:79-81` |
| S7 | 데모 데이터에서는 결정 기록 루프를 숨긴다(가짜 판단 기록 방지) | `ds/ResultActionCard.jsx:144` |
| S2 | 공용 업로더가 CP949 복원·파일 크기 상한·워커 파싱·XLSX 시트 선택을 모두 가짐 | `CsvUploader.jsx:415-446` |
| S1 | 못 쓰는 도구를 숨기지 않고 목록에 남김(존재는 알 수 있음) | `ds/ToolIndex.jsx:41-46` |

#### 5.2 발견 항목

| ID | 단계 | 렌즈 | 증상 | 등급 | 근거 | 사용자에게 일어나는 일 | 심각도 |
|---|---|---|---|---|---|---|---|
| **U1** | S5·S7 | J5 | **`ToolAssistRail`이 전 도구 페이지에서 언마운트됨 — 소비처 0.** PR #712가 KO/EN `PageClient` 양쪽에서 제거했는데 **같은 커밋이 컴포넌트 본체 122줄을 수정**했다. 413줄 + 자체 스모크 테스트가 그대로 남아 있다 | 측정 | R3. `git show 3e91d76`가 두 PageClient에서 `<ToolAssistRail …>` 제거. 참조: 자기 테스트뿐 | 도구 화면에서 **"지난 결정 검토" 진입점이 사라졌다.** 결정 루프의 진입은 이제 Header·Footer·랜딩뿐이고, **판단을 내리는 바로 그 화면**에는 없다 | **P1** |
| **U2** | S6 | J1 | **결과→다음 분석 링크 57개 중 41개(72%)가 다른 CSV 그룹.** 상단에 보이는 카드는 2장뿐인데(`slice(0,2)`), 그 2장이 **모두 재업로드**인 도구가 19개 중 10개 | 측정 | R1. `toolConnections.js:163-185` vs `toolGroups.js`. 해당 도구: 9-6·5-4·5-23·5-24·5-25·5-26·5-27·5-28·5-20·9-1 | 결과를 다 읽고 "다음"을 누르면 빈 업로드 화면. 절반 이상의 도구에서 **여정이 사실상 여기서 끝난다** | **P1** |
| **U3** | S2 | J3 | **공용 임포트 가드(`assertCsvFileSize`·`decodeCsvBuffer`)의 소비처가 `CsvUploader` 한 곳.** 자체 드롭존을 가진 6개 화면은 둘 다 없다 | 측정 | R4. `CsvUploader.jsx:419,430` / 자체 입력: `AhaMomentFinder`·`BrandCampaignIncrementality`·`ContentElementAnalyzer`·`Incrementality`·`PaidOrganicTrend`·`StoreEventLog` | 한국 Excel 기본 CSV(CP949)를 5-20·5-23·5-24·9-1에 올리면 **헤더가 깨진 채 파싱은 "성공"**해 매핑이 전멸한다(§7이 이미 기록한 함정이 가드 밖에서 재발). 과대 파일은 탭이 죽고 `error.js`가 못 잡는다 | **P1** |
| **U4** | S1 | J2 | **`/start` 카피가 없는 기능을 약속한다.** 업로드 후 데크가 "지금 바로 되는 분석을 진하게 표시했습니다. 흐린 것은 컬럼이 더 필요합니다"라고 말하지만, `ToolIndex`에 `eligibleIds={null}`을 **하드코딩**해 아무것도 흐려지지 않는다 | 관찰 | `StartGate.jsx:29`(카피) vs `StartGate.jsx:191`(전달값). `ToolIndex.jsx:43`이 `!eligibleIds`면 전부 ready 처리 | 17개가 전부 똑같이 진하게 보인다. 사용자는 **"내 파일로 다 된다"고 읽고** 아무 도구나 눌러 빈 화면을 만난다. 배선은 `AssistantWorkspace`의 `onEligibilityChange`(미사용 prop)가 이미 준비돼 있다 | **P1** |
| **U5** | S4 | J4 | **분석 중 피드백이 19개 중 2개 도구에만 있다.** `AnalyzingOverlay` 소비처 = 5-20·5-18 계열뿐 | 측정 | R5. `BudgetAllocation` useMemo 29·3,354줄 / `CreativeAnalyzer` 1,873줄 / `CampaignPvm` 1,764줄 — 전부 오버레이 0 | 대용량 CSV에서 "분석하기"를 누르면 **메인 스레드가 멈춘 채 아무 표시가 없다.** §4.4가 요구하는 "멈춤→분석 중" 전환이 대부분의 도구에 없다 | **P1** |
| **U6** | S1→S4 | J1·J2 | **같은 도치에서 출발하는 두 핸드오프의 결과 상태가 다르다.** `/start` 추천 카드는 `markAnalyzed:false`, 도구 화면의 도치 독은 기본값 `true` | 관찰 | `StartGate.jsx`(`openRecommended` → `{markAnalyzed:false}`) vs `DochiAnalysisDock.jsx`(`handoffCsvToRoute(toolId, prepared)`) | 추천 카드로 가면 결과가 안 보이고 **"데이터 분석하기"를 한 번 더** 눌러야 한다(버튼 이름은 "분석 시작"이었다). 독으로 가면 바로 결과가 뜬다. 같은 캐릭터·같은 행동인데 결과가 갈린다 | P2 |
| **U7** | S1↔S4 | J1 | **자격 판정 엔진이 둘이고 커버리지가 다르다.** `analysisCatalog`(추천 화면) 19개 vs `ANALYSIS_CONTRACTS`(도구 화면 게이트) 15개 | 측정 | R6. 차집합 = `5-18-trend`·`5-18-paid-organic`·`5-18-cannibal`·`5-18-forecast` | 이 네 도구는 도구 화면에서 **최소 행·기간 게이트가 아예 적용되지 않는다**(`CsvUploader.jsx`의 `dataEligibility`가 null). 추천 화면은 막는데 직접 들어가면 통과하는 비대칭 | P2 |
| **U8** | S2 | J3·J5 | **`TOOL_GUIDE`가 파생이 아니라 손으로 쓴 맵**이라 승격된 5-18 subtool 5개가 빠졌다. 그중 `5-18-paid-organic`은 자체 id로 `CsvGuide`를 부르므로 **null 반환** | 측정 | R2. `toolGuide.js` 키 목록에 `5-18-*` 없음. `ds/CsvGuide.jsx:64` `if (!guide) return null`. 나머지 넷은 `MarketingResponse.jsx:3423`이 `"5-18"`을 하드코딩해 우연히 살았다 | 발행 도구 하나의 빈 화면에 **컬럼 안내·템플릿·예시 실행이 전부 없다.** §7이 9-6에서 기록한 사고와 같은 형태다 | P2 |
| **U9** | S7 | J6 | **결론 카드를 쓰면서 결정 기록을 넘기지 않는 도구 2개** — 5-27(ASO)·5-18-paid-organic(후자는 `decisionReview={false}` 명시) | 측정 | R7. `AsoStoreConversion.jsx:237`은 `decisionPrefill` 없이 `ResultActionCard` 렌더 | 5-27은 결론까지 읽고도 **다음 주에 확인할 판단을 남길 수 없다**(사유 주석도 없어 결정인지 누락인지 코드로 구분 불가) | P2 |
| **U10** | S1 | J5 | **`AnalysisEligibilityList`가 죽은 화면**(소비처 0, 67줄). 11개 도구의 "얻게 되는 답" KR/EN 카피가 화면에 도달하지 않는다 | 측정 | R3. PR #712에서 `AssistantWorkspace`로 교체되며 마운트 해제 | 사용자 영향은 없지만 **잘 쓰인 카피 자산이 사장**됐고, 다음 사람이 살아 있는 코드로 오해한다 | P2 |
| **U11** | S5 | J5 | `CUSTOM_TOOL_INTRO_IDS`에 `5-28`이 있으나 `ToolIntro`의 `INTRO` 맵에 항목이 없어 조용히 null | 관찰 | `PageClient.jsx:48` vs `ToolIntro.jsx`(5-28 키 없음) | 5-28만 도구 소개 문단 없이 열린다 | P3 |

#### 5.3 U1·U10 상세 — "가드가 초록인데 화면엔 없다"

두 컴포넌트를 참조하는 프로덕션 코드는 0이고, **참조하는 파일은 자기 스모크 테스트뿐이다.** 스모크 테스트는 컴포넌트를 직접 `render()`하므로 어디에도 마운트되지 않아도 영원히 통과한다. §7의 *"가드가 있다는 사실이 가드가 없다는 사실을 가린다"*가 **컴포넌트 단위에서 재발한 사례**다.

교훈: 스모크 테스트는 "이 컴포넌트가 렌더된다"를 검사하지 "이 컴포넌트가 사용된다"를 검사하지 않는다. 화면에 있어야 하는 부품은 **라우트 디스패치에서 파생한 마운트 검사**가 따로 필요하다(R3을 테스트로 승격).

---

## 6. 우선순위 백로그

우선순위 = (사용자 영향 × 심각도) ÷ 난이도. 전부 고치려는 목록은 감사 문서의 사망 원인이므로 상위만 실행 후보로 둔다.

| 순위 | 항목 | 이유 | 난이도 | 상태 |
|---|---|---|---|---|
| 1 | **U4** `/start`에 `eligibleIds` 실제 배선 | 카피가 이미 약속한 것을 지키는 일. `onEligibilityChange`가 준비돼 있어 렌더층 소규모 | S | 미착수 |
| 2 | **U8** `TOOL_GUIDE`를 발행 라우트에서 파생 + 누락 5건 채우기 | 빈 화면 안내 0인 도구 제거. 다음 도구 추가 때 자동 방지 | S | 미착수 |
| 3 | **U6** 두 핸드오프의 `markAnalyzed` 통일 + 버튼 이름을 실제 동작에 맞추기 | 한 줄 수정으로 "분석 시작인데 분석이 안 됨" 제거 | S | 미착수 |
| 4 | **U1** 결정 검토 진입점을 도구 화면에 복구(레일 재마운트 또는 결론 카드 내 통합) | 재방문 루프가 판단 지점에서 끊겨 있다. **어느 쪽으로 복구할지는 사용자 판단 필요** | M | 미착수 |
| 5 | **U2** `NEXT_TOOL_IDS` 순서를 같은 그룹 우선으로 정렬 + R1을 테스트로 고정 | 데이터는 그대로 두고 **정렬만** 바꿔도 상단 2장의 연속성이 올라간다. 같은 그룹이 없는 도구는 템플릿 준비 카드를 상단으로 | M | 미착수 |
| 6 | **U3** 자체 드롭존 6곳을 공용 가드 경유로 | CP949·크기 상한은 조용한 데이터 손실. 다만 6개 화면 각각의 파싱 흐름이 달라 분할 필요 | M | 미착수 |
| 7 | **U5** 무거운 도구에 `AnalyzingOverlay` + 더블 rAF 디퍼 | 체감 품질 직결. 도구마다 계산 진입점이 달라 한 번에 못 함 — 5-3·5-21·9-6 순 | L | 미착수 |
| 8 | **U7** 자격 엔진 커버리지 정합(둘 중 하나를 파생으로) | 두 엔진을 합칠지 한쪽을 파생시킬지는 설계 결정 | M | 보류 |
| 9 | **U9·U11** 결정 기록·소개 문단 누락 | 예외면 사유 주석, 누락이면 채움 | S | 미착수 |
| — | **U10** 죽은 컴포넌트 처리 | 지우기 전 `AnalysisEligibilityList`의 "얻게 되는 답" 카피 11건을 `AssistantWorkspace`로 옮길지 결정 필요 | S | 판단 보류 |

---

## 7. 측정으로 승격해야 할 것 (현재 `추론`)

정적 감사로 답할 수 없는 질문. 이걸 채우기 전에는 "이렇게 하면 좋아진다"고 단정하지 않는다.

| 질문 | 필요한 데이터 | 단계 |
|---|---|---|
| 업로드 후 실제로 몇 %가 "분석하기"까지 가는가 | GA4 `data_import_*` → `analysis_started` 퍼널 | S2~S4 |
| 다음 단계 카드의 클릭률과, 그중 재업로드 화면에서의 이탈률 | `tool_connection_pick`의 `data_continuity` 분해 | S6 |
| U5의 멈춤이 실제로 얼마나 긴가 | 실기기 프로파일링(행 수 × 도구) | S4 |
| 결정 기록 사용자의 4주 재방문율 | GA4 재방문 + 결정 기록 이벤트 | S7 |
| 새로고침으로 CSV를 잃는 사람이 얼마나 되는가 | 세션당 업로드 횟수 분포 | S2 |

**마지막 항목 주의**: 비영속(§2.2 클라이언트 전용)은 결함이 아니라 결정이다. 감사에서 "저장하자"는 처방을 내지 않는다. 다만 **재업로드 비용을 무엇으로 갚는지**(매핑 기억·시트 재조회)는 J6의 검토 대상이다.

---

## 8. 이번 감사에서 하지 않은 것

- 수학 엔진 확인 — 골든이 오라클이며 이 감사의 대상이 아니다(§2.1)
- `docs/automateaudit.md`가 이미 다룬 콘텐츠·SEO·구조화 데이터 — 중복 발견은 기록하지 않는다
- 실기기 모바일·라이브 브라우저 — `추론` 등급으로 남긴다
- 코드 수정 — 발견만 남기고 수정은 별도 PR로 한다

---

*근거 수치는 2026-08-24 `477dbbe` 기준. 재실행 시 §3을 돌리고 §5에 새 로그를 추가한다. 과거 로그와 수치는 수정하지 않고 아래에 이어 붙인다.*
