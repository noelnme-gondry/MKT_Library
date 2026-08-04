# SEO · AAO/GEO · 리텐션 검토 (2026-08-04)

> 대상: `v2-migration/` (Growth Opt Playbook, `growthoptplaybook.com`)
> 기준 커밋: `39eaeb3` (feat: 분석 전환 측정 루프 완성 #582)
> 선행 문서: [`weekly-retention-product-audit-2026-08-01.md`](./weekly-retention-product-audit-2026-08-01.md) · [`aao-geo-operating-model.md`](./aao-geo-operating-model.md)
> 상태: **개선 제안 문서 — 구현 승인 아님.** 코드 변경 없음, 검토 결과만 기록.

---

## 0. 한 줄 결론

SEO·GEO **기반 구조는 이미 상위권**이다(구조화 데이터 5종, hreflang, llms.txt, 212 URL sitemap, 분석 퍼널 이벤트 완비). 남은 문제는 설계 결함이 아니라 **배선 누락 3건**과 **콘텐츠 신뢰 신호의 낮은 커버리지**다.

리텐션은 루프 자체(결정 저장 → 검토일 → 실제값 채점 → 예측 대조)가 이미 구현돼 있고 헤더·사이드바 배지까지 붙어 있다. 진짜 병목은 **그 루프가 기본적으로 껴져 있다는 것**(`decisionPersistenceEnabled` 기본 false)이라 새로고침 한 번에 복귀 문맥이 사라진다.

가장 비용 대비 효과가 큰 3건:

| # | 항목 | 영향 범위 | 예상 작업량 |
|---|---|---|---|
| 1 | `og:site_name`/`og:locale` 누락 복구 | **151/156 페이지** | 공용 헬퍼 1개 + 호출부 |
| 2 | 결정 저장 opt-in을 "저장 시점"에 묻기 | 리텐션 루프 전체 | 컴포넌트 1개 |
| 3 | EN 페이지 SSR `<html lang="ko">` | EN 전체 | 라우트 레이아웃 |

---

## 1. 검토 방법 (증거 등급)

추론과 실측을 섞지 않기 위해 실제로 실행한 것만 아래에 남긴다.

| 검증 | 방법 | 결과 |
|---|---|---|
| 빌드 | `npm run build` | ✅ 통과 |
| 테스트 | `npm run test:all` | 174 파일 중 1건 실패 → **재실행 시 12/12 통과**. 빌드와 동시 실행된 CPU 경합 타임아웃(`attributedForecastLiveMath.test.js`, 30s 제한·단독 83s 소요)이며 **제품 버그 아님**. 단, 단독으로도 83초 걸리는 테스트라 CI에서 재발 여지 있음 → `testTimeout` 상향 또는 픽스처 축소 권장 |
| 메타 태그 | 빌드 산출물 156개 HTML을 grep | 실측 (아래 수치 전부 이 방법) |
| 구조화 데이터 | 라우트별 JSON-LD 소스 확인 | 정적 확인 |
| 콘텐츠 신뢰 신호 | `content/blog`·`blog-en` frontmatter 집계 | 실측 |
| 리텐션 루프 | store persist 설정 + 소비 컴포넌트 추적 | 정적 확인 |
| **실제 검색 성과** | — | **미확인.** GSC·GA4 접근 없음. 순위·노출·CTR·재방문율 관련 서술은 전부 추론이며 아래에서 그렇게 표기 |

---

## 2. 이미 잘 되어 있는 것 (되돌리지 말 것)

개선 목록만 보면 오해를 부르므로 먼저 기록한다.

- **구조화 데이터 5종**: `SoftwareApplication`(도구) · `BlogPosting`+`citation` · `DefinedTerm`(용어) · `HowTo`(진단) · `FAQPage` · `BreadcrumbList`. 도구 페이지는 `isAccessibleForFree`·`offers`까지 명시.
- **hreflang 상호 연결**: `enAlternates()`가 `hasEnVersion` 게이트를 통과한 라우트만 KR↔EN+`x-default`로 묶음. 반쪽 번역 페이지는 `generateMetadata`가 아예 메타를 내지 않아 인덱싱을 막는다 — 정확한 설계.
- **canonical 누수 차단**: layout에서 canonical을 걷어내고 페이지별로 선언(`layout.js:36-39` 주석에 사유까지 기록). GSC "대체 페이지" 이슈 재발 방지 구조.
- **sitemap이 SSOT 파생**: `ROUTES`+`getAllPosts`+`getAllTerms`+`CALCULATOR_ORDER`에서 자동 생성돼 도구가 늘어도 표류하지 않음. 212 URL.
- **`llms.txt`**: sitemap과 링크 파리티를 테스트로 강제(`llms.txt/route.test.js`). 게다가 `aao-geo-operating-model.md:42`가 "Google은 llms.txt를 요구하지 않는다"는 사실을 정확히 적어두고 과대 주장을 스스로 차단한다 — 이 정직성이 이 프로젝트의 가장 큰 GEO 자산이다.
- **분석 퍼널 이벤트 완비**: `analysis_started → analysis_completed → analysis_result_viewed → decision_record_added → decision_review_completed` + `analysis_blocked`. `ALLOWED_PARAMS` allowlist로 CSV 값·파일명 유출을 구조적으로 차단(`analytics.js:4-10`). 2026-08-01 감사의 "측정 약함" 지적은 **해소됨**.
- **리텐션 루프 실구현**: `DecisionReview`(저장) → `Header`/`Sidebar` 기한 배지 → `WeeklyReview`(실제값·배운 점) → `forecastReview`(예측 대조). 2026-08-01 감사의 P0 두 건이 실제로 붙었다.
- **결정 저장 방어**: `DECISION_REVIEW_SAFE_FIELDS` allowlist + `persistMigrate`가 v1 payload의 우연한 동일 키를 동의로 간주하지 않고 제거(`useDataStore.js:351-358`). 개인정보 설계가 견고하다.

---

## 3. SEO 개선사항

### P0-1. `og:site_name`·`og:locale`이 151/156 페이지에서 사라진다 ⭐

**증거 (실측)**

```
빌드 HTML 156개 중
  og:site_name 포함:  5개   (weekly-review/report KR·EN, _not-found)
  og:locale   포함: 23개
```

`og:site_name`을 가진 5개는 **자기 `openGraph`를 설정하지 않아 layout 값을 상속한 페이지들**이다. 즉 블로그 66편·용어 51건·계산기·전 도구가 전부 빠져 있다.

**원인** — Next 16 메타데이터 병합 규칙. `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md:1358`:

> All `openGraph` fields from `app/layout.js` are **replaced** in `app/blog/page.js` because `app/blog/page.js` sets `openGraph` metadata.

`layout.js:45-46`이 `siteName`·`locale: "ko_KR"`을 갖고 있지만, 자식이 `openGraph`를 선언하는 순간 **객체 통째로 교체**돼 두 필드가 유실된다. 상속으로 착각하기 쉬운 지점이고, 실제로 그렇게 작성돼 있다.

**영향** — `og:site_name`은 카카오톡·슬랙·X 공유 카드의 출처 표기에 쓰인다. 블로그 유입이 SNS 공유를 타는 구조라면 브랜드 노출을 매 공유마다 놓치는 셈. `og:locale`은 상대적으로 약한 신호다(과대평가 금지).

**제안** — 공용 헬퍼 하나로 고정. 로케일별 기본값을 한 곳에 두고 모든 `generateMetadata`가 이걸 통과하게 한다.

```js
// src/lib/openGraphBase.js (신규)
export const ogBase = (locale = "ko") => ({
  siteName: "Growth Opt Playbook",
  locale: locale === "en" ? "en_US" : "ko_KR",
});
// 사용: openGraph: { ...ogBase(locale), type: "article", title, ... }
```

적용 대상: `blog/[slug]` · `en/blog/[slug]` · `blog/page` · `en/blog/page` · `blog/tag/[tag]` · `glossary/[slug]`(`:25`) · `en/glossary/[slug]`(`:26`) · `glossary/page` · `en/glossary/page` · `[[...slug]]`(도구) · `en/[...slug]` · `calculator/*` · `en/weekly-review` · `en/weekly-report`.

**검증** — 빌드 후 `grep -rl 'og:site_name' .next/server/app --include=*.html | wc -l`이 156에 가까워지는지. 회귀 방지로 테스트 1개 추가 권장(대표 라우트 3개의 메타에 `siteName` 존재 단정).

---

### P0-2. EN 페이지가 SSR에서 `<html lang="ko">`로 나간다 ⭐

**증거 (실측)**

```
.next/server/app/en/blog/audience-broad-vs-narrow.html -> <html lang="ko"
.next/server/app/en/calculator.html                    -> <html lang="ko"
```

**원인** — 루트 `layout.js:68`이 `<html lang="ko">`를 하드코딩하고, `en/layout.js:11`이 클라이언트 스크립트로 사후 교정한다.

```js
<script dangerouslySetInnerHTML={{ __html: "document.documentElement.lang='en'" }} />
```

`<div lang="en">` 래핑(`en/layout.js:13`)이 부분적으로 완화하지만, **초기 HTML의 루트 언어는 여전히 ko**다.

**영향** — 여기가 SEO보다 **GEO에서 더 아프다.** Next는 `htmlLimitedBots`(JS 미실행 봇) 개념을 별도로 두고 있고(`generate-metadata.md:1230`), 다수 LLM 크롤러가 이 부류다. 그 봇들에게는 영어 본문에 한국어 선언이 붙은 문서로 보인다. hreflang과 본문 언어 감지가 대부분 덮어주므로 순위 급락 요인은 아니지만, **JS 없이 읽히는 경로에서 언어 신호가 틀린 것은 사실**이다. (스크린리더도 같은 영향을 받는다 — 접근성 축에서도 실질 결함.)

**제안** — 두 갈래 중 하나. 트레이드오프가 갈리므로 **결정 필요**:

- **(A) `app/en`을 별도 루트 레이아웃으로 분리** — `lang`이 SSR에서 정확해진다. 다만 App Router에서 `<html>`을 두 곳이 소유하게 되므로 폰트·GTM·GA·JSON-LD를 공유 컴포넌트로 추출해야 한다. 근본 해결이지만 리팩터 범위가 있다.
- **(B) 현행 유지 + 명시적 완화** — `<div lang="en">`를 유지하고 스크립트는 그대로. 비용 0이지만 JS 미실행 경로는 계속 틀린다.

권장은 (A)다. EN 콘텐츠가 66편 규모까지 온 이상 언어 신호는 인프라로 고정할 값이지, 클라이언트 스크립트로 교정할 값이 아니다.

---

### P1-3. 도구 페이지에 `BreadcrumbList`가 없다

블로그·용어·계산기는 모두 `BreadcrumbList`를 내는데, **도구 페이지만 빠져 있다**(`[[...slug]]/page.js`, `en/[...slug]/page.js` — grep 결과 0건). 도구는 `SoftwareApplication`+선택적 `FAQPage`만 낸다.

- **영향**: SERP 빵부스러기 표시 기회 상실. 도구가 사이트 IA 어디에 속하는지(분석 > 도구)를 크롤러가 명시적으로 못 읽음.
- **제안**: 홈 → 분석 → 도구명 3단으로 기존 `structuredData` 옆에 추가. `idToPath`·`findMeta`가 이미 있어 배선 비용은 낮다. `@graph`로 묶으면 스크립트 태그가 늘지 않는다.

### P1-4. `sitemap.lastmod`가 하드코딩돼 썩는다

```js
// src/app/sitemap.js:7
const PRODUCT_LAST_MODIFIED = new Date("2026-07-31");
```

오늘이 2026-08-04이고 그 사이 14개 커밋(#569~#582)이 머지됐다. 블로그·용어는 frontmatter 날짜에서 정확히 파생되지만, **도구·가이드·법적 고지 등 routeMap 파생 URL 전체가 고정 과거 날짜**를 쓴다.

- **영향**: 낮다. Google은 일관성 없는 `lastmod`를 대체로 무시한다. 다만 **수동 갱신 의존이라 반드시 표류한다** — 지금이 그 증거다.
- **제안**: 빌드 시각(`new Date()`)으로 대체하거나, 정직성을 지키려면 라우트별 소스 파일의 git mtime을 쓴다. 전자가 실용적이며 "빌드=배포"라 의미도 맞다.

### P2-5. EN 메타 제목이 렌더 후 길어진다

`routeSeo.js` 기준 EN 제목 5건이 40자를 넘는다.

| 라우트 | 제목 길이 | 템플릿 적용 후 |
|---|---|---|
| `guide-index` | 67 | 89 |
| `5-18` | 55 | 77 |
| `start-gate` | 53 | 75 |
| `5-3` | 51 | 73 |
| `5-18-cannibal` | 46 | 68 |

루트 `title.template`이 `%s | Growth Opt Playbook`(+22자)이라 실제 렌더 길이는 표의 오른쪽 값이다. Google은 대략 580px(영문 약 55~60자)에서 잘라내므로 **브랜드 접미가 잘리거나 제목 뒷부분이 사라진다.**

- **참고**: 40자 기준은 CLAUDE.md에 한글 GSC 경고 기준으로 적혀 있다. **영문에 그 기준을 그대로 적용하는 건 과하다** — 영문은 55~60자가 현실적 상한. 위 5건 중 `guide-index`(89)와 `5-18`(77)만 실질 문제고, 68~75자는 경계선이다.
- **제안**: EN 제목은 `absolute`로 브랜드 접미를 생략하거나(`en/page.js:19`가 이미 이 패턴을 쓴다), 제목 자체를 45자 이하로 줄인다.

---

## 4. AAO/GEO 개선사항

`aao-geo-operating-model.md`의 발행 계약은 잘 설계돼 있다. 문제는 **계약과 실제 원고의 이행률 격차**다.

### P0-6. 신뢰·인용 신호 커버리지가 낮다 ⭐

**증거 (실측, `_` 프리픽스 제외)**

| 신호 | KR (33편) | EN (33편) | 이행률 |
|---|---|---|---|
| `answer`(직접 답변) | 전편 | 전편 | ✅ 100% |
| `faq` | 11 | 9 | ⚠ 33% / 27% |
| `sources`(외부 출처) | 6 | 6 | ❌ 18% |
| `reviewedAt`/`reviewer` | 3 | 3 | ❌ 9% |
| `updated` | 5 | — | ❌ 15% |

**해석** — AI 답변 엔진이 특정 소스를 인용할지 판단할 때 쓰는 신호가 정확히 이 셋(1차 출처, 검토 책임자, 갱신일)이다. `answer` 100%는 훌륭하지만, **"누가 언제 확인했고 근거가 무엇인가"가 90% 비어 있다.**

여기서 절대 하면 안 되는 것: 커버리지를 올리려고 `reviewedAt`을 발행일로 채우거나 없는 출처를 만들어 넣는 것. `aao-geo-operating-model.md:15-16`이 이미 금지하고 있고, 그게 맞다. 가짜 신뢰 신호는 신호가 아니라 부채다.

**제안** — 전편 일괄이 아니라 **트래픽 상위 글부터 실제로 검토하고 날짜를 남기는** 운영 루틴. 33편 전부는 비현실적이므로:

1. GSC 노출 상위 10편을 선정 (← GA4/GSC 접근 필요, 현재 미확인)
2. 그 10편만 사실·링크 재확인 → `reviewedAt`+`reviewer` 기입
3. 플랫폼 정책·수치를 말하는 문단에만 공식 문서 `sources` 추가
4. KR/EN 동시 갱신 (§2.11)

`sources`가 6편뿐인 건 **본문이 대부분 자체 실무 근거로 쓰였다는 뜻**이기도 하다. 그건 약점이 아니라 차별점이므로, 외부 출처를 억지로 늘리지 말고 "플랫폼 사실을 인용한 곳"에만 붙이는 현재 원칙을 유지하는 게 맞다.

### P1-7. KR/EN FAQ 파리티 깨짐 (§2.11 위반)

```
faq mismatch: marketing-mix-modeling.md        (KR=있음 EN=없음)
faq mismatch: performance-marketing-metrics.md (KR=있음 EN=없음)
```

두 편의 EN 페이지는 `FAQPage` 구조화 데이터를 못 낸다. §2.11(외부 노출 KR/EN 동시 반영) 위반이며, 하필 MMM·지표라는 핵심 필라 글이다.

- **제안**: 해당 EN 원고에 FAQ 블록 이식. 파리티 테스트를 `contentRegistry.test.js`에 추가해 재발 차단(KR에 `faq`가 있으면 EN 짝도 있어야 한다).
- **정직한 단서**: Google은 2023년부터 FAQ 리치결과를 정부·의료 등 권위 사이트로 제한했다. **이 사이트에서 FAQPage가 SERP 리치결과로 표시될 가능성은 낮다.** 그래도 붙일 값어치는 있는데, 이유는 리치결과가 아니라 **LLM이 Q/A 구조를 파싱하기 쉬워서**다 — 즉 이건 SEO 작업이 아니라 GEO 작업이다. 기대 효과를 리치결과로 잡으면 실망한다.

### P1-8. `llms.txt`는 있는데 `robots.txt`가 안 알려준다

`robots.js:4-10`은 `allow: /` + sitemap만 낸다. `/llms.txt`는 정상 서빙되지만 **발견 경로가 없다** — 에이전트가 URL을 추측해야 한다.

- **제안**: `robots()` 반환에 `/llms.txt`를 주석과 함께 노출. Next의 `robots` 객체는 임의 필드를 지원하지 않으므로 `Sitemap` 라인처럼 넣으려면 커스텀 `route.js`로 바꿔야 한다 — 비용 대비 효과를 보고 판단할 사안이며, 홈 `<head>`에 `<link rel="alternate" type="text/plain" href="/llms.txt">`를 넣는 더 가벼운 방법도 있다(RSS와 같은 패턴, `layout.js:72`).
- **과대평가 금지**: `llms.txt`는 표준이 아니고 주요 엔진이 소비를 보장하지 않는다. 프로젝트 문서가 이미 그렇게 적어뒀으니, 발견성만 올리고 기대치는 올리지 않는다.

---

## 5. 리텐션 개선사항

### P0-9. 복귀 루프가 기본적으로 꺼져 있다 ⭐⭐ (최우선)

**증거** — `useDataStore.js:332-343`:

```js
export const persistPartialize = (state) => {
  const persisted = { viewConfig, customMetrics, customCharts,
    decisionPersistenceEnabled: state.decisionPersistenceEnabled === true };
  if (state.decisionPersistenceEnabled === true) {
    persisted.decisionRecords = sanitizeDecisionReviewRecords(state.decisionRecords);
  }
  return persisted;
};
```

`decisionPersistenceEnabled` 기본값은 `false`(`:417`). 따라서 **기본 사용자에게 벌어지는 일**:

```
월요일: 분석 → 결론 확인 → 결정 저장 → 검토일 = 다음 주 월요일
        ↓ 탭 닫음
다음 월요일: 방문 → decisionRecords = []  → 헤더 배지 없음
        → 지난주 결정 소실 → 처음부터 다시
```

`Header.jsx:65-68`·`Sidebar.jsx:82-85`의 기한 배지는 잘 만들어져 있지만 **읽을 데이터가 없어서 영구히 0**이다. 리텐션 루프의 모든 부품이 존재하는데 **전원이 꺼진 상태**다.

**중요 — 기본값을 켜라는 제안이 아니다.** §2.2와 충돌하고, `persistenceHint`가 경고하듯 결정 메모에는 채널·캠페인·소재명이 남을 수 있다. 공용 기기 리스크가 실재한다. 기본 off는 **옳은 결정**이다.

문제는 **묻는 시점**이다. 현재 토글은 `DecisionReview` 본문 안(`:344`), 즉 `<details>` 접힘 영역 안에 있고, 저장 버튼과 경쟁하지 않는 수동 체크박스다. 사용자가 스스로 "다음 주에도 이게 남아야 한다"를 예측해야 켜진다.

**제안 — 저장 직후 1회 결정 요청**

```
[결정 저장됨]  다음 검토: 8월 11일 (월)

⚠ 이 기록은 이 탭에서만 유지됩니다.
   다음 주에 이 결정을 다시 보려면:

   [이 기기에 저장]        ← 로컬 저장 opt-in (권장)
   [CSV로 내보내기]        ← 저장 없이 파일로 보관
   [이번만 세션 유지]      ← 현행 동작

   * 채널·캠페인·소재명이 기록에 남습니다. 공용 기기에서는 켜지 마세요.
```

- 저장 **직후**에 묻는다 — 그 순간이 사용자가 "다음 주"를 처음 의식하는 유일한 시점이다.
- 3지선다로 프라이버시 존중 유지. 거절도 1급 선택지.
- `decision_persistence_changed` 이벤트가 이미 있으므로(`:354`) **수락률을 바로 측정 가능**하다.
- 세션당 1회. `demoNoticeSeen`과 동일한 휘발 플래그 패턴(§12.28) 재사용.

**이게 1순위인 이유**: SEO 개선은 유입을 늘리고, 이 항목은 **늘어난 유입이 재방문으로 전환되는지를 결정한다.** 유입만 늘리고 이걸 방치하면 획득 비용이 매번 리셋된다.

### P1-10. 검토일이 있는데 복귀 트리거가 없다

`reviewDate`를 받아 기한을 계산하지만(`decisionReview.js`), **그 날짜에 사용자를 데려올 장치가 없다.** 탭을 닫으면 알림 경로가 0이다.

- 캘린더 초대(`.ics`) 없음 — 코드 전체에 `VCALENDAR` 0건
- 이메일 리마인더 없음 (Buttondown은 블로그 발행용이며 목적이 다르다)
- 브라우저 알림 없음

**제안 (비용 순)**

1. **`.ics` 다운로드** — 결정 저장 시 "검토일을 캘린더에 추가". 서버·구독·개인정보 수집 0. `downloadText`(`utils/download.js`)로 즉시 구현 가능하며 §2.2를 전혀 건드리지 않는다. **가성비 최고, 여기부터.**
2. **주간 리뷰 이메일** — 실제 리텐션 효과는 가장 크지만 결정 내용을 서버로 보내야 하므로 §2.2와 정면 충돌한다. 하려면 "사용자가 직접 붙여넣는 요약"처럼 데이터 흐름을 재설계해야 한다. **별도 의사결정 사안이며 이 문서에서 권고하지 않는다.**
3. 브라우저 알림 — 권한 요청 UX 비용이 높고 데스크톱 상주를 전제해 실효성이 낮다. 권장하지 않음.

### P1-11. 재방문 여부를 측정할 수 없다

분석 퍼널은 완비됐지만(§2), **"저번 세션에 저장한 결정을 이번 세션에 검토했는가"**가 측정 불가다. `decisionRecords`가 기본 세션 한정이라 그런 사건이 애초에 발생하지 않는다.

- GA4 기본 new/returning은 방문만 잡고 **루프 완주**를 못 본다.
- `decision_review_completed`는 있으나 같은 세션 내 완주와 주 단위 복귀를 구분할 파라미터가 없다.
- **제안**: P0-9 적용 후 `ALLOWED_PARAMS`에 `days_since_decision` 같은 **버킷값**(`same_session`/`1-3d`/`4-9d`/`10d+`) 1개를 추가. 원본 날짜가 아닌 버킷이므로 allowlist 정신에 부합한다. 이게 리텐션 가설을 검증할 유일한 계기다.

### P2-12. 결정 저장 진입점이 접힘 영역 안에 있다

`DecisionReview`는 `<details>`(`:318`)이며 `ResultActionCard` 안에 위치한다. 2026-08-01 감사 §3의 "접힌 영역에서 결정 기록" 지적이 **아직 유효**하다.

다만 `<summary>`가 추천 행동과 검토일을 접힌 상태에서도 보여주도록 설계돼 있어(`:331-339`) 완전한 숨김은 아니다 — claude-ux §0의 "숨은 어포던스" 회피가 부분 적용된 상태. P0-9(저장 후 프롬프트)를 먼저 하면 이 항목의 체감 비중은 자연히 줄어든다. **P0-9 이후에 재평가할 것을 권한다.**

---

## 6. 실행 순서 제안

의존 관계와 비용을 반영한 순서. 각 단계는 독립 PR로 쪼갤 수 있다.

**1주차 — 배선 누락 (저위험·기계적)**
1. P0-1 `og:site_name`/`og:locale` 공용 헬퍼 → 151 페이지 (**가장 명확한 승리**)
2. P1-3 도구 `BreadcrumbList`
3. P1-4 `sitemap.lastmod` 빌드 시각 파생
4. P1-7 EN FAQ 2편 + 파리티 테스트

**2주차 — 리텐션 루프 점화 (효과 최대)**
5. P0-9 저장 직후 opt-in 프롬프트 ← **전체 최우선**
6. P1-10-①`.ics` 다운로드
7. P1-11 `days_since_decision` 버킷 이벤트

**3주차 — 언어·콘텐츠 (범위 큼)**
8. P0-2 EN 루트 레이아웃 분리 (안 (A)/(B) **결정 필요**)
9. P2-5 EN 제목 길이 정리
10. P0-6 상위 10편 실검토 → `reviewedAt`/`sources` (← GSC 데이터 선행 필요)
11. P1-8 `llms.txt` 발견성

**전제 조건**: 4·10번은 GSC/GA4 데이터가 있어야 판단 가능하다. 접근 권한을 열어주시면 실측 기반으로 우선순위를 다시 정렬해 드릴 수 있다.

---

## 7. 결정이 필요한 사항

작업 전 확인이 필요한 항목만 모았다.

| # | 사안 | 선택지 | 의견 |
|---|---|---|---|
| 1 | **P0-2 EN 언어 신호** | (A) EN 루트 레이아웃 분리 — 근본 해결, 리팩터 범위 있음 / (B) 현행 유지 — 비용 0, JS 미실행 경로 계속 오류 | EN 66편 규모면 (A) |
| 2 | **P1-10 리마인더 범위** | `.ics`만 / 이메일까지 | `.ics`만. 이메일은 §2.2와 충돌하므로 별도 논의 |
| 3 | **P0-6 검토 커버리지** | 상위 10편만 / 33편 전체 | 상위 10편. 전체는 형식적 채움이 될 위험 |
| 4 | 느린 테스트(83초) | `testTimeout` 상향 / 픽스처 축소 | 원인 확인 후 판단 |

---

## 8. 하네스 반영 후보 (§15)

이번 검토에서 나온 재사용 가능한 교훈. 승인 시 CLAUDE.md §7에 압축 반영.

- **Next 16 메타데이터는 `openGraph`를 필드가 아니라 객체 단위로 교체한다** — 자식이 `openGraph`를 선언하면 layout의 `siteName`·`locale`이 **상속이 아니라 유실**. 공용 base 스프레드를 강제하지 않으면 페이지가 늘어날수록 조용히 누락이 번진다. 검증은 빌드 산출물 grep(소스 확인으로는 안 보임).
- **루트 `<html lang>`은 클라이언트 스크립트로 교정하면 SSR 초기 HTML이 틀린 채 남는다** — JS 미실행 봇·스크린리더가 그 값을 읽는다. 다국어는 라우트 레이아웃으로 분리해야 한다.
- **리텐션 부품 완성 ≠ 루프 작동** — persist opt-in이 기본 off면 배지·인박스·검토일이 전부 빈 데이터를 읽는다. 루프 기능 추가 시 "기본 상태에서 데이터가 실제로 흐르는가"를 별도 확인할 것.
- **감사 문서는 실측과 추론을 라벨로 분리** — GSC/GA4 없이 순위·재방문율을 단정하지 않는다(§8).

---

*본 문서는 검토 결과만 담으며 코드 변경을 포함하지 않는다. 구현은 항목별 승인 후 개별 PR로 진행한다.*
