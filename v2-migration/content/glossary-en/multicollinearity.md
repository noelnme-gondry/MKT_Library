---
term: "What Is Multicollinearity? Check VIF Before MMM"
shortDef: "When independent variables move together so tightly a regression can't tell their effects apart"
description: "Multicollinearity is when variables such as channel spend move together so closely that regression cannot separate their effects. Check VIF and channel correlation before MMM."
date: "2026-08-09"
slug: "multicollinearity"
keywords: "multicollinearity, multicollinearity meaning, VIF, VIF meaning, MMM multicollinearity, regression collinearity"
category: "Measurement & Methodology"
relatedPosts: ["marketing-mix-modeling"]
draft: false
---

## In one line

**Multicollinearity** happens when independent variables in a regression, such as spend on multiple channels, move up and down together so consistently that the model cannot stably separate their effects.

![Channel spend moving together and a VIF check](/blog-assets-en/multicollinearity/vif-before-mmm.svg)

## Why it matters

This is a common trap in marketing data. If you always scale two channels together, revenue going up can't be cleanly attributed to one or the other — coefficients become unstable and can even flip sign. It's especially common in [Marketing Mix Modeling](/blog/marketing-mix-modeling), where channel-level contribution is being regressed.

## How to spot it

- Check pairwise correlation between channels before modeling.
- Check **VIF (variance inflation factor)**. A VIF of 5+ is commonly a warning and 10+ a severe signal. A low VIF does not prove causality; a high VIF means the channel coefficients have weak standalone interpretation.
- Coefficients with counterintuitive signs or unusually large standard errors are a warning sign.
- The real fix isn't statistical — it's data design: you need periods where channels moved independently for the model to tell them apart.

## What to do before MMM

When VIF is high, do not force a channel-contribution answer by changing MMM options. First create periods where the linked channels move independently: a one-channel budget change, a regional experiment, or a holdout. Use the [VIF Multicollinearity Check](/tools/vif-multicollinearity) on a channel-spend CSV before modeling.

## Go deeper

See how multicollinearity distorts MMM results in [What is MMM](/blog/marketing-mix-modeling).
