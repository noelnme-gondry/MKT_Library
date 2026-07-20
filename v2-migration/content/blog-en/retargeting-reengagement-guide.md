---
title: "Retargeting: Why Running It With New-User Acquisition Fails"
description: "Why retargeting and re-engagement campaigns must be separated from new-user acquisition (UA), how to segment the audience, and why deferred deep links are essential."
date: "2026-07-18"
slug: "retargeting-reengagement-guide"
keywords: "retargeting, re-engagement, re-engagement campaign, reviving dormant users, retargeting audience, deferred deep link, lookalike seed, user segments"
tags: ["UA", "Growth"]
draft: false
---

The campaign that brings new users (UA) and the one that recalls existing users (retargeting) have completely different purposes. Mix them in one campaign and they eat each other's budget, and you can't see which side earned the result. So split them from the start.

## Segment the audience first

Retargeting is all about "which message to whom." Each segment is in a different state, so the message must differ too.

- **Cart abandoners**: added but didn't buy. Showing the exact item they added works best.
- **First purchase, no repeat**: a repeat-purchase message fits.
- **Dormant VIPs**: lots of purchase history but haven't returned lately. The most valuable segment — raise the personalization.
- **Simply inactive**: sessions have thinned. Lead with a return hook (new arrivals, event alerts).

Expected efficiency differs a lot by segment. Cart abandoners, who were right at the edge of buying, usually respond far better. But exact multiples vary by service — verify on your own data.

## Without deferred deep links, it's half-built

Tap a retargeting ad and the app just opens the home screen, and the user has to hunt down the item they were viewing all over again. Drop-off spikes here.

Setting up a [deferred deep link](/glossary/deep-link) so a click leads straight **to that screen** is half of retargeting performance. Skip it and even a great audience leaks at the final step.

## Don't seed a lookalike from just any user

When you build a "find similar users" (Lookalike) audience for acquisition, the seed you feed decides the result.

- **Good seed**: users who purchased multiple times or are top-tier [LTV](/blog/ltv-cac-ratio).
- **Risky seed**: users who only installed or only signed up. You end up resembling "people likely to click an ad," which can differ from people who actually spend. This is a common cause of cheap-looking CPI with below-average LTV.

## Problems that snag often

- **Retargeting and acquisition serve the same person and cannibalize each other**: always exclude existing installers from the acquisition campaign.
- **Deferred deep links don't fire on first launch**: Android's install-referrer dependency and iOS's domain verification are common causes.
- **Customer-list match rate is low**: often the email and phone weren't normalized (lowercased, whitespace stripped, country codes unified) before hashing.

## Let's be honest

Retargeting re-catches people who already know you, so there's always a [cannibalization](/blog/cannibalization-organic-paid) risk of spending on users who'd have returned anyway. So confirm retargeting's real lift with a holdout too. Segment-by-segment steps are in the [retargeting & re-engagement guide](/guide/retargeting-reengagement).
