---
title: "Connecting SKAN Conversion Value to LTV"
description: "Use conversion-value cohorts as early signals for later value without treating a SKAN label as LTV itself."
date: "2026-08-26"
slug: "skan-conversion-value-ltv"
keywords: "SKAN conversion value LTV, SKAN revenue, conversion value design"
tags: ["Measurement & analysis", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["conversion-value", "ltv", "skan"]
conditions: "The LTV link is an observed cohort relationship, not causal proof. Fine-value availability and observation horizon depend on privacy tier, window, and schema."
sources:
  - title: "updatePostbackConversionValue(_:completionHandler:) — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork/updatepostbackconversionvalue%28_%3Acompletionhandler%3A%29"
  - title: "SKAdNetwork.CoarseConversionValue — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork/coarseconversionvalue?changes=la_8"
faq:
  - q: "Is conversion value 63 always the highest LTV?"
    a: "No. The app or ad network defines each value. You may design 63 as highest value, but its relationship to later LTV needs cohort validation and can change when the schema changes."
  - q: "Can coarse values still connect to LTV?"
    a: "Yes, at lower resolution. Treat low, medium, and high as wider cohort ranges and do not claim fine-value-level campaign conclusions from them."
---

## Conversion value is a label; LTV is later observation

Apple lets the app or ad network define conversion-value meaning. A value such as 17 or `high` is not an Apple revenue amount; it is a label for an early action or value band chosen by the team.

Freeze a schema table first: condition, effective date, window, and fine or coarse band. Then attach later cohort revenue or retention for the same app version, country, and channel scope. That creates an empirical value relationship rather than a claim that the label itself is LTV.

## Keep an interval, not one number

For each band, retain observation count, horizon, and a distribution summary. Coarse bands can contain wide heterogeneity, so report their observed range and decision limit rather than a precise LTV promise. If schema meaning changes, the old and new values are not comparable just because their numeric code matches.

Recalibrate from the change date, expose schema version in the dashboard, and avoid calling a code increase a product-value increase before the new cohort relationship is observed.
