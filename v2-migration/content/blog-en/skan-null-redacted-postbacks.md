---
title: "SKAN Null Postbacks: Missing Data vs Privacy"
description: "How to distinguish a missing SKAN postback from privacy-limited conversion-value and source-identifier fields."
date: "2026-08-26"
slug: "skan-null-redacted-postbacks"
keywords: "SKAN null, missing postback, conversion value unavailable, source identifier"
tags: ["Measurement & analysis", "iOS"]
draft: false
primaryTool: "5-2"
relatedGlossary: ["skan", "postback", "crowd-anonymity"]
conditions: "Parameter availability depends on SKAdNetwork version and postback data tier. An MMP or network dashboard can transform the raw postback, so check the original field definition too."
sources:
  - title: "Identifying the parameters in install-validation postbacks — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/identifying-the-parameters-in-install-validation-postbacks?changes=_8%2C_8%2C_8%2C_8"
  - title: "Receiving postbacks in multiple conversion windows — Apple Developer"
    url: "https://developer.apple.com/documentation/storekit/receiving-postbacks-in-multiple-conversion-windows?changes=_2"
faq:
  - q: "Does a missing conversion value mean the SDK update failed?"
    a: "Not necessarily. Even when an app provides a value, the parameter may not appear if disclosure does not meet Apple’s privacy threshold, and version and window also limit when fine detail is possible."
  - q: "Do fine and coarse values arrive together?"
    a: "Apple defines a postback as containing either conversion-value or coarse-conversion-value, not both. Do not treat an unavailable one as zero for the other."
---

## An empty field and no postback are different events

First verify whether the receiving log contains a postback at all. No postback points to signing, endpoint, response, or version eligibility. A received postback with an absent conversion value or shortened identifier points next to privacy threshold and postback data tier.

Apple limits the presence and resolution of selected parameters for crowd anonymity. Turning `null` into numeric zero changes the statement from “detail was unavailable” to “user value was zero.” Preserve the raw field, parse state, version, and sequence index separately.

## Check in this order

1. Check `version` and `postback-sequence-index`; SKAN 4 windows do not populate every field in the same way.
2. Split `did-win`; a valid nonwinning postback is not a conversion to add to the winning total.
3. Aggregate fine, coarse, and unavailable values as separate states.
4. Limit reporting to the campaign level supported by the returned source-identifier length.

Say “the postback arrived but detailed conversion value was unavailable,” not “there was no conversion data.” That distinction prevents privacy-limited reporting from being treated as absent user behavior.
