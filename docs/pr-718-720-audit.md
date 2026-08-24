# PR #718 · #719 · #720 감사 — 도치 결과 작업대와 사용성 점검

- **대상**: `0483f94`(#718 `fix(dochi): complete in-page analysis flow`) · `cbd1d38`(#719 `feat(dochi): 전용 결과 작업대 추가`) · `9011891`(#720 `도치 결과 매핑과 임베드 UI 정리`)
- **기준 시점**: 2026-08-24, `main` = `9011891`
- **선행 문서**: `docs/pr-714-audit.md` · `docs/pr-717-audit.md`
- **검증 상태**: `npx vitest run` → **312 파일 · 2467 통과 (1 skipped)** · `npx eslint` → **0** — green

---

## 1. 이전 지적의 후속 (#717 감사 → #718에서 처리)

| 이전 지적 | 판정 | 실측 근거 |
|---|---|---|
| N-1 오가닉인데 `cost > 0`인 720행 | **해소** | `source: ci===2` 제거, 오가닉을 **비용 0인 별도 90행**으로 분리. 모순 행 **0건** |
| N-2 `too_many_observations` 안내 부재 | **해소** | `eligibilityMessage()` 신설, `tooManyObservations`/`tooManyPredictors` KO·EN 두 패널 모두 |
| N-3 RF 실행 불가 구간(p ≥ 51) | **해소** | `maxPredictors: 40` 추가 → 하한 최대 800 < 상한 1,000 |
| N-4 5-28 세그먼트 무신호 | **해소** | `channelRisk [15,70,35]` → 채널 **χ²=12.595, p=0.0018** |
| N-5② 핸드오프 클릭 시 블로킹 | **해소** | `deferHandoff()` 더블 rAF + "상세 분석 화면을 준비하고 있습니다" |
| (#714) 도치 4.65초 강제 대기 | **해소** | 여정 애니메이션·`sessionStorage` 핸드오프 제거, 업로드 즉시 이동 |

5-28 데모 세그먼트 실측(기간 모드, valid=108 · 이벤트 54 · 절단 54):

| 세그먼트 | 그룹별 n / 이벤트 | log-rank |
|---|---|---|
| `channel` | Organic 36/9 · Meta 36/30 · ASA 36/15 | χ²=12.595 **p=0.0018** |
| `event_type` | 36/19 · 36/19 · 36/16 | χ²=0.250 p=0.883 |
| `campaign_name` | 54/28 · 54/26 | χ²=0.547 p=0.459 |

한 축은 유의, 두 축은 무유의 — 데모에서 **판정 문구 두 종류를 모두** 체험할 수 있게 됐다. 의도한 개선이 실제로 값에 반영됐다.

---

## 2. 새 구조 요약 (#719 · #720)

```
홈(/)  ──DochiAssistant──▶ CSV 업로드 ──▶ /dochi-result
                                            ├─ 1단계: 매핑 확인   (부족하면 "도치가 매핑 보완하기" → 2단계)
                                            ├─ 2단계: "확인하고 결과 가져오기" → 1.85초 애니메이션
                                            └─ 결과: 5-2 · 5-21 · 5-22 · 5-3 을 아코디언으로 임베드

/start ──CsvUploader──▶ AssistantWorkspace (19개 카탈로그 자격 판정 · 큐 실행 · 결정 테이프)
```

`routeMap`에 `{ id:"dochi-result", publication:"preview" }`로 등록돼 sitemap·색인에서 제외된다(적절).

---

## 3. 사용성 관점 발견

### A (P1). 도치 경로가 "효율 4종"에 하드코딩돼 있어, 맞지 않는 CSV도 그대로 통과한다

`DochiResultWorkspace.jsx`의 `TOOL_VIEWS`는 **업로드한 데이터와 무관하게** 5-2·5-21·5-22·5-3 고정이다. 실측(생존 분석용 CSV를 도치에 올린 경우):

```
1단계 버튼: "도치가 매핑 보완하기"      disabled=false
2단계 버튼: "확인하고 결과 가져오기"     disabled=false      ← 그대로 통과
phase: running → results,  efficiency 분석 게이트: true
결과 화면: 운영 대시보드 / 캠페인 성과 변동 / 캠페인 포화도 진단 / 예산 배분 시뮬레이터
```

각 도구를 실제 렌더해 보면 **크래시는 없고 정직하게 비어 있다**(§8 준수):

| 도구 | 생존 CSV로 열었을 때 |
|---|---|
| 5-2 | "⚠ 이 도구가 필요로 하는 필수 컬럼이 매핑되지 않았습니다" |
| 5-21 | "데이터 부족 · 날짜 데이터가 없습니다 · 분석 가능한 데이터가 없습니다" |
| 5-22 | 셸만 렌더, 결과 없음 |
| 5-3 | "CPI 현재 CSV에 이 지표가 없습니다" |

문제는 **네 번 실패를 보여 주면서 정답을 한 번도 알려 주지 않는다**는 점이다. 이 CSV의 정답은 5-28(핵심 액션 생존·이탈)이고, 그것을 판정할 수 있는 `AssistantWorkspace`(19개 도구 자격 판정)는 이 경로에서 **아예 호출되지 않는다**. 홈 업로드가 사실상 기본 진입점이 된 지금, 효율 CSV가 아닌 사용자는 도구를 못 찾는다.

**제안**: 결과 단계 진입 전에 `evaluateAnalysisEligibility`(이미 있는 함수)로 4종의 자격을 판정해 ① 전부 blocked면 결과 대신 "이 데이터에 맞는 분석" 추천 카드를 보여 주거나 ② `TOOL_VIEWS`를 자격 통과 도구로 채운다. 최소한 결과 화면 하단에 `/start`(분석 지도) 링크는 있어야 한다.

### B (P1). 도치 인테이크가 한국어 홈에만 있다

- `app/(ko)/[[...slug]]/PageClient.jsx:90` → `{routeId === "home" && <><LandingPage /><DochiAssistant /></>}`
- `app/(en)/en/page.js:43` → `<LandingPage locale="en" />` 만. **DochiAssistant 없음.**

그런데 `/en/dochi-result`는 라우트로 존재하고(`hasEnVersion`에 `dochi-result` 추가됨) EN 카피까지 다 작성돼 있다. 즉 **EN 사용자는 도달할 수 없는 화면에 EN 번역만 갖춰 둔 상태**다. AGENTS §2.11(외부 노출 KR/EN 동시 반영) 위반이며, EN에서는 새 진입 흐름 자체가 없다.

### C (P1). 뒤로가기로 돌아오면 결과가 사라진다 (무주소 게이트)

`DochiResultWorkspace`의 `phase`는 `useState("mapping")`이고 URL에 없다. 결과 화면에서 "해당 분석으로 가기 ↗"를 눌러 도구로 이동한 뒤 브라우저 뒤로가기를 하면 `/dochi-result`가 **매핑 확인 단계부터 다시** 시작한다(1.85초 애니메이션까지 재생). 결과로 돌아오는 링크는 사이드바·⌘K·푸터 어디에도 없다.

AGENTS §12.28의 **"무주소 게이트 금지 — 상태로만 존재하는 화면은 뒤로가기가 깨짐"** 에 정확히 해당한다. `?stage=results` 같은 쿼리나, 이미 게이트가 열려 있으면 결과 단계로 바로 진입하는 파생 조건이 필요하다.

### D (P2). 매핑 확인 버튼이 필수 컬럼이 비어 있어도 활성이다

`CsvUploader.jsx:856`

```js
const analysisBlocked = missing.length === 0 && (dataEligibility?.status === "blocked" || mappingBlocked || semanticBlocked);
```

`analysisBlocked`는 정의상 **"필수 매핑은 다 됐는데 다른 이유로 막힌" 상태**만 참이다. 그런데 매핑 리뷰 확인 버튼은 이 값만 본다:

```js
disabled={!shouldOfferSemanticFallback && analysisBlocked}
… if (isSemanticFallbackStage) { if (!analysisBlocked) onMappingReviewConfirmed?.(); }
```

→ **필수 컬럼이 없을 때(`missing.length > 0`)는 오히려 버튼이 활성**이고 그대로 결과 단계로 넘어간다(위 A의 실측이 이 경로였다). 다른 화면의 "분석하기"는 `hasRequiredMapping = missing.length === 0 && !analysisBlocked`를 쓰므로 판정 기준이 서로 다르다. 확인 버튼도 같은 파생값을 쓰는 게 맞다.

### E (P2). 임베드된 도구가 각자 페이지 셸을 그린다 — h1 중복 + 컨트롤 4중 노출

- `ToolPageShell`의 기본 `titleLevel = 1`. `Dashboard`·`CampaignPvm`·`MarketingEfficiency`는 이 값을 넘기지 않아 **아코디언마다 `<h1>`을 그린다.** (`BudgetAllocation`만 `titleLevel={2}`로 넘긴다 — 패턴은 이미 있는데 이 경로에 적용되지 않았다.) 결과 페이지 자체 h1까지 합치면 한 문서에 h1이 최대 4개다.
- 각 도구를 직접 렌더해 보면 본문에 **"분석 범위 · 세그먼트 · 성과 기준 · 표시 통화"** 컨트롤 바와 **"데이터·매핑 — 변경하기 / ⟳ CSV 변경"** 블록이 각각 포함된다. 네 개를 모두 펼치면 같은 전역 컨트롤이 4벌 쌓인다.
- #720이 상단의 중복 매핑 표를 하나로 합친 것과 같은 문제가 **아코디언 안쪽에 그대로 남아 있다.**

임베드용 프리셋(`titleLevel={2}` + 컨트롤·매핑 블록 숨김)이 필요하다.

### F (P2). `dochi-result`가 `TOOL_GROUP`에 없다 — 지금은 폴백 덕에 우연히 동작한다

`DochiResultWorkspace`는 `setGroupAnalyzed("dochi-result")`로 분석 게이트를 연다. 그런데

```js
export const groupForRoute = (id) => TOOL_GROUP[id] || FALLBACK_DATA_GROUP;  // = "efficiency"
```

`dochi-result`는 `TOOL_GROUP`에 없어 폴백(`efficiency`)으로 떨어지고, 마침 임베드 도구가 전부 efficiency 그룹이라 **결과적으로 맞는다.** `toolGroups.js`의 주석은 폴백을 "csvData를 절대 쓰지 않는 홈·가이드 라우트용"이라고 못박고 있는데, 이 라우트는 CSV를 읽고 게이트까지 쓴다. AGENTS §7의 **"CSV를 쓰는 라우트는 도구가 아니어도 `TOOL_GROUP`에 등록"**(PR #603→#604 사고) 규칙에 어긋난다. 임베드 도구가 다른 그룹으로 바뀌는 순간 조용히 깨진다.

### G (P2). `/start`의 도치 도착 경로가 통째로 죽었다

`DochiAssistant`가 `DOCHI_HANDOFF_KEY`를 더 이상 쓰지 않는다(#719). 저장소 전체에서 이 키를 **쓰는 곳이 없다**. 그런데 `StartGate.jsx`에는 그대로 남아 있다:

- `:81` `sessionStorage.getItem(DOCHI_HANDOFF_KEY)` — 항상 `null`
- `:71` `isDochiArrival` — 영원히 `false`
- `:135` `<DochiArrivalTransition active={isDochiArrival} />` — **도달 불가**
- `:151` `autoStart={isDochiArrival || mappingCoachPhase !== "hidden"}` — 앞 항은 죽은 조건

`DochiHandoffMotion.jsx`의 `DochiArrivalTransition`도 이제 아무도 쓰지 않는다(`DochiChartBundle`만 결과 화면에서 쓰인다). AGENTS §15 "죽은 코드를 전제한 규칙은 발견 즉시 제거" 대상.

### H (P2). `presentation="embedded"` 모드는 자기 테스트만 소비한다

#718이 `AssistantWorkspace`에 임베드 표현 모드(`presentation="embedded"`, `embeddedRunning` 카피 KO/EN, `dochi-workspace__embedded-result` 스타일)를 추가했는데, 30분 뒤 #719가 도치 경로를 **직접 도구 임베드**로 바꾸면서 소비처가 사라졌다. 현재 이 prop을 넘기는 코드는 `AssistantWorkspace.smoke.test.jsx:138` 한 줄뿐이다 — 제품에 없는 경로를 테스트가 살려 두고 있다.

### I (P2). 오가닉 분리의 부작용 3가지 (효율 데모)

N-1 수정으로 오가닉 90행이 추가되면서 공유 효율 데모의 축이 바뀌었다:

```
Google UAC        rows=540 cost=592,271,171 installs=485,322 CPI=1,220 (paid)
Meta AAP          rows=540 cost=592,415,417 installs=257,139 CPI=2,304 (paid)
TikTok            rows=540 cost=590,996,664 installs=830,418 CPI=  712 (paid)
Apple Search Ads  rows=540 cost=587,838,254 installs=171,669 CPI=3,424 (paid)
Organic Search    rows= 90 cost=          0 installs= 11,709 CPI=    0 (organic)
platform 값: Android, iOS, Organic
```

1. **`platform: "Organic"`** — OS 컬럼에 OS가 아닌 값이 들어가 5-2의 "플랫폼(OS)" 필터가 3개가 된다.
2. **CPI 0원 채널** — 효율 표·스코어카드에서 "가장 싼 채널"로 정렬될 수 있다.
3. **5-21 PVM에 전부 0인 행** — 실측 렌더에서 `Organic Search 0원 → 0원 … 💡+0원`이 채널 표에 남는다. 5-3은 `cost>0 & result>0` 필터로 곡선에서 제외하지만 **채널 필터 목록에는 그대로 노출**된다(선택하면 "유효한 데이터 없음").

오가닉 자체는 남기되 채널/플랫폼 값과 표시 규칙(0원 채널은 효율 순위에서 제외)을 정리하는 편이 낫다.

### J (P3). 결과 로딩 문구가 한국어로 하드코딩됐다

`DochiResultWorkspace.jsx:14`

```js
const Loading = () => <p className="dochi-result-loading">결과 화면을 여는 중…</p>;
```

EN 사용자에게도 이 문장이 그대로 나온다. 같은 파일의 나머지 카피는 전부 KO/EN이 갖춰져 있어 이 한 줄만 어긋난다(§2.11).

### K (P3). 인위적 대기 1.85초가 다시 들어왔다

홈의 4.65초를 없앤 대신 결과 진입에 `setTimeout(…, 1850)`이 생겼다(모션 축소 설정이면 0). 계산이 끝났는데 애니메이션 때문에 기다리는 구조는 동일하다. 실제 계산 시간과 무관하게 고정값이라, 임베드 도구가 무거워지면 "1.85초 애니메이션 → 그 다음 진짜 로딩"으로 두 번 기다리게 된다.

### L (P3). 새 화면의 스모크가 실제 결과를 검증하지 않는다

`DochiResultWorkspace.smoke.test.jsx`는 `CsvUploader`와 4개 도구를 **전부 목킹**한다(`원본 대시보드` 같은 더미로 대체). 그래서 위 A·D(잘못된 grain이 통과하고 결과가 비는 것)는 테스트를 통과한다. 감사에서 진짜 컴포넌트로 렌더해 보고서야 드러났다 — §7의 "셋업이 진입 경로를 우회한다"와 같은 계열이다.

---

## 4. 문제 없음으로 확인한 것

- 도치 실패 복구(#717)는 새 구조에서도 유지된다(`onImportFailed` → `phase = "welcome"`).
- 데이터 없이 `/dochi-result`에 직접 들어가면 결과를 지어내지 않고 "먼저 도치에게 CSV를 맡겨 주세요" + 홈 링크를 준다.
- 효율 CSV로 올린 경우 **버튼 한 번**으로 매핑 확인 → 결과까지 도달하고, 4개 도구가 모두 실제 수치를 렌더한다(대시보드 6,987자 · PVM 5,864자 · 포화도 4,947자 · 예산배분 6,531자 상당).
- 임베드 도구는 `next/dynamic` + 아코디언 지연 마운트라 처음에는 5-2만 계산된다.
- `publication: "preview"`로 sitemap·색인에서 제외된다.
- `#720`의 2단계 매핑(의미 기반 보완을 같은 표에 투영)은 화면을 하나만 유지한다는 목표를 실제로 달성했다.
- 전체 스위트 312파일·2467 통과, eslint 0.

---

## 5. 권고 순서

1. **A** 도치 결과를 데이터 자격 판정과 연결(최소한 "이 데이터에 맞는 분석" 안내)
2. **D** 확인 버튼을 `missing.length === 0 && !analysisBlocked`로 통일
3. **C** 결과 단계를 URL에 반영해 뒤로가기 복구
4. **B** EN 홈에 도치 배치(또는 EN 라우트를 KR과 동시에 노출)
5. **E** 임베드 프리셋(`titleLevel=2` + 컨트롤·매핑 숨김)
6. **F/G/H** 그룹 등록 · 죽은 핸드오프 경로 제거 · 임베드 모드 정리
7. **I/J/K/L** 데모 축 정리 · EN 문구 · 대기 시간 · 실제 렌더 스모크

---

*이 문서는 감사 결과만 담는다. 코드 수정은 포함되어 있지 않다.*
