---
title: "Ad Machine Learning: Why CPA Spikes and How to Operate"
description: "Misread the learning phase and your budget leaks. Why CPA bounces, how changes affect evaluation, and why the early numbers mislead."
date: "2026-07-13"
slug: "ad-machine-learning"
keywords: "ad machine learning, learning phase, campaign learning, auto-bidding, campaign budget optimization, CBO, why CPA fluctuates during learning phase, when to leave a campaign alone, ad learning phase, learning phase reset, how automated bidding works"
tags: ["Automation", "Machine Learning"]
draft: false
faq:
  - q: "Should I avoid touching campaigns during learning?"
    a: "Large budget or bid changes may affect learning status; this does not mean all historical data is deleted. But an outright misconfiguration — the wrong conversion event, a mistyped region — is better fixed immediately. Protecting the learning phase while it trains on a wrong signal costs more."
  - q: "If CPA spikes, should I cut budget right away?"
    a: "Separate the cause first. Learning restarts, rising competition, creative fatigue, and broken conversion tracking each need a different response. Cutting budget on a tracking bug kills a healthy campaign."

reviewedAt: "2026-09-09"
reviewer: "Codex (AI-assisted editorial audit)"
updated: "2026-09-09"
---
"It's probably still in the learning phase" — half true, half dangerous. Misunderstand the learning phase and you make one of two mistakes: overreacting to the wild swings during learning, or waiting forever assuming "it'll get better once learning finishes." Both leak budget.

Today, let's really look at what ad machine learning is actually doing — when you should leave it alone, and when you should step in. This one's a bit long. Understand it, though, and it changes how you run accounts entirely.

## The algorithm is experimenting with "who to show this to"

First, what's actually happening during the learning phase.

A new ad set explores performance under its conditions; that does not mean the platform uses no previous learning. Who buys your product, what time of day gets the best response, which placement converts. So it **test-fires** — at this person, that person, this placement, that placement.

When a conversion comes in, it learns "ah, this kind of person buys." Once enough data piles up, it starts concentrating delivery on that pattern. Performance may stabilize, but improvement is not guaranteed.

Check completion criteria for the platform, goal and campaign type. A fixed event count is not a universal passing threshold or a guarantee of stable performance.

What matters is whether the signals are sufficient and valid. You need a sample to detect a pattern. Three conversions isn't enough to build a rule like "this kind of person buys." Could be coincidence. [A/B testing](/en/blog/ab-testing) also needs adequate samples, but statistical power and platform learning completion are different criteria. Machine or human, thin data means no judgment.

(Note: this threshold differs by platform and the policy changes over time. Check the official docs for whatever platform you're running on.)

## Numbers during learning aren't "real performance" yet

This is the first trap.


CPA bounces wildly during learning. Makes sense — exploration, reporting delay and sparse samples may all contribute. Some days it happens to hit people who were going to buy anyway and CPA looks great. Other days it fires at the wrong people and CPA looks terrible.

You should not make decisions based on these bouncing numbers. But that's not how human psychology works. CPA spikes for two days and your hand reaches for the dial — cut the budget, change the audience, swap the creative.

So what happens then?

## Major changes require time to reassess

Learning status can change depending on the type and size of an edit. Not every edit triggers a reset, and a status change does not mean historical data was erased. Compare change history with the actual console state.

So here's the loop: CPA looks bad because it's still learning → you touch it → learning resets → CPA looks bad again because it's learning again → you touch it again → repeat forever.

Repeated changes make comparisons harder; they do not prove that learning can never finish.


Layer a structural problem on top of this, and the vicious cycle completes itself.

Splitting ad sets can leave sparse signals per set. For illustration, a seven-day budget of ₩1M at CPA ₩10K implies 100 conversions: 10 each across ten equal sets, or 50 each across two. This assumes unchanged CPA and does not guarantee learning completion or improved performance.

Targeting too narrow. Too-narrow targeting gets in the way of learning. Fewer people to reach means conversions don't pile up, and signals may be sparse. The intuition that "narrower targeting = more precise" backfires here. This connects directly to what we covered in [broad vs. narrow targeting](/en/blog/audience-broad-vs-narrow).

Target conversion too rare. If purchases only happen twice a day, and you set "purchase" as the optimization goal, that's 14 in 7 days; check whether this is sufficient for the current strategy. One fix here is stepping the goal back one stage (add-to-cart instead of purchase) to gather enough data.

## So how long do you have to wait?

Does that mean "just wait no matter what"? Not quite — here's the second trap.

Using the learning phase as an excuse to wait indefinitely also wastes budget. If it's still bad after learning finishes, it's just bad.

Here's a simple way to set the bar.

**While learning** — avoid changing several settings because of short-term variation alone. Fix tracking errors, wrong regions and unaffordable spend promptly; evaluate performance against the planned window and conversion delay.

**Once learning finishes** — now you can judge. See how the stabilized CPA compares to your target, and if it's bad, that's when you touch it.

**If learning persists** — check signal volume, tracking, bid constraints, demand and structure. Consolidation, expansion or goal changes are options when the diagnosis and business objective support them.

## Being honest about this: don't assume "it's the learning phase" by default

Let me put a brake on here.

CPA is bad, and it happens to be in the learning phase. Is it because of learning? **Not necessarily.**

The creative could've been weak during that same window. The landing page could've been broken. Targeting could've been off. Being in learning means "**it's too early to judge**," not "it's guaranteed to get better if you wait." Those are completely different things.

In practice, plenty of ad sets finish learning and CPA is still bad. Check pricing, competition, measurement and conversion delay as well as creative and targeting.

So what to do during learning isn't "pray and wait" — it's "hold off on judgment, but prepare your next move." Line up more creative candidates, check the landing page. That way, if it's still bad once learning finishes, you can play your next card immediately.

## If you use auto-bidding, allocation gets touched too

One more thing worth knowing.

Turn on Campaign Budget Optimization (automatic allocation) and the algorithm shifts budget between ad sets on its own. Convenient, but it comes with a side effect. When overall CPA rises, it's hard to tell whether the channel got worse, or the algorithm just shifted budget into a pricier set.

This is the mix effect covered in [ad performance diagnosis](/blog/ad-performance-diagnosis). Even if each channel's own CPA stays flat, the blended average rises if the mix shifts. With automatic allocation on, this mix shifts regardless of your intent.

So even with auto-bidding, get in the habit of splitting any rise into mix effect versus efficiency effect. Leave it to "the algorithm will handle it" and you won't be able to explain why things got worse later.

## And don't take the algorithm's numbers at face value either

Last point, and the most important one.

Once learning finishes, the algorithm concentrates delivery on people it's judged "likely to convert." That's optimization. But here's the trap.

**People likely to convert** and **people who convert because of the ad** are different groups.

Someone who already decided to buy your product has a high conversion probability. From the algorithm's view, that's the ideal target — show them the ad, the conversion fires. But that person would have bought anyway, ad or no ad.

An attributed-conversion result alone does not establish incremental lift. Platform optimization methods can differ; check incrementality with an independent experiment.

So even a great CPA on a cleanly-trained campaign shouldn't be taken at face value. How much of it is real incrementality is something you have to measure separately with a [holdout experiment](/en/blog/incrementality-measurement). This is the ad-specific version of [not mixing up correlation and causation](/en/blog/correlation-vs-causation).

## Try this today

Count how many ad sets in your account haven't finished learning. Most platforms show this status.

If several sets are learning limited, check signal volume, tracking, bid constraints, demand and structure. Consolidation is an option to evaluate, not a rule that two or three sets will fix performance.

Set this rule: do not change several settings because of a short-term fluctuation alone. Fix tracking errors, wrong targeting and unaffordable spend during learning too.

## Wrap-up

Machine learning training is the algorithm's process of collecting a sample. No sample, no judgment — true for machines and humans alike.

So we have three jobs. Structure things so enough data accumulates for learning to finish. Don't touch it based on the bouncing numbers while it's learning. And even after learning finishes, question the good numbers the algorithm hands you at least once.

As the algorithm gets smarter, the marketer's job doesn't disappear. The kind of job changes. We'll pick that up in [what's left for marketers in the AI era](/en/blog/ai-era-marketer).
