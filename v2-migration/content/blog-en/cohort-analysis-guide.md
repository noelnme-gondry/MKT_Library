---
title: "Retention Is 30% but Revenue Won't Move — Split by Cohort and You'll See"
description: "Read D1, D7, and D30 retention cohorts instead of a misleading average. Learn how cohort analysis reveals churn and guides channel and onboarding decisions."
date: "2026-07-15"
slug: "cohort-analysis-guide"
keywords: "cohort analysis, what is cohort analysis, retention analysis, retention curve, cohort retention, D1 D7 D30 retention, how to read app retention, improve user retention, average retention trap, cohort table"
tags: ["Analysis", "Retention"]
draft: false
---

If someone says "our retention is 30%" but revenue is flat, look first at **how that 30% was computed** (numbers here are illustrative). An overall average lies while new users keep pouring in. Splitting by groups that started at the same time is cohort analysis, and only this way can you tell whether users are accumulating or draining out.

## What's a cohort

A cohort is "a group that started at the same time." In marketing it usually means **users who installed or signed up on the same day (or week)**.

The Jan 1 installers, the Jan 2 installers… you split like this and track how much of each group remains over time. Why go this far? Because **the overall average lies.**

When new users keep arriving, the total active count looks like it's rising. But the users who arrived may be dropping off one by one. Split by cohort and it becomes clear whether you're "pouring into a leaking bucket." The better the total number looks, the more this check matters.

## Reading the retention curve

The core output of cohort analysis is the retention curve. The x-axis is days elapsed (D0, D1, D7, D30…), the y-axis the share still remaining.

- **D1 retention**: the share of day-one users who return the next day. Reflects first impression and onboarding quality.
- **D7 retention**: a week later. Whether it's become a habit.
- **D30 retention**: a month later. The share of users who genuinely stuck.

A curve that **drops sharply early and then flattens** is the healthy shape — the height where it flattens is your long-term core-user share. One that keeps sliding down with no floor signals nothing is holding people.

Watch one trap: don't compute retention as a **plain row average**. Cohorts differ in size, and a flat average over-weights small cohorts. Always **weight by the base (installs, signups)** for accuracy.

## Where you use it

- **Channel evaluation**: does the cheap-CPI channel also retain? Acquire cheap and bleed them all, and it's wasted money.
- **Onboarding**: a low D1 means fix the first experience.
- **Basis for LTV estimation**: you need the retention curve to compute [LTV:CAC](/blog/ltv-cac-ratio).

See cohort retention in the [operations dashboard](/dashboard)'s cohort tab by uploading a CSV or connecting a Google Sheet — it handles the install/signup basis switch and the ratio-vs-headcount column detection. Connect a Sheet once and you can keep checking as new cohorts accumulate without re-uploading.

## Let's be honest

Low retention isn't automatically bad. Normal ranges differ entirely by service type (a tax app used once a year, say). Read it by the **same service's change over time** or **cohort-to-cohort comparison** — don't declare good or bad off one absolute number.
