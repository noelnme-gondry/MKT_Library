---
title: "How to read the Visualization dashboard when installs and CPI both rise"
description: "Read acquisition cost alongside volume, then trace a weekly change to a date and a channel."
date: "2026-11-22"
updated: "2026-11-22"
reviewedAt: "2026-11-22"
slug: "dashboard-viz-guide"
primaryTool: "5-2"
tags: ["Analytics"]
draft: false
faq:
  - q: "Why doesn't averaging the channel CPIs reproduce the card?"
    a: "The card divides total spend by total installs. Averaging the channel figures equally gives a channel with one hundred installs the same weight as one with ten thousand."
  - q: "Should a single spike on the daily chart trigger a bid change?"
    a: "Check install volume, reporting latency and the campaign change log for that day first. Spend can arrive earlier than the installs credited against it."
---

Installs went up, yet the weekly review says acquisition got more expensive. Both can be true. The Visualization tab lets you start with the cost of an install across two weeks, then find the dates and channels worth investigating before anyone changes a bid.

## Open the same two weeks

The example opens Visualization for March 24–30, 2024, with March 17–23 as the comparison. Keep all channels and countries selected. Check both date ranges at the top and find Spend, Installs and CPI in the recent-performance summary. Those three values answer different parts of the same question.

## Rebuild the summary from the totals

![Daily CPI trend in Visualization, where the weekly change can be traced to individual dates](/blog-assets/dashboard-guides/viz-en.webp)

| Measure | March 17–23 | March 24–30 | Interpretation |
|---|---:|---:|---|
| Spend | ₩248,484,515 | ₩291,513,235 | Delivery cost grew 17.3%. |
| Installs | 168,495 | 173,282 | Acquired volume grew 2.8%. |
| CPI | ₩1,475 | ₩1,682 | Each acquired install cost 14.1% more on average. |

Divide 291,513,235 by 173,282 and round to the nearest won. That recovers the current card. For the percentage change, divide the current unrounded CPI by the previous unrounded CPI, then subtract one. A spreadsheet that averages channel CPIs gives a small channel the same weight as a large one. It can answer a different question even when every individual row is correct.

## Move from the cards to the charts

The summary compresses a week into one figure. Select CPI in the KPI area and read the title on the trend beneath it. Inspect individual dates to distinguish a concentrated spike from several days at a higher level. Those patterns can produce the same weekly average and call for different investigations.

In Daily Cost & Installs, the lines have different units and axes. Their crossing has no economic meaning. Read the change in each series on its own scale. Then compare CPI by Channel with Cost Share by Channel. A channel with expensive installs but little spend can be less consequential to the total than a slight deterioration in a large channel.

## Repeat the investigation on an account export

Map date, spend and installs first. Add country and channel if you intend to use those filters. Keep the currency, attribution window and definition of an install consistent across the two windows. An export with today's full spend and only some of today's installs will make recent acquisition look expensive. Use the latest settled date for both comparisons.

Narrow to one channel and compare its CPI with its own prior week. Restore the full channel selection and examine whether spend moved toward expensive channels. This separates two plausible explanations for the aggregate rise. A date or slice with zero installs provides no measurable cost per install.

## Decide what belongs in the review

You can report that spend rose 17.3%, installs rose 2.8% and CPI rose 14.1%. Assign someone to identify whether the change was concentrated in dates or segments. A date-specific change leads to [Anomaly Detection](/en/blog/dashboard-anomaly-guide). A change concentrated in one market or channel leads to the [Segment matrix](/en/blog/dashboard-segment-guide). A budget decision should also take account of conversion quality, the operating change log and how much money the affected slice represents.

When you move these figures into a weekly report, use the [Scorecard](/en/blog/dashboard-scorecard-guide) to document the observed days in each window. To test whether the change recurs in the same month across years, compare calendar positions in [Seasonality](/en/blog/dashboard-seasonality-guide).
