# 블로그 재구성 마스터 플랜 — 발행 38편 전체 + 초안 1편

기준일: 2026-07-19 · growthoptplaybook.com/blog
산출물: `batch1/` 12개 파일 · `batch2/` 23개 파일 · `en-mirror-patches.md`
운영 방식: **전량 지금 보관, 배포는 아래 캘린더대로 주차별 머지.** 머지 전 production 노출 금지(브랜치/로컬 보관).

---

## 0. 전략 요약 (왜 이렇게 하나)

- 문제: 10일 38편 대량 발행 패턴 + 정의형 제목 → 노출 대비 클릭 부진
- 처방: 신규 발행 대신 기존 글 강화. 통합 3건·제목교체 8건(1차) + 전편 경험 블록 보강(2차)을 **14주에 걸쳐 분산**
- 불변 원칙: 슬러그(URL) 불변 / 발행일(date) 불변, 수정일만 자연 갱신 / 실질 수정 없는 날짜 갱신 금지 / 주당 2~3편

## 1. 전체 캘린더 (14주)

| 주차 | 머지 주간 | 배포 파일 (폴더) | 동반 작업 |
|---|---|---|---|
| 1 | 7/20~ | ad-performance-drop (batch1) | 301: campaign-anomaly-detection → ad-performance-drop · 구 파일 제거 · **EN 패치 #1** |
| 2 | 7/27~ | ctr-improvement, ltv-cac-ratio (batch1) | — |
| 3 | 8/3~ | funnel-dropoff-analysis (batch1) | 301: cvr-optimization → funnel-dropoff-analysis · 구 파일 제거 |
| 4 | 8/10~ | cohort-analysis-guide, performance-marketing-metrics, google-uac-optimization (batch1) | 301: cpi-cpa-cpm-difference → performance-marketing-metrics · 구 파일 제거 · **EN 패치 #2** |
| 5 | 8/17~ | marketing-mix-modeling, ios-att-skan-guide (batch1) | **EN 패치 #3** |
| 6 | 8/24~ | apple-search-ads-guide, aso-basics-guide, performance-marketer-skills (batch1) | EN #4 확인만(무변경) |
| 7 | 8/31~ | cpa-reduction, roas-improvement, ga4-data-traps (batch2) | **1차분 GSC 중간점검** (아래 §5 게이트) |
| 8 | 9/7~ | scaling-pitfalls, creative-fatigue, attribution-data-mismatch (batch2) | — |
| 9 | 9/14~ | marketing-budget-allocation, campaign-saturation-signals, junior-metrics-guide (batch2) | — |
| 10 | 9/21~ | audience-broad-vs-narrow, ab-testing, incrementality-measurement (batch2) | — |
| 11 | 9/28~ | ad-machine-learning, correlation-vs-causation, cannibalization-organic-paid (batch2) | — |
| 12 | 10/5~ | meta-advantage-plus-guide, retargeting-reengagement-guide, event-taxonomy-guide (batch2) | — |
| 13 | 10/12~ | postback-integration-guide, aha-moment-retention, hook-3-seconds-framework (batch2) | — |
| 14 | 10/19~ | ad-creative-specs-guide, ai-era-marketer (batch2) | **전체 리뷰** · 초안(Adjust vs AppsFlyer) 발행 검토 · EN 갭·신규 소재 재개 판단 |

2차분 순서 논리: 상업적 검색의도가 강한 진단·예산(7~9주) → 방법론(10~11주) → 매체·측정·소재·커리어(12~14주).

## 2. 파일별 변경 내역 — 전체 38편 + 초안

### A. 통합·삭제 3편 (구 파일은 zip에 없음 — 삭제+301 대상)

| # | 슬러그 | 처리 | 흡수처 |
|---|---|---|---|
| 12 | campaign-anomaly-detection | 1주차 삭제+301 | ad-performance-drop의 "갑자기 좋아진 날도 의심" 섹션 |
| 18 | cvr-optimization | 3주차 삭제+301 | funnel-dropoff-analysis의 "CVR 점검 셋" 섹션 |
| 16 | cpi-cpa-cpm-difference | 4주차 삭제+301 | performance-marketing-metrics의 "CPM·CPC" 섹션 + FAQ |

### B. 1차분 12편 (batch1/) — 제목·훅·메타 교체 및 필러 보강

| 파일 | 주차 | 변경 |
|---|---|---|
| ad-performance-drop | 1 | 제목 "…반토막 났을 때, 소재부터 만지면 원인 놓쳐요"·메타·훅 교체, 경험블록(배포-전환 그래프), #12 흡수 섹션+소프트셀 1회, 키워드 확장 |
| ctr-improvement | 2 | 제목 "같은 소재인데 CTR이 반토막…"·메타·훅 교체, "0. 소재 문제인지 판별" 섹션(지면믹스 가정수치), 순서 갱신, 링크 교체 |
| ltv-cac-ratio | 2 | 제목 "LTV:CAC 3:1이면 안심?…"·메타·훅 교체, "흔히 틀리는 세 지점" 섹션(분모·마진·블렌디드) |
| funnel-dropoff-analysis | 3 | 제목 유지, #18 흡수 섹션, 키워드 확장 |
| cohort-analysis-guide | 4 | 제목 "리텐션 30%라는데 매출은…"·메타·훅 교체 |
| performance-marketing-metrics | 4 | 제목 유지, #16 흡수 섹션+FAQ 1개, 기존 3번→4번 번호 조정, 키워드 확장 |
| google-uac-optimization | 4 | 내부 링크 교체 + 에셋 다양성 경험블록 (1·2차 통합본) |
| marketing-mix-modeling | 5 | 제목 "라스트클릭이 브랜드검색만 칭찬할 때…"·본문 H1·메타·훅 교체 |
| ios-att-skan-guide | 5 | 제목 "iOS 성과가 반토막으로 '보이는' 이유…"·메타·훅 교체 |
| apple-search-ads-guide | 6 | 제목 "…캠페인 왜 4개로 쪼개나"·메타·훅 교체 |
| aso-basics-guide | 6 | 제목 "광고비 태우기 전에, 스토어에서 새는 설치부터…"·메타·훅 교체 |
| performance-marketer-skills | 6 | 제목만 교체(EN 앵글 역수입) |

### C. 2차분 23편 (batch2/) — 경험 블록 1개씩 삽입 (제목·메타·구조 무변경)

| 파일 | 주차 | 삽입된 경험 블록 요지 |
|---|---|---|
| cpa-reduction | 7 | 자동입찰이 만드는 '조용한 믹스 변화' |
| roas-improvement | 7 | 최상위 채널 줄이기 두려움 → 끝자락 10~20%만 이동 |
| ga4-data-traps | 7 | D+3 확정 원칙이 바꾸는 회의 풍경 |
| scaling-pitfalls | 8 | 증액 후 시차 함정(이중 증액 사고) |
| creative-fatigue | 8 | 타겟 크기별 가위 열리는 속도 차이 |
| attribution-data-mismatch | 8 | 분기 1회 '평소 격차 비율' 측정 습관 |
| marketing-budget-allocation | 9 | 예산 회의에서 물어야 할 질문("100만 원 더 받으면?") |
| campaign-saturation-signals | 9 | 증액 전후 주 비교로 한계 CPA 근사(가정 수치) |
| junior-metrics-guide | 9 | 남의 벤치마크로 보고했다 되묻힌 장면 |
| audience-broad-vs-narrow | 10 | 좁은 타겟 '성공해서 무너지는' 수순 |
| ab-testing | 10 | 조기 종료 유혹 → 종료 조건을 문서 약속으로 |
| incrementality-measurement | 10 | 브랜드검색 반발("성과가 가짜냐") 대응 프레임 |
| ad-machine-learning | 11 | 수정→리셋→수정 무한 학습 루프 재구성 |
| correlation-vs-causation | 11 | 성과 보고의 '덕분에'를 '기간에'로 |
| cannibalization-organic-paid | 11 | 오가닉+페이드 합계 그래프 습관 |
| meta-advantage-plus-guide | 12 | AEM 우선순위를 퍼널 순서로 넣는 실수 |
| retargeting-reengagement-guide | 12 | 세그먼트 넷에 소재 하나 돌리는 그림 |
| event-taxonomy-guide | 12 | 리팩토링발 이벤트명 변경 사고 → 팀 간 계약서 |
| postback-integration-guide | 13 | 이중 트래킹이 몇 주 뒤에 발견되는 이유 |
| aha-moment-retention | 13 | 그리드 전에 "서비스가 좋아지는 순간" 질문 |
| hook-3-seconds-framework | 13 | 경쟁사 피드 30분 스크롤로 패턴 틈 찾기 |
| ad-creative-specs-guide | 14 | 실기기 확인을 마지막 관문으로 |
| ai-era-marketer | 14 | 채용 공고에 나타난 무게중심 이동 |

### D. 초안 1편

| 파일 | 처리 |
|---|---|
| adjust-vs-appsflyer | 홀드 유지. 서드파티 소스 → 양사 공식 페이지 대조 후, **14주차 이후** 신규 발행(감속 기조 유지, 주 1편 리듬의 첫 신규 글로). 발행 시 제목에 "요금표에 안 나오는 차이" 류 구체 약속 추가 |

## 3. 리다이렉트·링크 (개발자 전달)

```
/blog/campaign-anomaly-detection  → /blog/ad-performance-drop          (1주차)
/blog/cvr-optimization            → /blog/funnel-dropoff-analysis       (3주차)
/blog/cpi-cpa-cpm-difference      → /blog/performance-marketing-metrics (4주차)
```

- 삭제와 301은 같은 배포에서. EN에는 이 3편 짝이 없어 EN 리다이렉트 불필요.
- 발행 글 내 참조는 batch1에서 수정 완료(ctr-improvement, google-uac-optimization). **용어사전·SOP·CSV 템플릿 페이지**의 참조 여부는 별도 확인 필요.

## 4. EN 처리

- 1~6주차: `en-mirror-patches.md`의 4건을 해당 KR 주차에 동시 반영 (ad-performance-drop, performance-marketing-metrics, marketing-mix-modeling / performance-marketer-skills는 무변경 확인)
- 2차분 23편 중 EN 짝 존재 12편(#7·8·23~34번대)의 경험 블록 EN 반영은 **선택**: KR 반응 확인 후 14주차 이후 일괄 권장. KR/EN 훅·제목은 이미 동일 앵글이라 불일치 리스크 없음
- EN 신규 번역(20편 갭)은 14주차 리뷰에서 재개 여부 결정

## 5. 게이트 (진행/조정 판단 기준)

- **7주차 중간점검**: 1주차 배포분(ad-performance-drop) GSC 검색 CTR이 배포 전 4주 평균 대비 개선 추세인가. 개선 없으면 2차분은 예정대로 진행하되, 8주차 이후 배포분의 훅 문장을 재점검
- **14주차 전체 리뷰**: 제목교체 8편의 CTR·순위 변화 / 통합 필러 3편의 키워드 커버리지 / 이후 우선순위(EN 갭 vs 신규 소재: 구글시트 연동·TikTok·웹커머스) 결정
- 판단 지표 우선순위: ① 검색 CTR(핵심 문제) ② 평균 게재순위 ③ 클릭 절대량

## 6. 매 주차 공통 체크리스트

- [ ] 해당 파일만 머지 (일괄 머지 금지)
- [ ] 빌드 후 슬러그 렌더·frontmatter 파싱 확인
- [ ] 통합 주차: 구 URL이 301 반환 확인
- [ ] GSC 색인 재요청
- [ ] 실제 경험 케이스가 생기면 해당 글의 가정 프레임 블록을 실화로 교체 (교체 시 수정일 자연 갱신)
