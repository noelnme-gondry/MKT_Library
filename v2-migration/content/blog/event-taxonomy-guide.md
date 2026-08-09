---
title: "이벤트 택소노미 설계: GA4·MMP 전환 데이터 이름 규칙"
description: "좋은 이벤트 택소노미는 화면 목록이 아니라 행동·파라미터·속성 규칙입니다. 네이밍, 매핑, 버전 관리, 개발 QA까지 정리합니다."
date: "2026-07-18"
slug: "event-taxonomy-guide"
keywords: "이벤트 택소노미, 이벤트 네이밍 규칙, 인앱 이벤트 설계, GA4 이벤트, MMP 이벤트, 이벤트 파라미터, 이벤트 QA"
tags: ["측정", "기초"]
draft: false
ogImage: "/blog-assets/event-taxonomy-guide/og-ko.svg"
relatedGlossary: ["mmp", "retention", "ltv"]
sources:
  - title: "Google Analytics — GA4 event reference"
    url: "https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events"
  - title: "AppsFlyer — In-app events"
    url: "https://dev.appsflyer.com/hc/docs/inappevents"
faq:
  - q: "이벤트명은 화면 이름으로 지어도 되나요?"
    a: "권장하지 않습니다. 화면은 바뀌기 쉽고 하나의 화면에서 여러 행동이 일어납니다. 이벤트명은 사용자의 행동을, 파라미터는 행동이 일어난 화면·대상·값 같은 맥락을 표현하세요."
  - q: "이벤트명을 바꾸면 과거 데이터는 어떻게 되나요?"
    a: "새 이름은 일반적으로 별도 이벤트로 쌓입니다. 같은 지표의 시계열을 유지하려면 전환 기간의 병행 발화·매핑·종료일을 문서화하고, 임의의 무명 변경은 피해야 합니다."
  - q: "매출 이벤트에 꼭 필요한 값은 무엇인가요?"
    a: "최소한 금액과 ISO 4217 통화 코드, 중복 제거용 거래 ID를 정합니다. GA4의 권장 전자상거래 이벤트는 value를 보낼 때 currency를 요구합니다."
  - q: "PII를 해시해서 이벤트 파라미터에 넣으면 되나요?"
    a: "플랫폼·계약·법적 정책을 먼저 확인해야 합니다. 원칙은 이벤트에 이메일·전화번호·이름 등 직접 식별 정보를 보내지 않는 것입니다. 분석에 필요한 익명 내부 ID와 범주형 속성으로 대체하세요."
---

이벤트명은 사용자의 행동을, 파라미터는 행동의 맥락과 값을 표현해야 합니다. `signup_complete` 하나에 화면명·상품·금액·가입 방법을 붙여 넣는 식이 아니라, 행동은 고정하고 변하는 정보는 구조화된 파라미터로 분리하세요. **그래야 GA4, MMP, 광고 매체, 내부 리포트가 같은 행동을 같은 뜻으로 읽습니다.**

좋은 이벤트 택소노미는 화면 목록이 아닙니다. 제품·개발·마케팅이 합의한 이벤트·파라미터·사용자 속성·발화 시점의 계약입니다.

## 먼저 행동, 맥락, 사용자 속성을 나누세요

| 구분 | 답하는 질문 | 예시 | 바뀔 때 |
|---|---|---|---|
| 이벤트 | 사용자가 무엇을 했나? | `signup_completed`, `purchase_completed` | 행동 정의가 바뀔 때만 |
| 이벤트 파라미터 | 어떤 대상·방법·금액으로 했나? | `plan_id`, `payment_method`, `value`, `currency` | 행동마다 |
| 사용자 속성 | 이 사용자는 어떤 상태인가? | `membership_tier`, `acquisition_channel` | 사용자 상태가 바뀔 때 |

`paywall_screen_view`처럼 화면과 행동을 한 이름에 섞지 마세요. 사용자가 화면을 봤다면 `screen_view` 또는 제품의 화면 조회 규칙을 쓰고, `screen_name=paywall`을 파라미터로 둡니다. 결제를 완료했다면 `purchase_completed`를 발화하고 결제수단·상품·금액을 파라미터로 보냅니다.

![사용자 행동을 이벤트, 파라미터, 사용자 속성으로 분리하고 GA4·MMP·광고 매체로 보내는 구조도](/blog-assets/event-taxonomy-guide/action-event-parameter-flow-ko.svg)

## 네이밍 규칙은 적고 엄격하게

다음 네 가지면 대부분의 충돌을 막습니다.

1. 소문자 `snake_case`만 쓴다. `addToCart`, `add-cart`, `add_cart`를 섞지 않는다.
2. 동사_대상 또는 대상_결과 중 하나를 선택한다. 예: `article_saved`, `signup_completed`.
3. 화면명·캠페인명·날짜·버전을 이벤트명에 넣지 않는다. 변하는 값은 파라미터로 보낸다.
4. 자동·권장 이벤트와 예약어를 먼저 확인한다. GA4는 권장 이벤트·예약 이름·이름 길이 제한을 두므로 구현 전 [공식 이벤트 문서](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events)를 확인하세요.

GA4의 권장 이벤트를 제품 정의와 맞게 쓸 수 있다면 먼저 사용하세요. 예를 들어 `sign_up`, `login`, `search`, `share`, `purchase`는 표준 리포트와 연동하기 쉽습니다. 비슷하지만 다른 이름을 임의로 만들면, 권장 이벤트가 제공하는 전자상거래·표준 리포팅 의미를 잃을 수 있습니다. [GA4 권장 이벤트 목록](https://developers.google.com/analytics/devguides/collection/ga4/reference/recommended-events)을 기준으로 선택하세요.

## 설계서에 반드시 넣을 매핑표

이벤트 목록만 개발자에게 전달하면 부족합니다. 각 이벤트가 언제 한 번만 발화하는지, 어느 시스템으로 가는지, 어떤 값이 필수인지가 있어야 QA할 수 있습니다.

| 제품 행동 | 공통 이벤트 | 필수 파라미터 | GA4 | MMP·매체 | QA 기준 |
|---|---|---|---|---|---|
| 가입 완료 | `signup_completed` | `method`, `signup_type` | `sign_up` 매핑 여부 | 가입 최적화 이벤트 | 성공 응답 뒤 1회 |
| 장바구니 추가 | `cart_item_added` | `item_id`, `quantity`, `value`, `currency` | `add_to_cart` | 필요 시 상위 퍼널 신호 | 탭마다 중복 발화 금지 |
| 구매 완료 | `purchase_completed` | `transaction_id`, `value`, `currency`, `items` | `purchase` | 매출 이벤트·포스트백 | 검증된 결제 1건당 1회 |
| 구독 갱신 | `subscription_renewed` | `transaction_id`, `plan_id`, `value`, `currency` | 커스텀 또는 비즈니스 규칙 | 가치 최적화 신호 | 원결제와 중복 구분 |

`value`를 보낼 때는 `currency`를 함께 보냅니다. GA4 권장 전자상거래 이벤트도 금액 값이 있으면 3자리 ISO 4217 통화 코드가 필요하다고 명시합니다. 거래 금액은 쉼표·통화 기호가 없는 숫자 값으로 보내고, `transaction_id`는 중복 제거 규칙을 갖게 하세요. AppsFlyer도 인앱 매출 값에 통화 기호·쉼표·문자를 넣지 않도록 안내합니다. [AppsFlyer 인앱 이벤트 문서](https://dev.appsflyer.com/hc/docs/inappevents)를 참고하세요.

![좋은 이벤트명과 나쁜 이벤트명을 행동·파라미터·발화 시점 기준으로 비교한 표](/blog-assets/event-taxonomy-guide/good-bad-naming-ko.svg)

## 발화 시점과 중복 제거를 먼저 결정하세요

이벤트의 뜻은 이름만으로 완성되지 않습니다. “구매 완료”가 결제 버튼을 눌렀을 때인지, 결제 승인 응답을 받았을 때인지, 환불 가능 기간이 지난 뒤인지에 따라 매출과 ROAS가 달라집니다.

- 성공 기준: UI 클릭이 아니라 서버 또는 신뢰 가능한 성공 응답 뒤 발화한다.
- 중복 기준: 네트워크 재시도·앱 재실행에도 같은 `transaction_id`는 한 번만 집계한다.
- 시간 기준: 이벤트 시간대와 전환일 기준을 GA4·MMP·내부 DB에서 문서화한다.
- 실패 기준: 실패·취소·환불은 성공 이벤트에 섞지 않고 별도 상태 또는 이벤트로 관리한다.

이 규칙이 없으면 같은 결제가 여러 번 잡혀 ROAS가 부풀고, 매체·MMP·결제 DB 수치가 서로 달라집니다. 차이가 생겼을 때는 [어트리뷰션 데이터 불일치 원인](/blog/attribution-data-mismatch)에서 집계 기준과 귀속 날짜를 먼저 분리하세요.

## 버전 변경은 이름 바꾸기가 아니라 마이그레이션입니다

이벤트를 새로 정의해야 할 때는 다음 순서로 진행합니다.

1. 변경 이유와 영향받는 지표·대시보드·매체 이벤트를 설계서에 적습니다.
2. 새 이벤트·파라미터 버전을 추가하고, 필요하면 제한된 기간 기존 버전과 병행 발화합니다.
3. GA4 DebugView·MMP 테스트 기기·매체 테스트 이벤트에서 값과 중복을 확인합니다.
4. 리포트·포스트백·광고 최적화 이벤트를 새 버전으로 전환합니다.
5. 종료일을 정해 이전 버전 발화를 멈추고, 시계열 경계와 매핑을 변경 기록에 남깁니다.

GA4는 이벤트와 파라미터를 Realtime·DebugView에서 확인할 수 있고, Measurement Protocol 검증 서버도 제공합니다. [GA4 이벤트 검증 방법](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events)처럼 운영 환경 전 검증 경로를 정하세요.

![택소노미 설계부터 개발, QA, 포스트백, 광고 최적화까지 이어지는 운영 흐름](/blog-assets/event-taxonomy-guide/design-to-qa-flow-ko.svg)

## 개발 전달 전 QA 체크리스트

- [ ] 이벤트는 행동을, 파라미터는 맥락을 표현한다.
- [ ] 이벤트명·파라미터명은 한 규칙으로 통일했다.
- [ ] 자동·권장 이벤트, 예약 이름, 플랫폼 제한을 확인했다.
- [ ] PII를 이벤트명·파라미터·사용자 속성에 넣지 않았다.
- [ ] 금액에는 숫자 `value`, ISO 4217 `currency`, 중복 제거용 거래 ID를 정의했다.
- [ ] 이벤트별 성공·실패·재시도·중복 발화 조건을 적었다.
- [ ] GA4·MMP·매체별 매핑과 전환·매출 설정을 적었다.
- [ ] 테스트 기기에서 실제 값·시간대·중복·누락을 확인할 담당자를 정했다.
- [ ] 변경 버전·시작일·종료일·과거 데이터 처리 규칙을 남겼다.

## 결론: 택소노미는 분석 문서가 아니라 운영 계약입니다

이벤트 택소노미가 정리되면 리포트 숫자가 맞고, 포스트백 누락을 빨리 찾고, 광고 매체가 같은 전환 신호로 학습합니다. 시작은 거창한 이벤트 수집이 아니라 핵심 퍼널 행동 몇 개의 정의를 고정하는 일입니다.

다음으로 [포스트백 연동 가이드](/blog/postback-integration-guide)에서 앱·MMP·매체 사이 전달을 점검하고, iOS 측정 환경이라면 [ATT·SKAN 측정 정리](/blog/ios-att-skan-guide)도 함께 확인하세요.
