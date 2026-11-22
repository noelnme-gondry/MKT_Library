---
title: "How to compare budget allocations when efficiency and volume compete"
description: "Estimate how a daily budget split changes installs and unit cost across countries, channels and operating systems."
date: "2026-11-22"
slug: "budget-allocation-tool-guide"
primaryTool: "5-3"
tags: ["Budget & efficiency"]
faq:
  - q: "Why compare modeled installs on both sides?"
    a: "Using the same model for both budgets keeps any existing forecast error at the current budget out of the estimated gain. Observed installs are useful for checking the fit."
  - q: "What if the cheaper plan misses the install target?"
    a: "Set the minimum daily installs and the spending ceiling first. If the plan falls short, reconsider the split or the spending limit before adopting it."
---

Your team needs to reduce daily spend without dropping below 26,400 installs a day. A proposed budget brings cost per install down from ₩1,576 to ₩1,541. Would you approve it?

In the example, the smaller budget buys an estimated 26,220 installs a day, down from 26,429. Each install is cheaper, but you would miss the target. If the brief were simply to cut costs, you might accept exactly the same plan. This is why it helps to bring a volume target as well as a spending ceiling to a budget discussion.

![Against a target of 26,400 daily installs, the current plan is 29 above target at 26,429. The proposed plan is 180 below target at 26,220.](/blog-assets-en/budget-allocation-tool-guide/installs-vs-goal.svg)

| Per day | Current plan | Proposed plan |
| --- | ---: | ---: |
| Total budget | ₩41,644,748 | ₩40,392,705 |
| Modeled cost per install | ₩1,576 | ₩1,541 |

## Where could the remaining money buy more installs?

A channel total can hide the choice you actually face. Google on iOS in the US may have room to grow while the same channel in a different market is already expensive to expand. Budget allocation uses the spending and outcome history for each country, channel and operating-system combination. Its response curve estimates how many installs a particular daily spend could deliver there.

Imagine two markets with similar average CPI. In one, install volume has kept growing when you spend more. In the other, spend has risen several times for very little extra volume. Their average results may earn them similar shares under the default stable-efficiency rule. The marginal allocation rule gives the next increment of budget to the place where the model expects it to buy the most additional installs. Comparing the splits shows where the choice of rule would actually change tomorrow’s spending.

## Which number should you subtract to estimate the gain?

Consider US Google UAC on iOS. This group actually delivered 2,366 installs a day. At its current spend, the model estimates 2,371. With the proposed increase, it estimates 2,549.

The expected gain from the budget change is **178 installs a day**. Subtracting 2,366 from 2,549 would also count the five installs by which the model misses at the starting budget. Comparing both plans with the same model keeps that error out of your decision. One market can gain those 178 installs even while the account total falls, because the cuts elsewhere can cost more volume than this market gains.

For this US iOS group, daily spend rises from ₩3,285,150 to ₩3,638,578. That is another ₩353,428 for 178 more modeled installs, or **about ₩1,986 per extra install across this increase**. The **marginal CPR** column starts at the proposed budget and models a **further 10% increase**. It divides that additional spend by the additional modeled installs. That gives about ₩1,427 in this row. The ₩1,986 and ₩1,427 estimates price different spending intervals. If modeled installs do not rise with spend, the table shows a dash.

## How much of the proposal could you try tomorrow?

Look at the historical spending range around the proposed amount. If you regularly spent close to it, the curve has observations nearby. If you have never come close, the next install could cost considerably more than the forecast suggests. Average CPI tells you what all the installs cost together. Marginal CPI helps you judge the cost of expanding from this particular spending level.

The next-step plan limits how far daily spend can change at once. Use it to size a first move you can actually deliver. Afterward, check whether the market spent the intended amount and how many installs came in before extending the change. If the modeled total already falls below your volume floor, revisit the split or the spending ceiling before testing it.

## Prepare a file that preserves the choices you control

Export dated actual spend and outcomes, with country, channel and OS for the splits you manage. Keep the currency, reporting period and outcome definition consistent. A row of purchases cannot stand in for a row of installs in a CPI comparison. If country rows add up to your channel total, leave the subtotal out so the same spend is counted once.

Use this tool when the decision is how to distribute a daily budget across markets and channels. If the question turns into why a particular retargeting campaign became more expensive or whether a creative should be replaced, the Operations planner works at that finer level.

[See how the example allocation changes both installs and CPI](/tools/budget-allocation?example=1)
