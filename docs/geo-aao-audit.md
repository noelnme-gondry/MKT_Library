# GEO / AAO 최적화 — 현황 점검 및 작업 계획

> **상태**: 점검(체크)만 완료. 코드 변경 0건. 구현은 미착수.
> **대상**: `v2-migration/` (운영 앱 SSOT), 도메인 `growthoptplaybook.com`
> **작성**: 2026-08-01 / 브랜치 `claude/geo-aao-optimization-5f7an7`

---

## 0. 용어 정리

- **GEO** (Generative Engine Optimization): ChatGPT·Perplexity·Google AI Overviews·Naver AI 등 **생성형 검색 엔진이 답변을 만들 때 우리 사이트를 인용하게** 만드는 최적화.
- **AAO** (AI Answer Optimization): 같은 목표를 "답변 단위"로 본 것 — 페이지 전체가 아니라 **문단·표·FAQ 하나가 그대로 답변에 실릴 수 있는 형태**로 만드는 것.
- 기존 SEO와의 차이: SEO는 *클릭*을 얻는 게임, GEO는 *인용*을 얻는 게임. 순위가 아니라 **"기계가 잘라 쓰기 좋은 조각"**이 자산.

---

## 1. 결론 먼저

기존 **SEO 인프라는 이미 상위 수준**이다(canonical·hreflang·sitemap SSOT·JSON-LD 6종·필라 통합 + 301). 따라서 GEO를 위해 기반을 새로 깔 필요는 없다.

진짜 갭은 **"AI가 인용할 수 있는 단위"의 부족** 3가지:

1. **진입 맵 부재** — `llms.txt` 없음. AI 크롤러가 사이트 구조를 요약해 받을 경로가 없다.
2. **답변 블록 커버리지 25% 이하** — FAQ가 블로그 33편 중 8편, 용어사전 26개 중 0개. "결론부터" 구조는 5편.
3. **도구 URL 11개 중 9개에 크롤 가능한 설명 본문이 없음** — `SoftwareApplication` 스키마만으로는 AI가 도구를 설명하지 못한다.

---

## 2. 현재 상태 (실측)

### 2.1 이미 되어 있는 것 ✅

| 항목 | 내용 | 위치 |
|---|---|---|
| canonical / hreflang | 페이지별 canonical + EN alternates(`enAlternates`) | `src/app/[[...slug]]/page.js:8-47` |
| metadataBase | `https://growthoptplaybook.com` — layout canonical 누수 방지 주석까지 처리됨 | `src/app/layout.js:28` |
| sitemap | routeMap SSOT 파생 + 블로그·태그·용어사전·계산기·템플릿·EN 전량 | `src/app/sitemap.js` (165줄) |
| RSS | 네이버 제출용 `/rss.xml` | `src/app/rss.xml/route.js` |
| JSON-LD | WebSite·Organization(전역 @graph), SoftwareApplication(도구), BlogPosting, FAQPage×7, BreadcrumbList×10, DefinedTerm/DefinedTermSet, HowTo×2, CollectionPage | `layout.js:74`, 각 route page.js |
| BlogPosting 날짜 | `datePublished` / `dateModified` 세팅됨 | `src/app/blog/[slug]/page.js:107-110` |
| SSR 본문 | `ssr:false` **0건** → 도구 페이지도 초기 HTML에 텍스트 포함(JS 미실행 크롤러도 읽음) | `src/app/[[...slug]]/PageClient.jsx` |
| 콘텐츠 통합 | 필라 통합 + 구 URL 301(ko/en 각각) | `next.config.mjs` `redirects()` |
| 답변 우선 문체 | 일부 글에 `**결론부터 (3줄)**` 패턴 확립됨 | `content/blog/budget-marginal-efficiency.md:11` |

### 2.2 갭 ⚠ / 부재 ❌

| # | 항목 | 실측 | 위치 |
|---|---|---|---|
| G1 | **llms.txt / llms-full.txt** | ❌ 없음 (`public/`엔 `ads.txt`만) | — |
| G2 | **robots.txt AI 크롤러 규칙** | ⚠ `{ userAgent: "*", allow: "/" }` 한 줄. GPTBot·ClaudeBot·PerplexityBot·OAI-SearchBot·Google-Extended 명시 없음 | `src/app/robots.js:6` |
| G3 | **FAQ 커버리지** | ⚠ KO 블로그 **8 / 33**, EN 블로그 **6 / 32**, 용어사전 **0 / 26** | `content/blog*/`, 파서는 `src/lib/blog.js:104-106` |
| G4 | **답변 우선 구조** | ⚠ "결론부터 / 한 줄 요약" 보유 **5 / 33편** | `content/blog/*.md` |
| G5 | **도구 설명 본문** | ⚠ `ToolLongform` COPY가 **2 / 11 도구**(5-3, 5-18)만. `ToolIntro`는 6개(`CUSTOM_TOOL_INTRO_IDS`) | `src/components/ToolLongform.jsx:1-64`, `PageClient.jsx:38` |
| G6 | **저자 E-E-A-T** | ⚠ `author = publisher = Organization`. Person 저자·`sameAs`(외부 프로필) 없음 | `src/app/blog/[slug]/page.js:80,109-110` |
| G7 | **스키마 엔티티 그래프** | ⚠ 전역 WebSite/Org엔 `@id` 있으나 개별 페이지가 `isPartOf`·`publisher:{@id}`·`about:DefinedTerm`으로 연결 안 됨 → 그래프 파편화 | `layout.js:79-95` vs 각 page.js |
| G8 | **인용용 수치/정의 자산** | ⚠ 고유 숫자·정의·비교표가 산문에 섞여 있어 기계가 잘라내기 어려움(표 + 산출 근거 라인 표준 없음) | `content/blog*/` 전반 |
| G9 | **9-x 콘텐츠 도구 색인** | ⚠ `publication: "preview"` → `isRoutePublished` false → noindex. GEO 노출 대상에서 제외됨 | `src/lib/routeMap.js:34-39`, `sitemap.js:18` |

### 2.3 미검증 항목

- **프로덕션 실제 HTML** — 이 실행 환경의 네트워크 정책으로 `growthoptplaybook.com` fetch가 차단됨(`http=000`). 2.1의 SSR 판정은 **코드 근거**(`ssr:false` 부재, App Router 기본 SSR)이며 라이브 응답으로 확인한 것이 아니다.
- 확인이 필요하면 로컬 `npm run build && npm start` 후 `curl`로 도구 페이지 본문 길이를 측정하는 절차가 필요하다(특히 `dyn()`의 `loading: "로딩 중…"` 폴백이 초기 HTML에 들어가지 않는지).

---

## 3. 작업 후보 (효과 / 비용)

| # | 작업 | 바꾸는 곳 | 비용 | 효과 | 갭 |
|---|---|---|---|---|---|
| W1 | `llms.txt` + `llms-full.txt` 라우트 — **routeMap + blog fs에서 자동 파생**(하드코딩 금지, sitemap과 동일 SSOT 원칙) | 신규 `src/app/llms.txt/route.js` | 낮음 | **높음** | G1 |
| W2 | robots에 AI 크롤러 명시 규칙 추가 | `src/app/robots.js` | 낮음 | 중 | G2 |
| W3 | 용어사전 26개에 FAQ 2~3개 + `DefinedTerm` ↔ `FAQPage` 결합 | `content/glossary*/`, `app/glossary/[slug]/page.js` | 중 | **높음** | G3 |
| W4 | 블로그 28편 소급 — `결론부터 3줄` + `faq:` 프론트매터 | `content/blog*/*.md` (KO/EN 짝) | 중~높음 | **높음** | G3·G4 |
| W5 | 도구 9개 `ToolLongform` 카피 작성 (KO/EN 동시, §2.11) | `src/components/ToolLongform.jsx` COPY | 중 | **높음** | G5 |
| W6 | 스키마 `@id` 그래프 결선 + Person 저자·`sameAs` | `layout.js` + 각 page.js | 중 | 중 | G6·G7 |
| W7 | 인용용 블록 표준화(수치 표 + 산출 근거 한 줄) 공용 컴포넌트 | 블로그·도구 공통 | 중 | 중 | G8 |

### 권장 순서

```
1차(저비용·즉효): W1 → W2
2차(인용 자산):   W3 → W5        ← 파일 수 적고 효과 큰 것 먼저
3차(대량 소급):   W4              ← 별도 세션 권장(33+32편)
4차(신뢰 신호):   W6 → W7
```

---

## 4. 착수 전 결정이 필요한 것

CLAUDE.md §2.7(모호한 결정 임의 확정 금지)에 따라 아래는 **사용자 결정 사항**이다.

| # | 결정 | 선택지 | 트레이드오프 |
|---|---|---|---|
| D1 | **AI 학습봇 정책** | (A) 전부 허용 (B) 검색봇만 허용(OAI-SearchBot·PerplexityBot), 학습봇(GPTBot·Google-Extended) 차단 | A=인용 노출 최대, 콘텐츠 학습 허용 / B=콘텐츠 보호, 인용 기회 감소 |
| D2 | **llms.txt 범위** | (A) 요약 인덱스만 (B) `llms-full.txt`로 블로그 전문 제공 | B=인용 정확도↑, 전문 공개 |
| D3 | **리소스 배분** | (A) 블로그 소급(W4) 우선 (B) 도구 본문(W5) 우선 | A=검색 유입 자산 / B=제품 페이지 인용 |
| D4 | **9-x preview 해제** | (A) 유지(noindex) (B) 색인 공개 | 현재 GEO 대상에서 빠져 있음 — 의도 확인 필요 |

---

## 5. 검증 계획 (구현 시)

- `npm run test:all` + `npm run lint` (§6.1)
- `sitemap.test.js` · `contentRegistry.test.js` · `routeSeo.test.js` 통과 유지 — W1·W3·W4는 레지스트리 정합 테스트가 강제한다(§12.24).
- W1은 신규 라우트 → **`ARCHITECTURE.md` 코드맵 동반 갱신**(§15).
- 외부 노출 변경이므로 **KR/EN 동시 반영 및 검증**(§2.11).
- 스키마 변경(W6)은 Google Rich Results Test / Schema Markup Validator로 육안 확인(사용자 측).

---

## 6. 원칙 준수 메모

- 엔진(`src/utils/*Math.js`) 무관 — 전부 렌더/메타/콘텐츠 레이어. 골든 테스트 byte-동일 유지.
- 수치·효과 예측을 날조하지 않는다(§8 정직성). "GEO 도입 시 트래픽 N% 증가" 같은 표현은 이 문서와 산출물 어디에도 쓰지 않는다.
- llms.txt·sitemap은 **SSOT 파생**만 허용(하드코딩 목록은 표류의 원인).
