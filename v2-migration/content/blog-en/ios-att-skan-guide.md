---
title: "iOS Measurement: ATT, SKAN, and Conversion Value Explained"
description: "iOS performance may not be bad, just invisible. ATT cuts user-level measurement and SKAN gives delayed aggregate signal. How to judge anyway."
date: "2026-07-15"
updated: "2026-08-17"
slug: "ios-att-skan-guide"
keywords: "ATT, SKAN, SKAdNetwork, SKAN 4, SKAdNetwork 4.0, skan attribution, iOS performance measurement, iOS privacy, App Tracking Transparency, iOS14 marketing, app attribution, conversion value, crowd anonymity, privacy threshold, AdAttributionKit"
tags: ["Measurement", "iOS"]
draft: false
faq:
  - q: "If ATT opt-in is low, did performance actually get worse?"
    a: "No. Losing measurement is not the same as losing performance. Traffic without consent loses deterministic attribution, so iOS performance reads lower than it truly is."
  - q: "How do I design the SKAN conversion value?"
    a: "SKAN returns a single value, so the metrics tied most directly to your business KPI belong at the top of the priority order. Packing in too many events buries the signal that matters."
  - q: "What changed in SKAN 4?"
    a: "Conversion measurement expanded from one window to three, so signal can arrive up to 35 days after install, and a coarse value of low, medium, or high joined the precise fine value. Campaign identifiers became hierarchical, but how much detail you actually receive depends on the privacy threshold."
  - q: "What is crowd anonymity in SKAN?"
    a: "It is Apple's guard against re-identification when install volume is small: the lower the tier, the less detail is returned, and the fine value and granular source identifier stop arriving. Splitting campaigns finer shrinks each slice's volume, so more structure paradoxically buys coarser data."
  - q: "Can I calculate ROAS from SKAN data?"
    a: "Only loosely. You can encode revenue into conversion-value buckets, but the resolution is low and revenue beyond the measurement window is never captured. Treat SKAN ROAS as an estimate for ranking campaigns, not as an absolute number."
---
If Android is fine but only iOS looks cut in half, suspect measurement before the campaign. After the "Allow tracking?" prompt (ATT), precise user-level tracking on iOS got hard, and you now read performance through Apple's limited aggregate frame, SKAdNetwork (SKAN). Miss this structure and you'll kill a perfectly good iOS campaign on the numbers alone.

Here's what changed and what to judge by inside it.

## ATT: no consent, no identifier

If a user declines the ATT (App Tracking Transparency) prompt, you can't use the IDFA (ad identifier). That means user-level attribution breaks. The lower the consent rate, the smaller the sample where precise measurement is even possible.

So the ATT consent rate itself became a metric to manage. When and in what context you show the prompt (priming — showing value first, then asking) changes consent a lot. Raise consent and more of your sample becomes measurable — iOS performance starts to "reappear."

One point that trips people up: declining ATT blocks measurement, not delivery. Ads still serve to those users and installs still happen. You simply cannot confirm at the user level which campaign earned them.

## SKAN: anonymous, delayed, limited signal

SKAN is Apple's alternative. It has three traits.

- **Anonymous, aggregate** — it aggregates only at the campaign level, not per user.
- **Delayed** — the conversion signal arrives days later, and with a randomised delay on top.
- **Limited information** — you must compress early behavior into a narrow value, the conversion value.

So conversion-value design became the core of iOS measurement — deciding which post-install action (signup, tutorial complete, first purchase), within a few days, gets packed into that narrow value. Get this design wrong and the platform learns on a bad signal, and iOS optimization drifts off entirely.

## What actually changed in SKAN 4

This is the part most people arrive here searching for, so it gets its own section. Three things differ from earlier versions.

![The three SKAN 4 conversion windows. The day 0-2 window returns a fine or coarse value; the day 3-7 and day 8-35 windows return only a coarse value. A low crowd anonymity tier withholds the fine value and the granular source identifier.](/blog-assets-en/ios-att-skan-guide/skan4-windows.svg)

One: three measurement windows instead of one. Previously you effectively got a single postback shortly after install. SKAN 4 can return a postback for each of three windows — days 0–2, 3–7, and 8–35. That creates room to observe late-firing behavior such as retention or subscription conversion.

Two: a coarse value arrived. The precise fine value (0–63) comes only in the first window, and only when volume conditions are met. The rest is a coarse value with three levels: low, medium, high. The resolution of the second and third windows is therefore quite blunt. Designing detailed LTV bands there just collapses them into three buckets.

Three: the privacy threshold (crowd anonymity) governs how much you get. This is what most often bites in practice. When install volume is small, Apple reduces what it returns so individuals cannot be re-identified. At a low tier, neither the fine value nor the granular source identifier arrives.

That produces a paradox specific to SKAN. Normally finer campaign structure means better analysis, but here splitting campaigns shrinks each slice's volume, lowering its tier and coarsening the data. Carry over your Android campaign structure and you can flatten your iOS data wholesale. On iOS it is often better to deliberately consolidate campaigns to build volume.

Exact tier conditions and per-window return rules change between versions, so confirm against [Apple's SKAdNetwork documentation](https://developer.apple.com/documentation/storekit/skadnetwork) and the [multiple conversion windows reference](https://developer.apple.com/documentation/storekit/receiving-postbacks-in-multiple-conversion-windows) before designing.

<!-- CONTENT_ACTION -->

## Common mistakes in conversion-value design

What you pack into that narrow value is the whole game, so mistakes here become optimization quality directly.

- Trying to include every event. Six bits is 64 slots; slicing them finely shrinks the volume behind each slot and raises noise. Narrow to what connects to your business KPI.
- Encoding behavior outside the window. The first window is days 0–2. If your average purchase lands on day 5, that signal never reaches the first window. Look at your actual conversion-delay distribution before choosing.
- Changing the design often. Remapping makes data before and after mean different things, breaking comparison. If you must change it, record the date and never blend the periods.
- Dropping raw revenue in. Revenue is continuous and has to be bucketed, and tight buckets run out of slots fast. Splitting only the few bands that matter works better.

## So what do you judge by

With user-level blurred, the aggregate and incrementality lens carries more weight.

- Rather than trusting platform reports at face value, use [incrementality analysis](/tools/incrementality) to see "what the ad actually created."
- Methods like [MMM](/tools/marketing-response), which estimate channel contribution from aggregate data without user identity, rose in value.

When you can't see everything at the user level, judging by "how much the whole moves when you turn a channel on and off" is more trustworthy than chasing individual clicks. Detailed responses are in the [iOS privacy · ATT · SKAN guide](/guide/ios-privacy-att-skan).

## Next generation: AdAttributionKit

Apple introduced AdAttributionKit (AAK), the successor to SKAdNetwork. SKAN 4 is still the more widely used industry standard, but it's worth knowing the long-term direction points this way. It adds dimensions SKAN lacked, such as re-engagement attribution and alternative app marketplace support. See the [AdAttributionKit documentation](https://developer.apple.com/documentation/adattributionkit/receiving-ad-attributions-and-postbacks) for specifics, and follow platform and MMP announcements for migration timing.

## Try this today

Open your iOS campaign report and check two things.

First, how far apart the platform console's iOS installs and your MMP or SKAN aggregate sit. The size of that gap is the size of what you cannot see. A large gap suggests iOS performance is under-measured rather than bad.

Second, pull up your conversion-value mapping and count the volume behind each value. If more than half the slots receive almost no installs, the design is sliced too finely. Merge slots until each one carries enough volume to support a decision.

## Let's be honest

SKAN's rules change by version, and delay and sample issues make the numbers unstable. The whole team has to share the premise that iOS performance is "the best estimate within a limited signal," not precise measurement. Overreact to a single console number and toggle campaigns on and off, and you'll chase a signal that isn't there and shake real performance in the process.

Treat SKAN-based ROAS with particular care. It is an approximation of revenue encoded into a narrow value, and revenue past the measurement window is never captured at all. Comparing rank between campaigns is about as far as it safely goes.
