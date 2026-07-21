---
title: "Can This Campaign Take More Budget? How to Read Saturation"
description: "Use marginal CPA to judge campaign saturation, and separate channels with headroom from channels that are already maxed out."
date: "2026-07-15"
slug: "campaign-saturation-signals"
keywords: "campaign saturation, marginal CPA, marginal ROAS, budget increase, scaling up, response curve, diminishing returns, ad saturation"
tags: ["Analysis", "Budget Allocation"]
draft: false
---

A campaign is performing well — double the budget and conversions double too, right? Usually not. Past a certain point, more money doesn't bring more conversions. Knowing that point is what saturation diagnosis is for.

## Average CPA can't judge an increase

"This campaign's CPA is 8 dollars, so it's good — spend more." That call is dangerous, because 8 is the **average over all the money spent so far**. What an increase decision needs is not the running average but the **efficiency of the next dollar** — marginal CPA.

The response curve (spend vs conversions) is usually S-shaped: efficiency builds early, flattens at some point, and eventually goes flat. On that flat stretch, average CPA still looks fine while **marginal CPA has already gotten much worse** — the next dollar brings almost nothing.

## Saturation index = marginal ÷ average

A simple decision metric is **marginal CPA ÷ average CPA** (for ROAS, average ÷ marginal). The direction differs but the meaning is the same: a value above 1 means the next dollar is worse than everything before it.

- Clearly **above 1** → saturation signal. Increasing spend degrades efficiency sharply.
- **Near 1** → still headroom. Increasing won't bend efficiency much.

You estimate marginal efficiency by nudging spend up a little (say +10%) from the current point and seeing how many more conversions arrive. Put this index side by side across channels and campaigns, and "saturated here, headroom there" becomes obvious.

## So what do you do

- **Headroom channels** → increase. Efficiency is still alive, so load more budget.
- **Saturated channels** → stop increasing, and either improve the channel's own efficiency (creative, targeting, landing) or move budget to the headroom channels.

This pairs with [budget allocation](/tools/budget-allocation): saturation diagnoses "where is the headroom," allocation computes "then how much to move."

Upload an efficiency CSV or connect a Google Sheet to the [campaign saturation diagnosis](/tools/campaign-saturation), and you'll see marginal efficiency, a saturated/headroom verdict, and the response curve per channel and campaign. Connect a Sheet once and you can keep checking with fresh data without re-uploading.

## Let's be honest

The response curve is a model estimated from past data, so predictions far from the current spend point (a budget you've never run) have low confidence. "The curve's tail says I can spend 3x" is a dangerous read.

The safe move is to **increase in small steps near the range you've actually operated in** and verify for real. The curve tells you the direction of the next step, not a prophecy three steps out.
