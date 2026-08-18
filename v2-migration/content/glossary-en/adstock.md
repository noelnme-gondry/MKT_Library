---
term: "Adstock"
seoTitle: "What Is Adstock? Why Ad Effects Show Up Days Later"
shortDef: "The lingering effect of an ad that carries over after it stops running"
description: "Adstock is the carryover of ad exposure into conversions days or weeks later. Why it matters for MMM and how to read it in practice."
date: "2026-07-18"
slug: "adstock"
keywords: "adstock, adstock meaning, ad carryover effect, MMM adstock, advertising decay"
category: "Budget & Optimization"
relatedPosts: ["marketing-mix-modeling"]
draft: false
faq:
  - q: "How is adstock calculated?"
    a: "The most common form is geometric decay. At a decay rate of 0.5, $1,000 spent today carries $500 of effect into tomorrow and $250 the day after. Summed, that is $1,000 ÷ (1 − 0.5) = $2,000 of total effect; at a 0.8 decay rate it reaches $5,000."
  - q: "What happens if you ignore adstock?"
    a: "You will usually underestimate advertising's effect. Regressing daily spend against daily revenue assigns conversions caused by yesterday's ad to today's spend, or scatters them into noise. Channels with long carryover, like brand campaigns, lose the most."
  - q: "How do you choose the decay rate?"
    a: "It is estimated from data rather than fixed by convention. The usual approach fits several candidate rates and keeps the one that explains the data best. Brand awareness campaigns tend to decay slowly and immediate promotions quickly."
---

## In one line

An ad you run today is not spent by tonight. That carryover — impact decaying gradually over days or weeks as it turns into conversions — is what adstock describes.

## Why it matters

Conversions don't always happen the moment someone sees an ad. Ignoring adstock misattributes late conversions to the wrong time or channel. [Marketing Mix Modeling (MMM)](/blog/marketing-mix-modeling) transforms raw spend into adstocked spend (past spend decayed and added to today's) to avoid this distortion.

## Run the numbers

Take an adstock with a 0.5 decay rate. Spend $1,000 today and it carries $1,000 of effect today, $500 tomorrow, $250 the day after — halving each step.

Summed, that is $1,000 ÷ (1 − 0.5) = $2,000 of effect from one day's spend. At a 0.8 decay rate it becomes $1,000 ÷ 0.2 = $5,000. The same spend can be credited with several times the contribution depending on the decay rate alone, which is exactly why that rate has to be estimated rather than eyeballed.

## In practice

- Brand awareness campaigns tend to have longer adstock (effect lingers).
- Direct-response promos tend to have shorter adstock (effect fades within days).
- Ignoring adstock and just regressing daily spend against daily revenue tends to underestimate true ad effectiveness.

## Go deeper

See how adstock is used in real channel-contribution analysis in [What is MMM](/blog/marketing-mix-modeling).
