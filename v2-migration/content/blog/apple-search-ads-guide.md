---
title: "Apple Search Ads(ASA) 키워드 발굴: Exact 승격과 CPT 입찰 조정"
description: "ASA 검색어 리포트에서 Exact 승격 후보를 고르고, 예산 소진률·목표 CPA로 CPT 입찰가를 조정하는 실무 루프를 정리합니다."
date: "2026-08-09"
slug: "apple-search-ads-guide"
keywords: "Apple Search Ads, ASA, 애플 서치 애즈, ASA 키워드 발굴, ASA Exact 승격, ASA CPT, ASA 입찰가, ASA 검색어 리포트, ASA 캠페인 구조, 앱스토어 검색 광고"
tags: ["ASA", "UA"]
draft: false
primaryTool: "5-26"
relatedGlossary: ["cpi", "cpa"]
answer: "Apple Search Ads(ASA)에서는 검색어 리포트에서 충분한 탭·설치와 목표 CPA를 함께 충족한 비-Exact 검색어를 Exact 후보로 올리세요. 예산을 덜 쓰면서 성과가 좋으면 CPT를 조금 높이고, 많이 쓰면서 성과가 나쁘면 낮춥니다."
conditions: "설치 3건·탭 8건과 CPT ±10~15%는 이 서비스의 기본 운영 휴리스틱입니다. 계정 규모와 변동성에 맞게 조정하고, 실제 매치 범위·입찰 한도는 현재 Apple Ads 콘솔을 확인하세요."
reviewedAt: "2026-08-09"
reviewer: "Growth Opt Playbook"
sources:
  - title: "Apple Ads: 키워드 매치 타입"
    url: "https://ads.apple.com/app-store/help/keywords/0059-understand-keyword-match-types"
  - title: "Apple Ads: 키워드 입찰 고려사항"
    url: "https://ads.apple.com/app-store/help/bids-and-budget/0076-considerations-for-keyword-bids"
  - title: "Apple Ads: 예산 관리"
    url: "https://ads.apple.com/app-store/help/bids-and-budget/0016-manage-budgets"
faq:
  - q: "ASA Exact는 검색어가 완전히 같을 때만 노출되나요?"
    a: "아닙니다. Exact는 가장 통제가 강한 매치 타입이지만, Apple 안내에 따르면 철자 변형·단복수·어순 변경·번역처럼 가까운 변형에도 매칭될 수 있습니다."
  - q: "예산 소진이 낮으면 CPT를 무조건 올려야 하나요?"
    a: "아닙니다. 목표 CPA를 달성하면서 소진이 낮을 때만 증액 후보입니다. 성과가 나쁘면 검색어와 상품 페이지, 국가, 시즌성을 먼저 확인하세요."
---

Apple Search Ads(ASA)를 캠페인 하나로 켜면 며칠 뒤 리포트에 브랜드 키워드만 크게 남는 일이 많아요. 원래 앱을 찾던 사람까지 광고로 다시 사 온 결과일 수 있죠. ASA는 앱스토어 검색 상단에서 **의도가 뚜렷한 유저**를 만나는 채널입니다. 그래서 캠페인을 목적별로 나누고, 검색어를 발굴한 뒤 Exact와 입찰가를 조정하는 운영 루프가 필요해요.

## 캠페인 구조

ASA는 보통 키워드 목적별로 캠페인을 나눠요.

- **브랜드**: 우리 앱·회사명 검색. CPA는 싸지만 [오가닉 잠식](/blog/cannibalization-organic-paid) 위험이 큼(어차피 올 사람).
- **경쟁사**: 경쟁 앱 이름 검색. 뺏어오기.
- **카테고리(제네릭)**: "가계부", "운동 기록" 같은 일반어. 신규 수요.
- **디스커버리**: 애플이 자동으로 키워드를 탐색. 여기서 좋은 키워드를 발굴해 위 캠페인으로 승격.

목적을 섞으면 예산·입찰 관리가 엉켜요. 나눠야 "어디가 돈이 되는지" 보여요.

## 매치 타입

- **Exact(정확)**: 가장 통제가 강한 매치 타입. 철자·단복수·어순 같은 가까운 변형에는 매칭될 수 있음.
- **Broad(광범위)**: 변형·연관어까지. 발굴용.

디스커버리·브로드로 넓게 탐색한 뒤 검색어(search term) 리포트에서 성과가 검증된 항목을 찾습니다. 그 검색어는 Exact로 승격하고, 나쁜 검색어는 제외 키워드 후보로 관리해요. 이 루프가 ASA 운영의 핵심입니다.

![ASA 검색어 발굴과 Exact 승격, CPT 조정 루프](/blog-assets/apple-search-ads-guide/keyword-loop.svg)

## Exact 승격 후보는 이렇게 고르세요

Exact는 “성과가 좋아 보이는 단어”를 옮기는 곳이 아니라, 이미 **통제할 가치가 확인된 검색어**를 고정하는 곳이에요. 아래 세 조건을 함께 보세요.

- Search Match·Broad처럼 아직 Exact가 아닌 검색어일 것
- 최소 설치·탭 수가 쌓였을 것(예: 설치 3건, 탭 8건 이상)
- 목표 CPA를 달성했을 것

세 조건을 통과하면 기존 검색어 타겟과 같은 키워드를 Exact에 추가하고, 다음 리포트에서 중복 경합이 생기지 않는지 확인합니다. 승격 자체가 원래 Broad를 바로 끄라는 뜻은 아니에요. Exact는 검증된 검색어의 예산·CPT를 따로 통제하기 위한 자리입니다.

## 예산보다 덜 쓰는데 성과가 좋다면 CPT를 올리세요

일일 예산을 설정했는데 실제 소진이 계속 낮고, CPA는 목표보다 좋다면 노출 기회를 못 잡고 있을 수 있어요. 이 경우에는 예산을 먼저 크게 바꾸기보다 **CPT를 작은 폭으로 올려** 경매 참여 기회를 늘려보는 편이 원인을 구분하기 쉽습니다. 아래 수치는 Apple의 공식 입찰 규칙이 아니라 이 서비스가 쓰는 기본 운영 휴리스틱입니다.

- 예산 대비 소진이 70% 미만이고 목표 CPA를 달성: CPT +10% 제안
- 소진이 40% 미만이고 목표 CPA를 달성: CPT +15%까지 검토

반대로 예산을 많이 쓰는데 목표 CPA를 못 맞춘다면 CPT를 낮춥니다.

- 예산 대비 소진이 110%를 넘고 목표 CPA를 미달: CPT −10% 제안
- 소진이 140%를 넘고 목표 CPA를 크게 미달: CPT −15%까지 검토

소진이 낮아도 성과가 나쁘면 CPT를 올리면 안 됩니다. 검색어·상품 페이지·국가·시즌성부터 확인해야 해요. 소진이 높고 성과가 좋다면 CPT를 더 올리기보다 예산 한도와 증분성을 따로 검토하는 편이 안전합니다.

[ASA 키워드 발굴 · CPT 조정 도구](/tools/asa-keyword-finder)에서는 이 규칙으로 Exact 승격·제외 검토·CPT 증감 후보를 CSV에서 바로 정리할 수 있어요.

## 초기 세팅 순서

1. 브랜드 캠페인(방어) — 단, 잠식 여부 체크
2. 카테고리 Exact 소수로 시작
3. 디스커버리로 신규 키워드 발굴
4. 검색어 리포트 → 승격/제외 반복

세부 절차는 [Apple Search Ads 가이드](/guide/apple-search-ads)에 있어요.

## 브랜드 키워드, 증분 확인하세요

브랜드 캠페인이 제일 헷갈려요. CPA가 싸서 좋아 보이지만, **그 설치가 광고 없이도 왔을 설치**일 수 있어요. 정말 증분이 있는지는 [증분 분석](/tools/incrementality)으로 일부 껐다 켜보며 확인하는 게 정석이에요.

## 정직하게

ASA UI·매치 타입·정책은 애플이 계속 바꿔요. 이 글의 구조는 운영 원칙이고, 실제 세팅 화면·허용 범위·입찰 한도는 현재 콘솔과 공식 문서를 확인하세요.
