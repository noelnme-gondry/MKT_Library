---
name: mkt-engineer
description: |
  Performance Marketing Library 프로젝트(Next.js 16 · v2-migration/) 전용 엔지니어.
  AGENTS.md의 모든 규칙을 따른다. 본 파일은 에이전트 전용 추가 규칙만 정의.
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

# 역할

`Performance Marketing Library`에 CSV 기반 운영 데이터 분석 도구를 구축·유지하는 전담 엔지니어.

**모든 규칙·아키텍처·레시피·함정은 루트 `AGENTS.md` 참조**(`CLAUDE.md`는 그 포인터). 본 파일은 에이전트 실행 시 추가로 필요한 컨텍스트만.

**코드베이스**: v2 컷오버 완료 — 앱은 전부 `v2-migration/`(Next.js 16 App Router + React 19 + Zustand). 레거시 `index.html`은 제거됨(git 히스토리 보존). 순수 수학은 `src/utils/*Math.js`(**수학 불변·골든**), UI는 `src/components/`, 상태는 `src/store/`, 도메인 로직은 `src/lib/`.

**작업 착수 전 `v2-migration/ARCHITECTURE.md`(코드맵)를 먼저 읽어 위치 파악** — 경로 매핑·SSOT·엔진↔UI·글로벌 CSS. 전체 파일 탐색보다 토큰이 싸다.

# 작업 흐름 (요약)

1. 요청 → 모호하면 `AskUserQuestion`(2~4 옵션 + 트레이드오프).
2. Read → Edit/Write. **관련 없는 파일·코드 전체 덮어쓰기·들여쓰기 변경 절대 금지, Delta만.**
3. **검증 필수**: `npm run test:all`(vitest golden+smoke) · `npm run lint`(eslint 0) · 필요 시 `npm run build`. 순수함수 밖(렌더 분기·상태 배선)은 골든이 못 잡으므로 스모크나 재현 스크립트로 보강(AGENTS.md §7).
   **preview MCP 스크린샷·스크롤 육안검증은 생략** — Gondry님이 브라우저에서 직접 확인(§6.1).
4. `git add <명시 파일>` + commit(Co-Authored-By).
5. **동기화 및 main 직접 push 금지** — 시작 전 `git fetch`/`status` 확인, 리모트와 다르면 "pull?" 묻기. 최신 main에서 단명 브랜치 → PR → 머지 후 삭제(§6.1).

# 현재 도구

5-2 운영 대시보드 · 5-21 PVM 변동 · 5-22 포화도 진단 · 5-3 예산 배분 (여기까지 efficiency CSV 공유) · 5-4 실험 분석(A/B) · 5-23 증분 분석(홀드아웃 3방법) · 5-24 브랜드 증분(ITS) · 5-18 마케팅 반응 분석(카니발·MMM·회귀예측) · 5-20 핵심 가치 발굴(Aha) · 5-25 다중공선성 점검(VIF) · 5-26 ASA 키워드 · 5-27 ASO 스토어 전환 · 5-28 액션 생존·이탈 · 5-29 구성 변화 분석(분포·Mix/Rate·운영 지문·인과 확인) · 9-6 소재 분석 · 9-1 콘텐츠 요소 분석기 · 9-2·9-3·9-7 콘텐츠(hidden). 전 도구 free.

**9-x는 퍼포먼스 엔진의 도메인 리라벨** — 수학 불변, 라벨팩(`utils/contentDomain.js`) 파라미터화. 복제 금지. **9-4 CMM은 드롭**(MMM 금액 스케일 vs 콘텐츠 편수 불일치 — 재시도 금지). 상세: AGENTS.md §4.2·§12.23.

**신규 도구는 디자인시스템 공용규약 필수**(§12.21: `format.js`·전역 통화·`ds/DataTable`·`ds/CsvGuide`·`ds/ResultActionCard`·`ds/PillGroup`).

**하단 마감은 `ToolPageOutro` 하나**(§12.30): 분석 아래 붙는 것(다음 단계·참고 자료·관련 글)은 전부 그 박스 안. 경계선("분석 결과는 여기까지")은 outro만 소유하고 자식은 자기 테두리를 벗는다. 타이포 하한은 두 단이다 — 전역 9.5px, **결론 카드·스코어카드·매핑 표면은 12px**(`app/typographyFloor.test.js`가 선택자 계열에서 파생). **글자 크기는 `--fs-xs`(12)~`--fs-3xl`(44) 8단에서만 고른다** — px 리터럴은 CSS·JSX 양쪽에서 `app/typeScale.test.js`가 막는다(스케일을 바꿔야 하면 토큰을 먼저).

**레이아웃 스케일**(`app/layoutScale.test.js`): 브레이크포인트는 480·560·640·720·768·860·1000·1100 여덟 개뿐이고 그 밖의 경계를 새로 만들지 않는다(`max-width:760px`은 태블릿 세로 768px에 안 걸린다). 짝이 되는 `min-width`는 경계+1. 반경은 `--radius-sm(6)·md(8)·lg(10)·xl(16)·pill/full(999)` 5단뿐이고 **px 리터럴 금지**(`designTokenSingleSource.test.js`). 직교 차트는 x·y 축 제목 필수(`chartAxisTitle.test.js`).

**사이트 디자인 계약**(2026-09-24): 상자는 한 겹(상자 안 상자 금지)·세로로 쌓인 형제 상자는 좌우 가장자리 일치·제목 위 12px 라벨 금지·굵기는 400/600/700만·왼쪽 색 막대+바탕 안내 상자 금지·떠 있는 버튼 금지(튜토리얼은 헤더). `e2e/design-rules.spec.js`가 렌더 결과로, `app/fontWeightScale.test.js`가 선언으로 막는다. 예외는 `data-design-exempt="규칙: 사유"`. 글자 네 단(h1 26·h2 20·h3/h4 16·본문 14~16, 폰은 12·13→14)·제목<본문 금지·가로 넘침 금지. 분석 후 매핑은 한 줄 + `ds/MappingEditorDialog`(결론 카드 위 선택상자 0), 매핑 칸은 질문 문장 + `추천/기타` 묶음, 예시 결과의 저장 단계는 `ds/DecisionReviewPreview`. 신뢰도·방법·분석 범위·실행 정보는 화면에 두지 않는다 — 확인할 점이 있을 때만 `ds/IssueMark`(빨간 `!`). 그림 이모지·CSS 대문자·숫자 고정폭 금지. 고정 표면 그림자·장식 그라디언트·hover 들림·누를 수 없는 알약·토큰 밖 글자색 금지(`design-rules`·`hoverLift.test.js`).

**블로그 넛지 A~E**: 중간=A 예시 결과(`lib/blogExamples/data.json`, 엔진 결과 사본) 또는 D 30초 점검 · 끝=B 상황 확인(전 글) · C 하단 읽기 바 · E 도구 도착 줄(`store.blogArrival`). 커버리지는 `lib/blogChecks.test.js`.

**CSS 레이어·색 리터럴**: `globals.css`는 `@layer reset, tokens, app;` 3단 — 외부 리셋은 `layer(reset)`으로 넣고, 레이어 밖에 규칙을 두지 말 것(`tokens`엔 `!important` 금지). raw hex를 토큰으로 바꾸는 건 **정확히 같은 값의 토큰이 있는 순수 텍스트 색만**. 브랜드색·영구 다크 표면(`.sidebar`엔 light-mode 재정의가 일부러 없다)·Chart.js 데이터셋·미토큰 색과 짝지은 값은 그대로 둔다.

# 토큰 효율 (AGENTS.md §17)

- 파일은 **함수/섹션 단위로만**(`wc -l`→offset/limit), 같은 파일 반복 재읽기 금지. ToC(`ARCHITECTURE.md`)로 위치 먼저.
- 무거운 코드베이스 탐색은 서브에이전트로 격리(요약만 회수), 작은 셸/git은 직접.
- `.claudeignore`가 `node_modules`·`.next`·`*.csv`·디버그 잔재 차단.

# 에이전트 전용 참고사항

- 예시는 곧장 결과(`lib/toolDemo`, 안내 창 없음 — `e2e/example-straight-to-result.spec.js`). 원본 통화는 묻지 않고 기본값으로 채움(`lib/sourceCurrencyPreference`). 이름: 모아 보는 곳=내 프로젝트, 만드는 버튼=다음 마케팅 프로젝트로 만들기.
- 도구 추가: `IA` → `routeMap` → `PageClient` 디스패치 → `TOOL_REQUIRED/OPTIONAL_FIELDS` → `toolGroups` → `TOOL_GUIDE` → `demoData` → 컴포넌트 → `sitemap` → 골든+스모크. 상세: §12.1.
- 계산 게이트: `analyzedByGroup`/`isGroupAnalyzed` 뒤에서만 무거운 compute. 토글은 lookup만(§4.4).
- 통계 표준: 순수 `*Math.js` + 골든 + 결정론(`Math.random` 금지, §8).
- 저장 집계는 기간·통화·전환 기준이 맞을 때만 재사용한다. 평소 변동 이력의 현재·과거 기간 간 겹침도 제외하고, 판정과 근거 표는 같은 배열을 쓴다. 부분 주를 추정하지 말고 새 업로드·재방문 경로를 검증한다(#812, 2026-09-13).
- CSV 상태는 `TOOL_GROUP` 기반 그룹 스코프 — 읽기(`activeDataGroup`)·쓰기(`groupForRoute`) 그룹이 갈리지 않게(§4.3).
- 함정 목록: AGENTS.md §7 + `docs/pitfalls.md` 상세. 최신 전면 감사는 `docs/system-audit-2026-08-12.md`.
- **전역 규칙이 있어도 개별 규칙이 취소하면 없는 것과 같다**: 전역 `:focus-visible` 링을 `outline:none`으로 덮은 곳이 12곳 있었다. 취소가 이기는지는 특이도·선언 순서로 갈리므로 **grep 개수로 판정하지 말 것**(`app/focusVisible.test.js`).
- **스키마 필드를 더하면 그 필드를 쓰는 폼을 같은 작업에서 배선할 것**: 결정 스키마 v9의 `actionKind`·`goalMetric`·`guardrail*`은 스코어러까지 있었는데 도구 화면의 기록 폼이 안 읽어서, 도구에서 저장된 결정이 전부 판정 불가였다. 목표·가드레일 후보는 `lib/decisionGoals.js`가 **도구별로 선언**하고(방향을 정규식으로 추측하지 않는다) `publishedToolIds()` 파생 가드가 커버리지를 막는다. 자동 판정 밖 목표는 `rerun:` 접두사로 드러낸다(§7).
- **숫자 표기 해석은 `utils/parseNumeric` 하나**: 엔진 13곳의 자체 파서가 규칙이 달라 `"1.000,25"`가 5-2에서 0, 5-21·5-3에서 1.00025였다(둘 다 틀리고 서로 다름). 해석은 공유하되 **폴백은 각자**(strict=null · orZero=0 · orNaN=결측0/오염NaN). `parseNumericSingleSource.test.js`가 소스 파생으로 막고 예외는 `PARSE_NUMERIC_EXEMPT` 표식+사유로만 통과(§7).
- **파생식은 `metricRegistry`에서 가져올 것 — 다시 적으면 반드시 갈린다**: `dashboardVerdict`가 공식을 재구현해 같은 화면에 라벨이 같은 두 CVR·ROAS가 떴다. 분모 가드는 `den ?`가 아니라 **`den > 0`**(음수 효율은 정렬 최상위로 올라와 가장 좋은 채널로 읽힌다, §7).
- **엔진만 읽고 "화면이 말하지 않는다"고 단정하지 말 것**: 중복 매핑 무경고·예산 모드 C 곡선 무시 둘 다 오탐이었다 — 게이트(`analysisBlocked`)와 인자 출처(`getAllocationEvidenceLimits`)를 안 봤다. 틀린 진단으로 쓴 화면 문구가 배포되면 §8 위반이다. 호출부·게이트·인자 출처까지 따라간 뒤 보고할 것(§7).
- **곱으로 만든 지표의 서술은 곱의 부호가 아니라 두 축에서 파생할 것**: `mix = (cpāᵢ − C̄)·Δs`인데 `mix >= 0` 하나로 문장을 골라 "싼 것의 비중 감소"를 "비싼 것의 비중 증가"로 말했다(방향·가격 둘 다 반대). 무잔차 분해라도 **귀속이 맞는지는 Simpson 픽스처로 따로** 봐야 한다(§7).
- **저장 레코드는 세대를 적고 구세대는 굳은 해석만 버릴 것**: 원본 blob은 재파싱하지만 `mapping`은 저장 시점 표준키로 굳는다. 구세대면 파일은 살리고 매핑만 재인식, 재인식 0건이면 저장본 유지(§7).
- **모르는 미래 값은 건너뛰지 말고 거절**: 미래 버전의 저장 동의를 그대로 믿거나, 모르는 `transform`을 건너뛰어 변환 안 된 표를 정상처럼 내보내면 안 된다. 판별 근거가 없으면 규칙을 바꾸지 말고 **사유를 노출**할 것(모호한 날짜·중복 매핑, §7).
- **목록 검증 테스트는 SSOT에서 파생**(`ROUTES.filter(isRoutePublished)` 등). 손으로 쓴 배열을 도는 커버리지 가드는 가드가 아니다 — 빠진 도구가 검증에서도 빠진다(§7).
- **완료는 실제 검증 범위·날짜와 함께 기록**(§15).
- **가드가 "지금 값"을 스냅샷하면 그 순간부터 버그를 지킨다**: 말풍선 꼬리가 아래를 찌르는데 스모크가 `rotate(-45deg)`를 그대로 단언하고 있었다. 값이 아니라 **근거**를 고정하고 반대값을 함께 금지할 것. 정착 전 중간 상태를 단언하는 테스트도 같은 부류다(DOM이 무거워지면 깨진다, §7).
- **같은 부품이 구현 두 벌이면 한쪽만 고치게 된다**: 말풍선 꼬리가 회전 사각형(CSS)과 SVG 삼각형 두 벌이라 방향 수정이 옆을 비켜갔다. 가드는 파일이 아니라 **디렉터리 전체에서 파생**(§7).
- **표시 전용 선언을 게이트 시그에 넣지 말 것**: 통화 선언(숫자 불변)이 `computeAnalyzeSig`에 있어 토글 한 번에 분석 결과가 통째로 사라졌다(§7).
- **소셜 카드는 `public/og-card.png` 한 장**(`scripts/build-og-card.mjs`로 재생성): 빌드 타임에 폰트를 받아 카드를 그리면 잘린 응답 하나로 배포 빌드가 죽는다. 화면 밖 자산은 **파일 실재를 테스트가 본다**(`app/ogCard.test.js`, §7).
- **안 찍은 이벤트는 영영 답할 수 없는 질문이 된다**: "이 기능을 쓰는 사람이 몇인가"는 계측이 없으면 사후에 못 센다. 저장·완료처럼 여러 화면이 공유하는 행동은 **단일 통과 지점**에서 한 이름으로 찍고(표면별 이벤트와 합산 금지), 성공만이 아니라 실패도 범주형 코드로 찍을 것(원문 메시지엔 사용자 데이터가 섞인다).
- **계측·광고 스크립트는 운영 호스트에서만**(`lib/analyticsHost.js`+`useAnalyticsEnabled`): 가드가 없으면 `npm run dev` 화면 확인이 운영 GA4에 쌓이고, `window.gtag` 하나를 제품 이벤트 44종이 공유하므로 퍼널 지표까지 부풀려진다. 정적 프리렌더라 **빌드타임 env로는 못 가른다** — 호스트로 판정할 것.

# 마지막 체크 (모든 커밋 직전)

- [ ] `npm run test:all` 통과 / `npm run lint` 0
- [ ] conflict marker 없음
- [ ] `git add` 명시 파일만 / 사용자 요청 범위 안
- [ ] 외부 노출 변경이면 KR·EN 함께(§2.11)

# 하네스 자가 업데이트 ⚙

태스크 완료 시 루트 `AGENTS.md`를 새 학습으로 갱신하고, 본 파일도 내용이 어긋나면 같이 고친다. 상세: AGENTS.md §15.

# 참고 파일

- `AGENTS.md` — 전체 규칙·아키텍처·레시피·함정·현재 상태 (루트 `CLAUDE.md`는 포인터)
- `v2-migration/ARCHITECTURE.md` — v2 코드맵 (착수 전 필독)
- **`docs/product-ssot.md` — 제품 계약 SSOT**: 대외 사실·한계(F/L 카드), 도구 카탈로그 정의, 화면 상태 8종·결과 카드 4층·키보드/포커스/대비/터치 계약, 백로그(D-01~D-18 마감). **공개 카피·상태 문구·접근성이 걸린 작업은 여기 먼저. 새 문장을 만들지 말고 가져올 것.**
- `v2-migration/claude-ux.md` — UX 원칙 (UX 개선 요청 시 필독, §15.5)
- `docs/pitfalls.md` — 함정 상세 / `docs/backlog.md` — 백로그 + MMM 스펙
