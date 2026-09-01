# 남은 항목 인수인계 — 2026-09-01

## 2026-09-02 재감사 결론

2026-09-01의 "차단 항목 없음" 결론은 **PR #781의 실제 사용자 진입 경로를 다시 검사한 결과 정정이 필요하다.** 원격 `main`은 PR #781까지 반영되어 있지만, 아래 개선은 아직 로컬 `codex/blog-aeo-tool-clarity` 브랜치에만 있다.

### 1. PR #781 고정 환율 고지 — P1 정직성 결함 수정

PR #781은 고정 환율 고지를 추가했지만, 효율 CSV의 실제 업로드 경로에는 원본 통화가 저장되지 않았다. 일부 화면은 숫자를 환산하고 일부는 통화 기호만 바꿨으며, 5-3·5-21·5-22처럼 환산하지 않는 도구에도 환산 고지가 나타날 수 있었다. 예를 들어 원본 `₩1,400`을 USD로 바꾸면 `$1.00`이 아니라 `$1,400.00`으로 보일 수 있어 사용자에게 거짓 의미를 전달했다.

재감사 수정은 다음 계약으로 통일했다.

- 효율 도구(5-2·5-3·5-21·5-22)는 원본 데이터 통화를 먼저 선언하고, 숫자는 환산하지 않는다.
- 모든 효율 화면은 같은 원본 통화 단위로 숫자를 표시한다.
- 통화 선언을 바꾸면 기존 분석은 stale 처리되어 다시 확인해야 한다.
- 실제 고정 환율 환산은 이미 환산 계산을 수행하는 5-18 추세·MMM·예측 경로에만 유지한다.
- 기존 무통화 분석 서명은 byte-identical하게 보존해 저장된 주간 리포트를 불필요하게 stale 처리하지 않는다.

### 2. 랜딩 도구 제목·질문 위계 개선

기존 랜딩은 "질문으로 고르기"라고 안내하면서 짧은 도구명을 가장 크게, 판단 질문을 작고 흐리게 표시했다. 질문은 두 줄로 잘렸고, `full` 카드가 답변을 제공한다는 코드 계약과 달리 실제 답변은 렌더하지 않았다.

재감사 수정은 기존 SSOT 카피만 재사용해 다음처럼 바꿨다.

- 사용자의 판단 질문을 카드 제목으로 먼저 표시한다.
- 도구명은 `도구 / Tool` 메타 라벨로 내려 역할을 명확히 한다.
- 카드에서 받을 수 있는 결과를 `결과 / You get`으로 노출한다.
- 질문의 강제 두 줄 잘림을 제거하고, `full` 카드에는 기존 답변·필요 데이터까지 표시한다.
- 명령 팔레트의 보이는 질문도 랜딩과 같은 정본 질문을 사용한다.
- 삭제된 카드용 CSS·테스트·모션 셀렉터를 실제 `ToolIndex` 구조로 교체한다.

### 3. 블로그 SEO·AEO·GEO 감사

구조적 기반은 양호하다. 공개 글은 KO 47개·EN 47개(각 초안 1개 별도)이며, 공개 글마다 직접 답변, 조건 분류, 내부 링크, FAQ, canonical/hreflang, sitemap, `BlogPosting`/`Article`/`BreadcrumbList`/`FAQPage` 구조화 데이터, 작성·수정일, 저자 카드가 배선되어 있다.

다만 "최적화 완료"로 단정할 수는 없다.

- 공개 글 중 사람 검토자·검토일이 명시된 글은 5개뿐이다. 확인되지 않은 검토자는 추가하지 않는다.
- 소스가 명시된 글은 10개, 본문에서 외부 근거 링크가 확인된 글은 9개다. 통계·플랫폼 정책·방법론 주장은 1차 출처를 우선 보강한다.
- KO 글 중 약 500단어 미만이 9개, EN은 4개다. 단순 분량 확장보다 실제 의사결정 예시·실패 조건·데이터 요구사항을 보강한다.
- 2026-08-04 이후 GSC/Bing 실성과 재확인은 미확인이다. 노출·클릭·쿼리·인용 여부를 확인하지 않고 AEO/GEO 성과를 주장하지 않는다.
- FAQ 구조화 데이터는 일반 사이트의 Google FAQ 리치 결과를 보장하지 않는다. 실제 질문에 답할 때만 유지한다.
- 공개 도구 중 주 콘텐츠가 없는 우선 후보는 5-29 구성 변화, 5-28 액션 생존·이탈, 5-18-forecast 미래 예측, 5-18-paid-organic 유입 변화맵이다. 검색 수요와 사용자 질문을 확인한 뒤 이 순서로 작성한다.

저자 URL이 `/contact`를 가리키면서 실제 저자 프로필이 없던 불일치도 수정했다. KO/EN 연락처 페이지에 기존 정본의 이름·역할·소개를 보이는 프로필로 추가하고 동일한 `ProfilePage` 구조화 데이터를 연결했다.

### 4. 재감사 검증

- Vitest: 360 파일, 2,827 테스트 통과
- ESLint: 오류 0, 경고 0
- Next.js 16.3.2 production build: 396 페이지 성공
- 브라우저 육안 검증, Playwright E2E, 배포 상태, GSC/Bing 실성과: 이번 로컬 작업에서는 미확인

## 2026-09-01 당시 결론

제품 코드·검증 관점의 차단 항목은 없다. PR #779(감사 수정), #780(ESLint 10·MMM 검증 예외), #781(전면 감사 재발 가드)까지 원격 `main`에 반영되어 있다.

> 이 문단은 작성 당시 기록이다. 위 2026-09-02 재감사 결론이 현재 상태를 대체한다.

`#780` 기준 검증은 다음과 같다.

- Vitest: 355 파일, 2,811 테스트 통과, skip 0
- ESLint 10: 오류 0, 경고 0
- Next production build: 396 페이지 성공
- Playwright E2E: 25 통과
- `npm audit` 및 production audit: 취약점 0
- GitHub Quality gate·CodeQL·Railway 배포: 성공
- `https://growthoptplaybook.com/`, `/en`, `/start`: HTTP 200 확인

## 후속 추적 항목

### 1. Next.js 플러그인의 ESLint 10 peer 선언

상태: **upstream 대기, 런타임 차단 아님**

`eslint-config-next@16.3.2`가 의존하는 아래 플러그인은 현재 ESLint 10을 peer 범위에 선언하지 않는다.

- `eslint-plugin-import@2.32.0`
- `eslint-plugin-jsx-a11y@6.10.2`
- `eslint-plugin-react@7.37.5`

따라서 `npm ci`는 성공하지만 peer override 경고 3개를 출력한다. ESLint 공식 호환 레이어(`@eslint/compat`)와 `typescript-eslint` parser를 적용한 뒤 실제 전체 린트는 오류·경고 없이 통과한다.

다음 행동:

1. Next 또는 위 플러그인이 ESLint 10 peer 범위를 공식 지원하면 `@eslint/compat`과 parser override 제거 가능성을 먼저 검증한다.
2. `npm ci --strict-peer-deps`와 `npm ls eslint --all`이 성공하는지 확인한다.
3. 성공 시 브리지 제거 전후 `npm run lint`, `npm run test:all`, `npm run build`, `npm run test:e2e`를 모두 재실행한다.

참조:

- ESLint v10 migration guide: <https://eslint.org/docs/latest/use/migrate-to-10.0.0>
- Next.js ESLint 10 compatibility issue: <https://github.com/vercel/next.js/issues/89764>

### 2. Next.js 패치 업데이트

상태: **저장소의 7일 패키지 냉각 정책으로 보류**

`npm`의 `before` 설정이 활성화되어 있어, 정책 기준시점보다 새 패키지는 설치하지 않는다. 확인 시점에는 `next@16.3.4`가 이 정책 때문에 설치 대상이 아니었고, 현재 lock은 `next@16.3.2`를 유지한다.

다음 행동:

1. 정책상 설치 가능해진 뒤 `npm outdated --json`으로 후보를 다시 확인한다.
2. Next와 `eslint-config-next`는 반드시 같은 버전으로 올린다.
3. ESLint peer 선언 항목과 중복 해결되는지 확인한 뒤 전체 검증과 Railway 배포 상태를 확인한다.

### 3. 사용자 소유 미추적 작업 18개

상태: **범위·소유자 확인 전 보존**

아래 범주는 기존 사용자 작업으로, 이번 감사·의존성·검증 머지에는 포함하지 않았다.

- `_workspace/`, `workspace/`
- 제품·하네스·기획 문서 12개
- `ToolMetricWorkspace` 컴포넌트·스모크 테스트·metrics 유틸·테스트 4개

다음 행동:

1. 각 묶음을 별도 작업 단위로 검토한다.
2. 제품 코드인 `ToolMetricWorkspace` 묶음은 구현 목적과 테스트 범위를 확인한 뒤 독립 PR로 처리한다.
3. 문서 묶음은 SSOT(`AGENTS.md`, `docs/product-ssot.md`)와 충돌 여부를 확인한 뒤 필요한 것만 반영한다.

## 재확인 명령

```bash
cd v2-migration
npm ci
npm run test:all
npm run lint
npm run build
npm run test:e2e
npm audit --audit-level=low
npm audit --omit=dev --audit-level=low
npm outdated --json
```

## 브랜치 메모

이 문서는 작성 시점에 로컬 브랜치가 원격 `main`보다 PR #781 한 커밋 뒤인 상태에서 새 미추적 파일로 만들었다. 원격 변경을 덮어쓰지 않기 위해 자동 rebase·커밋·push는 하지 않았다. 반영하려면 최신 `origin/main` 기준의 새 문서 브랜치에서 이 파일만 별도 PR로 올린다.

2026-09-02 재감사 작업은 최신 `origin/main`에서 만든 `codex/blog-aeo-tool-clarity` 브랜치에서 수행했다. 이 시점의 수정은 커밋·push·PR 생성 전이며, 기존 사용자 미추적 파일은 보존했다.
