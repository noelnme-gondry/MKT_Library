---
title: "SKAN Conversion Value Schema: What Fits in 64 Slots"
description: "How to decide which behavior goes into six bits, and the design mistakes that leave half the slots empty."
date: "2026-08-18"
updated: "2026-09-09"
slug: "skan-conversion-value-schema"
keywords: "SKAN conversion value, conversions skan, conversion value schema, fine conversion value, coarse value, skan optimization, conversion value mapping"
tags: ["Measurement", "iOS"]
draft: false
faq:
  - q: "Should I use all 64 conversion-value slots?"
    a: "No. Slicing finer shrinks the install volume behind each slot and raises noise. If many slots are empty, check behavior distribution, missingness and return conditions before considering consolidation."
  - q: "How do I encode revenue into a conversion value?"
    a: "Revenue is continuous, so it has to be bucketed, and tight buckets exhaust 64 slots quickly. Split only the few bands where the number actually changes a decision."
  - q: "Can I change the conversion-value mapping later?"
    a: "The moment you do, data before and after mean different things and trend comparison breaks. If you must change it, record the date and never blend the two periods."
  - q: "Does the ad platform learn from the conversion value?"
    a: "Yes, which is why a design mistake becomes an optimization problem. Feed it a bad signal and the algorithm works hard to bring you the wrong users."
reviewedAt: "2026-09-09"
reviewer: "Codex (AI-assisted editorial audit)"
---
SKAN 4 may return up to three window postbacks, with fine values available only in the first. The encoded signal is the [conversion value](/glossary/conversion-value). Deciding what goes into that narrow slot is the part of iOS measurement that takes the most actual work.

## 64 slots is smaller than it sounds

The fine value is six bits — 0 to 63, so 64 slots. That looks generous at first.

Then you list what you want to encode. Signup (2) × tutorial complete (2) × first purchase (2) × five revenue bands is already 40 slots. Add one retention signal and you are over.

But the real constraint is not slot count, it is **volume per slot**. Split into 64 and a campaign doing 500 installs a day averages eight per slot. Actual distribution and missingness differ, so that average alone does not establish whether the schema is useful.

## The design rule: split only where decisions differ

Ask one question per split: "if this value changes, do I do something different?"

If you split revenue into five bands but only ever adjust bids on the top two, the other three consume slots without informing anything. Merge them.

A schema you can read beats a schema that covers everything. That is the whole principle.

<!-- CONTENT_ACTION -->

## Four common mistakes

One: encoding behavior outside the window. The first window is days 0–2. An average purchase on day 5 does not mean no purchases occur earlier; check the fraction within the first two days. Check your real conversion-delay distribution before fixing the schema.

Two: dropping raw revenue in. Revenue is continuous and must be bucketed; tight buckets run out of slots fast. Split only the bands that matter.

**Three: remapping often.** Change the mapping and data before and after mean different things. If you must, record the date and never blend the periods.

Four: designing finely in windows 2 and 3. Those return only low, medium, and high. Ten LTV bands there collapse into three.

## Check how the platform uses this value

This is the real reason design deserves care. Conversion values can support reporting and optimization. Check platform and MMP settings to establish which values influence the selected goal.

Feed it a bad signal and the platform optimises that signal diligently. Put tutorial completion at the top and it brings users who finish tutorials. If those are not the users who spend, CPA improves while revenue does not.

## Try this today

**One.** Pull the mapping and count actual install volume per value. If many slots are empty, check behavior distribution, missingness and return conditions before considering consolidation.

**Two.** Check what sits at your top value, then verify that users who performed that action actually have higher D30 revenue. If they do not, you are handing the algorithm the wrong objective.

## Let's be honest

Do not treat conversion-value-based ROAS as an absolute number. It approximates revenue encoded into a narrow value, and revenue beyond the measurement window is never captured at all. Different missingness, buckets and maturity can distort campaign rankings too.

And when values stop arriving, do not suspect the schema first. Below the [privacy threshold](/glossary/crowd-anonymity) a perfect schema still returns no fine value. Per-window rules are in [Apple's documentation](https://developer.apple.com/documentation/storekit/receiving-postbacks-in-multiple-conversion-windows).

The full migration order is covered in [SKAN 4 migration](/blog/skan4-migration-guide).
