---
title: "Event Taxonomy: Why So Much Fuss Over a Single Name"
description: "Why in-app event naming rules matter, and how skipping them breaks platform optimization and revenue reporting — with real troubleshooting."
date: "2026-07-18"
slug: "event-taxonomy-guide"
keywords: "event taxonomy, event naming convention, in-app event design, snake_case events, purchase event, platform optimization event, event tracking design"
tags: ["Measurement", "Metrics Basics"]
draft: false
---

Name events ad hoc every time you ship a feature, and six months later `addToCart`, `add_cart`, and `cart_add` all coexist in one service. People muddle through, but the platform optimization algorithm and your dashboards can't. Event taxonomy is the **standing contract for names, parameters, and firing points** that prevents this.

## Why a single name matters so much

An event name isn't just a label. It's the learning signal that automated-bidding campaigns like Google UAC and Meta AAP use to judge "did this perform well or badly."

That's why renaming casually causes damage. Change what you send today as `purchase` to `order_complete` next week, and to the platform a brand-new event with zero data has appeared. **Campaign learning resets entirely**, and performance wobbles until data rebuilds. A name isn't something to refactor lightly.

## The minimum to enforce

- **snake_case throughout**: `addToCart` (X) → `add_to_cart` (O). Ban mixed casing and separators from the start.
- **Avoid platform reserved words**: reusing names the MMP or SDK already fires automatically (`session_start`, `first_open`) as your own events causes collisions.
- **No PII, ever**: never put email, phone, or name directly in a parameter value. Only hashed values if you must.
- **Always send a currency code**: send `currency` (ISO 4217, e.g. USD) alongside `revenue`. Normalize on the server; the client sends the original currency.

## Problems that really blow up in practice

- **Revenue keeps showing 0 in the platform dashboard**: usually a missing `currency`, or the event isn't checked as a "Revenue Event" in the platform partner settings.
- **The same purchase gets counted multiple times, inflating ROAS**: a payment callback fires again on a network retry. Enforce `transaction_id` as a unique dedup key, and fire the client event only after server verification.
- **Auto-bidding can't escape learning**: if the weekly volume of the optimization event (say `purchase`) is too low, the algorithm can't converge. Temporarily lower the optimization goal to an upper-funnel event (`add_to_cart`) to fill the learning volume first.

Most of these come from **measurement design**, not creative or bids. Before you tear apart the creative when performance looks off, check that events are coming in right — it saves time.

## Let's be honest

Taxonomy, once set, is hard to change often. Renaming events severs you from historical data and restarts platform learning. So settling it once up front across the whole funnel — as in the [in-app event taxonomy spec](/guide/event-taxonomy) — is far cheaper than fixing it piece by piece later.
