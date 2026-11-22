---
title: "Using Pacing to forecast month-end spend and set a remaining daily budget"
description: "Understand observed spend, elapsed calendar days and the spending rate required to finish on budget."
date: "2026-11-22"
updated: "2026-11-22"
reviewedAt: "2026-11-22"
slug: "dashboard-pacing-guide"
primaryTool: "5-2"
tags: ["Analytics"]
draft: false
faq:
  - q: "Why is there a month-end projection before I enter a monthly target?"
    a: "The projection only needs observed spend and elapsed calendar days. The target is used to calculate how close the projection is to plan and how much room remains each day."
  - q: "Can I compare a one-week export against an account's monthly budget?"
    a: "Only after recovering the earlier month-to-date spend. Filtering to the final week can leave a partial spend numerator paired with the full elapsed calendar-day count."
---

A month-end budget review usually contains two questions. Where will spending land if delivery continues at its current rate? How much room is left each day under the approved cap? Pacing answers both from the same month-to-date total, but the answers can differ substantially in the last few days of the month.

## Start with the last settled observation

Open the example in Pacing with Cost selected. The last observed date is March 30, 2024. The first card shows **₩1,056,908,727** for March and says that 30 days have elapsed. This is a historical example. The date on your computer is irrelevant to the calculation.

## Follow the three amounts across the screen

![Three pacing cards showing observed March spend, daily run-rate and projected month-end landing](/blog-assets/dashboard-guides/pacing-en.webp)

| Display | Calculation | Result |
|---|---|---:|
| Month to date | Included spend from March 1 through March 30 | ₩1,056,908,727 |
| Daily run-rate | Month to date divided by 30 elapsed calendar days | ₩35,230,291 |
| Projected month-end landing | Unrounded daily run-rate multiplied by 31 days | ₩1,092,139,018 |

The first number is observed. The last extrapolates an average over the full month. Multiplying the rounded rate displayed on screen can introduce a few won of rounding difference. Look at the daily cost chart underneath: a launch-day spike and a steady month can have the same average but very different implications for tomorrow.

## Enter a cap and reconcile the final day's allowance

Set the optional cost target to **1,100,000,000**. Subtract observed spend from that target. The remaining allowance is ₩43,091,273. Only March 31 remains, so that is also the remaining daily budget required to land on the target. The ₩35,230,291 run-rate describes how the month has gone so far. The ₩43,091,273 allowance describes what the approved plan would permit on the final day.

Clear the target and the linear projection still has enough information to run. The target-dependent recommendation no longer does. Before changing a platform cap, check committed campaigns, late invoices and spend already incurred on the unclosed day. Spending every remaining won is a budget choice, not an estimate of return.

## Check which rows actually make up the month

If you filter the dashboard to March 24–30, the earlier March spend drops out. A card saying “Day 30 elapsed” does not establish that the file contributed thirty days of spend. Include the first day of the month and distinguish genuine zero-delivery days from missing rows. Pair a channel-filtered series with that channel's budget, not the total account budget.

Switching from cost to installs or signups changes the target's unit. Use a count for those targets. Daily revenue also has a different date basis from cumulative D7 revenue attributed to an install cohort. Substituting the latter for cash or revenue actually booked on a calendar day distorts a monthly forecast.

## Use the projection in a decision

If the landing exceeds the cap, check for exceptional days or incomplete reporting before selecting a channel to trim. Compare scale and efficiency in the [Segment matrix](/en/blog/dashboard-segment-guide). Record the last settled date, approved target, projected landing and remaining daily allowance together. Tomorrow's reviewer can replace a single day's estimate with actual spend and see exactly why the recommendation changed.
