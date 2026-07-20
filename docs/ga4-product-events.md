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
| `data_import_start` | CSV 선택 | `tool_id`, `source` |
| `data_import_success` | CSV/Sheets 파싱 성공 | `tool_id`, `row_count`, `column_count`, `mapped_count` |
| `data_profile_completed` | 자동 매핑 후보 생성 | `tool_id`, `conflict_count` |
| `mapping_confirmed` | 사용자가 매핑 확정 | `tool_id`, `confidence_bucket`, `missing_required_count` |
| `analysis_started` | 분석 실행 클릭 | `tool_id`, `analysis_type`, `row_count` |
| `analysis_completed` | 결과 또는 정직한 추정 불가 상태 생성 | `tool_id`, `analysis_type`, `result_state` |
| `dashboard_tab_view` | 대시보드 탭 선택 | `tool_id`, `tab_name` |
| `result_downloaded` | 결과 CSV/텍스트 다운로드 | `tool_id`, `download_type` |

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

`row_count`, `column_count`, `mapped_count`, `conflict_count`, `missing_required_count`는
이벤트 범위의 custom metric(숫자)으로 등록한다.
