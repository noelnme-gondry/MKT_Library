---
title: "Retargeting and Re-engagement: Why to Split From UA"
description: "Why retargeting belongs in its own campaign, how to segment the audience, and why deferred deep links are not optional."
date: "2026-07-18"
updated: "2026-08-17"
slug: "retargeting-reengagement-guide"
keywords: "retargeting, re-engagement, app retargeting, dormant user reactivation, retargeting audience, deferred deep link, lookalike seed, user segments, retargeting incrementality"
tags: ["UA", "Growth & career"]
draft: false
faq:
  - q: "Can retargeting be read alongside acquisition?"
    a: "These users already know the app, so CPA reads low. Merged reporting makes overall acquisition look better than it is and distorts budget allocation."
  - q: "How do I know retargeting added anything?"
    a: "Hold out an unexposed group and compare. Conversion rate inside the exposed group cannot separate users who would have returned anyway from users the ad brought back."
  - q: "How finely should I split retargeting audiences?"
    a: "Only as far as you can genuinely write a different message. Splitting segments that will share the same creative just shrinks the volume behind each one and slows learning. Start with axes where the message clearly changes, such as cart abandonment."
  - q: "After how many days is a user dormant?"
    a: "There is no fixed threshold — it comes from your service's natural usage cycle. Fourteen days without a session means something entirely different for a weekly app than for a daily one. Set the line where your retention curve bends."
---

The campaign that brings new users (UA) and the one that recalls existing users (retargeting) have completely different purposes. Mix them in one campaign and they eat each other's budget, and you can't see which side earned the result. So split them from the start.

## Why mixing them breaks the numbers

Retargeting audiences already installed your app or viewed your products. Naturally they convert better and show a lower CPA. The catch is that this comes from *selecting people who were already likely to buy*, not from the campaign performing well.

Read the two together in one report and this happens (numbers are illustrative).

- Acquisition: 100 conversions, CPA $30
- Retargeting: 100 conversions, CPA $6
- Blended: 200 conversions, CPA $18

That $18 is not the reality of either campaign. Decide "we're under target, let's scale" on that number and you are really pouring budget into $30 acquisition. Worse, growing the retargeting budget lowers the blended average, so the dashboard improves while new-user counts do not. Growth stalls while the metric looks healthier — a very common pattern.

Separate goals, separate reports, separate budgets.

## Segment the audience first

Retargeting is all about "which message to whom." Each segment is in a different state, so the message must differ too.

- **Cart abandoners** — added but didn't buy. Showing the exact item they added works best.
- **First purchase, no repeat** — a repeat-purchase message fits.
- **Dormant VIPs** — lots of purchase history but haven't returned lately. The most valuable segment; raise the personalization.
- **Simply inactive** — sessions have thinned. Lead with a return hook (new arrivals, event alerts).

Expected efficiency differs a lot by segment. Cart abandoners, who were right at the edge of buying, usually respond far better. But exact multiples vary by service — verify on your own data.

One rule for splitting: go only as far as you can **actually write a different message**. Splitting segments that will share the same creative shrinks the volume behind each one, slows learning, and starves the platform's optimization of data.

## Without deferred deep links, it's half-built

Tap a retargeting ad and the app just opens the home screen, and the user has to hunt down the item they were viewing all over again. Drop-off spikes here.

Setting up a [deferred deep link](/glossary/deep-link) so a click leads straight to that screen is half of retargeting performance. Skip it and even a great audience leaks at the final step.

A detail people miss: a plain deep link only works when the app is already installed. When it is not, the user goes to the store, and it is the *deferred* deep link that carries them to the right screen on first launch. Ship without testing both paths and you can run for weeks in a state where installed users land correctly and new users drop onto the home screen.

<!-- CONTENT_ACTION -->

## Don't seed a lookalike from just any user

When you build a "find similar users" (Lookalike) audience for acquisition, the seed you feed decides the result.

- **Good seed** — users who purchased multiple times or are top-tier [LTV](/blog/ltv-cac-ratio).
- **Risky seed** — users who only installed or only signed up. You end up resembling "people likely to click an ad," which can differ from people who actually spend. This is a common cause of cheap-looking CPI with below-average LTV.

Seed size matters too. Too small and the platform cannot find a pattern; too large and what makes your users distinctive gets diluted. If narrowing the seed to top-LTV users underperforms, the problem may be seed volume rather than seed quality.

## Problems that snag often

- **Retargeting and acquisition serve the same person and cannibalize each other** — always exclude existing installers from the acquisition campaign.
- **Deferred deep links don't fire on first launch** — Android's install-referrer dependency and iOS's domain verification are common causes.
- **Customer-list match rate is low** — often the email and phone weren't normalized (lowercased, whitespace stripped, country codes unified) before hashing.
- **No frequency cap** — retargeting pools are small, so the same person gets hit repeatedly. Without a cap, conversion rate holds flat while CPM climbs, and brand perception suffers.

## Try this today

Pick one retargeting campaign and **hold out 5–10% of its audience.** That group sees no retargeting ads at all.

Two to four weeks later (longer than your purchase cycle), compare return and purchase rates between the two groups. Near-identical results mean the campaign was paying for people who were coming back anyway. A clear gap is your real incremental lift.

The retargeting CPA in your report can never tell you this. Conversion rate inside the exposed group cannot separate "would have returned" from "the ad brought them back."

## Let's be honest

Retargeting re-catches people who already know you, so there's always a [cannibalization](/blog/cannibalization-organic-paid) risk of spending on users who'd have returned anyway. The campaign with the best CPA in your report can be the one with the smallest real lift — that is the illusion retargeting produces most often.

How to actually measure that lift is in [incrementality measurement](/blog/incrementality-measurement), and segment-by-segment steps are in the [retargeting & re-engagement guide](/guide/retargeting-reengagement).
