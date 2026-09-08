---
title: "CPM vs CPC vs CPI vs CPA: Ad Cost Metrics Explained"
description: "Learn what CPM and CPC measure, and where to look when impression or click costs rise."
date: "2026-07-15"
updated: "2026-09-09"
slug: "cpi-cpa-cpm-difference"
keywords: "what is CPM, what is CPC, CPM vs CPC, impression cost, click cost, CPM calculation, CPC calculation, advertising impression cost, advertising click cost, why did CPC go up, why did CPM go up"
tags: ["Metrics Basics", "Marketing Metrics"]
draft: false
faq:
  - q: "Should I target CPI or CPA?"
    a: "CPI when installs are the goal, CPA when an in-app action is. Their denominators differ, so they cannot be mixed, and the optimization signal should be a single choice for the model to learn."
  - q: "Is a low CPM good?"
    a: "Not on its own. Low CPM with low CTR and conversion rate can still produce a worse final CPA. Treat CPM as an intermediate metric for diagnosing causes."
  - q: "My CPC rose but CPM stayed flat. What does that mean?"
    a: "The auction price did not change, but click-through rate fell. CPC is CPM divided by (1,000 × CTR), so a lower denominator raises CPC. Look at creative and fatigue before touching bids."
  - q: "Can a marketer lower CPM directly?"
    a: "CPM is an auction outcome, not a dial you set. It moves with audience size, bid strategy, creative quality, and competitive pressure. Rather than targeting CPM itself, find what pushed it up."
  - q: "Over what window should I compare CPM, CPC, CPI, and CPA?"
    a: "Day-level comparisons mislead because weekday variation is large. Compare equal-length windows such as the last 7 days against the previous 7, and exclude recent days that have not matured for metrics whose conversions land late."
reviewedAt: "2026-09-09"
reviewer: "Codex (AI-assisted editorial audit)"
---
You have probably heard that CPM went up, lowered your bid, and watched nothing improve. If the real cause was creative rather than the auction, that is exactly what should happen. CPM and CPC sit at the front of the advertising funnel — impressions and clicks — and reading them separately is what lets you tell "the auction got expensive" apart from "our response got weaker."

For the full CPI, CPA, and ROAS chain, and which optimization metric to choose, start with the [performance marketing metrics guide](/blog/performance-marketing-metrics). This article focuses on the first two links in that chain.

## Each cost attaches to a different funnel stage

Every metric attaches to a different point in the funnel.

- CPM (Cost Per Mille) — cost per 1,000 impressions. Closest to the raw price you pay the platform.
- CPC (Cost Per Click) — cost per click. Connects as CPM ÷ (1,000 × CTR).
- CPI (Cost Per Install) — cost per install. The headline metric for app marketing.
- CPA (Cost Per Action) — cost per desired action (signup, purchase). Closest to real outcome.

The further down you go, the closer to "an action that makes money." So the final goal is usually to lower CPA, but the earlier metrics tell you why CPA is what it is.

Lay it in one line and it clicks (numbers are illustrative). Spend $10,000 for 5M impressions → CPM $2. Of those, 50k clicks means 1% CTR, CPC $0.20. If 5,000 of those install, CPI $2. If 500 of them sign up, CPA $20. Stretched out like this, you see exactly where people drop and how cost compounds.

## CPC went up — it is one of two causes

This is where the practical work starts. CPC is not an independent metric; it is CPM divided by (1,000 × CTR).

```
CPC = CPM ÷ (1,000 × CTR)
```

Enter CTR and the conversion rates below as fractions from 0 to 1 (1% = 0.01). These identities require the same period, population, conversion definitions, and attribution scope.

A rise in CPC can reflect higher CPM, lower CTR, or both changes together. This decomposition narrows hypotheses; it does not identify the operational cause.

![The same symptom — CPC rising from $0.20 to $0.30 — split into two causes. If CPM rose, check audience, bid, and seasonality; if CTR fell, check creative and fatigue.](/blog-assets-en/cpi-cpa-cpm-difference/cpc-split.svg)

Run the numbers. At CPM $2.00 and CTR 1%, CPC is $0.20.

- CPM rises to $3.00 while CTR holds at 1% → CPC $0.30
- CPM holds at $2.00 while CTR falls to 0.67% → CPC approximately $0.30

Similar CPC, but the first reflects impression cost and the second reflects click response. Auctions, placement mix, creative, and audiences can change together. Check breakdowns and experiments before choosing an action.

### When CPM rose

CPM is not a value you set — it is what the auction returns. Common reasons it climbs:

- The audience narrowed. Check whether impression cost changed after narrowing. Direction depends on inventory and competition.
- Competition intensified. Holiday and promotional periods pull budget onto the same inventory. CPM rises even when you changed nothing.
- Creative quality signals dropped. Platforms discount inventory for creative that earns engagement. Weak response raises effective CPM at the same bid.
- Placement mix shifted. With automatic placements, a larger share of expensive inventory lifts average CPM while per-placement efficiency is unchanged.

### When CTR fell

This side is a response to something you made, so there is more to act on.

- Creative fatigue. Check whether CTR declined alongside repeated exposure; repetition alone does not establish a decline. Read it alongside frequency.
- Share of new creative. A drop in blended CTR can just be a larger mix of new assets still in learning.
- Message and audience drift apart. Check whether the message fits the expanded audience. Expansion does not guarantee a lower CTR.

<!-- CONTENT_ACTION -->

## Why you have to watch all of them

The same logic runs down the whole chain. CPA alone cannot tell you why it is bad; decomposing it narrows the hypotheses to investigate.

```
CPA = CPM ÷ (1,000 × CTR × click-to-install rate × install-to-action rate)
```

When CPA is high, this is where it splits:

- High CPM → tough auction competition or an expensive audience segment.
- Low CTR → check replacement candidates in [creative fatigue analysis](/content/freshness), or revisit targeting.
- Low conversion rate → leaking at the landing page or [funnel](/blog/funnel-dropoff-analysis).

So CPA is the result; CPM, CTR, and conversion rate are arithmetic components. Stare at the result alone and you cannot decide whether to swap creative, change targeting, or fix the landing page.

## What to optimize toward

Set the goal first, then pick the matching metric.

- Awareness campaign → CPM / reach
- Traffic → CPC
- App installs → CPI
- Revenue / signups → CPA (or [ROAS](/blog/roas-improvement))

One trap: optimize on an early metric (CPI) alone and you can pull in a flood of users who installed cheaply and never buy — the algorithm optimizes exactly the goal you hand it. When you can, push the optimization signal down toward the money-making action. See the [full metric chain](/blog/performance-marketing-metrics) for how to choose by business stage.

## Try this today

Open your report, put the last 7 days next to the previous 7, and build just three columns per campaign: CPM, CTR, CPC. Then for every campaign where CPC rose, ask one question. Did CPM move, or did CTR move?

That single split separates "campaigns that need new creative" from "campaigns that need a bid or audience change." Most of the time both are mixed together, and mixed together you cannot fix either properly.

One caution when comparing: day-level views manufacture trends out of weekday variation. Compare equal-length windows, and drop the most recent days that have not matured for metrics whose conversions land late.

## Let's be honest

A cheap CPI isn't a good campaign. Whether those users [stay (retention)](/blog/cohort-analysis-guide) and buy ([LTV](/blog/ltv-cac-ratio)) is what reveals true efficiency. Use the early metrics for diagnosis, and make the final call on the later ones.

And the CPM/CTR split narrows where to look — it does not prove cause. If seasonality, competition, and creative all changed in the same week, this table cannot tell you which one did it. When you need certainty, move to a design with a comparison group, such as [incrementality testing](/blog/incrementality-measurement).

If building those three columns per campaign every week gets tedious, upload your report CSV to the [operations dashboard](/dashboard). It lines up CPM, CTR, CPC, and CPA as a period comparison and flags which cell moved. Data is processed in your browser and never sent to a server.
