---
title: "Cut, Scale, or Reallocate Budget? The #1 Metric — Marginal ROAS & CPA"
description: "Marketing budget allocation means deciding where to increase, reallocate, or cut spend. The #1 criterion is the marginal ROAS/CPA of the next or last dollar — including why a winner breaks when you scale it and why cuts do not always bounce back."
date: "2026-07-21"
slug: "budget-marginal-efficiency"
keywords: "marketing budget allocation, ad budget reallocation, when to scale ad budget, budget cut priorities, marginal ROAS, marginal CPA, response curve"
tags: ["Budget Allocation", "Scaling"]
draft: false
---

**The short version (3 lines)**

- Whether you're **increasing, reallocating, or cutting** budget, the #1 criterion is the same — the **marginal metric** (the ROAS/CPA of the next or last dollar).
- Add where marginal efficiency is highest, shift from low to high, cut where it's lowest. **Same curve, you're just pushing it in a different direction.**
- One exception — **the curve isn't symmetric.** Scaling that blows up and cuts that don't bounce back share the same cause. That's the core of this post.

## Why ranking by *average* efficiency misleads you

Rank channels by average ROAS (or average CPA) and you keep pouring into already-saturated winners while starving channels that still have headroom. What matters isn't the average — it's the **efficiency of the "next dollar" = marginal efficiency.** Every channel has a response curve where efficiency falls as spend rises, and every budget decision is just moving a point along that curve. The *equimarginal principle*: allocation is optimal when marginal efficiency is equal across channels.

## One metric solves all three directions

### Scaling up — add only where marginal ROAS is above your target line

Having headroom means you're still pre-saturation. Add only to channels whose next-dollar ROAS clears the target line; add to a channel that's dropped below it and you lose from that dollar on.

**So why does a winning campaign break the moment you scale it?** It entered the flattening part of the response curve. Spend↑ → frequency↑ → creative fatigue↑ → CTR↓ → CPA↑ — a domino. Add a learning reset on top and it gets temporarily worse. So scale in **20–30% steps, let learning stabilize, then take the next step** — not one big jump.

### Reallocating — move until marginal efficiency equalizes

With a fixed total, pull from the low-marginal channel and push to the high-marginal one. The moment they equalize is the optimum; moving more won't lift total performance.

### Cutting — remove the lowest-marginal dollar first

"Told to cut 30% — what goes first?" lives on the same curve. It's not an even, across-the-board trim; you build a **cut order ranked by marginal (incremental) contribution.** Reversible things first; brand and always-on, which are hard to walk back, last.

## The curve isn't symmetric — why scaling and cutting both fail

Just as scaling breaks in the flat zone, cutting doesn't simply rewind the curve. Both betray you because the curve is **non-linear and path-dependent.** Three asymmetries sit on the cut side:

1. **Learning-phase reset** — cutting rewinds the auto-optimizer's learning. Recovery costs time and money, so the removed dollar costs more than its value on the curve.
2. **Minimum viable spend floor** — below a threshold, some channels don't decline linearly, they collapse. That's why "trim everything evenly" is dangerous.
3. **It may not reverse** — re-adding budget doesn't guarantee the old performance comes back.

## Simulate all three with the tool

The [Budget Allocation Simulator](/tools/budget-allocation) is marginal-efficiency based, so it shows where to add and where to pull in a single view. Demo data auto-loads, so increases and reallocations you can judge straight from it.

![Budget Allocation Simulator — trendline verification. Per-channel ROAS vs spend scatter with a response curve to read the marginal efficiency of the next dollar.](/blog-assets/budget-marginal-efficiency/trendline-en.png)

> ⚠️ **One honest caveat.** This simulator assumes budget moves are **reversible**. Asymmetry #3 (reversibility) is **not** in the model. In reality, pulling then re-adding may **not** restore performance — creative fatigue accumulates and learning resets in the meantime. So for cut order, don't trust the reallocation output alone; pair it with [Incrementality Analysis](/tools/incrementality) to see "how much actually disappears if I pull this channel."

![Incrementality — daily conversion rate for the exposed group vs the holdout (ads off) group. The gap between the two lines is the incremental lift ads actually produced.](/blog-assets/budget-marginal-efficiency/incrementality-en.png)

## Try it on your own data

No signup · data processed in your browser only (zero server transfer) · check instantly with demo data.

👉 [Open the Budget Allocation Simulator](/tools/budget-allocation)

---

**Related**

- Tools: [Campaign Saturation Diagnosis](/tools/campaign-saturation) — is there headroom to scale · [Creative Fatigue Analysis](/content/freshness) — why cuts don't bounce back
- Glossary: [Marginal CPA · Marginal ROAS · response curve — the marginal-metrics hub](/glossary/marginal-cpa)
