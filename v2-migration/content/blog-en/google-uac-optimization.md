---
title: "Google UAC Optimization: Bids, Assets, and Events"
description: "The levers a marketer actually controls inside an automated Google App Campaign — bidding, assets, and conversion events."
date: "2026-07-15"
slug: "google-uac-optimization"
keywords: "Google UAC, Google App Campaigns, UAC optimization, App Campaign, UAC bidding, tCPA tROAS, app install ads, Google app ads setup, UAC learning phase, UAC assets"
tags: ["UAC", "UA"]
draft: false
faq:
  - q: "What can I actually adjust in UAC?"
    a: "Campaign structure, bid-stage progression, and asset group diversity. Targeting and placements are decided by the system, so those three levers deserve your time instead."
  - q: "In what order should I move bid stages?"
    a: "Install, action, and value bidding are not a mandatory progression. Choose using the business goal, valid conversion volume and value data, and the strategy's current requirements. Allow for learning and conversion delay after a change."
  - q: "How often can I change budgets or target costs?"
    a: "Record changes and conversion delay, and allow observation time between major changes. Change frequency alone does not establish permanent learning or a complete reset. Check current strategy guidance and console status together."
  - q: "Should I rebuild a poorly performing campaign from scratch?"
    a: "Diagnose tracking, goals, budget, and assets first. A new campaign needs a learning period, but that does not prove all system learning is reset to zero. Define the structural reason and comparison criteria before rebuilding."
updated: "2026-09-09"
reviewedAt: "2026-09-09"
reviewer: "Codex (AI-assisted editorial audit)"
sources:
  - title: "Google App campaigns Maximize conversions"
    url: "https://support.google.com/google-ads/answer/16550675?hl=en"
---
Google UAC (App Campaigns) lets the algorithm decide most of the placements, targeting, and bidding. "So what does the marketer even do?" is the natural question. There are clear levers — and knowing which ones they are, and leaving the rest alone, is the heart of running UAC.

Placement selection is automated, but available exclusions and brand-suitability settings depend on campaign type and the current console. Automation does not mean that every placement control is unavailable.

## Three controllable levers

### 1. Bid goal

- **tCPI** — target install cost. For quickly building volume early.
- **tCPA (in-app)** — target cost for a specific action (signup, purchase). Aims for quality users.
- **tROAS** — target return on ad spend. The revenue-optimization stage.

The goal you set changes who the algorithm brings. Run tCPI only and it installs cheap and plenty — with plenty of non-buyers mixed in. When you can, drop down to an [action or revenue goal (tCPA, tROAS)](/blog/performance-marketing-metrics).

Install → action → value is not a mandatory progression. Choose for the goal and the quantity and quality of conversion signals. App campaigns now also offer Maximize conversions for installs or in-app actions and Maximize conversion value. Distinguish how they spend the budget from the CPI, CPA, or ROAS they may achieve; those outcomes are not guaranteed.

### 2. Assets (creative)

The algorithm picks placements, but you supply the raw material. The more diverse and higher-quality your text, image, and video assets, the wider the algorithm's combinations. Assets are effectively your UAC creative strategy.

The common mistake is fixating on count. Filling the slots with the same video cropped landscape, square, and portrait fills the slots but doesn't add combination diversity. Filling with different angles (problem-statement, result, testimonial) actually widens the space.

When you retire low performers, don't swap them all at once — replace the bottom few, or learning wobbles. Be careful about pulling assets purely on a low performance rating, too: an asset that has barely been served is not the same as one that was served and rejected. Read the rating alongside impression volume. Check what's landing with [creative fatigue analysis](/content/freshness).

### 3. Conversion events and signals

The algorithm learns from the conversion events you define. If your event design and tracking are a mess, the algorithm optimizes in the wrong direction — give it a bad signal and it works hard to bring the wrong users. [Event taxonomy](/guide/event-taxonomy) and postback integration are the hidden foundation of UAC performance.

Choose event scope by strategy. Google's Maximize conversions guidance specifies one install event, recommends one or two similarly valued in-app actions, and supports multiple value events for Maximize conversion value. With sparse events, check missing tracking and reporting delay first, and verify that any earlier-funnel substitute represents business value.

<!-- CONTENT_ACTION -->

## What not to touch

Changing several settings whenever performance moves makes diagnosis harder. Account for [ad learning](/blog/ad-machine-learning) and conversion delay, record a hypothesis and change date, and allow enough observation time.

New campaigns need learning and comparison time. Rebuilding is not a diagnosis: first document the structural problem that existing settings cannot resolve and the metric for checking the change.

Detailed setup is in the [Google UAC guide](/guide/google-uac).

## Try this today

Pick one campaign, open the last 30 days, and check two things.

First, record the date, size, and target of changes in the last 30 days. Compare console learning status and mature conversion trends, not just the number of edits. More than two changes a week alone does not establish a learning failure.

Second, count the daily volume of your optimization event. If signals are sparse, check tracking and delay first. An earlier-funnel event is an option only when it represents business value, not a mandatory progression.

## Let's be honest

UAC is a black box — you can't fully know "why it went to this user." Focus on the controllable levers (goal, assets, events), and confirm real incrementality not with console metrics but with a [holdout](/tools/incrementality). The conversions the platform reports have users who'd have come without the ad mixed in.

UAC conversions use Google's attribution rules. A discrepancy with an MMP can reflect different definitions or tracking errors. Start with the definition, window, and deduplication checks in [attribution data mismatch](/blog/attribution-data-mismatch).
