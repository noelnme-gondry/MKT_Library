---
title: "Ad Machine Learning: Why CPA Spikes and How to Operate"
description: "Misread the learning phase and your budget leaks. Why CPA bounces, why touching a campaign resets it, and why the early numbers mislead."
date: "2026-07-13"
slug: "ad-machine-learning"
keywords: "ad machine learning, learning phase, campaign learning, auto-bidding, campaign budget optimization, CBO, why CPA fluctuates during learning phase, when to leave a campaign alone, ad learning phase, learning phase reset, how automated bidding works"
tags: ["Automation", "Machine Learning"]
draft: false
---

"It's probably still in the learning phase" — half true, half dangerous. Misunderstand the learning phase and you make one of two mistakes: overreacting to the wild swings during learning, or waiting forever assuming "it'll get better once learning finishes." Both leak budget.

Today, let's really look at what ad machine learning is actually doing — when you should leave it alone, and when you should step in. This one's a bit long. Understand it, though, and it changes how you run accounts entirely.

## The algorithm is experimenting with "who to show this to"

First, what's actually happening during the learning phase.

When you turn on a new ad set, the algorithm knows nothing. Who buys your product, what time of day gets the best response, which placement converts. So it **test-fires** — at this person, that person, this placement, that placement.

When a conversion comes in, it learns "ah, this kind of person buys." Once enough data piles up, it starts concentrating delivery on that pattern. That's when performance stabilizes.

Meta sets the condition for finishing this learning at "50 optimization events within 7 days." If a target conversion hits 50 within 7 days of an ad set being newly published or edited, learning is considered complete. Miss that threshold and you stay in "learning limited" status.

What matters isn't the number itself — it's **why 50.** You need a sample to detect a pattern. Three conversions isn't enough to build a rule like "this kind of person buys." Could be coincidence. This is exactly the same principle as sample size in [A/B testing](/en/blog/ab-testing). Machine or human, thin data means no judgment.

(Note: this threshold differs by platform and the policy changes over time. Check the official docs for whatever platform you're running on.)

## Numbers during learning aren't "real performance" yet

This is the first trap.

![A graph of CPA over time across the learning and learning-complete phases. During learning, CPA swings wildly with repeated "ooh nice!" and "oh no!" moments; once it hits 50 conversions and learning finishes, CPA converges to a stable line.](/blog-assets-en/ad-machine-learning/learning-phase-timeline.svg)

CPA bounces wildly during learning. Makes sense — the algorithm is still firing at random. Some days it happens to hit people who were going to buy anyway and CPA looks great. Other days it fires at the wrong people and CPA looks terrible.

**You should not make decisions based on these bouncing numbers.** But that's not how human psychology works. CPA spikes for two days and your hand reaches for the dial — cut the budget, change the audience, swap the creative.

So what happens then?

## The moment you touch it, learning resets

This is the core of it. Change the ad title, audience, budget, or optimization goal, and learning resets. All the learning data collected so far is wiped, and it starts over from scratch.

So here's the loop: CPA looks bad because it's still learning → you touch it → learning resets → CPA looks bad again because it's learning again → you touch it again → repeat forever.

**Learning never finishes.** And that account never gets to see the algorithm's actual performance.

![A circular diagram of the loop where learning never finishes. Targeting too narrow or budget split too thin across ad sets, leading to conversions falling short of 50, leading to being stuck in "learning limited" status, leading to efficiency looking bad so you tweak it again, leading to learning resetting, and back to the start. The way out: merge ad sets, widen the targeting, and just leave it alone.](/blog-assets-en/ad-machine-learning/learning-reset-loop.svg)

Layer a structural problem on top of this, and the vicious cycle completes itself.

**Ad sets split too thin.** Say you split a ₩1M budget across 10 ad sets, ₩100K each. Each set needs to hit 50 conversions within 7 days — is a ₩100K set going to produce 50? No. **All ten stay stuck in learning limited, forever.** Consolidate into 2 sets at ₩500K each instead, and both finish learning.

**Targeting too narrow.** Too-narrow targeting gets in the way of learning. Fewer people to reach means conversions don't pile up, and you never hit 50. The intuition that "narrower targeting = more precise" backfires here. This connects directly to what we covered in [broad vs. narrow targeting](/en/blog/audience-broad-vs-narrow).

**Target conversion too rare.** If purchases only happen twice a day, and you set "purchase" as the optimization goal, that's 14 in 7 days — nowhere near 50. One fix here is stepping the goal back one stage (add-to-cart instead of purchase) to gather enough data.

## So how long do you have to wait?

Does that mean "just wait no matter what"? Not quite — here's the second trap.

Using the learning phase as an excuse to wait indefinitely also wastes budget. **If it's still bad after learning finishes, it's just bad.**

Here's a simple way to set the bar.

**While it's learning** — don't touch it. At least not until learning finishes, unless it's genuinely bleeding money badly. And "badly" here means spend running away at a rate you truly can't afford — not just CPA bouncing for a day or two.

**Once learning finishes** — now you can judge. See how the stabilized CPA compares to your target, and if it's bad, that's when you touch it.

**If learning never finishes** — this isn't a patience problem anymore, it's a **structural** one. Consolidate sets, widen targeting, or change the target conversion. It won't resolve itself just by waiting.

## Being honest about this: don't assume "it's the learning phase" by default

Let me put a brake on here.

CPA is bad, and it happens to be in the learning phase. Is it because of learning? **Not necessarily.**

The creative could've been weak during that same window. The landing page could've been broken. Targeting could've been off. Being in learning means "**it's too early to judge**," not "**it's guaranteed to get better if you wait.**" Those are completely different things.

In practice, plenty of ad sets finish learning and CPA is still bad. In that case, the creative or targeting was the problem from the start — the learning phase just delayed the diagnosis.

So what to do during learning isn't "pray and wait" — it's "**hold off on judgment, but prepare your next move.**" Line up more creative candidates, check the landing page. That way, if it's still bad once learning finishes, you can play your next card immediately.

## If you use auto-bidding, allocation gets touched too

One more thing worth knowing.

Turn on Campaign Budget Optimization (automatic allocation) and the algorithm shifts budget between ad sets on its own. Convenient, but it comes with a side effect. **When overall CPA rises, it's hard to tell whether the channel got worse, or the algorithm just shifted budget into a pricier set.**

This is the mix effect covered in [ad performance diagnosis](/blog/ad-performance-diagnosis). Even if each channel's own CPA stays flat, the blended average rises if the mix shifts. With automatic allocation on, this mix shifts **regardless of your intent.**

So even with auto-bidding, get in the habit of splitting any rise into mix effect versus efficiency effect. Leave it to "the algorithm will handle it" and you won't be able to explain why things got worse later.

## And don't take the algorithm's numbers at face value either

Last point, and the most important one.

Once learning finishes, the algorithm concentrates delivery on people it's judged "likely to convert." That's optimization. But here's the trap.

**People likely to convert** and **people who convert because of the ad** are different groups.

Someone who already decided to buy your product has a high conversion probability. From the algorithm's view, that's the ideal target — show them the ad, the conversion fires. **But that person would have bought anyway, ad or no ad.**

The algorithm doesn't make this distinction. It was never designed to. It's optimized for "find people likely to convert," not "maximize the incremental lift the ad actually created."

So even a great CPA on a cleanly-trained campaign shouldn't be taken at face value. How much of it is real incrementality is something you have to measure separately with a [holdout experiment](/en/blog/incrementality-measurement). This is the ad-specific version of [not mixing up correlation and causation](/en/blog/correlation-vs-causation).

## Try this today

Count how many ad sets in your account **haven't finished learning.** Most platforms show this status.

If several are stuck in learning limited, that's not an individual ad set problem — it's an **account structure problem.** You've split things too thin. Try merging into two or three sets. Once budget consolidates, learning finishes — and only once it finishes do you actually see that set's real performance.

And set one rule: **"Don't touch it while it's learning."** That single rule stabilizes an account.

## Wrap-up

Machine learning training is the algorithm's process of collecting a sample. No sample, no judgment — true for machines and humans alike.

So we have three jobs. Structure things so enough data accumulates for learning to finish. Don't touch it based on the bouncing numbers while it's learning. And even after learning finishes, question the good numbers the algorithm hands you at least once.

As the algorithm gets smarter, the marketer's job doesn't disappear. **The kind of job changes.** We'll pick that up in [what's left for marketers in the AI era](/en/blog/ai-era-marketer).
