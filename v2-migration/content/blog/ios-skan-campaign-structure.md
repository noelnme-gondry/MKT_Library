---
title: "iOS SKAN 캠페인 구조: source identifier 해상도 설계"
description: "SKAN 4의 계층형 source identifier를 기준으로 캠페인 분리와 측정 해상도의 균형을 잡는 방법입니다."
date: "2026-08-26"
slug: "ios-skan-campaign-structure"
keywords: "SKAN campaign structure, source identifier, iOS 캠페인 구조, SKAN 4"
tags: ["측정", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["skan", "crowd-anonymity", "attribution-window"]
conditions: "identifier의 실제 배정과 매체 UI 매핑은 광고 네트워크별로 다릅니다. 이 글은 Apple이 정의한 계층형 identifier와 privacy tier의 제약을 구조 설계에 적용하는 일반 원칙입니다."
sources:
  - title: "SKAdNetwork 4 release notes — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork-4-release-notes"
  - title: "Receiving postbacks in multiple conversion windows — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/receiving-postbacks-in-multiple-conversion-windows?changes=_2"
faq:
  - q: "네 자리 source identifier면 네 단계 캠페인을 항상 볼 수 있나요?"
    a: "아닙니다. Apple은 postback data tier에 따라 두·세·네 자리 중 일부를 반환할 수 있습니다. 네 자리 구조는 설계 가능한 최대 해상도이지 모든 행의 보장 해상도가 아닙니다."
  - q: "캠페인을 합치면 측정이 무조건 좋아지나요?"
    a: "합치기는 해상도와 볼륨의 교환입니다. 판단에 쓰지 않는 세부 분할은 줄일 수 있지만, 서로 다른 예산 결정을 한데 묶으면 결과가 좋아 보여도 실행 가능한 결론을 잃을 수 있습니다."
---

## 앞자리에는 바뀌지 않는 결정을 둡니다

Apple의 SKAN 4 release notes는 source identifier를 네 자리 정수로 설명하며, postback에는 privacy threshold tier에 따라 두·세·네 자리가 나타날 수 있다고 안내합니다. 이 제약은 identifier의 앞자리부터 설계해야 한다는 뜻입니다.

예를 들어 앞 두 자리에 국가 또는 큰 캠페인 목적처럼 예산을 실제로 옮길 수 있는 단위를 둡니다. 뒤 자리는 소재·광고그룹·세부 가설처럼 높은 해상도가 확보될 때만 쓰는 분할에 배정합니다. 어떤 앞자리 체계가 맞는지는 조직의 결정 구조에 따라 다르지만, ‘두 자리만 남아도 이번 주 예산 결정을 할 수 있는가’는 공통 질문입니다.

## 구조 변경을 성과 변화와 분리합니다

identifier 배정을 바꾼 주에는 이전·이후의 세부 캠페인 성과를 같은 축으로 이어 붙이지 마세요. 구조 변경일, 매핑 버전, 반환 자릿수 분포를 함께 저장하고 비교를 상위 공통 단위로 올립니다. 이 과정을 생략하면 구조가 바뀌어 집계가 달라진 것을 캠페인 개선 또는 악화로 읽게 됩니다.

## 출시 전 확인할 세 가지

1. 네트워크 또는 MMP에서 identifier 각 자리가 무엇을 뜻하는지 문서화합니다.
2. 2자리만 온 postback으로도 예산·중단 결정을 할 수 있는지 표본 보고서를 만듭니다.
3. 새 구조의 이름·기간·스키마 버전을 같은 변경 로그에 기록합니다.

광고 계정의 계층을 예쁘게 복제하는 것보다, privacy tier가 낮을 때도 남는 비교 단위를 먼저 만드는 것이 SKAN 구조 설계의 핵심입니다.
