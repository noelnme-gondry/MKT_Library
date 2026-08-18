---
title: "Why SKAN Attribution and MMP Numbers Disagree"
description: "SKAN and an MMP count different things at different times under different rules. Which source to trust for which question."
date: "2026-08-18"
updated: "2026-08-18"
slug: "skan-vs-mmp-attribution"
keywords: "skan attribution, skadnetwork attribution, SKAN vs MMP, iOS install discrepancy, deterministic attribution, SKAN delay, skadnetwork solution"
tags: ["Measurement", "iOS"]
draft: false
faq:
  - q: "Should I trust SKAN or my MMP?"
    a: "They answer different questions. Use the MMP for user-level analysis and in-app behavior, and SKAN for relative comparison between iOS campaigns. Deciding which source answers which question beats trying to reconcile them into one number."
  - q: "Is it normal for SKAN installs to be lower than MMP installs?"
    a: "It is common. Campaigns below the privacy threshold return less, and randomised delay means same-day comparisons always show SKAN behind. Re-check the same period a few days later."
  - q: "Can I optimise in real time on SKAN data?"
    a: "No. Postbacks arrive after the window closes plus a randomised delay, so adjusting bids on same-day performance does not work on iOS."
---
Open an iOS campaign report and there are three numbers: the ads manager, your MMP, and SKAN. All three differ, and none of them is wrong.

## They are counting different things

[SKAN](/glossary/skan) and an [MMP](/glossary/mmp) are not two tools doing the same job. The counting method itself differs.

| | SKAN | MMP |
|---|---|---|
| Unit | Campaign (anonymous) | User |
| Arrival | After the window closes, plus random delay | Broadly real time |
| In-app behavior | Compressed into one conversion value | Events as-is |
| Users who declined ATT | Included | No deterministic attribution |

That last row matters most. Installs from users who declined ATT cannot be confirmed at user level in the MMP but still appear in SKAN. The two numbers **are supposed to disagree**.

## Three places the gap opens

**One: delay.** SKAN arrives after the window closes plus a randomised delay. Compared on the same date, SKAN always looks behind. Re-check a few days later.

Two: the [privacy threshold](/glossary/crowd-anonymity). Low-volume campaigns return less. A SKAN install total below your MMP's may simply mean campaigns are split too finely.

Three: attribution rules. SKAN uses Apple's logic; your MMP uses its own [attribution window](/glossary/attribution-window). Different post-click eligibility means the same install gets allocated differently.

<!-- CONTENT_ACTION -->

## So which one do you read

Do not reconcile them — split by question.

- **User-level analysis, in-app behavior, retention** → the MMP. SKAN cannot provide these at all.
- **Relative comparison between iOS campaigns** → SKAN. It includes ATT-declined users, so it is less biased.
- **A channel's actual contribution** → neither is sufficient. That requires [incrementality analysis](/tools/incrementality).

The third point is the important one. SKAN and MMP are both observed attribution, and neither subtracts conversions that would have happened without the ad.

## Your operating rhythm has to change

Because of the delay, adjusting bids on same-day performance does not work on iOS. Toggling campaigns because the console looks bad treats not-yet-arrived signal as absent — and shakes [learning](/glossary/learning-phase) at the same time.

Reading weekly, and judging on data that is already a few days old, is the rhythm that fits.

## Try this today

**One.** Put the last 30 days of iOS installs in three columns: ads manager, MMP, SKAN. The size of the gap is the size of what you cannot see.

**Two.** If the gap is unusually large only in recent days, delay is the likely cause. Re-measure a window from two weeks ago and check whether the gap narrows. If it does not, the cause is the threshold, not delay.

## Let's be honest

Attempts to force the three numbers into agreement usually fail, because the unit of aggregation and the timing differ structurally. The goal is not agreement — it is **a team agreement on which source answers which question**.

Measurement windows and value resolution are covered in [SKAN 4 migration](/blog/skan4-migration-guide), and cross-system reconciliation in [attribution data mismatch](/blog/attribution-data-mismatch).
