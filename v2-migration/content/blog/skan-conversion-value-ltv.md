---
title: "SKAN conversion value를 LTV로 연결하는 설계"
description: "SKAN conversion value를 즉시 매출로 오해하지 않고, 초기 행동 구간과 이후 LTV 관측을 연결하는 방법입니다."
date: "2026-08-26"
slug: "skan-conversion-value-ltv"
keywords: "SKAN conversion value LTV, SKAN 매출, conversion value 설계"
tags: ["측정", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["conversion-value", "ltv", "skan"]
conditions: "이 글의 LTV 연결은 집계된 코호트의 관측 관계를 쓰는 추정이며 인과 보장이 아닙니다. fine value 제공 여부와 관측 기간은 privacy tier·window·스키마에 따라 달라집니다."
sources:
  - title: "updatePostbackConversionValue(_:completionHandler:) — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork/updatepostbackconversionvalue%28_%3Acompletionhandler%3A%29"
  - title: "SKAdNetwork.CoarseConversionValue — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork/coarseconversionvalue?changes=la_8"
faq:
  - q: "conversion value 63은 항상 가장 높은 LTV인가요?"
    a: "값의 의미는 앱이나 광고 네트워크가 정의합니다. value 63을 최고 가치로 설계할 수는 있지만, 실제 LTV 관계는 코호트 매출로 검증해야 하며 스키마가 달라지면 같은 숫자의 뜻도 달라질 수 있습니다."
  - q: "coarse value만 있으면 LTV 연결을 못 하나요?"
    a: "연결 자체는 가능합니다. 다만 low·medium·high 세 구간은 해상도가 낮으므로 더 넓은 범위의 코호트 추정으로 보고, fine value 수준의 세밀한 캠페인 결론을 주장하면 안 됩니다."
---

## conversion value는 라벨이고 LTV는 나중의 관측입니다

Apple은 conversion value의 의미를 앱 또는 광고 네트워크가 정의한다고 설명합니다. 즉 17이나 `high`는 Apple이 정한 매출액이 아닙니다. ‘가입 완료’, ‘장바구니 도달’, ‘초기 구매 구간’처럼 팀이 정한 초기 행동을 담은 라벨입니다.

LTV와 연결하려면 먼저 스키마 표를 고정합니다. 각 fine value 또는 coarse 구간에 어떤 조건이 배정됐는지, 언제부터 적용했는지, 어느 conversion window인지 기록하세요. 그다음 동일한 앱 버전·국가·채널 범위에서 나중에 관측 가능한 코호트 매출 또는 유지 지표를 붙여 구간별 분포를 봅니다.

## 추정은 구간으로 남깁니다

한 conversion value에 대해 평균 매출 하나만 붙이면 분산과 관측 부족을 감춥니다. 최소한 관측 인원, 관측 기간, 평균·중앙값 또는 분위 범위를 함께 두세요. low·medium·high처럼 큰 구간은 그 자체로 넓은 이질성을 포함할 수 있으므로, ‘LTV 3만원’ 대신 ‘현재 관측 범위에서 high 구간의 후속 가치가 더 높게 관찰됨’처럼 해석 수준을 맞춥니다.

## 스키마 변경 시 다시 보정합니다

값 정의를 바꾸면 이전 value 17과 새 value 17은 같은 신호가 아닐 수 있습니다. 변경일부터 새 코호트를 분리해 새 매핑을 다시 추정하고, 대시보드에는 스키마 버전을 노출하세요. 이 절차가 없으면 conversion value의 상승을 제품 가치 상승으로 과대해석할 수 있습니다.
