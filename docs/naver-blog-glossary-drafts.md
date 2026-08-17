# 네이버 블로그 용어사전 — 도구 연결판

> **용도**: 네이버 블로그에 **용어사전**을 올리고, 각 항목에서 우리 분석 도구·계산기로 연결한다.
> **분량은 용어사전 수준**(항목당 300~400자). 긴 설명은 우리 사이트 글로 넘긴다 — 그게 유입 경로다.
>
> 원본 SSOT는 `v2-migration/content/glossary/*.md`. 이 문서는 외부 채널 배포용 파생물이며 사이트 라우트·테스트를 건드리지 않는다.
> **EN 대칭(§2.11) 면제** — 네이버는 KR 전용 외부 채널이고 사이트 UI·메타가 아니다.

---

## 선별 기준

용어사전 30편 중 **우리 도구가 실제로 그 개념을 계산하는 24편**. 카테고리는 사이트 glossary의 `category` 값을 그대로 따랐다.

| 카테고리 | 항목 |
|---|---|
| 기초 지표 (10) | CPM · CTR · CPC · CPI · CPA · CVR · ROAS · ARPU · LTV · CAC |
| 측정·분석 방법론 (11) | 어트리뷰션 · 인크리멘탈리티 · 홀드아웃 · 업리프트 · 리타겟팅 · 카니발라이제이션 · 코호트 · 리텐션 · 퍼널 · MMM · 다중공선성 |
| 예산·최적화 (3) | 한계 CPA · 응답곡선 · 애드스톡 |

**제외 6편** — 링크할 기능이 없다. 없는 기능을 있는 것처럼 쓰지 않는다(§8).

| 용어 | 이유 |
|---|---|
| `aso` | 9-6은 소재 피로도 분석. ASO 기능 아님 (SOP 가이드만 있음) |
| `ecpi` | SKAN 추정 CPI를 검증하는 기능 없음 |
| `click-injection` | 어뷰징 탐지 기능 없음 |
| `deep-link` | 트래킹 구현 주제 — 가이드 영역 |
| `mmp` | 솔루션 소개. 우리가 계산하는 값 아님 |
| `probabilistic-attribution` | 확률적 매칭을 판정하는 기능 없음 |

> 도구 링크 없이 순수 용어 설명으로는 올려도 된다. 이 문서의 목적(기능 연결)에만 안 맞는다.

## 발행 형태 (권장)

**카테고리별 묶음 글 3편 + 목차 글 1편.** 항목이 짧으니 개별 발행하면 네이버 DIA에서 저품질로 밀린다.

| 글 | 내용 | 발행 분량(실측) |
|---|---|---|
| ① 기초 지표 10개 | CPM~CAC | 3,339자 |
| ② 측정·분석 방법론 11개 | 어트리뷰션~다중공선성 | 3,997자 |
| ③ 예산·최적화 3개 | 한계 CPA~애드스톡 | 1,136자 |
| ④ 목차 글 | ①②③으로 연결 + 용어 24개 리스트 | 직접 작성 |

항목당 본문은 평균 278자다. 사이트 용어사전 원본(1,000~1,400자)보다 짧게 잡았다 — **긴 설명을 네이버에 다 옮기면 사이트로 넘어올 이유가 없어진다.**

- 각 글 제목: `퍼포먼스 마케팅 용어사전 ① 기초 지표 10개 (CPM·CTR·CPC·CPA·ROAS)` — 괄호에 실제 검색어를 넣는다.
- 항목별 `▸ 분석` 링크는 네이버 텍스트 링크로. 링크 카드(OG 미리보기)는 글당 1개까지만(스팸 필터).
- 태그는 글 단위로 15개 이내. 항목마다 붙인 태그를 합쳐 중복 제거하고 쓴다.
- UTM: `?utm_source=naver&utm_medium=blog&utm_campaign=glossary&utm_content=<용어 slug>` — 어느 항목이 도구 사용으로 이어졌는지 편별로 갈린다.

## 링크 사전

| 도구 | URL |
|---|---|
| 마케팅 운영 대시보드 | `https://growthoptplaybook.com/dashboard` |
| 캠페인 성과 변동 분석 | `https://growthoptplaybook.com/tools/campaign-variance` |
| 캠페인 포화도 진단 | `https://growthoptplaybook.com/tools/campaign-saturation` |
| 예산 배분 시뮬레이터 | `https://growthoptplaybook.com/tools/budget-allocation` |
| A/B 테스트 분석 | `https://growthoptplaybook.com/tools/experiment-analysis` |
| 증분 효과 분석 | `https://growthoptplaybook.com/tools/incrementality` |
| 브랜드 캠페인 증분 분석 | `https://growthoptplaybook.com/tools/brand-campaign-incrementality` |
| MMM 기여도 분석 | `https://growthoptplaybook.com/tools/mmm-contribution` |
| 광고 카니발라이제이션 진단 | `https://growthoptplaybook.com/tools/cannibalization-diagnosis` |
| Paid·Organic 변화맵 | `https://growthoptplaybook.com/tools/paid-organic-trend` |
| 마케팅 추세 분석 | `https://growthoptplaybook.com/tools/marketing-trend` |
| 마케팅 회귀 예측 | `https://growthoptplaybook.com/tools/marketing-forecast` |
| VIF 다중공선성 진단 | `https://growthoptplaybook.com/tools/vif-multicollinearity` |
| 핵심 가치(Aha) 발굴 | `https://growthoptplaybook.com/tools/aha-moment` |
| 광고 소재 피로도 분석 | `https://growthoptplaybook.com/content/freshness` |
| 콘텐츠 요소 분석 | `https://growthoptplaybook.com/content/element-analysis` |
| ASA 키워드 발굴 | `https://growthoptplaybook.com/tools/asa-keyword-finder` |
| CSV 분석 시작 | `https://growthoptplaybook.com/start` |

| 계산기 | URL |
|---|---|
| LTV:CAC 비율·페이백 | `https://growthoptplaybook.com/calculator/ltv-cac` |
| 손익분기 ROAS | `https://growthoptplaybook.com/calculator/break-even-roas` |
| 목표 CPA 역산 | `https://growthoptplaybook.com/calculator/target-cpa` |
| A/B 표본수·기간 | `https://growthoptplaybook.com/calculator/ab-test-sample-size` |
| CPA ↔ ROAS 환산 | `https://growthoptplaybook.com/calculator/cpa-roas-converter` |
| 목표 달성 CVR | `https://growthoptplaybook.com/calculator/required-cvr` |
| 예산 페이싱 | `https://growthoptplaybook.com/calculator/budget-pacing` |
| 예산별 예상 설치수 | `https://growthoptplaybook.com/calculator/expected-installs` |

---

# ① 기초 지표

> 퍼널 앞에서 뒤로 이어지는 순서. CPM에서 출발해 CTR·CVR을 거쳐 CPA로 도착한다.

## CPM (Cost Per Mille)

**노출 1,000회당 든 광고비.** `광고비 ÷ 노출 수 × 1,000`

우리가 정하는 값이 아니라 경매의 결과예요. 경쟁이 세지거나(성수기·경쟁사 증액), 타겟을 좁히거나, 소재 관련성이 떨어지면 오릅니다.

CPM이 올랐을 때 입찰가부터 만지지 마세요. 타겟을 조였는지, 지면 구성이 바뀌었는지, 소재를 교체했는지를 먼저 봐야 합니다. 우리가 바꾼 게 없는데 올랐다면 대개 시즌·경쟁이고, 그때는 입찰가를 올려도 해결되지 않습니다.

CPM이 낮은 지면은 대개 반응도 낮습니다. 판단은 항상 CPA·ROAS에서 하세요.

▸ **분석**: [마케팅 운영 대시보드](https://growthoptplaybook.com/dashboard) · [캠페인 성과 변동 분석](https://growthoptplaybook.com/tools/campaign-variance)
▸ **관련**: CTR · CPC · CPA
🏷 `#CPM` `#CPM뜻` `#노출당비용` `#천회노출비용` `#광고단가`

## CTR (Click-Through Rate)

**노출된 광고 중 클릭된 비율.** `클릭 수 ÷ 노출 수`

소재 성과를 가장 빠르게 읽는 지표예요. 노출은 며칠이면 쌓이는데 전환은 훨씬 오래 걸리니까요.

CTR이 2배 오르면 CPC는 절반이 됩니다. 소재 개선이 곧 매입 단가 개선이에요.

다만 **CTR만 보면 낚시 소재로 수렴합니다.** 클릭은 잘 나는데 전환이 안 되는 소재요. CTR 1위가 CPA 최하위인 경우는 흔합니다. 항상 CVR이나 최종 CPA와 짝지어 보세요.

CTR이 떨어졌다면 소재 피로 → 타겟 확장 → 지면 변화 → 경쟁 순으로 확인합니다.

▸ **분석**: [광고 소재 피로도 분석](https://growthoptplaybook.com/content/freshness) · [콘텐츠 요소 분석](https://growthoptplaybook.com/content/element-analysis)
▸ **관련**: CPC · CVR · CPM
🏷 `#CTR` `#CTR뜻` `#클릭률` `#소재피로도` `#광고소재분석`

## CPC (Cost Per Click)

**클릭 1회당 든 광고비.** `(CPM ÷ 1,000) ÷ CTR`

노출 1회당 비용을 CTR로 나눈 값이에요. CPM이 5,000원이고 CTR이 1%면 CPC는 500원. CPM은 1,000회 단가라서 CTR로 바로 나누면 값이 1,000배로 뜨니 주의하세요.

CPC가 올랐을 때 **매체가 비싸진 건지(CPM 상승) 소재가 안 먹히는 건지(CTR 하락)** 를 갈라 봐야 합니다. 손볼 곳이 완전히 달라져요.

CPC 목표를 단독으로 세우면 싼 클릭·저품질 지면으로 흘러갑니다. `CPA = CPC ÷ CVR`이니 CPC가 절반이 되고 CVR이 1/3이 되면 CPA는 오릅니다.

▸ **분석**: [광고 소재 피로도 분석](https://growthoptplaybook.com/content/freshness) · [ASA 키워드 발굴](https://growthoptplaybook.com/tools/asa-keyword-finder)
▸ **관련**: CPM · CTR · CPA
🏷 `#CPC` `#CPC뜻` `#클릭당비용` `#CPC낮추기` `#검색광고`

## CPI (Cost Per Install)

**앱 설치 1건당 든 광고비.** `광고비 ÷ 설치 수`

캠페인을 켠 직후 하루면 나오니까, "이 채널이 물량을 만들 수 있나"를 빠르게 보는 데 적합해요.

문제는 **설치의 질이 채널마다 다르다**는 것입니다. 인센티브 광고는 CPI가 압도적으로 낮지만 리텐션도 낮고, CPI가 비싼 채널이 D30 리텐션과 결제 전환율은 훨씬 높은 경우가 흔합니다. CPI 1위 채널이 LTV 기준 최하위인 상황이 실제로 자주 나옵니다.

**CPI로 채널 순위를 정해 예산을 옮기는 것이 가장 흔한 실수예요.** 최소한 D1·D7 리텐션과 짝지어 보세요.

▸ **분석**: [마케팅 운영 대시보드](https://growthoptplaybook.com/dashboard) · [예산별 예상 설치수 계산기](https://growthoptplaybook.com/calculator/expected-installs)
▸ **관련**: CPA · CAC · 리텐션
🏷 `#CPI` `#CPI뜻` `#설치당비용` `#앱설치비용` `#UA마케팅`

## CPA (Cost Per Action)

**가입·구매 등 원하는 행동 1건당 든 비용.** `광고비 ÷ 전환 수`

CPI가 "설치시키는 데 든 돈"이면 CPA는 "돈 되는 행동을 만드는 데 든 돈"이에요.

목표 CPA는 감이 아니라 마진에서 역산합니다. `객단가 × (매출총이익률 − 목표 이익률)` — 객단가 5만 원, 마진 60%, 목표 이익률 15%면 22,500원이에요.

CPA는 **결과**입니다. 원인은 앞 단계에 있어요. `CPA = (CPM ÷ 1,000) ÷ (CTR × CVR)`로 쪼개면 노출 단가가 비싼지, 클릭이 안 나는지, 클릭 이후가 안 되는지가 갈립니다.

전체 CPA가 올랐을 때 개별 캠페인은 그대로인데 **비싼 캠페인 쪽으로 비중만 옮겨진 경우**가 특히 안 보입니다.

▸ **분석**: [목표 CPA 역산 계산기](https://growthoptplaybook.com/calculator/target-cpa) · [캠페인 성과 변동 분석](https://growthoptplaybook.com/tools/campaign-variance)
▸ **관련**: CPI · CVR · 한계 CPA
🏷 `#CPA` `#CPA뜻` `#전환당비용` `#목표CPA` `#CPA역산`

## CVR (Conversion Rate)

**클릭 중 실제로 전환된 비율.** `전환 수 ÷ 클릭 수`

CTR이 소재의 문제라면 CVR은 **클릭 이후 전부**의 문제예요. 랜딩·온보딩·결제 마찰·유입 품질이 다 여기 들어갑니다. 그래서 CVR이 떨어졌을 때 광고 계정만 뒤지면 원인을 못 찾습니다.

무엇을 전환으로 잡느냐(설치/가입/구매)로 값이 몇 배씩 달라지니 **분자를 명시**하세요.

떨어졌다면 ① 트래킹이 깨졌나 ② 유입 구성이 바뀌었나 ③ 랜딩·온보딩 배포가 있었나 ④ 소재-랜딩 메시지가 어긋났나 순으로 봅니다. ①을 배제하지 않고 랜딩을 고치면 시간을 크게 낭비해요.

▸ **분석**: [목표 달성 CVR 계산기](https://growthoptplaybook.com/calculator/required-cvr) · [마케팅 운영 대시보드](https://growthoptplaybook.com/dashboard)
▸ **관련**: CTR · 퍼널 · CPA
🏷 `#CVR` `#CVR뜻` `#전환율` `#전환율계산` `#랜딩페이지최적화`

## ROAS (Return On Ad Spend)

**광고비 1원이 만든 매출.** `매출 ÷ 광고비`, 보통 %로 표기

ROAS 300%는 3배예요. 그런데 **ROAS는 이익이 아니라 매출 기준**입니다. 매출 3원 안에 원가·수수료가 들어 있어요.

그래서 판단선은 손익분기 ROAS입니다. `1 ÷ (매출총이익률 − 변동비율)` — 마진 60%, 수수료 5%면 약 182%. 이 아래면 팔수록 광고 기여이익이 마이너스예요.

**며칠 기준인지(D7·D30) 항상 같이 적으세요.** 기간이 다른 ROAS 비교는 다른 지표를 비교하는 것과 같습니다.

평균 ROAS 순위대로 예산을 몰아주면 대개 실패합니다. 평균이 좋아도 한계 ROAS가 이미 목표선 아래일 수 있어요.

▸ **분석**: [손익분기 ROAS 계산기](https://growthoptplaybook.com/calculator/break-even-roas) · [예산 배분 시뮬레이터](https://growthoptplaybook.com/tools/budget-allocation)
▸ **관련**: 한계 CPA · LTV · 업리프트
🏷 `#ROAS` `#ROAS뜻` `#손익분기ROAS` `#ROAS계산` `#광고수익률`

## ARPU (유저당 평균 매출)

**매출을 전체 유저 수로 나눈 값.** `매출 ÷ 전체 유저 수`

ARPPU와 헷갈리면 상황을 반대로 읽어요. ARPU는 **전체** 유저로 나누고 ARPPU는 **결제한** 유저로만 나눕니다. 결제 비중 3%면 두 값이 33배 벌어집니다.

**ARPU가 올랐다고 좋은 신호는 아닙니다.** 신규 유입이 줄어 분모가 작아져도 오릅니다. 성장이 멈춘 신호인데 지표는 개선처럼 보여요. 유저 수와 매출을 함께 보고 코호트로 나눠 확인해야 합니다.

코호트별 누적 ARPU 곡선이 LTV 추정의 기반이 되지만, 관측 기간이 짧으면 곡선이 안 익은 상태라 그대로 연장하면 안 됩니다.

▸ **분석**: [마케팅 운영 대시보드](https://growthoptplaybook.com/dashboard) · [LTV:CAC 계산기](https://growthoptplaybook.com/calculator/ltv-cac)
▸ **관련**: LTV · 코호트 · 리텐션
🏷 `#ARPU` `#ARPU뜻` `#ARPPU` `#유저당매출` `#객단가`

## LTV (Lifetime Value)

**고객 한 명이 이탈까지 벌어다 주는 총 매출.**

**LTV는 늘 추정치예요.** 아직 이탈하지 않은 고객의 미래 매출을 포함하니까요. 그래서 `D90 실측 LTV`처럼 기간을 명시해 쓰는 게 안전합니다. 기간 없는 LTV는 비교가 불가능해요.

가능하면 매출이 아니라 **매출총이익 기준**으로 쓰세요. 매출 LTV로 LTV:CAC를 계산하면 수익성이 구조적으로 과대평가됩니다.

**LTV:CAC 3배는 참고선일 뿐 합격선이 아닙니다.** 회수 기간이 18개월이면 3배로도 현금흐름이 버티지 못해요. 비율과 페이백 기간을 항상 같이 보세요.

최근 코호트만 보고 "LTV가 떨어졌다"고 판단하는 것이 흔한 오류입니다 — 어제 설치한 유저의 D90은 존재하지 않아요.

▸ **분석**: [LTV:CAC 비율·페이백 계산기](https://growthoptplaybook.com/calculator/ltv-cac) · [마케팅 운영 대시보드](https://growthoptplaybook.com/dashboard)
▸ **관련**: CAC · ARPU · 리텐션 · 코호트
🏷 `#LTV` `#LTV뜻` `#고객생애가치` `#LTVCAC` `#페이백기간`

## CAC (Customer Acquisition Cost)

**고객 한 명을 획득하는 데 든 비용.** `획득 비용 ÷ 획득 고객 수`

계산식은 단순한데 팀마다 값이 다르게 나옵니다. **분자와 분모의 정의가 서로 달라서**예요.

- 분모: 설치 기준이면 사실상 CPI, 가입 기준이면 몇 배, 첫 결제 기준이면 또 몇 배
- 분자: 광고비만(Paid CAC) vs 인건비·툴·대행 수수료 포함(Blended CAC)

LTV는 결제 고객 기준인데 CAC는 설치 기준으로 잡으면 LTV:CAC가 비현실적으로 좋게 나옵니다. **어느 단계를 고객으로 정의했는지 명시하지 않으면 비교가 무의미해요.**

판단은 LTV와 짝지어야 생깁니다. 비율(LTV ÷ CAC)과 회수 기간을 같이 보세요.

▸ **분석**: [LTV:CAC 비율·페이백 계산기](https://growthoptplaybook.com/calculator/ltv-cac) · [목표 CPA 역산 계산기](https://growthoptplaybook.com/calculator/target-cpa)
▸ **관련**: LTV · CPA · CPI
🏷 `#CAC` `#CAC뜻` `#고객획득비용` `#LTVCAC` `#블렌디드CAC`

---

# ② 측정·분석 방법론

> "이 숫자를 믿어도 되나"에 답하는 개념들. 어트리뷰션에서 시작해 증분·구조 분석으로 넘어간다.

## 어트리뷰션 (Attribution)

**일어난 전환을 어느 광고 접점의 성과로 볼지 정하는 규칙.**

중요한 건 어트리뷰션이 **규칙**이라는 점이에요. 사실을 발견하는 게 아니라 배분 방식을 정하는 것이라, 모델(라스트클릭·퍼스트클릭·멀티터치)에 따라 같은 데이터에서 다른 숫자가 나옵니다.

**매체 리포트를 다 더하면 실제 전환보다 많은 게 정상입니다.** 한 사람이 두 매체를 거쳤으면 양쪽이 각각 1건으로 세니까요. 이 합계로 예산을 배분하면 중복 계산된 채널이 과대평가됩니다.

매체와 MMP 숫자가 다른 건 귀속 창·집계 시점·전환 정의가 달라서예요. 어느 쪽이 맞다기보다 기준이 다른 겁니다.

어트리뷰션은 항상 100%를 배분합니다. **"광고 없이도 일어났을까"는 모델을 바꿔서 답할 수 없어요** — 증분 측정의 영역입니다.

▸ **분석**: [증분 효과 분석](https://growthoptplaybook.com/tools/incrementality) · [MMM 기여도 분석](https://growthoptplaybook.com/tools/mmm-contribution)
▸ **관련**: 인크리멘탈리티 · MMM
🏷 `#어트리뷰션` `#어트리뷰션뜻` `#기여도` `#라스트클릭` `#전환귀속`

## 인크리멘탈리티 (Incrementality)

**광고가 실제로 추가로 만들어낸 성과 — 증분성.**

리포트에 잡힌 전환 전체가 아니라, "광고가 없었어도 어차피 일어났을 전환"을 빼고 남은 몫이에요.

CPA·ROAS가 좋은데 전체 매출은 그만큼 안 늘었다면 대개 이 지점입니다. 어트리뷰션 합계는 100%인데 실제 증분은 40%, 20%일 수 있어요. **리타겟팅과 브랜드 검색에서 격차가 특히 큽니다.**

측정법은 세 가지 — ① 무작위 홀드아웃 ② 캠페인 온/오프 전후 비교 ③ 시계열 기준선 추정. 아래로 갈수록 다른 요인이 섞이니 ③을 인과로 단정하면 안 됩니다.

증분이 낮게 나왔다고 바로 끄지 마세요. **신뢰구간이 0을 걸치면 "효과 없음"이 아니라 "아직 구분 안 됨"** 입니다.

▸ **분석**: [증분 효과 분석](https://growthoptplaybook.com/tools/incrementality) · [브랜드 캠페인 증분 분석](https://growthoptplaybook.com/tools/brand-campaign-incrementality)
▸ **관련**: 홀드아웃 · 업리프트 · 어트리뷰션
🏷 `#인크리멘탈리티` `#증분분석` `#증분성` `#광고효과측정` `#홀드아웃테스트`

## 홀드아웃 테스트 (Holdout Test)

**일부에 광고를 무작위로 안 내보내고 남겨 진짜 증분을 확인하는 실험.**

핵심은 **무작위**예요. "광고를 본 사람 vs 안 본 사람"을 그냥 비교하면 안 됩니다. 본 사람은 애초에 관심이 있어서 봤으니, 그 차이는 광고 효과가 아니라 관심도 차이일 수 있어요.

홀드아웃 크기는 "기대하는 효과를 구분할 수 있는 최소 크기"로 잡습니다. 작으면 아무것도 못 보고, 크면 매출을 포기해요. **전환이 적은 캠페인일수록 홀드아웃과 기간이 둘 다 커져야 합니다.**

기간은 구매 주기보다 길게. **종료 시점은 시작 전에 정하고 중간 결과로 바꾸지 마세요** — 유의하게 나온 날 멈추면 거짓 양성률이 크게 올라갑니다.

▸ **분석**: [증분 효과 분석](https://growthoptplaybook.com/tools/incrementality) · [A/B 표본수·기간 계산기](https://growthoptplaybook.com/calculator/ab-test-sample-size)
▸ **관련**: 인크리멘탈리티 · 업리프트
🏷 `#홀드아웃테스트` `#홀드아웃` `#통제군실험` `#증분테스트` `#AB테스트`

## 업리프트 (Uplift)

**광고를 본 그룹과 안 본 그룹의 차이 — 광고가 만든 순수 증가분.**

노출군 전환율 8%, 홀드아웃 5%면 업리프트는 3%p예요.

ROAS는 광고를 본 사람의 매출 **전체**를 비용으로 나눈 값이라 원래 일어났을 전환이 섞여 있습니다. 업리프트는 그 몫을 뺍니다. **ROAS 400%인데 업리프트가 0에 가까운 경우가 실제로 있어요.**

계산은 단순한 차이지만 전제가 중요해요 — 무작위로 나뉘었나, 기간·대상이 같나, 홀드아웃에 광고가 정말 안 나갔나(제외 조건 누락이 흔한 사고).

마이너스로 나올 수도 있습니다. 표본이 작아 뒤집힌 경우가 대부분이라 **신뢰구간을 먼저** 보세요.

▸ **분석**: [증분 효과 분석](https://growthoptplaybook.com/tools/incrementality) · [A/B 테스트 분석](https://growthoptplaybook.com/tools/experiment-analysis)
▸ **관련**: 인크리멘탈리티 · 홀드아웃 · ROAS
🏷 `#업리프트` `#업리프트뜻` `#증분효과` `#순수증가분` `#신뢰구간`

## 리타겟팅 (Retargeting)

**이미 앱을 알거나 써본 유저에게 다시 광고를 노출하는 방식.**

리포트상 CPA가 신규 획득의 1/3로 나오는 일이 흔한데, 그 숫자로 예산을 옮기면 전체 매출은 그만큼 안 늘어납니다.

대상이 **이미 우리를 아는 사람**이라서예요. 장바구니에 담아둔 사람은 광고가 없어도 상당 비율이 돌아옵니다. 그 전환이 리타겟팅 성과로 잡혀요. 좋은 CPA가 광고가 잘 된 결과인지 **원래 올 사람을 센 결과인지 리포트만으로는 구분되지 않습니다.**

일부를 무작위로 제외한 홀드아웃으로 복귀율을 비교해야 갈립니다. 신규와 리타겟팅을 같은 캠페인에 섞으면 전체 효율이 좋아 보이는 착시도 생겨요.

▸ **분석**: [증분 효과 분석](https://growthoptplaybook.com/tools/incrementality) · [캠페인 포화도 진단](https://growthoptplaybook.com/tools/campaign-saturation)
▸ **관련**: 인크리멘탈리티 · 홀드아웃 · 한계 CPA
🏷 `#리타겟팅` `#리타겟팅뜻` `#리마케팅` `#리인게이지먼트` `#재참여캠페인`

## 카니발라이제이션 (Cannibalization)

**유료 광고가 어차피 왔을 오가닉 유입을 대신 가져가는 현상 — 잠식.**

전체 유입은 그대로인데 광고비만 늘어난 상태예요. 브랜드 키워드 광고에서 가장 자주 일어납니다.

**리포트에서는 안 보입니다.** 광고 리포트는 광고로 들어온 전환만 보고, 그게 오가닉에서 옮겨온 건지 새로 만든 건지 구분하지 않아요. 그래서 잠식이 심할 때도 CPA는 오히려 아주 좋게 나옵니다. 브랜드 검색 CPA가 비정상적으로 낮다면 신호일 수 있어요.

유료와 오가닉이 같이 올랐다고 잠식이 아닌 것도 아닙니다 — 성수기였을 수도 있어요. **대조군이나 전후 비교로 반사실을 만들어야** 구분됩니다.

가장 확실한 확인법은 광고를 끄고 오가닉이 올라오는지 보는 것. 부담되면 지역·시간대 분할로 시작하세요.

▸ **분석**: [광고 카니발라이제이션 진단](https://growthoptplaybook.com/tools/cannibalization-diagnosis) · [Paid·Organic 변화맵](https://growthoptplaybook.com/tools/paid-organic-trend)
▸ **관련**: 인크리멘탈리티 · MMM
🏷 `#카니발라이제이션` `#오가닉잠식` `#브랜드키워드광고` `#잠식효과` `#브랜드검색광고`

## 코호트 (Cohort)

**같은 시점(같은 날·같은 주)에 시작한 유저 묶음.**

전체 평균은 **유입량 변화에 흔들립니다.** 신규가 2배 늘면 아직 리텐션이 낮은 구간의 유저가 많아져, 제품이 나빠지지 않았는데도 평균 리텐션이 떨어져요. 즉 코호트로 안 나눈 평균은 제품 변화와 유입량 변화가 섞인 값입니다.

코호트가 축이고 리텐션이 값이에요. 그래서 히트맵(행=설치 주, 열=경과 일)이 표준 형태가 됩니다.

기준은 설치일·가입일·첫 구매일 무엇이든 되지만 **차트에 시작점을 명시하고, 정한 기준을 도중에 바꾸지 마세요.**

관측 기간이 다른 코호트를 나란히 비교하는 게 흔한 함정입니다. 이번 달 코호트의 D30은 아직 없어요.

▸ **분석**: [마케팅 운영 대시보드](https://growthoptplaybook.com/dashboard) · [핵심 가치(Aha) 발굴](https://growthoptplaybook.com/tools/aha-moment)
▸ **관련**: 리텐션 · LTV · 퍼널
🏷 `#코호트` `#코호트뜻` `#코호트분석` `#코호트리텐션` `#유저분석`

## 리텐션 (Retention)

**설치·가입한 유저 중 일정 기간 뒤에도 남아있는 비율.**

설치일을 D0으로 두고 1일·7일·30일 뒤 돌아온 비율이 D1·D7·D30이에요. **셋은 다른 질문에 답합니다** — D1은 첫인상, D7은 습관화 초입, D30은 실제로 남는 유저요. D1만 좋아졌다면 온보딩만 개선된 겁니다.

계산은 분모=코호트 크기, 분자=돌아온 수. 여기서 가장 흔한 실수가 나옵니다. **여러 날을 합칠 때 비율의 단순 평균을 쓰면 안 돼요.** 1만 명 코호트 20%와 100명 코호트 60%의 단순 평균은 40%지만 실제 가중값은 약 20.4%입니다.

최근 코호트가 급락처럼 보이면 대개 관측 기간이 안 찬 것 — 미성숙 구간은 비워 두세요.

**외부 벤치마크는 대부분 안 맞습니다.** 기준은 같은 앱의 과거 코호트예요.

▸ **분석**: [마케팅 운영 대시보드](https://growthoptplaybook.com/dashboard) · [핵심 가치(Aha) 발굴](https://growthoptplaybook.com/tools/aha-moment)
▸ **관련**: 코호트 · LTV · ARPU
🏷 `#리텐션` `#리텐션뜻` `#D1리텐션` `#D7리텐션` `#유저잔존율`

## 퍼널 (Funnel)

**노출→클릭→설치→가입→구매처럼 단계별로 줄어드는 전환 흐름.**

"노출 대비 구매 전환율 0.02%"로는 아무 조치도 못 해요. 퍼널은 **단계별 통과율**로 봐야 합니다. 그렇게 쪼개면 "가입까지는 오는데 결제에서 90%가 빠진다"처럼 조치 가능한 문장이 나옵니다.

판단은 절대값이 아니라 비교로 — 과거 같은 단계 대비, 그리고 채널·OS·국가별 대비요.

흔한 함정은 **단계 정의가 시간 축을 섞는 것.** 노출은 당일인데 구매는 D7 누적이면 그 통과율은 의미가 없어요.

**절대 인원수를 같이 보세요.** 5%p 하락이 100명 중 5명이면 노이즈, 10만 명 중 5천 명이면 사고입니다.

▸ **분석**: [마케팅 운영 대시보드](https://growthoptplaybook.com/dashboard) · [목표 달성 CVR 계산기](https://growthoptplaybook.com/calculator/required-cvr)
▸ **관련**: CVR · CTR · 코호트
🏷 `#퍼널` `#퍼널분석` `#전환퍼널` `#마케팅퍼널` `#단계별전환율`

## MMM (마케팅 믹스 모델링)

**채널별 지출과 성과의 관계를 시계열로 모델링해 기여도를 추정하는 방법.**

개별 유저를 추적하지 않고 주 단위 집계만 씁니다. iOS ATT 이후 어트리뷰션이 깨진 환경에서 다시 주목받는 이유예요.

반드시 두 개념이 들어갑니다 — **애드스톡**(효과가 며칠~몇 주 이어짐)과 **포화**(늘릴수록 추가 효과가 줄어듦). 이 둘 없이 지출을 그대로 회귀에 넣으면 계수가 크게 어긋납니다.

데이터는 **주 단위 최소 1년, 가능하면 2년 이상.** 짧으면 계수가 데이터가 아니라 가정으로 결정돼요.

**MMM 결과는 인과가 아닙니다.** 연관을 모델링한 가설 생성 도구예요. 큰 예산 결정 전에는 홀드아웃으로 확인하세요. 채널 지출이 같이 움직였다면 VIF로 먼저 점검해야 합니다.

▸ **분석**: [MMM 기여도 분석](https://growthoptplaybook.com/tools/mmm-contribution) · [VIF 다중공선성 진단](https://growthoptplaybook.com/tools/vif-multicollinearity) · [마케팅 추세 분석](https://growthoptplaybook.com/tools/marketing-trend)
▸ **관련**: 애드스톡 · 다중공선성 · 응답곡선
🏷 `#MMM` `#MMM뜻` `#마케팅믹스모델링` `#채널기여도` `#기여도분해`

## 다중공선성 (Multicollinearity)

**독립변수들이 서로 얽혀 회귀가 누구의 효과인지 구분 못 하는 현상.**

마케팅에서 아주 흔해요. 예산을 늘릴 때 모든 채널을 같이 늘리니까요. 데이터상 A와 B가 항상 같이 움직였다면 회귀는 둘을 나눌 방법이 없습니다.

가장 위험한 건 **숫자는 나온다**는 점이에요. 오류 없이 계수가 소수점까지 찍힙니다. 다만 불안정해요 — 데이터 한 주만 추가해도 크게 흔들리고, 신뢰구간이 비정상적으로 넓어지고, **부호가 뒤집힙니다.** 지출을 늘렸는데 기여가 마이너스로 나오는 걸 "방해가 된다"로 읽으면 안 됩니다. 식별 불가의 증상이에요.

VIF로 확인합니다 — 1~5 괜찮음, 5~10 주의, **10 이상이면 그 채널의 개별 계수를 인용하지 마세요.**

발견되면 채널을 합치거나, 지출 변동을 엇갈리게 만들거나, 실험으로 옮깁니다. **"추정치 ≈ 0"은 증거 없음이지 효과 없음이 아닙니다.**

▸ **분석**: [VIF 다중공선성 진단](https://growthoptplaybook.com/tools/vif-multicollinearity) · [MMM 기여도 분석](https://growthoptplaybook.com/tools/mmm-contribution)
▸ **관련**: MMM · 인크리멘탈리티
🏷 `#다중공선성` `#VIF` `#VIF뜻` `#회귀분석공선성` `#분산팽창계수`

---

# ③ 예산·최적화

> "얼마를 어디에 더 넣을까"에 답하는 개념들. 평균이 아니라 한계로 판단한다.

## 한계 CPA · 한계 ROAS (Marginal CPA / ROAS)

**지금 지출에서 '다음 1원'을 더했을 때의 CPA·ROAS.**

"이 캠페인 CPA 8천 원이니까 더 태우자"는 위험해요. 8천 원은 **지금까지 쓴 돈 전체의 평균**이지 다음 1원의 효율이 아닙니다.

응답곡선이 평평해지는 구간에서는 평균 CPA가 아직 괜찮아 보여도 **한계 CPA는 이미 훨씬 나빠져 있어요.** "예산을 늘렸는데 전환이 그만큼 안 늘었다"가 대부분 이 구조입니다.

판단은 **한계 CPA ÷ 평균 CPA** — 1보다 크면 포화 신호, 1에 가까우면 증액 여유(ROAS는 방향이 반대).

채널 간 한계효율이 같아지는 지점이 최적 배분이에요(등한계 원리).

**삭감은 증액을 되감는 게 아닙니다.** 러닝 페이즈 리셋, 최소 유효 예산 바닥, 소재 피로 누적 때문에 뺀 1원은 곡선 값보다 비싸게 돌아옵니다.

▸ **분석**: [캠페인 포화도 진단](https://growthoptplaybook.com/tools/campaign-saturation) · [예산 배분 시뮬레이터](https://growthoptplaybook.com/tools/budget-allocation)
▸ **관련**: 응답곡선 · CPA · ROAS
🏷 `#한계CPA` `#한계ROAS` `#한계효용` `#예산증액기준` `#등한계원리`

## 응답곡선 (Response Curve)

**지출을 늘릴수록 전환이 어떻게 따라오는지 보여주는 곡선.** 보통 S자

세 구간으로 나뉩니다 — **초기**(노출 부족·학습 안 됨), **중간**(늘리는 만큼 따라옴, 증액 여력), **후기**(수확체감·포화). 같은 캠페인이 어느 구간에 있느냐로 "예산 2배" 결정의 결과가 완전히 달라져요.

평평해지는 이유는 오디언스 소진, 입찰 경쟁 상승, 소재 피로입니다.

**관측 범위 밖은 추정이지 예측이 아닙니다.** 월 3천만 원까지 써 본 채널의 곡선을 1억까지 연장해 읽으면, 그 구간 값은 데이터가 아니라 함수의 가정이에요.

곡선이 평평하다고 무조건 삭감 신호도 아닙니다 — 브랜드 인지 캠페인은 단기 전환 곡선이 원래 평평해요.

▸ **분석**: [캠페인 포화도 진단](https://growthoptplaybook.com/tools/campaign-saturation) · [예산 배분 시뮬레이터](https://growthoptplaybook.com/tools/budget-allocation)
▸ **관련**: 한계 CPA · 애드스톡 · MMM
🏷 `#응답곡선` `#반응곡선` `#수확체감` `#포화도진단` `#예산배분`

## 애드스톡 (Adstock)

**광고를 끈 뒤에도 남아서 이어지는 잔존 광고효과.** 이월효과·캐리오버

오늘 본 광고가 오늘만 작동하지 않고 며칠~몇 주에 걸쳐 전환으로 이어집니다.

무시하고 **같은 날 지출 ↔ 같은 날 전환**으로 보면 두 오류가 동시에 생겨요. 지출을 늘린 주는 효과가 다음 주로 넘어가 **과소평가**되고, 끊은 주는 앞 주 잔존이 잡혀 **과대평가**됩니다. 증액·삭감 판단이 반대로 나올 수 있어요.

MMM에서는 감쇠율(얼마나 빨리 줄어드나)과 지연(정점이 며칠 뒤인가)으로 표현합니다. 브랜드 인지는 느리게, 프로모션은 빠르게 감쇠해요.

실무 규칙 — **전환 지연보다 짧은 구간으로 판단하지 마세요.** 켜고 3일 만에 "CPA가 나쁘다"고 끄면 아직 오지 않은 전환을 안 기다린 겁니다. 삭감은 반대로 끊고 1주일 뒤 숫자로 보세요.

▸ **분석**: [MMM 기여도 분석](https://growthoptplaybook.com/tools/mmm-contribution) · [마케팅 회귀 예측](https://growthoptplaybook.com/tools/marketing-forecast)
▸ **관련**: MMM · 응답곡선 · 한계 CPA
🏷 `#애드스톡` `#adstock` `#광고잔존효과` `#이월효과` `#전환지연`

---

# 원본과의 동기화

계산식·판정 기준·임계값을 고칠 일이 생기면 **원본 `content/glossary/*.md`와 이 문서를 같은 작업에서** 고칠 것. 도구 URL이 바뀌면 위 링크 사전과 각 항목 `▸ 분석` 줄을 함께 갱신한다.
