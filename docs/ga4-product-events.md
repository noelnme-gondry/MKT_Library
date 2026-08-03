# GA4 제품 퍼널 이벤트

## page_view 기준

앱은 SPA다. 직접 Google tag는 `send_page_view:false`로 초기화하고
`GaPageviews`만 최초 진입과 URL 변경마다 `page_view`를 한 번 보낸다.

GTM에서 같은 `G-DK12TNR0GW` GA4 태그를 발화시키거나, GA4 Enhanced Measurement의
**browser history 변경 page view**를 켜면 다시 중복된다. 둘 중 하나만 사용한다.

## 이벤트

| 이벤트 | 시점 | 핵심 파라미터 |
|---|---|---|
| `tool_view` | 분석 도구 URL 진입 | `tool_id`, `source=route` |
| `landing_data_start_clicked` | 랜딩에서 내 데이터 시작(`/start`) 선택 | `source=landing`, `placement=hero|weekly_loop`, `locale` |
| `landing_review_opened` | 랜딩 주간 루프에서 결정 검토함 선택 | `source=landing`, `placement=weekly_loop`, `locale` |
| `data_import_start` | CSV 선택 | `tool_id`, `source` |
| `data_import_success` | CSV/Sheets 파싱 성공 | `tool_id`, `row_count`, `column_count`, `mapped_count` |
| `data_profile_completed` | 자동 매핑 후보 생성 | `tool_id`, `conflict_count` |
| `mapping_confirmed` | 사용자가 매핑 확정 | `tool_id`, `confidence_bucket`, `missing_required_count` |
| `analysis_started` | 분석 실행 클릭 | `tool_id`, `analysis_type`, `row_count` |
| `analysis_completed` | 결과 또는 정직한 추정 불가 상태 생성 | `tool_id`, `analysis_type`, `result_state` |
| `dashboard_tab_view` | 대시보드 탭 선택 | `tool_id`, `tab_name` |
| `result_downloaded` | 결과 CSV/텍스트 다운로드 | `tool_id`, `download_type` |
| `example_run_started` | 업로드 전 예시 결과 실행 클릭 | `tool_id`, `source=landing|csv_guide|industry_preset`, `placement`, `locale`, 프리셋이면 `preset_id`·`preset_scale` |
| `preset_exposed` | `/start`에서 업종·규모 프리셋이 실제 노출됨 | `source=start`, `placement=before_upload`, `locale` |
| `preset_selected` | 사용자가 고정 업종·규모 프리셋을 선택해 결과를 엶 | `tool_id=5-2`, `preset_id`, `preset_scale`, `source=industry_preset`, `locale` |
| `analysis_result_viewed` | 결과 행동 카드 노출 | `tool_id`, `source=result`, `placement`, `locale` |
| `decision_review_opened` | 결과에서 다음 검토 약속 열기 | `tool_id`, `source`, `placement`, `locale` |
| `decision_record_added` | 결정 요약 저장 | `tool_id`, `source=decision_review`, `placement`, `locale` |
| `decision_inbox_viewed` | 주간 결정 인박스 진입 | `source=weekly_review`, `result_state=empty|due|active`, `locale` |
| `decision_review_completed` | 보류 결정에 실제 결과 또는 배운 점을 처음 기록 | `tool_id`, `source=weekly_review`, `result_state=reviewed`, `locale` |
| `forecast_actual_match_viewed` | 5-18 새 CSV에서 저장된 예측과 같은 주차·타깃·플랫폼 실제값 발견 | `tool_id=5-18`, `source=forecast_review`, `result_state=matched`, `locale` |
| `forecast_actual_applied` | 사용자가 제안된 실제값을 결정 기록에 반영 | `tool_id=5-18`, `source=forecast_review`, `result_state=reviewed`, `locale` |

`tool_id`는 내부 라우트 ID만 사용한다. CSV 파일명, 채널명, 지출·매출값, 사용자 ID는
전송하지 않는다. 허용 목록 밖 파라미터는 `sanitizeProductEventParams`가 제거한다.

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
- `preset_id`
- `preset_scale`

## 검증 퍼널

- 랜딩→실데이터: `landing_data_start_clicked` → `data_import_start` → `data_import_success` → `analysis_completed`
- 예시→실데이터: `example_run_started` → `data_import_start` → `data_import_success` → `analysis_completed`
- 업종 프리셋→실데이터: `preset_exposed` → `preset_selected` → `example_run_started` → `data_import_start` → `data_import_success`
- 판단→재방문: `decision_record_added` → `decision_inbox_viewed` → `decision_review_completed`
- 예측→실제 대조: `decision_record_added(tool_id=5-18)` → `forecast_actual_match_viewed` → `forecast_actual_applied`

`decision_record_added`는 기존 이벤트를 그대로 사용한다. 같은 행동을 새 이름으로 중복 집계하지 않는다.
업종 프리셋(I1)은 `preset_id`(`app-commerce`·`mobile-game`·`subscription`·`lead-generation`)와
`preset_scale`(`starter`·`growth`·`scale`) 고정 enum만 전송한다. 자유입력 업종명·예산·성과값은 전송하지 않는다.

`row_count`, `column_count`, `mapped_count`, `conflict_count`, `missing_required_count`는
이벤트 범위의 custom metric(숫자)으로 등록한다.
