---
title: "Using Anomaly Detection to investigate a change in daily spend"
description: "Investigate unusual spend with a trailing baseline, sensitivity threshold and weekday adjustment."
date: "2026-11-22"
updated: "2026-11-22"
reviewedAt: "2026-11-22"
slug: "dashboard-anomaly-guide"
primaryTool: "5-2"
tags: ["Analytics"]
draft: false
faq:
  - q: "Why does the day with the highest spend have a smaller z-score?"
    a: "Each observation has its own expected level and variability. A lower-spend day can be further from its expected level in standard deviation units."
  - q: "Does a date disappearing from the table mean the issue was fixed?"
    a: "Changing the window, sensitivity or weekday adjustment changes the detection rule. Check the original operating data and subsequent performance to establish what actually happened."
---

The most expensive day is not necessarily the most unusual day. A change that barely registers in a volatile campaign can stand out sharply in a stable one. Use Anomaly Detection to decide which dates deserve a review of the operating log. A budget target or a profitability threshold answers a different question.

## Locate two flagged dates under the same settings

Open the example with Cost, a 14-day baseline, sensitivity of 2.5 standard deviations and day-of-week adjustment off. Leave the full history selected. The model needs observations before the date it is judging. Find March 24 and March 25 in the table beneath the series.

## Reconcile the plotted markers with the table

![Anomaly table listing observed spend, baseline and z-score for March 24 and March 25](/blog-assets/dashboard-guides/anomaly-en.webp)

| Date | Observed spend | Baseline for that date | z-score |
|---|---:|---:|---:|
| March 24 | ₩41,086,193 | ₩34,611,808 | +3.08 |
| March 25 | ₩43,213,784 | ₩35,475,059 | +2.63 |

March 25 cost more, but March 24 was further from its baseline relative to observed variability. Subtract the baseline from the actual spend on March 24 to get an excess of ₩6,474,385. The z-score expresses a deviation in units of variability, so rankings by currency and by z-score can disagree.

Read the series horizontally to see whether a marker is isolated or followed by a sustained change. Then use the table to verify date, actual, baseline and direction. Two consecutive observations at a new delivery level suggest a different line of investigation from a single late invoice.

## Adjust one control at a time

The baseline uses an exponentially weighted moving average. A shorter window responds more quickly to a new level. A longer window retains more history, and dates near the start of the series may lack enough observations for a judgement. Changing the window changes the expected value as well as the volatility used for comparison.

Keep the 14-day window and raise the threshold to 3. The +3.08 observation clears it while +2.63 does not. Restore 2.5 before experimenting with weekday adjustment. Turning that on incorporates the historical weekday effect into the expectation. If every weekend behaves differently, this check can keep an ordinary Saturday from triggering the same investigation repeatedly.

## Check the source before naming a cause

When using CPI, inspect install counts alongside the unit cost. Low volume alone can produce a large movement. Check reporting time zones, double-counted daily exports and conversions that settle later than spend. Only then compare the dates with budget increases, creative swaps and delivery changes. A z-score is not the probability that a campaign setting caused an incident.

A practical handoff for this example would name March 24, the ₩6.47 million gap and the person responsible for reconciling spend by channel. If traffic rose at the same time, use [Funnel Diagnosis](/en/blog/dashboard-funnel-guide) to inspect click response and installation separately. An empty table means no dates met the selected rule; a slow deterioration in profitability may still deserve a different review.
