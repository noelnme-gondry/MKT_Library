---
term: "Uplift"
searchTitleTerms: ["Uplift"]
seoTitle: "What Is Uplift? Measure Incremental Ad Impact with a Holdout"
shortDef: "The outcome difference between treatment and control; interpreting it as incremental ad impact requires a valid design"
description: "If the exposed group converts at 8% and the holdout at 5%, uplift is 3pp. How to run the split, and why ROAS can look fine when uplift is near zero."
date: "2026-08-09"
updated: "2026-09-14"
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
    a: "ROAS divides attributed ad revenue by cost under a stated attribution rule. Uplift compares treatment and control outcomes and estimates what advertising added under a valid design. Attributed and incremental performance are different quantities."
  - q: "How do you calculate uplift?"
    a: "From the outcome difference between a randomly assigned exposed group and a holdout. If the exposed group converts at 8% and the holdout at 5%, uplift is 3 percentage points. Without random assignment, or with different windows or audiences, that gap is not an ad effect."
  - q: "Can uplift come out negative?"
    a: "Yes. Sampling variation, measurement or design problems, and a real negative effect are all possible. Do not choose an explanation from the point estimate alone. An interval crossing zero does not establish no effect; its direction remains unresolved."
---

## In one line

Compare outcomes in a group assigned to advertising with a control assigned to have that advertising withheld. Interpreting this uplift as incremental impact requires checking random assignment, aligned observation windows and interference between groups.

```
Absolute uplift = exposed conversion rate − holdout conversion rate
Relative uplift = absolute uplift ÷ holdout conversion rate
Incremental conversions = absolute uplift × addressable audience
```

Absolute is in percentage points, relative in percent. Reporting the same test in both units is how 3pp gets read as 60%.

[Incrementality](/glossary/incrementality) sits one layer above. Uplift is the difference itself; incrementality asks whether that difference may be credited to advertising at all. Without random assignment uplift still computes — it just cannot be called incremental.

![Conversion-rate difference between an exposed group and a holdout group](/blog-assets-en/uplift/holdout-uplift.svg)

## Why it matters

Not every conversion in an exposed group is caused by the ad — some of those people (brand searchers, repeat buyers) would have converted regardless. Uplift isolates the piece that's genuinely incremental.

The standard way to measure it is a [holdout test](/glossary/holdout-test): randomly split users into an exposed group and a holdout group that sees no ads, then compare conversion rates.

## Why CPA/ROAS alone isn't enough

CPA and ROAS relate cost to outcomes counted under an attribution rule. They do not establish whether advertising caused those outcomes. Even a near-zero uplift point estimate cannot establish a small effect without considering its uncertainty.

## How is uplift calculated?

Start with the conversion-rate difference between a randomized exposed group and holdout group. If the exposed group converts at 8% and the holdout at 5%, **absolute uplift is 3 percentage points**, while **relative uplift is (8%−5%)÷5%=60%**. Those are different units and should be labelled as `pp` and `%` in a report.

| Metric | Calculation | Example |
| --- | --- | --- |
| Absolute uplift | Exposed rate − holdout rate | 3pp |
| Relative uplift | Absolute gap ÷ holdout rate | 60% |
| Incremental conversions | Absolute uplift × exposed population | Depends on population |

If assignment was not randomized, or the groups differ in audience or timing, that difference alone is not proof of ad impact. Use the [Incrementality Analysis tool](/tools/incrementality) to choose a holdout, launch, or shutdown method that matches your data.

## The same 3pp can support different decisions

Eight versus five conversions in groups of 100 gives a 3pp difference. So does 800 versus 500 in groups of 10,000. Their uncertainty is not the same. Keep assigned population, converted population and observation window for each group, rather than saving only percentages.

Use the **assigned population defined by the analysis design**, not a subset selected afterward because they actually saw an ad. Selecting on actual exposure after randomization can introduce selection bias. When the holdout rate is zero, relative uplift is undefined; do not report it as 0% or infinite performance.

## Go deeper

See how to run a holdout test to measure uplift in [Measuring Incrementality](/blog/incrementality-measurement).
