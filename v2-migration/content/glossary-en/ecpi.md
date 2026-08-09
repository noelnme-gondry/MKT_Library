---
term: "eCPI (Estimated CPI)"
seoTitle: "eCPI Meaning | Why It Differs From Your Actual CPI"
shortDef: "A modeled CPI estimate used when individual installs can't be observed, e.g. under SKAdNetwork"
description: "eCPI is an estimated CPI networks back into when individual tracking is unavailable. Why it diverges from real CPI and how to read it."
date: "2026-07-18"
slug: "ecpi"
keywords: "eCPI, eCPI meaning, Estimated CPI, SKAN CPI, iOS cost per install"
category: "Basic Metrics"
draft: false
---

## In one line

**eCPI (Estimated CPI)** is a modeled cost-per-install figure a network reports when it can't observe individual installs — as under SKAdNetwork — reverse-engineered from spend and aggregated conversion signals.

## How it differs from regular CPI

Regular [CPI](/glossary/cpi) is a straightforward calculation: cost ÷ actual installs counted. eCPI is an estimate built from a network's own modeling (SKAN aggregate conversion values, probabilistic matching, etc.) — and that modeling error varies by network and by period.

## Why to be careful

eCPI is an estimate, not a count — it can diverge from your own tracked install numbers. Don't judge a channel as "cheap" on eCPI alone; cross-check against your own server-side conversion data where possible.

## In practice

Optimizing iOS campaigns purely on eCPI can push budget in the wrong direction. Look at SKAN aggregate data alongside your own first-party conversion signals to confirm direction.
