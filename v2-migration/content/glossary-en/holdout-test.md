---
term: "Holdout Test"
seoTitle: "Holdout Test: Measuring an Ad's Real Effect"
shortDef: "Randomly withholding ads from part of an audience to measure true incrementality"
description: "A holdout test randomly withholds ads from part of an audience and compares outcomes. Why it is needed and how to read the result honestly."
date: "2026-07-18"
updated: "2026-08-26"
slug: "holdout-test"
keywords: "holdout test, holdout meaning, incrementality test, ad holdout experiment"
category: "Measurement & Methodology"
relatedPosts: ["incrementality-measurement"]
sources:
  - title: "Google Ads: Set up Conversion Lift"
    url: "https://support.google.com/google-ads/answer/12005564?hl=en"
draft: false
faq:
  - q: "How large should the holdout group be?"
    a: "Too small and you cannot distinguish the difference; too large and you give up revenue. Aim for the smallest group that can resolve the effect size you expect — the fewer conversions a campaign produces, the larger both the holdout and the window must be."
  - q: "How long should a holdout test run?"
    a: "Longer than the purchase cycle. If conversions arrive days later and you run for a week, the exposed group is compared while its outcomes are still maturing. Set the end date before you start and do not move it on interim results."
  - q: "Can incrementality be measured without a holdout?"
    a: "You can estimate it from before-and-after comparisons or a time-series baseline, but those cannot separate other changes in the same window. Use them as estimates and stop short of calling them causal."
  - q: "How do you read a holdout result?"
    a: "The gap in conversion rate between the two groups is the uplift. 8% in the exposed group against 5% in the holdout is 3pp of uplift. An interval crossing zero means not yet distinguishable rather than no effect. Holdout share has no universal answer; derive it from the minimum detectable effect, conversion volume, duration, and opportunity cost."
---

## In one line

Randomly split users or regions into two groups, withhold ads from one of them entirely, and compare. That design is a holdout test.

## Why it's needed

Observational data alone can't prove an ad caused a lift in conversions. Comparing a group that saw the ad against a group that genuinely didn't is the only way to confirm real [incrementality](/glossary/incrementality).

## How to interpret it

Similar point estimates alone are not strong evidence of no increment. The interval must be narrow enough to rule out an effect that matters to the business. A wide interval crossing zero means the sample cannot yet distinguish the effect. A precise near-zero result can support investigating [cannibalization](/glossary/cannibalization).

## Design checklist

- Lock the primary metric and minimum detectable effect before launch.
- Derive holdout share from conversion volume, duration, and opportunity cost; a platform's allowed range is not a recommendation.
- Include the full conversion-lag window.
- Check contamination from other campaigns and movement across geo cells.
- Do not move the end date or swap metrics after seeing interim results.

## Go deeper

How to design and read a holdout test in practice is covered in [Measuring Incrementality](/blog/incrementality-measurement).
