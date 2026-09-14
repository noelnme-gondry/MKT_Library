---
title: "Paid vs Organic Cannibalization: How to Measure It"
description: "Diagnose internal cannibalization — paid ads eating organic conversions — and tell correlation apart from causation."
date: "2026-07-15"
updated: "2026-09-14"
slug: "cannibalization-organic-paid"
keywords: "cannibalization, internal cannibalization, organic cannibalization, paid vs organic, brand search advertising, incrementality, cannibalization rate, organic conversion decline, brand keyword bidding"
tags: ["Analysis", "Incrementality Analysis"]
draft: false
sources:
  - title: "Google Ads: About lift studies"
    url: "https://support.google.com/google-ads/answer/16104408?hl=en"
  - title: "Google Ads: Incremental conversions and attributed conversions"
    url: "https://support.google.com/google-ads/answer/14102450?hl=en-GB"
faq:
  - q: "If cannibalization exists, should I turn ads off?"
    a: "No. It is a matter of degree — some cannibalization can coexist with real net lift. What you need is a corrected ROAS to decide with, not an on/off switch."
  - q: "Is brand search advertising always cannibalization?"
    a: "Not necessarily. When competitors bid on your brand terms it has defensive value. A suitably designed holdout can estimate net lift; check its assumptions and uncertainty."
  - q: "Paid and organic both went up. Doesn't that rule out cannibalization?"
    a: "Moving together proves nothing on its own. Advertising may have created new demand, or it may simply have been peak season. Use a suitable comparison design and examine its assumptions and uncertainty to distinguish these explanations."
  - q: "How do I calculate a cannibalization rate?"
    a: "Under comparable groups, aligned measurement and a suitable design, divide organic gains by paid losses. A 100-conversion paid loss and 70-conversion organic gain give an arithmetic 70%, but a simple before/after difference does not identify cannibalization or net lift."
reviewedAt: "2026-09-14"
reviewer: "Codex (AI-assisted editorial audit)"
---
If organic traffic rises after brand-search ads are paused, investigate whether paid ads were replacing visits that would have arrived organically. That substitution is internal cannibalization. Before/after totals alone cannot establish it.

## Why it's dangerous

Performance reports credit every ad-touched conversion to the ad (attribution). But some of those people would have arrived organically without the ad at all. If you don't subtract that share, you'll overrate your ad efficiency.

Cannibalization is especially common on ads that attach to people who already know you: brand keywords, retargeting. Someone searching your brand name was already looking for you.

The problem is that this illusion drives budget decisions. Heavily cannibalizing campaigns usually show the *best* ROAS in the report, because they harvest conversions from people who were already ready to buy. So they get labelled "our best campaign," get more budget, and convert even more organic traffic into paid — a loop that spends more to buy the same outcome.

## What it looks like in numbers

This arithmetic example assumes stable conditions and measurement definitions, with a suitable comparison design establishing the counterfactual without advertising. It is not a causal interpretation of a simple account-level before/after comparison.

Before pausing the brand campaign: 100 paid conversions, 200 organic, 300 total. After pausing it: 0 paid, 270 organic, 270 total.

- Paid conversions lost: 100
- Organic conversions gained: 70 → the substituted share under those assumptions
- Total conversion difference: 30 → net lift under those assumptions

The cannibalization rate is 70 ÷ 100 = 70%. The report attributes 100 conversions; the assumed design implies 30 incremental conversions. At the same spend, iCPA is 100 ÷ 30 ≈ 3.33 times the attributed CPA.

The key point: finding cannibalization is not an argument for switching the campaign off. If the CPA of those 30 net conversions still clears your target, there is a reason to keep running. Cannibalization is a signal to re-judge with corrected numbers, not an on/off verdict.

This arithmetic example assumes stable conditions and measurement definitions. Actual before/after totals alone do not identify 30 conversions as causal lift. Regional assignment requires regional inference; do not treat regional totals as independent person/device binomial samples.

## Signs to suspect cannibalization

A few signals show up first in observational data.

- You raised spend but total (organic + paid) conversions didn't rise by as much. Paid rising while organic falls can reflect displacement, tracking reclassification, or other changes.
- Was organic already declining before you raised spend? A cause has to come first to even be a candidate.
- After removing seasonality and overall trend, does organic still fall when paid rises?
- Is impression share on brand terms climbing while total clicks stay flat? That is the classic shape of paid displacing organic.

Scanning for these patterns is what the cannibalization diagnosis in [marketing response analysis](/tools/marketing-response) does. But be clear: what comes out is correlation, not causation.

### The same numbers admit three explanations

| Possible explanation | Additional evidence | What this table establishes |
| --- | --- | --- |
| Ads substitute for organic | Randomized holdout totals and uncertainty | Without the design, substitution remains a hypothesis |
| Seasonality or a promotion changes | An unpaused comparison group and pre-trends | The before/after drop cannot isolate an ad effect |
| Attribution labels change | Tracking settings, windows and UTM history | Whether paid/organic movement reflects actual demand is unknown |

The practice reveals paid/organic patterns. Choosing among these explanations requires context and a suitable comparison design.

<!-- CONTENT_ACTION -->

## Confirm it with an experiment

Observation alone can't declare "the ad caused the organic drop." The two may have moved together by coincidence, driven by a different factor (season ending, an app update, a competitor promo).

The real test is [incrementality analysis](/tools/incrementality). Turn brand ads off for a random subset of regions or users (holdout) and compare that group's total conversions against the un-held group. Similar point estimates are not enough: the interval must be narrow enough to rule out a business-relevant effect before calling cannibalization heavy. If the held-out group's total conversions clearly drop, the ad is pulling its weight.

Three design mistakes come up repeatedly.

- **Reading paid conversions only.** Pause the ads and paid conversions go to zero by construction. The quantity to watch is paid plus organic combined.
- **Running too short.** Search rankings and user habits take time to re-settle. A short holdout can be unstable because of delay, carryover, and variability; the direction of bias is not guaranteed.
- **Splitting regions that aren't comparable.** Hold out your capital city while running everywhere else and the two groups had different baseline conversion rates to begin with, so the gap cannot be read as ad effect.

## Brand keywords are the confusing case

Brand search is the textbook example of cannibalization, but that does not mean switch it off. The verdict hinges on one condition.

If competitors bid on your brand name, pausing your ads may make competing ads more prominent. Defensive value and cannibalization can coexist; validate net lift separately. Even without competing bids, check actual organic rankings and the search-result layout. A branded query alone does not establish a top organic position or cannibalization.

Either way, do not leave brand campaigns in the same campaign as generic keywords. Mixed together, the strong efficiency of brand traffic lifts the blended average and hides how new-user acquisition is actually performing.

## Try this today

Put paid conversions and organic conversions in one weekly table, side by side, and add a spend column next to them.

For the weeks where spend moved sharply, check one thing: did total conversions move in the same direction? If spend rose and the total stayed flat, you now have grounds to suspect cannibalization. That is not evidence — it is a reason to run the experiment.

Once CPA is recalculated with the cannibalisation rate applied, [marketing budget allocation](/blog/budget-marginal-efficiency) covers how to move budget on that number and [ad budget scaling limits](/blog/budget-scaling-limit) covers the ceiling. The broader designs for separating what advertising actually caused are in [incrementality measurement](/blog/incrementality-measurement).

## Let's be honest

"Looks like cannibalization" and "is cannibalization" are different things. Observational signals (leading order, de-trended movement) are grounds for suspicion, no more. And the burden of proof is asymmetric: to declare "this ad has no effect," you need strong evidence like a holdout.

If paid and organic always move together and can't be told apart (collinearity), don't manufacture a number — "inconclusive" is the honest answer. Knowing what you can't know right now protects the budget better than inventing causation.

One more caveat: a cannibalization rate is not a constant. It shifts with channel, season, and competitive pressure, and the 70% you measured today may not hold in six months. For campaigns carrying a large share of budget, re-measure periodically.
