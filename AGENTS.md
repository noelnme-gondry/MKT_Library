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
- `TOOL_GROUP`(`src/lib/toolGroups.js`)이 `라우트 id → 그룹`. 같은 grain은 슬라이스 공유(efficiency=5-2·5-21·5-22·5-3·start-gate), 이질 도구는 격리(aha·creative·experiment·response·incrementality·brand_incrementality·content_*).
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
- **모델 래퍼는 `.model.predict`지 `.predict` 아님**(5-3): `predictSafeCpr(wrap, cost)`가 CPR 반환, 결과=cost÷CPR. 직접 호출은 **undefined→결과 0**. 골든은 순수 math만 봐서 못 잡음 → **각 분배 경로를 데모로 repro**.
- **5-18 MMM**: ROAS는 표시층 invert만(배분은 CPR 공간). 회귀계수는 **연관≠인과**. 전부-0/완전공선 컬럼 → `_nonRedundantCols`(Gram-Schmidt) 드롭. 희소 채널 음수 탄력성은 "노이즈"지 "잠식" 아님.
- **`const x = ... f(()=>...x...)` 자기 참조 = TDZ throw**: const 초기화식 안에서 자신을 참조하면 callback 실행 시 ReferenceError. `&&` 단락으로 안 도는 기본 경로는 멀쩡, 조건 truthy 되는 순간 throw. 모듈 상수 선언 순서도 같은 함정 — 파생 상수는 원본 뒤에.

**렌더·UI**
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
`<div class="chart-container"><canvas/></div>` → `chartCommonOpts()`+`CHART_THEME` 옵션 → 생성 직후 rAF `resize()` → 재렌더 전 destroy. PNG 버튼은 `downloadChartAsPNG`. **하드코딩 색·CSS `var()` 리터럴 금지**(§7).

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
- **여러 글 → 필라 통합 = 6곳 동시 갱신**: ① `content/blog(-en)`·`glossary(-en)` 파일 add/삭제(**EN 짝파일 필수** — 경로는 `blog-en`이지 `en/blog` 아님) ② `next.config.mjs redirects()`에 구 URL→필라 301(ko·en 각각) ③ **레지스트리 3종 정합**(`contentRegistry.test.js`가 강제): `contentToolRegistry`·`blogSeo`·`localizedHref` ④ 삭제글 참조 glossary `relatedPosts` 재지정. 내부 링크는 KR 상대경로만(렌더러가 EN 접두).
- **SEO 연동**: `sitemap.js`·`rss.xml`이 `getAllPosts`로 직접 포함(블로그는 fs가 SSOT). SOP(JSON)는 MD 이관 안 함.

### 12.25 세그먼트 나눠보기 필터 (매핑 role→토글)
차원 컬럼(성별·플랫폼·국가) 지정 시 분석을 값별로 나눠 봄. **엔진·게이트 불변, 행 부분집합만 필터해 재계산**. `role=segment` + `guessRole` 화이트리스트로 자동 안착(그 외 문자열은 tray, 오탐 방지). 세그먼트=탐색 토글이라 **게이트 시그 밖**(재분석 불필요), 매핑 잔상은 유효성 검사로 방지. 일괄 매핑 버튼은 segment 제외(사용자 지정 보존).

### 12.26 분석 전면광고 제거 상태 (PR #290 이후 폐기)
`AdInterstitial`·`AdFreeInit`·`adGate`·`adFree` 전부 삭제됨. `requestAd(cb)`만 호출부 호환용 no-op 래퍼로 잔존 — 광고 게이트·비밀 URL로 되살리지 말 것. 수익화는 이탈·AdSense 정책 데이터 확인 후 별도 결정.

### 12.27 결론 카드 + 다운로드 허브 공용화
- **`ds/ResultActionCard`**: props `tone(good/bad/neutral)·headline(평어)·points[]·stats[]·download(node)`. 결과 최상단 항상 노출("결론 먼저"). **공개 분석 도구 전체 채택 완료.**
- **`ds/DownloadHub`**: "⬇ 결과 받기 ▾" 단일 드롭다운(바깥클릭/ESC 닫힘). 실제 다운로드는 `utils/download.js`(BOM+CRLF §7).
- **판정 로직은 도구별 렌더 유틸**(공용 아님): 5-2=WoW 최근 vs 직전(`dashboardVerdict.js`), MMM=기여/최적예산, Aha=최적 윈도우, PVM=top-mover. 공용은 카드 셸·허브·download.js뿐.
- **다운로드는 "계산한 인사이트"만 — 원천 데이터 되돌려주기 금지**(UX 무가치). 미매핑 지표는 표에서 제외(정직). 리텐션은 raw 윈도우 행에서 `computeWeightedRetention`.

### 12.28 랜딩 + 홈 구조 (`components/landing/*`)
`LandingHome` = ① 헤드라인+CTA 2개(내 데이터=`/start` / 데모)+프라이버시 배지 ② `ProductPreview`(브라우저창 프레임, 도구 미니화면 로테이션; SVG 목업 결정론·전역store 비침습) ③ `ToolCarousel`(←/→ + 마우스 드래그, 드래그후 클릭 가드) ④ 블로그 | SOP 허브 카드.
- **전 페이지 헤더/셸 완전 통일**: 도구·SOP·홈·블로그·가이드 전부 `Sidebar`+공용 `Header`+`GlobalModals`. 슬림 헤더 재도입 금지. 블로그는 routeMap 밖이라 `Header`가 `pathname`으로 직접 감지.
- **무주소 게이트 금지**: 상태로만 존재하는 화면은 뒤로가기가 깨짐 → 실제 라우트로(`/guide`·`/start`).
- **캐러셀 드래그**: `scroll-snap mandatory`가 드래그를 프레임마다 잡아채 "뚝뚝" → 제거(자유 스크롤)+드래그 중 `scroll-behavior:auto`.
- **정직성**: 유저수·로고 날조 금지.

---

## 13. 참고 파일

- **`v2-migration/ARCHITECTURE.md` — v2 코드맵**(경로 매핑 ~200줄): 라우트↔컴포넌트↔엔진, SSOT(store), 글로벌 CSS. **큰 작업 착수 전 먼저 읽어 위치 파악**(전체 탐색보다 토큰 절약). 새 도구·엔진·경로·상태 추가/이동 시 **함께 갱신**(§15).
- `v2-migration/claude-ux.md` — UX 원칙 (§15.5 트리거 시 필독)
- `docs/v2-migration-tasks.md` — 마이그레이션 이력·결정 로그
- `docs/pitfalls.md` — 함정 상세 / `docs/backlog.md` — 백로그 + MMM 스펙(§B)
- `docs/code-health-audit.md` — 코드·아키텍처 건강성 감사
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
- ✅ 검증 하네스: `npm run test:all` **183파일·1257 통과**(golden+jsdom smoke) · eslint 0 · `next build` ✓.
- ✅ 디자인시스템(§12.21)·결론카드/다운로드허브(§12.27) 전 도구 채택 완료.
- 🔄 **진행 중**: 결정 검토 루프(`/weekly-review` — 기준일+N일 비교 후보, 명시적 완료), 데이터 라우터(`/start` — 업로드 후 가능한 분석 추천), 브랜드 증분(5-24 ITS).
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
