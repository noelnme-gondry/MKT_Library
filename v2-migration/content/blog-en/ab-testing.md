---
title: "A/B Testing: Ruling Out Chance Before You Call the Winner"
description: "A/B testing done right — from random assignment, sample size, and statistical significance, to the early-stopping (peeking) trap that catches nine out of ten people. A practical guide."
date: "2026-07-09"
slug: "ab-testing"
keywords: "A/B testing, AB test, statistical significance, statistical power, sample size, early stopping, peeking, conversion rate optimization, CRO, landing page experiment"
tags: ["Experiment Analysis", "Performance Marketing"]
draft: false
---

# A/B Testing: Ruling Out Chance Before You Call the Winner

Have you ever looked at landing page variant A against variant B and decided "hmm… B looks a bit better?" Run it for a few days, pick whichever has the higher conversion rate. But that could just be chance.

A/B testing is exactly the method for turning that "feeling" into a "number." Today let's look at how to run one properly, and one trap that catches nine out of ten people. By the end, you'll be a lot more careful about saying "this beat that."

## Run it carelessly, and you'll mistake luck for skill

Let's start with the common mistake. Say you're trying to test creatives — you split creatives into one campaign and launch it. About three days in, B is pulling ahead of A. To save money, you quickly lock in B and end the test.

Sound familiar? Even stretching it to a week wouldn't change much. The real problem here is that conversion rate fluctuates by chance when the sample is small. Flip a coin ten times, and you might get heads seven times — that doesn't mean "this coin is good at landing heads."

Doing A/B testing properly means ruling out that chance and determining whether there's a "real" difference.

## Here's what an A/B test looks like

The structure is simple. Randomly split your subjects roughly in half, show one half variant A and the other variant B, and compare conversion rate (or an absolute count).

![An A/B test structure diagram splitting visitor traffic randomly 50/50 between variant A (4.2% conversion rate) and variant B (4.8% conversion rate) for comparison.](/blog-assets/ab-testing/ab-test-structure.svg)

"Random" is the key word here. Randomize the split, and the two groups differ only in which screen they see — every other condition is equal. That lets you attribute the conversion rate difference to "thanks to the screen difference." (This is the same logic as the holdout in the [incrementality measurement post](/en/blog/incrementality-measurement) — you're just changing the screen instead of the ad.)

## Two rules to follow

### One: decide your required sample size before you start

Catching a small difference requires a larger sample. This is called statistical power — the probability of catching a real difference when one actually exists. The rule is to decide up front, before turning the test on, how many people (or how many weeks) you'll collect. That way you avoid the temptation to stop the moment it "looks like it's winning enough."

### Two: call it based on significance

Significance is, simply put, "how unlikely is it that this difference is just chance." "Statistically significant" means "hard to explain away as chance." Instead of eyeballing 4.2% vs. 4.8%, the real test is whether that gap falls outside the range chance alone could produce.

## The most common trap — early stopping (peeking)

This is the trap that catches the most people. You keep peeking at results mid-experiment, and the moment B pulls ahead, you go "got it!" and stop.

![A chart showing the conversion rate gap between B and A in an A/B experiment swinging wildly early on, before converging over 14 days to the true difference of 0.4 percentage points. It's marked to show that stopping on day 3 would have looked like a decisive win for B.](/blog-assets/ab-testing/peeking-trap.svg)

As the chart shows, the gap swings wildly up and down early on. Stop on day 3, and you'd mistake it for "a landslide win for B" — but leave it running a few more days, and it converges to the real difference (here, +0.4 percentage points). That's why it's safer not to look at results until your planned sample is fully collected.

A few other common traps worth a quick mention: laying out multiple metrics and cherry-picking whichever one happens to be "winning" (one of them is bound to win by chance), and traffic being too low to reach a verdict in the first place.

## Try this today

Pick just one thing to test this week. Before you turn it on, write down exactly two things: (1) a single metric that defines success, and (2) how long you'll collect data for (sample size or time window). Then don't look at results until that window ends. Those three lines are 80% of A/B testing.

## Wrap-up

To recap: A/B testing turns a "feeling" into a "number." Randomize the split, decide your sample size up front, judge by significance, and don't peek in the middle.

If running a z-test or power calculation by hand every time is a hassle, upload your results CSV to our free [A/B experiment analysis](/tools/experiment-analysis) tool. It tells you whether the result is statistically significant, and whether your sample was even large enough to tell. Data is processed entirely in your browser and never leaves it.

One last thing: not reaching significance doesn't mean "B is the same as A." It can mean "we haven't seen enough to be sure yet." In that case, collecting more sample — or simply holding judgment — is often the right call.
