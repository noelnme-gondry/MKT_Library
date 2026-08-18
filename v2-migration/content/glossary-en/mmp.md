---
term: "MMP (Mobile Measurement Partner)"
seoTitle: "What Is an MMP? Attribution Measurement Explained"
shortDef: "A third-party service that aggregates conversion data from multiple ad networks into one attribution view"
description: "An MMP consolidates click, install and in-app event data across networks to attribute and report performance. Why teams need one."
date: "2026-07-18"
slug: "mmp"
keywords: "MMP, Mobile Measurement Partner, mobile attribution tool, app marketing measurement"
category: "Tracking & Tech"
relatedPosts: ["attribution-data-mismatch"]
draft: false
faq:
  - q: "Why do you need a separate MMP?"
    a: "Because each platform reports its own performance by its own rules. One user who sees a Meta ad, clicks a Google ad and then installs can be claimed by both. An MMP applies a single attribution rule (usually last click) across everything as a neutral third party, resolving the double counting."
  - q: "Platform and MMP numbers disagree — which is right?"
    a: "Both are right within their own rules. The same week routinely reads 120 conversions in the ad platform, 70 in GA4, 85 in the MMP and 100 in the payment database. Attribution windows, view-through inclusion and conversion definitions all differ, so put those rules in one table before deciding which number to steer on."
  - q: "Do you still need an MMP on iOS?"
    a: "Yes, but the job changes. Without ATT consent user-level matching is impossible, so the MMP works on organising SKAdNetwork's aggregated postbacks instead. It becomes a tool for reconciling campaign-level conversion values against your own server data rather than following individual users."
---

## In one line

Clicks, installs, and in-app events arrive separately from Google, Meta, and TikTok. An MMP (Mobile Measurement Partner) is the third-party tool that gathers them in one place and settles "which network brought this user."

## Why you need one

Every network reports its own performance on its own terms. When you run several networks at once, they can all claim credit for the same install. An MMP acts as a neutral third party applying consistent attribution rules (usually last-click) across all of them.

## Why the numbers all disagree

The same campaign in the same week routinely reads 120 conversions in the ad platform, 70 in GA4, 85 in the MMP and 100 in the payment database. None of the four is broken.

The platform counts everyone who saw its ad on a generous window (view-through included, defaults like 7-day click and 1-day view). GA4 counts on its own session model. The MMP resolves everything down to one last-click rule. The payment database counts only money that actually arrived. Four different denominators and four different rules. Asking which number is correct is less useful than writing down what rule produced each one.

## In practice

Numbers from the ad network, the MMP, and your own payment DB rarely match exactly — each uses a different attribution window and de-duplication logic. Don't treat any single number as absolute truth; understand why they diverge.

## Go deeper

Why network, MMP, and internal DB numbers disagree is covered in [Attribution Data Mismatch](/blog/attribution-data-mismatch).
