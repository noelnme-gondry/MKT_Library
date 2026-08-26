---
title: "SKAN crowd anonymity 티어: 왜 값이 줄어드는가"
description: "SKAN 4 postback tier가 source identifier·conversion value 해상도를 제한하는 방식을 설명합니다."
date: "2026-08-26"
slug: "skan-crowd-anonymity-tiers"
keywords: "SKAN crowd anonymity, SKAN 티어, conversion value, source identifier"
tags: ["측정", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["crowd-anonymity", "skan", "conversion-value"]
conditions: "이 글은 SKAdNetwork 4 postback을 해석할 때 적용합니다. 실제 반환 필드는 광고 네트워크의 서명 버전, iOS·SDK 조건, Apple의 privacy threshold에 따라 달라집니다."
sources:
  - title: "Receiving postbacks in multiple conversion windows — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/receiving-postbacks-in-multiple-conversion-windows?changes=_2"
  - title: "SKAdNetwork — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork?lang=en"
faq:
  - q: "crowd anonymity 티어가 낮으면 설치가 사라지나요?"
    a: "설치 자체가 반드시 사라진다는 뜻은 아닙니다. 티어는 postback에 담을 수 있는 일부 세부 필드와 source identifier 자릿수, fine·coarse conversion value의 제공 범위를 제한합니다."
  - q: "티어를 높이기 위해 conversion value를 적게 써야 하나요?"
    a: "값을 적게 쓰는 것만으로 티어가 올라간다고 볼 수 없습니다. 먼저 캠페인 구조와 관측 볼륨을 확인하고, 낮은 해상도에서도 의사결정할 수 있는 coarse 값 정의를 준비하세요."
---

## 티어는 점수가 아니라 보고 해상도입니다

SKAN 4에서는 Apple이 각 다운로드에 postback data tier를 정합니다. 이 티어는 같은 캠페인이라도 항상 같은 수준의 세부 정보를 돌려준다는 보장이 없다는 뜻입니다. 낮은 티어에서 값이 줄었다고 해서 광고가 전달되지 않았거나 SDK가 바로 실패한 것은 아닙니다.

티어가 영향을 주는 대표 필드는 `source-identifier`, `conversion-value`, `coarse-conversion-value`, 앱 지면의 `source-app-id`, 웹 지면의 `source-domain`, `country-code`입니다. 특히 source identifier는 2·3·4자리 중 일부만 돌아올 수 있습니다. 캠페인 보고서를 4자리 구조로 설계했다면, 2자리만 받은 행으로 세부 캠페인까지 복원하려 해서는 안 됩니다.

## fine 값이 없을 때 읽는 순서

첫 번째 창에서만 fine conversion value를 받을 수 있고, 낮은 티어 또는 뒤 창에서는 coarse value가 쓰일 수 있습니다. `low`·`medium`·`high`는 Apple이 정한 매출 구간이 아니라 앱 또는 광고 네트워크가 정의한 상대 구간입니다. 따라서 먼저 현재 스키마에서 각 구간이 어떤 행동·가치에 대응하는지 확인하세요.

다음으로 같은 기간에 티어별 비중, source identifier 자릿수, fine/coarse/미제공 비중을 나눠 봅니다. 이 세 비중이 동시에 바뀌면 제품 이벤트보다 측정 해상도 변화일 수 있습니다. 반대로 해상도 비중은 그대로인데 특정 conversion value만 하락했다면 그때 이벤트·퍼널 변화를 검토할 근거가 생깁니다.

## 운영 원칙

낮은 해상도를 0으로 채우거나, fine 값이 없는 행을 실패로 제외하지 마세요. 보고서에는 ‘값 없음’과 ‘coarse 값’과 ‘fine 값’을 별도 상태로 남기고, 예산 판단은 그 상태별로 가능한 수준까지로 제한합니다. 더 세밀한 캠페인 구조가 언제나 더 좋은 측정으로 이어지는 것도 아닙니다. 해상도보다 먼저, 낮은 해상도에서도 유지되는 의사결정 단위를 정하는 편이 안전합니다.
