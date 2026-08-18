---
term: "SKAN (SKAdNetwork)"
seoTitle: "What Is SKAN? What SKAdNetwork Gives and Withholds"
shortDef: "Apple's install attribution framework — anonymous, delayed, and aggregate-only"
description: "SKAdNetwork returns campaign-level aggregate signal without user identity. The three windows and what resolution each carries."
date: "2026-08-18"
slug: "skan"
keywords: "SKAN, what is SKAN, SKAdNetwork, SKAdNetwork meaning, skan attribution, apple attribution, SKAN 4, app install measurement"
relatedPosts: ["ios-att-skan-guide"]
category: "Tracking & tech"
draft: false
faq:
  - q: "How does SKAN differ from an MMP?"
    a: "SKAN is anonymous aggregate signal returned by Apple itself; an MMP is a third-party tool that collects data from many networks and settles attribution. Most teams receive SKAN postbacks through their MMP and read them next to other data."
  - q: "Why does SKAN data arrive late?"
    a: "Apple adds a randomised delay after the measurement window closes, so an individual cannot be re-identified by timing. That makes SKAN unusable for real-time optimization."
---

## In one line

SKAN (SKAdNetwork) is the framework Apple built so ad-driven installs can still be counted without a user identifier. It returns counts at the campaign level, aggregated, and days after the fact.

## What it gives and what it does not

It gives you how many installs a campaign produced and one compressed value describing their early behavior. What it does not give is a user-level link — you cannot build the sentence "this person saw this ad and installed" from SKAN data.

Under SKAN 4 the measurement windows are days 0–2, 3–7, and 8–35 after install. The precise [conversion value](/glossary/conversion-value) (0–63) arrives only in the first window, and only above the [privacy threshold](/glossary/crowd-anonymity). The other windows return low, medium, or high — three levels, no more.

## Where it bites in practice

Campaign structure. On other channels finer structure means better analysis; under SKAN each slice carries less install volume, drops below the threshold, and the data you get back gets coarser instead.

## Go deeper

The relationship to ATT, window design, and conversion-value mapping are covered in the [iOS ATT and SKAN measurement guide](/blog/ios-att-skan-guide).
