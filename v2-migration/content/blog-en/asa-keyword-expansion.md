---
title: "ASA Keywords: When to Promote to Exact Match"
description: "Split the campaign that finds terms from the campaign that spends, and promote only terms that clear both volume and CPA."
date: "2026-07-18"
updated: "2026-08-17"
slug: "asa-keyword-expansion"
keywords: "Apple Search Ads, ASA keywords, ASA keyword expansion, exact match promotion, search terms report, CPT bidding, discovery campaign, negative keywords, apple search ads optimisation, ASA campaign structure"
tags: ["ASA", "UA"]
draft: false
faq:
  - q: "When should a search term be promoted to Exact?"
    a: "Only when it clears both conditions: enough conversions to judge on, and an actual CPA inside target. Meeting one alone is not enough, because a flattering CPA on two conversions is usually chance."
  - q: "Why did my CPT keep rising after I built an Exact campaign?"
    a: "Most often because the promoted term was never added as a negative in Discovery, so both campaigns bid on it at once. You end up raising your own bid against yourself."
  - q: "Should I turn Discovery off once promotion is done?"
    a: "No. Discovery is a continuous pipeline, not a one-off. Switch it off and no new candidates surface, so the Exact campaign stops growing and slowly decays as terms lose relevance."
  - q: "Why do brand keywords need a separate campaign?"
    a: "Brand terms produce unusually good CPAs because many of those users would have found the app anyway. Mixed in with generic terms, that efficiency lifts the blended average and hides how new-user acquisition is really performing."
---

Turning on Apple Search Ads for the first time is genuinely exciting. It is the only advertising that appears in App Store search results, and given how much of iOS app discovery runs through search, there is no reason not to run it.

So the usual first move: build one campaign, switch on Search Match, and also add the terms that look good into Exact. Two months later CPT is climbing and nothing obvious explains it.

The explanation is usually mundane and expensive — **two of your own campaigns are bidding on the same search term.** You are raising your own bid.

The short version:

> Separate **the campaign that finds** from **the campaign that spends**.
> And always add a promoted term as a negative in the campaign it came from.

## The two campaigns have completely different jobs

**Discovery** — this is where you find search terms. Open it wide with Search Match or broad match and watch which terms actually convert. The goal here is not efficiency, it is **candidate discovery**. A somewhat poor CPA is acceptable; this is research spend.

**Exact** — this holds only validated terms, on exact match. This is where the budget goes and where efficiency is managed.

Move terms that proved out in Discovery into Exact, and add each moved term as a negative back in Discovery. Skip that step and you get exactly the situation above: both campaigns bidding on one term, CPT rising.

One more thing: **keep Discovery running.** Switching it off once promotion is "done" means no new candidates ever surface. It is a pipeline, not a project.

## Promotion needs two conditions, together

When reading the search terms report, look at these two side by side.

**One: have enough conversions accumulated to judge?** One or two conversions can produce a flattering CPA purely by chance. A term showing $4 CPA on two conversions can easily settle at $30 once real volume runs through it — this is the single most common way a promotion disappoints.

**Two: does the actual CPA meet target?** Measured on those accumulated conversions, not on the two that looked good.

A term needs **both** to be a promotion candidate. Meeting one alone means not yet. Conversely, terms spending heavily with no conversions are negative-keyword candidates.

Feed the search terms report to [ASA keyword discovery](/tools/asa-keyword-finder) and it computes this verdict per term and exports the action list as CSV.

<!-- CONTENT_ACTION -->

## Read bids (CPT) alongside budget pacing

The most common mistake after promotion is adjusting on CPA alone. Two axes belong together.

| | Budget left over | Budget fully spent |
|---|---|---|
| **CPA under target** | Raise the bid — you could buy more and are not | Consider raising budget — the bottleneck is budget, not the bid |
| **CPA over target** | Re-examine the search term itself | Lower the bid |

The bottom-left cell is the confusing one. When CPA is poor *and* the budget is not being spent, neither raising nor lowering the bid produces an answer. That is not a bid problem — that term simply does not fit the app.

And without a target CPA this table does not function at all. Moving bids up and down arbitrarily leaves you with no way to read direction, so setting the target comes first.

## Brand terms need to be judged separately

Search terms containing your own brand name come back with overwhelmingly good CPAs. It feels great at first — "our ASA efficiency is incredible."

But a large share of those people **would have found the app without the ad.** By the time someone searches your brand name, they already know you.

Keeping brand terms in the same campaign as generic terms creates the illusion of a good overall CPA. Raise budget on that number and actual new installs do not move; you simply spend more on brand terms.

Split the campaign and evaluate it separately. When you want the real incremental figure, run an on/off comparison in [incrementality analysis](/tools/incrementality). If organic rises by roughly the amount paid conversions fell when the brand campaign is off, those users were coming anyway.

## Try this today

**One.** Export the term list in your Exact campaign and diff it against the Discovery negative list. Any overlap means you are competing with yourself right now. A first check commonly turns up ten or more.

**Two.** Check which campaign your brand-name terms currently sit in. If they share a campaign with generic terms, that campaign's CPA is reading better than reality today.

## Let's be honest

The promotion rule above narrows risk; it does not remove it. A term validated on 30 conversions can still behave differently at ten times the volume, because ASA is matching you to a different slice of searchers as spend grows. Promote in batches and re-check rather than moving the whole candidate list at once.

If the search terms report is too long to read by hand, upload it as is. Promotion, negative, and bid-adjustment candidates get split per term, and terms too thin to judge are honestly marked as withheld rather than given a verdict. Data is processed in your browser and never sent to a server.

ASA is the lowest-maintenance channel there is once the structure is right. Get the structure wrong and you quietly spend the budget bidding against yourself.
