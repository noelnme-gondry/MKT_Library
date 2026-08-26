---
title: "SKAN null·누락 postback: 데이터 없음과 익명화 구분"
description: "SKAN postback에서 conversion value와 source identifier가 비거나 축소될 때 확인할 순서를 정리합니다."
date: "2026-08-26"
slug: "skan-null-redacted-postbacks"
keywords: "SKAN null, SKAN postback 누락, conversion value 없음, source identifier"
tags: ["측정", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["skan", "postback", "crowd-anonymity"]
conditions: "파라미터 존재 여부는 SKAdNetwork 버전과 postback data tier에 좌우됩니다. 수신 서버·MMP·매체의 표시값은 원본 postback과 다를 수 있으므로 원본 필드 정의를 함께 확인하세요."
sources:
  - title: "Identifying the parameters in install-validation postbacks — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/identifying-the-parameters-in-install-validation-postbacks?changes=_8%2C_8%2C_8%2C_8"
  - title: "Receiving postbacks in multiple conversion windows — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/receiving-postbacks-in-multiple-conversion-windows?changes=_2"
faq:
  - q: "conversion value가 없으면 SDK 호출이 실패한 건가요?"
    a: "그렇게 단정할 수 없습니다. 앱이 값을 제공했더라도 privacy threshold를 충족하지 않으면 해당 파라미터가 postback에 나타나지 않을 수 있고, 버전과 창에 따라 fine 값이 가능한 범위도 다릅니다."
  - q: "fine value와 coarse value가 동시에 오나요?"
    a: "Apple의 파라미터 정의상 postback에는 conversion-value 또는 coarse-conversion-value 중 하나가 담길 수 있으며 둘을 같은 행의 합산 신호처럼 읽으면 안 됩니다."
---

## 빈 필드와 미수신은 다른 사건입니다

먼저 수신 로그에 postback 자체가 있는지 확인하세요. postback이 없으면 서명, 전송 endpoint, 수신 응답, 버전 조건을 점검할 문제입니다. postback은 있는데 conversion value나 세부 source identifier가 없거나 축소됐다면, 그 다음 검토 대상은 privacy threshold와 postback data tier입니다.

Apple은 crowd anonymity을 위해 일부 파라미터의 존재 여부와 해상도를 티어에 따라 제한합니다. 따라서 `null`을 숫자 0으로 바꾸면 ‘행동 가치가 0’이라는 전혀 다른 뜻이 됩니다. 분석 테이블에는 원본값, 파싱 상태, postback version, sequence index를 따로 보존하세요.

## 확인 순서

1. `version`과 `postback-sequence-index`를 확인합니다. SKAN 4의 세 창은 같은 열을 항상 같은 방식으로 채우지 않습니다.
2. `did-win`을 분리합니다. 유효하지만 이기지 못한 postback을 전환으로 합산하면 결과가 부풀 수 있습니다.
3. `conversion-value`와 `coarse-conversion-value`를 각각 상태값으로 집계합니다. 한 값이 없는 것을 다른 값의 0으로 대체하지 않습니다.
4. `source-identifier`의 실제 자릿수로 보고 가능한 캠페인 레벨을 제한합니다.

## 보고서의 안전한 표현

‘전환 데이터가 없다’ 대신 ‘postback은 수신됐으나 세부 conversion value가 제공되지 않았다’처럼 상태를 적으세요. 이 문장은 측정 공백과 실제 행동 부재를 구분합니다. 이후에는 낮은 해상도에 맞는 coarse 구간 또는 상위 source identifier 단위로만 비교하고, 사용자 단위 성과로 되돌려 해석하지 않습니다.
