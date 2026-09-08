---
title: "SKAN 4 Migration: Which Window to Turn On First"
description: "The order to settle measurement windows, value resolution, and campaign structure when moving to SKAN 4."
date: "2026-08-18"
updated: "2026-09-09"
slug: "skan4-migration-guide"
keywords: "SKAN 4, SKAdNetwork 4.0, skan 4 strategy, skan 4 adoption, skan 4 best practices, skan optimization, measurement windows, hierarchical source ID, SKAN 5"
tags: ["Measurement", "iOS"]
draft: false
faq:
  - q: "What should I settle first when moving to SKAN 4?"
    a: "Lock the conversion-value schema for the first window (days 0–2). Windows 2 and 3 return low, medium or high, but may be essential from launch for late behavior. Also, changing the first window's mapping later makes data before and after mean different things and breaks comparison."
  - q: "Does splitting campaigns finer improve SKAN data?"
    a: "It does the opposite. Each slice carries less install volume, drops below the privacy threshold, and stops returning the fine value and the granular source identifier. On iOS, deliberately consolidating to build volume is often the better trade."
  - q: "What is each of the three SKAN 4 windows for?"
    a: "Days 0–2 can return the fine value (0–63), so it carries activation quality; days 3–7 covers early return behavior; days 8–35 covers long-run value. The last two have only three levels of resolution, so treat them as directional."
  - q: "Should I be preparing for SKAN 5 now?"
    a: "Check supported versions and schedules by platform, MMP and OS. Apple supports SKAN–AdAttributionKit interoperability; validate schemas against the actual APIs and return conditions."
reviewedAt: "2026-09-09"
reviewer: "Codex (AI-assisted editorial audit)"
---
The most common mistake in a SKAN 4 migration is ordering: designing all three windows at once and porting the Android campaign structure straight across. Data arrives, and half of it is empty.

[SKAN](/glossary/skan) generally and its relationship with ATT are covered in the [iOS ATT and SKAN measurement guide](/blog/ios-att-skan-guide). This article is only about **the order**.

## The three windows are not interchangeable

SKAN 4 supports up to three conditional postbacks for periods after install. They do not carry the same information.

| Window | Values available | Use it for |
|---|---|---|
| Days 0–2 | Fine (0–63) or coarse | Activation quality — signup, tutorial, first purchase |
| Days 3–7 | Coarse only (low/medium/high) | Early return and habit formation |
| Days 8–35 | Coarse only (low/medium/high) | Long-run value — arrives last |

One conclusion follows immediately: precise design only means anything in the first window. Detailed LTV bands in windows 2 and 3 collapse into three buckets.

## Step 1 — Lock the first window's schema

Start [conversion value](/glossary/conversion-value) design at window one, because of reversal cost.

Three levels do not make windows 2 and 3 low-value. Include them from launch when purchases or subscriptions arrive late. Change the first window's mapping later and data before and after mean different things — trend comparison breaks entirely.

So ship the first window as a small, decision-grade schema. Do not try to fill all 64 slots. A schema you can read beats a schema that covers everything.

One more thing: the first window is days 0–2. An average purchase on day 5 does not mean no purchases occur earlier; check the fraction within the first two days. Look at your actual conversion-delay distribution before fixing the schema.

<!-- CONTENT_ACTION -->

## Step 2 — Rebuild campaign structure for iOS

Skip this and everything above stops mattering.

The reason is [crowd anonymity](/glossary/crowd-anonymity), the privacy threshold. Low install volume means Apple returns less: at a low tier, neither the fine value nor the granular source identifier arrives.

Which produces the paradox specific to SKAN. On other channels, finer campaign structure means better analysis. Under SKAN, splitting shrinks each slice's volume and coarsens the data.

Port your Android structure across and you can flatten iOS data wholesale. Consolidate deliberately instead. What you give up is campaign-level control; what you get back is measurement at all.

## Step 3 — Add windows 2 and 3 once you need them

Design all three up front when late behavior matters. If the immediate task concerns early activation, a staged first-window implementation may be appropriate. Choose using data value and implementation effort.

Following the order keeps failures separable. Turn everything on at once and when values do not arrive, you cannot tell a schema problem from a threshold problem.

## Try this today

**One.** Pull up your conversion-value mapping and count actual install volume per value. If many slots are empty, check behavior distribution, missingness and return conditions before considering consolidation.

**Two.** Count your iOS campaigns and check daily installs for each. Install counts alone do not identify an unpublished threshold. Weigh observed return detail against lost operating control before consolidating.

## Let's be honest

Apple does not publish threshold figures and the rules change between versions. Rather than designing around an assumed number, change the structure and observe what actually returns. Confirm against [Apple's SKAdNetwork documentation](https://developer.apple.com/documentation/storekit/skadnetwork) before committing.

Check supported versions and schedules with platforms and MMPs. Apple supports [SKAN–AdAttributionKit interoperability](https://developer.apple.com/documentation/adattributionkit/adattributionkit-skadnetwork-interoperability); validate actual APIs and return conditions rather than assuming unchanged schema compatibility.
