# 카니발라이제이션 클러스터 SEO 노출 급락 감사

기준일: 2026-08-02
대상: 카니발라이제이션·잠식 키워드를 노리는 KO/EN 전 URL + AAO/GEO 신호 적용 상태
기준 코드: `main` @ `acf038d`

## 조사 방법과 한계 (먼저)

- **판정 근거**: 최신 `main` 코드 정적 분석 + 로컬 `npm run build` 산출물의 **실제 SSR HTML**을 파싱해 비교.
- **확인하지 못한 것**: `growthoptplaybook.com`이 이 작업 환경의 네트워크 정책에서 차단(403 CONNECT)되어 **프로덕션 HTML과 Search Console 데이터는 보지 못했다.**
- 따라서 아래는 "코드상 이런 상태이므로 노출이 빠질 조건이 갖춰져 있다"까지의 판정이다. **어느 URL이 얼마나 빠졌는지는 확정하지 않았다.** 확정에 필요한 확인 항목은 §4에 적었다.

## 1. 원인 (근거 강한 순)

### ① 2026-07-29, 카니발 URL이 두 배가 되면서 서로 100% 중복 — 주범 유력

`PR #532`(`be67946`, 2026-07-29)가 5-18을 하위 4개 독립 URL로 분리해 sitemap에 등록했다(`v2-migration/src/lib/routeMap.js:26-29`, `v2-migration/src/app/sitemap.js`의 `publication === "subtool"` 분기).

로컬 프로덕션 빌드에서 각 URL의 SSR HTML을 받아 스크립트·헤드를 제거하고 텍스트만 비교한 결과:

| URL | SSR 본문 | 카니발 페이지와 유사도 |
|---|---|---|
| `/tools/cannibalization-diagnosis` | 2,580자 | 1.000 (기준) |
| `/tools/marketing-trend` | 2,580자 | **1.000** |
| `/tools/mmm-contribution` | 2,580자 | **1.000** |
| `/tools/marketing-forecast` | 2,580자 | **1.000** |
| `/tools/marketing-response` | 4,129자 | 0.769 |

**하위 4개 URL의 본문 텍스트가 글자 단위로 완전히 동일하다.** 차이는 `<title>`·`meta description`·canonical뿐이다. 네 URL 모두 5-18의 동일한 "데이터 준비"(CSV 업로드) 화면을 서빙하기 때문이다.

sitemap에는 이 클러스터가 KO/EN 합쳐 **16개 URL**로 올라가 있다.

```
/blog/cannibalization-organic-paid        /en/blog/...
/glossary/cannibalization                 /en/glossary/...
/guide/cannibalization-analysis           /en/guide/...
/tools/marketing-response                 /en/tools/...
/tools/cannibalization-diagnosis          /en/tools/...
/tools/marketing-trend                    /en/tools/...
/tools/mmm-contribution                   /en/tools/...
/tools/marketing-forecast                 /en/tools/...
```

내용이 같은 URL이 한 번에 늘어나면 Google은 "중복 페이지 — 표준 페이지를 Google이 다르게 선택함"으로 처리하고, 클러스터 전체의 색인 신뢰도가 떨어진다.

### ② 같은 날 5-18 부모 페이지 제목이 MMM → 잠식으로 교체

`f7f5e5a`(`#523`, 2026-07-29)에서 `v2-migration/src/lib/routeSeo.js`가 신설됐다. `v2-migration/src/app/[[...slug]]/page.js:25`의 우선순위가 `routeSeo?.title || meta?.seoTitle || meta?.title`이라, `useDataStore.js:217`에 있던 기존 SEO 제목이 덮였다.

| | KO 제목 | EN 제목 |
|---|---|---|
| 이전 (`useDataStore`) | MMM 분석: 광고비, 어디서 벌고 어디서 잃는지 분해 | MMM Analysis: See Where Your Ad Spend Wins and Cannibalizes |
| 이후 (`routeSeo`) | **광고 잠식 분석** (7자) | Ad Cannibalization Analysis |

손해가 두 겹이다.

1. MMM 계열 키워드가 제목에서 통째로 사라졌다 → **MMM 쿼리 노출도 같이 빠졌을 가능성이 크다.**
2. 하위 URL의 `광고 카니발 진단`(`routeSeo.js:66`)과 정면으로 겹친다. 7자 제목은 Google이 재작성하기도 쉽다.

`description`도 MMM 중심에서 잠식 중심으로 함께 바뀌었다.

### ③ 도구 페이지는 크롤러에게 사실상 빈 페이지

`v2-migration/src/app/[[...slug]]/PageClient.jsx:23`이 모든 도구를 `next/dynamic` + `loading: () => 로딩 중…`으로 로드한다.

SSR HTML 2,580자의 구성:

- 전 페이지 공통 사이드바 + ⌘K 명령 팔레트 목록 ≈ 2,000자
- 이 페이지 고유 콘텐츠 ≈ 500자 (CSV 업로드 안내 문구)
- 도구 UI 자리 = `로딩 중…`

추가로 **`<h1>`이 없다.** SSR HTML에 존재하는 헤딩은 `<h2 class="section-title">데이터 준비`가 전부다. 상업적 head term을 노리는 페이지에 H1이 없고 고유 본문이 500자인 상태다.

JS를 실행하지 않는 크롤러(대부분의 AI 크롤러 포함)에게 이 페이지들은 내용이 없는 셸이다.

### ④ 블로그 글 자체가 클러스터에서 가장 얇음

`v2-migration/content/blog/cannibalization-organic-paid.md`

- 렌더된 `<article class="blog-prose">` 본문 = **895자** (KO 33편 중 뒤에서 2번째, 어절 기준 93)
- 유입 내부링크 4개뿐: `apple-search-ads-guide`, `aso-basics-guide`, `retargeting-reengagement-guide`, `glossary/cannibalization`
- 표·숫자·사례·이미지·FAQ 전무
- `content/glossary/cannibalization.md`(386자)와 검색 의도 중복 — 두 페이지가 모두 "카니발라이제이션 뜻"을 노린다. 문자 단위 유사도는 0.251로 낮지만, 문장 단위로는 서로 패러프레이즈 관계이고 목차 구조("왜 위험한가 / 어떻게 확인하나")도 겹친다.

메타상 문제는 없다. `<title>`은 `blogSeo.js`의 `광고 카니발라이제이션이란? 유료·오가닉 잠식 측정`이 정상 적용되고 H1도 같은 문자열이라 제목-본문 불일치는 없다. hreflang(ko/en/x-default)·canonical·keywords 모두 정상 출력된다. **순수하게 본문 분량과 고유 정보량이 부족하다.**

### ⑤ 허위 최신성 신호 (부수)

`v2-migration/src/lib/blogSeo.js`의 `UPDATED_2026_07_28` 집합에 이 글이 포함돼 `dateModified: 2026-07-28`로 출력된다. 그러나 git 이력상 이 `.md` 파일은 최초 커밋 이후 **한 번도 수정된 적이 없다**(`git log --follow`로 확인 — 파일 생성 커밋 2건 외 변경 없음).

`docs/aao-geo-operating-model.md`의 자체 규칙 "발행일을 검토일처럼 바꾸지 않는다"와 모순이며, CLAUDE.md §2.8 정직성 원칙에도 어긋난다.

## 2. AAO/GEO 적용 상태

### 잘 되어 있는 것

| 항목 | 상태 |
|---|---|
| `answer` 직접답변 SSR 첫 화면 노출 | ✓ 발행 33편 전체 (`blogEditorial.js` + `blog/[slug]/page.js`의 `content-answer` aside) |
| `conditions` 적용조건 | ✓ 전체 노출 (단 §2 구조 문제 참조) |
| BlogPosting + BreadcrumbList JSON-LD | ✓ SSR 포함 |
| 용어사전 DefinedTerm | ✓ |
| hreflang ko/en/x-default, canonical | ✓ |
| robots 전체 허용 + sitemap 고지 | ✓ |
| 본문 외부 HTTPS 링크 → `sources`/`citation` 자동 수집 | ✓ (`blog.js:extractExternalSources`) |
| 운영 기준 문서 | ✓ `docs/aao-geo-operating-model.md`, `docs/aao-geo-query-set.md` |

### 커버리지 구멍

| 신호 | KO 33편 중 적용 | 카니발 글 |
|---|---|---|
| `answer` | 33편 | ✓ |
| `conditions` | 33편 | △ 공용 문구 |
| FAQ → FAQPage JSON-LD | **8편** | ❌ |
| `sources` → `citation` | **3편** | ❌ (`citation: None`) |
| `reviewedAt` / `reviewer` | **1편** | ❌ (EditorialTrust 빈 렌더) |

EN은 FAQ 6편으로 KO보다 더 적다.

### 구조적 문제 4가지

1. **`conditions`가 그룹 공용 boilerplate.**
   `blogEditorial.js`의 `CONDITION_GROUP_BY_SLUG`가 slug를 6개 그룹에 매핑하고, `CONDITIONS`가 그룹당 문장 하나를 준다. `causal` 그룹 7편(`cannibalization-organic-paid`, `correlation-vs-causation`, `incrementality-measurement`, `marketing-mix-modeling`, `aha-moment-retention`, `aha-event-ad-optimization`, `ab-testing` 일부)이 **글자 단위로 동일한 "적용 조건" 문장**을 렌더한다. 페이지 고유성이 0이고, GEO에서 "이 답이 언제 성립하는가"를 구분해주지 못한다.

2. **author가 Organization뿐.**
   `blog/[slug]/page.js:buildPostJsonLd`에서 `author`와 `publisher`가 같은 Organization 노드다. Person 저자도, 저자 소개 페이지도 없다. E-E-A-T가 약하다.

3. **관련 용어 앵커텍스트가 raw slug.**
   `blog/[slug]/page.js:196`이 `{slug}`를 그대로 출력해서 화면·HTML에 `cannibalization`, `incrementality`로 찍힌다. 한글 용어명이어야 한다.

4. **도구 페이지에 AAO 신호가 전혀 없다.**
   H1·FAQ·HowTo·SSR 본문 모두 부재(§1-③). AI 크롤러 대부분이 JS를 실행하지 않으므로 공개 도구 10개 + 하위 4개가 GEO 대상에서 사실상 제외돼 있다.

## 3. 조치 후보

각각 독립적으로 적용 가능하다.

### A. 중복 해소 + 제목 원복 (최소·즉효)

- 하위 4개 URL을 sitemap에서 제외하고 `/tools/marketing-response`로 canonical 통합, 또는 각 하위 화면에 고유 SSR 본문을 부여
- `routeSeo.js`의 `5-18` 제목·설명을 MMM 중심으로 원복(또는 `useDataStore`의 `seoTitle`로 폴백)
- `5-18`(`광고 잠식 분석`)과 `5-18-cannibal`(`광고 카니발 진단`)의 제목 충돌 해소
- 대상: `routeSeo.js`, `sitemap.js`, `routeMap.js` — 20줄 내외

원인 ①②를 해결한다.

### B. A + 콘텐츠 보강

- 카니발 글을 브랜드검색 사례·측정 절차·수치 예시 중심으로 증량
- FAQ, `sources`, `reviewedAt`/`reviewer` 추가 (KR/EN 동시 — CLAUDE.md §2.11)
- 용어사전과 역할 분리: 용어사전 = 정의, 블로그 = 측정법
- `UPDATED_2026_07_28`에서 실제 편집하지 않은 글 제거 (원인 ⑤)
- `conditions`를 causal 그룹 7편에 대해 글별로 분리
- 관련 용어 앵커텍스트를 slug → 용어명으로 교체

원인 ④⑤와 AAO 커버리지 구멍을 해결한다.

### C. 도구 페이지 SSR 본문 + H1

`PageClient.jsx`의 dynamic import 경계를 바꿔 도구별 고유 설명·H1을 SSR에 포함시킨다. 범위가 크므로 별도 세션 권장.

원인 ③과 GEO 구조 문제 4를 해결한다.

## 4. Search Console에서 먼저 확인할 것

원인 ①과 ② 중 무엇이 주범인지 가르는 항목이다.

- [ ] `/tools/cannibalization-diagnosis`의 **색인 상태** — "중복, 사용자가 선택한 표준 없음" 또는 "Google이 다른 표준 선택"으로 잡혔는지
- [ ] 2026-07-29 전후 `/tools/marketing-response`의 **MMM 계열 쿼리 노출** 변화 (②의 영향 크기)
- [ ] `/blog/cannibalization-organic-paid`의 노출이 빠진 쿼리가 정의형("뜻")인지 측정형인지 — 정의형이면 용어사전과의 자기잠식, 측정형이면 도구 페이지와의 자기잠식
- [ ] 하위 4개 URL(`trend`/`cannibal`/`mmm`/`forecast`)의 색인 등록 시점과 등록 직후 클러스터 전체 노출 추이

## 5. 재현 방법

```bash
cd v2-migration
npm ci && npm run build
npx next start -p 3111 &

# 하위 4개 URL SSR 텍스트 동일성 확인
for p in cannibalization-diagnosis marketing-trend mmm-contribution marketing-forecast; do
  curl -s "http://127.0.0.1:3111/tools/$p" -o "/tmp/$p.html"
done
# 스크립트·head 제거 후 difflib.SequenceMatcher 비교 → 1.000

# 블로그 본문 분량
# .next/server/app/blog/cannibalization-organic-paid.html 의
# <article class="blog-prose"> 내부 텍스트 = 895자
```
