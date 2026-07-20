---
title: "Meta Advantage+ App Campaigns: What You Can Control"
description: "The parts a marketer can actually adjust in an automated Meta Advantage+ App (AAP) campaign — OS split, event priority, and bidding stages."
date: "2026-07-18"
slug: "meta-advantage-plus-guide"
keywords: "Meta Advantage+, AAP, Meta app campaign, AEM event priority, Meta attribution window, VBO bidding, Meta app ad setup"
tags: ["UA", "Measurement"]
draft: false
---

Meta Advantage+ App (AAP), like [Google UAC](/blog/google-uac-optimization), is a heavily automated campaign type. You can barely tune at the ad-set level; you set a goal at the campaign level and the algorithm handles the rest. Still, there are levers that decide the outcome.

## OS split isn't optional

iOS and Android have fundamentally different data environments, so you have to run them as separate campaigns. iOS especially needs its own SKAN-dedicated campaign as standard, because signal quality splits entirely on ATT consent. Mix the two in one campaign and different-quality signals blur the optimization.

## Event priority (AEM) sets the optimization direction

Since iOS 14.5, only up to eight events per app can serve as optimization signals (Aggregated Event Measurement). Which you place at which rank among those eight decides what the algorithm optimizes.

The principle is simple: put revenue-tied events (purchase, subscription) at the top ranks, and turn Value Optimization on only for those. Changing the ranks often shakes learning each time, so settle them carefully up front.

## Attribution window — mind it when comparing platforms

Meta's default attribution is **7-day click + 1-day view**. But don't line that up directly against other platforms' numbers like Google or TikTok — every platform's window differs.

So for cross-platform comparison reporting, there's a convention to **narrow to a 1-day-click basis**. It usually reads lower than the 7-day-click basis, so don't be alarmed by the smaller number. Using the same ruler makes cross-channel comparison fair.

## Raise bids in stages

Start on automatic (Highest Volume) to burn through learning fast, then as data accumulates tighten control in the order Cost Cap → Bid Cap. Turn on value-based bidding (Value-Based Optimization) only after purchase data has accumulated fairly stably.

## Problems that snag often

- **iOS install reporting suddenly drops sharply**: likely SKAN postback delay, or you recently changed AEM event priority. A priority change restarts learning and can leave reporting thin for days.
- **Value-based bidding but revenue is erratic**: check whether the purchase event's revenue value is actually being sent and whether the Value Optimization toggle is on. On iOS, only revenue caught within the SKAN postback window counts as signal.

## Let's be honest

Advantage+ isn't always the answer. With a small budget or very narrow targeting, a standard campaign can win. The larger the budget and the broader the targeting, the faster automation fills its learning volume and the more it favors you. Detailed setup is in the [Meta Advantage+ App optimization guide](/guide/meta-advantage-plus).
