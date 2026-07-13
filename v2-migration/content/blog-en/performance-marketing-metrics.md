---
title: "Performance Marketing Metrics: Stop Memorizing Them, Read Them as a Chain"
description: "Instead of memorizing CPI, CPA, ROAS, and LTV:CAC separately, read them as one connected chain and you'll see exactly where performance is leaking. A metrics primer for junior marketers."
date: "2026-07-09"
slug: "performance-marketing-metrics"
keywords: "performance marketing metrics, CPI, CPA, ROAS, LTV, CAC, LTV:CAC, marketing metrics basics, junior marketer"
tags: ["Metrics Basics", "Performance Marketing"]
draft: false
---

CPI, CPA, ROAS, LTV, CAC… open a report and the acronyms pour out. You know what each one means, but "so what should I actually look at right now?" doesn't jump out at you. Today I'll show you how to read these metrics as one connected chain instead of memorizing them separately. Read them this way, and when a number spikes, you'll immediately know where to look.

## Reading metrics one by one won't get you a diagnosis

Let's start with the most common mistake: reading each metric in isolation. You know what CPA is, you know what ROAS is — but when ROAS goes bad, you get stuck on "okay, so what do I fix first?"

There's a reason for that. There isn't just one thing that can hurt performance. Like every metric system, ad metrics are linked in one chain running from impressions all the way to long-term value. You have to look at the whole chain to see where the cause actually sits.

## 1. Metrics are one chain

Spend ad budget, and people come in, install or sign up, purchase (convert), generate revenue, and — if things go well — repurchase. Each stage has its own metric attached to it.

![A flow diagram of the performance marketing metrics chain. Ad spend leads to installs, conversion/purchase, revenue, and repurchase/long-term value, with CPI, CPA, ROAS, and LTV:CAC attached at each stage.](/blog-assets-en/performance-marketing-metrics/metric-chain.svg)

Lay it out left to right like this, and it becomes clear exactly which "link" each metric is watching. Let's go through them one at a time.

## 2. Each link answers a different question

Each metric answers a different question. Let's go through the definitions and examples briefly. (The numbers below are illustrative.)

- **CPI** (Cost Per Install): ad spend ÷ installs. It answers "how much did it cost to get one user to install?" It's generally the entry-point metric for app marketing. For example, spend 5 million won and get 5,000 installs, and CPI is 1,000 won.
- **CPA** (Cost Per Action): ad spend ÷ conversions. Here, "action" can be whatever you actually care about — sign-up, purchase, and so on. If installs keep growing but conversions don't, CPI can look great while CPA looks bad.
- **ROAS** (Return On Ad Spend): revenue ÷ ad spend, usually shown as a percentage. It tells you how much revenue one won of ad spend generated. For example, spend 5 million won and generate 15 million won in revenue, and ROAS is 300%.
- **LTV : CAC**: the ratio of LTV (LifeTime Value — the value a customer generates over their lifetime) to CAC (Customer Acquisition Cost — the cost of acquiring that customer). Look closely and it's not that different from ROAS. (ROAS is revenue ÷ ad spend; LTV is revenue ÷ users; CAC is ad spend ÷ users — so the ratio reduces to revenue : ad spend, same as ROAS.) The real difference between ROAS and LTV is the revenue window they use. ROAS tallies revenue over a fixed window (Day 0, Day 1, Day 7, Day 14, etc.), while LTV accounts for repurchase behavior and tallies the total revenue a user is expected to generate over their whole relationship with you. Think of it as a longer-horizon version of ROAS — which is exactly why how you estimate that long-term revenue matters so much.

The first three (CPI, CPA, ROAS) look at this ad's efficiency and short-term profitability. LTV:CAC looks at whether "this business stays profitable in the long run." They're watching different time horizons.

## 3. Read them as a chain, and the problem's location becomes visible

Here's where it gets genuinely useful. Line up every stage side by side, and you get a diagnosis.

Here's an example. CPA is low — meaning you're generating conversions cheaply. But ROAS isn't showing up.

![An example of locating the problem using the metrics chain. CPI and CPA are normal (green), but ROAS is flashing red, and LTV:CAC is on hold due to insufficient data. The problem sits in the post-conversion revenue stage.](/blog-assets-en/performance-marketing-metrics/metric-chain-diagnosis.svg)

In this case, the problem isn't upstream in the ad. Conversions are being generated fine — it's that the average order value of those conversions is too low to translate into revenue. A low average order value can mean either too few purchases, or plenty of purchases at too low a price point.

The reverse case exists too. What if CPA and ROAS both look good, but LTV:CAC is bad? First purchases are coming in fine, but repurchase isn't following. That's not an acquisition problem — it's a retention problem. What you'd want to think about here is the product experience or the repurchase cycle.

Narrowing the cause down by asking "which link is flashing red" — that's the decisive difference from looking at metrics one at a time.

## Try this today

As you think this through, a question will come up: the ad chain isn't just spend → install. In between there's impressions, there's clicks. When a metric moves, the problem could be a conversion rate shifting somewhere in the funnel, or impressions simply getting more expensive. So here's the one thing to try today: line up your daily cost and conversion metrics from top to bottom, and check how the price changes at each link of the chain, and how the conversion rate between links changes. Put cost metrics — CPC, CPI, CPA, CPP (cost per purchaser) — on top, showing whether they're rising or falling, and put conversion-rate metrics — CTR, install conversion, action conversion, purchase conversion — below, showing how they're moving. If the cost metrics above are rising while the conversion-rate metrics below are falling, you've found your cause. But what if the cost metrics are rising while the conversion-rate metrics are also rising or holding steady? Where's the problem then? Sit with that one.

One important note: don't judge a trend off too short a window. You need several weeks or months of trend to see the real pattern. Looking at daily data is fine, but day-of-week variance can be large enough that it's not always advisable — comparing day-of-week-adjusted variance would be a better bet.

## Wrap-up

The core idea is treating metrics as a connected chain. Each metric immediately affects — and is affected by — the metric right before and after it in the chain. You have to read the data accounting for the hidden conversion rates between links and the cost-per-impression (CPM) underneath every one of them (the answer to the question above) before the problem location becomes visible.

The catch is that calculating all of this separately in a spreadsheet every time is a hassle. If you'd rather see these metrics lined up on one screen, upload the raw file you already have saved to our free [operations dashboard](/dashboard). It shows CPI, CPA, ROAS, and LTV:CAC together on one screen, so you can immediately see which link is leaking. Uploaded data is processed entirely in your browser and never leaves it, so there's no risk in putting your media spend or revenue numbers anywhere external.

And don't forget what we said earlier: a benchmark like LTV:CAC of 3:1 varies by industry. Your own data's trend is a far more accurate compass than someone else's benchmark.

If a number suddenly spikes somewhere in this chain, we've laid out where to look first, step by step, in our [drop-diagnosis order post](/en/blog/ad-performance-drop).
