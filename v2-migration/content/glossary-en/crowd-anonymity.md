---
term: "Crowd Anonymity (Privacy Threshold)"
seoTitle: "SKAN Privacy Threshold: Why Your Data Got Coarser"
shortDef: "Apple returns less detail when install volume is small — below the tier, the fine value stops arriving"
description: "Crowd anonymity is SKAN's guard against re-identification. It explains why splitting campaigns finer makes the data worse."
date: "2026-08-18"
slug: "crowd-anonymity"
keywords: "crowd anonymity, skadnetwork privacy threshold, apple privacy threshold, SKAN privacy threshold, SKAN tier, skan data missing"
relatedPosts: ["ios-att-skan-guide"]
category: "Tracking & tech"
draft: false
faq:
  - q: "Fine conversion values stopped arriving — is my SDK broken?"
    a: "Suspect the privacy threshold first. After a campaign restructure, each slice carries less volume, drops a tier, and loses both the fine value and the granular source identifier. Consolidate campaigns to rebuild volume and re-check before changing code."
  - q: "What is the exact threshold?"
    a: "Apple does not publish fixed numbers and the rules change between versions. Rather than designing around an assumed figure, change the structure and observe which values actually come back."
---

## In one line

When too few installs sit behind a postback, the returned values could re-identify someone. So SKAN gives back less detail at low volume, and the bar it uses is called crowd anonymity.

## What disappears

Two things. The precise [conversion value](/glossary/conversion-value) (fine, 0–63) and the granular source identifier. What remains is the three-level coarse value and the coarsest campaign identifier.

## The paradox specific to SKAN

Analysis usually improves as you slice data finer. Here it inverts: splitting campaigns shrinks each slice's volume, drops its tier, and coarsens what you receive.

Port an Android campaign structure straight to iOS and you can flatten your iOS data wholesale. On iOS, deliberately consolidating campaigns to build volume often buys more measurement than the structure costs.

## Go deeper

How the threshold interacts with each measurement window is covered in the [iOS ATT and SKAN measurement guide](/blog/ios-att-skan-guide).
