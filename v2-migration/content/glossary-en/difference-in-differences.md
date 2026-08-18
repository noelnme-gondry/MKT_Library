---
term: "Difference-in-Differences (DiD)"
seoTitle: "Difference-in-Differences: When Pre/Post Is Not Enough"
shortDef: "Subtract the control group's before/after change from the treated group's, removing shared factors"
description: "DiD subtracts one more difference so shared seasonal and market effects cancel. Including the parallel-trends assumption it requires."
date: "2026-08-18"
slug: "difference-in-differences"
keywords: "difference in differences, DiD meaning, pre post comparison, control group analysis, parallel trends assumption"
relatedPosts: ["incrementality-measurement", "correlation-vs-causation"]
category: "Measurement & analysis"
draft: false
faq:
  - q: "How is this different from a simple before/after comparison?"
    a: "Before/after cannot remove seasonality, promotions, or competitive shifts that happened in the same period. DiD uses the fact that the control group lived through the same period to subtract those shared effects once more."
  - q: "What does DiD require to be valid?"
    a: "The two groups' trends must have moved in parallel before treatment. If the curves were already diverging beforehand, the post-treatment gap cannot be read as causal."
---

## In one line

Difference-in-differences subtracts the control group's before/after change from the treated group's — literally a difference of differences.

## Why subtract twice

Suppose revenue rose 10% after switching on a brand campaign. That 10% contains the campaign plus season, promotions, and competitor moves.

If regions without the campaign rose 6% over the same period, that 6% happened without it. The DiD estimate is 10% − 6% = 4%.

## The condition it rests on

Parallel trends. The two groups must have moved together before treatment. If the curves were already separating beforehand, the post gap may just be that pre-existing divergence continuing.

So the first step with DiD is plotting the pre-treatment curves, before looking at any result.

## Go deeper

Alternatives when no control group is possible are covered in [incrementality measurement](/blog/incrementality-measurement).
