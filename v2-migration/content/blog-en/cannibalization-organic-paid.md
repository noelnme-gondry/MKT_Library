---
title: "Paid vs Organic Cannibalization: How to Measure It"
description: "Diagnose internal cannibalization — paid ads eating organic conversions — and tell correlation apart from causation."
date: "2026-07-15"
updated: "2026-08-17"
slug: "cannibalization-organic-paid"
keywords: "cannibalization, internal cannibalization, organic cannibalization, paid vs organic, brand search advertising, incrementality, cannibalization rate, organic conversion decline, brand keyword bidding"
tags: ["Analysis", "Incrementality Analysis"]
draft: false
faq:
  - q: "If cannibalization exists, should I turn ads off?"
    a: "No. It is a matter of degree — some cannibalization can coexist with real net lift. What you need is a corrected ROAS to decide with, not an on/off switch."
  - q: "Is brand search advertising always cannibalization?"
    a: "Not necessarily. When competitors bid on your brand terms it has defensive value. An on/off test is the only reliable way to measure the actual net lift."
  - q: "Paid and organic both went up. Doesn't that rule out cannibalization?"
    a: "Moving together proves nothing on its own. Advertising may have created new demand, or it may simply have been peak season. You need a control group or a pre/post design to construct the counterfactual."
  - q: "How do I calculate a cannibalization rate?"
    a: "Divide the organic conversions gained in the held-out group by the paid conversions it lost. If 100 paid conversions disappear and organic rises by 70, the cannibalization rate is 70% and net lift is 30. Without random assignment, that number is not causal."
---

Turn off brand-search ads and organic traffic rises by exactly that much? Then that ad spend was re-buying people who were coming anyway. That's internal cannibalization — paid eating into free traffic.

## Why it's dangerous

Performance reports credit every ad-touched conversion to the ad (attribution). But some of those people would have arrived organically without the ad at all. If you don't subtract that share, you'll overrate your ad efficiency.

Cannibalization is especially common on ads that attach to people who already know you: brand keywords, retargeting. Someone searching your brand name was already looking for you.

The problem is that this illusion drives budget decisions. Heavily cannibalizing campaigns usually show the *best* ROAS in the report, because they harvest conversions from people who were already ready to buy. So they get labelled "our best campaign," get more budget, and convert even more organic traffic into paid — a loop that spends more to buy the same outcome.

## What it looks like in numbers

A simple worked example to build intuition (numbers are illustrative).

Before pausing the brand campaign: 100 paid conversions, 200 organic, 300 total. After pausing it: 0 paid, 270 organic, 270 total.

- Paid conversions lost: 100
- Organic conversions gained: 70 → people who would have come anyway
- Actual conversions lost: 30 → this is the ad's net lift

The cannibalization rate is 70 ÷ 100 = 70%. The report credits this campaign with 100 conversions; it really produced 30. Its CPA needs to be recalculated at roughly three times what the dashboard shows.

The key point: **finding cannibalization is not an argument for switching the campaign off.** If the CPA of those 30 net conversions still clears your target, there is a reason to keep running. Cannibalization is a signal to re-judge with corrected numbers, not an on/off verdict.

## Signs to suspect cannibalization

A few signals show up first in observational data.

- You raised spend but total (organic + paid) conversions didn't rise by as much. If paid went up while organic fell, you just shuffled the seat.
- Was organic already declining before you raised spend? A cause has to come first to even be a candidate.
- After removing seasonality and overall trend, does organic still fall when paid rises?
- Is impression share on brand terms climbing while total clicks stay flat? That is the classic shape of paid displacing organic.

Scanning for these patterns is what the cannibalization diagnosis in [marketing response analysis](/tools/marketing-response) does. But be clear: what comes out is correlation, not causation.

<!-- CONTENT_ACTION -->

## Confirm it with an experiment

Observation alone can't declare "the ad caused the organic drop." The two may have moved together by coincidence, driven by a different factor (season ending, an app update, a competitor promo).

The real test is [incrementality analysis](/tools/incrementality). Turn brand ads off for a random subset of regions or users (holdout) and compare that group's total conversions against the un-held group. If the difference is near zero, the ad has no incremental lift — strong evidence of heavy cannibalization. If the held-out group's total conversions clearly drop, the ad is pulling its weight.

Three design mistakes come up repeatedly.

- **Reading paid conversions only.** Pause the ads and paid conversions go to zero by construction. The quantity to watch is paid plus organic combined.
- **Running too short.** Search rankings and user habits take time to re-settle. A holdout of a few days understates cannibalization.
- **Splitting regions that aren't comparable.** Hold out your capital city while running everywhere else and the two groups had different baseline conversion rates to begin with, so the gap cannot be read as ad effect.

## Brand keywords are the confusing case

Brand search is the textbook example of cannibalization, but that does not mean switch it off. The verdict hinges on one condition.

If competitors bid on your brand name, pausing your ads hands that slot to them. There the brand campaign is not cannibalization but a defensive cost. If nobody else bids on your name, the organic top slot is already yours and cannibalization is likely.

Either way, do not leave brand campaigns in the same campaign as generic keywords. Mixed together, the strong efficiency of brand traffic lifts the blended average and hides how new-user acquisition is actually performing.

## Try this today

Put paid conversions and organic conversions in one weekly table, side by side, and add a spend column next to them.

For the weeks where spend moved sharply, check one thing: **did total conversions move in the same direction?** If spend rose and the total stayed flat, you now have grounds to suspect cannibalization. That is not evidence — it is a reason to run the experiment.

## Let's be honest

"Looks like cannibalization" and "is cannibalization" are different things. Observational signals (leading order, de-trended movement) are grounds for suspicion, no more. And the burden of proof is asymmetric: to declare "this ad has no effect," you need strong evidence like a holdout.

If paid and organic always move together and can't be told apart (collinearity), don't manufacture a number — "inconclusive" is the honest answer. Knowing what you can't know right now protects the budget better than inventing causation.

One more caveat: a cannibalization rate is not a constant. It shifts with channel, season, and competitive pressure, and the 70% you measured today may not hold in six months. For campaigns carrying a large share of budget, re-measure periodically.
