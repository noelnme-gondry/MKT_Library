---
title: "SKAN Schema Validation After a Change"
description: "A checklist for validating conversion-value calls, postbacks, signatures, and reporting after a SKAN schema change."
date: "2026-08-26"
slug: "skan-schema-validation"
keywords: "SKAN schema validation, conversion value validation, SKAN postback testing"
tags: ["Measurement & analysis", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["skan", "conversion-value", "postback"]
conditions: "Development postbacks can use fixed values that differ from production privacy-tier outcomes. A test proves an implementation path; production resolution needs separate observation."
sources:
  - title: "Verifying an install-validation postback — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/verifying-an-install-validation-postback?changes=_2."
  - title: "SKAdNetwork — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/skadnetwork?lang=en"
faq:
  - q: "Does conversion value zero in a test prove schema failure?"
    a: "No. Apple test scenarios can use fixed production-unlike parameters. Separate the expected call, receipt, and signature-validation path from the production distribution you observe after release."
  - q: "Can I count a received postback immediately as a conversion?"
    a: "No. Verify Apple’s signature, deduplicate on transaction-id, and check did-win for version 3 and later. Invalid or nonwinning postbacks distort a winning-attribution total."
---

## Validate four layers

A number in a dashboard is not an adequate success criterion after a schema change. Check: the app makes the intended fine/coarse and lock calls; signing version and SDK/iOS eligibility are expected; receipt verifies Apple’s signature and deduplicates transaction IDs; and reporting separates sequence index, did-win, fine, coarse, and unavailable states.

## Keep testing separate from operating evidence

Apple provides StoreKit Test paths for impression signatures and postbacks. Use them to find implementation errors quickly, but do not substitute them for production privacy-tier distribution. Record call and signature expectations in tests; record window delay, identifier length, and value-availability share after release.

## Compare schema versions honestly

Log effective date, app version, schema version, and network or MMP owner. For the first operating period, inspect availability share and comparable top-level action bands before reading code-level value movement. Otherwise the schema change itself becomes a false performance change.
