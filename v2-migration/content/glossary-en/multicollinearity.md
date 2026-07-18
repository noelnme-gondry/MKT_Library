---
term: "Multicollinearity"
shortDef: "When independent variables move together so tightly a regression can't tell their effects apart"
description: "Multicollinearity is when several independent variables (e.g. channel spend) move together so closely that a regression model can't separate each one's individual effect."
date: "2026-07-18"
slug: "multicollinearity"
keywords: "multicollinearity, multicollinearity meaning, VIF, MMM multicollinearity, regression collinearity"
category: "Measurement & Methodology"
relatedPosts: ["marketing-mix-modeling"]
draft: false
---

## In one line

**Multicollinearity** happens when independent variables you put into a regression (say, spend on multiple channels) always move up and down together, so the model can't tell which one is actually driving the outcome.

## Why it matters

This is a common trap in marketing data. If you always scale two channels together, revenue going up can't be cleanly attributed to one or the other — coefficients become unstable and can even flip sign. It's especially common in [Marketing Mix Modeling](/blog/marketing-mix-modeling), where channel-level contribution is being regressed.

## How to spot it

- Check pairwise correlation between channels before modeling.
- Coefficients with counterintuitive signs or unusually large standard errors are a warning sign.
- The real fix isn't statistical — it's data design: you need periods where channels moved independently for the model to tell them apart.

## Go deeper

See how multicollinearity distorts MMM results in [What is MMM](/blog/marketing-mix-modeling).
