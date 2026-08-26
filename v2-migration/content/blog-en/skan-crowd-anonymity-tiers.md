---
title: "SKAN Crowd Anonymity Tiers Explained"
description: "How SKAN 4 postback data tiers limit source identifier and conversion-value detail."
date: "2026-08-26"
slug: "skan-crowd-anonymity-tiers"
keywords: "SKAN crowd anonymity, SKAN tier, conversion value, source identifier"
tags: ["Measurement & analysis", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["crowd-anonymity", "skan", "conversion-value"]
conditions: "This applies to interpreting SKAdNetwork 4 postbacks. Returned fields depend on the ad network signing version, iOS and SDK eligibility, and Apple’s privacy threshold."
sources:
  - title: "Receiving postbacks in multiple conversion windows — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/receiving-postbacks-in-multiple-conversion-windows?changes=_2"
  - title: "SKAdNetwork — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork?lang=en"
faq:
  - q: "Does a low crowd-anonymity tier remove the install?"
    a: "It does not automatically mean the install disappears. The tier limits which detailed fields a postback can include, including source-identifier digits and the availability of fine or coarse conversion values."
  - q: "Should I use fewer conversion values to raise the tier?"
    a: "You cannot assume that reducing values alone raises a tier. First check campaign structure and observed volume, then define coarse values that still support a decision at lower resolution."
---

## A tier is reporting resolution, not a score

In SKAN 4, Apple assigns a postback data tier to each app download. That means the same campaign is not guaranteed to return the same level of detail on every row. A reduced field is not, on its own, evidence that delivery or the SDK failed.

The tier can affect `source-identifier`, `conversion-value`, `coarse-conversion-value`, `source-app-id`, `source-domain`, and `country-code`. A hierarchical source identifier can return two, three, or four digits. Do not try to reconstruct a four-digit campaign split from a row that contains only two digits.

## Read missing fine value in order

Fine conversion value is available only in the first window, while lower tiers or later windows can use a coarse value. `low`, `medium`, and `high` are not Apple-defined revenue bands; the app or ad network defines their meaning. Start with the schema table: what action or value does each band represent?

Then split the report by tier proxy, identifier length, and fine/coarse/not-provided state. If all three shares move together, the change may be measurement resolution rather than product behavior. If resolution stays stable while a particular value falls, event or funnel change becomes a more plausible hypothesis.

## Operating rule

Do not fill missing detail with zero or discard it as a failure. Keep fine, coarse, and unavailable as distinct states, and limit budget decisions to the level the data can support. The goal is not the most granular campaign hierarchy; it is a decision unit that survives lower reporting resolution.
