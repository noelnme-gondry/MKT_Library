---
term: "Conversion Value"
seoTitle: "SKAN Conversion Value: What to Pack Into 6 Bits"
shortDef: "The narrow value SKAN returns — early post-install behavior has to be compressed into it"
description: "The conversion value is SKAN's 0–63 fine value or its low/medium/high coarse value. How to decide what goes in, and the usual mistakes."
date: "2026-08-18"
slug: "conversion-value"
keywords: "conversion value, SKAN conversion value, conversions skan, fine conversion value, coarse conversion value, conversion value schema"
relatedPosts: ["ios-att-skan-guide"]
category: "Tracking & tech"
draft: false
faq:
  - q: "What is the difference between fine and coarse conversion values?"
    a: "Fine is a 6-bit value from 0 to 63, returned only in the first measurement window and only when volume conditions are met. Coarse is three levels — low, medium, high — and is what the second and third windows return."
  - q: "Can I put revenue into the conversion value?"
    a: "Revenue is continuous, so it has to be bucketed, and tight buckets exhaust the 64 slots quickly. Splitting only the few bands that change a decision works better."
---

## In one line

SKAN returns exactly one value per install, and that value is the conversion value. Deciding which few days of behavior gets compressed into that narrow slot is the core design task of iOS measurement.

## Why the design is hard

The fine value is 0–63 — 64 slots. Trying to encode signup, tutorial, first purchase, and revenue bands at once runs out of room fast, and the finer you slice, the fewer installs land in each slot and the noisier it gets.

The platform also learns from this value. Design it badly and the algorithm optimises on a bad signal, and iOS performance drifts off entirely.

## Three common mistakes

First, encoding behavior outside the window. The first window is days 0–2; if your average purchase lands on day 5, that signal never reaches it. Look at your actual conversion-delay distribution before choosing.

Second, remapping often. The moment you change it, data before and after mean different things and comparison breaks.

Third, leaving empty slots. Pull up the mapping and count volume per value — if more than half receive almost nothing, merge them.

## Go deeper

The full [SKAN](/glossary/skan) structure and per-window resolution are covered in the [iOS ATT and SKAN measurement guide](/blog/ios-att-skan-guide).
