# GA4 제품 퍼널 이벤트

## page_view 기준

앱은 SPA다. 직접 Google tag는 `send_page_view:false`로 초기화하고
`GaPageviews`만 최초 진입과 URL 변경마다 `page_view`를 한 번 보낸다.

GTM에서 같은 `G-DK12TNR0GW` GA4 태그를 발화시키거나, GA4 Enhanced Measurement의
**browser history 변경 page view**를 켜면 다시 중복된다. 둘 중 하나만 사용한다.

## 이벤트

| 이벤트 | 시점 | 핵심 파라미터 |
|---|---|---|
| `blog_read_depth` | 블로그 글 읽기 진행률이 25·50·75·100%에 처음 도달 | `content_slug`, `content_type`, `source`, `state=depth_25\|50\|75\|100`, `locale` |
| `blog_session_articles` | 같은 세션에서 2번째 이후 블로그 글 진입 | `content_slug`, `content_type`, `source`, `rank`(세션 내 몇 번째), `locale` |
| `blog_cta_viewed` | 글·용어의 행동 패널이 실제 viewport에 노출 | `tool_id`, `content_slug`, `content_type`, `placement=article_mid\|article_post\|blog_bridge`, `locale` |
| `blog_tool_cta_clicked` | 글·용어에서 연결 도구 선택 | `tool_id`, `content_slug`, `content_type`, `placement=article_answer\|article_mid\|article_post\|blog_bridge`, `locale` |
| `blog_bridge_dismissed` | 블로그 도치 브리지를 닫음 | `content_slug`, `content_type`, `source`, `placement=blog_bridge`, `state=session\|permanent`, `locale` |
| `tool_view` | 분석 도구 URL 진입 | `tool_id`, `source=route`, `locale` |
| `landing_data_start_clicked` | 랜딩에서 도치 접수처(`#dochi-upload`) 선택 | `source=landing`, `placement=hero|weekly_loop`, `locale` |
| `landing_review_opened` | 랜딩에서 주간 리뷰 또는 결정 이력 선택 | `source=landing`, `placement=hero|weekly_loop|continue_panel`, `locale` |
| `journey_page_viewed` | 최초 및 SPA 경로 변경 | `scope=home|blog|glossary|guide|tool|start|dochi|review|other`, `journey_entry`, `locale` |
| `review_entry_clicked` | 헤더·사이드바·여정 표시·도치 결과·저장 완료에서 리뷰 선택 | `source`, `placement`, `locale` |
| `dochi_mapping_confirmed` | 도치 컬럼 확인을 마치고 계산 작업대로 진행 | `tool_id=start-gate`, `placement=dochi_mapping`, `locale` |
| `weekly_review_viewed` | 리뷰 화면 진입(기기 복원 후), 재진입도 기록 | `tool_id=weekly-review`, `visit_type=with_history|without_history`, `locale` |
| `weekly_review_completed` | 기간 비교 결과 계산 완료 | `source`, `result_state`, `data_continuity=saved_snapshot|uploaded_periods`, `elapsed_bucket`, `locale` |
| `weekly_review_result_viewed` | 계산된 리뷰의 결론이 실제 화면에 노출 | `source`, `result_state`, `locale` |
| `weekly_review_saved` / `weekly_review_save_failed` | 다음 비교에 쓸 두 기간 집계의 기기 저장 성공/실패 | `tool_id=weekly-review`, `source`, `state=device`, `locale` |
| `weekly_project_saved` / `weekly_project_save_failed` | 프로젝트 설정 저장 성공/실패 | `tool_id=weekly-review`, `source`, `locale` |
| `weekly_decision_saved` | 리뷰에서 사용자가 이번 결정을 저장 | `tool_id=weekly-review`, `source`, `locale` |
| `weekly_review_blocked` | 업로드 후 기간·필드 조건 때문에 리뷰 생성 불가 | `state`(사유 코드), `source`, `locale` |
| `review_history_opened` | 리뷰 상단의 저장된 결정 바로가기 선택 | `placement=review_header`, `locale` |
| `weekly_review_export` | 보고서 복사 완료 또는 인쇄 요청 | `download_type`, `state=completed|requested`, `source`, `locale` |
| `calculator_entry_clicked` | 홈 또는 `/start`에서 마케팅 지표 계산기 선택 | `source=landing|start`, `placement`, `locale` |
| `diagnose_entry_clicked` | 홈 또는 `/start`에서 성과 문제 진단 선택 | `source=landing|start`, `placement`, `locale` |
| `data_import_start` | CSV/XLSX 선택 또는 Google Sheets 불러오기 시작 | `tool_id`, `source`, `locale` |
| `data_import_success` | CSV/XLSX/Sheets 파싱 성공 | `tool_id`, `row_count`, `column_count`, `mapped_count`, `locale` |
| `data_import_failed` | 가져오기 실패 또는 빈 데이터 확인 | `tool_id`, `source`, `state`, `locale` |
| `data_profile_completed` | 자동 매핑 후보 생성 | `tool_id`, `conflict_count`, `locale` |
| `mapping_confirmed` | 사용자가 매핑 확정 | `tool_id`, `confidence_bucket`, `missing_required_count`, `locale` |
| `analysis_started` | 분석 실행 클릭 또는 자동 분석 가능 상태 진입 | `tool_id`, `analysis_type`, `row_count`, `locale` |
| `analysis_blocked` | 필수 매핑·데이터 조건 때문에 분석할 수 없는 상태 진입 | `tool_id`, `source`, `state`, 집계 개수, `locale` |
| `analysis_completed` | 결과 또는 정직한 추정 불가 상태 생성 | `tool_id`, `analysis_type`, `result_state`, `locale` |
| `dashboard_tab_view` | 대시보드 탭 선택 | `tool_id`, `tab_name` |
| `result_downloaded` | 결과 CSV/텍스트 다운로드 | `tool_id`, `download_type` |
| `example_run_started` | 명시된 단일 예시 데이터 실행 클릭 | `tool_id`, `source=landing|csv_guide|start`, `placement`, `locale` |
| `analysis_result_viewed` | 결과 행동 카드가 실제 viewport에 노출 | `tool_id`, `source`, `analysis_type`, `result_state`, `placement=result_action_card`, `locale` |
| `analysis_history_viewed` | 이전 분석 요약이 실제 viewport에 노출 | `tool_id`, `source=local_history`, `result_state=previous_available`, `data_continuity=summary_only`, `locale` |
| `decision_review_opened` | 결과에서 다음 검토 약속 열기 | `tool_id`, `source`, `placement`, `locale` |
| `decision_record_added` | 결정 요약 저장 | `tool_id`, `source=decision_review`, `placement`, `locale` |
| `decision_inbox_viewed` | 펼친 결정 이력이 실제 화면에 노출(접힌 상태 제외) | `source=weekly_review`, `result_state=empty|due|active`, `locale` |
| `decision_review_completed` | 보류 결정에 실제 결과 또는 배운 점을 처음 기록 | `tool_id`, `source=weekly_review`, `result_state=reviewed`, `locale` |
| `forecast_actual_match_viewed` | 5-18 새 CSV에서 저장된 예측과 같은 주차·타깃·플랫폼 실제값 발견 | `tool_id=5-18`, `source=forecast_review`, `result_state=matched`, `locale` |
| `forecast_actual_applied` | 사용자가 제안된 실제값을 결정 기록에 반영 | `tool_id=5-18`, `source=forecast_review`, `result_state=reviewed`, `locale` |

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
- `source`
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

`journey_entry`, `visit_type`, `placement`, `result_state`, `data_continuity`, `tool_id`, `source`, `locale`를 이벤트 범위 맞춤 측정기준으로 확인한다. GA 탐색은 비연속 단계(중간 페이지 이동 허용), 실데이터 `source != demo`, 코드 완료와 화면 노출을 분리한 퍼널로 구성한다. 저장 핵심 이벤트는 사용자가 저장한 두 이벤트만 후보이며 자동 집계 저장이나 단순 방문은 포함하지 않는다.

이벤트 호출·개인 데이터 미포함은 테스트로 검증한다. GA 관리 화면의 실제 수신, 맞춤 측정기준 등록, Enhanced Measurement/GTM 중복 여부는 별도 실측 대상이다. 관리 설정을 열지 못했다면 코드 테스트 통과만으로 수신 완료라고 보고하지 않는다.

- 블로그→분석: `page_view`(블로그) → `blog_read_depth(depth_75)` → `blog_cta_viewed` → `blog_tool_cta_clicked` → `tool_view` → `data_import_success` → `analysis_completed(result_state=ready)`
  - `blog_cta_viewed` 없이 `page_view`만 쌓이면 패널이 안 보인 것이고, `blog_cta_viewed`는 있는데 클릭이 없으면 카피·목적지 문제다. 두 원인을 가르는 게 이 이벤트의 존재 이유다.
  - 도치 브리지는 새 이벤트 이름을 만들지 않는다 — 노출은 `blog_cta_viewed(placement=blog_bridge)`, 클릭은 `blog_tool_cta_clicked(placement=blog_bridge)`로 같은 퍼널에 들어간다. `placement`로만 가른다.
  - `blog_session_articles(rank≥2)`는 글을 이어 읽는 세션의 크기 — 중간 개입(도치 브리지) 트리거의 분모다.
- 랜딩→실데이터: `landing_data_start_clicked` → `data_import_start` → `data_import_success` → `analysis_started` → `analysis_completed(result_state=ready)` → `analysis_result_viewed`
- 예시→실데이터: `example_run_started` → `data_import_start` → `data_import_success` → `analysis_started` → `analysis_completed(result_state=ready)` → `analysis_result_viewed`
- 가져오기 실패: `data_import_start` → `data_import_failed(state별)`
- 분석 차단: `data_import_success` → `analysis_blocked(state별)`
- 판단→재방문: `decision_record_added` → `decision_inbox_viewed` → `decision_review_completed`
- 분석→과거 결과 재확인: `analysis_completed` → `analysis_history_viewed`
- 예측→실제 대조: `decision_record_added(tool_id=5-18)` → `forecast_actual_match_viewed` → `forecast_actual_applied`

`decision_record_added`는 기존 이벤트를 그대로 사용한다. 같은 행동을 새 이름으로 중복 집계하지 않는다.

`row_count`, `column_count`, `mapped_count`, `conflict_count`, `missing_required_count`는
이벤트 범위의 custom metric(숫자)으로 등록한다.
