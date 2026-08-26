---
title: "SKAN 스키마 변경 후 검증: 정상 여부 확인 순서"
description: "conversion value 스키마를 바꾼 뒤 코드 호출·서명·postback·집계 해석을 검증하는 체크리스트입니다."
date: "2026-08-26"
slug: "skan-schema-validation"
keywords: "SKAN schema validation, conversion value 검증, SKAN postback 테스트"
tags: ["측정", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["skan", "conversion-value", "postback"]
conditions: "테스트 postback은 개발 환경의 고정값과 프로덕션 privacy tier 결과가 다를 수 있습니다. 테스트 통과는 구현 경로 검증이고, 실제 보고 해상도는 출시 후 별도로 관찰해야 합니다."
sources:
  - title: "Verifying an install-validation postback — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/verifying-an-install-validation-postback?changes=_2."
  - title: "SKAdNetwork — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork?lang=en"
faq:
  - q: "테스트에서 conversion value가 0으로 오면 스키마가 실패한 건가요?"
    a: "Apple의 테스트 시나리오는 production postback과 다른 고정 파라미터를 사용할 수 있습니다. 테스트 환경의 값 자체보다, 의도한 요청·수신·서명 검증 경로가 통과하는지와 운영 환경 관측을 구분하세요."
  - q: "postback은 받았는데 바로 전환으로 세도 되나요?"
    a: "아니요. Apple 서명을 검증하고 transaction-id로 중복을 제거한 뒤, 버전 3 이상이면 did-win을 확인해야 합니다. 유효하지 않거나 비승자 postback을 전환으로 합산하면 숫자가 왜곡됩니다."
---

## 검증 대상을 네 층으로 나눕니다

스키마 변경 뒤 ‘대시보드에 숫자가 보인다’는 것은 충분한 성공 기준이 아닙니다. 다음 네 층을 따로 확인하세요.

1. **앱 호출**: 새 조건에서 의도한 fine·coarse value와 lock 설정이 호출되는지 확인합니다.
2. **광고 조건**: 실제 서명 버전과 앱·iOS·SDK 조건이 기대한 SKAN 버전을 만족하는지 확인합니다.
3. **수신 무결성**: postback version에 맞춰 Apple 서명을 검증하고 `transaction-id`로 중복을 제거합니다.
4. **분석 해석**: sequence index, did-win, fine/coarse/미제공 상태를 분리한 집계가 스키마 표와 맞는지 확인합니다.

## 테스트와 운영 관측을 섞지 않습니다

Apple은 StoreKit Test로 impression signature와 postback을 검증하는 경로를 제공합니다. 이 테스트는 구현 오류를 빨리 찾는 데 적합하지만, 실제 privacy tier의 분포를 대신하지는 않습니다. 테스트에는 기대한 호출과 signature 검증 결과를, 운영에는 window별 수신 지연·자릿수·value 제공 비중을 각각 기록하세요.

## 변경 전후 비교의 최소 조건

변경일, 앱 버전, 스키마 버전, 매체·MMP의 담당자를 하나의 변경 로그에 남깁니다. 이후 1~2주 동안은 새 value의 절대 수치보다 ‘값이 제공된 비중’과 ‘이전과 같은 상위 행동 구간의 비중’을 먼저 봅니다. value 코드가 바뀐 채 세부 버킷을 전후 비교하면, 스키마 변경 자체를 성과 변화로 읽게 됩니다.
