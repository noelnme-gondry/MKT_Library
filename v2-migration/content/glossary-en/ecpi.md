---
term: "eCPI (Estimated CPI)"
seoTitle: "eCPI Meaning | Why It Differs From Your Actual CPI"
shortDef: "A modeled CPI estimate used when individual installs can't be observed, e.g. under SKAdNetwork"
description: "When SKAdNetwork withholds values below its privacy threshold, networks model the gap. Why eCPI drifts from real CPI and how to cross-check it."
date: "2026-07-18"
slug: "ecpi"
keywords: "eCPI, eCPI meaning, Estimated CPI, SKAN CPI, iOS cost per install"
category: "Basic Metrics"
draft: false
faq:
  - q: "What is the difference between eCPI and CPI?"
    a: "CPI divides spend by installs you counted; eCPI is a platform's modelled estimate for when individual installs cannot be observed. Without ATT consent on iOS, user-level identifiers are unavailable and measurement falls back to SKAdNetwork's aggregated data — the setting where eCPI appears."
  - q: "How reliable is eCPI?"
    a: "It is an estimate, so the error varies by platform and by period. SKAdNetwork withholds conversion values entirely below its privacy threshold, which makes the error largest exactly where volume is lowest. Cross-check against your own server-side conversions or payment database and treat eCPI as directional."
  - q: "Can I move budget on eCPI alone?"
    a: "Not advisable, because each platform models it differently — comparing two eCPIs compares two different models. Confirm the direction against your own data first, then move budget in increments rather than all at once and watch whether real conversions follow."
---

## In one line

In environments like SKAdNetwork you cannot see who installed at the user level, so CPI cannot be counted directly. eCPI (Estimated CPI) is the figure a network models back from spend and aggregated conversion data instead.

## How it differs from regular CPI

Regular [CPI](/glossary/cpi) is a straightforward calculation: cost ÷ actual installs counted. eCPI is an estimate built from a network's own modeling (SKAN aggregate conversion values, probabilistic matching, etc.) — and that modeling error varies by network and by period.

## Why it has to be an estimate

Without ATT consent on iOS the advertising identifier is unavailable, so no one can link a specific click to a specific install. SKAdNetwork sends postbacks aggregated at campaign level instead — group information, not people.

On top of that, SKAdNetwork withholds detailed conversion values when a campaign falls below its crowd anonymity threshold. The lower the volume, the more blanks a platform has to fill in, and the wider eCPI's error grows. When platform-reported installs and your own numbers disagree for the same campaign and period, this is usually why.

## Why to be careful

eCPI is an estimate, not a count — it can diverge from your own tracked install numbers. Don't judge a channel as "cheap" on eCPI alone; cross-check against your own server-side conversion data where possible.

## In practice

Optimizing iOS campaigns purely on eCPI can push budget in the wrong direction. Look at SKAN aggregate data alongside your own first-party conversion signals to confirm direction.
