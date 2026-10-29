# GA4 제품 퍼널 이벤트

## page_view 기준

앱은 SPA다. 직접 Google tag는 `send_page_view:false`로 초기화하고
`GaPageviews`만 최초 진입과 URL 변경마다 `page_view`를 한 번 보낸다.

GTM에서 같은 `G-DK12TNR0GW` GA4 태그를 발화시키거나, GA4 Enhanced Measurement의
**browser history 변경 page view**를 켜면 다시 중복된다. 둘 중 하나만 사용한다.

## 이벤트

| 이벤트 | 시점 | 핵심 파라미터 |
|---|---|---|
| `ad_slot_view` | visible 문서에서 실제 광고 프레임의 50% 이상이 viewport에 들어온 첫 순간. 체류시간 조건 없음 | `ad_provider=coupang`, `ad_slot`, `ad_format`, `locale`, `page_path`, `ad_measurement_version=1` |
| `blog_read_depth` | 블로그 글 읽기 진행률이 25·50·75·100%에 처음 도달 | `content_slug`, `content_type`, `interaction_source`, `state=depth_25\|50\|75\|100`, `locale` |
| `blog_session_articles` | 같은 세션에서 2번째 이후 블로그 글 진입 | `content_slug`, `content_type`, `interaction_source`, `rank`(세션 내 몇 번째), `locale` |
| `blog_cta_viewed` | 글·용어·계산기의 행동 요소가 실제 viewport에 노출 | `tool_id`, `content_slug`, `content_type=blog\|glossary\|calculator`, `placement=article_answer\|article_entry\|article_inline\|article_mid\|article_post\|reading_bar\|self_check\|situation_check\|calculator_result`, `locale` |
| `blog_tool_cta_clicked` | 글·용어·계산기에서 연결 도구(또는 계산기) 선택. 도구 쪽 결과 이벤트에 30분간 `content_slug`가 이어진다. **`tool_id`는 실제 목적지**다 — 계산기로 가는 CTA는 `tool_id=calculator`이며 도구 귀속 창을 열지 않는다(2026-09-29 전에는 연결 도구 ID가 찍혔다) | `tool_id`, `content_slug`(계산기는 계산기 slug), `content_type=blog\|glossary\|calculator`, `placement=article_answer\|article_answer_calculator\|article_entry\|article_inline\|article_mid\|article_post\|reading_bar\|situation_check\|calculator_result`, `locale` |
| `blog_section_opened` | 상단·읽기 바·중간 패널에서 글 안 점검·예시로 이동 (도구 전환 아님). 중간 패널 "본문 데모 실습으로"(`placement=article_case_practice`)는 2026-09-29 전까지 `blog_tool_cta_clicked`로 세었다 | `content_slug`, `content_type`, `placement`, `locale` |
| `blog_example_started` / `blog_example_failed` | 샘플 실행 시도 / 로딩 실패 | `tool_id`, `content_slug`, `content_type`, `placement`, `state`, `locale` |
| `blog_sample_result_viewed` | 블로그에서 연 샘플의 실제 결과 카드 표시 | `tool_id`, `content_slug`, `content_type`, `interaction_source=demo`, `result_state`, `locale` |
| `blog_upload_started` / `blog_upload_completed` / `blog_upload_failed` | 블로그 내 파일 선택 / 파싱·매핑 완료 / 실패 (분석 완료 아님) | `tool_id`, `content_slug`, `content_type`, `locale` |
| `blog_check_next_clicked` | 두 질문 점검 결과에서 다음 가이드 선택 | `content_slug`, `content_type`, `placement=self_check`, `state`, `locale` |
| `blog_check_answered` | 글 안 점검에 답을 끝냄(30초 점검은 두 문항 모두, 상황 확인은 선택 1회) | `content_slug`, `content_type`, `placement=self_check\|situation_check`, `state=yy\|yn\|ny\|nn\|option_1..3`, `locale` |
| `blog_arrival_action` | 블로그 예시에서 도구로 넘어온 첫 줄(도착 줄)에서 선택 | `tool_id`, `content_slug`, `content_type`, `placement=blog_arrival`, `state=use_my_csv\|back_to_article`, `locale` |
| `blog_bridge_dismissed` | 블로그 읽기 바를 닫음(그 방문 동안 다시 뜨지 않음) | `content_slug`, `content_type`, `interaction_source`, `placement=reading_bar`, `state=session`, `locale` |
| `tool_view` | 분석 도구 URL 진입. 같은 도구·언어의 콘텐츠 CTA 클릭 후 30분 안이면 글과 클릭 위치를 연결 | `tool_id`, `interaction_source=route`, `locale`, 조건부 `content_slug`, `content_type`, `placement`(클릭한 CTA 위치) |
| `landing_data_start_clicked` | (2026-10-27 이전) 랜딩 주 버튼 선택 — 지금은 발생하지 않는다. 옛 기간 비교용으로 남긴다 | `interaction_source=landing`, `placement=hero|weekly_loop`, `locale` |
| `landing_situation_clicked` | 홈 첫 화면에서 상황 하나를 골라 분석 찾기로 이동 | `interaction_source=landing`, `placement=hero`, `section_id=<상황 id>`, `locale` |
| `landing_finder_opened` | 홈 첫 화면에서 "분석 N개 모두 보기" 선택 | `interaction_source=landing`, `placement=hero_all`, `locale` |
| `finder_situation_selected` · `finder_file_selected` · `finder_example_clicked` · `finder_tool_clicked` · `finder_prep_opened` | 분석 찾기(`/start`)에서 상황 선택 · 파일 종류 선택 · 예시 보고서 · 내 파일로 하기 · 준비 방법 창 | `interaction_source=analysis_finder`, `section_id`, `tool_id`, `locale` |
| `landing_review_opened` | 랜딩에서 주간 리뷰 또는 결정 이력 선택 | `interaction_source=landing`, `placement=hero|weekly_loop|continue_panel`, `locale` |
| `source_survey_viewed` | 유입 경로 서베이 카드가 실제로 노출 | `placement=source_survey`, `state=opened`, `locale` |
| `source_survey_submitted` / `source_survey_failed` | 주관식 답변 전송 성공/실패 | `placement=source_survey`, `state=sent\|failed`, `locale` |
| `source_survey_dismissed` | 답하지 않고 닫음 | `placement=source_survey`, `state=skipped\|closed`, `locale` |
| `journey_page_viewed` | 최초 및 SPA 경로 변경 | `scope=home|blog|glossary|guide|calculator|tool|start|dochi|review|other`(`calculator`는 2026-09-29 추가, 이전엔 `other`), `journey_entry`, `locale` |
| `review_entry_clicked` | 헤더·사이드바·여정 표시·도치 결과·저장 완료에서 리뷰 선택(폰 헤더 ••• 메뉴는 `placement=header_menu`) | `interaction_source`, `placement`, `locale` |
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
| `calculator_used` | 사용자가 입력을 변경한 뒤 유효한 계산 결과가 나온 첫 시점. 기본 예시의 자동 계산·불완전한 입력은 제외. 페이지 런타임에서 계산기·언어별 1회이며 입력 숫자·결과값은 보내지 않는다 | `tool_id`(후속 분석 도구), `content_slug`(계산기 slug), `content_type=calculator`, `placement=calculator_input`, `state=calculated`, `locale` |
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
| `result_download_attempted` | 다운로드 버튼을 누른 순간(게이트 판정 **전**) | `tool_id`, `download_type`, `interaction_source`, `state=free\|paid`, `locale` |
| `result_downloaded` | 파일 생성·다운로드 요청 성공 | `tool_id`, `download_type`, `interaction_source`, `state=free\|paid`, `locale` |
| `result_download_failed` | 파일 생성이 예외로 실패 | `tool_id`, `download_type`, `interaction_source`, `state=실패 사유`, `locale` |
| `example_run_started` | 명시된 단일 예시 데이터 실행 클릭 또는 예시 링크(`?example=1`) 진입 | `tool_id`, `interaction_source=landing|csv_guide|start|tool|example_link`, `placement`, `locale` |
| `analysis_result_viewed` | 결과 행동 카드가 실제 viewport에 노출 | `tool_id`, `interaction_source`, `analysis_type`, `result_state`, `placement=result_action_card`, `locale` |
| `real_result_viewed` | **활성화.** 위 이벤트 중 `interaction_source≠demo` 이고 `result_state=ready` 인 경우만 파생. 같은 도구·언어는 페이지 세션당 1회(도치 작업대와 도구 카드가 같은 계산을 보여도 1회). 실패·보류·샘플은 포함하지 않는다. GA 주요 이벤트 후보 | `tool_id`, `interaction_source`, `analysis_type`, `result_state=ready`, `placement`, `locale`, (`content_slug`·`content_type` — 30분 귀속 안) |
| `sample_report_downloaded` / `sample_report_download_failed` | 구독 페이지에서 무료 샘플 Word·Excel 생성 성공/실패. 실제 분석 다운로드(`result_downloaded`)와 합산하지 않는다 | `download_type=docx\|xlsx`, `interaction_source=sample_report`, `placement=report_preview`, `state=build_failed`(실패), `locale` |
| `purchase_prompt_sample_opened` | 다운로드 게이트 창에서 "무료 샘플 보고서 먼저 받아 보기" 선택 | `tool_id`, `download_type`, `placement=purchase_prompt`, `locale` |
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

### 시작과 완료를 같은 실행 건수로 나누지 않는 이유

2026-10-15 대시보드(5-2) 경로와 렌더 테스트를 대조했다. `CsvUploader`의 시작은 입력 서명당 한 번이며, `Dashboard`와 `ResultActionCard`의 완료 키에는 필터·분석 설정도 들어간다. 따라서 필터 변경으로 새 결과가 나오면 시작 추가 없이 완료가 추가될 수 있다. 같은 결과의 탭 전환·재마운트는 같은 브라우저 런타임에서 중복 제거되지만, 새로고침하면 메모리 키가 초기화된다. 복원된 분석 상태나 블로그 샘플은 업로더 실행 버튼을 거치지 않고 결과로 진입할 수도 있다. 완료에는 `ready` 외에 보류·추정 불가도 포함된다.

직접 빈 도구 진입은 `tool_view`일 뿐 실행이 아니다. 예제는 `interaction_source=demo`, 실제 CSV는 `csv`(또는 실제 가져오기 방식), 수기 도구는 `manual`로 구분한다. 블로그 샘플의 자동 결과를 실제 CSV 시작 누락으로 보정하지 않는다. 같은 세션·도구·분석 유형에서 시작 이후 `ready` 결과가 보였는지 순서 자료로 확인하고, 집계 이벤트 수·사용자 수를 나눈 값을 완료율로 쓰지 않는다. GA로 실행 ID를 보내지 않으므로 개별 재계산의 1:1 시작→완료 매칭은 현재 추정 불가다.

콘텐츠 CTA 노출과 클릭은 동일 `content_slug`·`placement`·`locale`를 맞춘다. 이번 보완은 `tool_view`에 그 글과 클릭 위치를 이어 주며, 결과 카드의 기존 `placement=result_action_card`는 덮어쓰지 않는다. 이는 최근 CTA 클릭 연결이지 GA 유입 출처나 최초 랜딩을 바꾸는 기능이 아니다. 30분 만료·다른 도구·다른 언어·CTA 없는 직접 진입에는 연결하지 않는다. 기존 이벤트의 과거 값은 소급 생성하지 않는다.

## 쿠팡 광고 영역 도달 (2026-10-29 구현)

`ad_slot_view`는 광고 **영역 도달**이며 쿠팡의 노출·클릭·구매나 상품 송출 성공이 아니다. iframe load/error, 부모 focus/blur로 송출·클릭을 추정하지 않는다. 배치 키·허용 규격은 `src/lib/partnerAds.js` 정본을 사용하며, 처음 유효하게 도달했을 때 실제 iframe 규격을 기록한다. 광고 위치·개수·배너 ID·sandbox는 바꾸지 않는다.

중복 단위는 현재 **페이지 진입 × 슬롯**이다. `GaPageviews`의 pathname 전환에 맞춰 메모리 Set을 새로 만들고, A→B→A는 새 진입으로 센다. 같은 진입의 스크롤 재진입·리렌더·규격 변경·중복 마운트는 추가하지 않는다. query/fragment만 바뀐 것은 새 진입이 아니다. 사용자 식별자나 영속 저장 키를 만들지 않는다.

`usePartnerAdView`는 실제 iframe을 IntersectionObserver로 관측한다. 숨김 레일·폭 부족·0 크기·CSS 숨김·숨은 문서는 제외한다. visible 복귀 시 관측기를 새로 만들고 이전 관측기의 늦은 콜백을 무시해 새 교차율로 판단한다. `mode=live` 및 기존 호스트·동의 조건을 렌더와 전송 직전에 모두 검사한다. 관측 API 미지원·관측 예외·gtag 호출 예외는 수집 불가이며 UI를 중단하지 않는다. 동의 철회·언마운트 때 observer/listener를 해제한다.

기존 `trackProductEvent`/gtag 경로만 사용한다. 광고 이벤트는 계약 필드만 허용하고 `page_path`는 현재 pathname에서 가져온다. 자동 URL에도 원본 query/fragment가 섞이지 않도록 `page_location=origin+pathname`, `page_referrer=""`, `page_title=""`를 이벤트 단위로 지정한다. CSV·파일명·분석값·사용자 입력 및 기존 여정의 추가 필드는 보내지 않는다. 광고 전용 버전은 전역 `measurement_version`과 별개다.

전송 함수의 성공은 **기존 gtag 큐가 호출을 수락했다는 뜻**이다. 차단된 SDK·네트워크 실패·GA 수신 여부를 이 반환값으로 알 수 없다. 배포 후 GA 속성 `542428327`의 실제 수신을 별도로 확인해야 하며, 과거 자료에 새 지면 값이 소급 생성되지 않는다.

### GA4 맞춤 측정기준 확인과 설정안

2026-10-29 내부 브라우저에서 Growth 속성의 맞춤 측정기준 15개 전체를 읽기 전용으로 확인했다. `locale`(이벤트 범위)은 있고 아래 네 항목은 없다. 아래 이름과 매개변수로 **이벤트 범위** 등록을 제안한다. 계정 설정 변경은 이번 작업에서 실행하지 않았다.

| 표시 이름 / 이벤트 매개변수 | 목적 |
|---|---|
| `ad_provider` | 공급자별 도달 구분 |
| `ad_slot` | 기존 배치 키별 도달 분석 |
| `ad_format` | 첫 도달 시 실제 규격 비교 |
| `ad_measurement_version` | 광고 측정 계약 변경 전후 구분 |

`locale`은 기존 정의를 재사용하고 경로는 쿼리가 제거된 `page_location`의 기본 페이지 경로 측정기준을 우선 사용한다. 별도 `page_path` 맞춤 정의는 현재 없으며, 이 이벤트 매개변수 자체를 보고서에서 선택해야 할 때만 추가한다. 기존 `placement`는 제품 행동 위치로 유지하며 `ad_slot`과 합치지 않는다.

로컬 검증: `partnerAdMeasurement.test.js`, `PartnerAdMeasurement.smoke.test.jsx`, `e2e/partner-ad-measurement.spec.js`. E2E는 운영 hostname을 로컬 서버에 매핑하고 모든 외부 요청을 차단해 실제 앱 렌더·IntersectionObserver·표준 gtag 큐를 검증한다. 실제 쿠팡 송출·GA 수신의 증거는 아니다.

## GA4에서 등록할 이벤트 범위

Custom dimensions는 이벤트 범위로 아래만 등록하면 충분하다.

- `tool_id`
- `tool_route_id`(5-18 하위 도구의 원래 공개 ID; 이벤트 범위)
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

2026-10-20부터 마케팅 응답 하위 도구는 기존 `tool_id=5-18` 집계를 유지하면서 `tool_route_id`에 정규화 전 공개 ID를 추가한다. `5-18-mmm`, `5-18-trend`, `5-18-paid-organic`, `5-18-cannibal`, `5-18-forecast`만 코드에서 파생하며 임의 입력은 허용하지 않는다. 기존 중복 제거와 활성화 정의는 유지하므로 이 차원을 실행 ID나 독립 실행 건수로 해석하지 않는다. GA 맞춤 측정기준 등록과 실제 수신은 배포 후 확인해야 한다.

`journey_entry`, `visit_type`, `placement`, `result_state`, `data_continuity`, `tool_id`, `interaction_source`, `locale`를 이벤트 범위 맞춤 측정기준으로 확인한다. GA 탐색은 비연속 단계(중간 페이지 이동 허용), 실데이터 `interaction_source != demo`, 코드 완료와 화면 노출을 분리한 퍼널로 구성한다. 저장 핵심 이벤트는 사용자가 저장한 두 이벤트만 후보이며 자동 집계 저장이나 단순 방문은 포함하지 않는다.

이벤트 호출·개인 데이터 미포함은 테스트로 검증한다. GA 관리 화면의 실제 수신, 맞춤 측정기준 등록, Enhanced Measurement/GTM 중복 여부는 별도 실측 대상이다. 관리 설정을 열지 못했다면 코드 테스트 통과만으로 수신 완료라고 보고하지 않는다.

- 블로그→분석: `page_view`(블로그) → `blog_read_depth(depth_75)` → `blog_cta_viewed` → `blog_tool_cta_clicked` → `tool_view` → `data_import_success` → `analysis_completed(result_state=ready)`
  - `blog_cta_viewed` 없이 `page_view`만 쌓이면 패널이 안 보인 것이고, `blog_cta_viewed`는 있는데 클릭이 없으면 카피·목적지 문제다. 두 원인을 가르는 게 이 이벤트의 존재 이유다.
  - 노출 위치는 `placement`로 구분한다. 읽기 바의 샘플 실행은 `blog_example_started` → `blog_tool_cta_clicked`, 본문 점검으로의 스크롤은 `blog_section_opened`다. 두 동작을 클릭 전환으로 합산하지 않는다. 2026-09-27 이전 `reading_bar` 클릭은 본문 이동이므로 전후 비교 시 제외한다.
  - 샘플 체험: `blog_cta_viewed` → `blog_example_started` → `blog_tool_cta_clicked(interaction_source=demo)` → `blog_sample_result_viewed`. 마지막 이벤트는 같은 도구·언어·30분 귀속 범위의 실제 결과 표시에서만 파생하고, 글·도구·언어·결과 상태별로 중복 제거한다. 같은 샘플을 다른 글에서 다시 연 경우에도 해당 글의 조회는 남기되 일반 `analysis_result_viewed` 집계는 늘리지 않는다. `result_state=ready`와 보류 상태를 구분하고 실제 CSV 활성화와 합산하지 않는다.
  - `blog_session_articles(rank≥2)`는 글을 이어 읽는 세션의 크기 — 중간 개입(도치 브리지) 트리거의 분모다.
- 랜딩→실데이터: `landing_situation_clicked`(또는 히어로 파일 놓기) → `data_import_start` → `data_import_success` → `analysis_started` → `analysis_completed(result_state=ready)` → `analysis_result_viewed`
- 예시→실데이터: `example_run_started` → `data_import_start` → `data_import_success` → `analysis_started` → `analysis_completed(result_state=ready)` → `analysis_result_viewed`
- 콘텐츠→계산기: `blog_tool_cta_clicked(tool_id=calculator)` → `journey_page_viewed(scope=calculator)` → `calculator_used` → `blog_tool_cta_clicked(content_type=calculator)` → `tool_view`. 콘텐츠 클릭의 `content_slug`는 글·용어, 사용 이벤트의 `content_slug`는 계산기다. 사용자·세션 순서를 기준으로 연결하고 이름이 같은 문자열끼리 합산하지 않는다. 입력 변경은 예시 조작일 수도 있으므로 실제 데이터 분석 활성화로 세지 않는다. 배포 후 실제 수신을 별도로 확인한다.
- 핵심 검색 진입(`/compare`): 실제 보이는 질문별 CTA는 `blog_cta_viewed`, 도구 선택은 `blog_tool_cta_clicked`에 `content_type=compare`, `content_slug=marketing-analysis`, `placement=analysis_question`을 보낸다. 직접 선택한 도구·언어에만 기존 30분 귀속을 적용한다. 계산기·`/start` 경로를 도구의 직접 전환으로 세지 않는다.
- `/compare` 안의 ROAS 입력·계산 후 도구 클릭은 `content_type=compare`, `content_slug=marketing-analysis`, `placement=analysis_preview`로 원래 진입을 유지한다. `calculator_used`는 계산기·진입 콘텐츠·언어별 첫 유효 입력 변경만 센다. 예시 질문 전환이나 기본값 노출은 사용·활성화로 기록하지 않는다. 입력값은 전송하지 않는다.
- 블로그의 `blog_section_opened(state=own_csv)`는 업로드 영역으로 이동한 클릭일 뿐이다. ROAS 글의 `state=calculator`는 본문 계산기로 이동한 클릭이다. 업로드·분석 완료로 세지 않는다.
- 배포 전후 비교는 GSC의 ‘퍼포먼스 마케팅’, ‘마케팅 분석’ 검색어군별 노출·클릭·평균 게재순위를 해당 랜딩 페이지별로 보고, GA의 Organic Search 랜딩별 `real_result_viewed` 사용자 비율을 별도로 본다. GSC 검색어와 GA 개인 사용자를 직접 연결할 수 없으므로 키워드별 전환율로 단정하지 않는다. 샘플 결과(`blog_sample_result_viewed`)·계산기 사용·실제 데이터 분석을 각각 보고한다. 작은 표본은 건수도 병기한다.
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

## 한국 검색 → 계산 → 결과 활용 (2026-10-15)

국가는 GA4 `Country=South Korea`로 필터한다. `locale=ko`는 UI 언어이므로 국가를 대신하지 않는다. 한국 방문 중 영어 페이지 사용도 별도 행으로 유지한다. 랜딩 페이지와 세션 source/medium을 기준으로 같은 세션의 아래 단계를 비교하며 이벤트 수의 단순 나눗셈을 전환율로 부르지 않는다.

| 단계 | 집계 조건 | 제외·주의 |
|---|---|---|
| 랜딩 | 세션의 Landing page + query string, 세션 source/medium | 내부 `page_view`를 새 랜딩으로 세지 않기 |
| 도구 진입·시작 | `tool_view` → `data_import_start` → `analysis_started` | 진입·업로드·실행을 한 단계로 합치지 않기 |
| 계산 성공 | `analysis_completed`, `result_state=ready` | `insufficient`·`blocked`는 완료 이벤트여도 성공 제외 |
| 결과 확인 | `real_result_viewed` | 예제는 `blog_sample_result_viewed`; 기본 예제 자동 계산과 구분 |
| 파일 없는 계산 | `calculator_used`, `state=calculated` | 사용자가 유효 입력을 바꾼 경우. CSV 분석 퍼널과 별도 |
| 결과 활용 대리 지표 | `result_downloaded`의 `state=free\|paid`, `report_brief_copied`, `decision_record_added`, `project_review_saved`, `decision_follow_up_saved` | 생성·복사·저장 성공이지 실제 업무 적용·성과 개선의 증거는 아님 |

`result_download_attempted`와 `result_download_failed`는 성공에 합산하지 않는다. 정적 설명서 클릭(`interaction_source=manual`, 성공 state 없음)도 결과 다운로드에서 제외한다. 검토 창을 연 `decision_review_opened`는 활용 의향 단계다.

글 CTA에서 시작한 `content_slug/content_type` 연결을 다운로드 시도·성공·실패, 검토 열기·저장, 보고서 복사·후속 결정 저장까지 확장했다. 기존 30분 TTL·동일 도구·동일 언어 조건을 유지한다. `interaction_source=demo`는 실제 데이터 퍼널에서 제외한다. 이 연결은 CTA 경로만 포함하며 모든 본문 링크나 교차 도구 이동을 완전하게 추적하지 않는다. MMM 계열 이벤트는 기존 `5-18` 집계가 있으므로 `page_path`로 하위 도구를 구분하고, 정확한 ID가 다른 CTA는 억지로 연결하지 않는다.

유입 분류는 GA4의 **세션** source/medium을 보존한다. 내부 위치·CSV 형식은 `interaction_source`로 보내며 `source`·`utm_source`로 새로 덮어쓰지 않는다. 코드에서 이 분리를 확인했지만 과거 `csv/blog/weekly_review/subscription_page` 유입의 원인을 모두 입증한 것은 아니다. GTM·확장 측정의 현재 설정과 실제 수신은 배포 후 DebugView에서 확인해야 한다. 로컬 검증은 운영 GA에 보내지 않는다.

- Google: `google / organic`. Google AI 관련 노출은 Search Console의 별도 관측 항목이며 웹 노출에 더하지 않는다. GA 세션만으로 일반 검색과 Google AI 클릭을 구분하지 않는다.
- 네이버: `naver / organic`과 `m.naver.com / referral`은 별도로 보관한다. 후자를 자동으로 검색 세션으로 재분류하지 않는다.
- 확인 가능한 AI 추천: 실제 수신된 외부 referrer 호스트가 ChatGPT·Perplexity·Gemini·Copilot 서비스와 일치하는 경우에만 해당 서비스 추천으로 기록한다. `perplexity / (not set)`처럼 이름만 있고 근거가 없는 행은 미확인으로 둔다. 직접 방문은 AI로 추정하지 않는다.

GA4 사용자 정의 차원(`content_slug`, `content_type`, `tool_id`, `interaction_source`, `result_state`, `locale`)의 등록·보존 기간과 BigQuery 연결 여부는 이번 코드 검증에서 미확인이다. 설정 변경은 하지 않았다. GSC 클릭과 GA 세션, 쿼리 합과 페이지 합, AI 노출 합의 차이는 필터·범위·시간대·누락을 확인하기 전 보정하지 않는다. 제목과 본문을 동시에 바꾼 이번 작업은 제목만의 A/B 실험이 아니며, 실제 배포일 이후 동일 국가·기기·순위 구간의 28일 창부터 관찰한다.
