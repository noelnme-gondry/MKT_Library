---
term: "Multicollinearity"
seoTitle: "What Is Multicollinearity? Check VIF Before MMM"
shortDef: "When independent variables move together so tightly a regression can't tell their effects apart"
description: "Multicollinearity is when channels move together so regression cannot separate their effects. Check VIF and correlation before MMM."
date: "2026-08-09"
slug: "multicollinearity"
keywords: "multicollinearity, multicollinearity meaning, VIF, VIF meaning, MMM multicollinearity, regression collinearity"
category: "Measurement & Methodology"
relatedPosts: ["marketing-mix-modeling", "multicollinearity-mmm-guide"]
draft: false
faq:
  - q: "What VIF value is a problem?"
    a: "5 is the usual caution line and 10 the serious one. VIF measures how far the standard error has been inflated, and the error grows by the square root of VIF — so a VIF of 10 means standard errors about 3.2 times wider than with no collinearity, and a VIF of 5 about 2.2 times."
  - q: "A channel came back with a negative coefficient. Is it hurting sales?"
    a: "Suspect collinearity first. If search and social budgets always moved together, the model has no basis for separating them, and the negative coefficient is a symptom of failed identification rather than a measured effect. A high VIF means this data cannot separate these channels, not that a channel does not work."
  - q: "How do you fix multicollinearity?"
    a: "Through data design rather than statistical technique. The model can only separate channels that have moved separately, so you need periods where one channel was scaled up or down on its own, a geo-split test, or a holdout. Changing model options until contributions appear is not a fix."
---

## In one line

When independent variables in a regression — spend across several channels, say — always rise and fall together, the model cannot reliably separate which one produced the result. That state is multicollinearity.

![Channel spend moving together and a VIF check](/blog-assets-en/multicollinearity/vif-before-mmm.svg)

## Why it matters

This is a common trap in marketing data. If you always scale two channels together, revenue going up can't be cleanly attributed to one or the other — coefficients become unstable and can even flip sign. It's especially common in [Marketing Mix Modeling](/blog/marketing-mix-modeling), where channel-level contribution is being regressed.

## How to spot it

- Check pairwise correlation between channels before modeling.
- Check VIF (variance inflation factor). A VIF of 5+ is commonly a warning and 10+ a severe signal. A low VIF does not prove causality; a high VIF means the channel coefficients have weak standalone interpretation.
- Coefficients with counterintuitive signs or unusually large standard errors are a warning sign.
- The real fix isn't statistical — it's data design: you need periods where channels moved independently for the model to tell them apart.

## What to do before MMM

When VIF is high, do not force a channel-contribution answer by changing MMM options. First create periods where the linked channels move independently: a one-channel budget change, a regional experiment, or a holdout. Use the [VIF Multicollinearity Check](/tools/vif-multicollinearity) on a channel-spend CSV before modeling.

## Go deeper

See how multicollinearity distorts MMM results in [What is MMM](/blog/marketing-mix-modeling).
