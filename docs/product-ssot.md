# Product SSOT — Growth Opt Playbook

> **지위**: 제품의 **대외 사실·UX 계약·접근성 계약**의 단일 출처(SSOT).
> **작성 근거**: 2026-08-19 외부 검토 4건(Manus)을 코드에 대조해 확정. 대조 결과 틀린 주장은 채택하지 않았고, 확인 못 한 주장은 "확인 필요"로 남겼다.
> **적용 범위**: `growthoptplaybook.com` 전 공개 화면(홈·`/start`·전 분석 도구·대시보드·블로그·가이드·용어사전·비교·공유/다운로드)과 대외 노출물(`llms.txt`·JSON-LD·외부 디렉터리·AI 답변).

---

## 0. 문서 지위와 다른 문서와의 관계

이 문서는 **"무엇을 지켜야 하는가"(계약)** 를 소유한다. **"어떻게 구현하는가"(상세)** 는 기존 문서가 계속 소유한다. 같은 문장을 두 곳에 적지 않는다 — 계약이 바뀌면 여기만 고치고, 상세 문서는 여기를 참조한다.

| 문서 | 소유 범위 | 이 문서와의 관계 |
|---|---|---|
| **`docs/product-ssot.md`(본 문서)** | 대외 사실·한계·도구 카탈로그 정의·UX/접근성 **계약**·품질 게이트·부채 백로그 | 상위 계약. 충돌 시 이 문서가 기준 |
| `AGENTS.md` | 에이전트 작업 규칙·함정·레시피 | 계약을 **집행**. §2·§7·§12에 요약만 두고 상세는 여기 링크 |
| `v2-migration/claude-ux.md` | 비전문 유저용 결론·흐름·평어 문구 원칙 | 본 문서 §5의 상세 |
| `docs/frontend-tool-design-guide.md` | 레이아웃·토큰·컴포넌트 시각 명세(1,549줄) | 본 문서 §6·§7의 상세 |
| `docs/aao-geo-operating-model.md` | 블로그 발행 계약·월간 측정 루프 | 본 문서 §2·§12의 상세 |
| `src/lib/brandFacts.js` | 코드에서 읽는 브랜드 사실 문자열 | **본 문서 §2가 정본, 코드가 사본**. 문구 변경은 여기 먼저 |
| `src/lib/routeSeo.js` | 도구별 제목·설명·URL | **코드가 정본**. §4 표는 대외 축약 설명일 뿐 |

**충돌 처리 규칙**: 실제 컴포넌트 동작과 이 문서가 다르면, 사용자가 겪는 동작을 *사실*로 인정한다. 다만 그 동작이 본 문서의 필수 기준에 못 미치면 **문서를 낮추지 않고 제품을 고치는 항목을 §10에 올린다.**

---

## 1. 제품 정의 SSOT

### 1.1 확정 사항

| 항목 | 확정값 | 근거 |
|---|---|---|
| 대외 제품명 | **Growth Opt Playbook** | 코드·도메인·외부 프로필 실사용 80곳. `Growth Optimization Playbook`은 2곳뿐(§10 D-02에서 정리) |
| 한국어 표기 | **Growth Opt Playbook**(원문 유지) | "그로스 최적화 플레이북"은 **설명 문구로만** 사용. 제품명 자리에 쓰지 않는다 |
| 공식 도메인 | `https://growthoptplaybook.com` | `routeMap.js` `SITE_URL` |
| 제품 범주 | 앱·웹 퍼포먼스 마케팅용 **브라우저 기반 분석·의사결정 지원 도구** | — |
| 도구 수 표기 | **"20개 분석 도구"** | `getPublishedToolCount()` 파생값. 5-18 안의 분석 다섯이 개별 도구로 승격되고 허브(5-18) 자체가 목록에서 내려간 뒤, 5-28 핵심 액션 생존·이탈 분석과 5-29 구성 변화 분석이 공개 도구로 추가됐다(§4.1). 이 표와 라우트의 정합은 `src/lib/productSsotCatalog.test.js`가 강제한다. |

**도구 수를 손으로 세지 말 것.** 화면 카피는 `PUBLISHED_TOOL_IDS`(`lib/toolIndex.js`)에서 파생한다(현재 `LandingPage.jsx`의 `T.questionDeck(PUBLISHED_TOOL_IDS.length)`). `brandFacts.getPublishedToolCount()`는 같은 수를 계산하는 두 번째 경로이므로 이제 그것을 재노출한다 — 세는 곳은 하나다. 이 수는 제품 구조가 바뀌면 함께 바뀐다 — 실제로 2026-08-19 하루 사이에 14에서 18이 됐다. **문서·커밋·외부 프로필에 수를 적을 때는 그 시점의 파생값을 확인하고 적는다.**

### 1.1a 라이브러리 홈과 공용 탐색 (2026-09-09 승인)

- KO/EN 공용 서체: 제목은 로컬 Pretendard(대표 제목 800, 섹션·카드 700), 본문·조작 UI는 Wanted Sans, 코드용 고정폭 서체는 기존 역할을 유지한다. 홈·분석·주간 리뷰·블로그·SOP·구독에서 같은 제목 위계를 사용한다.
- KO 홈 제목: “성과는 왜 바뀌었고, 다음엔 뭘 해야 할까?” / EN: “Why did it change? What should you do next?”
- 홈 설명: “실무 가이드로 기준을 잡고, 내 데이터로 확인하세요. 성과 분석부터 다음 주의 판단까지 한곳에서 이어갑니다.” / EN: “Build your baseline with practical guides and check your data. Connect performance analysis to next week’s decisions in one place.”
- CSV가 있는 방문자는 “CSV로 가능한 분석 한 번에”, 파일이 없는 방문자는 “질문에서 시작하기” 또는 샘플 체험으로 진입한다. 가능한 기본 분석을 묶어 실행하며 모든 분석의 무조건 실행을 약속하지 않는다.
- 블로그·실무 가이드(SOP)·통합 결과·주간 리뷰·프로젝트·저장 관리·구독은 공용 사이드바에서 도달 가능해야 한다. 기존 도구와 자료의 전체 목록, 언어·테마·검색·복원·다운로드 기능을 보존한다.
- 도치 인사 안내는 데이터 준비 영역에서 요청해 열 수 있게 하며 홈을 자동으로 가리지 않는다. 업로드·매핑·실행 게이트와 동일 데이터 전달 계약은 그대로 유지한다.
- EN has equivalent CSV, question and sample entry points, persistent content/workspace navigation and on-demand Dochi help. Existing data gates, storage, settings and exports remain available.

### 1.2 승인 소개문 (그대로 복사해 사용)

판매자 표시 정보(2026-09-09 사용자 제공): 상호 공드리공작소 · 대표자 신기훈 · 사업자등록번호 856-07-03210 · 주소 용두동 39-463 · 고객센터 010-8829-9034 · 이메일 gondry.montauk@gmail.com. 주소는 사용자가 승인한 범위만 표시하며 시·구 등 누락 정보와 사업자등록증 일치 여부는 미확인이다. 통신판매업 신고번호는 미제공이며 임의 생성하지 않는다. KO/EN 모두 법적 이름과 주소 원문을 보존한다. 코드 사본은 `src/lib/sellerFacts.js`가 소유한다.

**25단어 이하**

| 언어 | 승인 문구 |
|---|---|
| KO | 캠페인 CSV 분석부터 결정 기록과 다음 주 결과 검토까지 이어가는 무료 마케팅 워크스페이스입니다. |
| EN | A free marketing workspace connecting campaign CSV analysis, saved decisions, and next-week outcome reviews. |

**60~80단어**

| 언어 | 승인 문구 |
|---|---|
| KO | Growth Opt Playbook은 주간 성과를 점검하고 예산·소재·채널·실험의 다음 행동을 정하려는 앱·웹 퍼포먼스 마케터를 위한 무료 브라우저 기반 도구입니다. 가입 없이 CSV를 올려 가능한 분석을 확인하고, 성과 변동·포화·예산 배분·소재 피로도·A/B 테스트·증분성·마케팅 반응을 검토할 수 있습니다. 원본 행은 서버에 저장하지 않으며, 결과에는 적용 조건과 해석 한계를 함께 표시합니다. |
| EN | Growth Opt Playbook is a free browser-based toolset for app and web performance marketers making weekly decisions about budgets, creatives, channels, and experiments. Without signup, users can upload a CSV, see which analyses fit their data, and explore performance variance, saturation, allocation, creative fatigue, A/B tests, incrementality, and marketing response. Source rows are not stored on a server, and outputs are presented with their applicable conditions and limitations. |

---

## 2. 제품 사실 카드 (F)

**`조건·한계` 열을 만족하지 못하는 주장은 공개하지 않는다.** 이 표가 `src/lib/brandFacts.js`의 정본이다.

| ID | 승인 문구 (KO) | 조건·근거·금지 확장 | 코드 상태 |
|---|---|---|---|
| F-01 | 모든 분석 도구는 무료입니다. | 분석 실행·프로젝트 1개 무료. 분석 결과 다운로드는 5,900원 1개월 이용권 대상. 프로젝트 백업은 무료 유지. "영구 무료"는 쓰지 않는다. | ✅ `BRAND_FACTS.price` 일치 |
| F-02 | 분석은 가입이나 로그인 없이 시작합니다. | 계정 없이 CSV 분석 가능. 계정 보관을 이용할 때 로그인한다. 공개 Google Sheets 접근은 **공개 URL 전제**이며 광고 계정 연동을 뜻하지 않는다. | `account` 일치 |
| F-03 | 업로드한 CSV는 브라우저에서 처리됩니다. | 파싱·계산이 클라이언트에서 실행되고 원본 행을 서버로 전송·저장하지 않는다는 의미. 브라우저 확장·사용자 네트워크·외부 공개 URL까지 포괄하는 절대 보안 주장은 하지 않는다. | ✅ 2026-08-19 완화 적용(D-03) |
| F-04 | 원본 파일은 이 기기에서 처리·보관합니다. | 원본 파일은 서버로 보내지 않는다. 기기 저장본은 마지막 사용 후 90일 만료 대상이다. §5.1.3에 따라 계정 보관을 제공할 때 사용자가 선택한 결정 메모만 별도로 서버에 저장하며 직접 삭제할 수 있다. | `persistence` 일치 |
| F-05 | 같은 입력은 같은 결과를 재현하도록 설계되었습니다. | `Math.random` 미사용·고정 격자 수치계산(§8 결정론). 브라우저·제품 버전이 달라도 항상 동일하다고 과장하지 않는다. | ✅ `determinism` 일치 |
| F-06 | **추정 결과는 불확실성과 함께 해석해야 합니다.** | 신뢰구간·식별 실패 사유를 함께 보여주는 것이 원칙. **"모든 숫자에 95% CI가 있다"는 보편 문장은 금지** — PVM 분해·Aha 그리드·ASA 키워드처럼 CI가 정의되지 않는 출력이 있다. | ✅ 2026-08-19 조건부로 교체(D-01) + `compareContent.test.js` 가드 |
| F-07 | 한국어와 영어 공개 경로를 제공합니다. | 도구별 EN 완결성은 `EN_READY_TOOL_IDS`가 게이트한다. "완전히 동등한 두 언어 경험"은 검증 전 사용 금지. | ✅ `locale` 일치(문구 보수적 유지) |
| F-08 | 광고 계정에 직접 연결하지 않습니다. | 매체 export CSV 업로드 방식. 실시간 API 동기화·자동 갱신·다계정 권한 관리 없음. | ✅ `BRAND_LIMITS.integration` 일치 |

### 2.1 주간 리뷰 V1 계약 (2026-09-09)

- 요금제 표시 이름은 Free(무료) / Pro이며, Pro는 기존 5,900원 1개월 보고서 이용권의 표시명이다. 새로운 등급·자동 갱신 상품을 추가한 것이 아니다. 무료와 Pro는 분석 실행·결정 기록·프로젝트 백업을 공유하며, Pro에 보고서 다운로드·여러 프로젝트·일괄 보고서·브랜딩이 추가된다. 저장 한도는 두 플랜에 동일하게 적용한다. 화면의 파일 구성 예시는 실제 분석 결과나 고객 사용 실적으로 표시하지 않는다.

- 환불정책(사용자 확정): 자동 갱신 없는 5,900원 1개월 이용권. 결제 후 7일 이내 사용 여부와 관계없이 전액 환불, 이후 미사용 기간 일할 환불, 위약금·결제 수수료 차감 없음. 환불 요청일을 미사용일에 포함하고 실제 결제액×남은 일수÷전체 이용 일수로 계산해 원 미만 올림. 접수일 기준으로 계산하며 처리 지연일을 사용일로 추가하지 않는다. 요청 후 3영업일 이내 환급 처리 및 원 결제수단 취소 요청. 법정 청약철회·하자 관련 권리를 제한하지 않는다. `/subscription#refund-policy`와 EN 대칭 경로에 접히지 않는 전문을 두고 이용약관에서 연결한다. 문의 페이지의 기존 이메일 경로를 사용하며 CSV·카드번호 전체·비밀번호는 요구하지 않는다. 상품·환불 조건을 먼저 설명하되 실제 결제 기능이 없는 관심 버튼을 결제 버튼으로 표시하지 않는다.
- 무료 분석 실행은 유지한다. 2026-09-09 사용자 요청으로 분석 결과 다운로드를 5,900원 1개월 이용권으로 전환한다. 자동 갱신은 없다. Word·Excel, 여러 프로젝트·일괄 보고서·브랜딩이 유료 범위다. 라이브 결제는 상점 설정과 결제 검증이 끝난 경우에만 활성화한다.
- CSV 업로드·분석 실행 → 기간과 KPI 확인 → 지난 결정 검토 → 사용자가 다음 결정 저장 → 보고서 복사/인쇄 → 다음 기간 CSV로 재검토한다. 무료로 새 프로젝트 1개를 만들 수 있으며 프로젝트마다 파일·집계·결정을 분리한다. 기존 프로젝트 열기·내보내기는 권한 만료로 회수하지 않는다. CSV·프로젝트 전체의 서버 동기화는 없다. 선택한 결정 메모의 계정 보관은 §5.1.3의 별도 활성화 조건을 따른다.
- 기본 비교는 데이터 최대 날짜까지의 ISO 주와 전주 같은 요일이다. 저장한 집계는 시작·종료일과 통화가 일치할 때만 비교에 재사용한다. 주간 합계를 일별로 잘라 추정하지 않는다. 기간 길이가 다르면 화면과 보고서에 경고하고 결정 자동 판정을 보류한다.
- 기기 저장이 켜지면 캠페인별 집계·프로젝트 설정을 기존 IndexedDB에 보관한다. 90일 만료 항목은 다음 저장소 접근 때 삭제하며, 저장소의 전체 삭제에 포함한다. 저장 실패 시 다음에는 두 기간 CSV가 필요함을 알린다. 원본 파일 보관은 기존 F-04 계약을 따른다.
- 5%·z 1.5·30전환(2일 이하 60)은 잠정 운영 기준이다. 통계적 유의성·동등성·인과효과 검정이 아니다. 변동성 이력이 부족하면 그 사실을 표시하며, 유지 목표는 사전 동등성 범위 없이 성공으로 판정하지 않는다.
- KO 승인: “설정한 확인 기준을 넘는 변화가 없습니다. 성과 동등성이나 효과 없음을 뜻하지 않습니다.” EN 승인: “No change crossed the configured review thresholds. This does not establish equivalence or no effect.”
- 과거 결정의 기준 기간·통화·전환 기준이 현재 비교와 다르면 판정 보류한다. CPA 산술 분해의 믹스는 **결과 비중**이며 비용 비중이나 인과 원인으로 바꿔 설명하지 않는다. 보고서에는 실제 저장한 결정만 포함한다.
- 공개 진단 글의 KO/EN CTA는 주간 리뷰로 연결할 수 있다. 집계 이벤트는 진입·업로드·매핑·분석 완료/차단·저장·복사/인쇄·비교 데이터 출처와 소요 시간 구간만 전달하며 파일명·캠페인명·프로젝트명·실제 지표값은 보내지 않는다.
- 주간 리뷰의 프로젝트 기준·목표 차이·캠페인 비교는 같은 집계를 사용한다. KPI 또는 전환 기준을 바꿀 때 기존 목표를 새 지표의 목표로 재해석하지 않는다. KO: “목표와의 관측 차이이며, 절감 가능액이나 인과효과의 추정이 아닙니다.” EN: “This is an observed gap to your target, not an estimate of savings or causal impact.”
- 도치에서 이미 확인한 캠페인 데이터를 주간 리뷰로 넘길 수 있다. 캠페인 비교표와 팀 공유 보고서는 사용자가 선택한 KPI·통화·기간 및 저장한 결정을 반영한다. 비교 불가·새 캠페인·이번 기간 관측 없음은 각각 표시하며 미관측을 0으로 채우지 않는다.
- 도치는 첫 분석의 준비를 돕고, 주간 리뷰는 비교→결정 기록→다음 데이터로 재검토하는 반복 흐름이다. 홈의 두 진입점을 함께 노출한다. 리뷰는 공통 본문 여백·작업 표면·버튼 스타일을 사용하고 업로드 안내에 대시보드 전용 결과를 약속하지 않는다.
- ‘유지’ 목표는 동등성 범위가 없으므로 저장 전에 자동 판정 불가를 안내한다. 판정 불가여도 계산 가능한 가드레일 관측은 보존한다. CPA 표시의 유효성은 비용이 아니라 전환 분모로 판별한다.

## 3. 제품 한계 카드 (L)

면책이 아니라 **AI 답변·외부 채널이 제품을 과장하지 않게 하는 SSOT**다. 도구 추천과 **같은 문단 또는 바로 다음 문단**에 노출한다.

| ID | 승인 한계 문구 | 사용 규칙 |
|---|---|---|
| L-01 | 회귀 결과는 연관을 보여줄 뿐, 무작위 배정이나 적절한 준실험 설계 없이는 인과를 증명하지 않습니다. | "광고 효과의 원인을 확정한다"고 쓰지 않는다. |
| L-02 | 통계적으로 유의하지 않은 결과가 "효과 없음"을 뜻하지는 않습니다. | 표본 부족·변동성·짧은 관찰 기간 가능성을 함께 설명한다(§8 입증책임 비대칭). |
| L-03 | 채널 지출이 심하게 공선이면 채널별 기여를 신뢰성 있게 분리할 수 없습니다. | 식별 실패 시 추정치를 꾸미지 않고 판단 보류와 사유를 먼저 말한다. |
| L-04 | 예산 배분·예측은 과거 관측 기반 시뮬레이션이지 미래 성과 보장이 아닙니다. | 전액 즉시 적용을 권하지 않고 작은 단계 검증을 권한다. |
| L-05 | 어트리뷰션 기준의 품질이 결과 해석을 좌우합니다. | 서로 다른 매체 기준을 자동으로 '단일 진실'로 통합하지 않는다. |
| L-06 | Growth Opt Playbook은 어트리뷰션 플랫폼이나 실시간 광고 운영 시스템이 아닙니다. | 특정 상용 제품의 "대체재"라고 쓰지 않는다. "CSV 기반 통계적 의사결정 지원 레이어"로 설명한다. |

L-02 보조 설명(KO): 표본 부족·변동성·짧은 관찰 기간으로 탐지하지 못할 수 있으며, 유의하지 않다는 사실만으로 효과 없음을 증명하지 않습니다.

L-02 detail(EN): Limited samples, variability, or short observation windows can prevent detection; a non-significant result does not prove the absence of an effect.

### 분석 실행 전 점검 (2026-09-08)

- KO: 입력 품질 통과는 설계·인과·모델 건강 검증을 뜻하지 않습니다. 관측 단위와 모형이 도구 전용이면 상세 화면에서 확인한 뒤 분석합니다.
- EN: Passing input checks does not validate design, causality, or model health. Confirm tool-specific observation units and models in the detailed tool.
- SRM은 중복 없는 배정 단위와 사전 계획 비율을 사용한 두 집단 Pearson 점검이다. 기대 빈도 5 미만은 보류하고 경고 기준 p<0.001을 공개한다. 경고 없음이 설계 전체의 합격은 아니다. / SRM uses distinct assigned units and a preplanned two-arm allocation; expected counts below 5 are insufficient. The disclosed alarm threshold is p<0.001. No alarm does not validate the entire design.
- 선택 동등성은 사전 선언한 ±%p 범위와 대표본 90% 구간으로만 판독한다. 양 집단 성공·실패 각각 10건 미만이면 근사 판정을 보류한다. 효과 0의 증명이나 결과를 본 뒤 정하는 허용 범위로 사용하지 않는다. / Optional equivalence compares a predeclared ±percentage-point margin with a large-sample 90% interval, requiring at least 10 successes and failures per arm. It does not prove zero effect; margins must not be selected after reading outcomes.

### 3.1 AI 답변·외부 프로필 표현 규칙

분석 품질 표시 추가 계약(2026-09-08):
- ASO 분해값의 단위는 설치당 조회 수이며 CVR의 %p가 아니다. 비중은 설치 기준이다. 믹스/효율 분류는 변화 방향이나 인과 판정이 아니며, flat은 산술 변화 0이지 통계적 무효과가 아니다. 노출·조회·다운로드 집계 비율은 동일 사용자의 순차 전환 확률이나 Apple 공식 전환율과 구분해 화면·CSV·워크북에 고지한다. / ASO decomposition effects use views per install, not CVR percentage points; shares use installs. Mix/efficiency classification establishes neither direction nor causality, and flat means zero arithmetic change, not statistical equivalence. Distinguish aggregate ratios from linked-user transition probabilities and Apple’s official conversion rate in UI, CSV and workbooks.
- 추세·유입 변화맵·잠식 진단은 추적/어트리뷰션 기준·계절성/프로모션·광고 중단/예산 전환을 입력자가 확인한다. 미확인 또는 변경된 조건은 패턴만 표시하고 운영 행동 초안을 보류한다. 같은 집계는 실제 유료 증가와 단순 분류 변경 모두에서 나올 수 있으므로 확인된 선언도 인과효과 식별이 아니다. 입력·분석 범위 변경 시 초기화하고 워크북에 선언을 남긴다. / Trend, paid/organic movement and cannibalization analyses request tracking, seasonality/promotion and delivery/budget-change declarations. Unknown or changed conditions withhold operating drafts while keeping descriptive patterns. Identical totals can come from paid growth or reclassification; declarations do not identify causality. Reset on input/scope changes and preserve them in workbooks.
- 생존 분석의 관측 성숙도 근거는 선택 horizon까지 관측된 에피소드, 그 전 확인된 이탈, 그 전 중도절단, 아직 관측 진입 전인 에피소드를 구분한다. 조기 이탈은 결과가 확인된 사례이며 조기 중도절단 이후 결과는 알 수 없다. 전체·세그먼트별 같은 집계를 결론·CSV·워크북에 남기며 이를 미래 성숙도 예측으로 부르지 않는다. / Survival follow-up evidence separates episodes observed through the horizon, earlier observed exits, earlier censoring, and delayed entries after the horizon. Early exits are known outcomes; post-censoring outcomes are unknown. Preserve the same overall and segment counts in the conclusion, CSV and workbook; this is not a prediction of future maturity.
- 추천은 1차 후보이며 상세 입력 품질 검사 전에는 미검사라고 표시한다. 사용자가 확인을 요청하면 실행 직전과 같은 검사를 수행해 모든 차단·주의 사유를 보여준다. 입력·매핑 변경 시 확인 결과를 초기화하며, 실행 결과와 다운로드에도 같은 주의사항을 보존한다. / Recommendations are initial candidates; detailed quality is unreviewed until requested. The same execution preflight exposes all blockers and cautions. Input or mapping changes reset the review; executed results and downloads retain the cautions.
- 증분·브랜드 분석은 배정/관측 단위, 비교 설계, 사전 기간·중단 규칙, 추적 정책·프로모션·계절성 등의 동시 변경을 입력자가 확인한다. 집계 이항 홀드아웃의 행동 판단에는 무작위 사람/기기 배정과 전체 기간 중복 없는 단위 수 선언이 추가로 필요하다. 미확인·오염·집단 단위는 행동 보류이며 선언 자체를 인과 검증으로 부르지 않는다. 데이터·선택 범위가 바뀌면 선언을 초기화하고 내보내기에 남긴다. / Incrementality and brand analyses request declarations of unit, design, preplanned window/stopping, and concurrent tracking/promotion/seasonality changes. Aggregate binomial holdout actions additionally require randomized person/device units and unique full-window counts. Unknown, contaminated, or clustered designs withhold action; declarations are not causal verification. Reset on data/scope changes and preserve declarations in exports.
- 기간 민감도는 선택 날짜를 겹치지 않는 전·후반으로 나눠 명시 실행한다. 예산은 같은 총예산·모형 설정을 사용한다. 각 대상/기간 최소 4개 유효 관측과 공통 지출 범위를 요구하며 채널 누락·제약 실패는 비교 불가다. 방향 유지는 인과효과나 미래 안정성이 아니다. 화면과 별도 근거 CSV에 같은 기간·판정·관측 범위를 기록한다. / Period sensitivity explicitly reruns non-overlapping chronological halves using the same budget and model settings. Each entity/half needs four usable observations and overlapping spend ranges; missing channels or failed constraints are not comparable. Matching directions do not establish causality or future stability. UI and evidence CSV share periods, directions, and observed ranges.
- 공통 분석 범위 증거는 결론 계산에 실제 사용한 기간·행/셀 수·분모·통화·필터를 표시한다. 전처리 입력의 빈 값/비정상 값 비율과 원본 파일 전체 품질을 구분한다. 집계에서 복원할 수 없는 범위 결측률은 미집계로 표시하며 0으로 만들지 않는다. / Shared scope evidence reports the periods, row/cell counts, denominators, currency, and filters actually used for the conclusion. Missing or invalid values in preprocessed inputs are distinct from whole-file quality. Missingness that cannot be recovered from aggregates is unmeasured, not zero.
- 소재 피로 비율은 기존 노출 기준과 관측 기간을 충족한 소재만 분모에 포함한다. 해당 소재가 없으면 판단 보류이며, 낮은 노출·기간 부족을 건강함으로 표현하지 않는다. 운영 노출 기준은 통계적 유의성 기준이 아니다. / Creative fatigue shares include only items meeting the existing exposure and history criteria. No eligible items means withheld; low exposure or short history is not a healthy verdict. The exposure heuristic is not a significance threshold.
- 반복 단위를 선언한 콘텐츠 데이터는 행 무작위 교차검증의 예측 승자를 표시하지 않는다. 단위별 분리 검증이 필요하며 혼합모형 적합 자체가 이를 대신하지 않는다. / Content data with declared repeated units must not receive a predictive winner from random row validation. Validation must separate units; fitting a mixed model does not substitute for that check.
- KO: ASA는 보고 기간의 전환 성숙도를 확인하지 않으면 조치를 보류한다. 일별 합계로 지연 분포를 추정하지 않는다. Aha는 행동 관측 종료가 선언한 전환 평가 시작보다 이른 열만 개입 후보에 사용하며, 헤더로 실제 이벤트 시점을 검증했다고 주장하지 않는다. MMM의 예산 권고에는 기존 식별·시간순 검증·모델 건강도 실패를 함께 반영한다.
- EN: ASA holds actions when reporting-period conversion maturity is unconfirmed; daily totals cannot recover a delay distribution. Aha intervention candidates require behavior windows ending before the declared outcome start; headers do not verify actual event timing. MMM budget recommendations incorporate existing identification, time-ordered validation, and model-health failures.
- KR: 콘텐츠 예측 비교는 반복 단위 선언 시 단위가 겹치지 않는 검증을 사용한다. 날짜 선언 시 앞 80% 날짜로 학습하고 뒤 20% 날짜에서 비교하며, 반복 단위를 함께 선언하면 검증 단위의 과거 행을 학습에서 제외한다. 분리 후 표본이 부족하면 보류한다. 날짜를 선언하지 않은 검증은 미래 성과 검증이 아니다. 소재 분석은 같은 소재 ID를 1행으로 합치지만 서로 다른 ID의 독립성까지 확인한 것은 아니다.
- EN: Content predictive comparison separates declared repeated units across validation folds. A declared date uses the first 80% of dates for training and the last 20% for validation; with repeated units, past rows of validation units are excluded from training. Insufficient remaining support is held. Validation without dates does not validate future performance. Creative analysis aggregates each creative ID into one row but cannot verify independence across different IDs.
- KR: MMM은 같은 시간순 검증 구간의 마지막 관측값 기준선보다 오차가 낮은지도 확인한다. 구간을 복원할 수 없으면 비교 미확인으로 보류한다. 학습 구간의 90% 참고범위 포함률은 미래 구간 커버리지 검증이 아니며, 독립된 미래 포함률을 측정하지 않았다면 미실측으로 표시한다.
- EN: MMM also checks whether error is lower than a last-observation baseline on the same time-ordered validation windows. Unrecoverable windows leave the comparison unconfirmed and the decision held. Training coverage of a 90% reference range does not validate future coverage; independent future coverage is reported as unmeasured when unavailable.
- KR: VIF 엔진이 반환한 계산 불가는 수학적 무한대로 바꾸지 않는다. 화면·CSV·워크북에 해당 채널과 계산 불가 상태를 남기며, 빈칸을 0으로 읽어 경고가 해제되는 수식을 사용하지 않는다.
- EN: An uncomputed VIF is not mathematical infinity. The screen, CSV, and workbook preserve each affected channel and its uncomputed status; blank-to-zero formulas must not clear a warning.
- KR: 예산 배분·소재 분석은 업로드만으로 계산하지 않는다. 매핑을 확인하고 분석하기를 눌러야 결과를 계산하며, 입력 변경으로 기존 분석이 무효화되면 결과를 닫고 재확인을 기다린다.
- EN: Budget allocation and creative analysis do not calculate on upload alone. Confirm mapping and run Analyze to calculate results; input changes that invalidate the analysis close the results until reconfirmed.
- 글→도구 퍼널은 GA 사용 가능 시 실제 CTA 클릭의 공개 slug·유형·언어·대상 도구만 세션 저장소에 30분 보관한다. 같은 도구·언어의 업로드/결과 이벤트에만 연결하며 CSV·파일명·헤더·쿼리를 보관하거나 전송하지 않는다. / The editorial funnel keeps only a clicked public slug, content type, locale, and target tool in session storage for 30 minutes when GA is available. Attribution requires the same tool and locale; CSV, filenames, headers, and queries are excluded.

| 분류 | 표현 | 규칙 |
|---|---|---|
| 허용 | "무료 브라우저 기반 마케팅 분석 도구" | F-01~F-03 충족 시 |
| 허용 | "CSV로 예산·소재·실험·증분성 분석을 지원" | 도구 URL 또는 §4 카탈로그와 함께 |
| 조건부 | "95% 신뢰구간을 표시한다" | **해당 도구·출력에서 실제로 표시될 때만.** 제품 전체 일반화 금지 |
| 조건부 | "한국어와 영어 지원" | 해당 도구가 `EN_READY_TOOL_IDS`에 있을 때만 |
| 금지 | "AI가 광고를 자동 최적화한다" | 자동 집행 기능 없음 |
| 금지 | "광고 계정 데이터를 실시간 통합한다" | 제품 범위 밖 |
| 금지 | "모든 채널의 진짜 기여도를 정확히 계산한다" | L-03·L-05 무시 |
| 금지 | "추천을 따르면 ROAS가 오른다" | 성과 보장 |
| 금지 | "개인정보를 절대 다루지 않는다" | 사용자 CSV 내용을 일반화할 수 없음 |

---

## 4. 도구 카탈로그 정의

**정본은 `routeSeo.js`이고 이 표는 대외 축약 설명이다.** 이름·설명을 여기서 새로 만들지 않는다(§7 "목록을 두 곳에 나열하지 말고 파생시켜라").

### 4.1 도구 수의 정의

```
공개 분석 도구 = ROUTES 중 id가 5-/9- 이면서 publication ∉ {subtool, preview}
                 → 2026-09-01 기준 20개 (5-29 구성 변화 분석 추가)
subtool  = 사이드바·목록에서 숨기되 검색 랜딩은 갖는 라우트 (현재 5-18 허브 하나)
preview  = 미완성이라 어느 쪽에도 세지 않는다 (9-2·9-3·9-7)
```

**PR #696으로 관계가 뒤집혔다.** 이전에는 5-18(마케팅 반응 분석)이 정식 도구이고 그 아래 다섯 분석이 subtool이었다. 지금은 다섯 분석이 각각 정식 도구이고 **5-18 허브가 subtool**이다 — 사용자가 찾는 단위가 "마케팅 반응 분석"이 아니라 "잠식 진단"·"MMM 기여도"이기 때문이다. 내부 id(`5-18-*`)는 §4.1 규칙대로 불변이다.

### 4.2 공개 분석 도구 20개

| ID | 도구 | URL |
|---|---|---|
| 5-2 | 마케팅 운영 대시보드 | `/dashboard` |
| 5-3 | 예산 배분 시뮬레이터 | `/tools/budget-allocation` |
| 5-21 | 캠페인 성과 변동 분석 | `/tools/campaign-variance` |
| 5-22 | 캠페인 포화도 진단 | `/tools/campaign-saturation` |
| 5-4 | A/B 테스트 분석 | `/tools/experiment-analysis` |
| 5-18-paid-organic | Paid·Organic 변화맵 | `/tools/paid-organic-trend` |
| 5-18-trend | 마케팅 추세 분석 | `/tools/marketing-trend` |
| 5-18-cannibal | 유료·오가닉 잠식 진단 | `/tools/cannibalization-diagnosis` |
| 5-18-mmm | MMM 기여도 분석 | `/tools/mmm-contribution` |
| 5-18-forecast | 마케팅 회귀 예측 | `/tools/marketing-forecast` |
| 5-20 | 핵심 가치(Aha) 발굴 | `/tools/aha-moment` |
| 5-23 | 증분 효과 분석 | `/tools/incrementality` |
| 5-24 | 브랜드 캠페인 증분 분석 | `/tools/brand-campaign-incrementality` |
| 5-25 | VIF 다중공선성 진단 | `/tools/vif-multicollinearity` |
| 5-26 | ASA 키워드·CPT 진단 | `/tools/asa-keyword-finder` |
| 5-27 | ASO 스토어 전환 분석 | `/tools/aso-store-conversion` |
| 5-28 | 핵심 액션 생존·이탈 분석 | `/tools/subscription-survival` (기존 URL 유지) |
| 5-29 | 구성 변화 분석 | `/tools/segment-composition-change` |
| 9-1 | 콘텐츠 요소 분석 | `/content/element-analysis` |
| 9-6 | 광고 소재 피로도 분석 | `/content/freshness` |

### 4.3 목록에서 내린 허브 (5-18)

| ID | 라우트 | 상태 |
|---|---|---|
| 5-18 | `/tools/marketing-response` | `publication: "subtool"` — 사이드바·도구 인덱스에서 숨기되 검색 랜딩과 canonical은 유지한다. 위 다섯 도구가 공유하는 CSV·매핑 허브이고, 각 도구는 `<MarketingResponse initialStage=… isolated />`로 렌더된다. |

> **routeMap의 `component`는 파일 이름이 아닐 수 있다.** `5-18-trend`의 `component`는 `MarketingResponseTrend`지만 그런 파일은 없고, 실제 디스패치는 `PageClient`가 `routeId`로 한다. 컴포넌트 파일을 라우트에서 찾는 도구·테스트는 이 사실을 알아야 한다(`ds/downloadEscape.test.js`가 디스패치에서 파생한다).

## 5. UX 계약

### 5.1 한 화면, 한 결정

제품이 제공하는 선택지는 많아도 **한 화면에서 사용자가 내려야 하는 결정은 하나**다. 첫 방문자에게 선명해야 하는 것은 'CSV를 올린다' 또는 '문제를 진단한다' 중 하나이며, 라이브러리·테마·설정·전체 도구 인덱스는 그 행동과 경쟁하지 않는다.

### 5.1.1 홈 진입과 도구 탐색

홈 소개는 유지하고, 주 행동은 **내 데이터로 분석 시작 / Start with my data**다. 도치 업로드는 이 행동 또는 `#dochi-upload` 직접 진입 때 펼친다. 접어도 진행 중인 작업은 유지한다. 보조 행동은 **데모로 먼저 보기 / Try a demo**이며, 저장된 결정이 있으면 상단에서 **주간 리뷰 이어가기 / Continue weekly review**로 연결한다.

**직접 도구 찾기 / Find a tool**는 목적 세 개만 먼저 보여주고 선택한 목적의 도구 이름과 질문 한 줄을 펼친다. **전체 도구 보기 / View all tools**로 모든 발행 도구에 도달할 수 있다. 도구 목록은 `toolIndex`에서 파생한다.

| 목적 | EN | 설명 KO / EN |
|---|---|---|
| 성과 변화 확인 | Understand performance changes | 비용·전환·유입의 변화 살펴보기 / Inspect changes in cost, conversions, and traffic |
| 예산·효과 판단 | Plan budgets and evaluate effects | 예산 배분·실험·채널 기여도 검토하기 / Review allocation, experiments, and channel contribution |
| 소재·스토어 개선 | Improve creative and app discovery | 소재·콘텐츠·앱 유입의 개선점 찾기 / Explore creative, content, and app discovery |

신규 방문자에게 주간 리뷰는 **분석한 결정을 저장하고, 다음 주 결과를 검토하세요 / Save your decision and review next week’s results**라는 짧은 다음 단계 안내로 제공한다.

### 5.1.2 블로그 안의 경량 CSV 확인

발행 글은 `blogInsightRegistry`에서 한·영의 관련 H2 섹션 또는 CSV 부적합 사유를 명시한다. **이 내용을 내 CSV로 확인 / Check this with your CSV**은 기존 분석 엔진 결과와 차트 하나를 보여 준다. 별도 실험 설계가 필요한 글의 **이 문단의 데이터 먼저 살펴보기 / Inspect the data behind this section**은 열을 선택한 기술적 집계(합계·합계의 비율)이며 모형 결과로 부르지 않는다. 퍼널 집계는 동일 사용자의 이탈률로 해석하지 않는다. 빈칸·비숫자를 0으로 바꾸지 않는다. 5MB·2만 행 이하 CSV를 브라우저 메모리에서 처리하고, 상세 이동 때 같은 파일·전체 도구 매핑을 전달하되 분석 게이트는 유지한다. 기존 도구 데이터가 있으면 교체를 확인받는다. 계측에는 공개 글 식별자·도구·상태만 보내며 원본·파일명·열 이름은 보내지 않는다.

### 5.1.3 계정 결정 보관과 Pro 체험 (2026-09-11 구현, 운영 활성화 전)

- B안: CSV 원본은 로컬 처리한다. 사용자가 미리 확인하고 선택한 결정 메모만 계정에 보관한다. 분석 입력·결과 데이터셋·파일명·매핑·스냅샷은 계정 저장 API의 허용 필드에 포함하지 않는다.
- Google 계정당 1회 14일 Pro 체험. 가입일이 아닌 첫 성공한 계정 저장을 서버 시각으로 기록하고, 동시 저장·기기 변경·재로그인으로 재시작하지 않는다. 체험은 자동 결제되지 않는다.
- 만료 후 계정의 기존 메모 열람·내보내기·삭제는 무료다. 새 계정 저장과 변경은 Pro 권한을 확인한다. 계정당 메모 상한은 2,000개다. 로컬 기록은 자동 업로드하지 않고 개별 선택으로 이전한다.
- 표시 문구 KO: 분석은 가입 없이. 결정 메모 보관은 로그인으로. / EN: Analysis needs no signup. Sign in to save decision memos.
- 표시 문구 KO: CSV 원본은 서버에 보내지 않습니다. 저장하기로 선택한 결정 메모만 계정에 보관됩니다. / EN: Source CSVs are never sent to our server. Only the decision memo you choose is stored in your account.
- Google 식별자·검증된 이메일은 계정·체험·이용권 용도다. 마케팅 동의는 뉴스레터에서 별도로 받는다. SMTP가 구성되면 연결된 실결제 주문 안내, 사용자가 선택한 검토일 안내와 이용기간 종료 D-7 안내를 발송한다. 메모 내용·CSV는 메일에 싣지 않고 로그인한 보관함으로 연결한다. 검토·만료 안내는 별도 선택 동의 및 해제 경로를 제공하며 구매 여부를 과장하지 않는다. 발송 성공은 SMTP 수락이지 받은편지함 도착을 뜻하지 않는다. 자동갱신은 켜지 않는다.
- 기존 Google 계정은 같은 검증 이메일로 일회용 로그인 링크를 요청할 수 있다. Google 로그인으로 등록되지 않은 이메일은 새 체험을 만들지 않는다. 링크는 10분·1회·요청한 브라우저에서만 유효하며 마케팅 동의로 사용하지 않는다.
- 서비스 메일 위탁 제공자는 Resend(Plus Five Five, Inc.)다. 발송 요청 시 TLS SMTP로 수신 이메일·발신 주소·제목·본문(주문번호·금액·이용기간 또는 일회용 로그인 링크)과 발송 식별자를 전달한다. CSV와 결정 메모 내용은 제외한다. 발송 경로는 일본 도쿄(ap-northeast-1), 메일 본문·배달 로그·계정 기록 저장은 미국으로 서로 구분한다. 일반 플랜의 이메일·로그는 30일, 백업은 7일 보관하며 Resend 서비스 계약 종료 후 잔여 고객 데이터는 90일 이내 삭제한다. 선택 알림은 보관함에서 해제하고, 메일 처리 중단·삭제 요청은 고객센터로 받는다. 메일 처리를 원하지 않으면 이메일 로그인·알림을 이용할 수 없으며 계정 삭제를 요청할 수 있다. 익명 CSV 분석은 계속 이용할 수 있다. 이 고지는 계정 DB의 처리 지역 확인을 대체하지 않는다. 근거: [Resend GDPR](https://resend.com/security/gdpr), [Privacy Policy](https://resend.com/legal/privacy-policy), [Sending regions](https://resend.com/docs/dashboard/domains/regions) (2026-09-11 확인).
- `ACCOUNTS_ENABLED`는 OAuth 설정·DB 마이그레이션·운영 개인정보 고지 및 실계정 스모크 검증 뒤에만 켠다. 설정 미완료 상태를 로그인 가능·메일 발송 완료로 표시하지 않는다. 기존 익명 구매와 복원 코드 계약을 유지한다.
- 계정 기능 활성화 후 새 구매는 로그인을 거쳐 검증된 이메일의 계정에 연결한다. 로그인 전 분석은 무료로 유지하고, 기존 익명 구매의 코드 복원도 계속 지원한다. 새 구매 때 마케팅 동의는 요구하지 않는다.

### 5.2 모든 도구 화면의 읽기 순서

| 순서 | 요소 | 사용자가 얻는 답 |
|---|---|---|
| 1 | 현재 문맥 | 지금 어떤 분석을 보는가 (도구명 + 데이터·기간을 **텍스트로**) |
| 2 | 분석 범위 | 이 결과가 무엇을 다루는가 |
| 3 | 판단 상태 | 지금 결론을 낼 수 있는가 (§5.4의 **이름**으로) |
| 4 | 결론 | 무엇이 핵심인가 (전문용어 최소 평어 한 문장) |
| 5 | 핵심 수치 | 왜 그런 결론인가 (3~5개, 단위·기간·비교 기준 포함) |
| 6 | 다음 행동 | 지금 무엇을 할까 (primary action 1개) |
| 7 | 근거·방법론 | 얼마나 믿고 어떻게 검증할까 (접기 또는 하단) |

### 5.3 제거 또는 하향할 요소

| 금지 패턴 | 대체 |
|---|---|
| 첫 화면에 **동급으로 보이는** CTA 여럿 | primary 1개(채운 배경·큰 글자) + 외곽선 보조 + 텍스트 링크. 금지되는 것은 개수가 아니라 **위계 없음**이다 — 목적이 다른 진입점 3개는 위계가 있으면 정당하다 |
| 설명 카드와 입력·결과가 같은 내용 반복 | 한 줄 목적 + 행동 + 접이식 도움말 |
| 수식·통계 용어가 결론보다 먼저 노출 | 평어 결론 → 수치 → 근거 → 방법론 |
| 글로벌 설정·라이브러리가 업로드 CTA와 경쟁 | 설정은 후순위 레일·`•••`로 |
| 모바일에서 핵심 행동 `display:none` | 구조를 바꾸되 업로드·오류 수정·결론 확인·저장은 보존 |

### 5.4 분석 도구 상태 SSOT

상태를 CSS 클래스나 색으로만 표현하지 않는다. **이름·설명·다음 행동을 함께** 쓴다.

| 상태 | 승인 제목 | 필수 설명 | primary action | 금지 |
|---|---|---|---|---|
| 빈 상태 | 데이터를 준비하세요 | 필요한 최소 컬럼 | CSV/XLSX 선택 | "분석 대기"만 표시 |
| 업로드 중 | 파일을 읽고 있습니다 | 파일명·처리 단계·취소 가능 여부 | 취소/대기 | 무한 spinner |
| 매핑 검토 | 컬럼을 확인해 주세요 | 자동 매핑 결과와 누락·충돌 사유 | 매핑 확인 후 분석 | "오류"만 표시 |
| 분석 중 | 분석을 계산하고 있습니다 | 현재 단계, 오래 걸리는 이유 | 취소/대기 | 확정된 것처럼 보이는 수치 |
| 결과 | 이번 데이터에서 확인된 결론 | 결론·근거·조건·다음 행동 | 다음 행동 1개 | 방법론이 결론보다 먼저 |
| 판단 보류 | 지금 데이터만으로는 결론을 정하기 어렵습니다 | 표본 부족·공선성·기간 부족 등 **구체 사유** | 필요한 데이터·실험 설계 안내 | "효과 없음"·"문제 없음" 단정 |
| 오류 | 분석을 완료하지 못했습니다 | CSV가 남아 있는지, 무엇을 고치면 되는지 | 수정·재시도 | 재업로드 필요 여부 숨김 |
| 오래된 결과 | 현재 필터/데이터와 결과가 다를 수 있습니다 | 무엇이 바뀌었는지 | 다시 분석 | 이전 결과를 최신처럼 표시 |

### 5.5 결과 카드 계약

| 층위 | 필수 요소 | 작성 규칙 |
|---|---|---|
| 1층 | 평어 결론 한 문장 | 원인·효과를 과장하지 않고 판단 상태를 반영 |
| 2층 | 핵심 수치 3~5개 | 단위·기간·비교 기준·불확실성 상태 포함 |
| 3층 | 다음 행동 1개 | '증액'·'보류'·'추가 데이터'·'실험 설계' 중 지금 가능한 것 |
| 4층 | 다음 검토일 또는 검증 조건 | 언제·어떤 수치로 재검토할지 |
| 상세 | 근거 차트·표·가정·제약 | 접거나 하단에 두되 **삭제하지 않는다** |

#### 5.5.1 상세 XLSX 계약

공개 분석 도구의 `ResultActionCard`는 예외 없이 **상세 워크북(XLSX)** 액션을 제공한다. 이 파일은 사용자가 명시적으로 다운로드할 때 브라우저에서만 생성하며, 원본 행을 서버·분석 이벤트·로컬 저장소로 우회 전송하거나 보존하지 않는다.

| 시트 | 계약 |
|---|---|
| `00_README` | 읽는 순서·계산 구분·재계산 경계·개인정보 안내 |
| `01_SUMMARY` | 화면과 같은 결론·핵심 수치·근거·다음 확인 |
| `02_RAW_DATA` | 업로드한 원본 전체. 문자열은 수식으로 승격하지 않는다 |
| `03_MAPPING` | 원본 열→표준 필드와 실제 분석 사용 여부 |
| `04_SCOPE` | 기간·채널·국가 등 결과 필터 |
| `05_CALCULATIONS` | 원본 완전성 검사와 추가 계산 시트 연결 수식 |
| `06_ENGINE_OUTPUT` | 브라우저 분석 엔진이 만든 화면 수치의 명시적 경계 |
| `07_RESULTS` | 엔진 출력 또는 계산 입력을 참조하는 살아 있는 결과 수식 |
| `08_METHOD_LIMITS` | 방법·가정·버전·통계 한계·수식 경계 |

계산 구분은 둘뿐이다.

- **전처리 이후 수식 재계산**: 매핑·필터·그룹 목록은 브라우저 분석 시점의 스냅샷이고, 그 이후 계산은 워크북 수식으로 재현한다. 원본 시트만 수정하면 자동 재매핑되지 않는다.
- **엔진 출력 + 살아 있는 후속 수식**: MMM·AR(1)·회귀·시계열 등 복잡한 적합은 `ENGINE_OUTPUT`에 명시하고, 이후 비율·차이·표·차트용 값은 수식으로 연결한다. 원본 변경만으로 모델이 재학습된다고 말하지 않는다. 변경 데이터는 사이트에서 다시 분석해 새 워크북을 받아야 한다.

직접 Google Sheets 파일을 생성하는 OAuth/API 연동과 원본 변경만으로 MMM을 재학습하는 VBA·매크로 워크북은 이 계약의 범위가 아니다. 내려받은 XLSX는 Excel에서 열거나 Google Sheets로 가져올 수 있다.

### 5.6 차트·표 계약

| 대상 | 규칙 |
|---|---|
| 차트 제목 | '무엇을 보여주는가'가 아니라 **'무슨 판단에 답하는가'** |
| 텍스트 대체 | 핵심 결론·수치·비교 대상을 차트 **밖** 본문·표에서도 확인 가능 |
| 범례 조작 | 범례 필터링이 가능하면 키보드·스크린리더로도 같은 조작 가능 |
| 색상 외 구분 | 선 스타일·마커·직접 레이블·표 병행 |
| 불확실성 | 예측·추정에는 구간과 **그 의미를 텍스트로** |
| 표 구조 | 실제 데이터는 `<table>`/`<th>`, 숫자 우측 정렬, 단위 명시 |
| 다운로드 정합 | 화면·다운로드·인쇄의 결론·필터·기간·단위가 일치 |

### 5.7 문구의 역할

모든 문장은 아래 넷 중 하나여야 한다. 어느 것도 아니면 삭제하거나 상세로 보낸다.

| 역할 | 예시 |
|---|---|
| 상태·결론 | "지난 7일 CPA는 전주 대비 12% 높아졌습니다." |
| 다음 행동 | "증액 전 이 채널의 한계 CPA를 먼저 확인하세요." |
| 오해 방지 | "이 결과는 관측 데이터 기반이며 인과를 확정하지 않습니다." |
| 오류 해결 | "날짜 컬럼이 두 개입니다. 기준 날짜를 선택하세요." |

| 피할 문구 | 승인 문구 |
|---|---|
| "모형이 불안정합니다." | "채널 지출이 함께 움직여 채널별 기여를 나누기 어렵습니다." |
| "p-value가 유의하지 않습니다." | "현재 표본만으로 차이가 있다고 판단하기 어렵습니다." |
| "업로드 실패" | "파일은 읽었지만 날짜 컬럼을 찾지 못했습니다. 기준 날짜 열을 선택해 주세요." |
| "데이터 없음" | "이 분석에는 날짜·비용·전환 열이 필요합니다. 현재 파일에는 전환 열이 없습니다." |

---

## 6. 접근성 계약

준수 목표는 **WCAG 2.2 AA**. 단 Focus Appearance(AAA)는 제품 기본 규칙으로 채택한다.

### 6.1 키보드와 포커스

`outline: none`만 적용하거나 포커스 위치를 알 수 없는 미세 색 변화는 허용하지 않는다. 제품 기본값은 **2px 이상 가시 윤곽선 + 상태 대비 3:1 이상**이다.

구현은 `globals.css`의 전역 `:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px }` 하나가 소유하고, 폼 필드는 `:where(input…):focus-visible`이 `!important`로 덮는다. **개별 규칙이 이를 취소하지 않는다** — `outline: none|0`을 다시 넣으면 `app/focusVisible.test.js`가 막는다. "몇 개 남았나"를 세는 검사로는 안 잡힌다: 취소가 실제로 유효한지는 특이도와 소스 순서로 갈린다.

| 대상 | 키보드 계약 | 포커스 계약 |
|---|---|---|
| 버튼·링크 | `Tab` 도달, `Enter`/`Space` 실행 | 2px 이상 윤곽선 또는 동등 |
| 모달·드로어 | 열릴 때 첫 유효 요소 포커스, `Tab` 순환, `Escape` 닫기 | 닫으면 **호출 요소로 복귀** |
| 탭 | ←/→·`Home`·`End`, 선택 상태↔패널 동기화 | `tablist`의 **직접 자식** `tab`, `tabpanel`의 `aria-labelledby` |
| 라디오형 pill·세그먼트 | 화살표·`Home`·`End`로 한 항목 선택 | `radiogroup`·`radio`·`aria-checked` 일치, roving tabindex |
| 콤보박스·⌘K | 화살표 이동, `Enter` 실행, `Escape` 닫기 | `combobox`/`listbox`/`option`/`aria-activedescendant` |
| 파일 업로드 | 드래그앤드롭 **외에** 클릭·`Enter`·`Space` | 드롭존 역할·상태·제한을 텍스트로 |
| 차트 범례·필터 | hover 전용 금지 | 키보드 조작 결과가 텍스트로도 반영 |

고정 헤더·푸터·모달은 포커스된 요소를 가리면 안 된다(WCAG 2.2 Focus Not Obscured).

### 6.2 대비·색상·테마

색은 의미를 **보조**할 수 있지만 단독으로 상태를 전달하지 않는다. 모든 상태는 라벨·아이콘·패턴·위치 중 하나 이상을 병행하고 **라이트/다크 각각 검증**한다.

| 요소 | 기준 |
|---|---|
| 본문·라벨 | 4.5:1 이상. 안내·오류·필수 라벨·버튼 문구에 `muted` 금지 |
| 큰 텍스트 | 3:1 이상 |
| 비텍스트 UI | 선택됨·오류·경고·포커스·차트 시리즈가 색만으로 구분되지 않게 |
| 포커스 표시 | 상태 변화 3:1 이상, glow 단독 금지 |
| `--primary` 배경 위 글자 | **`--on-primary` 고정**(`app/buttonContrast.test.js`가 강제) |
| 차트 색 | `CHART_THEME` getter만. canvas는 `var()`를 못 읽는다 |

### 6.3 의미 구조와 스크린리더

| 상황 | 승인 | 금지 |
|---|---|---|
| 페이지 이동 | `<a>` | `div onClick` 라우팅 |
| 동작 실행 | `<button type="button">` | 클릭 가능한 아이콘·텍스트만 |
| 입력 | `<label>` 연결 | placeholder만 라벨로 |
| 현재 위치 | `aria-current="page"` | 색만으로 활성 표시 |
| 알림 | `role="status"`/`aria-live` | 화면에만 잠깐 뜨는 toast |
| 오류 | 입력과 연결된 원인·수정 방법 | "오류 발생"만 |
| 도움말 | 버튼으로 열리는 설명 또는 inline | **`title` 단독** |
| 장식 아이콘 | `aria-hidden="true"` | 의미 없는 기호 낭독 |
| 차트 | 결론·수치·표 텍스트 대체 | hover만으로 핵심 정보 |

**`title` 단독은 어포던스가 아니다.** 터치·키보드에서 발견 불가하고 보조기술 전달이 일관되지 않는다. 약어·지표 정의·범례·파일명·히트맵 셀처럼 **판단에 필요한 정보**는 inline 설명 또는 포커스 가능한 `ⓘ` 버튼으로 제공한다.

### 6.4 터치·드래그·모바일

기본 타깃은 **44×44 CSS px**(WCAG 2.2 AA의 24px보다 보수적인 제품 기준).

| 대상 | 기준 |
|---|---|
| 아이콘 전용 버튼 | 44×44 hit area + `aria-label` |
| 드래그앤드롭 | 클릭 선택 + 키보드 실행 **필수 병행** |
| 재정렬·슬라이더 | 단일 포인터·키보드로 같은 결과 도달 |
| 하단 고정 CTA | 포커스·결과·오류 메시지를 가리지 않음 |

### 6.5 반응형·테마 검증 기준

| 환경 | 반드시 완료할 과업 |
|---|---|
| 320px | 파일 선택·오류 수정·분석 시작·결론 확인 |
| 768px | 필터·탭·표·모달·차트 조작, 2열 전환 시 포커스 순서 보존 |
| 1440px | 중복 sticky KPI·사이드 레일 경쟁 없음 |
| 라이트/다크 | 본문·라벨·상태·차트·포커스 대비 각각 |
| 200% 확대 | 홈·업로드·도구 결과·모달에서 겹침·조작 불가 없음 |
| 키보드 전용 | skip link·Tab 순서·Escape·focus return |
| 스크린리더 | 제목·랜드마크·상태·오류·차트 대체 정보 |

---

## 7. 컴포넌트 계약

신규 화면은 공용 컴포넌트를 **먼저** 쓴다. 레거시 화면을 고칠 때도 새 계약을 별도 구현하지 않고 공용으로 이관한다. (아래는 `src/components/ds/`에 **실재하는** 컴포넌트만 적는다.)

| 기능 | 정본 | 최소 계약 |
|---|---|---|
| 모달 | `ModalDialog` / `GlobalModals` | accessible name·portal·초기 포커스·Tab trap·Escape·backdrop·focus return |
| 선택 그룹 | `PillGroup` | radiogroup/radio·roving tabindex·화살표/Home/End·44px |
| 레거시 pill | `LegacyPillGroupA11y` | **이관 전 호환용.** 신규 화면에서 `.ab-pillgroup` 직접 작성 금지 |
| 결과 카드 | `ResultActionCard` | §5.5의 4층 + 상세 |
| 상태·증거 | `AnalysisStatusBadge`·`EvidenceStatusBadge`·`EvidenceHint` | 색 외 라벨·아이콘·텍스트 |
| 도움말 | `HelpTip` | `<details>` 기반 `ⓘ` — 키보드·터치·SR이 네이티브로 동작. 설명을 `title`에만 두지 않는다 |
| 업로드 가이드 | `CsvGuide`·`ToolBrief`·`ToolTemplateAction` | 입력 조건·예시·템플릿·키보드 실행·오류 경로 |
| 표 | `DataTable` | thead 강제·숫자 우측·빈 상태·모바일 대체·다운로드 일치 |
| 다운로드 | `ResultActionCard` + `DownloadHub` + `lib/analysis-export/*` | 단일 드롭다운, 전 공개 도구 공통 XLSX, 원본·매핑·수식 경계·결과 정합 |
| 의미 토글 | `UiSemantics` | `aria-pressed` 등 역할을 상태와 동기화 |
| 도구 목록 | `ToolIndex`(`lib/toolIndex.js` 파생) | 새 목록을 만들지 않는다 |

### 7.1 절대 금지

| 금지 | 이유 | 대체 |
|---|---|---|
| `div`/`span` 클릭 핸들러로 버튼 | 키보드·역할·상태 누락 | 네이티브 `<button>`/`<a>` |
| `outline: none` 단독 | 포커스 위치 상실 | 일관된 `:focus-visible` |
| 색상만으로 상태 전달 | 색각·저대비 사용자가 구분 불가 | 라벨·아이콘·패턴 병행 |
| `title` 단독 도움말 | 터치·키보드·보조기술에 불완전 | `ⓘ` 버튼·팝오버·inline |
| 드래그만 가능한 업로드/재정렬 | 과업 완료 불가 | 클릭·키보드 대안 |
| 모바일 `display:none`으로 핵심 기능 제거 | 반응형이 기능 격차가 됨 | 구조 재배치·단계적 공개 |
| 중첩 고정 영역 | 포커스·결과·CTA를 가림 | 상단 sticky는 문맥·필터·탭으로 제한 |
| 근거 없는 "확실"·"정답"·"효과 없음" | 신뢰 과장 | 조건·범위·판단 보류 포함 |

---

## 8. 품질 게이트

### 8.1 PR 전 자동 검증 (현행)

`npm run test:all` · `npm run lint`(0 errors) · `npm run build`. 관련 가드 테스트:

| 가드 | 파일 | 강제 내용 |
|---|---|---|
| 버튼 대비 | `src/app/buttonContrast.test.js` | `--on-primary` 사용·라이트/다크 대비 |
| 타이포 하한 | `src/app/typographyFloor.test.js` | 9.5px 하한(CSS + JSX 인라인) |
| 앱 셸 시맨틱 | `src/app/appShellSemantics.test.js` | 랜드마크·셸 구조 |
| 콘텐츠 레지스트리 | `lib/contentRegistry.test.js`·`topicClusters.test.js`·`aeoAnswer.test.js` | 블로그 6곳 배선 |
| 라우트 SEO | `routeSeo.test.js`·`toolOg.test.js`·`redirects.test.js` | 파생 커버리지 |
| 브랜드 사실 | `lib/compareContent.test.js` | 사실·한계 KO/EN 대칭, 도구 수 파생 |

### 8.2 추가해야 할 가드 (§10 백로그와 연동)

| 가드 | 강제할 내용 |
|---|---|
| ~~`titleAffordance.test.js`~~ | ✅ 완료 — 전부를 금지하지 않는다(보조 설명은 정당). **title이 유일한 경로일 때만** 잡는다: 포커스 불가한 `ⓘ` 글리프 + `th`/`td` 어포던스 규칙 존재 |
| ~~`focusVisible.test.js`~~ | ✅ 완료 — 개수를 세는 대신 **캐스케이드로 유효한 취소**만 잡는다(D-06) |
| `toolStateCoverage.test.js` | 공개 도구 14개가 §5.4의 상태 8종 문구를 갖는지(파생) |
| ~~`brandClaimScope.test.js`~~ | ✅ 완료 — 별도 파일을 만들지 않고 계약 주인 파일(`lib/compareContent.test.js`)에 넣었다(같은 계약을 두 파일이 나눠 갖지 않는다) |

**가드는 반드시 SSOT에서 파생시킨다.** 손으로 쓴 배열을 도는 가드는 가드가 아니다(§7 — 이미 `toolOg`·`routeSeo`에서 두 번 재발).

### 8.3 사람 검증이 필요한 릴리스 체크

새 분석 도구·새 공용 컴포넌트·고정 UI 변경·색 토큰 변경은 아래를 통과해야 한다.

| 여정 | 통과 기준 |
|---|---|
| CSV 시작 | 키보드만으로 파일 선택·요구 컬럼 확인·오류 수정·분석 실행 |
| 결과 해석 | 결론·핵심 수치·조건·다음 행동을 스크롤 초반에 이해 |
| 모달 | 열림·닫힘·focus return·배경 조작 차단·SR 이름 정상 |
| 탭·필터 | 선택 상태↔결과 동기화, 화살표·Home·End·포커스 정상 |
| 차트·표 | hover 없이 핵심 결론·수치·기간·단위 확인 |
| 모바일 | 320px 핵심 과업 완료, sticky가 포커스를 안 가림 |
| 테마 | 라이트/다크 상태·텍스트·포커스 구분 |

### 8.4 결함 심각도

| 심각도 | 정의 | 배포 기준 |
|---|---|---|
| **P0** | 핵심 과업 완료 불가 또는 결과를 **위험하게 오해**하게 함 | 수정 전 배포 불가 |
| **P1** | 과업은 가능하나 일부 사용자 부담·오류가 큼 | 같은 릴리스 또는 명시된 다음 릴리스 |
| **P2** | 일관성·밀도·읽기 흐름 저해 | 백로그 기록 후 개선 |

---

## 9. 거버넌스와 변경 프로토콜

제품 사실을 바꾸기 전에 **기능·정책·공개 문구 셋**을 함께 본다. 예를 들어 광고 계정 연동을 추가하면 F-08 한 줄만 고치는 게 아니라 개인정보처리방침·데이터 흐름·`llms.txt`·외부 프로필·도구 페이지·FAQ·테스트를 동시에 검토한다.

| 변경 유형 | 필수 검증 | 갱신 대상 |
|---|---|---|
| 새 도구 공개 | 입력 조건·결과 한계·KO/EN 경로·구조화 데이터 | `routeSeo`·sitemap·`llms.txt`·§4 카탈로그 |
| 가격·가입 정책 | 결제·계정 흐름·FAQ·법적 문서 | F-01·F-02·홈·외부 프로필 |
| 데이터 처리 | 실제 네트워크 요청·저장소 | F-03·F-04·개인정보처리방침·FAQ |
| 통계·모형 | 재현 테스트·경계 사례·해석 문구 | F-05·F-06·L-01~L-04 |
| 도구 수 | publication 분류 확인 | §4.1 정의·`llms.txt`·외부 프로필 |
| UX/접근성 계약 | 공용 컴포넌트 실동작 | §5~§7 + 해당 가드 테스트 |

---

## 10. 확정 백로그 (실측 기반)

아래 수치는 2026-08-19에 **직접 grep으로 센 것**이다. 완료를 선언하기 전에 다시 센다(§7).

### P0 — 정직성·핵심 과업

| ID | 항목 | 실측 | 완료 정의 |
|---|---|---|---|
| ~~**D-01**~~ | `BRAND_FACTS.uncertainty`가 95% CI를 **보편 주장**으로 `llms.txt`에 방출 | — | ✅ **2026-08-19 완료**. F-06 조건부 문구로 교체 + `compareContent.test.js`에 보편 주장 금지 가드(도구별로 갈리는 출력 단위 주장·절대 표현·조건 없는 95% 언급을 차단) |

### P1 — 접근성·일관성

| ID | 항목 | 실측 | 완료 정의 |
|---|---|---|---|
| ~~**D-02**~~ | 브랜드명 2표기 공존 | 80곳 vs 2곳 | ✅ **2026-08-19 완료**. `BRAND.name`·`ko.shortName`을 확정값으로 교체. `llms.txt` H1을 리터럴 대신 `BRAND.name`에서 파생시켜 재발을 가드. **잔여도 해소(2026-08-19)**: `BRAND`를 제거하지 않고 **기계가 읽는 정체성**에 배선했다 — `RootDocument`의 `WebSite`·`Organization` JSON-LD, `openGraph.OPEN_GRAPH_SITE_NAME`, `authorProfile.PUBLISHER_NAME`. 사람이 읽는 카피의 이름 리터럴(~70곳, "문의하기 | …"처럼 합성된 것 다수)까지 파생시키지는 않았다. 가드가 확장형 표기의 잔존을 막고, 실제로 `en.shortName`에 하나 남아 있던 것을 잡아냈다 |
| ~~**D-03**~~ | F-03 문구가 절대 표현 | `brandFacts.js` privacy | ✅ **2026-08-19 완료**. "브라우저에서 처리되며 원본 행을 서버로 전송·저장하지 않습니다"로 완화 |
| ~~**D-04**~~ | `title` 단독 어포던스 | **부분 완료(2026-08-19)**. 먼저 수를 다시 셌다 — `grep title=` 249곳 중 **58곳은 React 컴포넌트 prop**(`ResultActionCard title=` 등)이라 접근성과 무관하다. 실제 DOM 속성은 **191곳**, 그중 대체 경로 없는 것이 **180곳**. | ✅ **해결**: 화면에 `ⓘ` 하나만 있고 설명 전체가 title에 있던 **6곳**을 `ds/HelpTip`(details 기반 — 키보드·터치·SR이 네이티브로 동작)으로 이관하고 죽은 CSS 3블록을 제거. 표 헤더·셀 **59곳**에 어포던스 규칙(`th[title]`·`td[title]`) 추가. `app/titleAffordance.test.js`가 재발을 차단. ✅ **잔여도 완료(2026-08-19)**: 55곳을 다시 훑어 보니 대부분은 보이는 글자 + 부연이라 정당했고, **비활성 사유가 조건부 `title`에만 있던 8곳**이 진짜 결함이었다 — disabled 버튼은 포커스도 못 받으므로 터치·키보드에서는 왜 막혔는지 알 길 자체가 없다(§5.4 위반). `ds/BlockedOptionsNote`로 화면에 꺼내고 중복된 title은 지웠다. `MarketingResponse` 1곳은 사유가 이미 인접 문장으로 보여 예외이며, 그 문장이 사라지면 예외도 무너지도록 함께 단언한다. **AGENTS.md §7의 "전역 규칙 1개가 전부를 덮는다"는 서술은 정정 완료** |
| ~~**D-05**~~ | legacy pill 이관 | **기준선부터 틀려 있었다** — 래칫이 `className="ab-pillgroup`로 세면서 라벨 span까지 함께 셌다(94 = 컨테이너 45 + 라벨 49). 실제 대상은 45곳 | ✅ **2026-08-19 완료**. 단일선택 라디오 그룹 **35곳을 전부 `ds/PillGroup`으로 이관**했다. 남은 10곳은 PillGroup을 쓰면 **안 되는** 자리다 — pill이 0~1개인 레이아웃 컨테이너 6곳, 다중선택 2곳, 선택기가 셋 든 복합 1곳, ON/OFF 토글 1곳. **앞서 "다중선택 그룹 0곳"이라고 보고한 것은 틀렸다**: LtvTab의 성숙 기준일·표시 방법 두 그룹이 다중선택인데 어댑터가 radiogroup으로 만들어 "여럿 켜졌는데 하나만 선택됨"으로 읽히고 있었다. ARIA가 틀리게 붙는 것은 안 붙는 것보다 나쁘다 — `data-pillgroup="multi"` 표식과 `aria-pressed`로 고쳤다. 가드는 개수 세기에서 **계약 검사**로 바꿨다: 손으로 쓴 단일선택 그룹이 새로 생기면 잡는다. `PillGroup`에는 `ariaLabel`·`labelTitle`을 더했다(이관 때 접근名과 어포던스 툴팁을 잃지 않도록) |
| ~~**D-06**~~ | 전역 포커스 링을 취소하는 규칙 | `globals.css`에 전역 `:focus-visible { outline: 2px solid var(--primary) }`가 이미 있는데(L4946) **12곳이 그것을 취소**하고 테두리색·밑줄 변화로 대체하고 있었다 | ✅ **2026-08-19 완료**. 12곳에서 `outline: none|0`을 제거해 전역 링이 적용되게 했다(hover 스타일은 그대로). `input` 3곳은 `:where(input…):focus-visible { … !important }`가 덮으므로 예외. `src/app/focusVisible.test.js`가 ① `:focus-visible` 규칙의 취소 ② 전역 규칙보다 뒤에 선언된 기본 규칙의 취소를 CSS에서 파생해 차단하고, input 예외의 **근거 규칙 존재**도 함께 단언한다 |
| ~~**D-07**~~ | 다운로드 경로 불균일 | 14개 도구 전부 `ResultActionCard` 보유. `DownloadHub` 미사용은 5-26·5-18 본체·`PaidOrganicTrend`였다 | ✅ **2026-08-19 당시 완료**. 5-26은 섹션 헤드의 직접 다운로드 버튼을 결론 카드의 `DownloadHub`로 옮겼다. 당시에는 원천 데이터 반환을 금지해 `PaidOrganicTrend`를 예외로 뒀다. **2026-08-25 §5.5.1이 이 정책을 대체했다**: 사용자가 명시적으로 요청한 상세 XLSX에는 원본 전체를 브라우저에서만 포함하며 공개 도구 예외는 0이다. 과거 판정 문장은 당시 근거 기록으로만 남긴다 |
| ~~**D-08**~~ | 첫 행동 과밀(홈·`/start`) | **전제가 낡았다**(2026-08-19 확인). 외부 검토는 커밋 #690~#695 이전 화면 기준이다. 현재 히어로는 목적 CTA 3개 중 하나만 `--primary`(채운 배경·16px·그림자)이고 나머지는 외곽선 14px이며, 보조 진입점은 텍스트 링크다. `/start`도 "업로드 먼저"를 스모크가 이미 강제한다 | ✅ **2026-08-19 완료**. 재설계 대신 **계약을 고정**했다 — `LandingPage.smoke.test.jsx`가 KO/EN 모두에서 primary가 정확히 하나이고, 목적 CTA가 3개를 넘지 않으며, 보조 진입점이 버튼으로 승격되지 않는지 검사한다. 3열 균등 배치는 §12.28에 기록된 의도된 설계이므로 뒤집지 않았다 |

| ~~**D-13**~~ | PR #696으로 승격된 도구의 다운로드 탈출구 | `5-18-trend`·`5-18-forecast`가 독립 도구가 됐는데 허브 안에서 형제 단계가 주던 탈출구 없이 랜딩만 있었다 | ✅ **2026-08-19 당시 완료**. 두 단계의 결론 카드에 계산 결과 CSV를 붙였고 CSV 조립은 `utils/download.js`로 모았다. 당시의 "원천 데이터는 돌려주지 않는다" 정책은 **2026-08-25 §5.5.1의 사용자 요청형 상세 XLSX 계약으로 대체**됐다. 기존 개별 CSV는 기타 파일로 유지한다 |
| ~~**D-19**~~ | 전 도구 상세 XLSX | 공개 분석 도구 19개 모두 `ResultActionCard`를 쓰며 공통 워크북 액션 예외 0. 1차에 5-2·5-21·5-24·5-26·5-27을, 2차에 나머지 14개를 배선해 발행 도구 전수가 도구별 계산 시트를 갖춘다 | ✅ **2026-08-25 완료**. 전 도구에 원본 전체·매핑·범위·화면 결론·엔진 경계·후속 수식을 같은 구조로 제공하고 워커에서 생성한다. 단순 집계·비율·계산 검증은 살아 있는 XLSX 수식으로, MMM·회귀·부트스트랩·홀드아웃 추정과 같은 복잡 모델은 §5.5.1의 `엔진 출력 + 살아 있는 후속 수식` 경계로 정직하게 구분한다 |

### 외부 참고 도입 (PRISM MMM Explorer 검토, 2026-08-19)

**2026-08-19 다섯 건 모두 반영 완료.** 사내 다른 팀의 Meridian 기반 MMM 대시보드를 읽고 **우리 코드에 대조해** 골랐다. 대조에서 드러난 공통 패턴: **신호는 이미 계산하고 있는데 판정에 쓰지 않는 자리**가 많았다 — 5-3의 채널 신뢰도(R²·점 수)는 표시만 했고, MMM의 커버리지 비율은 계산만 하고 게이트는 절대 개수만 썼다. 우리 구조(사용자 CSV·브라우저 계산)와 그쪽 구조(오프라인 학습 후 정적 JSON 베이크)가 다르므로 파이프라인은 가져오지 않고, **판정·정직성·해석 장치**만 본다.

| ID | 항목 | 우리 현재 | 왜 가져오나 |
|---|---|---|---|
| ~~**D-14**~~ ✅ | **저신뢰 채널로 예산을 옮기지 않는다** | `budgetAllocTool.js`·`allocationMath.js`에 신뢰도 기반 게이트가 **0건**(grep 확인). `xMax`·∩형 vertex clamp만 있다 | 그쪽은 `confidence == Low` 채널을 현재 지출에 고정한다(기본 ON). 추정이 가장 불확실한 곳으로 예산을 옮기는 것은 §8.6(입증책임 비대칭)에 정면으로 어긋난다. 우리는 이미 `REG_STATS.ols`의 `regularized` 플래그와 CI 폭을 갖고 있으므로 **신호는 있고 배선만 없다** |
| ~~**D-15**~~ ✅ | **적합도를 평어 등급으로** | WMAPE·OOS WMAPE를 **숫자로만** 표시(`MarketingResponse.jsx:4803`) | 35.8%가 좋은지 나쁜지 사용자가 알 수 없다. 그쪽은 ≤5% Strong / ≤12% Fair / >12% Weak로 라벨한다. §12.17(쉬운말 우선)에 어긋나는 자리이고 렌더층 변경이라 싸다 |
| ~~**D-16**~~ ✅ | **MMM 화면의 구조적 한계 3종** | 인과·공선성 한계는 있으나 아래 셋은 없다 | ① **브랜드는 구조적으로 과소평가된다** — 장기 효과가 baseline으로 흘러가므로 "Performance가 N배 효율"은 측정된 몫일 뿐이다 ② **큰 오가닉 baseline은 정상이다** — 유료 기여가 10%여도 성숙 브랜드에서 흔하며 마케팅이 안 되는 게 아니다 ③ **두 시간축이 섞인다** — 효율은 당해 기간, 포화·반응곡선은 전체 윈도우. 셋 다 사용자가 반드시 오해하는 지점이고 L 카드에 넣을 값이다 |
| ~~**D-17**~~ ✅ | **효율 악화를 매체가와 소재로 가른다** | 5-21 PVM은 물량·효율·믹스로 나눈다. 9-6이 CPM 추세를 따로 보지만 **분해로 이어져 있지 않다** | `%ΔCPA ≈ %ΔCPM − %Δ반응률`. "비싸진 이유가 매체가가 올라서인가, 소재·타게팅이 나빠져서인가"는 마케터가 다음 행동을 고르는 갈림길인데 지금은 답이 없다 |
| ~~**D-18**~~ ✅ | **신뢰도를 두 축으로 게이팅** | 효과 신뢰도는 BIC 가중 posterior 하나로 판정 | 그쪽은 **사후확신도 AND 활성 주 비율**을 동시에 요구한다(High = 0.90 & 25%). 데이터가 얇은 채널이 우연히 높은 등급을 받는 것을 막는다 — §7의 "희소 채널 음수 탄력성은 노이즈지 잠식이 아니다"와 같은 문제를 사전에 차단하는 장치다 |

**가져오지 않는 것**: 오프라인 학습 후 정적 JSON 베이크(우리는 클라이언트 계산이라 필요 없고 신선도 문제도 없다) · LTV 상수 하드코딩(수동 갱신이라 낡는다 — 실제로 그쪽에서 60% 어긋난 전례가 문서에 기록돼 있다) · 브랜드×시장 다중 모델(우리는 사용자 CSV 하나) · S자 곡선의 오목 상포락선 그리디(우리 곡선은 poly2 계열이라 ∩형 꼭짓점 clamp로 다르게 처리한다. **다만 곡선이 볼록한 구간에서 고정 스텝 그리디가 equimarginal을 깨뜨린다는 사실 자체는 Hill 계열로 갈 때 필요하므로 여기 기록해 둔다**).

### P2 — 측정·문서

| ID | 항목 | 완료 정의 |
|---|---|---|
| ~~D-09~~ | 탭 ARIA·키보드 계약 | ✅ **2026-08-19 완료**. 5개 tablist 중 **9-6 하나만** 계약이 통째로 빠져 있었다(화살표 키·`aria-controls`·로빙 tabindex·panel 연결 전부 없음) — 나머지 넷이 완비돼 있어 "탭은 되어 있다"로 보였다. 배선 후 `app/tabContract.test.js`가 전수로 강제한다 |
| 🟡 D-10 | 모바일 실기기 검증 증거 부재 | **자동화 가능한 부분 완료(2026-08-19)**: `app/mobileTaskIntegrity.test.js`가 `@media (max-width ≤820px)` 블록에서 핵심 조작 셀렉터가 `display:none`으로 사라지지 않는지 CSS에서 파생해 검사한다(셀렉터의 **마지막 복합 선택자만** `:not()` 제거 후 대조 — `.dc-action-route:not(…) > span` 같은 오탐을 걸렀다). **남음**: 320/768/1440 실기기 회귀 체크는 릴리스 체크리스트 항목으로 사람이 한다. Playwright는 새 라이브러리라 확인 없이 추가하지 않았다(§11) |
| 🟡 D-11 | AEO/GEO 측정 | **준비 완료(2026-08-19)**: 체크리스트가 **낡아 있었다** — 17개씩으로 적혀 있었으나 도구 승격 후 실제로는 22개씩(총 44개)이다. 재생성했고 `docs/aeo-runs/`에 기록 절차를 만들었다(측정 전 반드시 재생성 — 대상이 제품보다 낡으면 추이가 무의미하다). **남음**: 44개를 ChatGPT·Claude·Perplexity·Google AI 개요에서 실제로 돌리는 것은 사람이 해야 한다. 돌리지 않은 셀을 채우면 그 달 추이가 통째로 못 쓰게 되므로(§8) 비워 둔다 |
| ~~D-12~~ | 문서 드리프트 | ✅ **2026-08-19 완료**. `ARCHITECTURE.md`의 "단일 파일"은 `globals.css` 얘기라 드리프트가 아니었고, `worklog.md`의 index.html 언급도 과거 기록으로서 정확하다. 실제 위험은 **복사해 실행하라고 만든 핸드오프 프롬프트** 한 블록이 "단일 index.html SPA"를 현재형으로 말하던 것 — 시점 경고와 현재 진입점을 붙였다 |

---

## 11. 측정 루프

**측정 없이 "개선했다"고 적지 않는다.** 단일 결과로 성공·실패를 단정하지 않는다(AI 답변은 변동성이 크다).

| 지표 | 정의 | 경고 신호 |
|---|---|---|
| 브랜드 정의 정확성 | AI 답변이 제품명·범위·프라이버시·한계를 SSOT대로 설명한 비율 | "실시간 광고 계정 연동"·"AI 자동 최적화" 오답 |
| 공식 도메인 인용률 | 답변에 `growthoptplaybook.com`이 출처로 연결된 비율 | 외부 디렉터리만 인용 |
| URL 정확성 | 질문에 맞는 도구·가이드 URL 제시 비율 | 홈으로만 보냄 |
| 비브랜드 검색 성과 | 주제 클러스터별 노출·클릭·CTR·순위 | 브랜드 검색만 증가 |
| 콘텐츠→도구 전환 | 답변형 글에서 도구를 열고 **실행**한 비율 | 클릭은 있으나 업로드·분석 시작이 낮음 |

**해석 규칙(GSC 실측 기반)**: 순위 상위 + CTR 0 = 스니펫·콘텐츠 문제 / 노출 많음 + 순위 낮음 = 분량·깊이 문제. EN은 랭킹 문제라 스니펫 손질이 안 통하며, 이미 25~38위인 클러스터에 집중한다.

---

## 12. 신규 화면 제출 체크리스트

- [ ] **단일 목적** — primary action이 하나이고 첫 화면에서 보인다
- [ ] **상태** — empty·importing·mapping·analyzing·result·blocked/error의 제목·설명·다음 행동이 있다
- [ ] **결론** — 평어 결론 + 핵심 수치 + 다음 행동 + 조건/한계
- [ ] **키보드** — Tab/Shift+Tab/Enter/Space/Arrow/Home/End/Escape가 §6.1 계약대로
- [ ] **포커스** — 명확하고 sticky·모달에 안 가려지며 닫은 뒤 복귀
- [ ] **의미** — 네이티브 우선, label·role·aria가 실제 상태와 동기화
- [ ] **대비** — 라이트·다크에서 본문 4.5:1, 큰 텍스트 3:1, 포커스 3:1
- [ ] **터치** — 44px 타깃, 드래그 대안, 320px 과업 완결
- [ ] **데이터** — 차트 텍스트 대체, 표 구조·단위, 다운로드 일치
- [ ] **도움말** — `title` 단독이 아니며 터치·키보드·SR에서 접근 가능
- [ ] **정직성** — 인과·예측·불확실성·한계를 행동과 함께 설명, F/L 카드와 모순 없음
- [ ] **문구** — 각 문장이 §5.7의 네 역할 중 하나
- [ ] **KR/EN** — 외부 노출은 같은 작업에서 동등하게(§2.11)

---

## References

- WCAG 2.2 — https://www.w3.org/TR/WCAG22/
- What's New in WCAG 2.2 — https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- Understanding Focus Appearance — https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- Understanding Contrast (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- Google AI optimization guide — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- 내부: `docs/system-audit-2026-08-12.md` · `docs/frontend-tool-design-guide.md` · `v2-migration/claude-ux.md` · `docs/aao-geo-operating-model.md`

### 프로젝트·보고서 이용권 (2026-09-09)
- KO: “분석 도구와 프로젝트 1개는 무료입니다. 보고서 다운로드·여러 프로젝트·일괄 보고서·브랜딩은 5,900원 1개월 이용권으로 제공합니다. 자동 갱신은 없습니다.” EN: “Analysis tools and one project are free. Report downloads, multiple projects, batch reports and branding are included in a KRW 5,900 one-month pass without automatic renewal.”
- `/projects` 및 `/en/projects`: 프로젝트별 IndexedDB 파일·매핑·주간 집계·결정·보고서·브랜딩. `/subscription` 및 `/en/subscription`: 무료 범위, 이용권 요금, 결제·복원, 실제 기기 저장량 안내. 현재는 preview/noindex이며 sitemap/RSS에서 제외한다.
- 기본 무료 범위는 분석 도구 전체·프로젝트 1개·저장 결과 읽기·프로젝트 백업. 유료 범위는 분석 결과 다운로드·여러 프로젝트·일괄 보고서·브랜딩. 개수 제한 해제는 저장 공간 무제한을 뜻하지 않는다.
- 저장 한도: 원본 파일당 25 MiB, 프로젝트 원본 합계 100 MiB, 브라우저 전체 원본 합계 250 MiB, 프로젝트 기록 JSON 10 MiB, 로고 1 MiB 및 4096px, 프로젝트 백업 150 MiB. 최신 파일은 데이터 종류마다 1개, 기간 집계는 최대 16개. 한도는 분석 성능·행 수·실제 브라우저 할당량을 보장하지 않는다.
- 화면의 원본 크기는 실제 Blob 합계, 기록 크기는 JSON 직렬화 크기, 사이트 사용량/할당량은 StorageManager의 추정값이며 서로 동일한 측정이 아니다. 프로젝트·파일은 90일 미사용 시 다음 정리 시점에 삭제된다. 브라우저 삭제/정리·기기 변경에 대비해 백업을 권한다.
- 백업에는 원본 파일·필터·사용자 지표/차트 설정·운영 메모가 포함되며 사용자 기기에서만 생성/복원한다. 라이선스·키는 포함하지 않는다. 복원 전 미리보기, 기존 프로젝트 교체 시 확인, 트랜잭션 실패 시 기존 저장 데이터 보존. 이전 설정만 내보내는 파일과 완전 백업은 별개 형식이다.
- 프로젝트 소속은 사용자가 선택하며 파일명·기간으로 고객을 추정하지 않는다. 다른 이름의 다음 기간 파일도 같은 프로젝트에서 분석 가능하다. 새 파일은 기존 파일을 교체하고 집계 스냅샷은 보존한다. 컬럼·통화 차이와 기간 겹침·공백은 안내하며 행을 자동 이어 붙이지 않는다.
- 관심 이벤트는 가격 제시 후의 관심이지 결제율이나 반복 매출이 아니다. 게이트 조회는 무료 한도 시도 source=project_limit만 별도 해석한다. 이름·파일명·CSV·금액 지표·키·로고·결제키·복원 코드는 GA에 보내지 않는다. 테스트와 실결제 활성화 이벤트를 구분한다.
- 결제 개인정보 계약: 주문번호·상품·금액·결제 상태·이용 기간·복원 코드 해시를 서버에 보관한다. 계정 보관 활성화 시 로그인한 구매 또는 명시적인 기존 이용권 연결에 계정 ID를 추가한다. 카드 입력은 토스 결제 화면에서 처리한다. CSV·분석 수치·프로젝트명·파일명은 결제 서버에 보내지 않는다. 결제 복원은 프로젝트 동기화가 아니다. 결제 기록 보관은 법정 의무에 따라 별도 운영하며 브라우저 90일 정책과 구분한다.

### 2026-09-10 감사 보완: 구매와 작업 복귀

- 결제 미구성/조회 실패 시 유료 범위를 무료로 해제하지 않는다. 구매 준비 상태를 표시하고 무료 샘플 보고서로 연결하며 분석을 계속할 수 있게 한다. 고객센터는 구독 페이지에서 접근할 수 있다.
- 운영 브리프 Markdown은 저장된 결정 기록의 이동 형식으로 무료 유지한다. 분석 보고서 Word/Excel/인쇄와 구분한다. EN: Decision notes (.md) remain free; formatted analysis reports require a pass.
- 구매 진입 전 도구의 공개 라우트를 세션에 보관한다. 결제 실행 버튼은 현재 프로젝트의 분석 입력·필터·결정·화면 설정을 이 브라우저 IndexedDB에 임시 보관한 뒤 결제창을 연다. 저장 실패 시 결제를 시작하지 않는다. 보관 동작은 버튼 앞에서 고지하고 장기 저장 동의는 변경하지 않는다. 결제 후 ‘진행하던 분석으로 돌아가기’에서 복원하며 다른 프로젝트나 새 작업을 덮어쓰지 않는다. 임시본은 복원 후 삭제하고, 미복원본은 24시간 뒤 다음 정리 시점에 삭제한다. CSV는 서버로 전송하지 않는다.

### 2026-09-11 구매·모바일 진입 보완

- 가격은 헤더의 1단 메뉴에 `Pro 5,900원` / `Pro · KRW 5,900`으로 노출한다. 가격은 SUBSCRIPTION에서 파생하며 기간·비자동갱신 안내는 구매 화면에 유지한다.
- 구매 화면은 결제수단 위젯을 자동 준비하고 결제 버튼 하나로 실행한다. 준비 실패 시 ‘다시 불러오기 / Reload checkout’를 제공한다. 주문 준비를 실제 구매로 계측하지 않는다. 구매 미제공 상태에서도 무료 샘플과 분석 복귀가 가능하다.
- 구매 보류 이유는 선택 응답 `price / identity / trust / refund / later`만 계측한다. 자유 입력·이메일·파일 정보는 보내지 않고 응답은 구매/닫기의 필수 조건이 아니다.
- 모바일은 계산기·진단·템플릿·뉴스레터를 먼저 제시한다. PC에서 이어하기는 공개 현재 페이지 링크 복사이며 CSV 전달이나 기기 동기화가 아니다. 모바일 업로드 기능은 유지한다.
- 환불정책 전문과 구매 전 접근성은 유지하되 ‘유료 기능 사용 여부 무관’ 강조를 상단 보증에서 제거하고 정책 전문에 둔다. 권리·금액·기간은 변경하지 않는다.
- GA에는 검증된 상품 가격·통화·공개 거래 ID만 구매 집계 용도로 보낸다. CSV 금액 지표·결제키·복원코드 전송은 금지한다.

### 2026-09-10 사용자 작업 연결

- 성공한 실제 데이터 분석은 다음 행동을 결정으로 기록하는 CTA를 제공한다. 샘플에는 실제 결정 기록을 강요하지 않는다.
- 결정 저장 후 프로젝트 보관과 검토일에 다시 확인할 경로를 제공한다. 기록이 있는 홈은 지난 결정 검토·프로젝트 열기를 앞에 표시한다.
- 구매 전 미저장 분석이 페이지 전환으로 사라질 수 있음을 KO/EN으로 안내하고 프로젝트 보관·백업 경로를 제공한다. 자동 저장으로 오해하게 하지 않는다.

### 2026-09-10 홈 고민 선택 확장

- 홈 고민 선택은 3개 대분류 대신 TOOL_JOURNEY의 7개 업무 질문으로 표시한다: 성과 변화, 유입 추세, 예산 조정, 소재·콘텐츠·행동, 앱 검색·스토어, 효과·이탈 검증, 채널 기여·예측.
- 각 질문의 KO/EN 문구는 toolConnections.js의 homeQuestion, 연결 도구는 기존 stage.tools에서 파생한다. 전체 공개 도구가 질문 선택으로 도달 가능해야 한다.

### 도구 탐색·재사용 (2026-09-10)
- 홈 질문 탐색은 공개 도구 SSOT에서 파생한다. 질문·도구명·결과·필요 데이터 검색을 제공하며 검색어는 서버나 분석 이벤트로 전송하지 않는다.
- 도구 선택 전에 확인할 결과와 필요한 데이터의 요약을 표시한다. 데이터 충족이나 분석 가능성을 자동 보장하지 않는다.
- 자주 쓰는 도구는 이 브라우저에 도구 ID만 저장한다. 데이터나 이용권 저장이 아니며 다른 기기와 자동 동기화되지 않는다. 저장 실패는 화면에 안내한다.
- KO/EN에 같은 검색·저장·해제 기능을 제공한다.

### 프로젝트 재방문 흐름 (2026-09-11)

- 프로젝트별 다음 CSV 분석과 결정 검토 진입을 제공한다. 검토일이 있으면 실제 저장된 날짜를 안내하며, 데이터 갱신 여부를 추정하지 않는다.
- 분석 설정 저장은 프로젝트별 최대 20개이며 매핑·공통 필터·지원하는 도구 입력을 포함한다. 지원 필드는 `src/lib/analysis-settings/toolInputs.js`에서 관리한다. 결과·검증 승인·이용권은 포함하지 않는다. 기기 저장이 켜진 프로젝트에서만 저장하며 프로젝트 백업에 포함한다.
- 저장 컬럼명이 모두 있어야 복원하며 추가 컬럼은 안내한다. 알려진 통화·전환 기준이 다르면 적용을 막는다. 새 CSV 선택 시 이전 기간 필터 해제, 현재 기간 유지, 저장한 기간 적용을 구분한다. 적용 전 입력을 확인하고 계산을 다시 실행한다.
- 구독 페이지의 무료 Word·Excel 샘플과 화면 발췌는 내장 데모의 실제 계산만 사용한다. 실제 내보내기 생성기로 만들며 사용자 데이터나 결제 권한을 참조하지 않는다. Word에는 차트 이미지, Excel에는 편집 가능한 차트가 포함된다.
- 자동 갱신 결제는 도입하지 않는다. 기존 1개월 이용권 계약을 유지한다.

### 반복 분석과 이용권 분실 대응 (2026-09-11)

- 수동 입력 도구도 프로젝트에서 지원 입력 설정을 저장할 수 있다. 원본 관측값과 검증 완료 상태는 재사용 대상으로 삼지 않는다.
- 결정 저장 후 검토일을 ICS 파일로 캘린더에 추가할 수 있으며, 프로젝트에는 검토 기한이 도래한 실제 기록 수를 표시한다. 자동 알림 발송을 약속하지 않는다.
- 코드·쿠키를 모두 잃은 경우 고객센터에서 구매 증빙을 확인한 뒤 운영자 전용 재발급 도구를 사용한다. 주문번호만으로 자동 재발급하지 않는다. 운영 절차는 `docs/payment-pass-recovery.md`를 따른다. 재발급은 기존 만료일을 연장하지 않는다.
