---
title: "CPM vs CPC vs CPI vs CPA: Ad Cost Metrics Explained"
description: "Compare CPI, CPA, CPM and CPC formulas, denominators and uses. Calculate a common example and narrow the checks behind a performance change."
date: "2026-07-15"
updated: "2026-09-14"
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
reviewedAt: "2026-09-14"
reviewer: "Codex (AI-assisted editorial audit)"
---
CPI, CPA, CPM and CPC divide advertising spend by different denominators. When a cost metric rises, inspect exposure costs and click, install or action rates first. CPM and CTR can describe a CPC change, but identifying auction, creative or targeting causes requires change history and further evidence.

For the full CPI, CPA, and ROAS chain, and which optimization metric to choose, start with the [performance marketing metrics guide](/blog/performance-marketing-metrics). This article compares all four cost metrics, then uses CPM and CPC to narrow the change.

## Each cost attaches to a different funnel stage

| Metric | Formula | Question | Common misreading |
| --- | --- | --- | --- |
| CPM | Spend ÷ impressions × 1,000 | Has the price of exposure changed? | Cheap impressions do not guarantee valuable customers |
| CPC | Spend ÷ clicks | Has the price of a click changed? | Inspect CPM and CTR together |
| CPI | Spend ÷ installs | What did each install cost? | An install is not a new paying customer |
| CPA | Spend ÷ defined actions | What did each signup or purchase action cost? | Different action definitions cannot be compared directly |

Align currency, period and attribution scope. If a denominator is zero or missing, do not report zero cost. Distinguish [CAC](/glossary/cac), the cost per new customer, from signup CPA or cost per order.

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

## When CPI and CPA move in opposite directions

CPI and CPA have different denominators, so nothing guarantees they move together. The moments they diverge are the informative ones.

| What you see | Arithmetically possible path | Check first |
| --- | --- | --- |
| CPI fell but CPA rose | Installs got cheaper while the install-to-action rate fell further | Whether creative or targeting shifted, and whether the installing users changed |
| CPA fell but CPI rose | Installs got pricier while those users converted at a much higher rate | Whether the expensive installs genuinely buy more, and whether recent days are still maturing |
| Both rose | Something upstream moved — CPM or CTR | Separate auction price from click-through rate before anything else |

Reuse the chain above and the reason surfaces. `CPI = CPM ÷ (1,000 × CTR × click-to-install rate)` and `CPA = CPI ÷ install-to-action rate`. Exactly **one** term sits between CPI and CPA, so when the two diverge, that term moved.

The common trap here is calling cheap installs bad traffic straight away. If your app records the action late, the most recent days have not matured and CPA looks worse than it is. Align the windows and look again; if they still diverge, put both metrics side by side per campaign in the [operations dashboard](/dashboard) to see which campaign is pulling the average.

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
