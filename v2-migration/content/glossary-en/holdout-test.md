---
term: "Holdout Test"
seoTitle: "Holdout Test: Measuring an Ad's Real Effect"
shortDef: "Randomly assigning users or regions and withholding the tested campaign to estimate incrementality"
description: "A holdout test randomly withholds ads from part of an audience and compares outcomes. Why it is needed and how to read the result honestly."
date: "2026-07-18"
updated: "2026-10-15"
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
    a: "A small holdout can lack precision, while a larger one can increase the opportunity cost of withholding ads. Set its size from the target effect, baseline conversion rate, power and duration. Attributed revenue from withheld advertising is not automatically lost revenue."
  - q: "How long should a holdout test run?"
    a: "Longer than the purchase cycle. If conversions arrive days later and you run for a week, the exposed group is compared while its outcomes are still maturing. Set the end date before you start and do not move it on interim results."
  - q: "Can incrementality be measured without a holdout?"
    a: "You can estimate it from before-and-after comparisons or a time-series baseline, but those cannot separate other changes in the same window. Use them as estimates and stop short of calling them causal."
  - q: "How do you read a holdout result?"
    a: "In an individually randomized experiment, 8% in the assigned treatment group versus 5% in the holdout gives 3pp absolute uplift. Use the assigned population specified by the design, without selecting afterward on actual exposure. An interval crossing zero leaves the direction unresolved; it does not prove no effect. Regional experiments require inference at the assignment level."
---

## In one line

A holdout test randomly assigns users or regions and withholds the tested campaign from one group to compare outcomes. Define the scope of withheld ads and exposure to other campaigns before starting.

## Why it's needed

A simple observed difference cannot establish that an ad caused a lift. Random assignment helps construct a baseline for estimating [incrementality](/glossary/incrementality). Selecting participants afterward based on actual exposure can introduce selection bias.

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
