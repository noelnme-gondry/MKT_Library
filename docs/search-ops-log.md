# 검색 노출 운영 로그

검색엔진 소유 확인·피드 제출·측정 일정을 코드 변경과 분리해 기록한다. 이 저장소는 공개이므로 계정 이메일, 속성 ID, 인증 토큰, 콘솔 화면, 검색어 원본과 상세 성과 수치는 남기지 않는다. 실제 수치는 운영자 전용 콘솔 또는 비공개 시트에서 관리한다.

## 현재 상태

확인 기준: 2026-08-04 KST · 근거: 운영자 확인(`operator-confirmed`)

| 채널 | 소유 확인 | 제출 자산 | 상태 | 다음 확인 |
|---|---|---|---|---|
| Google Search Console | 완료 | `https://growthoptplaybook.com/sitemap.xml` | 완료 확인. 최초 등록일은 알 수 없으며 2026-08-04 활성 상태만 확인 | 2026-08-18 |
| 네이버 서치어드바이저 | 완료 | `https://growthoptplaybook.com/sitemap.xml`, `https://growthoptplaybook.com/rss.xml` | 완료 확인. 최초 등록일은 알 수 없으며 2026-08-04 활성 상태만 확인 | 2026-08-18 |
| Bing Webmaster Tools | 미확인 | GSC 가져오기 후 `https://growthoptplaybook.com/sitemap.xml` 상태 확인 | 운영자 계정에서 진행 필요 | 완료 후 최대 48시간 뒤 데이터 생성 확인 |

`llms.txt`는 공개 콘텐츠 경로를 안내하는 파일이지 검색 콘솔 제출 자산이 아니다. Bing에는 sitemap만 확인하며 RSS와 `llms.txt`를 중복 제출하지 않는다. IndexNow는 발행·수정 빈도가 높아질 때 별도 변경으로 검토한다.

## 기준 측정 창

- 기준 기간: 2026-07-07~2026-08-03(직전 완료 28일)
- 비교일: 2026-08-18 KST
- 검색 지표: 클릭, 노출, CTR, 평균 게재순위, 발견·색인 URL 수
- 제품 지표: `blog_tool_cta_clicked`, `data_import_start`, `data_import_success`, `data_import_failed`, `analysis_started`, `analysis_blocked`, `analysis_completed`, `analysis_result_viewed`, `analysis_history_viewed`
- 핵심 전환율: 블로그→도구, 업로드 시작→성공, 분석 시작→완료, 완료→결과 열람
- 주간 북극성 지표: 데모를 제외하고 `result_state=ready`인 `analysis_completed` 수

## 변경 이력

| 날짜(KST) | 확인·변경 | 결과 | 다음 행동 |
|---|---|---|---|
| 2026-08-04 | GSC·네이버 운영 상태 확인 | 운영자 완료 확인 | 2026-08-18에 같은 28일 지표 재확인 |
| 2026-08-04 | Bing 상태 분리 | 아직 확인 근거 없음 | Bing에서 GSC 가져오기 → 자동 검증·sitemap 가져오기 상태 확인 |
