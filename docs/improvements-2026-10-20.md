# 2026-10-20 전체 개선 작업

사용자 요청: 전체 개선 영역 감사 후 “개선할 거 전부 작업해”. 기준은 `054d88bf`이며, 구현은 `codex/full-improvements-20261020`에서 진행한다. 기존 작업 폴더의 분기와 미추적 파일은 보존한다.

## 범위와 진행

| 감사 항목 | 작업 | 상태·근거 |
|---|---|---|
| G01 의존성 | 호환 업데이트·파서 교체·CI 운영 audit | Next/eslint-config-next 16.4.2, nodemailer 10.1.7 등 반영. 운영 경고 8→0; 미패치 개발 의존성 1개가 5개 경고 항목으로 남음 |
| G02 내보내기 | 외부 텍스트 보호·내부 수식 보존 | 공용 CSV 직렬화 및 PVM·MMM·소재·Aha·콘텐츠·증분·대시보드·VIF·리뷰·이벤트 경로 반영. 실제 스프레드시트 재읽기·이벤트 재업로드 검증 |
| G03 초기 로딩 | 매핑과 React 분리·실행 시 어댑터 로딩·라우트 분할 | 최종 빌드 KO 핵심 경로 gzip JS 약 1,086→678KiB(37.5%), EN 예산 963→536KiB(44.4%), 동일 블로그 글 559→492KiB(12.0%) 감소 |
| G04 초기 HTML | 기존 카피에서 목적·입력 안내 제공 | 공개 도구 레지스트리에서 파생한 KO/EN HTTP 응답 검사 통과. `/start`도 기존 안내를 로딩 중 제공 |
| G05 브라우저 검사 | 저장 창 준비 시점·서버 포트 파생 | 포커스 준비 후 Escape 검사, Safari 저장 창의 호출 버튼 복귀 수정. 결제 return URL은 현재 origin 파생. E2E_PORT/E2E_BROWSER 지원 |
| G06 문서 | 보관·브라우저 검증의 현재 계약 반영 | AGENTS의 CSV 보관 설명과 제품 SSOT의 현재 Playwright 도입 상태 수정 |
| G07 대용량 입력 | 취소·중복 입력 경합·기존 상한 검증 | 읽기 중 취소 후 워커 실행 회귀 재현·수정. CSV chunk 중단·XLSX worker 종료·화면 이탈/새 파일의 오래된 결과 차단 |
| G08 계산 응답성 | 대표 데이터 계산·메모리 측정 | 합성 1만·5만·10만 행 측정. 10만 행 준비 약 1.4초, 계산 106ms, heap 증가 215MiB. 모바일/실데이터의 안전 상한은 미확인 |
| G09 통계·결과 | 관련 골든·실제 내보내기 일치 | 수학 엔진·골든값 불변. 음수·백분율은 숫자로 유지하고 PVM/MMM 내부 수식은 계산 가능한 수식으로 유지 |
| G10 진입·디자인 | 변경 구역 실제 화면·과업 확인 | 320·980·1440px에서 변경 화면 확인, 가로 넘침 0. KO 다크·EN 라이트 검증. 지연 로딩 시 예시가 부모 초기화에 지워지던 경합 수정 |
| G11 저장·리텐션 | 저장 실패·복원·브라우저 경계 | CSV 삭제 대상 프로젝트를 고정하고 대기 중 프로젝트/그룹 전환 보호. WebKit 파일 저장 실패 시 트랜잭션을 중단해 후속 삭제가 멈추는 문제 수정. 리뷰·이벤트 CSV의 수식 보호와 원문 재가져오기 양립. 실제 사용자 잔존율은 미확인 |
| G12 결제·메일 | 로컬 PostgreSQL·mock 계약·공개 설정 검증 | 격리 DB 통합 검사 실행. 운영 공개 GET에서 live 결제·계정·메일 설정 활성 확인. 실결제·메일 도착·운영 복구는 미확인 |
| G13 접근성 | KO/EN·폭·테마·다른 엔진 확인 | Chromium 1,588개 통과·18개 조건부 제외, WebKit 핵심 20개 통과. Firefox 19개 통과 후 시간 초과 1개 경로를 KO/EN 총 6회 재검증해 통과 |
| G14 계측 | family 집계와 하위 도구 구분 | 기존 tool_id=5-18과 중복 제거 유지, 공개 하위 도구 ID에서만 tool_route_id 파생. GA 등록·수신은 배포 후 확인 |
| G15 검색 | 초기 HTML·공개 라우트 회귀 | 공개 URL 386개 HTTP 검사: 응답·메타 누락·canonical 불일치·구조화 데이터 파싱·noindex·제목/설명 중복 오류 0. 검색 콘솔 재수집·색인·순위 효과는 배포 전 측정 불가 |
| G16 AI 노출 | 인용과 세션 구별 | SSR 목적·입력·활용 안내 개선을 공통 반영. AI 답변 인용 증가는 별도 관측이 필요하며 세션 증가로 대체하지 않음 |
| G17 인증·보안 운영 | CSP·요청 제한·격리 계약 | 인증·계정 격리·결제 제한 회귀 검사. process별 제한의 replica 전체 효과와 운영 edge 설정은 미확인; 엄격 CSP를 검증 없이 강제하지 않음 |
| G18 유지보수 | 매핑 로직과 UI 책임 분리 | MMM 순수 매핑을 lib로 이동하고 API 재노출. 경고 숫자 해석은 기존 MMM 공용 파서로 연결. toolFieldKeys의 빠진 상수 import도 수정 |
| G19 릴리스·복구 | audit·성능 기준선·회귀 자동화 | CI 운영 audit 추가, production 초기 JS 800KiB 한도와 공개 도구 초기 안내 검사 추가. 실운영 롤백은 수행하지 않음 |
| G20 작업 환경 | 최신 main 별도 브랜치 | 완료, 원래 작업 폴더 변경 없음 |

## 화면 변경 검토

| 위치·상태 | 현재 사용자 영향 | 변경 방향 | 보존할 정보·행동 | 검증 |
|---|---|---|---|---|
| 분석 도구의 초기 본문 | 일부 경로는 로딩과 이동 링크만 먼저 제공 | 기존 검색 콘텐츠의 목적·입력 요약을 바로 읽게 함 | 결과 우선, 전체 방법·근거는 기존 참고 화면, 실제 계산과 업로드 | 초기 HTML, KO/EN, 320·980·1440 |
| `/start` 초기 로딩 | 준비 중 문구만 보임 | 기존 시작 안내를 로딩 중에도 제공 | 업로드·매핑·methods 분기·분석 큐 | 첫 방문·업로드·뒤로가기와 초기 HTML |

목적 → 필요한 근거 → 행동: 데이터를 올리기 전에 답할 질문과 필요한 열을 이해하고, 업로드 또는 파일 양식 확인으로 이어지게 한다. 기존 스타일과 승인된 홈 배경을 유지한다. 추가 설명을 결과 위에 반복하거나 모든 방법론을 펼치지 않는다.

## 호환성 확인

- Markdown 파서 교체 전 blog/blog-en/glossary/glossary-en 205개 파일의 파싱 결과를 보존했고, 교체 후 메타데이터와 본문이 모두 일치했다.
- 사용자 요청에 따라 이번 설치에만 `--min-release-age=0`을 적용해 최신 호환 패치를 선택한다. 전역 npm 설정은 변경하지 않는다.
- 결과 수식·수학 엔진·골든값·내부 도구 ID·CSV 그룹 계약은 보존한다.
- 실행 결과와 미확인 범위는 아래 검증 결과와 각 항목에 기록했다.

## 남은 외부 조건과 측정 한계

- 개발용 `braces <=3.0.3`의 [중첩 패턴 스택 고갈 취약점](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)은 공식 수정 버전이 없다. 현재 설치 트리에서는 eslint-config-next → Next lint plugin → fast-glob → micromatch 경로에만 있으며 운영 의존성 audit에는 포함되지 않는다. 경고를 없애려고 Next lint 설정을 14로 내리거나 audit를 우회하지 않았다.
- 초기 JS는 HTTP HTML에 선언된 로컬 script의 gzip 합계다. 사용자 네트워크 전송량·실제 LCP·INP·캐시 적중률과 같은 값이 아니다.
- 일부 제목은 React 스트리밍 응답의 숨겨진 페이로드에 있다. 초기 HTML 검사에서 이를 가시 제목으로 세지 않았으며, 브라우저에서 복원된 실제 DOM의 제목·접근성은 별도 검사한다.
- 합성 성능은 Node 24에서 한 번씩 실행한 값이다. GC와 기기 상태 영향을 받으므로 heap 증가를 최대 메모리 사용량으로 해석하지 않는다. 기존 CSV 100MiB 및 XLSX 제한은 유지했다.
- 운영 공개 설정은 2026-10-20에 읽기만 했다. 공개 설정 활성과 실제 결제·복원·메일 도착 성공은 다르다.
- WebKit 자동화에서 원본 File의 IndexedDB 저장이 `UnknownError`로 거절되는 경우를 확인했다. 실패 상태를 유지하면서 다음 작업이 막히지 않게 수정했다. 실제 Safari 기기에서 원본 파일 저장·복원의 성공 여부는 별도 확인이 필요하다.
- 배포, GA 관리자 설정, 실제 결제·메일 발송, 검색엔진 재수집, 실사용자 리텐션/AI 인용 관측은 로컬 구현·테스트와 분리해 남긴다.

## 주요 파일

- `v2-migration/package.json`, `package-lock.json`, `.github/workflows/quality.yml`: 의존성과 운영 audit.
- `v2-migration/src/utils/download.js`, `pvmExport.js`, `storeEvents.js`, `src/lib/decisionReview.js`, 도구별 내보내기: 수식 보호·숫자·원문 보존.
- `v2-migration/src/components/CsvUploader.jsx`, `src/lib/data-import/xlsxWorkerClient.js`: 취소·중복 요청·워커 정리.
- `v2-migration/src/store/useDataStore.js`, `src/lib/workspace-storage/datasets.js`, `WeeklyReview.jsx`, `ReviewSaveDialog.jsx`: 프로젝트 경계·저장 실패·포커스 복귀.
- `v2-migration/src/lib/data-import/mmmColumnMapping.js`, `src/lib/assistant/loadAnalysisRunner.js`, `responseColumnMapping.js`, KO/EN `PageClient.jsx`: 초기 번들 분리.
- `v2-migration/src/components/ToolEntrySummary.jsx`, `StartGateIntroduction.jsx`, `StartGate.jsx`, `src/lib/startPageCopy.js`: 초기 안내와 예시 진입.
- `v2-migration/src/lib/frontmatter.js`, `analytics.js`, `e2e/initial-delivery.spec.js`: 파서·계측·초기 전송량 회귀 검사.

## 검증 결과

- `npm run test:all -- --maxWorkers=2`: 597개 파일, 5,328개 테스트 통과. 격리된 로컬 PostgreSQL을 연결해 DB 통합 검사도 실행했다.
- `npm run lint`, `npm run build`: 통과. 빌드는 350개 정적 페이지를 생성했다.
- 회귀 증명: CSV 수식 주입, 읽기 중 업로드 취소, 프로젝트/그룹 전환 중 CSV 삭제, 저장 실패 트랜잭션 정리를 수정 전 실패·수정 후 성공으로 확인했다.
- 매핑 추출 AST 비교: 38개 최상위 선언 중 37개 동일. `mmmForecastInputWarnings`만 기존 공용 숫자 파서 사용으로 변경했다.
- 단위 검사와 여러 브라우저를 과도하게 동시 실행한 시도는 타임아웃이 발생해 중단했다. 테스트 시간 제한이나 단언을 완화하지 않고 작업 수를 제한한 전체 재검사에서 통과했다.
- Chromium 전체: 1,588개 통과, 18개 조건부 제외(HTTP 검사의 폭 중복, 데스크톱 전용 순회 등), 실패 0. 320·768·1440px와 EN 라이트 프로젝트를 포함한다.
- WebKit 핵심 흐름: 20개 전부 통과. 계정 매핑의 다른 브라우저 적용, CSV/Sheets 입력, 샘플 전체 도구 진입, 뒤로가기, 저장 실패 후 재시도·새로고침, 포커스 복귀를 검사했다.
- Firefox 핵심 흐름: 19개 통과·뒤로가기 1건 시간 초과. 같은 코드 재실행 3회 통과 후, 돌아온 결과 셸의 계산 큐가 안정화될 때까지 기다리는 조건을 추가했다. KO/EN 각각 3회, 총 6회 추가 검사에서 통과했다. 단발 타임아웃의 원인을 앱 오류로 단정하지 않았다.
- 변경 화면은 320·980·1440px에서 한 번씩 확인했다. 가로 넘침 0, 실제 DOM의 h1 1개였으며 스크린샷 반복 검사는 하지 않았다.

## 작업 인계 상태

- 브랜치: `codex/full-improvements-20261020`.
- 기준 커밋: `054d88bf81407f66aaf60264d02df6c00fa10184`. PR 준비 시 fetch한 `origin/main`과 같은 기준에서 구현·검증했다.
- 보관 위치: `/Users/gondry/Desktop/MY Project/Library-full-improvements-20261020`.
- 사용자가 2026-10-20 머지를 요청해 검증된 변경을 PR로 제출한다. 최종 머지·배포 상태는 연결된 PR과 배포 기록을 기준으로 확인한다. 원래 `Library` 폴더의 `codex/checkout-presentation` 브랜치와 기존 미추적 파일은 보존했다.
- 검증 로그·지표·회귀 증거는 새 작업 폴더의 `v2-migration/test-results/improvements-20261020/`에 보관했다. 기존 gitignore에 따라 커밋 대상에서 제외된다.
