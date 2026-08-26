---
title: "iOS SKAN Campaign Structure: Source Identifier Design"
description: "Design SKAN 4 campaign splits around the source-identifier resolution that can actually return."
date: "2026-08-26"
slug: "ios-skan-campaign-structure"
keywords: "SKAN campaign structure, source identifier, iOS campaigns, SKAN 4"
tags: ["Measurement & analysis", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["skan", "crowd-anonymity", "attribution-window"]
conditions: "Identifier assignment and UI mapping differ by network. This is a design principle based on Apple’s hierarchical identifier and privacy-tier constraints, not a network-specific setup guide."
sources:
  - title: "SKAdNetwork 4 release notes — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork-4-release-notes"
  - title: "Receiving postbacks in multiple conversion windows — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/receiving-postbacks-in-multiple-conversion-windows?changes=_2"
faq:
  - q: "Do four source-identifier digits always reveal four campaign levels?"
    a: "No. Apple can return two, three, or four digits according to postback data tier. Four digits are maximum design resolution, not guaranteed row-level resolution."
  - q: "Does merging campaigns always improve measurement?"
    a: "Merging trades detail for volume. Remove splits that cannot change a decision, but do not combine campaigns that require different budget actions just to make a report look cleaner."
---

## Put stable decisions in the leading digits

Apple describes a four-digit source identifier in SKAN 4, while the postback can reveal two, three, or four digits by privacy tier. That makes leading-digit design a measurement decision.

Use the first two digits for a country, broad objective, or other unit where budget can actually move. Reserve later digits for creative, ad-group, or hypothesis detail that is useful only when high resolution is available. Ask one practical question: can the team still make this week’s decision when only two digits return?

## Separate structure change from performance change

When identifier assignment changes, do not join old and new granular reports as one series. Record the change date, mapping version, and returned-digit distribution; compare at the common higher level. Otherwise a changed aggregation can be misread as campaign improvement or decline.

Before launch, document each digit’s owner and meaning, produce a sample report with only two digits, and put structure version next to every future comparison.
