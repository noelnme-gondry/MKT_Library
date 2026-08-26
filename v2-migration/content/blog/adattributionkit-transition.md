---
title: "AdAttributionKit 전환 준비: SKAN 운영팀 체크리스트"
description: "AdAttributionKit과 SKAdNetwork의 역할을 구분하고, 전환 전에 제품·매체·수신 경로를 점검하는 방법입니다."
date: "2026-08-26"
slug: "adattributionkit-transition"
keywords: "AdAttributionKit, SKAdNetwork 전환, iOS 광고 측정, postback"
tags: ["측정", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["skan", "postback", "attribution"]
conditions: "Apple API·매체 지원 상태는 바뀔 수 있습니다. 실제 전환 일정은 사용하는 광고 네트워크·MMP·배포 대상 iOS 버전의 최신 공식 문서를 기준으로 결정하세요."
sources:
  - title: "AdAttributionKit — Apple Developer"
    url: "https://developer.apple.com/documentation/AdAttributionKit?changes=_4"
  - title: "SKAdNetwork — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork?lang=en"
faq:
  - q: "AdAttributionKit이 생기면 SKAN 데이터는 바로 없어지나요?"
    a: "그렇게 일반화할 수 없습니다. Apple은 두 API의 상호 운용 문서를 제공하고 있으며, 실제로 어떤 경로와 버전을 쓸지는 광고 네트워크와 앱 구현 조건에 따라 확인해야 합니다."
  - q: "마케터가 전환 전에 꼭 확인할 것은 무엇인가요?"
    a: "누가 광고를 서명하고, 누가 conversion value를 업데이트하며, 누가 winning postback 사본을 받고 검증하는지입니다. 이 세 책임이 문서로 하나씩 정리되지 않으면 보고 숫자가 달라졌을 때 원인을 찾기 어렵습니다."
---

## API 이름보다 책임 지도를 먼저 만드세요

AdAttributionKit에는 광고 네트워크, 광고를 표시하는 앱, 광고되는 앱이라는 참여자가 있습니다. 네트워크는 광고를 서명하고 postback을 받고, 광고되는 앱은 사용자의 행동에 따라 conversion value를 갱신합니다. 앱 개발자는 winning postback 사본을 받도록 설정할 수도 있습니다.

전환 논의에서 가장 위험한 표현은 ‘SDK만 업데이트하면 된다’입니다. 실제로는 다음 네 가지를 팀별로 확인해야 합니다.

- 광고 네트워크 또는 MMP 중 누가 광고 서명과 attribution 설정을 소유하는가
- 앱에서 누가 conversion value를 갱신하는가
- 서버 endpoint 또는 파트너 대시보드 중 어디가 postback 원본의 기준인가
- SDK·iOS·매체 버전이 섞인 기간을 어떤 보고 기준으로 분리할 것인가

## 전환 전 비교 기준을 고정합니다

전환 전후의 설치·value를 한 줄 추세로만 비교하지 마세요. API·서명 버전, conversion window, fine/coarse 비중, source identifier 자릿수, 수신 지연을 별도 열로 두고 변화를 기록해야 합니다. 이 열들이 달라진다면 숫자 차이는 캠페인 성과보다 측정 계약 변화일 수 있습니다.

## 작은 범위에서 검증합니다

Apple은 개발 환경에서 attribution과 postback을 시험하는 경로를 제공합니다. 프로덕션 전체 전환보다 한 앱 버전·한 네트워크·한 스키마에서 서명, 이벤트 갱신, postback 수신·검증을 먼저 끝내세요. 성공 기준은 ‘대시보드 숫자가 나왔다’가 아니라, 예상한 필드와 상태가 원본 postback에서 재현되는 것입니다.
