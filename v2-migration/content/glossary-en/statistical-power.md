---
term: "Statistical Power"
seoTitle: "Statistical Power: Why 'Not Significant' Is Not 'No Effect'"
shortDef: "The probability of detecting a real effect when one exists — a small sample misses effects that are there"
description: "Power is the chance of detecting a real effect. It is why a non-significant result cannot be reported as no effect."
date: "2026-08-18"
slug: "statistical-power"
keywords: "statistical power, sample size, not significant meaning, no effect, type II error, ab test sample size"
relatedPosts: ["ab-testing", "uplift-holdout-guide"]
category: "Measurement & analysis"
draft: false
faq:
  - q: "Does not significant mean there is no effect?"
    a: "No. With low power, a real effect goes undetected. 'Not significant' means 'not yet distinguishable', and claiming no effect requires separate evidence that the test could have detected one."
  - q: "What determines power?"
    a: "Sample size, the size of the effect you want to detect, and the variability of the data. Detecting smaller differences requires disproportionately more sample, so decide up front how small a difference matters."
---

## In one line

Statistical power is the probability that a test detects a real effect when one exists. With low power, effects that are genuinely there get missed.

## Why it matters

A non-significant result has two possible explanations: there really is no effect, or there is one and the sample was too small to see it.

Reporting the second as "no effect" kills working initiatives. The [burden of proof is asymmetric](/blog/ab-testing) — claiming no effect requires showing the test would have caught an effect of the size that matters.

## Decide before you start

Power comes from sample size, target effect size, and variability. So the order is to decide how small a difference you care about, then derive the sample needed from that.

This matters most on low-conversion campaigns, where both the [holdout](/glossary/holdout-test) size and the run length have to grow.

## Go deeper

Sample planning and decision rules are covered in [A/B testing](/blog/ab-testing).
