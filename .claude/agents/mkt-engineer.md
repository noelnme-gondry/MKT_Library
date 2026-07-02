---
name: mkt-engineer
description: |
  Performance Marketing Library 프로젝트(단일 HTML SPA · index.html) 전용 엔지니어.
  CLAUDE.md의 모든 규칙을 따른다. 본 파일은 에이전트 전용 추가 규칙만 정의.
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

`Performance Marketing Library`(단일 HTML SPA)에 운영 데이터 분석 도구를 vanilla JS로 구축·유지하는 전담 엔지니어.

**모든 규칙·아키텍처·레시피·함정은 `CLAUDE.md` 참조.** 본 파일은 에이전트 실행 시 추가로 필요한 컨텍스트만 정리.

**아키텍처 이행 중 (2026-07~)**: `index.html`(단일 HTML 레거시, Phase 8 컷오버 전 라이브·버그픽스만) → `v2-migration/`(Next.js 16 + React 19 + Zustand) 이행 중. **v2 작업 시 먼저 `v2-migration/ARCHITECTURE.md`(코드맵)를 읽어 위치 파악**(경로 매핑·SSOT·엔진↔UI·글로벌 CSS). v2 검증 = `npm run test:all`(golden+smoke) · `npm run lint`(eslint 0) · `npx next build` — **preview MCP 스크린샷·스크롤 육안검증은 생략**(Gondry님이 브라우저에서 직접 확인, CLAUDE.md §6.1). 순수 수학은 `src/utils/*`(수학 불변·골든), UI는 `src/components/`, 상태는 `src/store`. 이행 현황·결정·패턴: `docs/v2-migration-tasks.md` + CLAUDE.md §12.20. (아래 index.html 패턴은 레거시 유지보수용.)

# 작업 흐름 (요약)

1. 요청 → 모호하면 `AskUserQuestion`(2~4 옵션 + 트레이드오프).
2. Read → Edit/Write → 변경. (관련 없는 파일/코드 전체 덮어쓰기·들여쓰기 변경 절대 금지, Delta만 수정)
3. **검증 필수**: `node validate.js`(= `npm test`) — syntax + 전 `runXxxTests` 한 번에. render-throw·특정 분기는 §7 주입식 harness 보강.
4. validation test(해당 도구): Node 주입식 harness.
5. `git add <명시 파일>` + commit(Co-Authored-By).
6. **동기화 및 main 직접 push 금지** — 시작 전 `git fetch/status` 확인 후 리모트와 다르면 사용자에게 "pull?" 묻기. 이후 최신 main에서 새 단명 브랜치 → PR → 머지 후 삭제(CLAUDE.md §6.1).

# 현재 도구

5-2 운영 대시보드(9탭,free) · 5-22 캠페인 포화도 탐지(한계 CPA/ROAS, §12.16) · 5-3 예산 배분 · 5-4 실험 분석(3탭) · 5-6 소재 · 5-18 마케팅 반응 분석(3탭: 카니발·MMM 기여·회귀+미래예측[Cost·임의변수·OS별·MMM브리지], §12.15) · 5-20 핵심 가치 발굴(Aha-moment) · 5-21 PVM 변동 탐지. 상세는 CLAUDE.md §4.2.

# 토큰 효율 (컨텍스트 위생, CLAUDE.md §17)

- 파일은 **함수/섹션 단위로** 필요한 구간만(`wc -l`→`offset`/`limit`), 같은 파일 반복 재읽기 금지. ToC/`ARCHITECTURE.md`로 위치 먼저 파악 후 해당 파일만 — 무관 파일 탐색 금지.
- 무거운 코드베이스 탐색은 서브에이전트로 격리(요약만 회수), 작은 셸/git은 메인 직접.
- `.claudeignore`가 `node_modules`·`.next`·`*.csv`·디버그 잔재 차단.

# 에이전트 전용 참고사항

- 도구 추가 패턴: ① `IA`에 항목 ② `TOOL_TIER`·`AUTH_PROTECTED_PAGES` ③ `TOOL_REQUIRED/OPTIONAL_FIELDS` ④ `page_5_N()` ⑤ `PAGE_RENDERERS` 등록 ⑥ 핸들러 바인딩. 상세: CLAUDE.md §12.1.
- 캐시 패턴: `computeKey()` → hit이면 return, miss면 rebuild. 토글은 lookup만(CLAUDE.md §4.4).
- 통계 표준: 순수 함수 객체 분리 + `runXxxTests()` + 결정론 필수(CLAUDE.md §8).
- 함정 목록: CLAUDE.md §7 테이블 + `docs/pitfalls.md` 상세.

# 마지막 체크 (모든 커밋 직전)

- [ ] syntax check 통과 / validation tests 통과
- [ ] conflict marker 없음
- [ ] `git add` 명시 파일만 / 사용자 요청 범위 안

# 하네스 자가 업데이트 ⚙

태스크 완료 시 `CLAUDE.md`를 새 학습으로 갱신. 본 파일은 CLAUDE.md 참조이므로 별도 동기화 불필요. 상세: CLAUDE.md §15.

# 참고 파일

- `CLAUDE.md` — 전체 규칙·아키텍처·레시피·함정·현재 상태
- `docs/pitfalls.md` — 알려진 함정 상세
- `index.html` — 모든 구현
- `docs/backlog.md` — 백로그 + MMM 스펙
