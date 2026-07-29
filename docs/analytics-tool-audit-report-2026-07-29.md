# 공개 분석 도구 10개 감사 — 완료 증빙

> 감사일: 2026-07-29
> 범위: 5-18, 5-3, 5-21, 5-2, 5-22, 5-4, 5-23, 5-20, 9-6, 9-1
> 제외: 자동 판단 기록의 IndexedDB 저장. 원본 CSV는 브라우저 밖으로 보내지 않는다.

## 1. 판정 기준과 공통 증빙

각 도구는 **데이터 진입 → 계산 → 결론 → 결과 활용 → 회귀 방어** 순서로 점검했고, 발견한 P0/P1은 도구별 독립 PR에서 수정했다. 같은 입력의 결정론은 순수 수학 테스트로, 빈 화면·데모·매핑·결론 순서는 컴포넌트 스모크로 확인한다.

| 점검 영역 | 공통 증빙 | 결과 |
|---|---|---|
| 빈 화면·데모·CSV·자동 매핑 | `CsvUploader.smoke.test.jsx`, `dataImport.test.js`, `mappingContract.test.js`, 도구별 `*.smoke.test.jsx` | 통과 |
| Google Sheets·XLSX | `googleSheets.test.js`, `xlsxWorkerClient.test.js`, 공개 Sheet 연결은 `CsvUploader` 공통 경로 | 통과 |
| 날짜·중복·NaN·대용량 방어 | `buildDataQualityReport.test.js`, `detectHeaderRow.test.js`, `dataPreparationWorkerClient.test.js`, `xlsxWorkerClient.test.js` | 통과 |
| KR/EN 동등성 | `EnglishToolLocale.smoke.test.jsx`와 각 도구의 locale 카피 | 통과 |
| UX 순서·키보드 기반 제어 | 결과 카드/매핑/버튼 렌더 스모크, semantic `button`·`select` 사용 | 통과 |
| 라이트·다크 및 실제 반응형 픽셀 확인 | 프로젝트 규칙상 자동 스크린샷 루프는 사용하지 않는다. 색은 `CHART_THEME`/CSS 토큰, 반응형은 공용 CSS로 유지한다. 출시 전 브라우저의 실제 화면 확인은 운영자가 수행하는 수동 승인 항목이다. | 자동 증빙 범위 외 |

`npm run test:all` 기준 **138 test files, 848 passed, 1 skipped**이며, 이번 감사의 각 PR은 `npm run lint`, `npm run build`, GitHub validate, Railway 배포를 모두 통과했다. 린트의 MarketingResponse Babel deopt 알림은 오류가 아닌 기존 정보성 경고다.

## 2. 도구별 발견사항·수정·회귀 검증

| 순서 / 도구 | 분류·재현 방법 | 기대값 → 이전 실제값 | 수정 PR·회귀 테스트 | UX/UI·분석 과정·결과 활용 판정 |
|---|---|---|---|---|
| 1. 5-18 마케팅 반응 | **분석 위험**: 비용↓/성과↑, 비용↑/성과↓ 주차와 p25 경계, NaN, always-on/flight 채널을 카니발 판정에 넣음. **오류**: Classic MMM prior와 OOS 입력을 점검. | 방향이 반대인 충분한 신호만 잠식 후보, Classic prior/penalty=0, 미래 주차는 학습 제외 → 작은 노이즈/잘못된 방향·잔존 prior·OOS 혼입 위험. | [#518](https://github.com/noelnme-gondry/MKT_Library/pull/518), `cannibalDirection.test.js`, `MarketingResponse.smoke.test.jsx` | 단계(추세→카니발→MMM→예측)·OOS 악화 수·Classic 건강 진단·KR/EN 카피를 렌더 검증. 관측 신호를 인과로 단정하지 않는다. |
| 2. 5-3 예산 배분 | **오류/분석 위험**: 수동 잠금·자동·그리디 경로에서 모델 래퍼를 직접 호출하고 ROAS를 CPR로 읽음. 관측 범위 밖 수동 예산. | 총배분=예산, 예상 성과가 0이 아니며 ROAS=매출/비용, 범위 밖은 안전 경계 → 수동 경로 성과 0·ROAS 역수·무제한 외삽 위험. | [#519](https://github.com/noelnme-gondry/MKT_Library/pull/519), `budgetAllocTool.test.js`, `BudgetAllocationWizard.smoke.test.jsx` | 총예산·제약·잠금·CPA/ROAS 차트/표/결론 동기화 및 범위 경고를 스모크와 순수 함수로 확인. |
| 3. 5-21 캠페인 성과 변동 | **분석 위험**: 채널/캠페인/소재를 각각 분해하면 roll-up의 Volume+Mix+Rate가 총변화와 달라짐. | 가장 세밀한 grain에서 한 번 분해한 뒤 합산 → 단계별 재분해로 Σ 불일치·동일 소재명 상위 병합 위험. | [#520](https://github.com/noelnme-gondry/MKT_Library/pull/520), `CampaignPvm.smoke.test.jsx` | 총 변화·Top 원인을 먼저 보이고, 채널 기여=캠페인 행 합을 회귀 검증. 결과 비중은 비용 비중이 아님을 UI에 유지. |
| 4. 5-2 운영 대시보드 | **오류**: 0% 리텐션이 falsy로 빠지거나 0분모에서 Infinity/NaN이 노출됨. | 0%는 유효 관측치, 0 모수는 정직하게 보류 → 0% 누락·비정상 수치 위험. | [#521](https://github.com/noelnme-gondry/MKT_Library/pull/521), `runWeightedRetentionTests.test.js` | 가중 리텐션(비율/인원수) SSOT를 KPI와 탭에서 공유한다. 9개 탭의 기본 렌더·필터는 Dashboard/각 탭 smoke로 방어한다. |
| 5. 5-22 캠페인 포화도 | **분석 위험**: 마지막 관측 비용에서 오른쪽(미관측) 차분을 써 한계효율을 추정. | 관측 경계에서는 좌측 미분만 사용, 불명확하면 보류 → 외삽 값으로 포화/여유 오판 위험. | [#522](https://github.com/noelnme-gondry/MKT_Library/pull/522), `satMath.test.js` | CPA/ROAS 토글은 곡선·축·범례까지 함께 전환하고, 관측 범위를 벗어난 추천을 경고한다. |
| 6. 5-4 실험 분석 | **오류/분석 위험**: 분자>분모, control 미지정, 연속값 무분산에서 숫자를 냄. | 유효 arm과 변동 없이는 “추정 불가”, non-significant=무효과 아님 → 첫 행을 control로 가정·거짓 검정값 위험. | [#523](https://github.com/noelnme-gondry/MKT_Library/pull/523), `abTestMath.test.js`, `runMassReadoutTests.test.js`, `AbTestHoldout.smoke.test.jsx` | 설계/판독 분리, 절대 인원·CI·p-value·검정력의 결론 카드 순서를 확인한다. |
| 7. 5-23 증분 분석 | **분석 위험**: DiD의 p-value를 처리군 자체 pre/post 변화로 계산하고 control/test가 모호해도 결론을 냄. | treatment−control 변화의 유의성만 판정, 그룹·날짜가 유효하지 않으면 보류 → 공통 추세를 증분으로 과장할 위험. | [#524](https://github.com/noelnme-gondry/MKT_Library/pull/524), `incrPrePostMath.test.js`, `Incrementality.smoke.test.jsx` | 통제군·신규 On·종료 Off 세 탭의 전제와 음의 증분/비유의 결과를 인과 확정 없이 표시한다. |
| 8. 5-20 핵심 가치 발굴 | **분석 위험/성능**: target을 0/1로 강제하지 않고, 희소 후보를 학습 결과만으로 승자화. | 엄격한 binary target, 상수 target 보류, 후보별 holdout support 미달은 게이트 → 누수·희소 행동 과대평가 위험. | [#525](https://github.com/noelnme-gondry/MKT_Library/pull/525), `ahaMath.test.js` | 매핑 중 계산하지 않고 분석 버튼 뒤에서만 실행한다. 표본·목표 도달·holdout·F1/Lift를 함께 보이며 인과가 아닌 가설로 안내한다. |
| 9. 9-6 소재 분석 | **오류/분석 위험**: 수치적으로 불안정한 역행렬과 첫 행만 보는 campaign 고정효과 판정. | `I×M≈I` 검증 실패 시 추정 불가, 한 행이라도 campaign가 있으면 FWL 적용 → 가짜 계수/SE·고정효과 누락 위험. | [#526](https://github.com/noelnme-gondry/MKT_Library/pull/526), `runCreativeTests.test.js`, `mmmLocale.test.js` | CTR/CVR/CPA·ROAS 경로와 교체/피로 결론을 공유 엔진의 분석 결과에 맞춰 표시한다. 공선/특이행렬은 숫자 대신 보류한다. |
| 10. 9-1 콘텐츠 요소 분석 | **오류/분석 위험/UX**: 0/1 태그가 4개만 노출돼도 회귀 결론이 나고, 빈 태그 행을 조용히 제외하며 “효과”로 읽힘. | present·absent가 각각 5건 이상일 때만 결론, 빈 값은 0으로 추정하지 않고 유효/제외 행 공개, 관측 연관으로 표기 → 희소 태그 과대평가·결측 은폐·인과 오독 위험. | [#527](https://github.com/noelnme-gondry/MKT_Library/pull/527), `ContentElementAnalyzer.smoke.test.jsx` | 1콘텐츠=1행/요소=1수치 열, 중복 태그 사전 통합을 안내한다. 분석 클릭 뒤에만 회귀하고 결론→근거→상세 표 순서를 확인한다. |

## 3. 결과 활용과 도구 간 전달

| 항목 | 확인 결과 |
|---|---|
| 화면·다운로드 일치 | PVM은 동일 finest-grain 결과로 화면/CSV를 만들고, 콘텐츠 요소 CSV는 표의 HC3·BH 열을 그대로 내보낸다. CSV는 BOM+CRLF를 사용한다. |
| PNG/차트 | 공용 차트는 `CHART_THEME`과 `responsive:true`, `maintainAspectRatio:false`를 사용한다. CPA/ROAS가 있는 도구는 데이터·축·범례를 함께 전환한다. |
| 다음 행동 | 모든 수정 도구는 ResultActionCard에서 결론→핵심 수치→다음 실험/예산/교체 행동 순서를 유지한다. |
| grain/매핑 전달 | efficiency(5-2/5-3/5-22)와 creative(5-21/9-6)는 별도 CSV 그룹을 유지한다. PVM은 creative grain만, 장기 LTV/리텐션은 dashboard grain만 읽어 교차 혼입을 막는다. |

## 4. 종료 판정

- 각 도구별 P0/P1 발견 건은 위의 독립 PR #518–#527에서 수정·회귀 테스트로 고정했다.
- 10개 PR 모두 main에 squash merge됐고, 각각 GitHub validate 및 Railway 배포가 성공했다.
- 전체 자동 검증은 `npm run test:all`, `npm run lint`, `npm run build`로 다시 통과했다.
- 시각적 반응형/테마 최종 승인은 프로젝트 운영 규칙에 따라 실제 브라우저에서 운영자가 확인한다. 자동화가 대신 검증한다고 주장하지 않는다.
