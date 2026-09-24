# GA4 제품 퍼널 이벤트

## page_view 기준

앱은 SPA다. 직접 Google tag는 `send_page_view:false`로 초기화하고
`GaPageviews`만 최초 진입과 URL 변경마다 `page_view`를 한 번 보낸다.

GTM에서 같은 `G-DK12TNR0GW` GA4 태그를 발화시키거나, GA4 Enhanced Measurement의
**browser history 변경 page view**를 켜면 다시 중복된다. 둘 중 하나만 사용한다.

## 이벤트

| 이벤트 | 시점 | 핵심 파라미터 |
|---|---|---|
| `blog_read_depth` | 블로그 글 읽기 진행률이 25·50·75·100%에 처음 도달 | `content_slug`, `content_type`, `interaction_source`, `state=depth_25\|50\|75\|100`, `locale` |
| `blog_session_articles` | 같은 세션에서 2번째 이후 블로그 글 진입 | `content_slug`, `content_type`, `interaction_source`, `rank`(세션 내 몇 번째), `locale` |
| `blog_cta_viewed` | 글·용어의 행동 요소가 실제 viewport에 노출 | `tool_id`, `content_slug`, `content_type`, `placement=article_mid\|article_post\|reading_bar\|self_check\|situation_check`, `locale` |
| `blog_tool_cta_clicked` | 글·용어에서 연결 도구 선택 | `tool_id`, `content_slug`, `content_type`, `placement=article_inline\|article_mid\|article_post\|reading_bar\|situation_check`, `locale` |
| `blog_check_answered` | 글 안 점검에 답을 끝냄(30초 점검은 두 문항 모두, 상황 확인은 선택 1회) | `content_slug`, `content_type`, `placement=self_check\|situation_check`, `state=yy\|yn\|ny\|nn\|option_1..3`, `locale` |
| `blog_arrival_action` | 블로그 예시에서 도구로 넘어온 첫 줄(도착 줄)에서 선택 | `tool_id`, `content_slug`, `content_type`, `placement=blog_arrival`, `state=use_my_csv\|back_to_article`, `locale` |
| `blog_bridge_dismissed` | 블로그 읽기 바를 닫음(그 방문 동안 다시 뜨지 않음) | `content_slug`, `content_type`, `interaction_source`, `placement=reading_bar`, `state=session`, `locale` |
| `tool_view` | 분석 도구 URL 진입 | `tool_id`, `interaction_source=route`, `locale` |
| `landing_data_start_clicked` | 랜딩에서 도치 접수처(`#dochi-upload`) 선택 | `interaction_source=landing`, `placement=hero|weekly_loop`, `locale` |
| `landing_review_opened` | 랜딩에서 주간 리뷰 또는 결정 이력 선택 | `interaction_source=landing`, `placement=hero|weekly_loop|continue_panel`, `locale` |
| `source_survey_viewed` | 유입 경로 서베이 카드가 실제로 노출 | `placement=source_survey`, `state=opened`, `locale` |
| `source_survey_submitted` / `source_survey_failed` | 주관식 답변 전송 성공/실패 | `placement=source_survey`, `state=sent\|failed`, `locale` |
| `source_survey_dismissed` | 답하지 않고 닫음 | `placement=source_survey`, `state=skipped\|closed`, `locale` |
| `journey_page_viewed` | 최초 및 SPA 경로 변경 | `scope=home|blog|glossary|guide|tool|start|dochi|review|other`, `journey_entry`, `locale` |
| `review_entry_clicked` | 헤더·사이드바·여정 표시·도치 결과·저장 완료에서 리뷰 선택 | `interaction_source`, `placement`, `locale` |
| `dochi_mapping_confirmed` | 도치 컬럼 확인을 마치고 계산 작업대로 진행 | `tool_id=start-gate`, `placement=dochi_mapping`, `locale` |
| `weekly_review_viewed` | 리뷰 화면 진입(기기 복원 후), 재진입도 기록 | `tool_id=weekly-review`, `visit_type=with_history|without_history`, `locale` |
| `weekly_review_completed` | 기간 비교 결과 계산 완료 | `interaction_source`, `result_state`, `data_continuity=saved_snapshot|uploaded_periods`, `elapsed_bucket`, `locale` |
| `weekly_review_result_viewed` | 계산된 리뷰의 결론이 실제 화면에 노출 | `interaction_source`, `result_state`, `locale` |
| `weekly_review_saved` / `weekly_review_save_failed` | 다음 비교에 쓸 두 기간 집계의 기기 저장 성공/실패 | `tool_id=weekly-review`, `interaction_source`, `state=device`, `locale` |
| `weekly_project_saved` / `weekly_project_save_failed` | 프로젝트 설정 저장 성공/실패 | `tool_id=weekly-review`, `interaction_source`, `locale` |
| `weekly_decision_saved` | 리뷰에서 사용자가 이번 결정을 저장 | `tool_id=weekly-review`, `interaction_source`, `locale` |
| `project_review_saved` / `project_review_save_failed` | 리뷰 저장 창에서 프로젝트 저장이 실제로 확정/실패 | `tool_id`, `state=new_project\|existing_project`(성공) 또는 사유 코드(실패), `result_state=review\|report\|review_report`, `locale` |
| `weekly_review_blocked` | 업로드 후 기간·필드 조건 때문에 리뷰 생성 불가 | `state`(사유 코드), `interaction_source`, `locale` |
| `review_history_opened` | 리뷰 상단의 저장된 결정 바로가기 선택 | `placement=review_header`, `locale` |
| `weekly_review_export` | 보고서 복사 완료 또는 인쇄 요청 | `download_type`, `state=completed|requested`, `interaction_source`, `locale` |
| `calculator_entry_clicked` | 홈 또는 `/start`에서 마케팅 지표 계산기 선택 | `interaction_source=landing|start`, `placement`, `locale` |
| `diagnose_entry_clicked` | 홈 또는 `/start`에서 성과 문제 진단 선택 | `interaction_source=landing|start`, `placement`, `locale` |
| `data_import_start` | CSV/XLSX 선택 또는 Google Sheets 불러오기 시작 | `tool_id`, `interaction_source`, `locale` |
| `data_import_success` | CSV/XLSX/Sheets 파싱 성공 | `tool_id`, `row_count`, `column_count`, `mapped_count`, `locale` |
| `data_import_failed` | 가져오기 실패 또는 빈 데이터 확인 | `tool_id`, `interaction_source`, `state`, `locale` |
| `data_profile_completed` | 자동 매핑 후보 생성 | `tool_id`, `conflict_count`, `locale` |
| `mapping_confirmed` | 사용자가 매핑 확정 | `tool_id`, `confidence_bucket`, `missing_required_count`, `locale` |
| `analysis_started` | 분석 실행 클릭 또는 자동 분석 가능 상태 진입 | `tool_id`, `analysis_type`, `row_count`, `locale` |
| `analysis_blocked` | 필수 매핑·데이터 조건 때문에 분석할 수 없는 상태 진입 | `tool_id`, `interaction_source`, `state`, 집계 개수, `locale` |
| `analysis_completed` | 결과 또는 정직한 추정 불가 상태 생성 | `tool_id`, `analysis_type`, `result_state`, `locale` |
| `dashboard_tab_view` | 대시보드 탭 선택 | `tool_id`, `tab_name` |
| `result_download_attempted` | 다운로드 버튼을 누른 순간(게이트 판정 **전**) | `tool_id`, `download_type`, `source`, `state=free\|paid`, `locale` |
| `result_downloaded` | 파일 생성·다운로드 요청 성공 | `tool_id`, `download_type`, `source`, `state=free\|paid`, `locale` |
| `result_download_failed` | 파일 생성이 예외로 실패 | `tool_id`, `download_type`, `source`, `state=실패 사유`, `locale` |
| `example_run_started` | 명시된 단일 예시 데이터 실행 클릭 | `tool_id`, `interaction_source=landing|csv_guide|start`, `placement`, `locale` |
| `analysis_result_viewed` | 결과 행동 카드가 실제 viewport에 노출 | `tool_id`, `interaction_source`, `analysis_type`, `result_state`, `placement=result_action_card`, `locale` |
| `analysis_history_viewed` | 이전 분석 요약이 실제 viewport에 노출 | `tool_id`, `interaction_source=local_history`, `result_state=previous_available`, `data_continuity=summary_only`, `locale` |
| `decision_review_opened` | 결과에서 다음 검토 약속 열기 | `tool_id`, `interaction_source`, `placement`, `locale` |
| `decision_record_added` | 결정 요약 저장 | `tool_id`, `interaction_source=decision_review`, `placement`, `locale` |
| `decision_inbox_viewed` | 펼친 결정 이력이 실제 화면에 노출(접힌 상태 제외) | `interaction_source=weekly_review`, `result_state=empty|due|active`, `locale` |
| `decision_review_completed` | 보류 결정에 실제 결과 또는 배운 점을 처음 기록 | `tool_id`, `interaction_source=weekly_review`, `result_state=reviewed`, `locale` |
| `forecast_actual_match_viewed` | 5-18 새 CSV에서 저장된 예측과 같은 주차·타깃·플랫폼 실제값 발견 | `tool_id=5-18`, `interaction_source=forecast_review`, `result_state=matched`, `locale` |
| `forecast_actual_applied` | 사용자가 제안된 실제값을 결정 기록에 반영 | `tool_id=5-18`, `interaction_source=forecast_review`, `result_state=reviewed`, `locale` |

`tool_id`는 내부 라우트 ID만 사용한다. 5-18의 독립 검색 진입 경로
(`5-18-trend/cannibal/mmm/forecast`)는 후속 이벤트와 같은 퍼널로 연결되도록
분석 경계에서 `5-18`로 정규화한다. 개별 진입 URL은 `page_path`로 구분한다.
CSV 파일명, 채널명, 지출·매출값, 사용자 ID는
전송하지 않는다. 허용 목록 밖 파라미터는 `sanitizeProductEventParams`가 제거한다.
분석 시작·완료·결과 노출·과거 결과 노출·차단 이벤트는 브라우저 메모리의 비식별
해시로 같은 언어·입력·분석 설정의 중복을 막는다. 같은 결과에서 “다시 분석”만 누른
경우 시작 분모도 늘리지 않는다. 해시 생성에 쓴 원본 문자열과 해시 자체는 GA에 전송하지 않는다.

## GA4에서 등록할 이벤트 범위

Custom dimensions는 이벤트 범위로 아래만 등록하면 충분하다.

- `tool_id`
- `analysis_type`
- `result_state`
- `tab_name`
- `download_type`
- `interaction_source`
- `confidence_bucket`
- `placement`
- `locale`
- `state`
- `journey_entry`
- `visit_type`
- `scope`
- `data_continuity`
- `rank`(이벤트 범위 custom metric)

## 검증 퍼널

- **전체 루프**: `journey_page_viewed` → `data_import_success` → `analysis_completed(result_state=ready)` → `analysis_result_viewed` → `decision_record_added` 또는 `weekly_decision_saved` → `decision_inbox_viewed` → `decision_review_completed`.
- **도치 접수**: `data_import_start(placement=dochi_home|dochi_welcome)` → `data_import_success` → `mapping_confirmed(placement=dochi_mapping)` → `dochi_mapping_confirmed` → `analysis_started` → `analysis_completed` → `analysis_result_viewed(placement=dochi_workspace)` → `decision_record_added(placement=dochi_workspace)`.
- **주간 운영 리뷰**: `review_entry_clicked` 또는 `landing_review_opened` → `weekly_review_viewed` → `weekly_review_completed` → `weekly_review_result_viewed` → `weekly_decision_saved`. `weekly_review_saved`는 자동 집계 저장이며 **결정 저장 전환으로 합산하지 않는다**.
- **다음 데이터 재검토**: `weekly_review_viewed(visit_type=with_history)` → `weekly_review_completed(data_continuity=saved_snapshot)` → `weekly_review_result_viewed` → `decision_review_completed`. `with_history`는 저장 기록 보유이며 신규/재방문 사용자 구분이나 주간 유지율 자체가 아니다. 다음 방문 여부는 GA 사용자·세션 차원과 함께 해석한다.

`journey_entry`는 같은 탭의 최초 유입면을 30분 비활동 만료까지 유지하므로 블로그→도치→다른 도구→리뷰에서도 끊기지 않는다. 공개 글별 정밀 어트리뷰션(`content_slug`)은 기존 같은 도구 조건을 유지한다. 이 둘을 혼동하지 않는다. 원본 URL·검색어·사용자 ID·프로젝트명·결정 문장은 추가 저장/전송하지 않는다. `placement`는 도치 내부와 상세 도구의 같은 계산을 구분하며, 전체 실행 건수와 활성 사용자 수를 같은 지표로 해석하지 않는다.

첫 GA 스크립트가 아직 준비되지 않은 운영 화면의 이벤트는 표준 dataLayer 큐와 명시적 `send_to`를 사용한다([Google tag routing](https://developers.google.com/tag-platform/gtagjs/routing)). 로컬·미리보기에서 새 GA 전송 경로를 만들지 않고 광고 차단 우회도 하지 않는다.

### 관리자 설정과 코드 검증의 경계

`journey_entry`, `visit_type`, `placement`, `result_state`, `data_continuity`, `tool_id`, `interaction_source`, `locale`를 이벤트 범위 맞춤 측정기준으로 확인한다. GA 탐색은 비연속 단계(중간 페이지 이동 허용), 실데이터 `interaction_source != demo`, 코드 완료와 화면 노출을 분리한 퍼널로 구성한다. 저장 핵심 이벤트는 사용자가 저장한 두 이벤트만 후보이며 자동 집계 저장이나 단순 방문은 포함하지 않는다.

이벤트 호출·개인 데이터 미포함은 테스트로 검증한다. GA 관리 화면의 실제 수신, 맞춤 측정기준 등록, Enhanced Measurement/GTM 중복 여부는 별도 실측 대상이다. 관리 설정을 열지 못했다면 코드 테스트 통과만으로 수신 완료라고 보고하지 않는다.

- 블로그→분석: `page_view`(블로그) → `blog_read_depth(depth_75)` → `blog_cta_viewed` → `blog_tool_cta_clicked` → `tool_view` → `data_import_success` → `analysis_completed(result_state=ready)`
  - `blog_cta_viewed` 없이 `page_view`만 쌓이면 패널이 안 보인 것이고, `blog_cta_viewed`는 있는데 클릭이 없으면 카피·목적지 문제다. 두 원인을 가르는 게 이 이벤트의 존재 이유다.
  - 읽기 바·30초 점검·상황 확인은 새 노출/클릭 이벤트 이름을 만들지 않는다 — `blog_cta_viewed`·`blog_tool_cta_clicked`의 `placement`(`reading_bar`·`self_check`·`situation_check`)로만 가른다. 점검 응답만 `blog_check_answered`로 따로 센다(답 원문이 아니라 열거형 `state`). 2026-09-24에 도치 브리지(`blog_bridge*`)와 요약 옆 CTA(`article_answer`)는 제거됐다 — 과거 데이터에만 남는다.
  - `blog_session_articles(rank≥2)`는 글을 이어 읽는 세션의 크기 — 중간 개입(도치 브리지) 트리거의 분모다.
- 랜딩→실데이터: `landing_data_start_clicked` → `data_import_start` → `data_import_success` → `analysis_started` → `analysis_completed(result_state=ready)` → `analysis_result_viewed`
- 예시→실데이터: `example_run_started` → `data_import_start` → `data_import_success` → `analysis_started` → `analysis_completed(result_state=ready)` → `analysis_result_viewed`
- 가져오기 실패: `data_import_start` → `data_import_failed(state별)`
- 분석 차단: `data_import_success` → `analysis_blocked(state별)`
- 판단→재방문: `decision_record_added` → `decision_inbox_viewed` → `decision_review_completed`
- 분석→과거 결과 재확인: `analysis_completed` → `analysis_history_viewed`
- 예측→실제 대조: `decision_record_added(tool_id=5-18)` → `forecast_actual_match_viewed` → `forecast_actual_applied`

`decision_record_added`는 기존 이벤트를 그대로 사용한다. 같은 행동을 새 이름으로 중복 집계하지 않는다.

`project_review_saved`는 예외가 아니라 **단일 통과 지점**이다 — 도구·리뷰·보관함의 모든 저장이 `ReviewSaveDialog` 하나를 지나므로, "프로젝트 리뷰 저장을 쓰는 사람이 몇인가"는 이 이벤트로만 답한다. `decision_record_added`·`weekly_decision_saved`·`weekly_report_saved`는 같은 저장을 각 퍼널의 단계로 본 것이라 **이 이벤트와 합산하지 않는다**. 실패 사유(`state`)는 코드에 열거된 범주형 코드만 싣고 목록 밖 메시지는 `unknown`으로 접는다 — 저장 실패 원문에는 사용자 데이터가 섞일 수 있다.

서버에는 저장 사실이 남지 않는다(IndexedDB 전용, §2.2). 계정 단위로 볼 수 있는 것은 `scripts/account-usage-report.mjs`가 세는 저장 자격(체험·결제)과 별도 동의로 올린 계정 메모뿐이다.

`row_count`, `column_count`, `mapped_count`, `conflict_count`, `missing_required_count`는
이벤트 범위의 custom metric(숫자)으로 등록한다.

## 유입 경로 서베이 답변은 GA4에 없다

주관식 답변 원문은 GA4로 보내지 않는다(이 문서 최상단 원칙 — 범주형 파라미터만).
위 이벤트는 **노출·제출·이탈 횟수**만 세고, 답변 내용은 우리 DB(`gop_source_survey`)에만
있다. "몇 명이 답했나"는 GA4로, "뭐라고 답했나"는 `scripts/source-survey-report.mjs`로 본다.
둘을 합산하지 말 것 — GA4는 광고 차단기가 있는 방문자를 못 세므로 제출 수가 DB보다 적다.

## 2026-09-19 감사 및 주요 이벤트

- `purchase`는 이미 GA 속성 542428327의 주요 이벤트였다. `project_review_saved`를 주요 이벤트로 추가했으며 임의 금전 가치는 설정하지 않았다. 두 이벤트 모두 확인 당시 최근 28일 활성 스트림 데이터는 없었다. 주요 이벤트 등록과 실제 수신은 별개다.
- 이벤트 범위 맞춤 측정기준 `interaction_source`, `analysis_type`, `state`를 관리자 화면에 등록하고 저장을 확인했다. 기존 `source` 정의는 과거 기록을 위해 유지한다.
- GA 전송 직전에 내부 `source`를 `interaction_source`로 변환한다. 호출부와 내부 퍼널 판별은 기존 `source` 계약을 유지한다. 실제 세션 소스에 `blog / (not set)`, `route / (not set)`, `subscription_page / (not set)`가 나타나 유입 출처와 내부 위치를 분리했다. 과거 기록은 이 수정으로 소급 복구되지 않는다.
- 운영 스트림의 브라우저 기록 기반 페이지 조회는 꺼져 있었다. 공개 GTM 컨테이너의 태그·규칙은 빈 배열이었다. 확인 시점에는 이 두 경로의 페이지뷰 중복 설정은 발견하지 못했다.
- 구매는 서버 확인 뒤 브라우저에서 전송하므로 광고 차단·동의 상태·승인 후 탭 종료에 따라 누락될 수 있다. GA를 결제 원장으로 쓰지 않는다. 웹훅만으로 승인 완료된 거래의 구매 이벤트를 서버에서 보내는 경로는 현재 없다.
- 새 코드 배포 뒤 GA DebugView/실시간에서 실제 저장 1회와 새 거래번호의 구매 1회를 대조해야 최종 수신 검증이다. 기존 날짜의 수신 없음만으로 코드가 실패했다고 판단하지 않는다.

## 프로젝트 리뷰 전달·후속 결정 (2026-09-20)

- `report_brief_copied`: 보고서 미리보기에서 실제 클립보드 복사가 성공한 뒤 1회. `tool_id`, `locale`, `interaction_source=report_preview`만 전달하며 문서 내용은 전달하지 않는다.
- `decision_follow_up_saved`: 관측·배운 점에서 만든 후속 결정의 기기 저장 성공 뒤 1회. 저장 시도나 실패는 성공으로 세지 않는다. `tool_id`, `locale`, `interaction_source=project_review`만 전달한다.
- 기존 `result_downloaded`는 파일 생성·다운로드 요청 성공 경계다. 사용자가 파일을 열거나 팀에 실제 전송했다는 뜻은 아니다. 실제 업무 활용은 별도 피드백으로 확인해야 한다.
- **다운로드 3종은 합산하지 않는다.** `attempted`가 분모이고 그 뒤는 서로 배타적인
  네 갈래로 갈린다 — 성공(`result_downloaded`) · 이용권에 막힘
  (`subscription_gate_viewed`) · 사용자가 취소(이벤트 없음) · 생성 실패
  (`result_download_failed`). 셋을 더하면 한 번의 다운로드를 두 번 세게 된다.
- `result_downloaded`의 의미가 2026-09-21에 넓어졌다. 그 전에는 **유료 항목의
  성공만** 셌고(무료 CSV·PNG는 아예 안 세어졌다) 실패는 한 건도 찍히지 않았다.
  지금은 무료 성공도 포함하며 `state`로 가른다 — `state=paid`로 필터하면 종전
  시계열과 같으므로 과거 데이터와 이어서 볼 수 있다.
- 실패 사유(`state`)는 열거형만 싣는다: `storage_full` · `aborted` · `too_large`
  · `build_failed` · `unknown`. 예외 원문에는 파일명·컬럼명 같은 사용자 데이터가
  섞일 수 있어 절대 싣지 않는다(§2.2).
- 정적 설명서 PDF 링크는 분석 결과가 아니므로 이 경로를 쓰지 않는다
  (`DOWNLOAD_TELEMETRY_EXEMPT` 표식 + 사유로만 통과한다).
