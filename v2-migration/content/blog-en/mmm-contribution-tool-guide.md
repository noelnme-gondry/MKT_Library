---
title: "What MMM can tell you about channel contribution"
description: "Use weekly spend and outcomes to separate base demand from marketing patterns and choose a budget hypothesis to test."
date: "2026-11-22"
slug: "mmm-contribution-tool-guide"
primaryTool: "5-18-mmm"
tags: ["Measurement & analysis"]
faq:
  - q: "Does an 83% baseline share mean 83% of sign-ups would happen without ads?"
    a: "The share compares the squared sizes of weekly modeled contributions. The weekly breakdown shows the direction and size in individual weeks."
  - q: "How reliable are separate channel estimates when spend moves together?"
    a: "The model may fit total sign-ups well while struggling to distinguish the channels. Inspect the uncertainty and look for weeks when their budgets changed independently."
---

Sign-ups climbed as you increased paid search. They also climbed at about this time last year, when you were spending much less. If someone asks how many of this month’s sign-ups the search budget bought, which increase should you point to?

Library’s marketing mix model (MMM) starts with weekly sign-ups for the whole business and spend for each channel. Part of what you see may be steady growth in demand. Part may recur every year. The estimate for search depends on how well the model can separate those patterns from the weeks when you spent more on search.

## What it means to take out the trend

A product that gains users steadily can grow even through weeks of flat spend. The Bayesian model allows for an underlying level of demand and a trend whose slope can change. Recurring seasonal movements, events you supply and structural changes can each enter separately. These terms are fitted alongside the media effects. That matters particularly when the business and its marketing budget have both grown for months.

Take a week with 1,000 sign-ups. Say the fitted baseline and trend account for 700, and seasonal and event terms add another 50. That leaves 250. If the channel estimates add up to 200, the other 50 are the gap between the model and the observation. Giving all 250 to advertising would overstate what the model explained.

## How a week’s spending becomes a channel estimate

A person who saw your campaign last week may sign up this week. The model carries part of earlier spend forward and lets it fade with time, a transformation known as *adstock*. A second transformation, the Hill response curve, allows returns to flatten as spend rises. Together these capture why two weeks with the same spend can have different modeled results, and why doubling spend need not double sign-ups.

For a channel fitted individually, multiply its transformed exposure for the week by its fitted coefficient. An exposure of 0.4 and a coefficient of 500 would give 200 modeled sign-ups. The 500 applies to a unit of transformed exposure, so it cannot be read as sign-ups per dollar. If the data only support a group estimate and the tool distributes that total among member channels, treat the individual figures with more caution.

## Why 83% does not mean 83 of every 100 customers

In the example, base demand and trend take up 83% of the contribution chart. That chart compares the average squared size of each component’s weekly contribution over the selected period. Squaring means a large seasonal dip counts toward magnitude as well as a large lift. In week 27 the seasonal term is about 1,392 sign-ups *below* baseline. The weekly breakdown shows the direction that the percentage leaves out.

| 132-week sign-up example | Estimated weekly contribution |
| --- | ---: |
| Base demand and trend | +9,861 per week on average |
| Brand | +3,379 per week on average |
| Performance marketing | +2,444 per week on average |
| Seasonality | From −1,392 in the lowest week to +1,244 in the highest |

Hiding base demand is useful if you want to compare the smaller components with each other. Their shares grow because the denominator shrinks. Their estimated sign-ups stay the same.

## How much confidence should you put in a budget change?

Start by asking whether the model could predict later weeks it had never seen. In the 132-week example, the Bayesian fit has a weighted absolute percentage error of 6.4% on those weeks. Simply carrying the last observed value forward gives 12.5%. That is encouraging for the total forecast. If two channels rose and fell together, their individual contributions can still be hard to tell apart.

You can also compare the Bayesian result with the browser-based R model, which uses Elastic Net. The Bayesian model considers different carryover and saturation shapes and estimates uncertainty. Elastic Net shrinks coefficients when predictors overlap. If the two approaches tell different stories about the same channel, look for weeks when that channel changed independently before making a spending commitment.

For a decision about the *next* increase, look at the response curve around your actual budget. At Google’s recent average spend, the example associates an additional ₩1.4 million with about 35 more sign-ups. Check the uncertainty and whether you have ever spent near the proposed amount.

![Estimated extra sign-ups per ₩1.4m. At half recent average spend, 57.4 (33.6–76.9). At average, 35.0 (20.5–46.9). At 1.5× average, 21.2 (12.4–28.4), outside observed spend.](/blog-assets-en/mmm-contribution-tool-guide/google-spend-response.svg)

For the budget discussion, turn the dots into a price per extra sign-up. At recent average spend, ₩1.4 million divided by 35 modeled sign-ups gives **about ₩40,000 per additional sign-up**. Starting at 1.5 times average spend, the same increase buys an estimated 21.2 sign-ups, or about ₩66,000 each. That second starting point is outside the spending history, so the estimate is a weaker basis for a commitment.

Meta has a positive estimate too, but had no spend in the final eight weeks. There, a limited restart can teach you more than committing the full increase on the strength of old activity.

## What to bring to the analysis

Use one row per week, one consistent business outcome and a spend column for each channel. Align week boundaries and currencies. A missing report and a confirmed zero-spend week should be distinguishable. Bring dates for major promotions or price changes, too. A year or more of history helps you examine an annual pattern. Weeks when channels moved independently help you answer the separate question of which channel mattered.

If several spending series rose and fell together, use the [MMM collinearity guide](/blog/multicollinearity-mmm-guide) to identify channel estimates that are difficult to interpret separately.

[Explore the trend, channel estimates and response curves](/tools/mmm-contribution?example=1)
