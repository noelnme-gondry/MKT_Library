---
title: "Using the Scorecard to compare two marketing reporting periods"
description: "Align observed dates and metric denominators before reporting changes in spend, installs or conversion."
date: "2026-11-22"
updated: "2026-11-22"
reviewedAt: "2026-11-22"
slug: "dashboard-scorecard-guide"
primaryTool: "5-2"
tags: ["Analytics"]
draft: false
faq:
  - q: "Why can two calendar weeks still give an unfair comparison?"
    a: "A source can omit days or contain partially settled conversions. The displayed totals are not normalized for missing dates, so check the observed counts as well as the calendar boundaries."
  - q: "Should the weekly review lead with CPA or CPI?"
    a: "Use the metric that matches the decision. CPI describes acquisition of an install. CPA depends on the specific mapped action and can be interpreted as cost per purchase only when that action really is a purchase."
---

A weekly review can show rising installs, improving click-to-install conversion and a higher cost per action at the same time. The Scorecard helps you explain how those statements fit together. Use it before preparing a management summary, especially when different teams have been reporting “conversion” with different denominators.

## Establish the comparison before reading the cards

Open the example and check the four dates under Custom. The analysis runs from March 24 through March 30, 2024. The comparison runs from March 17 through March 23. The display reports **7 current and 7 comparison time points**. Two seven-day calendar ranges can still contain different numbers of observed days after export errors or filtering.

## Read the large value and the change separately

![Selected-period Scorecard showing 173,282 installs alongside a CPI of ₩1,682](/blog-assets/dashboard-guides/scorecard-en.webp)

| Card | Current period | What it answers |
|---|---:|---|
| Installs | 173,282 | Acquired volume increased 2.8%. |
| CPI | ₩1,682 | An install cost 14.1% more on average. |
| Actions | 62,991 | How many downstream events were recorded? |
| CPA | ₩4,628 | How much spend was associated with each recorded action? |

The large value describes the selected period. The arrow below it describes a change from the comparison period. An upward arrow for spend has a different operating implication from an upward arrow for revenue. Decide which quantity your team intended to grow or contain before turning the arrow into a verdict.

## Reconcile rates that appear to disagree

Take the current spend of ₩291,513,235. Divide it by 173,282 installs to get about ₩1,682 per install. Divide the same spend by 62,991 actions and you get about ₩4,628 per action. An account can acquire more installs and still become more expensive per downstream action.

Now inspect the 11.16% CVR card. In this sample it measures installs per click. A higher rate at that transition tells you nothing by itself about the next transition from install to action. Check which event was mapped as an action before presenting CPA to someone who interprets it as cost per purchase.

## Use the daily comparison to challenge the weekly story

Select a chartable KPI to open its daily comparison. A single expensive day can move the period average, as can a smaller change sustained throughout the week. Look across the whole series before picking an investigation date. If you alter a date range while testing a hypothesis, the other cards inherit that comparison too. Record both windows in the final note.

For an unusually short reporting week, you may need cost per observed day. Calculate that separately for each period and say how many days contributed. CPI continues to use the period's total spend and total installs. Dividing or averaging already-calculated daily CPIs answers a different question.

## Assign the next investigation

A defensible summary for the example is that the team bought more installs at a higher average price. To find out whether channel mix changed, open [Visualization](/en/blog/dashboard-viz-guide). To investigate whether the weaker economics emerged before or after install, open [Funnel Diagnosis](/en/blog/dashboard-funnel-guide). Give the next reviewer the windows, the event definition and the metric to revisit so they can repeat the comparison after the next set of days closes.
