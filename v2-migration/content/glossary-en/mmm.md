---
term: "MMM (Marketing Mix Modeling)"
seoTitle: "What Is MMM? Marketing Mix Modeling Explained"
shortDef: "Modelling channel spend against outcomes over time to estimate each channel's contribution"
description: "MMM models channel spend and outcomes over time to estimate contribution. What it needs to work, and the conditions where it cannot be trusted."
date: "2026-08-17"
slug: "mmm"
keywords: "MMM, marketing mix modeling, media mix modeling, channel contribution, adstock, saturation curve, incrementality vs MMM"
category: "Measurement & Methodology"
relatedPosts: ["marketing-mix-modeling", "multicollinearity-mmm-guide"]
draft: false
faq:
  - q: "How much data does MMM need?"
    a: "At least a year of weekly data, ideally two or more. Separating seasonality from trend requires observing the same periods repeatedly; with a short window the coefficients are decided by assumptions rather than data."
  - q: "Can MMM results be treated as causal?"
    a: "No. MMM models association between observed spend and outcomes, so treat it as a hypothesis generator. Confirm with a holdout experiment before committing large budget shifts."
  - q: "What happens when channel spends move together?"
    a: "Multicollinearity makes it impossible to separate their contributions reliably. Numbers still appear but without support, so check VIF first and either combine channels or create independent spend variation."
---

## In one line

**MMM (Marketing Mix Modeling)** estimates each channel's contribution by modelling how channel spend, external factors and base demand related to outcomes over time.

## It does not track users

[Attribution](/glossary/attribution) and an [MMP](/glossary/mmp) follow individual user touchpoints. MMM does not. It reads **aggregate weekly data** and estimates statistically how much outcomes moved when a channel's spend moved.

That is why it keeps working when user-level tracking is restricted. In exchange, it cannot say who any individual conversion belongs to.

## Two things it must account for

- **[Adstock](/glossary/adstock)** — today's advertising carrying over across following days
- **[Diminishing returns](/glossary/response-curve)** — each additional unit of spend producing less

Leave these out and you get an unrealistic model where doubling spend doubles outcomes.

## There are clear conditions where it fails

**Short data does not work.** You need at least a year of weekly observations, preferably two, to separate seasonality.

**Channels that move together do not work.** Two channels always raised and cut in step cannot have their contributions separated. That is [multicollinearity](/glossary/multicollinearity), and per-channel numbers produced in that state cannot justify a budget split. Check with a [VIF diagnosis](/tools/vif-multicollinearity) before modelling.

## It is not causal

The limitation that matters most. MMM models **observed association**, not an experiment. A large coefficient does not establish that the channel produced the outcome.

Use it to form hypotheses, and confirm with a [holdout test](/glossary/holdout-test) before large budget decisions.

## Go deeper

MMM's assumptions and interpretation limits are covered in [marketing mix modeling](/blog/marketing-mix-modeling); collinearity diagnosis in the [multicollinearity guide](/blog/multicollinearity-mmm-guide). To run it on your own weekly panel, use [marketing response analysis](/tools/marketing-response).
