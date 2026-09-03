# 블로그 → 분석 연결 진단 · 실행 플랜

작성 2026-09-03 · 대상 `/blog`(KO 48편 · EN 49편) · 용어사전 48편
실측 기준 커밋: `6470a31`

목적: "블로그 유입은 있는데 분석으로 안 이어진다"는 감각을 **코드에서 확인 가능한 사실**로
바꾸고, 도치(assistant) 중간 개입 아이디어를 포함한 실행 순서를 정한다.

---

## 0. 요약 — 지금 상태를 한 줄로

전환이 안 되는 게 아니라 **전환 경로가 대부분의 글에서 렌더되지 않거나, 엉뚱한 도구로
보내지고 있고, 그 사실을 볼 계측이 없다.** 도치를 붙이기 전에 이미 있는 배선부터 고치는 게
비용 대비 효과가 크다.

| # | 사실 | 실측 | 성격 |
|---|---|---|---|
| D-1 | 본문 중간 CTA가 붙은 글이 소수 | KO **14/48** · EN **16/49** | 누락 |
| D-2 | 중간 CTA 목적지가 매핑과 다른 글 | 블로그 **7편** + 용어 **3편** → 전부 `5-2`로 폴백 | **버그** |
| D-3 | 읽기 깊이·CTA 노출 계측 없음 | 스크롤 이벤트 0건, `blog_tool_cta_clicked`는 클릭만 | 계측 공백 |
| D-4 | 도치가 블로그에 없음 | `DochiAssistant`·`DochiWelcomeOverlay`는 `home`에서만 마운트 | 미배선 |
| D-5 | 모바일 유입에 줄 수 있는 행동이 없음 | 도구는 데스크톱 최적화(`MobileToolNudge`가 스스로 고지) | 구조 |
| D-6 | 중간 CTA 커버리지 가드가 3편만 검사 | `HIGH_INTENT_ARTICLE_AUDIT` 손수 작성 3개 항목 | 가드 구멍 |

---

## 1. 진단 상세

### D-1. 본문 중간 CTA는 마커가 있는 글에서만 나온다
`app/(ko)/blog/[slug]/page.js:69 splitAtContentAction()`은 본문 HTML에서
`<!-- CONTENT_ACTION -->`를 찾고, **없으면 `after=""`가 되어 중간 패널이 통째로 렌더되지
않는다**(조용히). 마커는 `.md`에 사람이 직접 넣는다.

```
KO 마커 보유 14/48 · EN 16/49
없는 글(KO 일부): ab-testing, aha-moment-retention, cohort-analysis-guide,
apple-search-ads-guide, budget-marginal-efficiency, correlation-vs-causation …
```

즉 글 34편은 **끝까지 읽은 사람에게만** 행동 경로가 보인다. 마감 영역
(`blog-post-outro`)은 FAQ 위, 스크롤 최하단이다.

### D-2. 7편(+용어 3편)의 CTA가 매핑과 다른 도구로 간다 — 버그
`seo/ContentActionPanel.jsx:88`
```js
const resolvedTool = TOOL_COPY[candidate] ? candidate : "5-2";
```
`TOOL_COPY`에 **`5-27`(ASO 스토어 전환)·`5-24`(브랜드 증분)·`9-1`(콘텐츠 요소)가 없다.**
`contentToolRegistry`가 올바른 도구를 지정해도 카피가 없으면 조용히 운영 대시보드로 폴백한다.

| 글 | 매핑 | 실제 CTA 목적지 |
|---|---|---|
| aso-basics-guide · store-conversion-drop-diagnosis · store-listing-experiment | 5-27 | 5-2 |
| brand-campaign-lift · offline-ad-online-impact | 5-24 | 5-2 |
| content-element-analysis · creative-attribute-regression | 9-1 | 5-2 |
| 용어: aso · custom-product-page · product-page-views | 5-27 | 5-2 |

ASO 글을 읽고 온 사람이 CPA 대시보드로 떨어지면 그 세션은 거기서 끝난다. 이 저장소가 반복해
기록한 **"폴백이 누락을 가린다"** 패턴이고(AGENTS.md §7), `contentRegistry.test.js`는
`primaryTool`만 검사하지 **화면에 실제로 뜨는 목적지는 검사하지 않는다.**

### D-3. 지금 계측으로는 "연결 안 됨"을 확인할 수 없다
- 블로그에서 나가는 이벤트는 `blog_tool_cta_clicked`(`ContentActionPanel.jsx:93`) 하나.
- **CTA 노출 이벤트가 없어 CTR을 못 낸다** — 클릭 0이 "안 눌렀다"인지 "안 보였다(D-1)"인지 구분 불가.
- 스크롤·읽기 완료·연속 글 열람 이벤트 0건(`grep scroll` 결과 전부 `scrollIntoView` 호출).
- `docs/ga4-product-events.md`의 이벤트 표·검증 퍼널에 **블로그 퍼널이 아예 없다**
  (`blog_tool_cta_clicked`는 `lib/growthFunnel.js`의 intent 단계에만 존재).

따라서 도치 트리거를 만들 때 **트리거 조건(스크롤 깊이·글 수)을 정하는 근거 데이터가 지금은
없다.** 먼저 재보고 정하거나, 임시값으로 시작해 첫 2주 데이터로 조정한다고 명시해야 한다.

### D-4. 도치는 홈에만 있다
`app/(ko)/[[...slug]]/PageClient.jsx:94` — `routeId === "home"`일 때만
`<DochiAssistant/><DochiWelcomeOverlay/>`. 블로그 레이아웃(`app/(ko)/blog/layout.js`)은
Sidebar·Header·GlobalModals만 싣는다. **사용자 아이디어(글 중간 도치 등장)는 지금 구조상
아예 없는 기능이지, 안 보이는 기능이 아니다.**

주의 — 홈 도치를 그대로 블로그에 얹으면 안 된다:
- `DochiAssistant.jsx:40`이 마운트 즉시 `startMyData()`를 호출한다 → `demoDisabled=true`.
  블로그를 스쳐간 사람이 도구에 들어가면 **데모가 사라진 빈 화면**을 본다(§12.8 위반).
- `CsvUploader`를 직접 import한다 → 콘텐츠 페이지에 앱 번들이 흘러든다(§12.29 금지).

### D-5. 모바일 유입에 줄 행동이 CSV 업로드뿐이다
검색 유입은 모바일 비중이 높은데, 도구는 데스크톱 최적화이고 그 사실을 앱이 스스로
고지한다(`MobileToolNudge`). 모바일 독자에게 "CSV 올리기"를 권하는 CTA는 구조적으로
전환되지 않는다. **모바일의 성공 정의를 분리**해야 한다(구독 / 템플릿 받기 / 나중에 볼
링크 저장), 그렇지 않으면 개선해도 지표가 안 움직인다.

### D-6. 가드가 3편만 지킨다
`contentRegistry.test.js`의 `HIGH_INTENT_ARTICLE_AUDIT`은 손으로 쓴 3개 항목이고 그중
`hasMidAction:true`는 2건. 48편 중 34편에 중간 CTA가 없다는 사실을 잡을 검사가 없다.

---

## 2. 도치 브리지 설계 (사용자 아이디어 검증 + 구체화)

### 2.1 원칙
1. **전면 오버레이 금지.** 블로그 본문 위 인터스티셜은 모바일 검색 페널티 위험(§12.29b에서
   홈 오버레이도 ≤700px에서 하단 시트로 내린 이유와 같다). 블로그에서는 **인라인 카드 또는
   하단 시트**만.
2. **첫 글, 즉시 등장 금지.** 읽기를 방해하면 이탈률이 올라 SEO에도 손해다.
3. **도치는 링크만 준다.** 블로그판 도치는 CSV 업로더를 싣지 않는다(D-4의 두 부작용).
   업로드는 목적지(`/start`·도구)에서 한다.
4. **닫으면 그 세션에서 끝.** 명시적 "그만 보기"는 localStorage, 세션 반복 차단은
   sessionStorage(§12.29b와 같은 이원 저장).

### 2.2 트리거 (제안 기본값 — 데이터 확보 후 조정)
```
조건 A: 이번 세션에서 연 블로그 글 수 ≥ 2
조건 B: 현재 글에서 본문 60% 지점 도달 (IntersectionObserver 센티넬)
조건 C: 체류 ≥ 30초 (스크롤만 빠르게 내린 이탈 제외)
A && B && C  → 도치 인라인 카드 노출 (본문 끝 직전, 마감 영역 위)
```
- 세션 글 수는 `sessionStorage`에 슬러그 Set으로 누적(개인정보 없음, 브라우저 밖으로 안 나감).
- 문구는 **읽은 주제를 반영**해야 의미가 있다: "지금 보신 잠식 진단, 실제 데이터로 5분이면
  확인돼요" — `primaryTool` 기준으로 카피를 고르므로 D-2를 먼저 고쳐야 성립한다.
- 모바일: 같은 카드를 하단 시트로. **CTA는 도구가 아니라 "템플릿 CSV 받기 / 이메일로 링크
  보내기"** (D-5).

### 2.3 안 하는 것
- 스크롤 잠금·읽기 차단·시간 지연 팝업.
- 홈 `DochiWelcomeOverlay` 재사용(서버 스냅샷·홈 전용 상태 계약이 얽혀 있다).
- 도치를 여러 글에서 반복 노출(세션 1회).

---

## 3. 실행 플랜 (단계별 · 분량 추정)

### Phase 0 — 계측 먼저 (약 150줄, PR 1)
없으면 이후 단계의 성패를 판정할 수 없다.
- `blog_cta_viewed`(패널이 실제 viewport 노출 시 1회) — 기존 `analysis_result_viewed`의
  IntersectionObserver 패턴 재사용.
- `blog_read_depth`(25/50/75/100% 각 1회, `placement=blog`, `content_slug`).
- `blog_session_articles`(세션 내 2번째 글 진입 시 1회).
- `docs/ga4-product-events.md`에 블로그 퍼널 등재:
  `page_view(blog) → blog_read_depth(75) → blog_cta_viewed → blog_tool_cta_clicked →
  tool_view → data_import_success → analysis_completed(ready)`.
- 파라미터는 기존 `ALLOWED_PARAMS`로 충분(`content_slug`·`content_type`·`placement`·`rank` 존재).

**검증**: `analytics.test.js`에 파라미터 허용목록 단언 + 블로그 페이지 스모크.

### Phase 1 — 이미 있는 배선의 구멍 메우기 (약 250줄, PR 1~2) ★ 먼저 할 것
1. **D-2 수정**: `TOOL_COPY`에 `5-27`·`5-24`·`9-1` KO/EN 카피 추가.
   가드는 하드코딩 배열이 아니라 **`BLOG_PRIMARY_TOOL`·`GLOSSARY_PRIMARY_TOOL` 값 전체에서
   파생**해 "매핑된 도구는 전부 TOOL_COPY에 있어야 한다"를 단언(§7 파생 가드).
2. **D-1 수정**: 마커가 없으면 **본문 길이 기준 자동 삽입**(예: 문단 수 60% 지점의
   `</p>` 경계)으로 폴백. 마커가 있으면 마커 우선.
   → 사람이 매번 마커를 넣는 계약을 유지하면 34편이 다시 새로 쌓인다.
3. **D-6 수정**: 중간 CTA 커버리지를 발행 글 전체에서 파생 검사(위 자동 삽입이 들어가면
   "모든 글에 중간 CTA가 존재한다"가 참이 된다).
4. 상단 `seoAnswer` 블록 아래에 **한 줄 텍스트 링크**(패널 아님) — "이 판단을 내 데이터로
   확인하기 →". 상단 이탈자를 위한 최소 경로.

**검증**: `contentRegistry.test.js` 파생 가드, 블로그 slug 페이지 스모크(KO·EN), `test:all`+`lint`+`build`.

### Phase 2 — 도치 브리지 (약 300~400줄, PR 1)
- 신규 `components/blog/BlogDochiBridge.jsx`(client) — 트리거 로직 + 인라인 카드/하단 시트.
  `DochiSprite`만 재사용(53줄, 가볍다). `CsvUploader`·`startMyData` 금지.
- 노출/클릭/닫기 이벤트(`placement=blog_bridge`).
- KO/EN 동시(§2.11).
**검증**: 스모크로 ① 1번째 글에선 안 뜬다 ② 2번째 글 + 60% 도달에서 뜬다 ③ 닫으면 그
세션 재노출 없음 ④ `startMyData`가 호출되지 않는다(회귀 가드) ⑤ 서버 스냅샷은 항상 닫힘.

### Phase 3 — 콘텐츠 (측정 후 결정)
아래 §4 참조. **Phase 0 데이터 없이 착수하지 않는다.**

---

## 4. 콘텐츠 진단 — 지금 말할 수 있는 것과 없는 것

### 지금 말할 수 있는 것
- 분량 프록시(파일 크기)로 본 하위군: `ad-creative-specs-guide`·`hook-3-seconds-framework`·
  `meta-advantage-plus-guide`(각 4K). 상위군은 `ad-creative-testing`(20K),
  `performance-marketing-metrics`·`cohort-analysis-guide`·`ad-performance-diagnosis`(각 16K).
- 도구별 글 분포가 `5-2`에 12편으로 쏠려 있다(전체 48편 중 25%). 반면 `5-18-cannibal`·
  `5-18-trend`·`5-25`는 각 1편. **도구는 17개인데 글의 유입 표면이 대시보드 한쪽에 몰려 있다.**
- 글은 KO/EN 짝이 완비(48/49)이고 도구 매핑 커버리지도 100%다 — 즉 **구조가 아니라 배선과
  계측이 문제**라는 §1의 결론과 일치한다.

### 지금 말할 수 없는 것 (정직하게)
어떤 글을 늘리고 어떤 글을 고쳐야 하는지는 **파일 크기로 판정할 수 없다.** 이 저장소가 이미
확립한 처방 규칙(AGENTS.md §9)은 GSC 실측이 있어야 적용된다:

```
순위 상위(≤10위) + CTR 0  → 제목·스니펫·seoAnswer 문제
노출 많음 + 순위 낮음(>20) → 분량·깊이 문제
노출도 낮음               → 수요 없는 주제(증설 대상 아님)
```

**필요한 입력**: GSC 3개월 export(페이지별 클릭·노출·CTR·평균순위, KO/EN 분리) + GA4에서
블로그 랜딩 세션의 `analysis_completed` 도달률. 주시면 위 규칙으로 48편을 세 처방군으로
분류하고 우선순위를 낸다.

### 신규 글에 대한 잠정 견해
새 글보다 **연결 표면이 없는 도구(5-25·5-27·5-24·9-1)에 유입 글이 1편 이하**라는 쏠림을
먼저 해소하는 편이 전환에 직접 붙는다. 다만 §12.24 기준 신규 1편 = KO/EN 파일 2개 +
레지스트리 6곳이므로, Phase 1~2가 끝나 전환율 기준선이 생긴 뒤 착수한다.

---

## 5. 진행 상태 (2026-09-03)

| Phase | 상태 | 결과 |
|---|---|---|
| 1 배선 수정 | ✅ 완료 | 중간 CTA가 발행 글 **전부**에서 렌더(자동 삽입 33편이 h2 앞 46~68% 지점) · 오배송 7편+용어 3편 수정 · 상단 한 줄 링크 추가 |
| 0 계측 | ✅ 완료 | `blog_cta_viewed`·`blog_read_depth`·`blog_session_articles` + GA4 문서 퍼널 등재 |
| 2 도치 브리지 | ✅ 완료 | 세션 2편째 + 60% + 30초 → 본문 끝 카드(≤700px 하단 시트), 닫기 2단 저장 |
| 3 콘텐츠 | ⏸ GSC 대기 | 아래 §4의 입력이 오면 48편을 세 처방군으로 분류 |

D-5(모바일)는 브리지의 좁은 화면 카피로 **부분** 대응했다. 도구 자체의 모바일 대응은
범위 밖(`MobileToolNudge`가 고지하는 상태 그대로)이며, 전환 목표 분리는 Phase 0 데이터가
쌓인 뒤 다시 판단한다.

## 6. 권장 순서

```
Phase 1(배선 버그) → Phase 0(계측) → 2주 관측 → Phase 2(도치) → Phase 3(콘텐츠)
```
(초기 계획. 실제로는 Phase 1 → 0 → 2 순으로 진행했다.)

Phase 1을 먼저 두는 이유: D-2는 지금 사용자를 잘못된 도구로 보내는 **버그**이고, D-1은
34편에서 경로 자체가 없어 계측을 붙여도 잴 대상이 없기 때문이다. 두 PR을 함께 낼 수도 있다
(계측이 붙은 상태에서 수정 전후 비교가 가능해진다).
