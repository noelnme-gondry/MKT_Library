# Dots UX 감사 후속 점검

대상: GrowthOpt_Playbook_UX_Audit_KO.docx의 B01–B10, U01–U05, H01–H05.
기준: origin/main d8f2d400. 기존 작업 디렉터리를 보존한 별도 worktree에서 수정했다.

## 점검 결과

| 항목 | 반영 및 검증 결과 |
| --- | --- |
| B01 | `weekly-performance` 실제 앵커·포커스·스크롤 여백 추가. 결과→리뷰, 뒤로→재진입을 KO/EN 브라우저에서 확인. |
| B02 | 개인정보 안내가 `PRO_TRIAL_DAYS`를 사용하도록 변경. 주간 보고서 글 KO/EN의 14일을 현행 7일로 수정. |
| B03 | Meta 앱 AEM에 8개 이벤트 제한을 일괄 적용하던 설명과 가짜 설정 JSON 제거. 앱별 지원 조건·이벤트 관리자 확인 절차로 교체. |
| B04 | `oneOf`를 전부 필수로 세지 않고 대체 역할로 표시. Aha·콘텐츠 요소·홀드아웃의 필수 역할·설명·라벨 보강. KO/EN 동일 계약 확인. |
| B05 | 서로 다른 계산 조건을 같은 결과처럼 보이게 하던 문제 수정. 미리보기 조건을 이동 전에 알리고, 상세에는 실제 이전 요약·기간·예산과 현재 기간·방식·제약을 함께 표시. 수학과 기본 제약은 유지. |
| B06 | 금액·부호·소수·단위는 한 덩어리로 유지하고 화살표 사이 값은 줄바꿈 허용. 320px·1180px 및 EN 1440px에서 숫자 단일 줄·가로 넘침 검사. |
| B07 | 템플릿 상세 KO/EN에 공용 셸, `main-content`, 건너뛰기 목적지 추가. 키보드 진입 확인. |
| B08 | Meta 공식 도움말을 우선 연결하고 Google 문서는 ‘Meta 내보내기 단계’로 정확히 표시. 기존 Google 문서에도 실제 Meta 설명이 있어 완전히 잘못된 링크라는 판단은 보정. |
| B09 | 계정 화면 아래 SOP 폴백 및 가이드 후속 영역 중복 제거. KO/EN 계정 화면 확인. |
| B10 | 주간 보고서 글 샘플의 비교 기간을 8/31–9/6 대 9/7–9/13으로 명시해 상세에 전달. 인라인 그림도 같은 첫 두 주로 재생성. 사용자 업로드에는 적용하지 않음. |
| U01 | PNG 버튼 옆에 구매 이용권 필요·체험 제외를 표시. PNG 전용 구매 안내와 공용 다운로드 시도/성공/실패 계측 연결. 실제 PNG 파일 생성 검사 통과. |
| U02 | 저장 모달 상단에 44px 닫기 버튼 추가. 작은 화면 노출, Escape, 포커스 복귀, 초안 보존, 저장 실패 후 재시도·새로고침 확인. |
| U03 | 분석 가능한 도구가 없는 CSV는 ‘준비 완료’로 표시하지 않음. 매핑 수정·템플릿 복구 경로와 집계형 `no_supported_analysis` 상태 계측 추가. |
| U04 | 결과 확인 후 설문 표시를 60초 지연. 지연 전 비노출 및 기존 세션/영구 닫기 정책 확인. |
| U05 | Google 앱 캠페인의 Android/iOS 앱 구분과 국가 묶음 조건을 명확히 함. 보편적 최소 이벤트 수·확정 성과 상승 등 근거 없는 단정 제거. |
| H01 | 모의 인증·결제 서버로 체험 진입, 구매 취소/성공·복귀, 만료 후 읽기 전용 흐름 확인. 실제 OAuth 제공자·실결제 검증은 미실행. |
| H02 | 최소 4역할 PVM 실제 계산 회귀 추가. Aha·요소 분석의 유효 입력, 증분 분석 3모드·잘못된 날짜/지표·불가능한 행 검사를 포함한 기존 전체 테스트 통과. 전 도구의 모든 최소 열 조합·실사용 CSV 성공률 전수 검증은 미실행. |
| H03 | 주요 단계 계측 대조, 분석 불가 상태와 PNG 계측 보강. 아래 분모 정의 작성. 운영 이벤트 데이터가 없어 실제 전환율·개선 폭은 미확인. |
| H04 | 전체 발행 KO/EN 블로그의 렌더 후 강조 문법 누출 검사 추가. KO 8개 글의 깨진 강조 10곳 수정. SOP 하이라이터를 단일 토큰 처리로 바꿔 생성된 span 재처리 방지; 5개 언어 원문 보존 및 KO/EN 실제 복사 확인. |
| H05 | 내부 이동·뒤로가기에서는 CSV 이어짐 확인. 새 탭 직접 진입·새로고침은 원본 CSV 복구를 보장하지 않는 브라우저 메모리 계약대로 빈 상태/프로젝트 진입 안내를 제공. 저장된 리뷰 초안 복구는 별도 검사. |

## 주요 변경 위치

- 계약: `docs/product-ssot.md`, `v2-migration/ARCHITECTURE.md`.
- 리뷰·상태·결제 안내: `ProjectReviewWorkspace.jsx`, `ReviewSaveDialog.jsx`, `StartGate.jsx`, `FigurePngButton.jsx`, `SubscriptionPurchasePrompt.jsx`, `sourceSurvey.js`.
- 예산 조건: `assistant/allocationPreview.js`, `AllocationPreviewNotice.jsx`, `AssistantWorkspace.jsx`, `BudgetAllocation.jsx`.
- 템플릿·글·가이드: KO/EN 템플릿 레이아웃과 페이지, `templateCatalog.js`, `csvTemplate.js`, `blogPractice.js`, `BlogCsvAnalysis.jsx`, `CampaignPvm.jsx`, `sopHighlight.js`, `SopContent.jsx`, EN SOP JSON 및 해당 블로그 원고.
- 회귀 검사: `uxAudit.test.js`, `e2e/dots-ux-audit.spec.js`와 기존 관련 smoke/e2e.

통계 수학·골든값은 변경하지 않았다. `src/utils/` 변경 없음. 사용자 CSV 원본을 서버로 보내거나 저장하는 경로는 추가하지 않았다.

## 검증 결과

2026-10-08, 위 브랜치의 최종 코드 기준:

| 검증 | 결과 |
| --- | --- |
| `npm run test:all` | 579개 파일·5,116개 테스트 통과. 1개 파일·4개 테스트 건너뜀. |
| `npm run lint` | 통과. |
| `npm run build` | 통과, 정적 페이지 342개 생성. |
| 프로덕션 빌드 관련 Playwright | 78개 통과. KO 320/1180px 다크, EN 320/1440px 라이트. |
| 실제 PNG 다운로드 Playwright | KO 320/1180px 2개 통과. 이미지 파일 생성·크기 확인. |
| `git diff --check` | 통과. |

브라우저 검사는 합계 80개이며 전체 서비스의 모든 화면을 뜻하지 않는다. 실기기·스크린리더, 실제 OAuth·결제사 계정, Meta 로그인 후 계정별 설정 화면은 미검증이다. 테스트 로그의 jsdom 미구현 경고는 있었으나 실패는 없었다. 건너뛴 테스트는 통과 수에 포함하지 않았다.

## 운영에서 확인할 지표와 분모

집계 이벤트 건수의 단순 비율은 사용자 전환율이 아니다. 동일 기간·유입 경로·언어·기기별 코호트에서 세션/사용자를 연결하고 순서를 확인해야 한다. 예시 실행(`source=demo`)과 실제 업로드는 분리한다. 이벤트 집계 CSV만으로 연결할 수 없다면 단계별 발생 건수로만 보고한다.

| 확인 목적 | 이벤트 | 분모 및 해석 |
| --- | --- | --- |
| 진입→업로드 | `landing_data_start_clicked`, `blog_tool_cta_clicked`, `data_import_start`, `data_import_success` | 해당 CTA를 누른 세션 중 같은 경로에서 업로드를 시작/완료한 세션. 예시 시작은 `example_run_started`로 별도 집계. |
| 매핑→결과 | `mapping_confirmed`, `analysis_completed`, `analysis_result_viewed` | 매핑을 확정한 실제 데이터 세션 중 `result_state=ready` 결과를 얻고 본 세션. 매핑 확정 자체를 계산 성공으로 취급하지 않음. |
| 분석 불가 | `analysis_blocked`, `state=no_supported_analysis` | 해당 시작 화면에서 실제 파일을 불러온 세션 중 분석 불가 상태가 발생한 세션. 업로드 실패와 구분. |
| 결과→프로젝트 | `review_entry_clicked`, `project_review_saved` | `source=dochi`, `placement=dochi_result` 진입 세션 중 저장까지 이어진 세션. 다른 메뉴의 리뷰 진입과 합치지 않음. |
| 다운로드 | `result_download_attempted`, `subscription_gate_viewed`, `result_downloaded`, `result_download_failed` | 동일 도구·형식·출처에서 시도한 세션을 분모로 성공/차단/실패를 구분. PNG는 `download_type=png`, `source=core_figure`. |
| 체험·구매 | `trial_started`, `begin_checkout`, `purchase` | 동일 진입 코호트에서 단계별 연결 확인. 체험은 다운로드 구매 권한과 구분. |

배포 전후 같은 길이의 기간을 비교하되 유입량·기기 구성·캠페인 변화도 함께 확인한다. 운영 데이터는 이번 작업에 제공되지 않아 전환율, 개선 폭, 인과 효과는 계산하지 않았다. 변경은 아직 배포하지 않았다.

## 공식 자료 확인 범위

- [AppsFlyer Meta AEM for iOS](https://support.appsflyer.com/hc/en-us/articles/19228737402129-Meta-Ads-Aggregate-Event-Measurement-AEM-for-iOS): 앱 AEM 지원 조건·설정 범위 확인. 모든 계정에 같은 이벤트 수 제한을 단정하지 않도록 수정.
- [Google 앱 캠페인 만들기](https://support.google.com/google-ads/answer/12575501?hl=en): 앱 플랫폼 선택과 위치 타기팅 구분 확인.
- [Google의 비용 데이터 가져오기 및 Meta 내보내기 단계](https://support.google.com/analytics/answer/16748649#meta): 기존 링크 안에 Meta 단계가 실제 존재함을 확인.
- [Meta 광고 보고서 내보내기](https://www.facebook.com/business/help/849477685213347): 공식 목적지 연결. 로그인/접근 제한으로 계정별 화면 세부는 미확인.

이번 사실 검토는 문서가 지적한 AEM·앱 캠페인·내보내기 설명 범위다. 다른 SOP 전체의 모든 외부 사실까지 재검증했다고 보지 않는다.

## 작업 보존 및 전달 상태

별도 worktree: `/Users/gondry/.codex/worktrees/ux-audit-fixes/Library`.
브랜치: `codex/ux-audit-fixes`, 마지막 확인 시 `origin/main`과 커밋 차이 0/0이며 수정 사항은 미커밋 상태다. 커밋·push·PR·배포는 수행하지 않았다.

원래 작업 디렉터리의 `codex/checkout-presentation`과 미추적 파일들은 변경하지 않았다. 그 브랜치의 원격 추적 브랜치는 삭제된 상태이므로 이번 작업과 분리해 보존했다.

## 추가 제보: PNG 버튼 주변 차트 축소

사용자 스크린샷의 일별 비용 추이 화면을 재현했다. 대시보드의 `height: var(--dashboard-chart-height, revert-layer)`가 기본 상태에서 같은 CSS 레이어의 차트 높이를 취소해 일부 캔버스가 150px로 줄었다. 제목 아래 별도 PNG 버튼 줄도 불필요한 세로 공간을 차지했다.

`globals.css`에서 기본 높이를 취소하는 규칙을 제거하고, 사용자 지정 높이만 적용하도록 유지했다. `VizTab.jsx`에서는 PNG 버튼을 제목·설명 옆으로 옮겼다. 좁은 화면에서는 머리 부분이 줄바꿈되더라도 차트 높이는 유지한다.

`e2e/chart-layout.spec.js`는 수정 전 300px 높이 단언에서 실패했다. 수정 후에는 기본 차트 5종의 300px 높이, PNG 생성 후 높이 유지, 버튼 숨김과 무관한 높이, 사용자 지정 420px 및 기본값 복귀, 가로 넘침을 KO/EN·모바일/데스크톱에서 검사한다. 앞선 PNG 파일 생성 검사만으로 화면 높이 정상 여부를 확인한 것은 아니었으며, 이 검사로 보완했다.

추가 수정 후 차트 회귀 및 대시보드 탭·편집·권한 브라우저 검사 11개 통과, 린트·빌드 통과. 전체 테스트 최초 실행에서는 다른 작업과 동시에 실행하는 동안 기존 비동기 대기 검사 3개가 시간 초과/대기 실패했다. 코드나 제한 시간을 바꾸지 않고 전체 재실행하여 5,116개 통과(4개 건너뜀)를 확인했다. 최초 실패 원인이 자원 경합인지는 확정하지 않았다.
