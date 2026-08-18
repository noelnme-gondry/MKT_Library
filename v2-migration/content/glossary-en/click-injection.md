---
term: "Click Injection"
seoTitle: "Click Injection: Spotting Attribution Fraud Signals"
shortDef: "Fraud that fires a fake click right before install to steal attribution credit"
description: "Click injection fires fake clicks at install time to steal attribution credit. How it inflates performance and which signals to watch."
date: "2026-07-18"
slug: "click-injection"
keywords: "click injection, click injection meaning, ad fraud, attribution fraud, last click fraud"
category: "Tracking & Tech"
relatedPosts: ["marketing-mix-modeling", "attribution-data-mismatch"]
draft: false
faq:
  - q: "How does click injection work?"
    a: "On Android, it detects the moment an app download finishes and installation begins, then fires a fake click just before the install completes. Because last-click attribution credits whichever click came last before the install, an ad that brought no one gets the credit."
  - q: "How do you detect click injection?"
    a: "Look at the distribution of click-to-install times. Genuine traffic spreads across minutes because the user has to reach the store, download and install; injection manufactures the click right before completion, so the times bunch abnormally within seconds. That channel showing unusually weak retention or repeat purchase is a corroborating signal."
  - q: "What do the metrics look like when click injection is present?"
    a: "CPA looks good while revenue and retention fail to follow. The hijacked installs were going to happen anyway, so they add cost without adding increment. This is one reason MMM, which never tracks individual clicks, and holdout-based incrementality are unaffected by this kind of distortion."
---

## In one line

There is a brief moment on Android between an app finishing download and starting installation. Click injection fires a fake click into exactly that window, so an ad that never actually drove the user steals last-click credit.

## Why it matters

Last-touch attribution (LTA) gives conversion credit to the last click before install. Click injection exploits that: no real marketing effort is behind it, but it looks like a legitimate ad drove the install — burning spend on installs that show good CPA but poor downstream retention or revenue.

## Signals to watch for

- Suspiciously short time between click and install (seconds)
- Unrealistically high CTR from a specific network
- That network's post-install retention/repeat-purchase rate is unusually low

## Go deeper

See other reasons attribution data doesn't match reality in [Attribution Data Mismatch](/blog/attribution-data-mismatch).
