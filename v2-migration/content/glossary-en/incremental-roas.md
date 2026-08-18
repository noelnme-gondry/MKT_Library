---
term: "Incremental ROAS (iROAS)"
seoTitle: "Incremental ROAS: How It Differs From Reported ROAS"
shortDef: "ROAS computed only on revenue the advertising actually added, after removing what would have happened anyway"
description: "iROAS is incremental revenue divided by spend. Why a reported 800% ROAS can sit on top of far lower real lift."
date: "2026-08-18"
slug: "incremental-roas"
keywords: "incremental ROAS, iROAS meaning, incremental revenue, reported ROAS difference, lift based ROAS"
relatedPosts: ["incrementality-measurement", "uplift-holdout-guide"]
category: "Measurement & analysis"
draft: false
faq:
  - q: "How far apart are reported ROAS and iROAS?"
    a: "It varies sharply by campaign type. Brand search and retargeting, which attach to people who already know you, routinely show the highest reported ROAS and the smallest incremental lift."
  - q: "How is iROAS calculated?"
    a: "Divide the revenue difference against a holdout group by ad spend. Without random assignment that difference is not ad effect, so a figure computed with no control group should be treated as an estimate only."
---

## In one line

Incremental ROAS (iROAS) uses only the revenue that would not exist without the advertising — not everything the report credits to it.

## Why read it separately

Reported ROAS credits all revenue from people who saw the ad. Some of them were buying regardless. Of 500 attributed conversions, only 120 may be incremental while 380 were coming anyway.

So a reported 800% ROAS can fail to justify more spend. The question to answer is not "how much did people who saw this ad spend" but "how much disappears if I switch it off."

## Calculating it

Take the revenue gap against a [holdout](/glossary/holdout-test) group and divide by spend. If assignment was not random, or the two groups differ in period or audience, that gap is not ad effect.

## Go deeper

The three measurement designs are covered in [incrementality measurement](/blog/incrementality-measurement), and holdout design in [measuring advertising uplift](/blog/uplift-holdout-guide).
