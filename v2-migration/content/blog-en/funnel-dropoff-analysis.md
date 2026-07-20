---
title: "How to Find Where Your Conversion Funnel Leaks"
description: "How to find the biggest drop-off in the impression → click → install → signup → purchase funnel and set priorities."
date: "2026-07-15"
slug: "funnel-dropoff-analysis"
keywords: "funnel analysis, conversion funnel, funnel drop-off, conversion analysis, stage conversion rate, find leak points, improve conversion rate, CVR improvement, marketing funnel, drop-off analysis"
tags: ["Analysis", "Conversion Rate"]
draft: false
---

If you want to lift conversion rate but don't know where to start, draw the funnel first. **One biggest-leaking stage usually creates most of the loss.** Plugging that one first is the order.

## Read the funnel as pass-through rates by stage

An app marketing funnel usually goes:

Impression → Click → Install → Signup → Purchase

Look at the **pass-through rate (conversion) between each stage.** Absolute numbers alone hide everything under impressions (which is why you plot on a log scale). What matters is "what share moved from the prior stage."

For example:

- Impression → click 2% (CTR)
- Click → install 40%
- Install → signup 25%
- Signup → purchase 8%

What stands out here is **install → signup at 25%.** Of clickers, 40% install, but only 25% of those sign up — the other 75% install and just leave. That's likely your biggest leak.

## Not "the lowest stage" but "the most valuable stage"

There's a trap: the lowest pass-through stage isn't always priority one.

Don't start with impression → click at 2%. CTR is naturally low (normal). Judge by **improvement headroom × traffic volume.** Lift the pass-through even slightly at a stage many users have already reached, and the absolute conversion count jumps.

So a funnel needs both "stage conversion rate" and "absolute people passing through that stage" to yield priorities.

## Found the leak? — three checks when CVR won't rise

Finding the stage is where it really starts. Especially for post-click stages (landing, signup, purchase), run these three in order.

**1) Do the ad and landing page make the same promise?** If the ad says "50% off" and the landing page doesn't, the user thinks "misled?" and leaves. The ad's message and visuals have to carry into the landing page's first screen within three seconds (message match).

**2) How many frictions are there?** Too many form fields, a complex checkout, slow loading, long onboarding. Count the steps to conversion and cut where drop-off is biggest. Don't try to fix everything by gut.

**3) Did the right person even show up?** A low conversion rate may be the wrong users, not the landing page. Clickbait that forces CTR up drags in uninterested clicks and lowers conversion. No landing-page fix rescues that.

When you change things, verify with an [A/B test](/blog/ab-testing) — "this feels better" can't tell improvement from regression. And since chasing conversion rate alone can shrink volume, read it as **conversion rate × volume = conversions** and make the final call on [cost and revenue metrics](/blog/performance-marketing-metrics).

## Look at it over time, too

Read one snapshot of the funnel and you shrug "guess it's always been like this." Look at **which stage dropped sharply starting when** to catch causes. If signup conversion fell off last week, you can trace what changed then (a signup-flow change? a tracking issue?).

The [operations dashboard](/dashboard)'s funnel tab gives you stages by basis (install/signup), an absolute↔conversion toggle, time-series drop detection, and segment ranking via CSV upload or Google Sheet connection. Connect a Sheet to keep it fresh.

## Let's be honest

Funnel conversion shows **correlation**, not proven causation. Before declaring "the signup stage is low, so the signup flow is the problem," also suspect traffic quality (did the wrong target come in?).
