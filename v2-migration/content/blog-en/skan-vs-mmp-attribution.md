---
title: "Why SKAN Attribution and MMP Numbers Disagree"
description: "SKAN and an MMP count different things at different times under different rules. Which source to trust for which question."
date: "2026-08-18"
slug: "skan-vs-mmp-attribution"
keywords: "skan attribution, skadnetwork attribution, SKAN vs MMP, iOS install discrepancy, deterministic attribution, SKAN delay, skadnetwork solution"
tags: ["Measurement", "iOS"]
draft: false
faq:
  - q: "Should I trust SKAN or my MMP?"
    a: "They answer different questions. Use the MMP for user-level analysis and in-app behavior, and SKAN for relative comparison between iOS campaigns. Deciding which source answers which question beats trying to reconcile them into one number."
  - q: "Is it normal for SKAN installs to be lower than MMP installs?"
    a: "Either total may be larger depending on delay, date basis, attribution windows, and deduplication. Privacy tiers also affect detail. Compare the same mature period and definitions, then check integration gaps."
  - q: "Can I optimise in real time on SKAN data?"
    a: "Undelivered SKAN postbacks cannot establish final same-day performance. Keep other operational signals separate and reassess mature periods using the applicable postback windows and delays."
updated: "2026-09-08"
reviewedAt: "2026-09-09"
reviewer: "Codex (AI-assisted editorial audit)"
sources:
  - title: "Apple SKAdNetwork"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork"
---
An iOS campaign can show different totals in the ads manager, MMP, and SKAN. Definitions may explain the gap, but integration or deduplication errors can also cause it. Disagreement alone does not establish that everything is correct.

## They are counting different things

[SKAN](/glossary/skan) and an [MMP](/glossary/mmp) are not two tools doing the same job. The counting method itself differs.

| | SKAN | MMP |
|---|---|---|
| Unit | Attribution postbacks at a privacy-dependent resolution | Events and aggregates permitted by consent and integration |
| Arrival | After the window closes, plus random delay | Broadly real time |
| In-app behavior | Fine/coarse values by version and window | Events and attribution within the collection scope |
| Users who declined ATT | Privacy-preserving attribution supported | IDFA-based cross-app attribution restricted; SKAN ingestion is also possible |

An MMP can ingest SKAN postbacks, so the names do not identify mutually exclusive data sources. Check which attribution method and aggregation unit the particular MMP report uses.

## Three places the gap opens

**One: delay.** SKAN windows and random delay make recent periods immature. Do not mix install dates with postback receipt dates; revisit the same cohort later.

Two: the [privacy threshold](/glossary/crowd-anonymity). Privacy tiers affect identifier and conversion-value detail. Do not treat them as the sole explanation for an install-total discrepancy.

Three: attribution rules. SKAN uses Apple's logic; your MMP uses its own [attribution window](/glossary/attribution-window). Different post-click eligibility means the same install gets allocated differently.

<!-- CONTENT_ACTION -->

## So which one do you read

Do not reconcile them — split by question.

- **User-level analysis, in-app behavior, retention** → the MMP. SKAN cannot provide these at all.
- **Relative comparison between iOS campaigns** → SKAN with comparable windows, value definitions, and privacy tiers. ATT coverage alone does not establish lower bias.
- **A channel's actual contribution** → neither is sufficient. That requires [incrementality analysis](/tools/incrementality).

The third point is the important one. SKAN and MMP are both observed attribution, and neither subtracts conversions that would have happened without the ad.

## Your operating rhythm has to change

Do not treat undelivered SKAN signals as zero when adjusting bids. Separate same-day delivery and spend checks from mature-conversion readouts to avoid unnecessary changes to [learning](/glossary/learning-phase).

Reading weekly, and judging on data that is already a few days old, is the rhythm that fits.

## Try this today

**One.** Put attribution method, date basis, window, and redownload inclusion beside the last 30 days of totals. The gap itself does not estimate unseen installs or incrementality.

**Two.** Re-query the same historical period to see values added by delay. If a gap remains, check definitions, mapping, missing records, and deduplication as well as privacy tiers.

## Let's be honest

Attempts to force the three numbers into agreement usually fail, because the unit of aggregation and the timing differ structurally. The goal is not agreement — it is **a team agreement on which source answers which question**.

Measurement windows and value resolution are covered in [SKAN 4 migration](/blog/skan4-migration-guide), and cross-system reconciliation in [attribution data mismatch](/blog/attribution-data-mismatch).
