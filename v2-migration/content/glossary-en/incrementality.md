---
term: "Incrementality"
seoTitle: "Incrementality: What CPA and ROAS Cannot Show You"
shortDef: "The pure additional performance an ad actually caused"
description: "Incrementality is the performance advertising actually added on top of what would have happened anyway. How to measure it, and why CPA and ROAS mislead."
date: "2026-07-18"
slug: "incrementality"
keywords: "incrementality, incrementality meaning, incrementality measurement, incrementality testing"
category: "Measurement & Methodology"
relatedPosts: ["incrementality-measurement"]
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

## How it's measured

The most reliable method is a [holdout test](/glossary/holdout-test): randomly split users into an exposed group and a holdout group, then compare conversion rates. The difference is [uplift](/glossary/uplift).

## Why CPA/ROAS alone isn't enough

CPA and ROAS only describe people who saw the ad — they can't tell you whether the ad *caused* the conversion. If incrementality is near zero, CPA can look great while the ad is doing almost nothing.

## Go deeper

The three practical ways to measure incrementality (holdout, ramp-up, ramp-down) are covered in [Measuring Incrementality](/blog/incrementality-measurement).
