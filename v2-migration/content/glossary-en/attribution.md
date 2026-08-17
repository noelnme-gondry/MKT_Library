---
term: "Attribution"
seoTitle: "What Is Attribution? Assigning Credit for Conversions"
shortDef: "The rule that decides which ad touchpoint gets credit for a conversion that happened"
description: "Attribution is the rule deciding which touchpoint gets credit for a conversion that already happened — and why that is not the same as incrementality."
date: "2026-08-17"
slug: "attribution"
keywords: "attribution, attribution meaning, last click attribution, attribution window, multi touch attribution, conversion credit, marketing attribution"
category: "Measurement & Methodology"
relatedPosts: ["attribution-data-mismatch", "correlation-vs-causation"]
draft: false
faq:
  - q: "How is attribution different from incrementality?"
    a: "Attribution splits conversions that already happened across channels. Incrementality asks whether those conversions would have happened without the ad. Attribution always allocates 100%, while true incremental effect is often far smaller."
  - q: "Why do platform reports and MMP numbers disagree?"
    a: "Attribution windows, processing time and conversion definitions differ between systems. Neither is simply right — align the rules in one table before deciding which number to use."
  - q: "What is wrong with last-click attribution?"
    a: "It is simple and reproducible, but giving everything to the final touchpoint structurally understates channels that contributed at the awareness and consideration stages. Brand campaigns suffer most."
---

## In one line

If someone saw three ads before converting, whose win is it? Attribution is the rule that answers that — how credit for a conversion that already happened gets assigned across touchpoints.

## It is a rule, not a fact

This is the part that matters most. Someone sees an Instagram ad, clicks a search ad days later, then installs. Whose install is it?

There is no correct answer. So you pick a rule: give it all to the last click, split it across touchpoints, or count only touchpoints inside a set window.

Attribution numbers are the output of that rule, not a law of nature. Change the rule and the numbers change.

## Do not confuse it with incrementality

Attribution asks "who should we record this conversion under?" [Incrementality](/glossary/incrementality) asks "would this conversion have happened without the ad?"

Completely different questions. Attribution always allocates 100% somewhere, while real incremental effect can be far smaller than that total. Brand search advertising is the clearest example — attribution credits it heavily, yet many of those users would have arrived anyway.

## Why systems disagree

Conversion counts differing across the ad platform, GA4 and your [MMP](/glossary/mmp) is not a malfunction. Their attribution windows, processing times and conversion definitions differ.

Before picking which number is right, put each system's rules side by side. Most "data errors" are explained there.

## Go deeper

How to narrow down mismatched numbers across systems is covered in [attribution data mismatch](/blog/attribution-data-mismatch); why attribution cannot establish causality is covered in [correlation vs causation](/blog/correlation-vs-causation).
