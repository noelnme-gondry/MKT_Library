---
term: "Retention"
seoTitle: "Retention Meaning and Formula | Reading D1, D7, D30"
shortDef: "The share of installed/signed-up users still active after a given number of days"
description: "Retention is the share of users who come back after installing or signing up. What D1, D7 and D30 mean, how to calculate it, and the traps."
date: "2026-07-18"
slug: "retention"
keywords: "retention, retention meaning, retention formula, D1 retention, D7 retention, D30 retention, user retention rate, retention curve, cohort retention, app retention"
category: "Measurement & Methodology"
relatedPosts: ["cohort-analysis-guide", "aha-moment-retention"]
draft: false
faq:
  - q: "What do D1, D7 and D30 retention mean?"
    a: "Counting install day as D0, they are the share of users who came back 1, 7 and 30 days later. D1 reflects first impression, D7 the start of a habit, and D30 the users who actually stay. They answer different questions, so no single one is enough."
  - q: "How do you calculate retention?"
    a: "The denominator is the number of users who installed or signed up on the same day (the cohort size), and the numerator is how many of them returned at that point. When combining days, weight by cohort size rather than averaging the daily rates."
  - q: "What is a good retention rate?"
    a: "External benchmarks rarely fit, because the normal range shifts with category, monetisation and acquisition mix. The reliable reference is your own past cohorts, so judge improvement against that trend."
  - q: "How is retention different from a cohort?"
    a: "A cohort is the unit — a group of users who started at the same time. Retention is the share of that group still returning later. An overall average retention that is not split by cohort moves with changes in new-user volume, which makes it hard to interpret."
---

## In one line

Retention is the share of users who installed or signed up at a given point that are still coming back some days later — commonly measured as D1, D7, or D30.

## Why it matters

No matter how much new traffic comes in, if it all leaks out, you're "pouring water into a leaking bucket." Retention shows whether a product actually holds on to people.

It matters for advertising too. When retention is low, no amount of CPI reduction produces enough [LTV](/glossary/ltv) to recover [CAC](/glossary/cac). Choosing channels on acquisition cost alone tends to cost you later.

## What D1, D7 and D30 each tell you

Count install day as D0.

- D1 retention — came back the next day. Tests first impression and onboarding. If this breaks, the later numbers do not matter yet.
- D7 retention — one week later. Whether a single trial is turning into a habit.
- D30 retention — one month later. The size of the base that actually stays, and the number most directly tied to revenue and LTV.

They answer different questions. Strong D1 with collapsing D30 points at sustained value, not onboarding; weak D1 points at traffic quality or the first session.

## The formula

For a single cohort:

```
D7 retention = (users who returned on D7) ÷ (users who installed that day)
```

The denominator is that cohort's size. Dividing by total active users produces a different metric entirely.

You also have to define "returned" up front. Whether opening the app counts, or a core action is required, changes the number a lot. Either choice is defensible — but once set, don't change it. A changed definition breaks comparison with the past.

## Three common traps

One: averaging cohorts unweighted. Averaging daily retention rates gives a 100-user cohort the same weight as a 10,000-user one. Weight by cohort size instead.

Two: cohorts that have not matured. A user who installed yesterday has no D30 yet. If that renders as 0, recent cohorts look like they collapsed. Leave immature cells blank.

Three: mixing rates and counts. Depending on the report, a retention column may hold `0.32` (a rate) or `320` (a count). Calculating without separating the two produces entirely wrong results.

## "What is a good rate?"

This one is hard to answer honestly. The normal range varies so much by category, monetisation and acquisition mix that outside averages usually do not fit — and their sourcing is often unclear.

There is really only one trustworthy reference: your own past cohorts. Stacking the last 8–12 weeks and asking whether this cohort sits inside or outside that range is far more useful than comparing against someone else's average.

## Go deeper

Retention only reads properly when split by [cohort](/glossary/cohort). Reading the retention curve and finding where to improve is covered in [Cohort Analysis](/blog/cohort-analysis-guide); which early behaviours link to long-term retention is covered in [Aha Moment](/blog/aha-moment-retention).

To compute cohort retention on your own data, drop a CSV into the [operations dashboard](/dashboard) — it handles the cohort-size weighting for you.
