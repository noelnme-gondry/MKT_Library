# 실습 유입·파일럿 실행 자료

게시·발송하지 않은 검토용 초안. 실제 고객 관찰이나 성과 수치는 아직 없다. 이 문서를 작성한 것을 유입·리텐션 개선 성과로 세지 않는다.

## 첫 배포 주제: 예산 증액을 보류해야 할 때

목적: 독자가 합성 예제를 따라 해 판단 보류의 이유를 확인하고, 같은 문제를 자기 CSV로 점검한다. 모든 채널은 `/blog/budget-scaling-limit`의 같은 예제로 연결한다. 원고의 계산값·전제는 이 글과 `editorialExamples.test.js`를 정본으로 쓴다.

### 짧은 게시물 초안

KO: “24행이 있어도 광고 예산을 더 올릴 수 있는지 판단하지 못할 수 있습니다. 채널마다 한 번만 관측했다면 지출이 변할 때 성과가 어떻게 달라지는지 알 수 없기 때문입니다. 8일·24행의 합성 CSV를 직접 넣어보고, 어떤 근거가 부족한지 확인해 보세요. 분석은 무료이며 원본은 브라우저에서 처리합니다.”

EN: “A file with 24 rows may still be insufficient for a budget-scaling decision. One observation per channel cannot show how performance changes with spend. Try the synthetic eight-day, 24-row CSV and inspect why the decision is withheld. Analysis is free and source data is processed in your browser.”

### 실습 영상 구성안

1. 문제: 평균 CPA만 보고 증액을 결정할 수 있는가.
2. 파일: 글 상단에서 합성 CSV를 다운로드한다. 실제 고객 성과처럼 소개하지 않는다.
3. 확인: 본문 실습에서 매핑과 원본 통화를 확인하고 결과를 연다.
4. 해석: ‘관측 수·지출 변동 부족’을 읽고, 행 수와 채널별 반복 관측을 구분한다.
5. 다음 행동: 자기 파일에서 동일 채널의 여러 날짜·지출 수준과 전환 집계 기준을 점검한다. 일정 기간을 모으면 반드시 분석 가능하다고 약속하지 않는다.

EN narration outline: average versus marginal CPA → synthetic download → mapping and currency → withheld result → check repeated observations, spend variation and conversion maturity in the real file. No guaranteed estimation period or performance uplift.

### 뉴스레터 초안

제목: “증액 판단을 멈춰야 하는 데이터는 어떤 모습일까요?”

본문: “이번에는 계산 결과보다 판단할 수 없는 이유를 먼저 살펴봅니다. 예제는 8일·24행이지만 채널별 관측이 한 번뿐입니다. 글에서 데모 파일을 받아 중간 실습에 넣어보세요. 이후 실제 파일을 준비할 때는 기간·통화·전환 기준을 맞추고, 같은 채널의 지출 변화를 충분히 관측했는지 확인하세요. 분석을 마쳤다면 다음 검토할 질문과 날짜를 기록해 두세요.”

EN subject: “What does insufficient evidence for scaling look like?”

EN body: “This example starts with why a decision cannot be made. It covers eight days and 24 rows, but each channel appears once. Download the demo file from the article and try its inline exercise. For your own file, align periods, currency and conversion definitions, and check whether the same channels have been observed at different spend levels. After analyzing, record the question and date for your next review.”

실제 발송은 기존 뉴스레터 수신 동의자에 한하며 자동으로 계정 이메일을 구독자로 사용하지 않는다. 채널별 링크에는 공개 캠페인 식별자만 사용한다. 개인·캠페인 데이터는 넣지 않는다. 초안 승인·발송을 이번 코드 반영과 혼동하지 않는다.

## 실제 사용자 과제

모집 대상: 매주 광고 데이터를 직접 내려받고 캠페인 변경을 결정하는 실무자. 고객 사례 공개 동의는 사용성 관찰 동의와 분리한다.

1. 파일 준비 전 시작한다. 실제 광고 계정에서 CSV를 내보내는 과정부터 관찰한다. 원본을 연구자에게 전송하지 않는다.
2. “성과가 왜 바뀌었는지 확인하고 다음 행동을 결정해 주세요”라는 과제만 준다. 특정 버튼을 먼저 알려주지 않는다.
3. 처음 결과를 본 시각, 어떤 결론으로 읽었는지, 판단 보류를 이해했는지 기록한다. 화면을 봤다는 사실과 이해했다는 사실을 구분한다.
4. “다음 검토를 준비해 주세요”라고 요청한다. 기기 저장·계정 저장·알림에서 사용자가 멈추거나 혼동한 위치를 기록한다.
5. 다음 주 새 파일로 같은 프로젝트를 다시 열게 한다. 관찰자가 미리 데이터·매핑을 넣어주지 않는다. 실제 재방문과 관찰 요청에 따른 복귀를 구분한다.
6. 실제 보고서 미리보기·무료 샘플을 확인한 뒤 “업무에 가져갈 부분, 부족한 부분, 지금 구매하지 않는 이유”를 묻는다. 결제 테스트 제한으로 생긴 중단은 상품 거절로 세지 않는다.

기록 양식(빈 상태로 시작): 참여자 가명 / 유입 과제 / 소스 종류 / 파일 준비 시작 / 입력 성공 / 실제 결과 확인 / 결론 이해 확인 / 기기 저장 / 계정 저장 / 다음 파일 재사용 / 중단 위치 / 사용자 발언 / 관찰자 해석. 발언과 해석을 다른 칸에 쓴다. 표본이 없으면 전환율·평균 소요시간을 계산하지 않는다.

## 출시 판단에 쓸 지표

- 검색: GSC 질의×실제 canonical 페이지. 노출·클릭·순위와 분석 도달을 별도 지표로 유지한다. 리다이렉트된 옛 글을 현행 경쟁 페이지로 세지 않는다.
- 첫 사용: 동일 사용자/세션에서 실파일 입력→ready 결과. 데모 완료, 관찰 중간 상태, 준비 실패를 분리한다.
- 저장: 로그인 시작/완료→기기 저장→계정 보관. 계정 초대 제한은 별도 집단으로 분리한다.
- 재사용: 실제 파일을 쓴 활성 사용자 중 다음 관측 기간 파일을 다시 사용한 사람. 단순 페이지 방문·같은 데모 재실행으로 대체하지 않는다.
- 구매: 보고서 미리보기→구매 안내→실제 결제 진행→확정 구매. 테스트 모드에서는 실제 구매 전환율을 만들지 않는다. 재구매는 자동 구독 유지율과 구분한다.
- AEO: `docs/aeo-runs/README.md` 절차에 따라 독립 세션·질문·원문·인용 링크·실행 시각을 보존한다. 자기 제품을 알려준 이 대화의 답변을 독립 검색 노출로 세지 않는다.

공개 사례는 사용자가 공개에 동의한 전후 수치·기간·분모·다른 개입을 함께 적을 수 있을 때만 작성한다. 시간 절약과 CPA 개선을 서로 대신하지 않는다. 유의미한 관측이 없으면 수치를 쓰지 않는다.
