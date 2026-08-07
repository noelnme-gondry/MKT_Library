---
title: "iOS Measurement: ATT, SKAN, and Conversion Value Explained"
description: "iOS performance may not be bad, just invisible. ATT cuts user-level measurement and SKAN gives delayed aggregate signal. How to judge anyway."
date: "2026-07-15"
slug: "ios-att-skan-guide"
keywords: "ATT, SKAN, SKAdNetwork, iOS performance measurement, iOS privacy, App Tracking Transparency, iOS14 marketing, app attribution, conversion value, privacy advertising"
tags: ["Measurement", "iOS"]
draft: false
---

If Android is fine but only iOS looks cut in half, suspect **measurement** before the campaign. After the "Allow tracking?" prompt (ATT), precise user-level tracking on iOS got hard, and you now read performance through Apple's limited aggregate frame, SKAdNetwork (SKAN). Miss this structure and you'll kill a perfectly good iOS campaign on the numbers alone. Here's what changed and what to judge by inside it.

## ATT: no consent, no identifier

If a user declines the ATT (App Tracking Transparency) prompt, you can't use the IDFA (ad identifier). That means **user-level attribution breaks.** The lower the consent rate, the smaller the sample where precise measurement is even possible.

So the ATT consent rate itself became a metric to manage. When and in what context you show the prompt (priming — showing value first, then asking) changes consent a lot. Raise consent and more of your sample becomes measurable — iOS performance starts to "reappear."

## SKAN: anonymous, delayed, limited signal

SKAN is Apple's alternative. It has three traits.

- **Anonymous, aggregate**: it aggregates only at the campaign level, not per user.
- **Delayed**: the conversion signal arrives days later, not in real time.
- **Limited information**: you must compress early behavior into a narrow value, the conversion value.

So **conversion-value design** became the core of iOS measurement — deciding which post-install action (signup, tutorial complete, first purchase), within a few days, gets packed into that narrow value and how. Get this design wrong and the platform learns on a bad signal, and iOS optimization drifts off entirely.

## So what do you judge by

With user-level blurred, the **aggregate and incrementality** lens carries more weight.

- Rather than trusting platform reports at face value, use [incrementality analysis](/tools/incrementality) to see "what the ad actually created."
- Methods like [MMM](/tools/marketing-response), which estimate channel contribution from aggregate data without user identity, rose in value.

When you can't see everything at the user level, judging by "how much the whole moves when you turn a channel on and off" is more trustworthy than chasing individual clicks. Detailed responses are in the [iOS privacy · ATT · SKAN guide](/guide/ios-privacy-att-skan).

## Next generation: AdAttributionKit

Apple introduced **AdAttributionKit (AAK)**, the successor to SKAdNetwork. SKAN 4 is still the more widely used industry standard, but it's worth knowing the long-term direction points this way. Follow platform and MMP announcements for migration timing.

## Let's be honest

SKAN's rules change by version, and delay and sample issues make the numbers unstable. The whole team has to share the premise that iOS performance is **"the best estimate within a limited signal,"** not precise measurement. Overreact to a single console number and toggle campaigns on and off, and you'll chase a signal that isn't there and shake real performance in the process.
