---
title: "Performance Marketing: Goals, Metrics and Marketing Analysis"
description: "Connect performance marketing goals and metrics to analysis of performance drops, ROAS and budgets, with data requirements and matching tools."
date: "2026-08-09"
slug: "performance-marketing-analysis-order"
searchTitleTerms: ["Performance Marketing", "Analysis"]
keywords: "performance marketing analysis, marketing data analysis, campaign analysis, MMM data requirements, incrementality analysis, advertising CSV"
tags: ["Diagnosis", "Analysis Methodology"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["cpa", "incrementality", "multicollinearity", "response-curve"]
answer: "Performance marketing analysis starts with the decision and the grain of the data, not the name of a method. Use daily performance for monitoring and variance decomposition, spend variation for saturation and allocation, a control for incrementality, and a 52+ week channel panel with a VIF check before MMM."
conditions: "The time windows below are practical eligibility checks used by this service. More rows do not fix poor measurement or weak variation, and observational data alone cannot establish causal lift."
reviewedAt: "2026-09-14"
faq:
  - q: "Which analysis should I run first when ad performance drops?"
    a: "Start with daily spend and conversions to validate the period and scope. Then use variance decomposition to separate channel mix from within-channel efficiency."
  - q: "Can I run MMM as soon as I have a lot of data?"
    a: "No. You need a long weekly channel panel with meaningful spend variation, then a VIF check for collinearity. High collinearity makes channel contributions hard to separate."
updated: "2026-10-14"
---
Ad spend has produced conversions, yet the next budget decision is still unclear. Installs may not lead to purchases, and a high ROAS does not necessarily mean a campaign is profitable. Performance marketing connects goal setting, measurement, analysis and operating changes.

This guide explains the meaning, goals and metrics of performance marketing, then selects an analysis from **the decision you need to make** and **what one row represents**. For a worked numerical example, follow the [marketing analysis CSV walkthrough](/blog/marketing-analysis-example).

![Choose the first marketing analysis from the question and data shape](/blog-assets-en/performance-marketing-analysis-order/analysis-path.svg)

## Define the goal and conversion before choosing an analysis

Performance marketing sets measurable goals such as installs, signups or purchases, then uses observed results to adjust advertising. A platform conversion count is only the starting point: check whether those conversions serve the business goal and whether their cost is sustainable.

For a new-customer purchase campaign, installs alone are insufficient. Align the definition of a new purchase and the reporting window, then review cost per purchase and attributed revenue relative to ad spend. ROAS is a revenue ratio, not profit margin or incremental advertising impact.

Connect **goal and conversion definition → metric review → change analysis → operating action → review on the same basis**. Use the [performance marketing metrics guide](/blog/performance-marketing-metrics) for calculation definitions and [marketing analysis methods and tools](/compare) to choose a path for the question at hand.

## What performance marketing means in practice

Performance marketing sets measurable goals and uses outcomes to adjust marketing activity. In paid acquisition, that connects channel selection, conversion measurement, creative and landing-page tests, budget decisions and analysis. It does not simply mean paying only when a click or conversion occurs.

It is not completely separate from brand marketing either. Brand activity can be measured through reach, search, awareness and business outcomes; purchase-focused ads may also affect later brand perceptions. Define the result and how to measure it rather than relying on the campaign label.

| Business result | Campaign goal | Metrics to inspect | What remains unanswered |
|---|---|---|---|
| Acquire users | Installs or signups | CPI or signup CPA | Later use, purchases and retention |
| Acquire new buyers | Deduplicated first purchases | Purchase CPA and new-customer CAC | Cost scope and repeat-customer exclusion |
| Grow revenue | Purchase value | ROAS, revenue and contribution | Revenue that would occur without ads |
| Reactivate customers | Return visits or repeat purchases | Audience-specific CPA and repeat purchase | Organic returns versus advertising lift |

If an install campaign ultimately serves purchases, connect installs to downstream conversion and customer value. Judging it too early on incomplete purchase reporting can confuse conversion delay with weak efficiency.

## A 300% ROAS is not enough to justify scaling

Consider a hypothetical calculation, not an observed customer result. KRW 1 million in ad spend produces 100 purchases and KRW 3 million in attributed revenue. Purchase CPA is KRW 10,000 and ROAS is 300%. Neither metric alone establishes profit.

Assume a 25% contribution margin before advertising. KRW 3 million in revenue contributes KRW 750,000 before subtracting the KRW 1 million ad spend, leaving −KRW 250,000 before fixed costs. Under those assumptions, the advertising break-even ROAS is 1 ÷ 0.25 = 4×, or 400%. Also check how refunds and discounts enter reported revenue.

Use the [ROAS calculator](/calculator/roas) and [break-even ROAS calculator](/calculator/break-even-roas) with your own cost scope. Clearing that threshold does not ensure the next budget increment performs equally well; separately inspect [marginal efficiency and allocation](/blog/budget-marginal-efficiency).

## Five steps in a performance marketing workflow

1. **Goal and audience:** Define first-time versus repeat buyers, the outcome and its time horizon.
2. **Measurement:** Check event definitions, attribution, currency and reporting delay before combining numbers.
3. **Execution and comparison design:** Record budget, creative and landing-page changes. Plan experiments before launch when causal impact is the question.
4. **Analysis and adjustment:** Locate the channels, campaigns or funnel stages where the goal metric changed, then identify possible adjustments.
5. **Review:** Compare mature periods using unchanged definitions. Separate observed improvement from the causal effect of an action.

The following table helps choose an analysis for step four. Then use the [marketing analysis walkthrough](/blog/marketing-analysis-example) to distinguish observations, hypotheses and actions in your report.

## The short answer: first analysis by data shape

| Data you have | First question | Start here | Then |
|---|---|---|---|
| Daily spend and conversions | Where is performance moving? | [Operations dashboard](/dashboard) | Narrow the channel and period |
| Campaign results before and after | Why did CPA or ROAS change? | [Performance variance](/tools/campaign-variance) | Separate volume, efficiency, and mix |
| Daily channel spend at several levels | How far can we scale? | [Saturation diagnosis](/tools/campaign-saturation) | [Budget allocation](/tools/budget-allocation) |
| Control and test aggregates | Which variant won? | [A/B experiment analysis](/tools/experiment-analysis) | Apply and measure again |
| Holdout market, period, or control | Did ads create net lift? | [Incrementality analysis](/tools/incrementality) | Budget from incremental value |
| 52+ weekly observations by channel | What are the long-run responses? | [VIF diagnosis](/tools/vif-multicollinearity) | MMM after collinearity checks |
| Search-term report | Which terms and CPT bids need action? | [ASA Keyword Finder](/tools/asa-keyword-finder) | Exact, negative, and bid actions |
| Daily creative delivery and conversion data | Which creative is fatiguing? | [Creative analysis](/content/freshness) | Replace or scale candidates |

This is not a ranking by sophistication. It is a map of **what your current data can answer**. If there is no control, start with an operating diagnosis instead of imitating an incrementality study.

<!-- CONTENT_ACTION -->

## 1. Start with monitoring when the number looks wrong

If CPA jumped today or conversions fell, you usually do not need a model first. Date, spend, and installs or conversions are enough to inspect the recent trend and channel split. Impressions and clicks add CPM, CTR, and conversion rate to the investigation.

The goal is not to prove a cause. It is to reduce the search area: reporting delay, one channel, or the whole funnel. Upload a CSV at [Start with my data](/start), and the service checks the columns and date coverage before showing analyses you can run now.

## 2. Split a before-and-after change into volume, efficiency, and mix

An increase in total CPA does not mean every channel became less efficient. Total CPA can rise because a more expensive channel took a larger share of conversions even when each channel's CPA stayed flat. A before-and-after decomposition separates volume, within-channel efficiency, and channel mix.

That explains what moved together. It does not prove why a budget moved or whether a creative change caused the result. Make one operational change at a time and measure again.

## 3. Use marginal efficiency for a scaling decision

Current average CPA is not enough to decide where to add budget. You need to know how many additional conversions followed higher spend. That requires meaningful spend variation within each channel. A channel funded at nearly the same level every day cannot support a stable response curve.

Check saturation first, then send only channels with headroom into budget allocation. “Efficient now” and “efficient for the next dollar” are different questions.

## 4. Make causal claims only when the design supports them

A/B testing and incrementality answer different questions. A/B compares variants. Incrementality compares advertising with a credible no-ad counterfactual.

Without a control, holdout market, or off period, observational performance does not justify “ads caused the lift.” Describe associations and operating signals honestly, then design a control for the next campaign. The strength of the conclusion should match the design.

## 5. MMM is not the final boss; it has different requirements

MMM is not last merely because it is heavy. It answers a different question when you have a sufficiently long weekly panel of channel spend, outcomes, and controls such as seasonality and promotions. The entry recommendation treats 12–51 weeks as exploratory and checks its decision-period threshold from 52 weeks. Meeting that threshold does not pass input quality, independent variation, identification, or time-ordered validation. If channels move together, their contributions are difficult to separate.

Run [VIF diagnosis](/tools/vif-multicollinearity) before MMM. High VIF is a signal to combine channels or redesign the period and variables. A model producing numbers does not make channel contribution identifiable.

If the number spiked for a single day, go to [campaign anomaly detection](/blog/campaign-anomaly-detection); if conversion leaks at one stage, [conversion rate optimization](/blog/funnel-dropoff-analysis); if users do not stay, [retention cohort analysis](/blog/cohort-analysis-guide).

## What can one file actually answer?

Suppose a daily file contains `date, channel, spend, clicks, new paying customers`. This is a workflow example, not observed campaign performance.

1. **Validate the input:** confirm that customers are deduplicated and new, dates and currency align, and recent conversions have matured. A column name alone does not make purchases, installs and signups the same outcome.
2. **Reach a first result:** check mapping and eligibility at [Start with my data](/en/start). Divide total cost by total customers and narrow the channel and period. Do not average row-level CPAs.
3. **Explain an observed change:** with two comparable periods, use [Performance variance](/en/tools/campaign-variance) to inspect mix and efficiency contributions. Align periods and conversion definitions first.
4. **Keep the unanswered question:** this file contains no randomized assignment or no-ad control. It can help locate a decline, but does not establish how many customers would disappear if advertising stopped.

A low MMM VIF also does not remove omitted confounders. Review controls and model assumptions separately, as described in Google Meridian's [required causal assumptions](https://developers.google.com/meridian/docs/causal-inference/required-assumptions). Record unresolved conditions alongside the result before making the next decision.

## If you do not know the tool, start with three questions

No file yet? Use [Diagnose performance](/diagnose) to choose the symptom, scope, and data shape. If you have a CSV, [Start with my data](/start) is faster: automatic column mapping → analysis eligibility → recommended first question. Uploaded data stays in the browser and is not sent to a server.

The best analysis is not the most complex one. Start with the smallest question your data can answer, check whether the result changes a decision, and deepen the analysis only when needed.

For repeated decisions, record observations, hypotheses and actions in the [weekly marketing report worksheet](/blog/weekly-marketing-report-template). If preparation is the bottleneck, compare the paths in [BigQuery, Sheets and analysis-ready CSVs](/blog/marketing-report-sheets-bigquery).
