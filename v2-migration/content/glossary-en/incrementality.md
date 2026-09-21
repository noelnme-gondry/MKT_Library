---
term: "Incrementality"
searchTitleTerms: ["Incrementality"]
seoTitle: "Incrementality Meaning: How to Measure Ad Lift"
shortDef: "The pure additional performance an ad actually caused"
description: "What did advertising add? Compare incrementality, attribution, uplift, CPA and iCPA with calculation examples and design limits."
date: "2026-07-18"
updated: "2026-09-14"
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
    a: "Attribution allocates credit for observable, attributable conversions under a rule. Incrementality asks what advertising added relative to its absence. Missingness, duplication and reporting scope vary, so do not assume every report allocates 100% of all conversions."
  - q: "How do you measure incrementality?"
    a: "A randomised holdout is the strongest design. Without a control group you can use before-and-after comparisons around turning a campaign on or off, geo splits, or a time-series baseline. Each step down that list lets more competing explanations in."
  - q: "If incrementality is low, should I turn the ads off?"
    a: "Check sample size and window before cutting. Incremental estimates often carry wide intervals, and campaign types whose effect arrives late — brand campaigns especially — are understated over short observation periods."
---

## In one line

A hundred conversions does not mean advertising caused a hundred conversions. Subtract the people who would have arrived anyway and what remains is incrementality.

```
Incremental conversions = observed conversions with ads − expected conversions without ads
```

The right-hand term is never observed. So measuring incrementality is really about deciding what stands in for "without ads" — holdouts, geo splits and pre/post comparisons are competing ways to choose that stand-in.

| Concept | Question it answers | Typical output |
| --- | --- | --- |
| Attribution | Who gets credit for a conversion that happened? | Attributed conversions by channel |
| Uplift | How far apart are exposed and control outcomes? | Rate difference in pp or % |
| Incrementality | What outcome would disappear without the ad? | Incremental conversions, iCPA, iROAS |

## How it's measured

The most reliable method is a [holdout test](/glossary/holdout-test): randomly split users into an exposed group and a holdout group, then compare conversion rates. The difference is [uplift](/glossary/uplift). When randomization is not feasible, consider a geo control, a new launch, or a shutdown with difference-in-differences, and weaken causal claims as the design gets weaker.

## Why CPA/ROAS alone isn't enough

CPA and ROAS relate costs to outcomes under attribution rules; they do not establish causation. A near-zero incrementality point estimate is not evidence of no effect until uncertainty and design quality have been assessed.

## CPA and iCPA use different denominators

In a hypothetical experiment, $1,000 in cost and 100 attributed conversions give a $10 CPA. If incremental conversions for the same scope are estimated at 20, iCPA is $50. This is an arithmetic example, not an observed incremental share for a campaign.

| Check | Why it matters |
| --- | --- |
| Aligned cost, conversion and experiment scope | Do not divide account-wide cost by lift from a subset |
| Group sizes and observation windows | Adjust for different sizes and align conversion maturity |
| Estimated interval and design conditions | If lift is nonpositive or its direction is unresolved, do not base a budget on a single iCPA |

In the [Incrementality Analysis tool](/tools/incrementality), check the data shape and design before reading results and withholding reasons. More conversion rows cannot replace a missing control.

## Go deeper

The three practical ways to measure incrementality (holdout, ramp-up, ramp-down) are covered in [Measuring Incrementality](/blog/incrementality-measurement). When randomization is impractical and only a time series exists — brand campaigns are the usual case — [Brand Campaign Incrementality](/tools/brand-campaign-incrementality) reads the intervention against its own pre-trend.
