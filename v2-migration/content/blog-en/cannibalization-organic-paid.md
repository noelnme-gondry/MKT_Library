---
title: "Is Paid Advertising Eating Your Free Traffic?"
description: "Diagnose internal cannibalisation (US: internal cannibalization): when paid ads displace organic conversions, and separate correlation from causation."
date: "2026-07-15"
slug: "cannibalization-organic-paid"
keywords: "cannibalization, cannibalisation, internal cannibalization, internal cannibalisation, organic cannibalization, paid vs organic, brand search ads, incrementality, cannibalization diagnosis, organic conversion decline"
tags: ["Analysis", "Incrementality Analysis"]
draft: false
---

Turn off brand-search ads and organic traffic rises by exactly that much? Then that ad spend was re-buying **people who were coming anyway**. That's **internal cannibalization** (also spelled *internal cannibalisation*) — paid eating into free traffic.

## Why it's dangerous

Performance reports credit every ad-touched conversion to the ad (attribution). But some of those people **would have arrived organically without the ad at all**. If you don't subtract that share, you'll overrate your ad efficiency.

The problem is that this illusion pushes budget the wrong way. "Brand campaign has the highest ROAS," you say, and pour in more — when in reality you're spending more to buy conversions that were free. Cannibalization is especially common on ads that attach to **people who already know you**: brand keywords, retargeting.

## Signs to suspect cannibalization

A few signals show up first in observational data.

- You raised spend but **total (organic + paid) conversions didn't rise** by as much. If paid went up while organic fell, you just shuffled the seat.
- Was organic **already declining before** you raised spend? A cause has to come first to even be a candidate.
- After removing seasonality and overall trend, does organic still fall when paid rises?

Scanning for these patterns is what the cannibalization diagnosis in [marketing response analysis](/tools/marketing-response) does. But be clear: what comes out is **correlation**, not causation.

## Confirm it with an experiment

Observation alone can't declare "the ad caused the organic drop." The two may have moved together by coincidence, driven by a different factor (season ending, an app update, a competitor promo).

The real test is [incrementality analysis](/tools/incrementality). Turn brand ads off for a random subset of regions or users (holdout) and compare that group's **total conversions** against the un-held group. If the difference is near zero, the ad has no incremental lift — strong evidence of heavy cannibalization. If the held-out group's total conversions clearly drop, the ad is pulling its weight.

## Let's be honest

"Looks like cannibalization" and "is cannibalization" are different things. Observational signals (leading order, de-trended movement) are grounds for suspicion, no more. And **the burden of proof is asymmetric**: to declare "this ad has no effect," you need strong evidence like a holdout.

If paid and organic always move together and can't be told apart (collinearity), don't manufacture a number — **"inconclusive" is the honest answer.** Knowing what you can't know right now protects the budget better than inventing causation.
