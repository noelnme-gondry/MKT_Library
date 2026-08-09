---
term: "확률적 매칭 (Probabilistic Attribution)"
seoTitle: "확률적 매칭 뜻 | 결정론적 매칭과 뭐가 다른가"
shortDef: "고유 ID 없이 기기·시간 정보의 패턴만으로 광고 클릭과 앱 설치를 확률적으로 짝지어주는 방식"
description: "고유 식별자 없이 기기·시간 패턴으로 클릭과 설치를 잇는 어트리뷰션. 결정론적 매칭과의 차이와 한계."
date: "2026-07-18"
slug: "probabilistic-attribution"
keywords: "확률적 매칭, Probabilistic Attribution, 핑거프린팅, Fingerprinting, IDFA 없는 어트리뷰션, iOS 어트리뷰션"
relatedPosts: ["attribution-data-mismatch"]
category: "트래킹·기술"
draft: false
---

## 한 줄로

**확률적 매칭(Probabilistic Attribution)**은 IDFA 같은 고유 식별자를 못 쓸 때, 기기 모델·OS 버전·시간대·IP대역 같은 정보의 패턴만 보고 "이 클릭과 이 설치가 같은 사람일 확률이 높다"고 **추정으로 연결**하는 어트리뷰션 방식이에요.

## 왜 등장했나

과거에는 IDFA(광고 식별자) 같은 고유 ID로 클릭과 설치를 정확히 1:1로 연결할 수 있었어요. 하지만 iOS의 ATT(App Tracking Transparency) 도입 이후 유저 동의 없이는 이 ID를 못 쓰게 되면서, 고유 ID 없이도 어느 정도 연결을 추정할 방법이 필요해졌고 그 대안 중 하나가 확률적 매칭이에요.

## 결정론적 매칭과 뭐가 다른가

- **결정론적(Deterministic) 매칭**: 고유 ID로 100% 확실하게 연결. 정확하지만 유저 동의가 필요해요.
- **확률적(Probabilistic) 매칭**: 고유 ID 없이 정황 정보로 "아마 같은 사람일 것"이라고 추정. 프라이버시 부담은 적지만, **오차가 낄 수 있어요.**

## 왜 조심해야 하나

확률적 매칭은 정확도가 100%가 아니에요. 잘못 매칭된 전환이 섞이면 특정 채널의 성과가 실제보다 부풀려지거나 줄어들 수 있어요. 이런 배경 때문에 개인 단위 추적 없이 채널 기여를 보는 [MMM](/blog/marketing-mix-modeling) 같은 방법론이 다시 주목받고 있어요.

## 더 깊게 보려면

매체·자체 데이터 숫자가 서로 다른 다른 이유들은 [어트리뷰션 데이터 불일치 글](/blog/attribution-data-mismatch)에서 다룹니다.
