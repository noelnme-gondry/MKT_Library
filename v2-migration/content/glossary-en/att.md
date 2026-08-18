---
term: "ATT (App Tracking Transparency)"
seoTitle: "What Is ATT? Why Opt-In Rate Hides iOS Performance"
shortDef: "The iOS system prompt asking consent to track across apps — declining removes IDFA access"
description: "ATT is the iOS tracking consent prompt. Declining blocks measurement, not delivery — and that distinction changes how you read iOS numbers."
date: "2026-08-18"
slug: "att"
keywords: "ATT, what is ATT, App Tracking Transparency, ATT opt-in rate, IDFA, iOS tracking consent, att prompt"
relatedPosts: ["ios-att-skan-guide"]
category: "Tracking & tech"
draft: false
faq:
  - q: "If a user declines ATT, do they stop seeing my ads?"
    a: "No. Declining blocks measurement, not delivery. Ads still serve and installs still happen; you simply cannot confirm at the user level which campaign earned them."
  - q: "Does a low opt-in rate mean iOS performance is bad?"
    a: "Losing measurement is not the same as losing performance. Traffic without consent has no deterministic attribution, so iOS reads lower than it truly is. The gap between console installs and your MMP total is the size of what you cannot see."
---

## In one line

ATT (App Tracking Transparency) is the iOS system prompt asking whether an app may track the user across other companies' apps and websites. Decline it and the advertising identifier (IDFA) is unavailable.

## Why the numbers move

Without IDFA, user-level attribution breaks. Those installs are visible only through aggregate frames like [SKAN](/glossary/skan), and the counts in your ads manager, MMP, and payment database start to diverge.

The common mistake follows: iOS looks cut in half, so the campaign gets paused — when what actually shrank was measurement, not performance.

## Opt-in rate is manageable

When and in what context the prompt appears changes consent substantially; priming — showing value first, then asking — is the standard approach. Raise consent and the measurable share of your sample grows, and iOS performance starts to reappear.

## Go deeper

What to judge iOS performance by after ATT is covered in the [iOS ATT and SKAN measurement guide](/blog/ios-att-skan-guide).
