---
title: "Google UAC Optimization: Bids, Assets, and Events"
description: "The levers a marketer actually controls inside an automated Google App Campaign — bidding, assets, and conversion events."
date: "2026-07-15"
updated: "2026-08-17"
slug: "google-uac-optimization"
keywords: "Google UAC, Google App Campaigns, UAC optimization, App Campaign, UAC bidding, tCPA tROAS, app install ads, Google app ads setup, UAC learning phase, UAC assets"
tags: ["UAC", "UA"]
draft: false
faq:
  - q: "What can I actually adjust in UAC?"
    a: "Campaign structure, bid-stage progression, and asset group diversity. Targeting and placements are decided by the system, so those three levers deserve your time instead."
  - q: "In what order should I move bid stages?"
    a: "Fill learning on install optimization first, then move to in-app actions, then to ROAS. Skipping a stage resets learning and you start accumulating from zero again."
  - q: "How often can I change budgets or target costs?"
    a: "One change at a time, with enough space between changes for learning to settle. Larger changes mean longer relearning, so small adjustments beat sharp ones. Touch it daily and the campaign lives permanently in a learning state."
  - q: "Should I rebuild a poorly performing campaign from scratch?"
    a: "Usually not. A new campaign restarts accumulated learning at zero. Consider rebuilding only after goal and asset adjustments have failed, or when the structure itself is wrong."
---

Google UAC (App Campaigns) lets the algorithm decide most of the placements, targeting, and bidding. "So what does the marketer even do?" is the natural question. There are clear levers — and knowing which ones they are, and leaving the rest alone, is the heart of running UAC.

Put the other way: spending time trying to control what you cannot control is the most common waste in UAC. Pulling placement-level reports and asking to exclude specific inventory mostly goes nowhere in this campaign structure.

## Three controllable levers

### 1. Bid goal

- **tCPI** — target install cost. For quickly building volume early.
- **tCPA (in-app)** — target cost for a specific action (signup, purchase). Aims for quality users.
- **tROAS** — target return on ad spend. The revenue-optimization stage.

The goal you set changes who the algorithm brings. Run tCPI only and it installs cheap and plenty — with plenty of non-buyers mixed in. When you can, drop down to an [action or revenue goal (tCPA, tROAS)](/blog/performance-marketing-metrics).

But do not skip stages. The further down you go, the sparser the signal the algorithm has to learn from. Jump straight to tROAS while you are getting a handful of conversions a day and there is nothing to learn on, so delivery becomes unstable. Build volume on installs → narrow to in-app actions → move to revenue is the safe order.

### 2. Assets (creative)

The algorithm picks placements, but you supply the raw material. The more diverse and higher-quality your text, image, and video assets, the wider the algorithm's combinations. Assets are effectively your UAC creative strategy.

The common mistake is fixating on count. Filling the slots with the same video cropped landscape, square, and portrait fills the slots but doesn't add combination diversity. Filling with different angles (problem-statement, result, testimonial) actually widens the space.

When you retire low performers, don't swap them all at once — replace the bottom few, or learning wobbles. Be careful about pulling assets purely on a low performance rating, too: an asset that has barely been served is not the same as one that was served and rejected. Read the rating alongside impression volume. Check what's landing with [creative fatigue analysis](/content/freshness).

### 3. Conversion events and signals

The algorithm learns from the conversion events you define. If your event design and tracking are a mess, the algorithm optimizes in the wrong direction — give it a bad signal and it works hard to bring the wrong users. [Event taxonomy](/guide/event-taxonomy) and postback integration are the hidden foundation of UAC performance.

Keep the optimization event single. Optimizing toward several events at once splits the signal and slows learning on each. And if the chosen event fires too rarely — a handful a day — learning cannot function at all; in that case move one step earlier in the funnel and optimize there instead.

<!-- CONTENT_ACTION -->

## What not to touch

Touch it too often when performance wobbles a little and you [reset the learning](/blog/ad-machine-learning). Change bids, budgets, and assets daily and the algorithm stays "learning" forever. Change one thing at a time and give it a learning window (usually several days) before judging.

Rebuilding the campaign is the same trap. Creating a fresh campaign when results disappoint feels intuitive, but it resets accumulated learning to zero. Reserve it for when goal and asset adjustments have demonstrably failed, or the structure itself is wrong.

Detailed setup is in the [Google UAC guide](/guide/google-uac).

## Try this today

Pick one campaign, open the last 30 days, and check two things.

First, **count how many changes you made in those 30 days** — budget, target cost, and asset changes combined. More than twice a week and the campaign is likely living in a permanent learning state. The cause of weak performance may be the change frequency rather than the settings.

Second, **count the daily volume of your optimization event.** If it is too low, no amount of goal tuning gives the algorithm something to learn. Moving one step earlier in the funnel to build volume, then stepping back down, is usually faster.

## Let's be honest

UAC is a black box — you can't fully know "why it went to this user." Focus on the controllable levers (goal, assets, events), and confirm real incrementality not with console metrics but with a [holdout](/tools/incrementality). The conversions the platform reports have users who'd have come without the ad mixed in.

Note too that UAC conversions pass through Google's own attribution model. Numbers differing from other channels and your MMP is normal — it is a difference in counting rules, not one side being wrong. Why those gaps appear is covered in [attribution data mismatch](/blog/attribution-data-mismatch).
