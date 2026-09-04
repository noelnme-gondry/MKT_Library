---
term: "Uplift"
seoTitle: "What Is Uplift? Measure Incremental Ad Impact with a Holdout"
shortDef: "The pure increase in outcomes an ad actually caused, isolated from what would've happened anyway"
description: "If the exposed group converts at 8% and the holdout at 5%, uplift is 3pp. How to run the split, and why ROAS can look fine when uplift is near zero."
date: "2026-08-09"
updated: "2026-08-26"
slug: "uplift"
keywords: "uplift, uplift meaning, advertising uplift, incrementality, net lift, holdout test, causal lift"
category: "Measurement & Methodology"
relatedPosts: ["incrementality-measurement", "uplift-holdout-guide"]
sources:
  - title: "Google Ads: About lift studies"
    url: "https://support.google.com/google-ads/answer/16104408?hl=en"
draft: false
faq:
  - q: "How is uplift different from ROAS?"
    a: "ROAS divides all revenue from people who saw the ad by its cost, so it includes conversions that would have happened anyway. Uplift removes that share and counts only what advertising added. Strong ROAS with near-zero uplift is a real and common outcome."
  - q: "How do you calculate uplift?"
    a: "From the outcome difference between a randomly assigned exposed group and a holdout. If the exposed group converts at 8% and the holdout at 5%, uplift is 3 percentage points. Without random assignment, or with different windows or audiences, that gap is not an ad effect."
  - q: "Can uplift come out negative?"
    a: "It can. Usually that is small-sample noise, so read the confidence interval first. When the interval crosses zero, the honest reading is 'not yet distinguishable', not 'no effect'."
---

## In one line

Take the performance of a group exposed to advertising and subtract the baseline — what would have happened anyway with no ads at all. The remainder is uplift.

![Conversion-rate difference between an exposed group and a holdout group](/blog-assets-en/uplift/holdout-uplift.svg)

## Why it matters

Not every conversion in an exposed group is caused by the ad — some of those people (brand searchers, repeat buyers) would have converted regardless. Uplift isolates the piece that's genuinely incremental.

The standard way to measure it is a [holdout test](/glossary/holdout-test): randomly split users into an exposed group and a holdout group that sees no ads, then compare conversion rates.

## Why CPA/ROAS alone isn't enough

CPA and ROAS only tell you what happened among people who saw the ad — they can't tell you whether the ad caused it. If uplift is close to zero, a great-looking CPA can still mean the ad wasn't actually doing much.

## How is uplift calculated?

Start with the conversion-rate difference between a randomized exposed group and holdout group. If the exposed group converts at 8% and the holdout at 5%, **absolute uplift is 3 percentage points**, while **relative uplift is (8%−5%)÷5%=60%**. Those are different units and should be labelled as `pp` and `%` in a report.

| Metric | Calculation | Example |
| --- | --- | --- |
| Absolute uplift | Exposed rate − holdout rate | 3pp |
| Relative uplift | Absolute gap ÷ holdout rate | 60% |
| Incremental conversions | Absolute uplift × exposed population | Depends on population |

If assignment was not randomized, or the groups differ in audience or timing, that difference alone is not proof of ad impact. Use the [Incrementality Analysis tool](/tools/incrementality) to choose a holdout, launch, or shutdown method that matches your data.

## Go deeper

See how to run a holdout test to measure uplift in [Measuring Incrementality](/blog/incrementality-measurement).
