---
title: "Using the Segment matrix to compare CPI and spend by market"
description: "Use the efficiency matrix and the spend table to distinguish expensive installs from budget exposure."
date: "2026-11-22"
updated: "2026-11-22"
reviewedAt: "2026-11-22"
slug: "dashboard-segment-guide"
primaryTool: "5-2"
tags: ["Analytics"]
draft: false
faq:
  - q: "Why doesn't the largest-spend cell always have the weakest colour?"
    a: "Efficiency colour follows the selected metric. Read spend from the smaller number and the fixed cost table. A large amount describes scale and does not establish poor acquisition efficiency."
  - q: "Can I average country CPIs to get the channel's combined CPI?"
    a: "Sum spend and installs across the countries and divide once. An equal-weight average only matches the combined acquisition cost under specific weighting conditions."
---

If installs cost more in Korea than in the US, should Korea be first to lose budget? Price per install and the amount of money exposed are separate pieces of evidence. The Segment tab places the selected efficiency metric and the spend behind it in the same cell, then provides a second table for checking scale.

## Open the channel-by-country example

The example includes March 24–30, 2024, with all countries and channels in scope. Channel is the row axis, Country is the column axis and CPI is selected. Find Meta AAP and move across the KR and US columns. The upper number is the metric; the smaller number below it is the cost of that combination.

## Read the same row twice

![Channel-by-country matrix with acquisition cost and spend in each cell](/blog-assets/dashboard-guides/segment-en.webp)

| Meta AAP | Korea | United States |
|---|---:|---:|
| Cost per install | ₩4,302 | ₩3,924 |
| Spend in the cell | ₩36,368,618 | ₩59,260,612 |

The Korean install cost about ₩378 more, approximately 9.6% above the US value. US spend was about ₩22.89 million higher. The first comparison identifies a unit-price gap; the second describes budget exposure. Neither tells you the marginal return on the next unit of budget, and neither measures what those installs earned later.

## Follow the axes before interpreting the colours

Read across a row to hold channel constant while comparing markets. Read down a column to hold country constant while comparing channels. Comparing Korean Meta AAP with US TikTok changes two dimensions at once. Start with one fixed dimension to give the investigation a clearer question.

The colours refer to the selected metric. Lower CPI or CPA means cheaper acquisition; higher ROAS means more attributed revenue per unit of spend. A shade of red under one metric does not measure the same economic loss as a shade under another. The fixed cost table below has no efficiency colour. Use it to see whether a seemingly weak cell is large enough to influence the account.

## Reproduce a cell on your own data

Filter the export to the same date range, market and channel. Sum spend across the matching rows and divide by their total installs. Avoid averaging campaign-level CPIs, which gives small campaigns excessive weight. Confirm currency, tax treatment and install attribution window across markets. Map both axes; an unspecified group can contain enough spend to distort your interpretation of the named markets.

The organic row illustrates a separate distinction. If an observed combination has positive installs and recorded zero spend, a zero CPI can be meaningful. Where a combination has no rows or a ratio lacks a denominator, a dash preserves the uncertainty. Replacing every dash with zero can make an unmeasured market look like the cheapest one.

## Choose an investigation that matches the evidence

Korea's higher price suggests checking targeting, placement mix and creative response. America's larger spend means a relatively small efficiency change there can have a sizable budget impact. Before shifting money, compare downstream value in [LTV and ROAS](/en/blog/dashboard-ltv-guide) for the same acquisition window. Include the cell, unit cost, spend exposure and next metric in your review note. That gives the next reviewer the information needed to reopen the same comparison after a change.
