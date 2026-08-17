---
term: "ARPU (Average Revenue Per User)"
seoTitle: "What Is ARPU? And How It Differs from ARPPU"
shortDef: "Revenue over a period divided by the total number of users"
description: "ARPU is revenue divided by all users. How it differs from ARPPU, why a rising ARPU can mislead, and how it feeds an LTV estimate."
date: "2026-08-17"
slug: "arpu"
keywords: "ARPU, ARPU meaning, ARPPU, average revenue per user, ARPDAU, revenue per user, LTV calculation"
category: "Basic Metrics"
relatedPosts: ["ltv-cac-ratio", "cohort-analysis-guide"]
draft: false
faq:
  - q: "How is ARPU different from ARPPU?"
    a: "ARPU divides by all users; ARPPU divides only by paying users. In apps with low payer rates the two diverge sharply, so reading only one can invert your conclusion."
  - q: "Is a rising ARPU always good news?"
    a: "Not necessarily. ARPU also rises when new-user volume falls and the denominator shrinks. Read user count and revenue together, and split by cohort to tell real improvement from a mix shift."
  - q: "Can you calculate LTV from ARPU?"
    a: "Cumulative ARPU curves per cohort are the basis of an LTV estimate. If the observation window is short the curve has not matured, and extending it directly over- or under-states LTV."
---

## In one line

**ARPU (Average Revenue Per User)** is revenue over a period divided by the **total number of users** — what an average user produced.

## Do not confuse it with ARPPU

The names are close but the denominators differ.

- **ARPU** = revenue ÷ **all** users
- **ARPPU** = revenue ÷ **paying** users

In an app with a 3% payer rate, ARPPU lands around 30× ARPU. The two lead to completely different conclusions, so check which one a report is actually showing.

They answer different questions: ARPU is the profitability of the whole user pool, ARPPU is how much payers spend.

## A rise is not automatically good

ARPU is a ratio, so it **also rises when the denominator falls.** When new-user volume drops, the remaining base skews toward heavy users and ARPU climbs on its own.

Reading ARPU alone and declaring improved monetisation is therefore risky. Read **user count and revenue together**, and split by [cohort](/glossary/cohort) where you can.

## How it feeds LTV

[LTV](/glossary/ltv) ultimately comes from **cumulative ARPU curves** per cohort: stack cumulative ARPU at D7, D30 and D90 after install and see where the curve converges.

Watch the observation window. Recent cohorts have immature curves, and extending them in that state produces badly wrong LTV.

## Go deeper

The relationship between LTV and [CAC](/glossary/cac) is covered in [LTV:CAC](/blog/ltv-cac-ratio); reading cumulative cohort curves is covered in [cohort analysis](/blog/cohort-analysis-guide).
