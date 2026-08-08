---
title: "How to Measure Advertising Uplift: Read Net Lift with a Holdout Test"
description: "Measure advertising uplift with a holdout test, learn when good CPA or ROAS is not enough to scale, and interpret net lift in order."
date: "2026-08-09"
slug: "uplift-holdout-guide"
keywords: "uplift, uplift meaning, advertising uplift, holdout test, incrementality, net lift, incremental ROAS, iROAS, ad effectiveness measurement"
tags: ["Incrementality", "Performance Marketing"]
draft: false
faq:
  - q: "Are uplift and incrementality the same?"
    a: "In marketing practice they are often used for the outcome advertising truly added. Uplift can also refer specifically to a relative change such as the conversion-rate difference between exposed and holdout groups."
  - q: "Can I skip uplift testing when CPA is good?"
    a: "No. Brand Search and retargeting can show strong CPA among people likely to convert anyway. Use a holdout when the decision is whether more spend will create additional business outcome."
---

# Great CPA but no business growth? Measure advertising uplift

A Brand Search campaign has a great CPA. Retargeting collects many conversions. But if total revenue or new customers do not rise with spend, the report may include conversions that would have happened without advertising.

The question is not “how many conversions did this ad receive?” It is **“how many conversions would disappear without this ad?”** That difference is advertising uplift, or net incremental outcome.

![Conversion-rate difference between an exposed group and a holdout group](/blog-assets-en/uplift/holdout-uplift.svg)

## Uplift is the difference between two worlds

If an exposed group converts at 8% and a holdout group converts at 5%, observed uplift is 3 percentage points. That 3pp is the candidate outcome the ad added.

> **Uplift = exposed-group conversion rate − holdout-group conversion rate**

The critical assumption is that the groups are alike except for ad exposure. That is why a randomized holdout is strongest. Regional or pre/post comparisons can help, but need more caution for seasonality, promotions, and price changes.

## Why great CPA or ROAS is not enough

CPA and ROAS are calculated from people who encountered the ad. If an ad was the last touch for someone already likely to buy, the conversion still appears as advertising performance. Start with these campaigns:

- **Brand Search**: paid ads may capture demand already looking for the brand.
- **Retargeting**: the audience often has high purchase intent already.
- **Late promotion spend**: the discount, rather than the ad, may drive conversion.
- **Products with strong organic demand**: paid media may re-buy organic conversions.

A good CPA can be an operating-efficiency signal, but it is not automatically a scaling case. Uplift and incremental ROAS answer whether more spend grows the business.

## How to design a holdout test

### 1. Choose one decision

Choose a real decision: keep Brand Search on, or increase retargeting budget by 20%. Lock one primary outcome such as install, signup, or purchase. Changing the goal midway invites favorable interpretation.

### 2. Split exposed and holdout groups

Use a platform Conversion Lift product or user-level random holdout when possible. Otherwise keep a regional, audience, or campaign-level comparison group. Check that the groups followed a similar trend before the test.

### 3. Write success criteria before launch

| Item | Example |
| --- | --- |
| Primary metric | New-purchase conversion rate |
| Minimum expected effect | +1.0pp uplift |
| Observation window | Two weeks |
| Next action | Raise budget 10% only if the interval is positive |

### 4. Read rate difference and absolute lift together

A +1pp uplift means about 100 extra conversions in a 10,000-person audience and about 10,000 in a million-person audience. Pair the rate with absolute incremental outcomes and cost, then calculate iCPA and iROAS from incremental rather than observed conversions.

## How to read the result

| Result | Interpretation | Next step |
| --- | --- | --- |
| Confidence interval is positive | Evidence that advertising added outcomes | Scale in a small step, then re-check |
| Positive estimate but not significant | Not proof of no effect; power may be low | Collect longer, enlarge the sample, or hold judgment |
| Near zero or negative | Weak incremental evidence in this design | Pause scale-up and review targeting or channel role |

Do not translate “not significant” as “no effect.” But do not make a large scale decision from a p-value alone either. Absolute lift and iROAS must clear the business threshold.

## When a holdout is not feasible

For a new campaign, compare a **new ON** period with a similar group left off. For an existing campaign, consider a short **OFF** period with difference-in-differences. These are weaker than random holdouts, so disclose comparison trends and external changes rather than claiming certainty from before/after alone.

[Marketing Response Analysis](/tools/marketing-response) can prioritize hypotheses from observational data. Its contribution estimates are hypotheses; a holdout should validate a large budget move.

## Wrap-up

Uplift is not a metric for cutting ads. It identifies the campaigns that truly create outcomes so you can invest with confidence. Before scaling a campaign because CPA looks good, ask how much disappears without it.

With exposed and holdout numbers, new-ON data, or shutdown data, use [Incrementality Analysis](/tools/incrementality) to calculate the appropriate method entirely in the browser.
