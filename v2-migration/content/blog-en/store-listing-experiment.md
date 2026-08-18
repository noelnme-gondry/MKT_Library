---
title: "Store Listing Experiments: Designing and Reading PPO Tests"
description: "Before-and-after gets icon and screenshot tests wrong. How Apple PPO and Play listing experiments differ, and how to read them."
date: "2026-08-18"
updated: "2026-08-18"
slug: "store-listing-experiment"
keywords: "store listing experiment, PPO, Product Page Optimization, Play store listing experiment, app store A/B test, app icon test, screenshot test, store experiment design"
tags: ["ASO", "Experiment Analysis"]
draft: false
faq:
  - q: "How is a store experiment different from before-and-after?"
    a: "Before-and-after cannot separate other changes that happened in the same window. Raise ad spend or hit a seasonal peak the same week you swap screenshots and all of it lands in the screenshot's column. A store experiment splits traffic randomly at the same moment, which removes that confounding by design."
  - q: "How do Apple PPO and Google Play experiments differ?"
    a: "Apple PPO runs up to three treatments alongside the original for up to 90 days, testing icon, screenshots and preview videos. Play's listing experiments cover icon, screenshots and descriptions, and can be split by region and language. Traffic allocation and win criteria differ between them, so results should not be compared on the same scale."
  - q: "How long should an experiment run?"
    a: "At least two weeks so the weekly cycle completes once, and longer when conversions are sparse. What matters more than duration is fixing the stop condition before launch. Stopping the moment a variant is ahead raises the chance of stopping on a random peak and inflating the winner."
  - q: "Can a winning variant still turn out to have no effect?"
    a: "Yes. An interval crossing zero means not yet distinguishable, even with a winner badge showing. Store experiments also only observe people who reached the product page — changing the icon also changes tap-through in search results, which sits outside the test, so the total effect can be larger or smaller than the experiment reports."
---
Screenshots changed, and two weeks later conversion is up. Was it the screenshots? If ad spend also grew and the season turned in those same two weeks, the honest answer is that you do not know.

[Decomposing store conversion](/blog/store-conversion-drop-diagnosis) narrows where to look, but it does not prove cause. Confirming that a change worked takes an experiment — and both stores provide one for free.

## Why before-and-after fails

Before-and-after compares "before the change" against "after it". The problem is that time passed in between.

- Did ad spend and channel mix hold?
- Was the seasonal and day-of-week composition the same?
- Were there app updates, ratings shifts, competitor promotions?
- Did the [traffic source composition](/glossary/product-page-views) stay put?

Any one of those moving lands in the screenshot's column. The last one catches people most often, because a shift in source composition moves the blended rate even when every per-source rate holds steady.

Store experiments remove this by construction. Traffic arriving **at the same moment** is split randomly across variants, so season, spend and weekday hit both groups identically.

## The two stores are built differently

Apple and Google measure differently, so their results do not belong on the same scale.

Apple PPO (Product Page Optimization). Up to three treatments run alongside the original, for up to 90 days, covering icon, screenshots and preview videos. Testing the icon actually changes the app icon on device home screens, so icon tests deserve more caution than the rest.

Google Play listing experiments. Icon, screenshots and preview video plus short and full descriptions. These can be split by region and language, so testing in a single country is possible.

Traffic allocation, win criteria and statistical treatment all differ. "It won on Apple, so ship it on Play" is a hypothesis, not evidence — run it on both.

![Traffic arriving at the same moment is split randomly between the original and treatments](/blog-assets-en/store-listing-experiment/store-experiment-design.svg)

## Change one thing

If a variant that changed icon, screenshots and description together wins, you do not know what won — and you cannot reproduce it next time.

One change per test is the principle, though limited experiment slots force compromises in practice. When you have to bundle, **record exactly which elements changed** and follow up by re-testing the winner element by element.

## Duration and stop conditions

Two weeks is the floor, so the weekly cycle completes once. Apps with sparse conversions need longer.

More important than duration is **fixing the stop condition before you launch**. Watching the dashboard daily and stopping when a variant pulls ahead accumulates chances to stop on a random peak, which inflates how often you declare a winner that is not real.

Write these two lines down at the start.

- When will this stop (a date, or a minimum conversion count)?
- How large does the gap need to be before we adopt?

## Reading the result

**Start with the interval.** An interval crossing zero means "not yet distinguishable", not "no effect". Those are different states — more data might still separate them.

Read the lift in absolute terms too. Going from 30% to 31% is a 3.3% relative improvement but 1pp absolute: 100 extra installs per 10,000 views. Whether that size justifies the cost of shipping it is the actual decision.

Remember what the experiment cannot see. Store experiments only observe people who reached the product page. But the icon also appears in search result lists, so changing it changes how many people reach the page at all — and that sits outside the test. The full effect of an icon change can be larger or smaller than the number the experiment reports.

## Carrying results into operations

After shipping a winner, confirm with [store conversion analysis](/tools/aso-store-conversion) that per-source conversion actually rose. The experiment measured people who reached the page; live operations keep moving the traffic mix underneath you.

If per-source rates held but the headline number got worse, the experiment was not wrong — the mix moved. Separating the two keeps a real experimental gain from disappearing into operational noise.

## Try this today

1. Find the oldest element on your store page. It is usually the first screenshot.
2. Pick exactly one variant, and write the end date and adoption threshold down before launching.
3. Note the start date on a calendar — it becomes the reference point when you read the trend later.

## Let's be honest

Random assignment makes store experiments one of the few ASO tools capable of causal inference. That does not make them universal.

Measurement stops at the product page, so keyword rank and search impression changes are invisible to it. An app update or a ratings swing during the test hits both groups, but it can still change the size of the effect you measure.

And a winner does not win forever. Season, competitive context and traffic composition can flip the verdict. Rather than holding a past winner indefinitely on no evidence, re-validate periodically.
