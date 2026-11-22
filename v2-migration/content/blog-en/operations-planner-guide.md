---
title: "How the Operations planner compares next week’s campaign budgets"
description: "Find changes in campaign performance and estimate what a different split of the same budget could buy."
date: "2026-11-22"
slug: "operations-planner-guide"
primaryTool: "5-31"
tags: ["Budget & efficiency"]
faq:
  - q: "Can installs increase with a fixed total budget?"
    a: "Yes. The model can project a gain when the campaigns receiving money stand to add more installs than the campaigns being cut would lose."
  - q: "How should I read a proposal above the spending history?"
    a: "Look for observations near the proposed daily budget on the scatterplot. If there are few, consider testing a smaller change first."
---

Suppose you have to deliver next week’s installs on exactly what you spent this week. Your acquisition campaign picked up new customers cheaply, while the cost per install went up in retargeting. Would moving some of the retargeting budget to acquisition get you more installs?

It might. But the installs you already bought were cheap at the *old* budget. Before you move the money, you need two estimates. How many more installs could acquisition deliver with a larger budget? How many would you give up by cutting retargeting?

## What happens to installs if you move the money?

The Operations planner uses the amounts each campaign actually spent and the installs or sign-ups it delivered at those spending levels. It estimates next week’s results twice, first with spending kept at recent levels and then with the proposed changes. Using the same model for both estimates lets you compare the two plans on equal terms.

In the seven-day example, moving about ₩433,000 takes expected installs from 3,238 to 3,331. Acquisition can get *more expensive per install* as its budget grows and still be worth funding. What makes the move worthwhile is that the campaigns receiving money stand to gain more installs than the others stand to lose.

![Modeled changes over seven days. Meta · New customers +206 installs, Google app discovery +29, TikTok product demo −66, Meta retargeting −75.](/blog-assets-en/operations-planner-guide/campaign-installs.svg)

Acquisition alone stands to gain 206 installs. Once the losses in retargeting and product demo are counted, the planner projects a net gain of 94 installs. Subtracting the two displayed totals gives 93 because each total is rounded. The planner calculates the gain before rounding.

A campaign with a contractual spending commitment changes that calculation. Hold its spend steady and see whether the remaining campaigns still offer a worthwhile trade. You can also compare plans for a larger or smaller total when the team’s budget changes.

## Has this campaign ever spent that much?

Before committing to an increase, look at where the campaign’s observations fall on the spend and CPI chart. If it often spent close to the proposed amount, you have a history of what installs cost there. If most observations sit well below that amount, even a precise-looking forecast has little evidence at the budget you intend to use. A smaller change gives you a chance to learn. The planner can withhold a recommendation when the history is too thin or the constraints cannot be satisfied.

![98 daily spend and CPI observations for Meta · New customers. Both the current ₩258k and proposed ₩309k per day are within the observed range. Fitted average CPI rises with spend.](/blog-assets-en/operations-planner-guide/daily-spend-cpi.svg)

Each dot is one day for the acquisition campaign. Farther right means more spend. Higher up means each install cost more that day. On 12 of the 98 days, actual spend was within 5% of the proposed ₩309,411 a day. That gives you observed results near the budget you are considering. The fitted line rises, though. Expecting those extra installs at today’s average price would be optimistic.

How much might the extra installs actually cost? Over seven days, another ₩360,979 takes the campaign from 1,559 to 1,765 modeled installs. Dividing the added spend by the 206 added installs gives about ₩1,752 per extra install. This is the marginal cost per result (CPR) over the proposed increase. Here the result is an install. For a sign-up campaign, use additional sign-ups in the denominator to estimate marginal CPA. The new average CPI of ₩1,227 includes installs bought with the original budget, too. If you are deciding whether to approve the increase, ₩1,752 is the price to compare with what another install is worth.

## Retargeting got more expensive. Does the creative need replacing?

In the sample, retargeting spent roughly the same amount in both periods, but delivered 355 installs after delivering 430. Its observed cost per install rose from ₩3,109 to ₩3,785. Those are results you could reconcile with the campaign report. They answer a different question from the forecast of next week’s installs.

There are several ways for the campaign average to rise. The same ads can get more expensive. A relatively costly ad can account for a bigger share of installs even if its own CPI barely moves. Ads can also start or stop delivering. The cost breakdown separates these changes by examining each creative’s CPI and its share of installs.

Here the ₩676 increase comes from higher CPI on existing creatives. That gives the team a place to start. Check whether impressions cost more or a smaller share of clicks became installs before ordering replacement assets. Had the change come mostly from the mix, the first thing to investigate would have been which ads picked up delivery.

## When is it worth giving an ad another week?

A customer-review video in the example brought in 373 installs at ₩991 each. That tells you what it delivered over the period. To judge whether people are tiring of it, you would also want to see how its cost and volume change over time. The first date in your export can be later than the actual launch. Recording the launch or replacement date makes the next review more informative.

## What will help you judge the decision next week?

Suppose you approve a budget increase on Monday but the campaign only starts spending more on Friday. An end-of-week comparison alone could make a sensible change look ineffective. Use the change history to see when spend actually moved. An action record keeps your decision, its date and the planned review alongside that history. Compare delivery with what you intended before judging the forecast.

If rising acquisition cost is something you check every week, an alert can evaluate that condition each time you analyze a new CSV. Its filters can cover a different set of campaigns from the current view. The sample runs without saving records. Saving project alert conditions requires a signed-in Pro account and device storage.

## Bring the data at the level of the decision

For budget decisions, start with date, campaign ID or name, spend and installs or sign-ups. You can use channel when you have no campaign identifier. If the discussion might lead to replacing an ad, export one row per date, campaign and creative, including the creative ID. Keep campaign subtotals out of that file so you count the spend once. Impressions and clicks give you a way to investigate the next question if CPI moves.

If your next decision is a daily spending limit by country and channel, the [budget allocation walkthrough](/blog/budget-allocation-tool-guide) compares those limits with a minimum install target.

[Compare two plans with fictional campaign data](/tools/operations-planner?example=1)
