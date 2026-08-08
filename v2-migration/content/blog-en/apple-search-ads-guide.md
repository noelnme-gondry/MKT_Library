---
title: "Apple Search Ads (ASA) Keyword Discovery: Exact Promotion and CPT Bids"
description: "Use ASA search-term reports to find Exact-promotion candidates and adjust CPT bids from budget pacing and target CPA."
date: "2026-08-09"
slug: "apple-search-ads-guide"
keywords: "Apple Search Ads, ASA, ASA keyword discovery, ASA Exact promotion, ASA CPT, ASA bid, ASA search term report, ASA campaign structure, App Store search ads"
tags: ["ASA", "UA"]
draft: false
primaryTool: "5-26"
relatedGlossary: ["cpi", "cpa"]
answer: "Promote non-Exact search terms only after they have enough taps and installs and meet target CPA. Raise CPT slightly when pacing is low and performance is good; lower it when spend is high and performance misses target."
conditions: "The 3-install, 8-tap, and ±10–15% CPT thresholds are this service's operating defaults, not Apple rules. Adjust them to account size and volatility, and verify current match behavior and bid limits in Apple Ads."
reviewedAt: "2026-08-09"
reviewer: "Growth Opt Playbook"
sources:
  - title: "Apple Ads: Understand keyword match types"
    url: "https://ads.apple.com/app-store/help/keywords/0059-understand-keyword-match-types"
  - title: "Apple Ads: Considerations for keyword bids"
    url: "https://ads.apple.com/app-store/help/bids-and-budget/0076-considerations-for-keyword-bids"
  - title: "Apple Ads: Manage budgets"
    url: "https://ads.apple.com/app-store/help/bids-and-budget/0016-manage-budgets"
faq:
  - q: "Does ASA Exact match only an identical query?"
    a: "No. Exact is the tightest match type, but Apple says close variants such as misspellings, plurals, reordered words, and translations may still match."
  - q: "Should I always raise CPT when budget pacing is low?"
    a: "No. It is a raise candidate only when pacing is low and target CPA is being met. If performance is poor, inspect the term, product page, market, and seasonality first."
---

Run Apple Search Ads (ASA) as one lumped campaign, and a few days later the report may show brand terms taking most of the spend — people who may have searched for your app anyway. ASA sits at the top of App Store search and can reach **high-intent users**. To make that value repeatable, separate campaigns by purpose and run a loop for discovering terms, promoting Exact targets, and adjusting bids.

## Split campaigns by purpose

ASA is usually split into four buckets by keyword type. Different purposes mean different CPA expectations and bid strategies.

- **Brand**: searches for your app or company name. Cheapest CPA, but high [organic cannibalization](/blog/cannibalization-organic-paid) risk (they may be coming anyway).
- **Competitor**: searches for rival app names. This is where you steal demand — pricier, with policy constraints to check.
- **Category (generic)**: general terms like "budget tracker" or "workout log." This captures new demand from people who didn't know you.
- **Discovery**: Apple auto-explores related keywords. Promote the winners here into the campaigns above.

Mix purposes into one campaign and budget and bids tangle — cheap brand ends up eating the budget while the rest never learns. Split them, and "where the money actually is" becomes visible.

## Match types: discovery and control

- **Exact**: the tightest control for validated keywords. Close variants such as misspellings, plurals, reordered words, and translations may still match.
- **Broad**: expands to variants and related terms. This is your discovery mode.

The operating loop sits between these match types. Explore with discovery and broad, find proven terms in the search-term report, **promote them to Exact**, and review poor performers for negative keywords. Running this discover → promote → block cycle is the backbone of ASA.

![ASA keyword discovery, Exact promotion, and CPT action loop](/blog-assets-en/apple-search-ads-guide/keyword-loop.svg)

## How to choose Exact-promotion candidates

Exact is not for any term that happens to look good. It is where you place a search term that is proven enough to deserve its own control. Check all three conditions:

- The term is still non-Exact, such as Search Match or Broad.
- It has enough volume to judge, for example at least 3 installs and 8 taps.
- It meets your target CPA.

When a term passes, add it as an Exact target and review the original target and negative structure in the next report. Promotion does not automatically mean you should pause Broad. Exact gives a proven term its own budget and CPT control.

## Raise CPT when pacing is low and performance is good

If a campaign repeatedly spends far below its daily budget while CPA beats target, it may be missing auction opportunities. Before making a large budget change, raise **CPT in a small step** so you can isolate what changed. The thresholds below are this service's operating heuristics, not official Apple bid rules.

- Below 70% pacing while meeting target CPA: suggest CPT +10%.
- Below 40% pacing while meeting target CPA: consider CPT +15%.

If spend is high and CPA misses target, lower CPT instead.

- Above 110% pacing while missing target CPA: suggest CPT −10%.
- Above 140% pacing while materially missing target: consider CPT −15%.

Low pacing with poor performance is not a reason to raise CPT. Check the search term, product page, market, and seasonality first. High pacing with good performance is usually a budget-limit and incrementality question, not a reason to bid even higher.

The [ASA Keyword Finder · CPT Actions tool](/tools/asa-keyword-finder) applies these rules to a CSV and lists Exact-promotion, negative-review, and bid-action candidates.

## Initial setup order

1. **Brand campaign (defense)** — stop competitors from ranking above your name. But always check cannibalization.
2. **A few category Exacts** — start learning on a handful of solid generic keywords.
3. **Discovery** — hand it wide to Apple to gather candidates.
4. **Search-term report → promote / block, repeat** — it sharpens as data accumulates.

Detailed steps are in the [Apple Search Ads guide](/guide/apple-search-ads).

## Check incrementality on brand keywords

Of the four, brand is the trickiest. The cheap CPA looks great, but many of those installs **would have come organically without the ad**. Confirm real incrementality by turning it off in some regions with [incrementality analysis](/tools/incrementality) and watching total installs. If installs don't drop when you turn it off, that budget was re-buying organic with paid dollars.

## Let's be honest

ASA's UI, match types, and policies keep changing. These are operating principles; check the current console and Apple's official documentation for setup screens, eligible settings, and bid limits before you build.
