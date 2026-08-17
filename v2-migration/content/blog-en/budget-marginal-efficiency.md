---
title: "Marketing Budget Allocation: Marginal ROAS and CPA"
description: "Compare budget increases, reallocations, and cuts with marginal ROAS or CPA, then check the assumptions and limits of the estimated response curve."
date: "2026-07-21"
updated: "2026-08-03"
slug: "budget-marginal-efficiency"
keywords: "marketing budget allocation, ad budget reallocation, when to scale ad budget, budget cut priorities, marginal ROAS, marginal CPA, response curve"
tags: ["Budget Allocation", "Scaling"]
draft: false
primaryTool: "5-3"
relatedGlossary: ["marginal-cpa", "response-curve", "roas"]
reviewedAt: "2026-08-03"
reviewer: "Growth Opt Playbook"
sources:
  - title: "Google Meridian: ROI, mROI, and response curves"
    url: "https://developers.google.com/meridian/docs/post-modeling/roi-mroi-response-curves"
  - title: "Google Meridian: Scenario planning and future budget optimization"
    url: "https://developers.google.com/meridian/docs/post-modeling/scenario-planning-and-future-budget-optimization"
  - title: "Google Meridian: Interpret optimizations"
    url: "https://developers.google.com/meridian/docs/post-modeling/interpret-optimizations"
  - title: "Google Ads: About budgets"
    url: "https://support.google.com/google-ads/answer/13630812?hl=en"
faq:
  - q: "Should I move more budget to the channel with the highest average ROAS?"
    a: "Not automatically. Compare marginal ROAS or CPA for the next unit of spend, align the KPI across channels, and respect channel-level constraints."
  - q: "Is increasing ad budget by 20–30% always safe?"
    a: "No universal percentage fits every account. Use the observed response-curve range, current platform guidance, conversion volume, and an acceptable volatility limit to choose a small testable step."
  - q: "Does cutting budget always reset campaign learning?"
    a: "No. There is no universal rule that every budget reduction resets learning. Large changes can still create delivery and performance volatility, so record the change and allow an adequate observation window."
---

**The short version (3 lines)**

- Whether you are **increasing, reallocating, or cutting** budget, start with marginal ROAS or CPA over the incremental or removed spend range.
- Add where marginal efficiency is highest, shift from low to high, cut where it's lowest. Same curve, you're just pushing it in a different direction.
- A response curve does not guarantee the future. Scaling and cutting use the same decision logic, but they may not behave like mirror images in live operations.

## Why ranking by *average* efficiency misleads you

Ranking channels only by average ROAS (or average CPA) can keep pouring spend into a saturated winner while starving a channel with headroom. What matters is efficiency over the incremental spend range = marginal efficiency. Google Meridian likewise separates [ROI as average return at historical spend from mROI as the return on incremental spend at the current level](https://developers.google.com/meridian/docs/post-modeling/roi-mroi-response-curves).

In this article, **marginal CPA** is an operating definition that applies the same idea in cost space: `change in spend ÷ change in conversions` over an incremental range. It is not a Google Meridian term; the official source above supports the distinction between mROI and the response curve.

Treat equalized marginal efficiency as an allocation candidate only when the response curve is reliable within the observed range, KPI and cost scope are comparable, and channel constraints such as minimum and maximum spend are represented. Without those conditions, a mathematical optimum is not an operating answer.

## One metric solves all three directions

### Scaling up — add only where marginal ROAS is above your target line

Headroom means the current estimate still places the channel before saturation. Prioritize channels whose next-dollar ROAS clears the target line; below the line, the expected incremental return misses the requirement.

So why can a winning campaign worsen after scaling? It may have entered the flat part of the response curve, while auction conditions, audience, creative, or conversion maturity changed at the same time. Do not force those possibilities into one domino story. There is also no universal 20–30% scaling rule. Choose a small testable step from the observed spend range, current platform guidance, conversion volume, and acceptable volatility; review the result before the next increase.

### Reallocating — move until marginal efficiency equalizes

With a fixed total, pull from the low-marginal channel and push to the high-marginal one. Treat the point where they converge as a candidate only when KPIs and estimation conditions are comparable and channel constraints are represented. Meridian also separates [fixed-budget, target-ROI, and target-mROI optimization scenarios](https://developers.google.com/meridian/docs/post-modeling/interpret-optimizations).

### Cutting — remove the lowest-marginal dollar first

"Told to cut 30%—what goes first?" starts on the same curve. Instead of an even trim, build a candidate cut order ranked by marginal (incremental) contribution. Then apply operating constraints: minimum delivery, measurement coverage, the role of brand or always-on activity, and reversibility.

## Why a response curve cannot make scaling and cutting mirror images

A response curve estimates a relationship over the observed period and spend range. Future auctions, audiences, creative, and media prices are not held constant. Meridian's [future scenario-planning guidance](https://developers.google.com/meridian/docs/post-modeling/scenario-planning-and-future-budget-optimization) explicitly asks for assumptions about period, geography, execution pattern, media cost, and KPI value. Before a cut, treat these as model-external checks:

1. **Delivery and readaptation** — a large budget change can create delivery and performance volatility in some automated campaigns. It does not mean every budget cut universally resets learning.
2. **Thinner signal and operating constraints** — lower spend can reduce conversions and delivery opportunities, making the estimate less stable. Set minimum operating conditions by channel.
3. **A different future state** — when spend returns, auctions, targeting, creative, and demand may have changed, so historical performance is not guaranteed to return exactly.

## Simulate all three with the tool

The [Budget Allocation Simulator](/tools/budget-allocation) compares where to add and where to pull using marginal efficiency. Example data explains the interface; use your own CSV, observed range, and constraints for an actual budget decision.

![Budget Allocation Simulator — trendline verification. Per-channel ROAS vs spend scatter with a response curve to read the marginal efficiency of the next dollar.](/blog-assets/budget-marginal-efficiency/trendline-en.png)

> ⚠️ **One honest caveat.** This simulator estimates budget moves from relationships in the observed historical range. It does not model how auctions, creative, or demand may change after the move, nor whether historical performance will return. When the causal impact of a cut matters, pair the reallocation result with [Incrementality Analysis](/tools/incrementality) to test "how much actually disappears if I pull this channel."

![Incrementality — an appropriately designed holdout estimates incremental lift from the daily conversion-rate difference between the ads-off and exposed groups.](/blog-assets/budget-marginal-efficiency/incrementality-en.png)

## Try it on your own data

No signup · your CSV is processed in the browser · no server storage.

👉 [Open the Budget Allocation Simulator](/tools/budget-allocation)

---

**Related**

- Tools: [Campaign Saturation Diagnosis](/tools/campaign-saturation) — is there headroom to scale · [Creative Fatigue Analysis](/content/freshness) — check fatigue signals during operation
- Glossary: [Marginal CPA · Marginal ROAS · response curve — the marginal-metrics hub](/glossary/marginal-cpa)
