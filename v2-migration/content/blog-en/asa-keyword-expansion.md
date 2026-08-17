---
title: "ASA Keywords: When to Promote to Exact Match"
description: "Pick promotion candidates from the search terms report, then adjust bids using budget consumption and target CPA."
date: "2026-08-15"
slug: "asa-keyword-expansion"
keywords: "Apple Search Ads, ASA keywords, exact match promotion, discovery campaign, ASA bidding, CPT adjustment, search terms report, App Store search ads, ASA account structure"
tags: ["ASA", "UA"]
draft: false
faq:
  - q: "Should the Discovery campaign stay on permanently?"
    a: "Yes. Discovery exists to find new search terms, so turning it off after promoting some to Exact stops the next candidates from appearing. Add each promoted term as a negative in Discovery instead, to avoid bidding against yourself."
  - q: "Should the promotion rule be based on conversion count or CPA?"
    a: "Both. You need enough conversions to judge on (count) and efficiency against target (CPA). A search term with one or two conversions can show a great CPA purely by chance."
---

# In What Order Do You Widen ASA Keywords?

Apple Search Ads is the only advertising that appears in App Store search results. Given how much of iOS app discovery runs through search, there is no reason not to run it — but a badly built structure has you competing against yourself on the same search term.

The basic structure is to **separate the campaign that finds from the campaign that spends**.

## What each campaign is for

**Discovery** — finds search terms. Open it wide with Search Match or broad match and watch which terms actually convert. The goal is candidate discovery, not efficiency.

**Exact** — holds only validated terms on exact match. This is where the budget goes and where efficiency is managed.

Move terms that proved out in Discovery to Exact, and **add each moved term as a negative in Discovery**. Skip that step and both campaigns bid on the same term at once, which raises your CPT.

## The promotion rule

Read the search terms report and look at two things together.

1. Have enough conversions accumulated to judge? One or two conversions can produce a flattering CPA by chance.
2. Does efficiency meet target CPA? Whether the actual CPA, on those accumulated conversions, lands inside target.

Terms meeting both conditions are promotion candidates. Terms spending heavily with no conversions are negative-keyword candidates.

Feed the search terms report to [ASA keyword discovery](/tools/asa-keyword-finder) and it computes this verdict per term and exports the action list as CSV.

## Read bids (CPT) alongside budget consumption

The common mistake after promotion is adjusting on CPA alone. Two axes belong together.

- **CPA under target, budget left over** → raise the bid. You could buy more and are not.
- **CPA under target, budget fully spent** → consider raising the budget. The bottleneck is budget, not the bid.
- **CPA over target, budget fully spent** → lower the bid.
- **CPA over target, budget left over** → re-examine the search term itself.

Without a target CPA this verdict is not possible at all. Moving bids arbitrarily leaves you without a direction, so setting the target comes first.

## Judge brand terms separately

Search terms containing your own brand name come back with overwhelmingly good CPAs. But a large share of those people would have found the app without the ad.

Keeping brand terms in the same campaign as generic terms creates the illusion of a good overall CPA, and raising budget on that number does not raise actual new installs. Split the campaign and evaluate it separately. When you want the real incremental figure, run an on/off comparison in [incrementality analysis](/tools/incrementality).
