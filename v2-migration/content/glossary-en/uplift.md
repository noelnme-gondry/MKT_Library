---
term: "Uplift"
seoTitle: "What Is Uplift? Measure Incremental Ad Impact with a Holdout"
shortDef: "The pure increase in outcomes an ad actually caused, isolated from what would've happened anyway"
description: "Uplift is the incremental outcome ads created, measured against a holdout. Why it differs from CPA and ROAS and how it is calculated."
date: "2026-08-09"
slug: "uplift"
keywords: "uplift, uplift meaning, advertising uplift, incrementality, net lift, holdout test, causal lift"
category: "Measurement & Methodology"
relatedPosts: ["incrementality-measurement", "uplift-holdout-guide"]
draft: false
---

## In one line

**Uplift** is the performance of a group exposed to advertising minus the baseline — what would have happened anyway even without the ad.

![Conversion-rate difference between an exposed group and a holdout group](/blog-assets-en/uplift/holdout-uplift.svg)

## Why it matters

Not every conversion in an exposed group is caused by the ad — some of those people (brand searchers, repeat buyers) would have converted regardless. Uplift isolates the piece that's genuinely incremental.

The standard way to measure it is a **[holdout test](/glossary/holdout-test)**: randomly split users into an exposed group and a holdout group that sees no ads, then compare conversion rates.

## Why CPA/ROAS alone isn't enough

CPA and ROAS only tell you what happened among people who saw the ad — they can't tell you whether the ad caused it. If uplift is close to zero, a great-looking CPA can still mean the ad wasn't actually doing much.

## How is uplift calculated?

Start with the conversion-rate difference between a randomized exposed group and holdout group. If the exposed group converts at 8% and the holdout at 5%, uplift is 3 percentage points. If assignment was not randomized, or the groups differ in audience or timing, that difference alone is not proof of ad impact. Use the [Incrementality Analysis tool](/tools/incrementality) to choose a holdout, launch, or shutdown method that matches your data.

## Go deeper

See how to run a holdout test to measure uplift in [Measuring Incrementality](/blog/incrementality-measurement).
