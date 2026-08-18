---
term: "Postback"
seoTitle: "What Is a Postback? Where to Look When Installs Read Zero"
shortDef: "The server-to-server notification telling an ad network that an install or conversion happened"
description: "A postback tells the network a conversion occurred. The SAN versus S2S split, and what to check first when installs read zero."
date: "2026-08-18"
slug: "postback"
keywords: "postback, what is a postback, postback integration, S2S postback, SKAN postback, installs zero, MMP integration"
relatedPosts: ["postback-integration-guide"]
category: "Tracking & tech"
draft: false
faq:
  - q: "Installs read zero — what do I check first?"
    a: "Confirm whether the network receives installs via SAN or S2S. The integration type changes which checkpoints matter, and for S2S the server-to-server transfer rules and authentication come first."
  - q: "Is a SKAN postback the same thing?"
    a: "No. A regular postback is your MMP telling a network about a user-level conversion; a SKAN postback is Apple sending an anonymous aggregate value on a delay. They differ in timing and resolution, so they should not be compared in the same table."
---

## In one line

A postback is the server-to-server signal saying "this install happened." When it does not fire, the network's report shows zero.

## SAN and S2S

Networks receive conversions in one of two ways. A SAN (Self-Attributing Network) like Google or Meta decides attribution itself and reconciles with your [MMP](/glossary/mmp); S2S means the MMP pushes directly to the network under agreed server-to-server rules.

The distinction matters because it changes where you look when something breaks. For S2S, check the endpoint, authentication, and payload format; for a SAN, check the account link and attribution settings.

## Let's be honest

A postback arriving does not mean the numbers agree. If the network and your MMP use different [attribution windows](/glossary/attribution-window) and conversion definitions, the counts still diverge. Fixing an integration and reconciling numbers are two separate jobs.

## Go deeper

Per-integration debugging order is covered in [postback error diagnosis](/blog/postback-integration-guide).
