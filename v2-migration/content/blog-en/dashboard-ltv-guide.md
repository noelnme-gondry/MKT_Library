---
title: "Reading LTV and ROAS to assess acquisition cost recovery at D30"
description: "Separate observed revenue from projected LTV and interpret payback against acquisition cost."
date: "2026-11-22"
updated: "2026-11-22"
reviewedAt: "2026-11-22"
slug: "dashboard-ltv-guide"
primaryTool: "5-2"
tags: ["Analytics"]
draft: false
faq:
  - q: "Does a D30 ratio of 1.14 mean the channel has a 14% profit margin?"
    a: "The ratio compares revenue with acquisition cost. A margin or cash-payback calculation also needs the relevant fees, refunds, variable costs and settlement timing."
  - q: "Can I call install-based CAC the cost to acquire a paying customer?"
    a: "The denominator includes installs that never became paying customers. Match the spend scope with newly acquired payers before making a paying-customer CAC claim."
---

An install cost ₩4,060. Can you say the channel earned that money back within thirty days? Start with the denominator and the observation window in LTV and ROAS. The example includes a projected D30 value, so a budget review needs to distinguish evidence already observed from the curve used to estimate later revenue.

## Open the same channel, horizon and user basis

The example opens the March 24–30, 2024 acquisition window. Use Channel as the analysis unit, D30 as the LTV horizon and Installs as the user basis. Find Meta AAP. Read across this single row before comparing it with any other channel. Changing the unit, window or basis changes the question the row answers.

## Reconstruct the Meta AAP row

![Channel-level LTV table showing acquisition cost, estimated D30 revenue per install and payback in one row](/blog-assets/dashboard-guides/ltv-en.webp)

| Measure | Display | Meaning |
|---|---:|---|
| Spend / installs | ₩95,629,230 / 23,556 | Size of the acquisition cohort |
| CAC | ₩4,060 | Acquisition cost per install |
| ROAS D7 / D14 | 60% / 81% | Cumulative revenue relative to spend at each age |
| D30 LTV per user / LTV:CAC | ₩4,613 / 1.14× | Projected D30 revenue per install relative to its cost |
| Payback | 23 days | Estimated age at which cumulative revenue reaches cost |

Divide ₩95,629,230 by 23,556 to reproduce the rounded ₩4,060. Then divide ₩4,613 by ₩4,060 to get about 1.14. D7 ROAS of 60% describes revenue accumulated by day seven. Comparing that directly with the D30 ratio without naming the horizon makes a revenue curve sound like a contradiction.

## Find the boundary between observed and projected revenue

The information marker identifies an estimate for an incomplete window. On the LTV curve, use the solid observed section and the dashed predicted section to find where the data ends. Switching to D90 or D180 asks the model to project further; it does not create new observed purchases.

The maturity section lets you inspect which ages enter the curve fit. Channels with similar early revenue can diverge when one has more renewals, refunds or delayed purchases. If alternative projections disagree, write down the next age that will become observable and revisit the forecast with that observation.

## Test whether the denominator matches the business question

The install basis includes acquired users who never pay. If you switch to Actions, inspect what your export calls an action before presenting the result as customer CAC. Unify currency, cohort start date and revenue attribution window across channels. A zero-spend organic row can have a meaningful revenue per install and no defined revenue-to-spend ratio.

## Make a budget note that can be checked later

Report the example as estimated D30 revenue LTV:CAC of 1.14× on an install basis, with projected revenue payback at 23 days. Include the last observed age. Before increasing spend, deduct fees, refunds and variable costs and compare the resulting recovery path with the cash horizon the business can afford. Use [Cohort analysis](/en/blog/dashboard-cohort-guide) if the next question is whether users of the same age are returning at different rates.
