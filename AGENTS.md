# Performance Marketing Library — Agent Harness

이 프로젝트 작업하는 모든 에이전트 인스턴스(Codex·Claude 등)가 따르는 규칙·아키텍처·작업 방식.
**본 `AGENTS.md`가 정경(SSOT)이다.** 루트 `CLAUDE.md`는 `@AGENTS.md` 한 줄 포인터 — 갱신은 여기 한 곳만, 복사본 만들지 말 것.
2026-08 압축본. 과거 PR별 상세 내러티브는 git 히스토리·PR·`docs/*.md` 보존.

---

## 1. 프로젝트 정체성 + 에이전트 역할

- **이름**: Performance Marketing Library (Ops Dashboard)
- **목적**: 앱 퍼포먼스 마케팅 SOP 문서 + CSV 기반 운영 데이터 분석 도구
- **배포**: Railway — `main` 자동 deploy. Root Directory=`v2-migration`. **커스텀 도메인 `growthoptplaybook.com`**(SEO canonical/OG/sitemap/robots/`rss.xml`[네이버 제출용, `app/rss.xml/route.js`]는 `routeMap.js` `SITE_URL` SSOT + `layout.js` 하드코딩). AdSense `ca-pub-3073450406371629`(layout Script·meta·`public/ads.txt`).
- **저장소**: `https://github.com/noelnme-gondry/MKT_Library`
- **타겟**: 시니어 퍼포먼스 마케터 (KR 시장, 한글 UI)
- **데이터 민감도**: 마케팅 운영 데이터 = 사내 민감 자료. **클라이언트 사이드 처리만**, 서버 전송 금지.

### 1.1 역할 분담 (2026-08~)
| 에이전트 | 역할 | 주 작업 |
|---|---|---|
| **Codex** | **주 구현** | 기능 개발·리팩토링·버그픽스 PR 작성 |
| **Claude** | **감사(audit)** | 머지된/열린 PR 리뷰, 회귀·정직성 검증, 함정 기록(§15) |

둘 다 본 파일 전체를 따른다. 역할은 기본값일 뿐 — 사용자가 지시하면 어느 쪽이든 반대 역할을 수행한다. 감사 흐름은 §6.2.

---

## 2. 절대 원칙 (NEVER 깨지 말 것)

1. **v2 Next.js가 유일 런타임**: 레거시 `index.html` 단일 파일 앱은 Phase 8 컷오버로 **제거 완료**(git 히스토리 보존). 모든 작업은 `v2-migration/`에서 — `src/utils/*`(순수 수학 엔진, 골든 검증), `src/components/`(React), `src/store/`(Zustand). 루트에는 `docs/`·`supabase/`·`scripts/`와 본 하네스만 있다.
2. **클라이언트 사이드 100%**: 사용자 CSV 브라우저 메모리에만. 서버 전송/저장 절대 금지.
3. **Supabase service_role key 절대 요청·저장·언급 금지**. anon public key만 (RLS 보호).
4. **main 직접 push 금지**. 단명 브랜치 → PR → squash merge 필수.
5. **Force push to main 금지**. hook skip(`--no-verify`) 금지.
6. **`git add -A`/`git add .` 금지** — 사용자 드롭한 민감 데이터·대용량 폴더 통째 커밋 위험(PR #54 사고). 항상 `git status` 확인 후 **변경 파일만 명시**. 외부 데이터는 먼저 `.gitignore`. **`.legacy-local/`(루트 로컬 보관함)은 참조·검색·편집·커밋 전부 금지** — 구 디버그 산출물·외부 자료일 뿐 앱 소스가 아니다.
7. **모호한 결정 임의 확정 금지** — 선택지 2개+면 사용자에게 옵션·트레이드오프와 함께 묻기.
8. **정직성**: 동작 안 하는 기능·거짓 숫자·보안모델과 모순되는 카피 금지. 추정 불가하면 "추정 불가" 정직히.
9. **병렬 사용 환경 동기화 의무**: Codex·Claude·Antigravity 병렬 작동 중 — 작업 시작 전 항상 `git fetch`+`git status`, 리모트와 다르면 사용자에게 "pull 후 진행?" 확인.
10. **전체 파일 덮어쓰기·임의 포맷팅 금지**: 충돌·작업유실 방지. 무관한 코드 들여쓰기·포맷 임의 변경 금지, 정확히 타겟팅된 부분(Delta)만 수정.
11. **외부 노출 KR/EN 동시 반영**: UI·카피·CTA·링크·SEO 메타·구조화 데이터·공개 문서·랜딩·도구 흐름을 수정하면 **같은 작업에서 EN도 의미·기능·라우트 기준으로 동등하게** 수정하고 KR/EN 검증을 함께 실행. EN 미지원 페이지는 반쪽 번역 말고 `EN_READY_*` 게이트 유지.

---

## 3. 기술 스택

> **이건 당신이 아는 Next.js가 아니다.** Next.js 16은 API·컨벤션·파일 구조가 학습 데이터와 다를 수 있다. 코드 쓰기 전에 `node_modules/next/dist/docs/`의 실제 가이드를 읽고, deprecation 경고를 무시하지 말 것.

```
Next.js 16 (App Router, Turbopack) · React 19 · Zustand 5 · Chart.js 4 · PapaParse 5
gray-matter+marked (블로그 MD, 빌드타임·server 전용) · SheetJS (xlsx 워커)
v2-migration/
├─ src/utils/*.js        순수 통계엔진 (ESM export, vitest 골든) — 수학 절대 변경 금지
├─ src/components/       React (tools/·dashboard/·ds/·landing/·data-import/)
├─ src/store/useDataStore.js   Zustand — IA·csvGroups·필터·라우트 상태
├─ src/lib/              도메인 로직 (analysis-router·data-import·decisionReview…)
└─ src/app/              App Router ((ko)/·(en)/·blog/)
```
- **검증**: `npm run test:all`(vitest golden+smoke) · `npm run lint`(eslint 0 errors 유지) · `npm run build`
- **CSS**: Obsidian Flux 토큰(`--bg-1`·`--text-muted`·`--border`)+다크/라이트 **전역**(`globals.css`, `:root`+`body.light-mode`). CSS Modules는 일회성만(토큰 스코핑 불가). Tailwind 미사용.
- **Supabase**: 전체 무료 전환으로 **미사용** — `layout.js`에 스크립트 주석화(`TODO(B2B)`). service_role key 규칙(§2.3) 불변. 접근키·Pro 페이월은 제거됨.

---

## 4. 아키텍처

### 4.1 라우팅
- **Path 기반** — `src/lib/routeMap.js`가 `id ↔ slug` SSOT(`{ id:"5-2", slug:"/dashboard", component:"Dashboard" }`), `app/(ko)/[[...slug]]` catch-all + `PageClient`가 디스패치. EN은 `(en)/en/*` 대칭.
- `IA` 배열(store)이 사이드바 구조(`SECTIONS → groups → items`). `findMeta(id)` 메타 조회.
- **내부 id(`5-2`)는 절대 불변** — routeMap·store·CSV 그룹·분석 게이트 수백 곳 의존, 북마크 깨짐. 표시 번호만 바꾸려면 `displayItemNumber(id)`/`displayGroupNumber(id)` 순수함수(§12.6).
- 라우트 추가 시 `sitemap.js`·`rss.xml` 동반 갱신. **새 라우트/레이아웃도 반드시 공용 셸**(`Sidebar`+`Header`+`GlobalModals`) 사용 — 슬림 헤더 재도입 금지(§12.28).

### 4.2 현재 도구
| ID | 도구 | 데이터 |
|---|---|---|
| 1-x~4-x | SOP 문서 | 정적 JSON |
| 5-2 | 운영 대시보드 (스코어카드·페이싱·이상탐지·LTV·코호트·퍼널·세그먼트·시즈널리티) | 효율 CSV |
| 5-21 | 캠페인 성과 변동 (PVM 무잔차 분해) | 효율 CSV 공유 |
| 5-22 | 캠페인 포화도 진단 (한계 CPA/ROAS vs 평균) | 효율 CSV 공유 |
| 5-3 | 예산 배분 시뮬레이터 (절대 CPR/ROAS 가중 + 한계효용 그리디) | 효율 CSV 공유 |
| 5-4 | 실험 분석 (A/B: 설계+판독) | 수동/CSV |
| 5-23 | 증분 분석 (홀드아웃 3방법: 통제군·신규켜기·종료) | 자체 CSV |
| 5-24 | 브랜드 캠페인 증분 분석 (ITS·AR(1)·대조군 연결) | 자체 CSV |
| 5-18 | 마케팅 반응 분석 (카니발 진단·MMM 기여·회귀+미래예측) | 주간 패널 CSV |
| 5-20 | 핵심 가치 발굴 (Aha-moment 윈도우×횟수 그리드) | 이벤트 CSV |
| 5-25 | 다중공선성 점검 (채널 지출 VIF·상관 — MMM 전 진단) | 자체 CSV |
| 5-26 | ASA 키워드 (Exact 승격·CPT 조정) | 자체 CSV |
| 9-6 | 소재 분석 (지표·피로도·포레스트) | 소재 daily CSV |
| 9-1 | 콘텐츠 요소 분석기 (요소별 성과 기여) | 콘텐츠 CSV |
| 9-2·9-3·9-7 | 콘텐츠 Aha·트래픽 변동·운영 대시보드 (`hidden:true`) | 콘텐츠 CSV |
| — | `/start` 진입 게이트 · `/weekly-review` 결정 검토 · `/blog` · `/guide` | — |

전 도구 free(티어·페이월 없음). 흡수된 구 도구 id는 redirect로 보존.

### 4.3 CSV 상태 = 그룹 스코프 (Zustand)
```js
csvGroups[group]   // 그룹별 슬라이스 {raw, headers, mapping, fileName, canonicalData, mappedRows}
activeDataGroup    // 현재 활성 그룹 (비-도구 라우트에선 마지막 도구 그룹 유지)
csvData            // 활성 그룹 슬라이스의 미러 — 소비자는 이것만 읽음
```
- `TOOL_GROUP`(`src/lib/toolGroups.js`)이 `라우트 id → 그룹`. 같은 grain은 슬라이스 공유(efficiency=5-2·5-21·5-22·5-3·start-gate), 이질 도구는 격리(aha·creative·experiment·response·incrementality·brand_incrementality·collinearity·asa_keyword·content_*).
- `setCurrentRouteId` → 미러 스왑 + 그룹별 `dashboardFilter` 승계. `setCsvData` → `groupForRoute(currentRouteId)` 슬라이스에 쓰기.
- **CSV를 쓰는 라우트는 도구가 아니어도 `TOOL_GROUP`에 등록**(읽기·쓰기 그룹 불일치 = 업로드 소실, §7).
- 필수/옵션 필드: `TOOL_REQUIRED_FIELDS`+`TOOL_OPTIONAL_FIELDS`(`utils/csvConstants.js`). 자동매핑은 `lib/data-import/mappingContract.js`가 **도구 스코프로** 호출.

### 4.4 캐시 · 계산 게이트
무거운 계산은 **`분석하기` 게이트(`analyzedByGroup`/`isGroupAnalyzed`) 뒤에서만** 실행. 매핑 편집 중 UI는 행 순회 없이 colMap만으로 파생. 토글 클릭은 lookup만(재계산 X). 무거운 compute는 모듈 순수함수로 추출 + 더블 rAF 디퍼로 `ds/AnalyzingOverlay` 먼저 페인트(§7).

---

## 5. 코드 컨벤션

- **JS/React**: `var` 금지·`const` 기본·재할당만 `let`. 순수 함수 우선, 사이드이펙트 명시. `camelCase`, boolean은 `is*`/`has*`/`can*`. 통계 함수는 `ALLOC_MATH`·`PVM_MATH` 같은 객체/모듈에 모음(단위 테스트 가능). setState-in-effect 회피(파생값으로).
- **CSS**: 의미적 토큰(`--bg-1`·`--text-muted`·`--border`). 인라인 style은 일회성만, 공용은 클래스(`chart-container` 등).
- **한/영**: UI 표시=한글, 코드 식별자=영어, 주석=한글 OK. CSV 헤더 한글 alias 등록 가능. 외부 노출은 §2.11에 따라 KR/EN 함께.
- **Chart.js**: `responsive:true, maintainAspectRatio:false` 항상. 부모 `.chart-container`. 색·텍스트는 **`chartCommonOpts()`+`CHART_THEME` getter**(하드코딩 hex·CSS `var()` 리터럴 금지, §7). 재렌더 전 destroy. 조건부 마운트 캔버스는 생성 직후 rAF `resize()` 1회. PNG는 배경 깔고 합성 export.

---

## 6. 작업 워크플로우

### 6.1 구현 흐름 (PR)
1. 요청 받음 → 모호하면 옵션·트레이드오프 제시하고 묻기(§2.7).
2. **시작 전 항상 `git fetch origin main` + `git status`**: 차이 있으면 "pull 후 진행?" 확인. 최신 main 위 **단명 브랜치**(`feat/xxx`·`fix/xxx`·`docs/xxx`) 생성. **장수 브랜치 재사용 금지**(conflict·역행 위험).
3. 변경 후 **검증 필수**: `npm run test:all` + `npm run lint` + 필요 시 `npm run build`. 순수함수 밖(렌더 분기·상태 배선)은 골든이 못 잡으므로 **스모크 테스트 또는 재현 스크립트**로 보강(§7).
   **preview MCP 육안검증은 생략** — Gondry님이 브라우저에서 직접 확인. 콘솔 에러 재현 같은 실행 디버깅엔 써도 되지만 스크린샷 루프는 금지(§7 캡처 아티팩트).
4. `git add <명시 파일>` + 커밋(§6.3).
5. push → PR 생성(base `main`). 본문: `## Summary` bullets + `## Test plan` checkboxes.
6. squash merge → 머지 확인 후 브랜치 삭제.

### 6.2 감사 흐름 (Claude 기본 역할)
1. 대상 PR/커밋의 **diff 전체**를 읽는다(요약만 보고 판단 금지).
2. **주장 검증**: PR 본문이 말하는 효과가 실제 코드에 있는지. 특히 "고쳤다"는 회귀가 재현 스크립트로 정말 사라졌는지.
3. **회귀 탐색**: 바뀐 함수의 다른 호출자, 파생 상수(`TOOL_GROUP`→`TEMPLATE_FAMILY` 류), 읽기·쓰기 경로 비대칭, 스코프 축소가 하류에 미치는 영향.
4. **정직성 점검**(§8): 화면에 뜨는 숫자가 실제 계산인지, 무유의를 "효과 없음"으로 단정하지 않는지, 데이터 없는 상태를 날조하지 않는지.
5. 발견은 **재현 가능한 형태로**(입력 → 기대 → 실제) 보고. 심각도 순 정렬, 추측은 추측이라고 명시.
6. 고치기로 하면 §6.1로 전환. 확인된 일반 교훈은 §7·§12에 기록(§15).

### 6.3 commit 메시지
1행 요약(50자 이내, 한글 OK) + 본문 섹션별(사유·근거 중심) + 마지막 `Co-Authored-By:` 라인 필수.

---

## 7. 버그 트리아지 + 알려진 함정

**트리아지 5단계**: ① 증상 확인(스크린샷·콘솔) ② 재현(임시 테스트/스크립트로 실제 데이터 파싱+의심 함수 직접 호출) ③ 근본 원인(line-by-line, edge case: 윤년/0/NaN/빈배열/타입) ④ 방어 코드 + 진단 패널 ⑤ `test:all`+`lint` 재실행 후 commit.

### 알려진 함정 (재사용 가능한 일반 교훈)

**데이터·CSV**
- **CSV 콤마**: `"2,488"` 쌍따옴표 안 콤마. PapaParse 사용(직접 split 금지). **dynamicTyping 없이** → 모든 값 문자열, `Number()`/`parseFloat`.
- **CSV 다운로드 = CRLF + BOM**: `join("\n")`은 Excel에서 한 행으로 뭉침(RFC4180 위반). **`\r\n` 조인 + BOM + `text/csv;charset=utf-8`**(공용 `utils/download.js`). 콤마는 따옴표 이스케이프. 날짜 문자열 컬럼은 `parseFloat`가 연도만 뽑으므로 원본 라벨 별도 보존(`weekLabel`).
- **`type="number"`는 천단위 콤마 표시 불가**: 금액 입력은 v2 **`CommaNumberInput` 재사용**(type=text·표시 콤마·읽기 strip·blur 재포맷). `parseFloat("72,341,057")=72` 함정 — 모든 read 사이트에서 콤마 strip 필수(하나라도 빠지면 분배 0 버그).
- **CSV 자동매핑은 도구별 필드로 스코프**: 전체 `STANDARD_FIELDS`로 매핑하면 그 도구가 안 쓰는 필드까지 잡아 "매핑됐는데 기능엔 못 씀". `TOOL_REQUIRED_FIELDS`(oneOf 포함)+`TOOL_OPTIONAL_FIELDS` 합집합으로 제한. 주의: `cost`(효율)와 `spend`(Creative)는 별도 키 — 같은 "비용"이라도 grain 따라 다름. **엔진이 어떤 표준키를 읽는지 항상 확인**(PVM/creativeMath는 `r.spend` → `getMappedRows`에서 cost↔spend 양쪽 채움).
- **헤더명이 아니라 "값"으로 매핑하는 필드는 `valueVocabulary`**(source=광고/오가닉): 헤더/타입 점수 무시하고 값 어휘 매칭만 사용. **숫자 컬럼(`numericRate≥0.8`)은 enum 어휘 후보에서 제외**하고 **짧은 토큰(≤2자)은 정확일치만** — `"850000".includes("0")`으로 비용·설치가 `campaign_on`에 선점되는 사고(PR #603).
- **CSV를 "쓰는" 라우트는 반드시 `TOOL_GROUP`에 등록**(PR #603→#604): 읽기(sticky `activeDataGroup`)와 쓰기(`groupForRoute`)가 다른 그룹을 고르면 재진입 시 미러가 빈 슬라이스를 가리켜 **방금 올린 CSV가 사라진다**. `TOOL_GROUP` 파생 상수(`TEMPLATE_FAMILY` 등)에 새 id가 딸려 들어가는지도 확인.
- **그룹·라우트 목록을 두 곳에 나열하지 말 것 — 파생시켜라**(PR #608→#610): `TOOL_GROUP`엔 있는데 스토어 `csvGroups`엔 없던 그룹 하나가 미러를 `undefined`로 만들어 도구를 렌더 throw로 죽였다(5-24, 배포된 채 하루). 같은 사고가 `/start`에서도 났다(#604). 지금은 세 맵이 `buildGroupMap()` 파생 — **"한 곳에 추가하면 다른 곳도 고쳐야 한다"는 주석이 보이면 그게 곧 다음 버그다.** 파생이 불가능하면 최소한 정합 테스트를 둘 것.
- **커버리지 가드가 손으로 쓴 배열을 돌면 가드가 아니다 — 그리고 고친 파일 옆에서 그대로 재발한다**: `toolOg.test.js`가 "every published tool"이라며 하드코딩 배열을 돌아 5-25·5-26을 놓쳤고(generic OG·빈 featureList 배포), 그 파일만 파생으로 고친 뒤 **옆의 `routeSeo.test.js`가 똑같은 형태로 똑같은 두 도구를 놓치고 있었다**(5-26 KO 32자·EN 69자가 한도 30·60을 넘긴 채 통과). 파생(`ROUTES.filter(isRouteIndexable)`)으로 바꾸자마자 검사된 적 없던 `guide-index`·`start-gate` 설명 초과 2건이 추가로 나왔다. **교훈을 적용할 땐 같은 패턴의 파일을 전부 grep해서 한 번에 고칠 것** — 한 곳만 고치면 교훈이 기록됐다는 사실이 남은 구멍을 가린다. **가드가 있다는 사실이 가드가 없다는 사실을 가린다.** 같은 이유로 "완료" 문구도 하네스에 적기 전에 grep으로 셀 것(§12.27의 미채택 목록은 두 번 연속 낡은 채였다).
- **골든값은 출력에서 전체 자릿수로 복사할 것 — 눈으로 채우면 9번째 자리부터 틀린다**(2026-08-15): Fisher 참조값을 `.toFixed(10)` 출력만 보고 뒤 자릿수를 지어냈다가 테스트에 잡혔다. 참조는 **구현과 다른 경로**로 산출하고(BigInt 고정소수점·닫힌형·손계산) 전체 자릿수를 그대로 붙여넣을 것. 값이 안 맞을 때 tolerance부터 늘리면 그 순간 골든이 아니다.
- **큰 정규화 상수를 그대로 두면 Lanczos 오차가 결과에 실린다**(같은 작업): 초기하 합에서 `logChoose(N,m)`은 모든 항에 공통이라 해석적으로 상쇄되는데, 계산해서 빼면 log값 ≈1800의 오차가 남아 정확값과 3e-11 어긋났다. **관측점 기준 상대 로그확률로 바꾸니 5e-16**(ΣP=1도 구성상 보장). 로그-스페이스 합산은 항상 상대값으로.
- **같은 열에 다른 단위를 담으면서 이름을 안 바꾸면 그게 거짓 숫자다**(같은 작업): 로그 링크 계수의 지수는 오즈비가 아니라 발생률비(IRR)다. family를 바꿔 붙일 땐 열 이름·해석 문구·판정 방향을 함께 스왑할 것.
- **판별기가 못 가르는 건 못 가르는 대로 두고 화면이 사유를 말하게 할 것**(같은 작업): 저카디널리티 정수가 카운트인지 순서형 코드인지는 데이터만으로 구분 불가다. 휴리스틱을 더 얹는 대신 한계로 남기고 고른 모형과 사유를 노출해 사용자가 뒤집게 했다.
- **라우트 종류로 갈리는 게이트는 "나머지 종류"를 통째로 배선 밖에 둔다**(2026-08-14 감사): `page.js`의 `isTool = id.startsWith("5-")||startsWith("9-")` 하나 때문에 가이드 15개가 FAQPage·BreadcrumbList 없이, `buildEvidenceLinks`의 같은 조건 때문에 아웃바운드 링크 **0건**으로 나가고 있었다(공개 라우트의 절반). `routeSeo` 엔트리도 없어 description이 그룹 desc 폴백 → 같은 그룹끼리 통째로 중복. **이런 게이트를 새로 쓸 땐 "그럼 나머지 라우트는 무엇을 받나"를 그 자리에서 답할 것.**
- **KR이 주 시장인데 EN만 배선되는 역전이 반복된다**(같은 감사): EN 가이드는 `{id}.en.json` deck으로 페이지별 고유 description을 받는데 KO는 JSON이 2개뿐이라 폴백으로 떨어졌다. `llms.txt`에서 이미 같은 역전을 고쳤던 자리다(주석에 기록까지 있었다). **로케일 분기 폴백을 쓸 때 KO 경로가 EN보다 얇아지지 않는지 확인.**
- **목록에서 "빠진 것"과 "의도적으로 뺀 것"은 코드에서 구분돼야 한다**(같은 감사): `/start`의 `ROUTER_TOOL_IDS`는 5-23을 `filter`로 명시 제외했지만 5-20·9-1은 계약이 그냥 없어서, 두 도구가 추천에서 영구 부재인 게 결정인지 사고인지 알 수 없었다(사고였다). 제외는 주석 달린 명시 제외로, 커버리지는 SSOT 파생 테스트로 고정할 것.
- **"죽은 코드"로 보이는 데이터에 다른 소비처가 있을 수 있다**(같은 감사): 스토어 IA의 `seoTitle*` 34개는 `routeSeo`가 항상 이기므로 SERP에 도달하지 않지만, `GlobalModals`가 ⌘K 검색 텍스트로 쓰고 있었다. 지웠으면 명령 팔레트 매칭이 조용히 나빠졌다. **삭제 전 이름 전수 grep** — 주석만 사실에 맞게 고치는 게 답일 때가 있다.
- **한 도구의 두 도메인이 같은 id를 공유하면 라벨팩이 엇갈린다**(같은 감사): 9-6 라우트는 `domain="performance"`(소재)로 렌더되는데 `uploaderToolId`는 `"5-6"`이고 `TOOL_GUIDE`엔 `"9-6"`(콘텐츠 문구)만 있었다 → `CsvGuide`가 null을 반환해 **업로드 안내가 통째로 사라졌다**(작성된 카피 70줄이 도달 불가). 리라벨 도구는 id·문구·필드 계약 셋이 각각 어느 도메인 것인지 확인하고, `TOOL_GROUP` 파생 커버리지 테스트로 고정할 것.
- **스모크 `beforeEach`의 상태 주입이 진입 경로를 우회한다**(같은 사고): 셋업이 store 슬라이스를 직접 넣어주면 실제 사용자 경로(`setCurrentRouteId` → 미러 스왑)를 안 밟아 크래시를 놓친다. 진입 경로 자체를 밟는 케이스를 **따로** 둘 것. 초기 상태 불변식은 다른 describe의 `beforeEach`에 오염되므로 별도 describe + `getInitialState()`로.
- **좁힌 업로드 스코프가 공유 슬라이스를 오염**(같은 PR): 진입 화면 매핑이 그룹 슬라이스에 저장돼 **사이드바로 진입한 도구가 이어 쓴다**(추천 카드 경로만 재매핑). 스코프에서 뺀 컬럼은 하류에서 영구 미매핑. 진입 화면 스코프 = **그 그룹 도구들의 필드 합집합**. 스코프는 오매핑 방지용이 아니라 소속 판별용 — 오매핑은 스코어러에서 막을 것.
- **필터 옵션 생성 ↔ 비교의 trim 불일치 = "선택해도 0행"**: 옵션은 `String(v)` 그대로인데 필터는 `.trim()`으로 비교 → `" Paid"` 같은 값이 안 맞음. 값 기반 필터는 **생성·비교 정규화를 항상 같이** 맞출 것.
- **게이트 `requiresAny` 키는 정규키와 정확히 일치(단/복수)**: `["click"]` vs `clicks` 불일치 → 데모인데 영구 잠김(silent). 키는 추측 말고 복붙.

**계산·엔진**
- **윤년**: `dayOfYear()` 1~366 → 배열 길이 367 보장.
- **로그-스페이스**: 큰 파라미터 Beta PDF 등 underflow → log-space 계산 후 max 빼고 exp 정규화.
- **FWL within-transform은 절편을 demean하지 말고 제거**: 고정효과 흡수 시 절편(항상 1)까지 demean하면 전 행 0 → X'X 특이 → fit null → **데이터 무관 모든 분석이 n=0**. demean은 dummy만, within 후 절편은 제거(남기면 ill-conditioned → SE 폭발·음수 R²). 인덱싱은 `off` 오프셋으로 통일.
- **Gauss-Jordan inverse는 절대 pivot 임계로 rank-deficiency 못 잡음** → `maxErr=max|I·M−δ|>1e-6`면 null 반환. `max<1e-12` 절대 임계는 스케일 큰 행렬(가중치=노출수)에서 사실상 특이인데 통과 → 가비지 β·SE·음수 R²가 화면에 거짓 숫자로 뜬다. 데모 데이터는 full-rank로 설계.
- **단계 독립 분해는 grain별 부분합 비정합**: 단계마다 따로 Bennet 분해하면 Σ가 안 맞음. **최소 grain에서 한 번만 분해 후 `rollup`**(단순 합산)해야 전 단계 항등식 정합.
- **계층 드릴다운 단일레벨 키 그룹핑 = 상위 over-merge**: 상위가 "전체"면 복합키(`cmp│cr`)로 — finest 합산이라 Σ 항등식 불변, `children[0]`로 대표키 추출.
- **shift-share/Bennet "비중"은 비용 아니라 결과량 share**: `s=result/ΣResult`가 정의. COST 컬럼 옆 "비중"은 비용 비중으로 오독돼 신뢰 붕괴 → 라벨을 "**결과 비중**"으로 명시 + 툴팁 고지(거짓 숫자로 의심받는 카피 = 실질 버그).
- **리텐션은 모수 가중 + %-vs-인원수 컬럼 판별**: 행별 단순평균 금지(코호트 크기 무시), 비율 전용 clamp도 인원수 입력을 100%로 망가뜨림. SSOT `computeWeightedRetention` — 분모=Σ모수, 분자=비율이면 Σ(ret×모수)·인원수면 Σret. **컬럼 max≤1→비율, 초과→인원수**.
- **절단 사후분포의 평균을 점예측으로 쓰면 적합선이 통째로 뜬다**(2026-08-15): 5-18 기본 Bayesian이 `fitted`를 MAP이 아니라 비음수 절단 draw의 평균으로 재구성했다. MAP이 0 경계에 붙은 채널마다 음수 꼬리가 잘려 평균이 위로 밀리고 채널 수만큼 누적돼 **평균 +36% 레벨 시프트** — R² 0.74→**−6.91**, 학습 WMAPE 5.6%→**35.8%**, 90% 커버리지 0.97→**0.00**. 사후 draw는 불확실성(계수 구간·식별 판정) 전용이고 점예측 기준이 되면 안 된다. **탐지 신호: 학습 오차가 OOS 오차보다 나쁘면 그 순간 적합값이 아니다**(35.8% vs 9.5%) — 이 부등식을 골든으로 박아둘 것.
- **분해 항등식 검사의 tolerance는 저장 정밀도에 맞출 것**(같은 작업): MAP weeks는 `fitted`·`residual`을 소수 2자리로 저장하는데 기여 합은 반올림하지 않는다. 1e-9을 요구하면 **fitted를 기여 합으로 되만들던 잘못된 경로에서만 통과**한다 — 즉 그 tolerance가 버그를 지키고 있었다. 항등식은 실제 저장 자릿수(±0.005/±0.01) 기준으로 볼 것.
- **표시 경로와 계산 경로가 다른 예측 함수를 쓰면 화면이 추천과 어긋난다**(2026-08 감사): 5-3 차트는 `model.predict(x)`를 직접 불러 poly2 꼭짓점 clamp가 빠졌고, 배분 엔진은 `predictSafeCpr`를 썼다 → "곡선은 나빠지는데 왜 증액하라고 하나". `.model.predict` 함정과 같은 클래스인데 `undefined`가 아니라 **다른 값**이라 더 안 보인다. 래퍼 필드도 전부 넘길 것(`xMin` 누락 = 하한 clamp 사망).
- **정규화·구조로 살려낸 적합은 "추정치"가 아니다**(같은 감사): `REG_STATS.ols`는 특이행렬을 잡으면 대각에 1e-8을 더해 릿지로 풀고 `regularized:true`만 남기는데, 이 플래그를 확인하는 곳이 전 코드베이스에 1곳뿐이었다 → 공선 데이터에 **95% 예측 밴드가 확정 숫자로** 표시됐다. 플래그를 만들면 소비처 전수를 같이 배선할 것.
- **퇴화 입력 가드는 형제 함수에서 복사해 올 것**(같은 감사): 같은 파일의 `mmmOls`엔 `n<=k`·`sst>0`·`Math.max(0,…)`·`se>0` 네 가드가 있는데 `REG_STATS.ols`엔 없어서 상수 종속변수에서 **R²=-Infinity와 p=1.06e-60("극도로 유의")**이 렌더됐다. 정상 입력에선 no-op이라 골든 byte-identical로 추가된다.
- **"계산 불가"를 좋은 등급으로 접지 말 것**(같은 감사): `creativeMath.vif`는 적합 실패를 `r2=0`으로 떨어뜨려 **VIF=1(완전히 깨끗)**로 표시했다 — 식별 불가를 문제 없음으로 뒤집는 방향의 실패다. `satMath.classify`도 `satIndex==null`(미상)을 "포화"로 단정했다. 미상은 미상 버킷(null)으로.
- **날짜 문자열은 UTC로 파싱되므로 요일도 `getUTCDay()`**: `new Date("2026-08-12").getDay()`는 로컬 기준이라 UTC 이서 타임존에서 하루 밀린다. 주석이 "UTC"라고 적혀 있는데 코드가 `getDay()`인 경우가 실제로 6곳 있었다(파일마다 갈림).
- **모델 래퍼는 `.model.predict`지 `.predict` 아님**(5-3): `predictSafeCpr(wrap, cost)`가 CPR 반환, 결과=cost÷CPR. 직접 호출은 **undefined→결과 0**. 골든은 순수 math만 봐서 못 잡음 → **각 분배 경로를 데모로 repro**.
- **5-18 MMM**: ROAS는 표시층 invert만(배분은 CPR 공간). 회귀계수는 **연관≠인과**. 전부-0/완전공선 컬럼 → `_nonRedundantCols`(Gram-Schmidt) 드롭. 희소 채널 음수 탄력성은 "노이즈"지 "잠식" 아님.
- **`const x = ... f(()=>...x...)` 자기 참조 = TDZ throw**: const 초기화식 안에서 자신을 참조하면 callback 실행 시 ReferenceError. `&&` 단락으로 안 도는 기본 경로는 멀쩡, 조건 truthy 되는 순간 throw. 모듈 상수 선언 순서도 같은 함정 — 파생 상수는 원본 뒤에.

**렌더·UI**
- **semantic 토큰에 라이트 오버라이드가 있어도 raw hex를 쓰면 소용없다**(2026-08 감사): `globals.css`에 다크 전용 리터럴이 51곳 있었고 **바로 옆 규칙은 `var(--danger)`를 쓰고 있었다**(한 블록 안에서 규칙이 갈림). 라이트 배경에서 대비 1.9:1(AA 미달). `ds/` 컴포넌트에도 같은 혼재가 있었는데 거긴 다른 도구가 베끼는 기준이라 전파된다. 차트 팔레트도 하드코딩하면 `refreshMountedChartThemes` 대상에서 빠진다 → `CHART_THEME.colors`·`.danger`·`.warning`·`.success`(판정 색 getter). remap Map은 **각 토큰의 다크·라이트 값 + 과거 리터럴을 전부 키로** 가져야 한다 — 하나라도 빠지면 그 데이터셋만 옛 색으로 굳는다. getter 반환값은 리터럴 hex라 `CHART_THEME.danger + "AA"` 알파 접합이 그대로 되고(§7 hex-알파 함정은 `var()`에만 해당), canvas는 `var()`를 못 읽으므로 **데이터셋엔 반드시 getter**를 넘길 것.
  - 토큰화하면 `` `${color}55` `` 같은 **hex 알파 접합이 깨진다**(`var(--danger)55`는 무효 CSS) → `color-mix(in srgb, … 33%, transparent)`.
  - **역으로, 토큰화하면 안 되는 리터럴이 더 많다**(2026-08 실측: `globals.css` raw hex 285 · 인라인 `color` 50 중 안전 치환은 19곳뿐). 금지 4종: ① 브랜드색(YouTube·Naver…) ② **영구 다크 표면 위 텍스트** — `.sidebar{background:#10131a}`엔 `body.light-mode` 재정의가 **일부러 없다**. 여기 hex를 토큰으로 바꾸면 다크 사이드바에 다크 텍스트가 된다(AA 개선이 아니라 파괴) ③ Chart.js 데이터셋에 들어가는 값(canvas는 `var()` 못 읽음 → `CHART_THEME`) ④ 토큰이 없는 색과 짝지은 값(범례↔셀, chip↔dot). **정확히 같은 값의 토큰이 있는 순수 텍스트 색만** 치환할 것.
  - **토큰 값을 대조할 땐 "마지막 정의"를 볼 것 — `:root`와 `body.light-mode`가 파일에 각각 두 번 있다**(§4.1 tokens 레이어의 61~63·142~144, app 레이어의 4821·4889 블록). 앞 블록만 보고 `#f87171`을 "`--danger`와 같은 값"이라 판단하면 틀린다 — **실효값은 `#ff8178`**(`--warning` `#f2b84b`, `--success` `#65d3b3`, `--primary` `#82aaff`). 실제로 이 착각으로 "다크 byte-identical"이라 적고 치환한 적이 있다. 대조는 눈이 아니라 **마지막 정의를 파싱해서** 할 것.
- **`globals.css`는 캐스케이드 레이어 3단**(`@layer reset, tokens, app;` — 파일 상단 주석 참조): 외부 리셋(Tailwind preflight 등)을 도입하면 `layer(reset)`으로 넣어야 9천 줄이 리셋에 밀리지 않는다. 레이어 **밖** 규칙은 모든 레이어를 이기므로 이 파일 내용은 전부 레이어 안에 있어야 하고, `!important`는 레이어 순서를 뒤집으므로 `tokens`엔 넣지 말 것(현재 0개).
- **`role="tablist"`가 `role="group"`을 거쳐 `tab`을 소유하면 계약이 끊긴다**(같은 감사): 로빙 tabindex·화살표 키가 멀쩡해도 보조기술이 탭을 탭으로 인식하지 못한다. 그룹이 필요하면 **그룹마다 tablist**를 두고 바깥은 일반 컨테이너로. `role="radio"`도 `radiogroup` 부모가 없으면 같은 문제 + 전 옵션이 탭 순서에 들어간다.
- **`title` 단독은 어포던스가 아니다 — CSS로 강제할 것**: claude-ux §0이 이름을 지목해 금지했는데도 12곳 이상 살아 있었다. 개별 수정 대신 `[title]` 셀렉터에 점선 밑줄+`cursor:help`를 거는 전역 규칙 1개가 전부를 덮는다.
- **Chart.js에 CSS `var(--x)` 리터럴 직접 전달 금지**: canvas는 `var()`를 못 읽어 불투명 검정 폴백(두꺼운 검정 그리드). `getCssVar("--border")`(`chartUtils.js`)로 렌더타임 해석.
- **Chart.js v4 커스텀 `generateLabels`는 per-item `fontColor` 자동 주입 안 함** → 다크모드 범례 텍스트 실종(라이트는 멀쩡 → 한쪽만 검증하면 놓침). 부호 구분 색쌍은 명도차 크게(중간톤끼리는 구분 안 됨).
- **조건부 마운트 캔버스는 최초 폭 0**: 토글·step 전환으로 새로 마운트되는 차트는 부모 레이아웃 전이라 width=0. `new Chart(...)` 직후 `requestAnimationFrame(() => instance.resize())` 1회 필수.
- **차트 데이터 `Math.round` = 작은 값 뭉개짐**: 저객단가 ARPU(<1)가 0/1/2로 뭉쳐 0축에 붙음. round 금지 + 표시층에서 값 크기별 자릿수 적응(`fmtCurrencyPrecise`).
- **지표 토글 추가 시 차트도 같이 전환**: 표만 분기하고 차트가 한 지표 공간 고정이면 "토글해도 곡선 안 바뀜". y변환·축라벨·점/곡선·캡션 단위까지 metric별 분기.
- **`<thead>` 없는 표는 전역 `thead th` 정렬 규칙 미적용**: 헤더 center·데이터 left로 어긋남. 헤더·셀에 명시 `text-align`(숫자=right). 공용 `td{vertical-align:top}`도 `<th>`엔 안 먹으므로 행헤더에 명시.
- **`position:fixed`도 `backdrop-filter` 조상 안에선 viewport 기준 아님**: 글래스 sticky 바가 fixed 자손의 containing block이 됨. 드롭다운은 열 때 `document.body` portal + `getBoundingClientRect` 정렬, 라우트 변경마다 orphan 제거.
- **무거운 compute를 `useMemo(deps: 매핑)`에 두면 메인 스레드 멈춤**(10~20만행): 분석 게이트 뒤로만 실행 + 더블 rAF 디퍼로 스피너 먼저 페인트("멈춤"→"분석 중"). CSV 파싱은 `Papa {worker:true}`. rAF 디퍼 도구의 스모크는 `act`+rAF flush 필요.
- **렌더 함수에 상태 분기 추가 전 실제 호출부 확인**: 호출 조건 모르면 도달 불가 죽은 코드 생성.
- **render throw는 골든이 못 잡는다 → 재현 필수**: 골든은 순수함수만 검증. 단일 render throw가 페이지를 통째로 죽여 "분석하기 무반응"·"탭 멈춤" P0가 된다. 상태 의존 분기는 **전 상태값(전 채널·전 토글)으로** 재현해야 잡힘.
- **preview 스크린샷은 매우 긴 페이지에서 캡처 아티팩트**(빈 화면·이중노출) — 실제 앱 버그가 아니라 툴 한계. 판정은 접근성 트리나 콘솔 에러로, 스크린샷 하나로 "깨졌다" 결론 금지.
- **SPA 소프트 내비는 GA4 page_view 자동 전송 안 함**(`gtag('config')`는 최초 1회): `components/GaPageviews.jsx`(`usePathname`+최초 제외 가드)가 경로 변경마다 `gtag('event','page_view')`. GTM 이중 태깅 시 이중카운트 주의.
- **진입 모션의 "초기 숨김"은 JS가 붙인 클래스로만**(랜딩 anime.js): 스타일시트에 `opacity:0`을 박아두면 JS 청크 로드 실패·모션축소 설정에서 콘텐츠가 **영영 안 보인다**. 성공적으로 부착했을 때만 `.is-motion-armed`를 붙이고, 실패 시 즉시 벗긴다(점진적 향상). **조건부 렌더 섹션은 모션 대상에서 제외** — 마운트 시점에 옵저버를 못 달아 하이드레이션 이후 나타나는 노드가 숨은 채 남는다. 트리거는 anime 스크롤 옵저버보다 네이티브 `IntersectionObserver`가 안전(이미 뷰포트 안인 요소의 발화가 명확).
- **localStorage 영속 금지**(사용자가 명시적으로 켠 경우만). 새로고침 리셋이 기본.

---

## 8. 통계적 엄밀성

1. **순수 함수 분리**: `ALLOC_MATH`·`MMM_STATS`·`PVM_MATH`·`REG_STATS` 등 `*Math.js` 모듈에 모음.
2. **합성 데이터 유닛 테스트**: 새 엔진 함수는 골든 1개+ 추가 후 `npm run test:all` 통과해야 commit.
3. **결정론 필수**: `Math.random` 절대 금지. MC 대신 고정 grid 수치적분/정확 계산. 같은 입력 → byte-identical. 샘플 데이터는 `seededNoise`.
4. **신뢰구간 자동 계산**: 95% CI. 차트·패널에 표시.
5. **자동 종합 해석**: 통계 지식 없이도 결론 읽게(빨강 부정 / 초록 긍정 / 회색 무유의) + `💡 쉽게 말하면` 평어 콜아웃.
6. **입증책임 비대칭 + non-sig≠무효과**: "효과 없음" 단정엔 강한 증거 요구, 모호하면 INCONCLUSIVE. 식별 불가(공선)면 "추정≈0"은 *증거 없음*이지 *효과 없음* 아님 → 검정력 게이트로 긍정 판정 차단. 임계값은 config로 분리.
7. **단조 비감소 보정**: 한계효용은 running max로 artifact 차단.
8. **모형은 종속변수의 척도에 맞춰 고를 것**: 0/1=binomial · 0~1 비율=beta(로짓) · 카운트=Poisson→과산포면 negbin · 그 외=OLS (`utils/outcomeType.js`가 판별, 골든으로 고정). 비율을 OLS로 돌리면 구간 밖을 예측하고, 카운트의 과산포를 무시하면 SE가 과소추정돼 **없는 유의가 생긴다**. 자동 라우팅은 조용하면 안 된다 — 화면이 고른 모형과 사유를 말해야 사용자가 뒤집을 수 있다.
9. **근사가 못 미더운 구간에서는 판정 기준 자체를 정확검정으로 옮길 것**: 저전환 A/B에서 z는 p를 과소평가한다(n=50/50, 전환 0 vs 5 → z 0.022 / Fisher 0.056으로 **판정이 뒤집힌다**). 기대빈도 5 미만(Cochran)만 보면 부족하고 성공 건수 하한도 함께 봐야 한다.
8. **shift-share/mix 분해는 전체 평균 대비 centering**: `mix=(cpāᵢ−C̄)·Δsᵢ`. ΣΔs=0이라 합·중첩 항등식 불변이면서 부호가 해석 가능해짐. 잔차 없는 분해라도 "합만 맞으면 OK" 아님 — 각 항 부호가 직관과 맞는지 합성 데이터로 검증.

---

## 9. 사용자 의사결정 패턴 (관찰)

- **여러 선택지 + 트레이드오프** 선호(A 추천 / B 절충 / C 최대). **"몇 줄 분량인가"**가 결정에 영향.
- **데이터양 기반 자동 추천** 선호. **즉시 시각 피드백** 중시(토글 무거우면 캐시 요구).
- **최근성 우선 정렬**(전체 누적 아니라 최근 N일 기준, 동률 시 누적 2차).
- **검증 가능성** 중시(참고값 재현, 재현용 원자료 export).
- **분석 결과 해석**까지 요구(차트로 안 끝남 — 의사결정에 어떻게 쓸지). **목표 우선 사고**(CPI/CPA/ROAS 먼저).
- **메타-도구 사고**: 하네스/에이전트 자체 진화를 명시적으로 요구(self-update 선호).
- **통계 입력 보조**: 붙여넣기→자동계산, 프리셋 추정(마케터가 σ 직접 못 구함).
- **결론-우선 + 평어 해석**: §0 한눈에 보기 카드 + 평어. **절대 인원 병기**("몇 %"보다 "몇 명").
- **정직성**: 공선이면 분해 거부하고 수치로 설명 + 대안 제시. 동작 안 하는 카피·가짜 인증 거부.
- **지표의 시간 의미 확인**: cohort-window(revenue_d7)를 캘린더-일별 분석에 섞지 말 것.
- **설계 스펙 먼저, 구현은 핸드오프**: 비용 큰 작업은 `docs/*.md` 자체완결 스펙(파일:줄·옵션·함정·검증) 확정 후 실행 위임.
- **콘텐츠 작업 우선순위는 감이 아니라 Search Console에서 나온다**(2026-08-17): 사용자가 GSC 3개월 export를 던져주며 "차이 보고 개선점 반영"을 요구했다. 실측 결과 **부실한 글 목록과 검색 수요 목록이 거의 일치**했다 — `cpi-cpa-cpm-difference`는 평균순위 8.3위에 노출 35인데 클릭 0(랭킹은 되는데 안 눌림), SKAN 계열 질의는 250+ 노출인데 글이 3.7KB였다. **순위 상위 + CTR 0 = 콘텐츠/스니펫 문제, 노출 많음 + 순위 낮음 = 분량·깊이 문제**로 갈라서 처방할 것. KR은 클릭 18/19·평균 27위인데 EN은 노출 1245·클릭 0이라 시장별 상태도 다르다.

---

## 10. 응답 스타일

- **한글 응답 기본**(코드/식별자는 영어). 해석·요약·다음 단계는 한글.
- **구조화**: 표 우선(비교/매핑), 체크박스(검증 항목), 이모지 절제(✓ ❌ ⚠ ★ — 의미 명확할 때만), 코드블록은 `파일:줄` 포함.
- **PR 머지 후 자동 제시**: ① 배포 시간(Railway 1~2분) ② 새 화면 설명 ③ 테스트 방법 ④ 다음 작업 옵션.

---

## 11. 안티패턴 (하지 말 것)

- ❌ 새 라이브러리·프레임워크 사용자 확인 없이 추가
- ❌ 사용자 데이터를 서버에 전송 / Supabase service_role key 요청·언급
- ❌ main 직접 push / `--no-verify` / `--force` to main
- ❌ 검증(`test:all`·`lint`) 없이 commit / 콘솔 에러 무시
- ❌ `git add -A`·`git add .` (§2.6) / `.legacy-local/` 접근
- ❌ 모호한 결정 임의 확정 (2개+ 선택지면 묻기)
- ❌ 사용자 요청 외 페이지/기능 임의 추가 / 한국어 응답을 영어로
- ❌ `Math.random` 사용 (결정론 위반)
- ❌ 순수 엔진(`src/utils/*Math.js`) 수학 변경 (골든 깨짐 — 라벨·렌더만 손댈 것)
- ❌ 데이터 없는 상태를 채워 넣기(fabricate) — 정직한 빈 상태로

---

## 12. 자주 사용한 패턴 (Recipes)

### 12.1 새 분석 도구 추가
1. store `IA`에 `{ id:"5-N", title, desc }` → 2. `routeMap.js`에 `{id, slug, component}` → 3. `PageClient` 디스패치(SOP 폴백 가드 확인) → 4. `TOOL_REQUIRED/OPTIONAL_FIELDS` 정의 → 5. `toolGroups.js`에 CSV 그룹 → 6. `utils/toolGuide.js:TOOL_GUIDE[id]` → 7. `demoData` 픽스처 → 8. 컴포넌트(`ds/*` 상속, §12.21) → 9. `sitemap.js` → 10. 골든+스모크 → PR.

### 12.2 새 통계 함수
`*Math.js` 모듈에 순수 함수 추가 → 합성 데이터 골든 1개+ → `npm run test:all` 통과 후 commit.

### 12.3 차트 추가
`import Chart from "@/utils/chartGlobals"`(전역 셋업 경유, `chart.js/auto` 직접 import 금지) → `<div class="chart-container"><canvas/></div>` → `chartCommonOpts()`+`CHART_THEME` → 생성 직후 rAF `resize()` → 재렌더 전 destroy. PNG는 `downloadChartAsPNG`. **하드코딩 색·CSS `var()` 리터럴 금지**(§7).
- **전역 룩·인터랙션은 옵션이 아니라 defaults+플러그인으로**(`utils/chartGlobals.js`): 도구 50여 곳이 `chartCommonOpts()`의 `scales`·`plugins`를 자기 옵션으로 덮어써서, 공용 옵션 함수만 고치면 룩이 갈린다. 기준선(crosshair)·외부 HTML 툴팁·폰트·hover 반경은 `Chart.defaults`+`register`로 붙여 덮어쓰기와 무관하게 상속시킨다. 적용 여부는 **생성자 단위 WeakSet**으로(모듈 전역 플래그로 잠그면 테스트 더블에 적용 불가).
- **`pointRadius`는 전역 default로 건드리지 말 것**: 도구마다 의미가 달라(이상치 마커·산점도) 0으로 내리면 마커가 조용히 사라진다. 인터랙션만 키우려면 `hitRadius`/`hoverRadius`로.
- **외부 툴팁은 body 포털 + textContent**: `backdrop-filter` 조상 안에서 `position:fixed`가 뷰포트 기준이 아니게 되고(§7), 라벨에는 사용자 CSV 값(캠페인명)이 들어오므로 `innerHTML` 금지.

### 12.4 토글 클릭 → 즉시 반영
데이터 변형은 사전 계산 → 핸들러는 lookup + `chart.update("none")` 또는 className swap. 전체 re-render 피하기(스크롤·포커스 손실).

### 12.5 분석 게이트
`analyzedByGroup[group]=computeAnalyzeSig(csvData)` + `isGroupAnalyzed` 게이트. 매핑 완료해도 "▶ 분석하기" 클릭 후에만 결과. 매핑 변경=시그 달라짐=자동 숨김. sig는 **매핑만**(탐색 토글은 제외). 게이트는 렌더층 전용 → 골든 byte-동일.

### 12.6 표시 번호 ↔ 라우팅 id 분리
표시 번호 변경 시 **내부 id 절대 불변**. `displayItemNumber(id)`/`displayGroupNumber(id)` 순수함수로 계산, 렌더 3곳(nav·shell·home)에 적용.

### 12.7 도구 통합 — 탭형 단일 페이지
같은/다른 grain 도구를 host 탭으로 병합: 흡수 도구는 섹션 반환 함수로 강등(게이트·shell 제거), host가 탭 상태 소유, 흡수 id는 redirect 보존, bind/chart/math 함수는 전부 유지. cross-grain은 탭별 CSV 그룹 스왑.

### 12.8 데모 모드
`demoData` 픽스처(`seededNoise`, `Math.random` 금지) 자동 로드 — `if(!hasData && !demoDisabled)` 가드. `/start` 진입 시 `startMyData()`가 `demoDisabled=true`+데모 슬라이스만 비움(실 업로드 보존). 데모 사용 중이면 `DemoNoticeModal` 세션 1회 안내.

### 12.9 5-18 MMM (마케팅 반응 회귀)
3탭 단일 데이터 흐름: ①진단(카니발·추세·그랜저·변화점) ②MMM 기여 분해(adstock·saturation) ③회귀+예측. **한 CSV + shared `mmmColMap`**로 게이트·계산 — ③이 별도 업로드/게이트를 갖지 말 것(화면 불일치 원인). ③ 예측은 `mmmForecast`(②와 동일 계수: adstock·trend·fourier·더미) 단일 엔진. 회귀=가설 생성용, **인과 아님**. 상세: `docs/backlog.md` §B.
- **`buildPanelFromColMap` 타깃=플랫폼 합산**: OS 태그 다중 매핑 시 종속을 `pick`(첫 1개)하면 Total인데 한 OS만 나옴 → **컬럼 index별 벡터합**. OS 태깅 정규식은 `\b` 대신 `[^a-z]`(언더스코어 오탐 방지).
- **패널 라벨 필드명 정합**: 엔진·차트는 `panel.dateLabel`·`dates`·`granularity`를 읽지 `weekLabel`이 아님 → 셋 다 세팅 안 하면 x축이 t 인덱스로 폴백. **엔진이 어떤 필드명 읽는지 항상 확인.**

### 12.10 5-21 PVM (캠페인 성과 변동)
최소 grain(채널×캠페인×소재×일) Bennet 분해 1회 → `rollup`으로 전 단계 항등식 정합. centering mix `(cpāᵢ−C̄)·Δsᵢ`. 계층 §4는 복합 keyFn(over-merge 방지). 상세: `docs/pvm-campaign-variance-spec.md`.
- **CSV 살아있는 수식 2함정**: ① centering 공식은 **finest에서만** 성립 — 롤업 행은 "하위 cell 합"으로 노출 ② 셀 수식에 콤마(SUMIFS 등) 쓰면 CSV 컬럼 분리로 깨짐 → 명시 셀 `+`합으로 회피.

### 12.12 Forest plot
Chart.js 네이티브 없음 → `type:"bar", indexAxis:"y"` floating bar(`[ciLow,ciHigh]`) + `type:"scatter"` coef 점 overlay. pAdj 색상 코드. 높이 `n*26+80px`.

### 12.13 피드백 설문(VOC) 노출
외부 Google Form 링크. ① 상시 진입점: 사이드바 하단 + ⌘K 명령 ② 분석 후 넛지: 결과 하단 슬림 콜아웃, **세션당 1회**(메모리 플래그, 영속 X). 링크는 `target=_blank rel=noopener noreferrer`(데이터 전송 0). 전부 render층, 색은 semantic 토큰만.

### 12.14 결론·검증 UX 레이어 (5-3 예산배분에서 확립)
전문 진단은 접어두고 **결론층을 두껍게**. 전부 render층(골든 byte-동일).
- **§0 진단**(verdict 위): 최악(예산비중↑·결과비중↓)·기회(저비용 고효율인데 예산 적음)·집중도(`topShare≥0.5 && ≥1.5/n` — 2채널 50/50 오탐 차단) 평어+절대값. eff 통일=CPR 그대로/ROAS는 역수. **효율차<1.2면 억지 처방 대신 "재배분 여지 작음"**(정직).
- **§5 검증 스트립**: 제약 없는 모드는 효율↔배분 정합(인접쌍 역전 플래그), 한계효율 모드는 "평균 순서와 달라도 정상" 안내(0배분 채널 명시).
- **국가 단일 강제**: Country×Channel grain은 타국가 혼입 방지 위해 국가 1개 강제(최고지출 기본, 결정론 tiebreak). unit 전환 시 채널필터 cascading 리셋.
- **de-jargon**: 추세선 배지 평어화(우하향→"효율 거꾸로", ∩→"증액 시 빗나감", ∪→"감액 시 빗나감"), 기술용어는 `title`·본문에만. 긴 툴팁은 "왜위험/왜발생/어떻게" 단락 구조화.

### 12.15 회귀 ⊕ 미래예측 (`docs/regression-forecast-merge-spec.md`)
`REG_FORECAST.run(opts)`=변수별 미래스펙(연속=시나리오값/이벤트=지속·N후끔/시간=fourier·trend 자동연장)으로 설계행렬 미래연장→OLS→leverage 95% 밴드→종속 역변환.
- **변환은 hist+future 결합 1회 후 슬라이스** — adstock 이월·스케일 일관(fit·predict 같은 basis).
- OS(group)별 분리 기본 + "전체 풀링" 토글. MMM 브리지로 채널 데이터→회귀 역할 자동 번역.

### 12.16 캠페인 포화도 진단 (5-22)
5-3 곡선 엔진 재사용 — 신규 곡선/아웃라이어 구현 금지. **포화지수 = 한계 CPA ÷ 평균 CPA**(ROAS는 역), `≥satHigh` 포화·`<scaleLow` 여유(임계는 config 분리·결정론). 한계는 현 지출점에서 +10% finite-diff.
- **공유 데모에 실제 신호 부여**: 진단 도구 데모가 의미 있으려면 합성 패턴이 신호를 띠어야 함(수확체감 곡률 + 노이즈 축소 — 노이즈 크면 곡률이 덮임). 공유 fixture 수정은 형제 도구 스모크로 회귀 확인.

### 12.17 쉬운말 우선 표기
일반 유저 대상 라벨은 **쉬운 말 먼저 + 전문용어는 괄호로 뒤에**(`데이터 점검 (검증)`·`영향력 (β)` — 역순 금지). 공간 좁은 표 헤더는 약어 + `title` 툴팁. 긴 방법론은 평어 한 줄 + `<details>` 접기.
- **통계를 보강할 때 늘어나는 건 답의 정확도지 읽을 거리가 아니다**(2026-08-15): Fisher·Holm·상호작용·척도 라우팅을 넣으면서 근거를 결론과 같은 층에 폈다가 되돌렸다 — p값 2개 병기, 표 3열→6열, "Type II 제곱합·잔차 자유도" 각주, 모형 사유 2문장. **검정 이름·제곱합·자유도·보정 방식은 전부 `.stat-method` 접기 안**, 밖에는 판정 한 줄 + 행동 한 줄만. 판정 칩이 이미 보정을 반영하면 보정 p를 열로 펼 이유가 없다.
- **쓸 수 없는 기능은 조건이 갖춰졌을 때만 보일 것**(같은 작업): 9-1 혼합모형 섹션이 "비숫자 열이 있으면" 렌더돼서, 반복 측정이 없는 파일에서도 못 쓰는 선택기가 계속 떠 있었다. 노출 조건은 실행 가능 조건(`prepareMixedInput`)과 **같은 기준으로 파생**할 것.

### 12.18 전역 분모 기준(설치/가입) 토글 (5-2)
`MON_DENOM_STATE.basis`("installs"|"actions") + 미매핑 자동 폴백으로 CPI/CPA·CVR·ARPU·리텐션·LTV·퍼널을 1토글로 함께 전환. per-탭 토글도 전역과 동기화. 퍼널은 기준별 단계 수가 달라지고 절대값=로그 스케일(노출 압도 해소), "절대↔전환율" 토글.

### 12.19 데이터×기능 연결표 + 템플릿 CSV
업로드 화면 연결표는 `TOOL_REQUIRED/OPTIONAL_FIELDS`+`STANDARD_FIELDS`에서 **자동 생성**(하드코딩 표 금지, 표류 방지). 컬럼 순서=차원 먼저 → 지표. 템플릿 CSV는 깨끗한 헤더만(BOM+CRLF §7, canonical). 자체 예시가 있는 라우트는 통합 템플릿 대상에서 제외.

### 12.20 v2 아키텍처 패턴 (index.html 이관에서 확립)
- **순수엔진은 골든이 오라클**: 이관·리팩토링에서 **tolerance 완화·엔진수정 0**이어야 충실. 수학은 절대 변경 금지.
- **도구 배선 표준**: `getMappedRows(csvData)` → 도구별 엔진 입력 구성(값은 문자열, `Number()`) → 순수엔진 호출 → 표/차트/헤드라인 렌더. **mock·`Math.random` 전량 제거**, 컬럼 부족 시 정직 빈상태.
- **존재하지 않는 객체 스프레드 금지**: `...base.plugins.X.foo`처럼 없는 키를 펼치면 `undefined.prop` throw → 에러 오버레이. `csvData?.raw?.length` 옵셔널 체이닝으로 통일.
- **role-based colMap auto-derive**: UI 없는 매핑은 자동 유도(표준 wide + LONG→WIDE 피벗). null-fit(공선/기간부족)은 raw TypeError 대신 **정직 도메인 메시지**.
- **IA 라벨↔라우트 정합**: store IA 라벨이 실제 마운트 컴포넌트와 일치해야("클릭→다른 도구" 버그). 라우트 id 불변, slug↔id 매핑층.

### 12.21 디자인시스템 공용 규약 (`docs/design-system-baseline.md` SSOT)
**신규 분석 도구 필수**: ① 숫자·통화·%는 `utils/format.js`(수동 포맷 금지) ② 통화는 전역 `store.displayCurrency`(도구별 통화 state 금지) ③ 표는 `ds/DataTable`(thead 강제·숫자 우측) ④ 업로드부는 `TOOL_GUIDE[id]`→`ds/CsvGuide` ⑤ 차트 `chartCommonOpts()`+`CHART_THEME` ⑥ 엔진 순수 `*Math.js`+골든 ⑦ 결과 최상단 `ds/ResultActionCard`, 다운로드는 `ds/DownloadHub`(§12.27).

### 12.22 증분 분석 (5-23 · 5-24)
증분(광고가 실제 만든 몫)은 A/B(5-4)와 별개 독립 도구·독립 CSV 그룹. **5-23** 3방법: ①통제군(suppression) 동시·무작위 vs 홀드아웃 ②신규켜기(on)/③종료(off) 전후(pre/post: delta·counterfactual·Welch·대조군 DiD) — ②③은 부호만 다른 한 엔진. **5-24** 브랜드 캠페인 ITS(AR(1) 추론·HAC 소표본 보정·rho 프로파일 구간). **정직성**: 무작위/DiD 아니면 인과 단정 X.

### 12.23 Content Analytics — 엔진 도메인 리라벨 (9-x)
퍼포먼스 엔진 **수학 불변·라벨만 스왑**. SSOT=`utils/contentDomain.js`(도메인별 카피 객체+resolver). **복제 금지, 라벨팩 파라미터화** — 소스 컴포넌트 1:1 있으면 `domain` prop 주입(얇은 래퍼), 없으면 엔진 위 신규 얇은 UI.
- **엔진 스케일 가정을 먼저 검증**(9-4 CMM 드롭·재시도 금지): MMM은 금액×수확체감 전제라 발행 편수(카운트)와 근본 불일치 → 한계효과 언더플로우. 라벨만 바꿔선 안 됨.
- **다중 컴포넌트 리라벨**: `domain`을 prop drilling, 게이트·업로더 toolId 하드코딩을 domain별 파생, **탭 서브셋 노출 시 공유 전역 탭이 허용셋 밖이면 기본탭 강제**. 실제 CSV 필드명·매핑키는 불변(라벨만). 도메인에 없는 지표(매출·ROAS)는 라벨 날조 말고 **매핑 게이트로 정직 제외**.

### 12.24 블로그 (SEO 마케팅 컬럼, `/blog`)
`routeMap` **밖**의 fs 기반 MD 파이프라인. **글 발행 = `v2-migration/content/blog/<slug>.md` 추가**(frontmatter: `title`≤40·`description`≤80·`date`·`slug`·`keywords`·`tags`·`draft`·`ogImage`; `_TEMPLATE.md` 복사, `_`프리픽스·`draft:true`는 미발행). `src/lib/blog.js`는 **server 전용**(클라이언트 import 금지).
- **여러 글 → 필라 통합 = 6곳 동시 갱신**: ① `content/blog(-en)`·`glossary(-en)` 파일 add/삭제(**EN 짝파일 필수** — 경로는 `blog-en`이지 `en/blog` 아님) ② `next.config.mjs redirects()`에 구 URL→필라 301(ko·en 각각) ③ 레지스트리 정합(아래 5곳) ④ 삭제글 참조 glossary `relatedPosts` 재지정. 내부 링크는 KR 상대경로만(렌더러가 EN 접두).
- **신규 글 1편 = 파일 2개(KO·EN) + 레지스트리 5곳**: `blogSeo`(KO_TITLES·EN_TITLES) · `blogEditorial`(KO_ANSWERS·EN_ANSWERS·`CONDITION_GROUP_BY_SLUG`) · `contentToolRegistry`(`BLOG_PRIMARY_TOOL`·`BLOG_RELATED_GLOSSARY`) · `localizedHref`(`EN_BLOG_SLUGS`) · frontmatter `faq`(2건+). 하나라도 빠지면 `contentRegistry.test.js`가 잡는다.
- **frontmatter `tags`는 자유 문자열이 아니다**: `blog.js`의 `TAG_CATEGORY`(KO)·`TAG_CATEGORY_EN`에 없는 태그는 **그대로 통과해 7번째 카테고리를 만든다** — 네비게이션은 6개 고정이라 `getAllTags` 가드가 막는다. 새 글은 매핑에 있는 태그만 쓰거나 매핑을 먼저 추가할 것(신규 6편에서 3개가 걸렸다).
- **SEO 연동**: `sitemap.js`·`rss.xml`이 `getAllPosts`로 직접 포함(블로그는 fs가 SSOT). SOP(JSON)는 MD 이관 안 함.
- **그림(SVG)은 viewBox가 곧 캔버스 — 밖으로 나간 글자는 그냥 잘린다**(2026-08-17): `junior-metrics-guide/metric-diagnosis.svg`가 x=530에서 시작하는 26자 문장을 viewBox 700 안에 담아 "→ 클릭은 잘 되는데 안 사요. 랜딩·"에서 잘린 채 배포됐다. **EN 짝은 이미 문장을 아랫줄 중앙정렬로 고쳐둔 상태였다** — 한쪽만 고치고 짝을 안 본 사고(§2.11의 역방향). 지금은 `contentAssets.test.js`가 전 SVG를 파싱해 글자 폭을 추정·검사하고 참조 이미지 실재도 함께 본다. 긴 주석은 칸 옆이 아니라 **아랫줄 중앙정렬**로.
- **문장 전체를 `**`로 감싸는 강조가 AI투의 정체**(같은 작업): 용어사전 200곳·블로그 210곳이 "…해야 정확해요."처럼 문장을 통째로 볼드 처리하고 있었고, 사용자가 직접 지목했다. 목록 항목의 **짧은 라벨**은 마크다운 구조라 정당하지만 문장 볼드는 장식일 뿐이다. 일괄 제거 시 **한 리스트 안에서 일부만 볼드로 남는 상태가 제일 나쁘다** — 블록 단위로 전부 있거나 전부 없게 정규화할 것. 볼드가 소제목 역할을 하던 자리(`**하나, X.**`)는 제거 후 문장 파편이 되므로 명사구로 다시 쓸 것.
- **제목·설명 SSOT는 `blogSeo.js`지 frontmatter가 아님**: `blog.js`가 `seo?.title || data.title`로 덮어써 h1·`<title>`·OG·JSON-LD·sitemap·RSS가 전부 레지스트리 값을 쓴다. **`.md`의 title을 고쳐도 화면은 안 바뀐다**(발행글 대부분이 이미 divergent) → 제목 수정은 `KO_TITLES`/`EN_TITLES`에서. 길이 한도는 테스트가 강제(KO 40자·EN 60자, 자동생성 description 포함). `updated`는 로케일별 날짜 Set → sitemap `lastmod`+`dateModified`이므로 KO만 고쳤으면 EN 날짜를 올리지 말 것.

### 12.25 세그먼트 나눠보기 필터 (매핑 role→토글)
차원 컬럼(성별·플랫폼·국가) 지정 시 분석을 값별로 나눠 봄. **엔진·게이트 불변, 행 부분집합만 필터해 재계산**. `role=segment` + `guessRole` 화이트리스트로 자동 안착(그 외 문자열은 tray, 오탐 방지). 세그먼트=탐색 토글이라 **게이트 시그 밖**(재분석 불필요), 매핑 잔상은 유효성 검사로 방지. 일괄 매핑 버튼은 segment 제외(사용자 지정 보존).

### 12.26 분석 전면광고 = 폐기 (PR #290)
광고 게이트를 어떤 형태로도 되살리지 말 것(`requestAd`는 호출부 호환 no-op만 잔존). 수익화는 이탈·AdSense 데이터 확인 후 별도 결정.

### 12.27 결론 카드 + 다운로드 허브 공용화
- **`ds/ResultActionCard`**: props `tone(good/bad/neutral)·headline(평어)·points[]·stats[]·download(node)`. 결과 최상단 항상 노출("결론 먼저"). **채택 현황은 선언하지 말고 grep으로 확인할 것** — 이 줄에 적힌 미채택 목록은 두 번 연속 낡은 채로 남아 있었다(적힌 4곳이 이미 다 채택돼 있었다). 2026-08-14 실측: 도구 15개 전부 카드 보유, 다운로드는 `PaidOrganicTrend`·`WebRMmmAdvanced` 2곳만 없음(둘 다 subtool/패널).
- **`ds/DownloadHub`**: "⬇ 결과 받기 ▾" 단일 드롭다운(바깥클릭/ESC 닫힘). 실제 다운로드는 `utils/download.js`(BOM+CRLF §7).
- **판정 로직은 도구별 렌더 유틸**(공용 아님): 5-2=WoW 최근 vs 직전(`dashboardVerdict.js`), MMM=기여/최적예산, Aha=최적 윈도우, PVM=top-mover. 공용은 카드 셸·허브·download.js뿐.
- **다운로드는 "계산한 인사이트"만 — 원천 데이터 되돌려주기 금지**(UX 무가치). 미매핑 지표는 표에서 제외(정직). 리텐션은 raw 윈도우 행에서 `computeWeightedRetention`.

### 12.28 랜딩 + 홈 구조 (`components/LandingPage.jsx` 단일 파일)
`LandingPage` = ① **1단 중앙 히어로**(eyebrow+헤드라인+한 줄 데크+목적 CTA 3열 균등+통합 신뢰 1줄) ② 질문형 도구 카드 ③ 주간 결정 루프 3단계 ④ `ConnectedToolJourney` ⑤ 블로그 | SOP 허브. **목적 선택(②)이 개념 설명(③)보다 앞**(첫 화면에서 바로 도구를 찾게, 스모크가 순서 강제).
- **히어로에 예시 판단 카드·장식 차트를 다시 넣지 말 것**: 구 `.dc-instrument`(가짜 수치 + `.dc-mini-chart` SVG)는 PR #644에서 히어로를 1단으로 재구성하며 제거됐다(CSS 20줄·COPY 10키 동반 삭제, 순변화 −118줄). 구 `ProductPreview`·`ToolCarousel`·`ToolCardMock`·`LiveMiniChart`도 삭제됨.
- **첫 화면 카피는 중복부터 센다**: 신뢰 배지와 프라이버시 줄이 같은 말을 두 번 하고, 데크가 CTA 힌트를 반복하고 있었다("글이 많다"의 정체). 동급 항목은 나열 대신 **박스로 묶어 균등 grid**(claude-ux §5) — 도구·목적 이름을 줄바꿈으로 줄줄 세우지 말 것.
- **진입 모션**: `utils/landingMotion.js`(anime.js v4, 히어로 타임라인·미니차트 SVG line-draw·스크롤 리빌). 셀렉터가 마크업과 1:1이라 클래스명을 바꾸면 모션 대상도 같이 고칠 것. 안전장치는 §7.
- **전 페이지 헤더/셸 완전 통일**: 도구·SOP·홈·블로그·가이드 전부 `Sidebar`+공용 `Header`+`GlobalModals`. 슬림 헤더 재도입 금지. 블로그는 routeMap 밖이라 `Header`가 `pathname`으로 직접 감지.
- **무주소 게이트 금지**: 상태로만 존재하는 화면은 뒤로가기가 깨짐 → 실제 라우트로(`/guide`·`/start`).
- **정직성**: 유저수·로고 날조 금지.

### 12.29 검색 진입면·유입 레시피 (2026-08)
도구·문서 페이지가 검색에서 살아남게 하는 공통 배선. 전부 render/메타층(엔진 불변).
- **도구 롱폼 = `lib/toolSearchContent.js` SSOT**: 공개 도구는 KO/EN `eyebrow·title·lead·question·answer·sections[3]·faq`를 갖는다. `ToolLongform`이 렌더하고 `page.js`가 `getToolFaq()`로 FAQPage JSON-LD를 만든다. 5-18 하위는 `responseSubtoolContent` 폴백. **커버리지 가드 테스트가 신규 도구 누락을 막는다.**
- **AEO: 답을 접기 바깥·JSON-LD 첫 항목에**(2026-08): LLM은 페이지 앞쪽에서 답을 뽑는다. 도구·비교 페이지는 `question`(예상 프롬프트) + `answer`(한 문장)를 갖고, 화면에서는 접기 **밖**에, 구조화 데이터에서는 FAQ **첫 항목**에 둔다. 가드가 `answer` 90자 상한·`?` 종결·FAQ 중복을 강제한다. 리스트·표가 추출에 유리하므로 비교는 산문이 아니라 표로 쓴다.
- **브랜드 사실은 `lib/brandFacts.js` 한 곳**: 무료·가입 없음·브라우저 처리·결정론 같은 문장이 랜딩·롱폼·`llms.txt`에 제각각 적혀 있으면 인용하는 쪽도 제각각 가져간다. `BRAND_FACTS`+`BRAND_LIMITS`(못 하는 것도 같은 급으로)에서 파생하고, **도구 이름·설명은 여기 적지 말고 `routeSeo`에서 조회**한다. 문자열을 검증하는 테스트도 SSOT를 조회해 대조할 것 — 문장을 테스트에 복사하면 SSOT를 고쳐도 옛 문장이 통과한다.
- **방법 비교(`/compare`)는 브랜드 vs 브랜드가 아니라 방법 vs 방법**: 남의 제품 사양을 표로 단정하면 검증할 수 없고 §8에 어긋난다. 마케터가 실제로 묻는 것도 "증분이랑 MMM 중 뭐 먼저"에 가깝다. SSOT `lib/compareContent.js`, 렌더 `ComparePage.jsx`, sitemap·llms.txt는 `COMPARE_SLUGS`에서 파생.
- **새 페이지는 sitemap에 넣었다고 사이트에 붙은 게 아니다**: `/compare`를 만들고 사이드바 링크 1개 + sitemap + llms.txt를 배선한 뒤 "배선 완료"라고 적었는데, 실제로는 **인바운드 링크가 사이드바 하나뿐이라 사이트와 떨어져 혼자 놓여 있었다**. 페이지가 나가는 링크(비교→도구)만 있고 들어오는 길이 없으면 유저도 크롤러도 도달하지 못한다. 체크리스트: ① 관련 도구 화면의 근거 영역(역인덱스로 **파생**) ② 푸터 ③ ⌘K(개별 항목으로 — 목록 1개만 넣으면 검색어가 안 걸린다) ④ 사이드바. 지금은 `compareContent.test.js`의 "사이트 접점" 가드가 **모든 비교가 최소 한 도구에서 도달 가능**함을 강제한다.
- **목록·표는 파생, 하드코딩 금지**: 템플릿 상세(`lib/templateCatalog.js`)는 실제 CSV 헤더와 일치를 골든으로 강제, 도구→콘텐츠 역링크(`lib/toolContentLinks.js`)는 forward 레지스트리에서 파생, 보고서 대상·sitemap·llms.txt도 라우트에서 파생.
- **공유 링크는 재조립**(`lib/decisionShare.js`): 입력 객체를 펼치지 말고 허용 필드만 새로 조립 + 상한 + noindex. 디코드도 같은 재조립을 거친다(변조 방어). 텍스트 다운로드 출처는 `withAttribution`(CSV엔 금지 — 파싱 깨짐).
- **콘텐츠 페이지에 앱 번들 흘리지 말 것**: 셸(Header 등)에서 조건 없이 무거운 모듈을 동적 import하면 canvas 없는 문서 페이지도 차트 번들을 받는다. 실제 필요 여부(예: `document.querySelector("canvas")`)를 먼저 확인.
- **리다이렉트·앵커 텍스트**: `redirects.test.js`가 301 목적지 실재·sitemap 잔존·체인·permanent를 검증. 관련 글/용어 링크의 앵커는 slug 원문이 아니라 **표시명**을 쓴다.
- **검토 메타(reviewer/reviewedAt)는 에이전트가 채우지 않는다** — 실제 검토가 있어야 하는 편집 정보다(§8). 인프라만 유지하고 값은 비워 둔다.

### 12.30 하단 마감 영역 = `ToolPageOutro` 한 박스 (2026-08)
분석 결과 아래 붙는 것(다음 단계·참고 자료·관련 글)은 **전부 `components/ToolPageOutro.jsx` 안**에 있다. KO/EN `PageClient`는 이 하나만 렌더한다.
- **경계선 소유자는 하나**: "분석 결과는 여기까지"는 outro가 소유하고 자식은 그리지 않는다. 경계가 자식에 있으면 그 위 형제(다음 단계 레일)가 분석 안쪽으로 읽힌다 — 실제로 그랬다.
- **박스는 한 겹**: 앱 본문은 open-ledger(테두리 없는 구획), 마감 영역만 닫힌 박스. 안쪽은 `.tool-outro__section` 얇은 선으로만 나누고 자식은 자기 테두리·바탕을 벗는다. 인접한 보조 박스(`.dashboard-support-tools`)도 같은 재질(`--operator-line`/`--work-surface`)을 쓴다.
- **`<footer>`는 body 직계가 아니면 이름 있는 landmark가 아니다** → 이름 붙은 `<section>`(role=region)으로 통째로 건너뛰게 한다.
- **타이포 하한 9.5px**(`app/typographyFloor.test.js`). 6~8px 모노 라벨이 앱 곳곳에 흩어져 있었고, `display:none`된 라벨이 테스트 `textContent`에는 잡혀 "검증했는데 안 보이는" 상태였다. 이 가드는 오래 `globals.css` **한 파일만** 훑었는데 인라인 `style={{fontSize}}`이 581곳이라 우회로가 통째로 열려 있었다 → 지금은 `src/**/*.jsx` 리터럴도 같은 하한으로 훑는다(계산식은 정적으로 못 읽으므로 대상 밖).

---

## 13. 참고 파일

- **`v2-migration/ARCHITECTURE.md` — v2 코드맵**(경로 매핑 ~200줄): 라우트↔컴포넌트↔엔진, SSOT(store), 글로벌 CSS. **큰 작업 착수 전 먼저 읽어 위치 파악**(전체 탐색보다 토큰 절약). 새 도구·엔진·경로·상태 추가/이동 시 **함께 갱신**(§15).
- `v2-migration/claude-ux.md` — UX 원칙 (§15.5 트리거 시 필독)
- `docs/v2-migration-tasks.md` — 마이그레이션 이력·결정 로그
- `docs/pitfalls.md` — 함정 상세 / `docs/backlog.md` — 백로그 + MMM 스펙(§B)
- `docs/system-audit-2026-08-12.md` — 최신 전면 감사(UI/UX·분석·구조, P0 3·P1 15·P2 12)
- `docs/aeo-prompt-checklist.md` — **생성물**. AEO 측정용 프롬프트 목록(KO/EN 각 17). 손으로 고치지 말고 `node scripts/aeo-prompts.mjs`로 재생성 — 원본은 `toolSearchContent`의 `question`/`answer`와 `compareContent`다. 월별 기록은 `docs/aeo-runs/`에 사본을 떠서 한다.
- `docs/design-system-baseline.md` · `docs/pvm-campaign-variance-spec.md` · `docs/regression-forecast-merge-spec.md` · `docs/content-analytics-rollout-spec.md` · `docs/custom-metrics-data-config-spec.md` — 기능별 설계 스펙
- `supabase/SETUP.md` · `supabase/schema.sql` — 현재 미사용(§3), 참고용 보존
- `.claude/agents/mkt-engineer.md` — 본 파일의 압축판(Claude 서브에이전트용, 같이 동기화)

---

## 14. 마지막 점검 체크리스트 (모든 PR 직전)

- [ ] `npm run test:all` 통과 / `npm run lint` 0
- [ ] conflict marker 없음
- [ ] PR 본문에 Summary + Test plan / 커밋에 Co-Authored-By
- [ ] main 직접 push 안 함 / `git add` 명시 파일만
- [ ] 사용자 요청 범위 안에서만 변경 / 외부 노출은 KR·EN 함께(§2.11)

---

## 15. 하네스 자가 업데이트 (Self-Update Protocol) ⚙

**규칙**: 태스크 완료 시점에 본 `AGENTS.md` + `.claude/agents/mkt-engineer.md`를 새 패턴으로 갱신. 루트 `CLAUDE.md`는 `@AGENTS.md` 포인터라 자동 반영(별도 편집·복사본 금지).

- **트리거**: PR 머지 성공 / 사용자 작업 전환·확인 / 검증된 새 anti-pattern 발견.
- **기록 대상**: 새 함정(§7) · 새 recipe(§12) · 새 anti-pattern(§11) · 새 사용자 의사결정 패턴(§9) · 새 통계 표준(§8) · 새 절대 원칙(§2).
- **v2 코드맵 동기화 (필수)**: 새 도구·엔진·경로·상태 슬라이스를 추가/이동/삭제하면 **`v2-migration/ARCHITECTURE.md`를 같은 작업에서 갱신**. 코드맵은 경로 매핑만(설명 최소·~200줄 유지).
- **기록 안 함**: 기존 패턴 평범 적용 · 일회성 결정 · 일반 프로그래밍 지식 · 너무 좁은 변수명/경로 · "임시"라고 명시한 것.
- **형식**: 해당 섹션에 항목 추가, **태스크당 5줄 이내**, 다른 항목과 톤 일치. 상세는 PR·`docs/`에 두고 여기엔 핵심 패턴만.
- **용량 규율 (필수)**: 새 항목 추가 = **압축 1회 동반**. 죽은 코드를 전제한 규칙(삭제된 파일·폐기된 아키텍처)은 발견 즉시 제거 — **틀린 규칙은 없는 규칙보다 해롭다.** 단순 append-only로 비대해지지 말 것.
- **커밋**: 작업 PR에 같이 포함(선호) `docs(harness): ...` 또는 별도 docs 커밋.
- **주기적 압축 제안**: 작업 전후로 사용자에게 "하네스를 압축·개선할까요?"라고 주도적으로 묻는다.
- **사용자 우선**: 사용자가 "self-update 하지 마"면 즉시 중단(그 예외도 본 §15에 메모). **§15 자체를 삭제하지 말 것** — 메커니즘 사라지면 하네스 정체.
- **자기 검증**: 업데이트 후 다시 읽어 자연스럽게 합쳐졌는지·길이 확인.

---

## 15.5 유저 친화적 UI 개선 트리거 (필독) 🎨

사용자가 **"유저 친화적으로 개선"·"너무 복잡"·"이해 안 됨"·"전문용어 많음"·"직관적이지 않음"·"가독성"** 등 UX 단순화를 요구하면, **작업 착수 전 반드시 `v2-migration/claude-ux.md`를 먼저 읽고** 그 원칙대로 진행한다. (핵심: 결론 먼저·근거 접기 2층 구조, 여정=질문 프레임, 상태별 칸반 그룹핑, 지표=평어 질문+평어 답, 그룹배지↔상세 판정 모순 방지, grid 균등 정렬, 맨밑 상세문서 다운로드 탈출구, 통계적 정직성.) **수학 엔진은 절대 건드리지 않고 렌더층만 재구성.**

---

## 16. 현재 상태

- ✅ **v2 컷오버 완료** — `v2-migration/`이 운영 앱 SSOT. 레거시 `index.html` 런타임 제거(git 히스토리 보존). Railway Root Directory=`v2-migration`.
- ✅ 검증 하네스: `npm run test:all` **250파일·1984 통과**(1 skipped) · eslint 0 · `next build` ✓ (2026-08-17 실측). **수치를 적을 땐 실제로 돌려서 적을 것**.
- ✅ **가이드(SOP) 검색 진입면** — 15개 전부 `routeSeo` 전용 메타 + `guideSearchContent`(질문·답·FAQ) + FAQPage·BreadcrumbList + 도구/글/용어 아웃바운드. 이전에는 그룹 desc 폴백으로 같은 그룹끼리 설명이 겹치고 아웃바운드가 0건이었다.
- 🔄 디자인시스템(§12.21)·결론카드/다운로드허브(§12.27) 채택 — 완료 선언 전 grep(§12.27에 실측일 기재).
- 🔄 **진행 중**: 결정 검토 루프(`/weekly-review` — 기준일+N일 비교 후보, 명시적 완료), 데이터 라우터(`/start` — 업로드 후 가능한 분석 추천).
- ⏸ **보류**: 커스텀 지표·viewConfig를 5-3·5-18·5-21로 확장(SSOT `docs/custom-metrics-data-config-spec.md`, 도구당 1200~2500줄 — 별도 세션). 9-5 콘텐츠 도구.

---

## 17. 토큰 효율 규율 (컨텍스트 위생) 💰

파일 tool result = 매 턴 재전송(고정비용). 아래는 룩업 테이블, 장문 서술 금지(이 섹션 자체가 매 턴 실림).

| # | 규율 | 적용 |
|---|---|---|
| 1 | 파일/함수 단위로만 읽기 | 큰 파일은 `wc -l`→offset/limit. ToC(`ARCHITECTURE.md`·§13)로 위치 파악 후 그 파일만. 이미 컨텍스트에 있으면 재Read 금지 |
| 2 | 무거운 탐색만 서브에이전트 | "영향범위·코드베이스 조사"류는 격리해 요약만 회수. 작은 셸/git은 직접(왕복 오버헤드 손해) |
| 3 | `.claudeignore` 우선 차단 | `node_modules`·`.next`·`*.csv`·디버그 잔재. 시그널 레이어일 뿐 — 진짜 민감파일은 도구별 permission deny로 |

**세션 관리(에이전트 규율 아님 — Gondry님 운영 체크리스트)**: 1~3은 세션 안에서 절약, 진짜 방지책은 **세션을 안 키우는 것**. 기능 종료마다 compact, 작업 전환마다 clear, 워크스트림별로 세션 분리.

---

*과거 상세(PR별 함정·recipe 풀버전)는 git 히스토리·각 PR description·`docs/*.md`에 보존. 본 파일은 의사결정에 실제 쓰이는 규칙·패턴·현재 상태만 유지한다.*
