---
term: "Cannibalization"
seoTitle: "Cannibalization: Is Paid Stealing Your Organic?"
searchTitleTerms: ["Cannibalization"]
shortDef: "When paid ads steal conversions that would have happened organically anyway"
description: "Cannibalization is paid advertising taking conversions that would have arrived organically. Why it inflates measured efficiency, and how to check."
date: "2026-07-18"
updated: "2026-08-26"
slug: "cannibalization"
keywords: "cannibalization, cannibalization meaning, organic paid cannibalization, ad cannibalization"
category: "Measurement & Methodology"
relatedPosts: ["cannibalization-organic-paid"]
sources:
  - title: "Google Ads: About lift studies"
    url: "https://support.google.com/google-ads/answer/16104408?hl=en"
draft: false
faq:
  - q: "How do you check for cannibalization?"
    a: "An organic increase after pausing ads does not by itself confirm cannibalization. Use a suitable experimental design, such as a randomized holdout, to compare total conversions in the paused group with a comparable control. Check aligned measurement definitions, concurrent changes such as seasonality or promotions, and uncertainty in the estimate."
  - q: "Is brand keyword advertising cannibalization?"
    a: "People searching a brand name may arrive without an ad, so cannibalization is possible. That does not establish that its share is large. Consider competitors bidding on brand terms, organic search visibility and existing demand, then assess net lift and uncertainty for each campaign using a suitable comparison design and aligned measurement. Also separate attributed performance for brand and generic terms."
  - q: "If paid and organic both rise, is that not proof there is no cannibalization?"
    a: "Moving together proves nothing on its own. Advertising may have created new demand, or the period may simply have been a seasonal peak. A simple before-and-after comparison does not establish the counterfactual: what would have happened without advertising. Use a suitable design with random assignment or a comparable control, aligned measurement definitions, and checks of concurrent changes, design assumptions and uncertainty."
  - q: "How do you calculate the cannibalization rate?"
    a: "This arithmetic example assumes comparable groups, aligned measurement definitions and a suitable design estimating what would have happened without advertising. A loss of 100 paid conversions and gain of 70 organic conversions gives a cannibalization rate of 70 ÷ 100 = 70% and net lift of 100 − 70 = 30 conversions. At the same ad spend, incremental CPA is 100 ÷ 30 ≈ 3.33 times attributed CPA. Without those conditions, 70% is only an observed ratio; a simple before-and-after difference cannot identify causal cannibalization, net lift or incremental CPA. Decisions also require examining uncertainty in the estimate."
---

## In one line

Sometimes a paid ad simply takes traffic that would have arrived organically for free. That is cannibalization, and it shows up most on ads aimed at people who already know you — brand search, retargeting.

## Why it's risky

Performance reports credit every conversion to the ad that touched it last. If some of those users would have converted organically regardless, not subtracting that share makes ad efficiency look better than it really is.

## How to confirm it

Observation alone can't prove cannibalization exists. A [holdout test](/glossary/holdout-test) — randomly turning the ad off for part of your audience and comparing total conversions — is the real way to confirm it.

> **Cannibalization rate = organic conversions gained after pausing ÷ paid conversions lost**

If paid conversions fall by 100 while organic rises by 70, the observed cannibalization rate is 70% and the remaining net increment is 30 conversions. Without random assignment or a comparable control, treat that rate as a diagnostic signal rather than a causal estimate.

| Observation | What it may mean | Decision use |
| --- | --- | --- |
| Paid falls while total stays flat | Organic substitution is plausible | Pause scaling and design a holdout |
| Total conversions also fall | Some net increment may exist | Recalculate incremental CPA or ROAS |
| Interval crosses zero | Current data cannot distinguish the effect | Do not translate it as no effect |

## Go deeper

Signals that suggest cannibalization, and how to confirm it, are covered in [Diagnosing Cannibalization](/blog/cannibalization-organic-paid).
