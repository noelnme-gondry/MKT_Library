---
title: "매체별 SKAN 처리 차이: 표준과 플랫폼 설정 구분"
description: "Apple SKAN 표준과 Google·TikTok 등 매체·MMP의 conversion value 운영 설정을 분리해 점검하는 방법입니다."
date: "2026-08-26"
slug: "skan-network-differences"
keywords: "SKAN 매체별 차이, SKAN Google Ads, TikTok SKAN, conversion value"
tags: ["측정", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["skan", "conversion-value", "postback"]
conditions: "매체 제품 설정과 지원 범위는 자주 바뀝니다. 실제 집행 시에는 해당 매체·MMP의 최신 공식 문서와 계정 설정을 최종 기준으로 확인해야 합니다."
sources:
  - title: "SKAdNetwork — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork?lang=en"
  - title: "Set up your SKAdNetwork conversion value schema — Google Analytics Help"
    url: "https://support.google.com/analytics/answer/13165271?hl=en"
  - title: "Integrate App Events SDK — TikTok for Business"
    url: "https://ads.tiktok.com/help/article/how-to-integrate-tiktok-app-events-sdk"
faq:
  - q: "Google·TikTok·MMP가 모두 있으면 각각 schema를 올려도 되나요?"
    a: "각 제품의 지원 방식은 확인해야 하지만, 하나의 앱에서 여러 SDK가 SKAN conversion value를 중복 갱신하면 충돌할 수 있습니다. value 업데이트 책임자를 하나로 정하고 다른 SDK의 관련 기능은 그 설계에 맞게 끄거나 설정하세요."
  - q: "매체 대시보드와 원본 postback 건수가 다른 것은 오류인가요?"
    a: "즉시 오류로 단정할 수 없습니다. 수신 시점, 중복 제거, attribution·모델링·집계 규칙이 다를 수 있으므로 각 보고서의 정의와 원본 postback 처리 규칙을 먼저 맞춰야 합니다."
---

## 표준은 Apple, 운영 책임은 각 도구입니다

SKAN의 conversion window, postback parameter, privacy tier는 Apple이 정한 계약입니다. 반면 conversion value 스키마를 어느 화면에서 설정하고 어떤 SDK가 값을 갱신하며 어떤 대시보드가 보고 기준인지에는 매체와 MMP의 구현이 들어갑니다.

예를 들어 Google Analytics는 SKAN 4의 창별 스키마와 fine·coarse value 매핑을 설정하는 기능을 제공합니다. TikTok은 MMP 또는 다른 SDK가 conversion value를 갱신한다면 TikTok SDK의 SKAN 지원을 꺼 중복 갱신을 피하라고 안내합니다. 이 차이는 Apple 표준이 달라서가 아니라, 각 제품이 표준 위에 얹는 운영 경로가 다르기 때문입니다.

## 먼저 한 명의 value 소유자를 정합니다

앱 팀, MMP, 매체 SDK가 각각 이벤트를 수집하더라도 SKAN conversion value를 최종 갱신하는 주체는 하나여야 합니다. 다음 표를 릴리스 전 문서화하세요.

- 앱별 value 스키마의 소유자와 변경 승인자
- SDK별 SKAN update 기능의 ON/OFF 상태
- 네트워크별 postback 수신·검증 주체
- 대시보드 수치와 원본 postback을 대사하는 주기

## 비교할 때는 정의를 먼저 맞춥니다

매체 대시보드가 보여 주는 모델링·집계 값과 Apple postback 원본을 같은 행처럼 합치지 마세요. 먼저 version, window, did-win, 중복 제거, 수신 지연, value 제공 상태를 맞춘 뒤 차이를 해석합니다. 차이가 남으면 ‘어느 숫자가 맞나’보다 ‘각 숫자가 어떤 질문에 답하나’를 분리하는 편이 안전합니다.
