---
term: "Attribution Window"
seoTitle: "Attribution Window: Why Each Platform Reports Differently"
shortDef: "How many days after an ad touch a conversion still counts toward that ad"
description: "The attribution window is how long a conversion still counts toward an ad. Different windows produce different counts."
date: "2026-08-18"
slug: "attribution-window"
keywords: "attribution window, lookback window, 7-day click 1-day view, conversion counts differ, attribution settings, view window"
relatedPosts: ["attribution-data-mismatch"]
category: "Tracking & tech"
draft: false
faq:
  - q: "Are differing conversion counts caused by the window?"
    a: "It is one of the most common causes. Meta defaults to 7-day click plus 1-day view; if another tool uses a 30-day click window, the same conversions in the same week are counted differently. Align the windows before comparing."
  - q: "Does a longer window improve performance?"
    a: "It raises the reported count, not the actual result. A longer window sweeps in more conversions that would have happened anyway, so it moves you further from incrementality, not closer."
---

## In one line

The attribution window is how many days after a click or a view a conversion still counts toward that ad. Click and view windows are normally set separately.

## Where the numbers split

The same week's conversions can read 120 in Meta, 70 in GA4, and 85 in an MMP. None of them is broken — the windows, the timing of aggregation, and the conversion definitions differ.

Meta's default is 7-day click plus 1-day view. Layer in whether [view-through conversions](/glossary/view-through-conversion) are included and the gap widens further.

## Longer is not better

Widening the window raises reported conversions. But the added share is disproportionately conversions that would have occurred without the ad, which is exactly where reported numbers and [incrementality](/glossary/incrementality) move in opposite directions.

## Go deeper

How to reconcile counts across systems is covered in [attribution data mismatch](/blog/attribution-data-mismatch).
