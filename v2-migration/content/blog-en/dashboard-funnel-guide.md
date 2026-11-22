---
title: "Using Funnel Diagnosis to locate a week-over-week conversion drop"
description: "Compare stage counts and denominators across two windows, then inspect trends and channel differences."
date: "2026-11-22"
updated: "2026-11-22"
reviewedAt: "2026-11-22"
slug: "dashboard-funnel-guide"
primaryTool: "5-2"
tags: ["Analytics"]
draft: false
faq:
  - q: "Does the displayed −2.1% mean CTR fell by 2.1 percentage points?"
    a: "It is relative change against the previous rate. The displayed rates of 2.65% and 2.59% differ by about 0.06 percentage points, and the tool calculates from unrounded inputs."
  - q: "Why can the lowest weekly transition differ from the trend chart's title?"
    a: "The weekly table compares all available transitions. The lower chart follows one selected stage, so choose the stage you intend to investigate before reading its daily or channel breakdown."
---

Installs fell. Should the creative team change the ad, should the store team change the listing, or should the product team change onboarding? Funnel Diagnosis splits the question into adjacent transitions. Use it to find the stage that weakened versus last week. The stage with the lowest absolute rate may simply be one where the normal denominator is much larger.

## Open an example that includes both comparison windows

The Weekly change table compares the latest seven observed dates, March 24–30, 2024, with the preceding observed dates. Keep the full example range available. Filtering the dashboard to only the current week can remove the previous denominator. A blank previous-week column provides no basis for a decline verdict.

## Select a transition using the comparison table

![Weekly stage comparison showing lower clicks per impression and higher installs per click](/blog-assets/dashboard-guides/funnel-en.webp)

| Transition | Previous week | Current week | Absolute change from displayed rates |
|---|---:|---:|---|
| Impressions → clicks | 2.65% | 2.59% | About −0.06 percentage points |
| Clicks → installs | 11.14% | 11.16% | About +0.02 percentage points |
| Installs → actions | 36.31% | 36.35% | About +0.04 percentage points |

Impressions to clicks is the first transition to investigate. The dashboard's −2.1% describes a relative change in the rate. The difference between the rounded rates is about −0.06 percentage points. The calculation uses unrounded inputs, so a reconstruction from the displayed values can differ slightly. Neither downstream transition declined in this example.

## Make the trend chart answer the same question

The upper table includes multiple transitions. The trend and breakdown below it use one selected conversion stage. The example initially shows clicks to installs in that lower section. Select Impressions→Clicks and verify the chart title before explaining a CTR problem from the daily line.

Split the selected transition by channel. Read the denominator volume next to the rate. A rate based on a hundred impressions tends to be much more variable than one based on a million. In the daily view, a point below the period average can still be an improvement on yesterday. Check the baseline used by each annotation before attaching an operating incident to a date.

## Match the event definitions in an account export

For each transition, sum the next-stage events and divide by the sum of the preceding-stage events. Align the observation window, audience and attribution rules. A zero denominator produces an undefined rate. Source files may count repeat clicks alongside unique installs. Aggregate event totals cannot prove that an identified person performed the steps in order.

Check for missing dates and changes in weekday or country mix. The weekly comparison uses observed dates, which need not be consecutive calendar days in an incomplete export. Narrowing to the same country and channel can distinguish a composition shift from weaker response within a placement.

## Hand a specific question to the next team

Ask the creative team whether certain placements or creatives account for the weaker impression-to-click transition. The example offers little reason to start with an onboarding redesign. Use the [Segment matrix](/en/blog/dashboard-segment-guide) to identify affected markets. After any intervention, revisit the same transition with the same event definitions and comparable windows so the follow-up can address the original issue.
