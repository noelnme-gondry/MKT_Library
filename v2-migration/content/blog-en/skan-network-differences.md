---
title: "SKAN by Network: Standard vs Platform Settings"
description: "Separate Apple’s SKAN contract from network and MMP choices about schema ownership and conversion-value updates."
date: "2026-08-26"
slug: "skan-network-differences"
keywords: "SKAN network differences, Google Ads SKAN, TikTok SKAN, conversion value"
tags: ["Measurement & analysis", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["skan", "conversion-value", "postback"]
conditions: "Network product settings and support change frequently. Use the current official documentation and account configuration for actual execution."
sources:
  - title: "SKAdNetwork — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork?lang=en"
  - title: "Set up your SKAdNetwork conversion value schema — Google Analytics Help"
    url: "https://support.google.com/analytics/answer/13165271?hl=en"
  - title: "Integrate App Events SDK — TikTok for Business"
    url: "https://ads.tiktok.com/help/article/how-to-integrate-tiktok-app-events-sdk"
faq:
  - q: "Can Google, TikTok, and an MMP all upload a schema?"
    a: "Confirm each product’s integration, but do not allow several SDKs to update the same app’s SKAN conversion value. Choose one owner and disable or configure competing update paths to match that design."
  - q: "Is a dashboard mismatch with raw postbacks necessarily an error?"
    a: "Not necessarily. Receipt timing, deduplication, attribution, modeling, and aggregation can differ. Align definitions and raw-postback handling before deciding that one number is wrong."
---

## Apple defines the standard; tools define the operating path

Apple defines SKAN windows, postback parameters, and privacy tier. Networks and MMPs decide where a schema is configured, which SDK updates conversion value, and what their dashboard reports.

Google Analytics exposes window-level SKAN 4 schema and fine/coarse mapping. TikTok advises avoiding duplicate conversion-value updates when an MMP or another SDK owns the schema. That is not a different Apple standard; it is a different operating implementation on top of the same standard.

## Name one conversion-value owner

Document the schema owner and change approver, each SDK’s SKAN-update setting, each network’s postback receiver and validator, and the reconciliation cadence between dashboard and raw postback. Multiple event collectors can exist, but one app should have one final conversion-value updater.

## Compare definitions before numbers

Do not merge platform modeled reporting with Apple postback rows as if they are identical observations. Align version, window, did-win, deduplication, receipt delay, and value availability first. If a gap remains, ask which question each measure answers rather than choosing a winner by default.
