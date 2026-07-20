---
title: "When Campaign Performance Suddenly Spikes — Finding the Cause"
description: "When CPA or conversions swing on a given day, how to separate noise from a real anomaly and trace the cause."
date: "2026-07-15"
slug: "campaign-anomaly-detection"
keywords: "campaign anomaly detection, performance drop, CPA spike cause, conversion collapse, marketing anomaly, campaign monitoring, performance variance cause"
tags: ["Analysis", "Monitoring"]
draft: false
---

You open the dashboard one day and CPA has jumped. Your stomach drops. But before you touch anything, ask one question: **is this a real anomaly, or just that day's noise?**

## Daily numbers wobble by nature

Day-to-day performance always swings. Weekend and day-of-week effects, the luck of a low-sample day, billing lag, yesterday's conversions posting today. Mistake this **normal in-range wobble** for an anomaly and act on it, and you can [reset the platform's learning](/blog/ad-machine-learning) and make things worse.

So you need a definition of "spiked" — not the gut feeling that it rose since yesterday.

## The bar for an anomaly is "how far past the usual"

A simple method that works in practice is a **moving average ± standard deviation band**. Take the recent N days' mean and spread as the baseline, and flag today as an "anomaly candidate" only if it breaks the band (say mean ± 2σ). Inside the band, it's just the usual wobble.

Set up this way, you react not to "CPA rose 20% from yesterday" but only to **"it broke past the normal range."** Most wasted interventions get filtered here. For metrics with strong day-of-week swings, compare like days or remove the day-of-week effect for more accuracy.

## If it is an anomaly, decompose next

Once a real anomaly is confirmed, split the cause. Performance changes for two broad reasons.

- **Volume** — spend or impressions changed the total.
- **Efficiency** — conversion rate or unit cost itself got worse.

Mix the two and you stop at "CPA rose." Split volume and efficiency by channel, campaign, and creative with [performance variance decomposition (PVM)](/tools/campaign-variance), and you land on the actual culprit, like "channel A's efficiency dropped and dragged the whole thing down." Because it decomposes with no residual, the parts add up exactly to the whole.

## Where to look

The [operations dashboard](/dashboard)'s anomaly tab auto-flags days that break the band, and [performance variance detection](/tools/campaign-variance) decomposes the cause residual-free. Upload an efficiency CSV or connect a Google Sheet. Connect a Sheet once and you can keep checking with fresh data without re-uploading weekly.

## Let's be honest

Anomaly detection tells you "this looks off" — it doesn't prove the cause. Even a day that broke the band may have outside factors mixed in (a competitor promo, seasonality, a landing outage). Use the spiked number only as a **starting point** for investigation, and check what actually happened that day before deciding.
