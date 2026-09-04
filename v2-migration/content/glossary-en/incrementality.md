---
term: "Incrementality"
seoTitle: "Incrementality: What CPA and ROAS Cannot Show You"
shortDef: "The pure additional performance an ad actually caused"
description: "Attribution assigns every conversion to a channel; incrementality counts only what disappears without ads — how to measure it and where CPA misleads."
date: "2026-07-18"
updated: "2026-08-26"
slug: "incrementality"
keywords: "incrementality, incrementality meaning, incrementality measurement, incrementality testing"
category: "Measurement & Methodology"
relatedPosts: ["incrementality-measurement"]
sources:
  - title: "Google Ads: Incremental conversions and attributed conversions"
    url: "https://support.google.com/google-ads/answer/14102450?hl=en-GB"
draft: false
faq:
  - q: "How is incrementality different from attribution?"
    a: "Attribution is a rule for splitting conversions that already happened across channels. Incrementality asks whether those conversions would have happened without the ad. Attribution always allocates 100%; incremental effect is often far smaller."
  - q: "How do you measure incrementality?"
    a: "A randomised holdout is the strongest design. Without a control group you can use before-and-after comparisons around turning a campaign on or off, geo splits, or a time-series baseline. Each step down that list lets more competing explanations in."
  - q: "If incrementality is low, should I turn the ads off?"
    a: "Check sample size and window before cutting. Incremental estimates often carry wide intervals, and campaign types whose effect arrives late — brand campaigns especially — are understated over short observation periods."
---

## In one line

A hundred conversions does not mean advertising caused a hundred conversions. Subtract the people who would have arrived anyway and what remains is incrementality.

| Concept | Question it answers | Typical output |
| --- | --- | --- |
| Attribution | Who gets credit for a conversion that happened? | Attributed conversions by channel |
| Uplift | How far apart are exposed and control outcomes? | Rate difference in pp or % |
| Incrementality | What outcome would disappear without the ad? | Incremental conversions, iCPA, iROAS |

## How it's measured

The most reliable method is a [holdout test](/glossary/holdout-test): randomly split users into an exposed group and a holdout group, then compare conversion rates. The difference is [uplift](/glossary/uplift). When randomization is not feasible, consider a geo control, a new launch, or a shutdown with difference-in-differences, and weaken causal claims as the design gets weaker.

## Why CPA/ROAS alone isn't enough

CPA and ROAS only describe people who saw the ad — they can't tell you whether the ad *caused* the conversion. If incrementality is near zero, CPA can look great while the ad is doing almost nothing.

## Go deeper

The three practical ways to measure incrementality (holdout, ramp-up, ramp-down) are covered in [Measuring Incrementality](/blog/incrementality-measurement).
