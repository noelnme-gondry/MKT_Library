---
term: "개인정보 임계 (Crowd Anonymity)"
seoTitle: "SKAN 개인정보 임계 뜻 | 데이터가 거칠어지는 이유"
shortDef: "설치 볼륨이 작으면 애플이 돌려주는 정보량을 줄이는 장치 — 티어가 낮으면 fine 값이 안 온다"
description: "crowd anonymity는 역추적을 막으려 SKAN이 정보량을 줄이는 기준입니다. 캠페인을 쪼갤수록 데이터가 거칠어지는 이유."
date: "2026-08-18"
slug: "crowd-anonymity"
keywords: "crowd anonymity, 개인정보 임계, SKAN privacy threshold, skadnetwork privacy threshold, apple privacy threshold, SKAN 티어"
relatedPosts: ["ios-att-skan-guide"]
category: "트래킹·기술"
draft: false
faq:
  - q: "fine 컨버전 밸류가 안 오는데 SDK 문제인가요?"
    a: "먼저 개인정보 임계를 의심하세요. 캠페인 구조를 세분화한 뒤 각 조각의 설치 볼륨이 줄면 티어가 내려가 fine 값과 세분화된 소스 ID가 오지 않습니다. 코드를 고치기 전에 캠페인을 합쳐 볼륨을 회복하고 다시 확인하는 편이 빠릅니다."
  - q: "임계 기준값은 얼마인가요?"
    a: "애플은 고정 수치를 공개하지 않고 버전에 따라 규칙도 바뀝니다. 특정 숫자를 가정하고 설계하기보다, 구조를 바꾼 뒤 실제로 어떤 값이 오는지 확인하는 방식이 안전합니다."
---

## 한 줄로

설치 수가 너무 적으면 돌려준 값으로 개인이 역추적될 수 있습니다. 그래서 SKAN은 볼륨이 작을 때 정보를 덜 주는데, 그 기준이 crowd anonymity(개인정보 임계)입니다.

## 무엇이 사라지나

티어가 낮으면 두 가지가 안 옵니다. 정밀한 [컨버전 밸류](/glossary/conversion-value)(fine, 0~63)와 세분화된 소스 ID예요. 대신 low·medium·high 세 단계짜리 coarse 값과 가장 거친 캠페인 식별자만 옵니다.

## SKAN 특유의 역설

보통 분석은 데이터를 잘게 쪼갤수록 좋아집니다. SKAN에서는 반대예요. 캠페인을 세분화하면 각 조각의 볼륨이 줄어 티어가 내려가고, 받을 수 있는 정보가 오히려 거칠어집니다.

그래서 안드로이드에서 쓰던 캠페인 구조를 iOS에 그대로 옮기면 iOS 데이터만 통째로 뭉개지는 일이 실제로 벌어집니다. iOS에서는 의도적으로 캠페인을 합쳐 볼륨을 만드는 편이 나을 때가 많아요.

## 더 깊게 보려면

임계가 창별 반환값에 어떻게 작용하는지는 [iOS ATT·SKAN 측정 가이드](/blog/ios-att-skan-guide)에서 다룹니다.
