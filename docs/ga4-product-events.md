# GA4 제품 퍼널 이벤트

## page_view 기준

앱은 SPA다. 직접 Google tag는 `send_page_view:false`로 초기화하고
`GaPageviews`만 최초 진입과 URL 변경마다 `page_view`를 한 번 보낸다.

GTM에서 같은 `G-DK12TNR0GW` GA4 태그를 발화시키거나, GA4 Enhanced Measurement의
**browser history 변경 page view**를 켜면 다시 중복된다. 둘 중 하나만 사용한다.

## 이벤트

| 이벤트 | 시점 | 핵심 파라미터 |
|---|---|---|
| `tool_view` | 분석 도구 URL 진입 | `tool_id`, `source=route`, `locale` |
| `landing_data_start_clicked` | 랜딩에서 내 데이터 시작(`/start`) 선택 | `source=landing`, `placement=hero|weekly_loop`, `locale` |
| `landing_review_opened` | 랜딩 주간 루프에서 결정 검토함 선택 | `source=landing`, `placement=weekly_loop`, `locale` |
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
| `decision_inbox_viewed` | 주간 결정 인박스 진입 | `source=weekly_review`, `result_state=empty|due|active`, `locale` |
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
- `data_continuity`

## 검증 퍼널

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
