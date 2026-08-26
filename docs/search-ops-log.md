# 검색 노출 운영 로그

검색엔진 소유 확인·피드 제출·측정 일정을 코드 변경과 분리해 기록한다. 이 저장소는 공개이므로 계정 이메일, 속성 ID, 인증 토큰, 콘솔 화면, 검색어 원본과 상세 성과 수치는 남기지 않는다. 실제 수치는 운영자 전용 콘솔 또는 비공개 시트에서 관리한다.

## 현재 상태

확인 기준: 2026-08-04 KST · 근거: 운영자 확인(`operator-confirmed`)

| 채널 | 소유 확인 | 제출 자산 | 상태 | 다음 확인 |
|---|---|---|---|---|
| Google Search Console | 완료 | `https://growthoptplaybook.com/sitemap.xml` | 완료 확인. 최초 등록일은 알 수 없으며 2026-08-04 활성 상태만 확인 | 2026-08-18 |
| 네이버 서치어드바이저 | 완료 | `https://growthoptplaybook.com/sitemap.xml`, `https://growthoptplaybook.com/rss.xml` | 완료 확인. 최초 등록일은 알 수 없으며 2026-08-04 활성 상태만 확인 | 2026-08-18 |

`llms.txt`는 공개 콘텐츠 경로를 안내하는 파일이지 검색 콘솔 제출 자산이 아니다. 검색 운영·비교 대상은 Google과 네이버로 한정한다. 비교일 전에는 노출 수만 보고 신규 글을 추가하거나 제목·본문·내부 링크를 한꺼번에 바꾸지 않는다.

## 기준 측정 창

- 기준 기간: 2026-07-07~2026-08-03(직전 완료 28일)
- 비교일: 2026-08-18 KST
- 검색 지표: 클릭, 노출, CTR, 평균 게재순위, 발견·색인 URL 수
- 제품 지표: `blog_tool_cta_clicked`, `newsletter_submit_attempt`, `data_import_start`, `data_import_success`, `data_import_failed`, `analysis_started`, `analysis_blocked`, `analysis_completed`, `analysis_result_viewed`, `decision_record_added`, `decision_review_completed`
- 유입 품질: Google·네이버 검색 랜딩 → 비데모 `analysis_completed` 비율
- 활성화: 첫 `tool_view` → 첫 비데모 `analysis_completed` 전환율과 `elapsed_bucket` 소요시간 구간
- 리텐션: `decision_record_added` → 7일·28일 안의 `decision_review_completed` 비율
- 실제 이메일 구독 완료는 사이트의 제출 시도 이벤트가 아니라 Buttondown의 확인 완료 수를 SSOT로 본다.
- 주간 핵심 지표: 비데모 `analysis_completed(result_state=ready)`와 `decision_review_completed`를 분리해 함께 본다.

## 변경 이력

| 날짜(KST) | 확인·변경 | 결과 | 다음 행동 |
|---|---|---|---|
| 2026-08-04 | GSC·네이버 운영 상태 확인 | 운영자 완료 확인 | 2026-08-18에 같은 28일 지표 재확인 |
| 2026-08-09 | 검색 운영 범위 확정 | Google·네이버만 비교하고 Bing은 제외 | 2026-08-18에 같은 28일 지표 재확인 |
| 2026-08-26 | 비공개 GSC 내보내기 재검토 | 7일 표본은 제목 실험 판정에 부족. KO 후보 2건은 baseline 수집 상태로 유지하고 EN은 순위 개선을 우선 | 2026-08-26 이후 28일 페이지 지표 재확인 |
