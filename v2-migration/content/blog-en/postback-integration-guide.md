---
title: "Postback Integration: Why It Differs So Much by Platform"
description: "How MMPs relay conversion data to platforms (SAN vs S2S), and the common causes behind installs or cost reporting as zero."
date: "2026-07-18"
slug: "postback-integration-guide"
keywords: "postback integration, postback, SAN networks, media attribution integration, MMP partner setup, install reporting zero, cost data integration"
tags: ["Measurement", "Metrics Basics"]
draft: false
---

If campaigns are running but the platform dashboard keeps showing zero installs, it's almost always a postback integration problem. This pipeline — where the [MMP](/glossary/mmp) tells the platform back its attribution results — breaks anywhere, and the platform's auto-bidding gets no signal to learn from.

## What postbacks do

A postback is the channel through which the MMP sends "who came from where and did what" back to the platform.

- **Install postback**: when a new install happens, the MMP tells the platform. It's the core learning signal for the platform's ML optimization.
- **In-app event postback**: when an in-app event (signup, purchase) fires, it's relayed the same way. Required if you want goal-based bidding (cost-per-action, cost-per-revenue).

Cut this signal and the platform is bidding blind. So postbacks are for measurement and, at once, for optimization.

## Integration methods split by platform

- **SAN (Self-Attributing Network)**: Meta, Google, TikTok — the platform reports its own click and impression data to the MMP. Most large platforms are here.
- **S2S (Server-to-Server)**: when a platform isn't a SAN, the MMP integrates directly server to server. Apple Search Ads via API, or smaller platforms via click URLs carrying values.

Don't confuse them. **Issue a separate click URL to a SAN platform and you double-track**, misclassifying legitimate paid traffic as organic. From the platform's side it becomes "not a single install came from our ads."

## Three problems that blow up often

- **Installs show as zero**: install postback is off in the MMP partner settings, or you accidentally issued a click URL to a SAN platform (the double-tracking above).
- **Cost data doesn't come in**: separate from impression/click/install integration, spend data often needs its own per-platform API key registered. The first sync can take a day or two.
- **Probabilistic match rate is abnormally high**: on iOS, when users decline tracking, attribution falls to [probabilistic matching](/glossary/probabilistic-attribution) without a hard identifier. If that share is excessive, consider moving that platform to a SKAN-only channel.

## Let's be honest

Postbacks aren't set-and-forget. They can break quietly when a platform's policy or API changes, so build the habit of checking — in sandbox, on every new campaign — that installs and events actually land in the platform dashboard. Per-platform tables and URL macro specs are in the [postback integration manual](/guide/postback-integration).
