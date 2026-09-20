# 2026-09-20 감사 — 오늘 머지 9건 리뷰 + AI·크롤러 봇 대응

작성 2026-09-20 · 역할: 감사(AGENTS.md §6.2) · 대상 `main` @ `efaaa4b`
검증 환경: 이 저장소 로컬 실행. **`npm run test:all` 4258 passed / `npm run lint` 0 / `npm run build` 성공** (전부 직접 실행함)

이 문서는 두 부분이다.
- **Part 1** — 오늘 머지된 9건의 코드 리뷰와 확인된 문제
- **Part 2** — AI·크롤러 봇 유입 대응 (Part 1 조사 중 드러난 구조적 원인 포함)

두 부분은 한 지점에서 만난다: **catch-all 라우트가 요청마다 서버 렌더된다**는 사실이 봇 부하의 유력한 원인이자, 차단 없이 해소 가능한 유일한 지점이다(Part 2 §1.1).

---

# Part 1 — 오늘 머지 9건 리뷰

## 1.0 대상

| PR | 내용 | 규모 |
|---|---|---|
| #895 | 프로젝트 리뷰 흐름 + NICEPAY 전환 준비 | 90파일 +1662 |
| #896 | 결정 피드백·보고서 근거 | 40파일 +636 |
| #897 | 도구별 목표 복구·홀드아웃 연결 | 27파일 +392 |
| #898 | 운영 목표 ↔ 실험 효과 근거 분리 | 13파일 +122 |
| #899 | 결정·근거·후속 행동 흐름 | 45파일 +522 |
| #900 | 전환 중 기존 거래 보존 | 13파일 +351 |
| #902 | 결제 흐름·추가 결제수단 | 20파일 +295 |
| #903 | 무료 분석 → 보고서/검토 연결 | 10파일 +108 |
| #904 | 3주차 사례 + 24초 튜토리얼 | 77파일 +670 |

---

## 1.1 P1 — 계정 보관 시 오늘 추가한 결정 필드가 통째로 사라진다

**위치** `src/lib/account/archiveContract.js:10` (`ARCHIVE_FIELDS`)

스키마는 v11 → v15로 올라가며 7개 필드가 추가됐는데 `ARCHIVE_FIELDS`는 오늘 하루도 갱신되지 않았다.

**재현** (임시 테스트로 실행, 출력 그대로):

```
LOST >>> reviewPlan, evidence, parentDecisionId, closureReason,
         targetActual, effectEvidence, episodes, effectSourceId

MISSING_FROM_ARCHIVE >>> sourcePath, dataOrigin, locale, episodes, evidence,
  parentDecisionId, reviewPlan, targetActual, effectEvidence, effectSourceId,
  closureReason, comparisonKind, forecastPeriod, forecastTarget,
  forecastPlatform, forecastValue, forecastLower, forecastUpper,
  forecastSourceThrough, comparisonWindowDays, comparisonScope,
  datasetSnapshot, reviewQuestion, sourcePeriod, reviewedAt,
  createdAt, updatedAt
```

`DECISION_REVIEW_SAFE_FIELDS` 기준 27개가 `ARCHIVE_FIELDS` 밖이다. `episodes`는 v11부터 이미 빠져 있었고, 오늘 7개가 더 늘었다.

**영향**
1. 계정에만 있는 결정(`onDevice:false`)을 목록에서 열면 검토 계획·근거·부모/자식 링크·종료 사유가 없는 기록이 된다. `DecisionFollowUp`·`DecisionPlanReview`·스코어러가 전부 "계획 없음"으로 읽는다.
2. 더 나쁜 것 — **#895가 오늘 새로 넣은 충돌 감지가 구조적으로 눈이 멀었다.** `DecisionHistoryList.jsx`의 rows memo는

   ```js
   const conflict = remote && JSON.stringify(archiveMemo(record)) !== JSON.stringify(archiveMemo(remote));
   ```

   로 기기↔계정 차이를 보는데, `archiveMemo`가 벗겨내는 필드의 차이는 **정의상 감지할 수 없다**.

**성격** AGENTS.md §7 "신호를 만들었으면 읽는 화면을 같은 작업에서 배선한다"의 재발. 두 목록이 각자 관리되므로 **파생이나 정합 테스트가 답이다** — `DECISION_REVIEW_SAFE_FIELDS`와 `ARCHIVE_FIELDS`의 의도적 차집합을 사유와 함께 고정할 것.

---

## 1.2 P1 — 예측 결정에 수치 목표를 넣으면 자동 예측 대조가 조용히 꺼진다

**위치** `src/lib/decisionReview.js:537` (#898)

`needsExplicitPlanReview`가 **`forecast_actual` 검사보다 앞에** 들어갔다.

**재현**:

```
MODE >>> rerun_manual | without plan: forecast_auto
```

**도달 경로** `src/components/ds/DecisionReview.jsx:726`이 "수치 목표·실험 설계 설정" 접기를 `comparisonKind`와 무관하게 렌더한다. 5-18-forecast 결정에서 목표값을 한 번 입력하면 그 결정은 영영 수동 재분석 대상이 되고, **화면은 아무 말도 하지 않는다.**

**의도인지 사고인지 코드만으로 판별 불가**:
- `WeeklyReview.jsx:686`은 `!isForecastReview && !record.reviewPlan`으로 둘을 **배타 취급**한다 → 팀이 인지하고 있다는 신호
- 그런데 `decisionReview.js`의 바로 아래 주석은 여전히 **예측 계약이 이긴다**고 적혀 있다 → 주석이 코드와 어긋남

의도라면 폼에서 막고 사유를 화면에 쓸 것. 사고라면 순서를 되돌릴 것. 어느 쪽이든 **주석을 사실에 맞춰야 한다**(§7 "사유 주석이 사실인지도 확인할 것").

---

## 1.3 P2 — 보고서에 "— → —"가 찍힌다 (가드가 값이 아니라 키 존재를 본다)

**위치** `src/lib/weekly-review/reportDraft.js:223` `absoluteMetricEvidence`

`Object.hasOwn(item, "currentValue")`로 판단하는데, 호출부(`:84`)는 `metrics`가 truthy면 값이 `undefined`여도 키를 항상 만든다:

```js
...(metrics ? { previousValue: metrics.previous?.[kpiName], currentValue: metrics.current?.[kpiName], currency } : {}),
```

**재현**:

```
REPORT >>> ■ 성과 |   cpa — → — · -0.12
```

`formatReviewMetric`이 비유한 값에 `—`를 돌려주므로 거짓 숫자는 아니지만, 보고서에 의미 없는 대시 쌍이 남는다. `Number.isFinite` 양쪽 검사가 맞다.

**도달성** `review.metrics`와 `routing.kpi`가 어긋날 때. 실사용 재현은 하지 못했다 — 가드의 판정 대상이 틀렸다는 것까지가 확인된 사실이다.

---

## 1.4 P2 — `DECISION_REVIEW_SCHEMA_VERSION`이 하루에 11→15인데 소비처가 0

**위치** `src/lib/decisionReview.js:18`

전 코드베이스에서 이 상수를 읽는 런타임 코드가 없다. 유일한 독자가 `src/lib/decisionEpisodes.test.js:34`의 `expect(DECISION_REVIEW_SCHEMA_VERSION).toBe(15)`다.

§7의 두 패턴이 겹친다:
- **신호를 만들고 읽는 곳을 안 배선** — 버전이 아무 동작도 바꾸지 않는다
- **가드가 근거가 아니라 지금 값을 고정** — 버전을 올릴 때 테스트도 같이 고쳐질 뿐, 지키는 것이 없다

저장 레코드에 세대 표식도 찍히지 않으므로, §7이 요구하는 "저장 레코드에 세대를 적고 구세대는 파일을 살리되 굳은 해석만 버린다"가 **지금 구조로는 불가능하다**. 워크스페이스 데이터셋(`WORKSPACE_DATASET_SCHEMA_VERSION`)은 그 패턴을 이미 지키고 있으므로, 형제를 그대로 따르면 된다.

---

## 1.5 P2 — 새 파일 중 직·간접 테스트 0건

| 파일 | 비고 |
|---|---|
| `src/app/api/payments/nicepay/webhook/route.js` | **결제 취소·입금 확인이 지나는 경로** |
| `src/components/ds/DecisionPlanFields.jsx` | 1.2의 도달 경로를 만드는 폼 |
| `src/components/weekly-review/DecisionPlanReview.jsx` | |
| `src/components/weekly-review/EvidenceCompatibility.jsx` | |
| `src/lib/decisionClosure.js` | |

(`DecisionFollowUp`·`nicepayMethods`·`reviewEvidenceMatch` 등은 다른 테스트가 간접적으로 import해 커버된다. 위 5개는 전수 grep에서 0건.)

---

## 1.6 P3 — 튜토리얼 런처가 측정용 transform을 지우지 않는다

**위치** `src/components/VideoTutorialHelp.jsx:33`

`launcher.style.transform`을 6단계 측정 루프에 쓰는데, cleanup(`:65`)은 `data-obscures-control`만 지운다. 비활성화 시 `translateY(-320px)`로 뜬 채 남을 수 있다.

부수적으로 body 변이마다 최대 6회 강제 reflow + `elementsFromPoint` 격자 탐색이 돈다. rAF 스로틀은 걸려 있고, MutationObserver가 `attributes`를 보지 않으므로 **자기 유발 루프는 없다**(확인함).

---

## 1.7 P3 — 기타

- `v2-migration/public/tutorials` mp4가 8MB → **24MB**(18개). git 이력·배포 번들 용량.
- `SubscriptionCheckout.jsx` `pay()`의 nicepay 분기가 리다이렉트 전에 `finally setBusy(false)`로 결제 버튼을 다시 연다(Toss 분기는 `await`라 해당 없음).
- `decisionGoals.js`의 `toolId === "weekly-review" ? "5-2"` 별칭이 두 함수에 각각 하드코딩됐다.

---

## 1.8 검증 못 한 것 — 라이브 전 외부 스펙 대조 필요

코드만으로는 판정 불가이고, 틀리면 **실결제가 걸린다**.

1. `nicepayServer.js:70` — `nicepay("/netcancel", { orderId })`의 바디가 `orderId`인지 `tid`인지
2. `normalizeNicepayPayment`의 `supported`는 `naverpay`인데 요청 옵션 id는 `naverpayCard` — 응답 `payMethod` 값 체계 확인
3. nicepay webhook 라우트가 `request.json()`으로 받는다. NICEPAY가 form-urlencoded로 보내면 조용히 실패한다 — **return 라우트는 form으로 받고 있어 비대칭이다**

---

## 1.9 잘된 점 (되돌리지 말 것)

- **GA4 `source` → `interaction_source`** — GA4 예약 차원과의 충돌을 전송 경계에서만 바꾸고 내부 계약은 유지. `docs/ga4-product-events.md:138`에 "과거 기록은 소급 복구되지 않는다"까지 명시.
- **`reportAdded`를 로컬 state → 스토어 파생**(`ResultActionCard.jsx:142`) — 실제 초안과 일치할 때만 표시. `reportBlockFromResultCard`에 타임스탬프가 없고 `addReportBlock`이 블록을 그대로 저장함을 확인해, 딥 비교가 항상 어긋나지 않는 것까지 검증함.
- **튜토리얼 길이를 파생으로** — 하드코딩 "36초"가 영상 재촬영에 따라 거짓말하던 자리를 `steps.length * TUTORIAL_STEP_SECONDS`로.
- **결제 전환 설계** — 발급된 주문은 원래 provider로 마감(`assertProviderOrder`), 불확실 응답에 절대 접근권 부여 안 함, 신규 체크아웃을 닫아도 복원·취소 웹훅은 계속 동작, 읽기 전용 트랜잭션 점검기.
- **§8 정직성** — 효과 근거 미연결 시 "운영 목표 도달 여부로 카니발 유무를 판정하지 않음", `decisionObservationRows`의 "관측 변화량 (인과효과 아님)", 블로그 사례를 "합성 CSV"로 명시.

---

## 1.10 권장 조치 순서

1. **P1 두 건(1.1 `ARCHIVE_FIELDS`, 1.2 예측 대조 우선순위)만 별도 PR로 먼저.** 데이터 유실과 계약 역전이라 나머지와 성격이 다르다.
2. 1.2는 **고치기 전에 의도 확인이 필요하다** — 주석과 코드가 반대를 말하고 있다.
3. 1.3~1.7은 묶어서.
4. 1.8은 코드 수정이 아니라 **NICEPAY 문서 대조**. 라이브 전환 전에 반드시.

---
---

# Part 2 — AI·크롤러 봇 대응

대상 `growthoptplaybook.com` (Railway, Next 16.3.4)
근거: 이 저장소 코드 실측 + `npm run build` 출력. **서버 로그는 보지 못했다**(§2.9).

## 2.0 결론 먼저

1. **현재 봇 방어선은 0이다.** `robots.txt`는 전면 허용이고, 엣지 레이트리밋도 UA 필터도 없다. 앱 레이트리밋은 결제 API 3종에만 걸려 있다.
2. **가장 큰 비용은 차단이 아니라 렌더 방식에 있다.** 홈·도구 20개·가이드 15개를 담당하는 catch-all 라우트가 **요청마다 서버 렌더(ƒ)** 된다. 봇 1회 방문 = Railway 컨테이너 CPU 1회. 정적화하면 **아무도 차단하지 않고** 봇 부하가 자릿수로 떨어진다.
3. **전면 차단은 이 제품에서 손해다.** `llms.txt`·AEO 답변·FAQ JSON-LD는 전부 "AI 검색이 인용하게 하려고" 만든 자산이다(AGENTS.md §12.29). AI 봇을 뭉뚱그려 막으면 그 투자를 스스로 지운다.
4. **"느낌"을 숫자로 바꾸기 전에 차단부터 하면 안 된다.** 지금은 봇 비중을 확인할 수단 자체가 없다.

권장 순서: **L0 정적화 → 측정 → L1 robots.txt 선별 → L2 엣지 → (필요시) L3 앱 레이트리밋**

---

## 2.1 실측한 현재 상태

| 항목 | 실측 결과 | 위치 |
|---|---|---|
| robots.txt | `User-agent: * / Allow: /` 전면 허용 | `src/app/robots.js` |
| robots 정책 가드 | "AI·학습 봇을 구분하지 않는 현재 정책을 **의도적으로** 고정" | `src/app/robots.test.js:10` |
| 엣지 프록시 | 존재함(호스트 정규화·noindex 전용). 봇 처리 없음 | `src/proxy.js` |
| 레이트리밋 | 결제 API만(`order` 30/분, 그 외 120/분, IP는 HMAC 해시·미저장) | `src/lib/subscription/paymentRequestLimit.js` |
| 보안 헤더 | XFO·CSP frame-ancestors·nosniff·HSTS. 봇과 무관 | `next.config.mjs:54` |
| AI 안내 파일 | `llms.txt` 제공 중 (도구·블로그·용어 전량 색인) | `src/app/llms.txt/route.js` |
| API 크롤 | 결제·계정 API **22개가 크롤 대상에 열려 있다**(`/api/` disallow 없음) | — |

### 2.1.1 진짜 비용 지점 — catch-all이 동적 렌더다

`npm run build` 출력 기준:

```
├ ƒ /[[...slug]]        ← KO 전체 (홈·도구·가이드·/start·/weekly-review·/compare 인덱스)
├ ƒ /en/[...slug]       ← EN 전체
├ ● /blog/[slug]        ← 정적(generateStaticParams 있음)
├ ● /glossary/[slug]    ← 정적
├ ● /templates/[slug]   ← 정적
```

`generateStaticParams`를 가진 라우트는 6종(blog·glossary·templates·compare·calculator·tag, KO/EN)뿐이고 **catch-all 둘에는 없다**(SSG 페이지 33개). 즉:

- 블로그·용어(가장 많이 긁히는 콘텐츠)는 이미 정적이라 크롤링이 싸다.
- 반면 **도구 20개·가이드 15개·홈**은 봇이 긁을 때마다 `getAllPosts`·`getAllTerms`·`buildGuideEvidenceLinks` 같은 fs+조립 작업이 서버에서 돈다.

**이것이 "봇이 많이 들어오는 느낌"의 가장 유력한 물리적 근거다.** 같은 봇 트래픽이라도 정적 라우트면 체감되지 않는다.

> ⚠ 정적화가 간단한지는 별도 확인이 필요하다. catch-all이 동적인 이유를 코드로 확정하지 못했다 — `export const dynamic` 선언도, `headers()`/`cookies()` 사용도 페이지 상단에서는 안 보인다. `generateStaticParams` 부재가 이유라면 라우트 목록을 `routeMap.ROUTES`에서 파생해 넣는 것만으로 해결된다.

### 2.1.2 GA4로는 봇을 볼 수 없다

GA4·GTM은 `isAnalyticsHost()` 뒤에서 **클라이언트 gtag**로만 발화한다(`src/lib/analyticsHost.js`). JS를 실행하지 않는 크롤러는 GA4에 애초에 찍히지 않는다.

- GA4에서 봇처럼 보이는 트래픽을 봤다면 → **JS를 실행하는 헤드리스 브라우저**(= 더 공격적인 스크래퍼)이거나, 봇이 아니다.
- GA4가 조용하다고 봇이 없는 게 아니다. 대부분의 크롤러는 GA4 밖에서 서버만 두드린다.

---

## 2.2 측정 먼저 — 무엇을 어디서 보나

차단 설정 전에 아래를 확보한다. **하나도 없으면 무엇을 막았는지, 막아서 나아졌는지 영영 알 수 없다.**

| 신호 | 어디서 | 무엇을 본다 |
|---|---|---|
| 서버 실히트 | Railway 로그 (`Deployments → Logs`) | UA별 요청 수, 상위 경로, 상태코드. 봇 비중의 **유일한 1차 근거** |
| 검색엔진 크롤 | Search Console → 설정 → 크롤링 통계 | Googlebot 크롤 요청 추이·응답시간. 급증하면 사이트가 아니라 색인 쪽 문제 |
| 리소스 | Railway Metrics (CPU/메모리) | 트래픽 급증과 CPU 급증의 시점 일치 여부 |

Railway 로그는 보존 기간이 짧다. **24시간 창으로 UA 상위 20개를 표로 뽑아 이 문서에 붙일 것.** 그래야 이후 조치의 before/after가 생긴다.

판정 기준(제안):
- 상위 UA가 `Googlebot`/`bingbot` 위주 → 정상. 조치 불필요.
- `Bytespider`·`ClaudeBot`·`GPTBot`·`CCBot`·`SemrushBot`·`AhrefsBot`이 상위 → §2.3 선별 대응.
- UA가 `python-requests`/`axios`/빈 문자열/무작위 크롬 버전이고 한 IP대역에서 몰림 → 남용. §2.4 L2.

---

## 2.3 봇을 세 갈래로 가른다

한 덩어리로 막으면 매출 경로를 같이 끊는다.

### A. 인용해 주는 AI 검색 — **막으면 손해**
`OAI-SearchBot`(ChatGPT 검색), `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `Claude-SearchBot`, `Claude-User`

AGENTS.md §12.29가 만든 AEO 자산(도구별 `question`/`answer`, FAQ JSON-LD, `llms.txt`, `/compare`)이 노리는 대상이 정확히 이들이다. 차단 = 그 작업을 되돌리는 것.

### B. 학습 데이터 수집 — **정책 결정 사항**
`GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`, `Applebot-Extended`, `meta-externalagent`, `Amazonbot`, `Bytespider`, `cohere-ai`, `Diffbot`, `omgili`, `ImagesiftBot`

콘텐츠가 학습에 쓰이는 대가로 돌아오는 트래픽은 없다. 다만 **차단한다고 AI 검색 노출이 줄지 않는다** — A와 B는 별도 UA다.

> `Google-Extended`는 **Gemini 학습 opt-out 토큰이지 Google 검색 색인과 무관**하다. `Applebot-Extended`도 같다(`Applebot` 본체는 Siri/Spotlight 검색용). 이 둘을 막아도 AI Overviews에서 사라지지 않는다.
>
> ⚠ 벤더 토큰 이름과 의미는 자주 바뀐다. **적용 전 각 벤더 문서에서 재확인할 것.** 이 목록은 2026-09 시점 기준이며 이 문서가 SSOT가 아니다.

### C. 남용 스크래퍼 — **막는 게 맞다**
UA 위장, robots.txt 무시, 동일 IP대역 고빈도. `Bytespider`는 B로 분류했지만 robots 무시 사례가 잦아 실무상 C로 다루는 경우가 많다.

SEO 도구 봇(`AhrefsBot`, `SemrushBot`, `MJ12bot`, `DataForSeoBot`)은 AI와 무관하지만 **크롤 볼륨은 가장 크다**. 자사 SEO 분석에 이 도구들을 쓰지 않는다면 막아도 잃을 게 없다.

---

## 2.4 대응 4계층

효과 대비 비용 순. **위에서부터 하는 게 맞다.**

### L0. 정적화 — 차단 없이 봇 비용을 없앤다 · 효과 최상 · AEO 손실 0

```js
// src/app/(ko)/[[...slug]]/page.js
import { ROUTES, isRouteIndexable } from "@/lib/routeMap";

// 목록을 손으로 쓰지 말 것 — routeMap이 SSOT다(AGENTS.md §4.1).
export function generateStaticParams() {
  return ROUTES.filter(isRouteIndexable).map(route => ({
    slug: route.slug === "/" ? [] : route.slug.replace(/^\//, "").split("/"),
  }));
}
```

- **효과**: 해당 경로가 정적 서빙이 된다. 봇이든 사람이든 Railway CPU에서 사라진다.
- **리스크**: catch-all이 동적인 **진짜 이유를 먼저 확정**해야 한다. 런타임 분기가 있다면 정적화가 화면을 깨뜨린다.
- **검증**: `npm run build`에서 `ƒ /[[...slug]]` → `●` 전환, SSG 페이지 수 증가(현재 33). 그리고 `test:all` + e2e.

**이 한 건이 나머지 셋을 합친 것보다 효과가 클 가능성이 높다.** 실사용자 응답속도에도 같이 듣는다.

### L1. robots.txt 선별 — 비용 0 · 효과 "예의 바른 봇"에만

```js
// src/app/robots.js
import { SITE_URL } from "@/lib/routeMap";

// A(인용하는 AI 검색)와 검색엔진은 그대로 허용한다 — AEO 자산이 그들을 노린다.
// 학습 전용 수집과 대량 SEO 크롤러만 거절한다.
const TRAINING_ONLY = ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended",
  "Applebot-Extended", "meta-externalagent", "Amazonbot", "Bytespider",
  "cohere-ai", "Diffbot", "omgili", "ImagesiftBot"];
const SEO_CRAWLERS = ["AhrefsBot", "SemrushBot", "MJ12bot", "DataForSeoBot"];

export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      { userAgent: [...TRAINING_ONLY, ...SEO_CRAWLERS], disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
```

- **`src/app/robots.test.js`가 현재 정책을 명시적으로 고정하고 있으므로 같이 고쳐야 한다.** 그 테스트를 "값 고정"이 아니라 **"A군은 항상 허용 / `/api/`는 항상 disallow"라는 근거**를 단언하도록 재작성할 것(§7 — Part 1 §1.4와 같은 교훈).
- **한계**: robots.txt는 요청이지 강제력이 아니다. C군은 애초에 안 읽는다. **서버 부하는 그대로다.**
- `/api/` disallow는 §2.1의 API 22개 노출을 함께 닫는다.

### L2. 엣지 차단 — 유일하게 부하를 **도달 전에** 없앤다

**선행 확인: 도메인이 Cloudflare를 거치는지 모른다.** (이 세션 네트워크 프록시가 403으로 막아 확인 불가.) Railway 단독이면 앞단 WAF가 없다.

**Cloudflare를 쓰고 있다면** (무료 플랜 포함):
- `Security → Bots → Block AI bots` 원클릭 토글. 다만 **A/B 구분 없이 묶어 막을 수 있으니** 문구를 확인하고, AEO를 지키려면 이걸 쓰지 말고 아래 Rule로 직접 고를 것.
- `WAF → Custom rules`: `(http.user_agent contains "Bytespider") or (...)` → Block. UA 목록을 코드가 아니라 엣지에 두면 배포 없이 조정된다.
- `Rate limiting rules`: 무료 1개 제공. 예) `/api/*` 아닌 경로에 IP당 60req/분 초과 시 Managed Challenge.

**Cloudflare를 안 쓰고 있다면**: 네임서버만 옮기면 되고, 이 문제에 대해 **비용 대비 효과가 가장 큰 단일 조치**다.

> ⚠ **결제 콜백은 반드시 챌린지 예외.** `/api/payments/nicepay/return`(NICEPAY 교차 출처 POST), `/api/payments/nicepay/webhook`, `/api/payments/return`, `/api/payments/webhook`. PG 서버 콜백은 UA가 브라우저가 아니다. 봇 룰이 막으면 **결제가 조용히 깨진다.**

### L3. 앱 프록시 레이트리밋 — 최후 수단

이미 있는 `src/proxy.js`에 얹는다. 결제 쪽 패턴(`paymentRequestLimit.js`)을 재사용.

```js
// src/proxy.js — 개념 스케치. 그대로 쓰지 말 것.
const BLOCKED_UA = /Bytespider|SemrushBot|MJ12bot|DataForSeoBot/i;

export function proxy(request) {
  const ua = request.headers.get("user-agent") || "";
  // UA는 위조된다. 이건 "정직한 대량 크롤러"의 볼륨만 깎는 조치다.
  if (BLOCKED_UA.test(ua)) return new NextResponse(null, { status: 403 });
  // ...기존 호스트 정규화 로직
}
```

**정직한 한계 — 모르고 넣으면 안 된다:**
- 요청이 이미 컨테이너에 **도달한 뒤**다. CPU는 아끼지만 네트워크·연결 비용은 그대로다.
- Railway가 복제본을 여럿 띄우면 **메모리 카운터는 복제본별로 각각** 센다. `paymentRequestLimit.js`가 같은 이유로 "replica-wide abuse protection still belongs at the trusted edge"라고 적어 뒀다.
- UA 차단은 위장에 무력하다. C군 중 진짜 악성은 안 맞는다.
- **프록시는 모든 요청에 붙는다.** 정규식 하나가 전 사용자 지연에 들어간다.

---

## 2.5 하지 말아야 할 것

| 하지 말 것 | 이유 |
|---|---|
| `User-agent: * / Disallow: /` | 검색·AEO가 통째로 죽는다. 매출 경로를 스스로 끊는 것 |
| A군(AI 검색)까지 일괄 차단 | §12.29 AEO 투자 전체가 무효. 되돌려도 색인 회복에 수개월 |
| 전 사용자에게 JS 챌린지·캡차 | 봇보다 사람이 먼저 이탈한다. 모바일 검색 유입에 특히 치명적 |
| UA 블랙리스트만 믿기 | 위조가 기본값. 볼륨 감소 수단이지 보안 수단이 아니다 |
| 측정 없이 차단부터 | 무엇을 막았는지·나아졌는지 알 수 없다 |
| 결제 콜백 경로에 봇 룰 적용 | PG 서버 콜백이 막히면 결제가 조용히 깨진다 |

---

## 2.6 부수 리스크 — AdSense 무효 트래픽

`ca-pub-3073450406371629`가 전 페이지에 실린다(AGENTS.md §1). 봇 트래픽 자체보다 **봇이 광고 노출을 유발하면 무효 트래픽으로 분류**될 수 있다. L0 정적화나 L2 엣지 차단은 이쪽에도 같이 듣는다. 애드센스의 "무효 클릭/노출" 항목을 Railway 로그와 같은 창으로 비교할 것.

---

## 2.7 권장 실행 순서

1. **[측정]** Railway 로그 24시간 → UA 상위 20 표를 이 문서에 추가. *사람이 해야 함.*
2. **[확인]** 도메인이 Cloudflare를 거치는가? *사람이 해야 함.*
3. **[L0]** catch-all 동적 사유 확정 → `generateStaticParams` 추가 → build/test/e2e. **효과 최대, AEO 손실 0.**
4. **[L1]** `robots.txt` 선별 + `/api/` disallow + `robots.test.js`를 근거 기반으로 재작성.
5. **[L2]** Cloudflare가 있으면 UA 룰 + 레이트리밋(결제 경로 예외). 없으면 도입 여부 결정.
6. **[재측정]** 같은 창으로 before/after 비교. 안 줄었으면 되돌린다.
7. **[L3]** 위로 안 되면 그때 프록시.

---

## 2.8 결정이 필요한 항목

1. **학습 봇(B군)을 막을 것인가?** 막아도 AI 검색 노출은 안 줄지만, 되돌리는 데 비용이 든다. 막지 않는 것도 유효한 선택이다.
2. **Cloudflare를 도입할 것인가?** 엣지 없이는 도달 전 차단이 불가능하다.
3. **SEO 도구 봇을 막을 것인가?** 자사에서 Ahrefs/Semrush를 쓰지 않는다면 볼륨 대비 이득이 가장 크다.
4. **L0 정적화를 이번에 같이 할 것인가?** 봇과 무관하게 실사용자 응답속도에도 듣는다.

---

## 2.9 이 Part가 확인하지 못한 것

- **실제 봇 트래픽 비중** — 서버 로그를 보지 못했다. 이 Part의 모든 "봇이 많다"는 전제는 **사용자의 체감이지 측정이 아니다.**
- **Cloudflare 경유 여부** — 네트워크 프록시(403)로 `growthoptplaybook.com` 응답 헤더를 확인하지 못했다.
- **catch-all이 동적인 진짜 이유** — `generateStaticParams` 부재는 확인했으나, 다른 동적 API 사용 여부는 전량 확인하지 않았다. L0 착수 전 확정 필요.
- **벤더 UA 토큰의 현재 의미** — 자주 바뀐다. 적용 직전 각 벤더 문서에서 재확인할 것.

---

# 부록 — 이 문서가 실행한 검증

| 항목 | 결과 |
|---|---|
| `npm run test:all` | 506 files / **4258 passed**, 3 skipped |
| `npm run lint` | **0** |
| `npm run build` | **성공** (SSG 33페이지, catch-all 2개 동적) |
| 재현 스크립트 | `archiveMemo` 필드 유실 · `decisionReviewFollowUpMode` 우선순위 · `reportDraft` 대시 출력 — 3건 모두 출력 확보 |
| 코드 수정 | **없음.** `main`(`efaaa4b`) 기준 감사만 수행 |
