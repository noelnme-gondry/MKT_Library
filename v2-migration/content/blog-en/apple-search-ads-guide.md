---
title: "Apple Search Ads: Campaign Structure and Targeting"
description: "Run ASA as one lumped campaign and only brand keywords spend. Here's why to split into brand, competitor, category, and discovery, plus match types and the discovery-to-promotion loop."
date: "2026-07-15"
slug: "apple-search-ads-guide"
keywords: "Apple Search Ads, ASA, ASA setup, ASA campaign structure, App Store search ads, ASA keywords, iOS app ads, search ads for apps"
tags: ["ASA", "UA"]
draft: false
---

Turn on Apple Search Ads (ASA) as one lumped campaign, and a few days later the report shows only brand keywords spending — people who were going to search your app anyway. ASA sits at the top of App Store search, so it catches **high-intent users** and converts well. But to earn that, you have to structure the campaigns by purpose first.

## Split campaigns by purpose

ASA is usually split into four buckets by keyword type. Different purposes mean different CPA expectations and bid strategies.

- **Brand**: searches for your app or company name. Cheapest CPA, but high [organic cannibalization](/blog/cannibalization-organic-paid) risk (they may be coming anyway).
- **Competitor**: searches for rival app names. This is where you steal demand — pricier, with policy constraints to check.
- **Category (generic)**: general terms like "budget tracker" or "workout log." This captures new demand from people who didn't know you.
- **Discovery**: Apple auto-explores related keywords. Promote the winners here into the campaigns above.

Mix purposes into one campaign and budget and bids tangle — cheap brand ends up eating the budget while the rest never learns. Split them, and "where the money actually is" becomes visible.

## Match types: discovery and control

- **Exact**: shows only on the exact keyword. Strong control, for validated keywords.
- **Broad**: expands to variants and related terms. This is your discovery mode.

The core of operations is the loop between them. Cast wide with discovery and broad, find winners in the search-term report, **promote to Exact**, and block poor performers as negative keywords. Running this discover → promote → block cycle weekly is the backbone of ASA.

## Initial setup order

1. **Brand campaign (defense)** — stop competitors from ranking above your name. But always check cannibalization.
2. **A few category Exacts** — start learning on a handful of solid generic keywords.
3. **Discovery** — hand it wide to Apple to gather candidates.
4. **Search-term report → promote / block, repeat** — it sharpens as data accumulates.

Detailed steps are in the [Apple Search Ads guide](/guide/apple-search-ads).

## Check incrementality on brand keywords

Of the four, brand is the trickiest. The cheap CPA looks great, but many of those installs **would have come organically without the ad**. Confirm real incrementality by turning it off in some regions with [incrementality analysis](/tools/incrementality) and watching total installs. If installs don't drop when you turn it off, that budget was re-buying organic with paid dollars.

## Let's be honest

ASA's UI, match types, and policies keep changing. The campaign structure here is close to a durable principle, but check the current console and Apple's official docs for the actual setup screens and serving rules before you build.
