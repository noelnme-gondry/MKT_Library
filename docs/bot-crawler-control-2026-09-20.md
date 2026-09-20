# AI·크롤러 봇 대응 — 실측과 선택지

작성 2026-09-20 · 대상 `growthoptplaybook.com` (Railway, Next 16.3.4)
근거: 이 저장소 코드 실측 + `npm run build` 출력. **서버 로그는 보지 못했다**(§측정 먼저).

---

## 0. 결론 먼저

1. **현재 봇 방어선은 0이다.** `robots.txt`는 전면 허용이고, 엣지 레이트리밋도 UA 필터도 없다. 앱 레벨 레이트리밋은 결제 API 3종에만 걸려 있다.
2. **가장 큰 비용은 차단이 아니라 렌더 방식에 있다.** 홈·도구 20개·가이드 15개를 담당하는 catch-all 라우트가 **요청마다 서버 렌더(ƒ)** 된다. 봇 1회 방문 = Railway 컨테이너 CPU 1회. 이걸 정적화하면 **아무도 차단하지 않고** 봇 부하가 자릿수로 떨어진다.
3. **전면 차단은 이 제품에서 손해다.** `llms.txt`·AEO 답변·FAQ JSON-LD는 전부 "AI 검색이 인용하게 하려고" 만든 자산이다(AGENTS.md §12.29). AI 봇을 뭉뚱그려 막으면 그 투자를 스스로 지운다.
4. **"느낌"을 숫자로 바꾸기 전에 차단부터 하면 안 된다.** 지금은 봇 비중을 확인할 수단 자체가 없다. 측정 경로를 먼저 세우는 것이 1순위다.

권장 순서: **L0 정적화 → 측정 → L1 robots.txt 선별 → L2 엣지 → (필요시) L3 앱 레이트리밋**

---

## 1. 실측한 현재 상태

| 항목 | 실측 결과 | 위치 |
|---|---|---|
| robots.txt | `User-agent: * / Allow: /` 전면 허용 | `src/app/robots.js` |
| robots 정책 가드 | "AI·학습 봇을 구분하지 않는 현재 정책을 **의도적으로 고정**" | `src/app/robots.test.js:10` |
| 엣지 프록시 | 존재함(호스트 정규화·noindex 전용). 봇 처리 없음 | `src/proxy.js` |
| 레이트리밋 | 결제 API만(`order` 30/분, 그 외 120/분, IP는 HMAC 해시·미저장) | `src/lib/subscription/paymentRequestLimit.js` |
| 보안 헤더 | XFO·CSP frame-ancestors·nosniff·HSTS. 봇과 무관 | `next.config.mjs:54` |
| AI 안내 파일 | `llms.txt` 제공 중 (도구·블로그·용어 전량 색인) | `src/app/llms.txt/route.js` |

### 1.1 진짜 비용 지점 — catch-all이 동적 렌더다

`npm run build` 출력 기준:

```
├ ƒ /[[...slug]]        ← KO 전체 (홈·도구·가이드·/start·/weekly-review·/compare 인덱스)
├ ƒ /en/[...slug]       ← EN 전체
├ ● /blog/[slug]        ← 정적(generateStaticParams 있음)
├ ● /glossary/[slug]    ← 정적
├ ● /templates/[slug]   ← 정적
```

`generateStaticParams`를 가진 라우트는 6종(blog·glossary·templates·compare·calculator·tag, KO/EN)뿐이고 **catch-all 둘에는 없다**. 즉:

- 블로그·용어(가장 많이 긁히는 콘텐츠)는 이미 정적이라 크롤링이 싸다.
- 반면 **도구 20개·가이드 15개·홈**은 봇이 긁을 때마다 `getAllPosts`·`getAllTerms`·`buildGuideEvidenceLinks` 같은 fs+조립 작업이 서버에서 돈다.

**이것이 "봇이 많이 들어오는 느낌"의 가장 유력한 물리적 근거다.** 같은 봇 트래픽이라도 정적 라우트면 체감되지 않는다.

> ⚠ 정적화가 간단한지는 별도 확인이 필요하다. catch-all이 동적인 이유를 코드로 확정하지 못했다(`export const dynamic` 선언도, `headers()`/`cookies()` 사용도 페이지 상단에서는 안 보인다). `generateStaticParams`가 없어서 동적으로 잡히는 것이라면 라우트 목록을 `routeMap.ROUTES`에서 파생해 넣는 것만으로 해결된다.

### 1.2 GA4로는 봇을 볼 수 없다

GA4·GTM은 `isAnalyticsHost()` 뒤에서 **클라이언트 gtag**로만 발화한다(`src/lib/analyticsHost.js`). JS를 실행하지 않는 크롤러는 GA4에 애초에 찍히지 않는다.

따라서:
- GA4에서 봇처럼 보이는 트래픽을 봤다면 → 그건 **JS를 실행하는 헤드리스 브라우저**(= 더 공격적인 스크래퍼)이거나, 봇이 아니다.
- GA4가 조용하다고 봇이 없는 게 아니다. 대부분의 크롤러는 GA4 밖에서 서버만 두드린다.

---

## 2. 측정 먼저 — 무엇을 어디서 보나

차단 설정을 하기 전에 아래 세 가지를 확보한다. **하나도 없으면 무엇을 막았는지, 막아서 나아졌는지 영영 알 수 없다.**

| 신호 | 어디서 | 무엇을 본다 |
|---|---|---|
| 서버 실히트 | Railway 로그 (`Deployments → Logs`) | UA별 요청 수, 상위 경로, 상태코드. 봇 비중의 **유일한 1차 근거** |
| 검색엔진 크롤 | Search Console → 설정 → 크롤링 통계 | Googlebot 크롤 요청 추이·응답시간. 급증하면 사이트가 아니라 색인 쪽 문제 |
| 리소스 | Railway Metrics (CPU/메모리) | 트래픽 급증과 CPU 급증의 시점 일치 여부 |

Railway 로그는 보존 기간이 짧다. 한 번에 판단하려면 **24시간 창으로 UA 상위 20개를 뽑아 표로 남겨 둘 것**. 이 문서에 그 표를 붙이면 이후 조치의 before/after가 생긴다.

판정 기준(제안):
- 상위 UA가 `Googlebot`/`bingbot` 위주 → 정상. 조치 불필요.
- `Bytespider`·`ClaudeBot`·`GPTBot`·`CCBot`·`*SemrushBot*`·`AhrefsBot`이 상위 → §3 선별 대응.
- UA가 `python-requests`/`axios`/빈 문자열/무작위 크롬 버전이고 한 IP대역에서 몰림 → §5 남용 대응.

---

## 3. 봇을 세 갈래로 가른다

한 덩어리로 막으면 매출 경로를 같이 끊는다. 이 제품 기준 분류:

### A. 인용해 주는 AI 검색 — **막으면 손해**
`OAI-SearchBot`(ChatGPT 검색), `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `Claude-SearchBot`, `Claude-User`

AGENTS.md §12.29가 만든 AEO 자산(도구별 `question`/`answer`, FAQ JSON-LD, `llms.txt`, `/compare`)이 노리는 대상이 정확히 이들이다. 차단 = 그 작업을 되돌리는 것.

### B. 학습 데이터 수집 — **정책 결정 사항**
`GPTBot`(OpenAI 학습), `ClaudeBot`(Anthropic 학습), `CCBot`(Common Crawl), `Google-Extended`, `Applebot-Extended`, `meta-externalagent`, `Amazonbot`, `Bytespider`, `cohere-ai`, `Diffbot`, `omgili`, `ImagesiftBot`

콘텐츠가 학습에 쓰이는 대가로 돌아오는 트래픽은 없다. 다만 **차단한다고 AI 검색 노출이 줄지는 않는다** — A와 B는 별도 UA다.

> 주의: `Google-Extended`는 **Gemini 학습 opt-out 토큰이지 Google 검색 색인과 무관**하다. `Applebot-Extended`도 같다(`Applebot` 본체는 Siri/Spotlight 검색용). 이 둘을 막아도 AI Overviews에서 사라지지 않는다.
>
> ⚠ 벤더 토큰 이름과 의미는 자주 바뀐다. **적용 전 각 벤더 문서에서 재확인할 것.** 이 목록은 2026-09 시점 기준이며 이 문서가 SSOT가 아니다.

### C. 남용 스크래퍼 — **막는 게 맞다**
UA 위장, robots.txt 무시, 동일 IP대역 고빈도. `Bytespider`는 B로 분류했지만 robots 무시 사례가 잦아 실무상 C로 다루는 경우가 많다.

SEO 도구 봇(`AhrefsBot`, `SemrushBot`, `MJ12bot`, `DataForSeoBot`)은 AI와 무관하지만 **크롤 볼륨은 가장 크다**. 자사 SEO 분석에 이 도구들을 쓰지 않는다면 막아도 잃을 게 없다.

---

## 4. 대응 4계층

효과 대비 비용 순. **위에서부터 하는 게 맞다.**

### L0. 정적화 — 차단 없이 봇 비용을 없앤다 · 효과 최상 · AEO 손실 0

catch-all 둘에 `generateStaticParams`를 넣어 도구·가이드·홈을 빌드 타임에 굽는다.

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

- 효과: 봇이든 사람이든 해당 경로가 **CDN/정적 서빙**이 된다. Railway CPU에서 사라진다.
- 리스크: catch-all이 동적인 **진짜 이유를 먼저 확정**해야 한다. 런타임 분기가 있다면 정적화가 화면을 깨뜨린다.
- 검증: `npm run build` 출력에서 `ƒ /[[...slug]]` → `●`로 바뀌는지, SSG 페이지 수가 33에서 얼마나 늘었는지. 그리고 `npm run test:all` + e2e.

**이 한 건이 나머지 셋을 합친 것보다 효과가 클 가능성이 높다.**

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

- **`src/app/robots.test.js`가 현재 정책을 명시적으로 고정하고 있으므로 같이 고쳐야 한다.** 그 테스트를 "값 고정"이 아니라 "A군은 항상 허용 / `/api/`는 항상 disallow"라는 **근거**를 단언하도록 다시 쓸 것(AGENTS.md §7).
- 한계: **robots.txt는 요청이다. 강제력이 없다.** C군은 애초에 안 읽는다. 서버 부하는 그대로다.
- `/api/` disallow는 부수 효과로 유용하다 — 현재 결제·계정 API 22개가 크롤 대상에 열려 있다.

### L2. 엣지 차단 — 유일하게 부하를 **도달 전에** 없앤다

**선행 확인: 도메인이 Cloudflare를 거치는지 모른다.** (이 세션에서는 네트워크 프록시가 막아 확인 불가.) Railway 단독이면 앞단 WAF가 없다.

**Cloudflare를 쓰고 있다면** (무료 플랜 포함):
- `Security → Bots → Block AI bots` 원클릭 토글. 다만 **A/B 구분 없이 묶어 막을 수 있으니** 옵션 문구를 확인하고, AEO를 지키려면 이걸 쓰지 말고 아래 Rule로 직접 고를 것.
- `WAF → Custom rules`: `(http.user_agent contains "Bytespider") or (...)` → Block. UA 목록을 코드가 아니라 엣지에 두면 배포 없이 조정된다.
- `Rate limiting rules`: 무료 1개 제공. 예) `/api/*` 아닌 경로에 IP당 60req/분 초과 시 Managed Challenge.

**Cloudflare를 안 쓰고 있다면**: 도메인 네임서버만 옮기면 되는 작업이고, 이 문제에 대해 **가장 비용 대비 효과가 큰 단일 조치**다. 단 결제 리다이렉트(`/api/payments/nicepay/return`, NICEPAY POST)와 웹훅 경로는 **반드시 챌린지 예외**로 둬야 한다 — 봇 챌린지가 PG 서버 콜백을 막으면 결제가 깨진다.

### L3. 앱 프록시 레이트리밋 — 최후 수단

이미 있는 `src/proxy.js`에 얹는다. 결제 쪽 패턴(`paymentRequestLimit.js`)을 그대로 재사용한다.

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

**정직한 한계 — 이걸 모르고 넣으면 안 된다:**
- 요청이 이미 컨테이너에 **도달한 뒤**다. CPU는 아끼지만 네트워크·연결 비용은 그대로다.
- Railway가 복제본을 여럿 띄우면 **메모리 카운터는 복제본별로 각각** 센다(`paymentRequestLimit.js`가 같은 이유로 "replica-wide abuse protection still belongs at the trusted edge"라고 적어 뒀다).
- UA 차단은 위장에 무력하다. C군 중 진짜 악성은 이걸 안 맞는다.
- **프록시는 모든 요청에 붙는다.** 정규식 하나가 전 사용자 지연에 들어간다. 매처(`config.matcher`)에서 정적 자산은 이미 빠져 있지만, 새 패턴을 넣을 때마다 비용을 다시 셀 것.

---

## 5. 하지 말아야 할 것

| 하지 말 것 | 이유 |
|---|---|
| `User-agent: * / Disallow: /` | 검색·AEO가 통째로 죽는다. 매출 경로를 스스로 끊는 것 |
| A군(AI 검색)까지 일괄 차단 | §12.29 AEO 투자 전체가 무효가 된다. 되돌려도 색인 회복에 수개월 |
| 전 사용자에게 JS 챌린지·캡차 | 봇보다 사람이 먼저 이탈한다. 모바일 검색 유입에 특히 치명적 |
| UA 블랙리스트만 믿기 | 위조가 기본값이다. 볼륨 감소 수단이지 보안 수단이 아니다 |
| 측정 없이 차단부터 | 무엇을 막았는지·나아졌는지 알 수 없다. 나중에 원인 불명 트래픽 감소로 돌아온다 |
| 결제 콜백 경로에 봇 룰 적용 | NICEPAY/Toss 서버 콜백은 UA가 브라우저가 아니다. 막으면 결제가 조용히 깨진다 |

---

## 6. 부수 리스크 — AdSense 무효 트래픽

`ca-pub-3073450406371629`가 전 페이지에 실린다(AGENTS.md §1). 봇 트래픽 자체보다, **봇이 광고 노출을 유발하면 무효 트래픽으로 분류**될 수 있다. L0 정적화나 L2 엣지 차단은 이쪽에도 같이 듣는다. 애드센스 보고서의 "무효 클릭/노출" 항목을 Railway 로그와 같은 창으로 비교해 볼 것.

---

## 7. 권장 실행 순서

1. **[측정]** Railway 로그 24시간 → UA 상위 20 표를 이 문서에 추가. *사람이 해야 함.*
2. **[확인]** 도메인이 Cloudflare를 거치는가? *사람이 해야 함.*
3. **[L0]** catch-all 동적 렌더 원인 확정 → `generateStaticParams` 추가 → build/test/e2e. **효과 최대, AEO 손실 0.**
4. **[L1]** `robots.txt` 선별 + `/api/` disallow + `robots.test.js`를 근거 기반으로 재작성.
5. **[L2]** Cloudflare가 있으면 UA 룰 + 레이트리밋(결제 경로 예외). 없으면 도입 여부 결정.
6. **[재측정]** 같은 창으로 before/after 비교. 안 줄었으면 되돌린다.
7. **[L3]** 위로 안 되면 그때 프록시.

---

## 8. 결정이 필요한 항목

1. **학습 봇(B군)을 막을 것인가?** 막아도 AI 검색 노출은 안 줄지만, 되돌리는 데 비용이 든다. 막지 않는 것도 유효한 선택이다.
2. **Cloudflare를 도입할 것인가?** 엣지 없이는 도달 전 차단이 불가능하다.
3. **SEO 도구 봇을 막을 것인가?** 자사에서 Ahrefs/Semrush를 쓰지 않는다면 볼륨 대비 이득이 가장 크다.
4. **L0 정적화를 이번에 같이 할 것인가?** 봇과 무관하게 실사용자 응답속도에도 듣는다.

---

## 9. 이 문서가 확인하지 못한 것

정직하게 남긴다.

- **실제 봇 트래픽 비중** — 서버 로그를 보지 못했다. 이 문서의 모든 "봇이 많다"는 전제는 사용자의 체감이지 측정이 아니다.
- **Cloudflare 경유 여부** — 네트워크 프록시(403)로 `growthoptplaybook.com` 응답 헤더를 확인하지 못했다.
- **catch-all이 동적인 진짜 이유** — `generateStaticParams` 부재는 확인했으나, 다른 동적 API 사용 여부는 전량 확인하지 않았다. L0 착수 전 확정 필요.
- **벤더 UA 토큰의 현재 의미** — 자주 바뀐다. 적용 직전 각 벤더 문서에서 재확인할 것.
