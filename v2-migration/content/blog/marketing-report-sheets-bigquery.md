---
title: "광고 리포트 자동화: BigQuery·Google Sheets에서 CSV까지"
description: "BigQuery·Sheets 예약 갱신에서 분석 CSV까지 연결합니다. 권한·비용·집계 단위·수동 불러오기 범위를 확인하세요."
date: "2026-09-14"
updated: "2026-09-14"
slug: "marketing-report-sheets-bigquery"
keywords: "광고 리포트, BigQuery, Google Sheets"
searchTitleTerms: ["광고 리포트", "BigQuery", "Google Sheets"]
tags: ["분석", "기초"]
draft: false
sources: [{"title": "Google Cloud: Connected Sheets", "url": "https://cloud.google.com/blog/products/data-analytics/using-connected-sheets-to-analyze-bigquery-data/"}, {"title": "Google Cloud: Scheduled queries", "url": "https://docs.cloud.google.com/bigquery/docs/scheduling-queries"}]
faq: [{"q": "BigQuery를 연결하면 사이트 분석도 자동으로 갱신되나요?", "a": "아닙니다. BigQuery·Sheets의 예약 갱신과 사이트의 데이터 불러오기는 별개입니다. 사이트에서 CSV를 다시 올리거나 공개 시트를 다시 불러온 뒤 분석해야 합니다."}, {"q": "비공개 시트를 전체 공개로 바꿔야 하나요?", "a": "사내 자료를 공개로 바꿀 필요가 없습니다. 권한이 있는 환경에서 필요한 집계 CSV만 내려받아 브라우저 분석에 사용하세요."}]
reviewedAt: "2026-09-14"
reviewer: "Codex (AI-assisted editorial review)"
---
광고 리포트 자동화는 매주 같은 파일을 합치는 일을 줄이는 데서 시작합니다. BigQuery에서 집계를 준비하고 Google Sheets로 검토할 수 있지만, 어떤 열을 합쳐도 되는지와 어디까지 자동으로 갱신되는지부터 정해야 합니다.

이미 정리된 CSV가 있다면 BigQuery를 새로 도입할 필요는 없습니다. 아래 세 경로 중 현재 업무에 맞는 것을 고르세요. 이 글의 데모는 경로 마지막에 있는 분석용 CSV를 확인하는 실습입니다.

## 세 가지 경로 중 하나를 고르세요

| 경로 | 적합한 상황 | 남는 작업 |
| --- | --- | --- |
| 매체 CSV → 브라우저 분석 | 소수 계정을 가끔 분석 | 내보내기·열 확인·업로드 |
| 사내 비공개 Sheets → CSV → 분석 | 팀에서 표를 정리하고 검토 | 시트 갱신 확인·CSV 다운로드·업로드 |
| BigQuery → Connected Sheets → CSV → 분석 | 이미 BigQuery에 반복 수집 데이터가 있음 | 쿼리·예약 갱신·권한 관리와 마지막 업로드 |

BigQuery가 광고 계정 데이터를 저절로 수집하지는 않습니다. 수집 커넥터·전송 작업은 별도로 준비해야 하고, 지원 매체와 비용도 각각 확인해야 합니다. Growth Opt Playbook은 광고 계정 API에 직접 연결하지 않습니다.

## 날짜·캠페인·성과 정의를 하나로 맞춥니다

예제의 분석 단위는 날짜 × 채널 × 캠페인입니다. 날짜는 한국 시간, 통화는 KRW, 성과는 설치로 통일합니다. 비용이나 설치 합계가 이미 들어 있는 행을 상세 행에 다시 붙이면 이중 집계가 됩니다.

| 출력 열 | 예제의 의미 | 확인할 점 |
| --- | --- | --- |
| date | 보고 날짜 | UTC 날짜와 한국 날짜가 섞이지 않았는가 |
| channel | 매체 또는 채널 | 같은 이름의 오타·공백을 정리했는가 |
| campaign_id | 캠페인 식별자 | 계정이 다르면 계정 ID까지 조합해 구분했는가 |
| campaign_name | 캠페인 이름 | 같은 이름의 다른 캠페인을 ID로 구분했는가 |
| cost | KRW 광고비 | 환산했다면 환율·기준일을 기록했는가 |
| installs | 같은 기준의 설치 | 가입·구매·중복 설치를 섞지 않았는가 |
| impressions, clicks | 노출·클릭 | 매체 간 정의가 비교 가능한가 |

다른 매체의 귀속 설치를 합한 값이 중복 없는 실제 신규 사용자 수가 되는 것은 아닙니다. [어트리뷰션 불일치](/blog/attribution-data-mismatch)를 먼저 점검하고, 서로 다른 전환은 억지로 한 열에 합치지 마세요.

## BigQuery에서 읽기 전용 집계를 준비합니다

아래는 이미 중복 제거와 단위 정리가 끝난 사내 테이블을 조회하는 예시입니다. 프로젝트·데이터셋·테이블 이름과 날짜는 자신의 환경에 맞춰 바꿔야 합니다. 고객 식별자는 출력하지 않습니다.

```sql
SELECT
  report_date AS date,
  channel,
  campaign_id,
  campaign_name,
  SUM(cost_krw) AS cost,
  SUM(installs) AS installs,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks
FROM `your_project.reporting.campaign_daily`
WHERE report_date BETWEEN DATE '2026-08-31' AND DATE '2026-09-13'
GROUP BY report_date, channel, campaign_id, campaign_name
ORDER BY date, channel, campaign_id;
```

`report_date`는 한국 기준으로 정리한 DATE 열, 나머지는 예제에서 정한 숫자 열이라는 전제입니다. 원본이 이벤트 timestamp라면 집계 전에 날짜 변환과 중복 제거를 설계해야 합니다. 결측을 0으로 바꾸면 집계 실패가 정상값처럼 보일 수 있으므로, null·행 수·원본 합계를 별도로 점검하세요. `SUM`은 null을 무시합니다.

[BigQuery 예약 쿼리](https://docs.cloud.google.com/bigquery/docs/scheduling-queries)는 집계 작업을 반복 실행할 때 쓸 수 있습니다. 날짜를 고정한 위 쿼리를 예약한다고 매주 다음 기간으로 자동 이동하지는 않습니다. 실제 운영에서는 보고 기간 파라미터와 재처리 범위를 따로 설계하세요.

## Sheets의 갱신과 사이트의 불러오기를 구분하세요

![BigQuery 집계, Sheets 예약 갱신, 사용자 확인과 CSV 업로드의 경계를 보여주는 흐름도](/blog-assets/marketing-report-sheets-bigquery/data-path.svg)

[Google의 Connected Sheets 안내](https://cloud.google.com/blog/products/data-analytics/using-connected-sheets-to-analyze-bigquery-data/)에 따라 BigQuery 데이터에 연결한 뒤 결과를 검토하고 예약 새로고침을 설정할 수 있습니다. 계정·Workspace 기능·BigQuery 권한과 결제 프로젝트 조건을 먼저 확인하세요. 쿼리와 저장·수집 비용이 생길 수 있으므로 “무료 자동화”로 가정하지 않습니다.

연결 순서는 다음과 같습니다. 메뉴 이름은 계정 언어에 따라 달라질 수 있습니다.

1. Sheets에서 데이터 → 데이터 커넥터 → BigQuery에 연결을 열고, 권한이 있는 프로젝트와 준비한 집계 테이블·뷰를 선택합니다.
2. 연결 미리보기만 보고 전체 파일이라고 생각하지 마세요. 필요한 열의 추출(Extract)을 만들고, 행 제한 때문에 일부만 포함되지 않았는지 원본 집계와 대조합니다.
3. 새로고침 옵션에서 예약 새로고침을 설정합니다. BigQuery 집계 완료 뒤의 시간으로 잡고 한 번 직접 새로고침해 성공 여부를 확인합니다.
4. 검토한 집계 표를 CSV로 내려받아 사이트에서 열 매핑을 확인하고 분석합니다. 다음 주에는 날짜가 실제로 바뀌었는지도 확인합니다.

[Google의 실습 안내](https://www.cloudskillsboost.google/course_templates/632/labs/464082)에서 추출과 예약 새로고침 절차를 확인할 수 있습니다. 다른 사람의 권한을 대신 쓰는 [위임 액세스](https://support.google.com/docs/answer/10436675?hl=en)는 예약 새로고침에 사용할 수 없으므로, 공유받았다는 이유만으로 갱신 권한까지 있다고 가정하지 마세요.

예약 갱신이 끝나면 마지막 성공 시각, 데이터 최대 날짜, 행 수와 합계를 확인합니다. BigQuery에서 집계가 끝나기 전에 Sheets를 갱신하면 이전 결과를 읽을 수 있습니다. 필요한 집계 열만 일반 표로 준비해 CSV로 내보낸 뒤, 아래 실습에서 열 매핑을 확인해 보세요. 데모에는 앞의 [주간 보고서 예제](/blog/weekly-marketing-report-template)와 같은 28행이 들어 있습니다.

## 비공개 데이터는 CSV 경로를 사용하세요

우리 사이트의 Google Sheets 연결은 인증 없이 읽을 수 있는 공개 URL을 전제로 합니다. 비공개 시트를 OAuth로 여는 기능이나 Connected Sheets 예약을 직접 제어하는 기능은 아닙니다. 시트가 갱신되어도 이미 열어 둔 분석 결과가 자동으로 바뀌지는 않습니다.

사내 자료는 공개 공유로 바꾸지 말고, 권한이 있는 환경에서 필요한 집계만 CSV로 내려받아 업로드하세요. 공개해도 되는 별도 예제 시트라면 공유 설정에서 링크로 읽을 수 있게 한 뒤, 대상 탭의 `gid`가 포함된 URL을 복사해 사이트의 Google Sheets 연결 칸에 넣습니다. 처음 불러온 뒤에는 ‘최신 데이터 불러오기’ 버튼으로 다시 읽고 분석합니다. 연결 버튼이 없거나 권한·네트워크 오류가 나면 CSV 경로로 진행할 수 있습니다.

업로드한 CSV의 파싱과 계산은 브라우저에서 실행합니다. 원본 행을 우리 서버로 보내지 않는다는 뜻이며, Google에 공개한 시트까지 비공개로 보호한다는 뜻은 아닙니다.

## 다음 주에도 같은 보고서가 나오는지 확인합니다

날짜·기간·통화·전환 정의와 추출 시각을 함께 기록하세요. 금주 합계가 매체 원본과 다른데 이유를 모른다면, 보고서부터 확정하지 말고 중복·필터·지연 집계를 확인합니다. 열 매핑은 [CSV 준비 가이드](/guide/csv-data-prep), 다음 행동을 적는 형식은 [주간 광고 성과 보고서](/blog/weekly-marketing-report-template)로 이어집니다.

분석은 무료로 실행할 수 있습니다. 프로젝트·리뷰 저장은 유효 Pro, 결정 기록 저장은 로그인도 필요합니다. 자동 수집과 자동 분석을 약속하는 흐름이 아니라, 반복 입력 작업을 줄이면서 매번 비교 조건을 확인하는 흐름입니다.
