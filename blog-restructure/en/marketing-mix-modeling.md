---
title: "When Last-Click Only Praises Brand Search — Measuring Channel Contribution with MMM"
description: "Last-click credits whichever channel stood last in line — which is why brand search ROAS always looks heroic. How MMM back-calculates each channel's real contribution from aggregate data (regression, adstock, saturation), and where its limits are."
date: "2026-07-09"
slug: "marketing-mix-modeling"
keywords: "marketing mix modeling, MMM, adstock, saturation, contribution decomposition, cannibalization, multicollinearity, marketing forecasting, MMM vs attribution, post-iOS14 measurement, what is MMM, marketing mix modeling explained, last-click attribution limits, brand search ROAS"
tags: ["MMM", "Performance Marketing"]
draft: false
---

# When Last-Click Only Praises Brand Search — Measuring Channel Contribution with MMM

Ever raised budget on brand search because its ROAS looked outstanding — and watched total revenue stay flat? Last-click praises only the channel that stood **last** in the journey; the credit earned by channels that created the demand upstream all flows to the final click. When one person sees dozens of ads across channels in a single day, judging performance with last-touch attribution alone stops making sense. And multi-touch attribution never quite delivers a clear answer either.

That's why Marketing Mix Modeling (MMM) is having a resurgence. Today I'll lay out plainly what it is, what it answers, and how far you should trust it. Oh, and I'll also show you how to actually do it.

## MMM "reverse-engineers" the outcome you're aiming for

MMM doesn't track individuals. Instead, it works backward from the big picture.

Put simply, MMM takes "how much did we spend on each channel per week over the last year, and what was revenue each of those weeks?" and uses a statistical model to estimate **revenue = baseline + channel A contribution + channel B contribution + external factors**. The tool it uses here is regression (a statistical method for finding an equation that explains an outcome through multiple causes). It pulls out each cause's "share" as a number. Put even more simply: it's statistically slicing up the whole "outcome" cake you defined, showing how much each ingredient contributed.

![A stacked bar chart showing MMM splitting a month of revenue into 55% baseline, 18% search, 15% social, and 12% display.](/blog-assets-en/marketing-mix-modeling/contribution-decomposition.svg)

In this example, the outcome is set to "revenue." That's how it slices revenue up. Here, baseline is the share that would show up even without any advertising (brand awareness, organic traffic, repurchases, and the like) — the same baseline concept discussed in the [incrementality measurement post](/en/blog/incrementality-measurement). MMM draws that out across every channel at once.

The data you need is your "outcome" data plus each channel's spend and impression volume — since it doesn't rely on individual-level data, it's privacy-safe and unaffected by cookie loss or iOS tracking limits. And because it doesn't hand credit to the last touch, it lets you see how much your actual budget spend impacted the business, rather than overweighting whichever touchpoint happened to come last. That's why MMM is back in the spotlight these days.

## Two things you absolutely have to get right

Just running a naive regression of outcome on spend will give you the wrong answer. Advertising has two tricky properties.

### Adstock — ad effects don't end in a day

An ad you saw today doesn't only produce its effect today. It can lead to a purchase days, or even weeks, later. This carryover effect is called **adstock** (the effect that lingers after you turn the ad off).

![A bar chart showing that running an ad once (day 0) produces an effect that carries over and shrinks across day 1, day 2, and day 3.](/blog-assets-en/marketing-mix-modeling/adstock.svg)

Ignore this, and you'll attribute delayed conversions to the wrong moment and the wrong channel — distorting contribution.

### Saturation — the more budget you pour in, the less efficient it gets

Nearly every channel sees its marginal conversion growth slow down as you increase spend (diminishing returns). MMM estimates this saturation curve to answer "can this channel take more budget?" It's the same principle as the response curve covered in the [marketing budget allocation post](/en/blog/marketing-budget-allocation) — MMM just estimates that curve for every channel at once.

## So what does MMM actually tell you?

To sum up, it answers three things.

**One, each channel's true contribution.** It redistributes credit that last-click hands to brand search, retargeting, or even click-injection ads, aligning it with actual contribution.

**Two, next month's forecast.** It projects roughly how much revenue you'd generate if you kept the current allocation. This comes from the nature of regression — once you have the fitted coefficients, forecasting follows naturally.

![A line chart showing MMM's forecast extending from actual past revenue into the future, with uncertainty shown as a 95% confidence band that widens to the right rather than a single point estimate.](/blog-assets-en/marketing-mix-modeling/forecast-band.svg)

What matters here is that it shouldn't claim "next month will be exactly $100k" as a single point. It shows uncertainty as a band — "somewhere in this range, with 95% probability." That's an honest forecast. Nothing in statistics is 100% certain.

**Three, cannibalization diagnosis.** It checks whether channels (or, depending on your unit of analysis, campaigns) are stealing from each other. A common example: brand search ads eating organic traffic that would have come in for free anyway.

## How far should you trust it — MMM's limits

This is the most important part. Because MMM runs on observational data, what comes out is an "association" estimate. It can say "this channel is associated with revenue by this much" — it can't nail down "this channel created this much revenue."

There are traps too. The classic one is multicollinearity (when several channels are always scaled up and down together, the model struggles to tell whose contribution is whose). Short data windows make this worse. In practice, marketers often bundle several actions into the same day or week, which makes it hard to tell which action actually moved the needle.

So the principle is this: use MMM to set overall direction, and confirm actual results through experiments. If MMM says "social's contribution is bigger than expected," you test that by scaling up spend and checking the result. Conversely, if it says "this channel looks like it's cannibalizing," you run a holdout test. (Holdouts are covered in detail in the [incrementality measurement post](/en/blog/incrementality-measurement).) Think of experiments and MMM as a pair, not competitors.

## Try this today

MMM needs data before it needs a model. Today's task is "gathering ingredients." Collect the following into one sheet, weekly:

- Ad spend by channel (weekly)
- Revenue (weekly)
- External factors (promotions, seasonality, price changes, major events)

We recommend at least a year (52 weeks) of data — you need to see a full seasonal cycle to separate seasonal effects from ad effects. With this sheet alone, you're 80% of the way to running MMM. Why only 80%? Because I've already handled the hard R/Python part for you. ([MMM analysis](/tools/marketing-response))

## Wrap-up

To recap: MMM doesn't track individuals — it reverse-engineers total outcome into "baseline + channel contribution." Getting adstock and per-channel saturation right is what makes the measurement sound, and the result is a compass pointing you in a direction, not a final verdict.

Calculating this regression, adstock, saturation, and confidence band by hand is a hassle, on top of an already-annoying data prep step. So if you have weekly data, you can run all of it at once in the [MMM analysis tab](/tools/marketing-response) mentioned above. Uploaded data is processed entirely in your browser and never leaves it. (User privacy matters these days, doesn't it!)

And don't forget: MMM is the compass, experiments are the confirmation. Use both together, and you move budget based on evidence instead of gut feel. (And statistics and math are, honestly, the most powerful weapon you have for persuasion!)
