---
title: "LTV:CAC Ratio Explained: How to Calculate It Correctly"
description: "More important than the 3:1 benchmark is whether the number was computed right. Denominator definition, revenue vs margin, channel split — three common mistakes, the math, and reading it with payback period."
date: "2026-07-15"
slug: "ltv-cac-ratio"
keywords: "LTV, CAC, LTV CAC, how to calculate LTV, CAC calculation, customer lifetime value, customer acquisition cost, LTV CAC ratio, LTV CAC 3:1, payback period, unit economics"
tags: ["Analysis", "Budget Allocation"]
draft: false
---

Plenty of teams answer "can we keep spending on this channel?" with LTV:CAC. But before you relax at a ratio above 3:1, check whether the number was **computed right**. Depending on what you took as the denominator, and whether you used revenue or margin, the same data can flip the conclusion. Here's the math, then the three spots people most often get wrong.

## Start with CAC

CAC (Customer Acquisition Cost) is simple.

CAC = total spend to acquire ÷ customers acquired

The thing to watch is **what you use as the denominator.** Installs, signups, or paying customers give completely different numbers. Standardize the definition of "customer" across the team. Usually, the paying user is the meaningful basis.

## LTV is an estimate

LTV (Lifetime Value) is the total a customer earns you until they churn. The catch is you have to **look into the future** — so it's an estimate.

The simplest form:

LTV = average revenue per user (ARPU) × average lifespan

Lifespan comes from the [retention curve](/blog/cohort-analysis-guide). Better retention means longer stays and larger LTV — which is why cohort analysis and LTV are a set.

A quick example (numbers illustrative). Spend $50,000 to acquire 500 paying customers → CAC $100. If they spend $20/month on average and stay 12 months, LTV is $240. So LTV:CAC = 240 ÷ 100 = 2.4:1.

More rigorously you plot cumulative revenue curves per cohort and extrapolate the future, but early on the data is shallow and uncertain. Keep in mind **early-cohort LTV always risks over- or under-estimation.**

## Three spots people get wrong

The formula is two divisions. What's wrong isn't the formula — it's **the values you feed it.**

**1) The "customer" in numerator and denominator differ.** You compute CAC on paying customers but LTV on the average of all installers. Then the ratio doesn't even hold. LTV and CAC must use the same customer definition.

**2) Computing LTV on revenue.** Even if revenue-based LTV is $240 as above, if contribution margin after cost and fees is 30%, the real money kept is $72. At CAC $100 that's 2.4:1 on revenue but under 1:1 on profit. In thin-margin businesses this gap decides life or death. Read LTV on **contribution margin**, not revenue.

**3) Looking only at the blended average.** Overall LTV:CAC of 3:1 often hides a mix of 5:1 channels and sub-1:1 channels. Leave it because the average looks good, and money keeps leaking into the bad channels. For budget decisions, look at the channel level.

## Reading LTV:CAC

Common benchmarks:

- **3:1** — healthy. LTV is triple CAC.
- **Under 1:1** — you lose more the more you spend.
- **Over 5:1** — possibly under-investing (you could spend more aggressively).

But 3:1 is a convention born in SaaS. The right line varies by industry and margin structure — with thin margins, even 3:1 can be risky.

Also look at **payback period.** Even a good LTV:CAC dries up cash flow if recovery takes 18 months.

## Where you use it

- **Channel-level LTV:CAC** comparison → where to load more budget. The basis for [budget allocation](/tools/budget-allocation).
- **ROAS maturity** → how recovery builds over time.

See the LTV:CAC table and the ROAS maturity curve in the [operations dashboard](/dashboard)'s LTV tab via CSV upload or Google Sheet connection. Connect a Sheet and you keep it fresh monthly without re-uploading.

## Let's be honest

LTV is a future estimate, so it can be wrong. Rather than "LTV:CAC is 4:1, so pour in more," weigh the estimate's uncertainty (data window, cohort size) and decide conservatively.
