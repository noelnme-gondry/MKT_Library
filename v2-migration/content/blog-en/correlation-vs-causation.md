---
title: "Correlation vs. Causation: Confuse Them and You Lose Money"
description: "The difference between correlation and causation, explained through ice cream and drowning. Why confounders and reverse causation create illusions, and why an experiment is the only way to confirm causation."
date: "2026-07-09"
slug: "correlation-vs-causation"
keywords: "correlation, causation, correlation vs causation, confounder, reverse causation, spurious correlation, marketing analysis, experimentation"
tags: ["Analysis Methodology", "Performance Marketing"]
draft: false
---

# Correlation vs. Causation: Confuse Them and You Lose Money

On days when ice cream sales are high, drowning accidents also go up. Does ice cream cause drowning? Of course not. There's a separate cause — both are driven by 'summer.'

That's the kind of illusion you get when you confuse correlation with causation. The example is extreme, but in real life we make plenty of milder versions of the same mistake. In marketing, this mistake costs real money — it sends budget to the wrong channel, or kills a perfectly healthy campaign. Today, let's draw a clear line between the two.

## Correlation and causation, in one line each

Simply put: correlation means "they move together," causation means "one produces the other."

![Two line charts of ice cream sales and drowning accidents, both spiking together in summer and falling together in winter over a year. They move identically, but neither causes the other.](/blog-assets-en/correlation-vs-causation/spurious-correlation.svg)

Ice cream sales and drownings move in lockstep on a chart — the correlation is very high. But one doesn't produce the other. High correlation doesn't mean causation.

## Why we keep confusing them — the confounder

The most common reason is a "hidden third cause." This is called a confounder — a hidden variable lurking behind the scenes that moves two things at once.

![A diagram showing that the hidden variable of temperature (summer) is the true cause of both ice cream sales and drowning accidents, making the link between ice cream and drowning a spurious correlation.](/blog-assets-en/correlation-vs-causation/confounder-diagram.svg)

The real cause behind ice cream and drowning is temperature. When summer arrives, ice cream sells more, and more people go swimming, so drownings rise too. Makes sense, right? But the connection between those two outcomes is a "spurious correlation."

Marketing has the exact same trap. Say you increase ad spend during a sale period and revenue goes up too. Did the ad drive that revenue, or did the sale? Here, "the sale" is the confounder. Ad effect and sale effect get tangled together — a perfect setup for mistaking one for the other.

One more thing: sometimes the direction is reversed. Seeing "loyal customers open a lot of emails" and flipping it into "sending a lot of emails makes people loyal customers" is a mistake — they might just be opening those emails because they were already loyal customers (reverse causation). Reverse causation. Simple enough once you say it out loud? Situations where correlation looks like causation happen constantly in business — and it's easy to fall into that trap.

## So how do you actually confirm causation?

There's exactly one way. As always, the answer is an experiment. Hold every other condition constant, change exactly one thing, and compare. Randomly split into two groups and act on only one of them, and confounders get spread evenly across both groups, canceling out their influence. That lets you attribute the remaining difference to "thanks to that action." (In practice, this is what an [A/B test](/en/blog/ab-testing) confirms.)

Observational data alone generally can't get you here. No matter how high the correlation, you can't claim "this is because of that." So mature analysis uses observation to find "association" and set direction, and reserves confirmation for experiments.

- The story of using experiments to isolate an ad's true effect is covered in detail in the [incrementality measurement post](/en/blog/incrementality-measurement).
- The reason we estimate channel contribution from observational data but only ever claim "association" is explained in the [marketing mix modeling post](/en/blog/marketing-mix-modeling).

## Try this today

Next time you spot "A and B are moving together" in a report, ask yourself one thing before you draw a conclusion: **"Is there a third reason driving both of these?"** Think season, promotions, price changes, major events — even a budget increase in another channel or a shift in a competitor's activity. And before you write "it's because of this" in Slack, ask one more time: **"Have I confirmed this with an experiment?"** Make a habit of just these two questions, and you'll filter out a surprising amount of costly illusion.

## Wrap-up

To recap: correlation is moving together, causation is producing an outcome. The confusion is usually caused by a hidden confounder, and confirming causation requires an experiment.

The free tool we've built follows this same principle. It never labels a result from observational data as "causation" — it honestly shows it as "association," and guides you to confirm with a holdout experiment when confirmation is needed. If the data isn't enough, it says so honestly: "cannot be estimated."

Distinguishing clearly between what you know and what you don't leads to better decisions than inflating numbers to look impressive. And in a business setting, admitting you don't know actually reads as more competent than being confidently wrong.
