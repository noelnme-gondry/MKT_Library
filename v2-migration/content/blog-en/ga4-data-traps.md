---
title: "Why Your GA4 Numbers Look Wrong (They're Not Broken — Just Counted Differently)"
description: "GA4 sessions run lower than UA and yesterday's conversions keep changing — not bugs, but session definitions, processing lag, thresholds, and attribution."
date: "2026-07-17"
slug: "ga4-data-traps"
keywords: "GA4, GA4 sessions, GA4 conversion count changing, data threshold, processing lag, attribution, unassigned traffic, UA vs GA4, Reporting Identity"
tags: ["Analytics Methodology", "Performance Marketing"]
draft: false
---

You pulled last week's conversions Monday, check again Wednesday, and the number went up. Sessions are lower than what you remember from UA. The channel report has a pile of "unassigned." If you've ever wondered whether you can trust GA4's numbers, you're not alone. The short answer: GA4 isn't broken. It just counts differently. Here are the four traps that trip people up most, plus the ground rules that actually hold up.

## It's not "wrong" — it's "counted differently"

The most common mistake is reading GA4 through a UA or ad-platform lens and concluding "the data is broken." People then start poking at settings and genuinely break something. Without understanding the definitions, you'll misjudge perfectly healthy data. So before you suspect your setup, learn where GA4 counts things differently in the first place.

## Trap 1. Sessions are naturally lower than UA

UA cut a new session at midnight. It also cut a new session whenever the traffic source changed. GA4 does neither. Its rule is essentially just one thing: 30 minutes of inactivity.

Say someone clicks an ad at 11:50 PM, then comes back via search at 12:10 AM — past midnight. UA counted that as 3 sessions. GA4 counts it as 1, because there was never a gap longer than 30 minutes.

![Difference between UA and GA4 session definitions](/blog-assets-en/ga4-data-traps/session-definition.svg)

So GA4 showing fewer sessions than UA is, in most cases, a definition difference — not data loss. The problem cascades from there: with a smaller denominator, metrics like conversion rate per session can look artificially better. The fix is simple — don't compare absolute session counts against other tools or your old UA numbers. Compare only within GA4, period over period.

## Trap 2. Yesterday's number isn't final yet

GA4 takes time to process data — up to 72 hours in some cases. Conversion events backfill over several days, so "Sunday's conversions" pulled Monday morning can differ from the same query run again on Thursday.

![Same date's conversion count shifting over three days](/blog-assets-en/ga4-data-traps/delayed-data.svg)

If you drop yesterday's raw number into a Monday morning report, you'll get "why is this different from what you told me" a few days later. That's a trust problem, not a data problem. The fix is deciding on a finalization point in advance: treat daily numbers as trend indicators only, and finalize/report after about three days. Tell the team upfront — "these numbers are considered final at D+3" — and the follow-up questions disappear.

## Trap 3. Thresholds hide entire rows

If you've ever sliced an Explore report finer and watched rows vanish while totals stop adding up, you've hit this. On properties with Google Signals enabled, GA4 simply won't show data for low-user-count segments, citing potential re-identification. That's the data threshold.

The narrower you slice a segment, and the lower-traffic a campaign is, the more likely it gets thresholded. That's why detail-view totals don't match summary-view totals. One fix: switch Reporting Identity to "device-based" in admin settings, which reduces threshold application. This trades off against remarketing audience use, so consider switching only when you're analyzing.

## Trap 4. Channel attribution rules differ from ad platforms

GA4's default attribution is a data-driven model that's fundamentally click-based. Ad platform dashboards count by their own rules, including view-through. On top of that, missing UTMs or parameters lost during redirects push traffic into direct or unassigned. If "unassigned" suddenly spikes, suspect a tagging leak before assuming the channel mix actually shifted.

So ad-platform numbers and GA4 numbers were never going to match in the first place. We covered why they diverge and which number to anchor on in a separate post → [When ad platform, MMP, and GA numbers all disagree](/blog/attribution-data-mismatch)

## Three ground rules you can actually trust

First, set a finalization point per metric. For conversions, treat D+3 and later as final.

Second, never compare absolute session/user counts across tools. Only compare trends within the same tool.

Third, if numbers don't match across screens, suspect thresholds and processing lag before blaming your setup. Those two cover most cases.

One more thing — a genuinely sudden number swing is a separate issue. That's not a definition difference; it could be creative fatigue, competitive bidding, or an actual tracking failure. In that case, work through the [diagnosis order for a sudden performance drop](/blog/ad-performance-drop).

## Do this today

Just two things. Check what your property's Reporting Identity is set to in admin settings. And add one line to your team docs: "conversion numbers are final at D+3." The second one matters more than it sounds — the real problem was never that numbers change, it's that nobody knew they would.

One last note: GA4 is a tool for recording "what happened." Keep using it for that. But "where should we put budget, and by how much" or "what's this channel's real contribution" are questions GA4 was never built to answer. When you need that calculation, drop your GA4 export or ad platform CSV into our [free analysis tool](https://mktlibrary.up.railway.app). Everything runs in your browser and nothing goes to a server, so uploading revenue numbers isn't a concern.
