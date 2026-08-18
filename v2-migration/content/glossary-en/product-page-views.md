---
term: "Product Page Views"
seoTitle: "Product Page Views: How They Differ From Impressions"
shortDef: "How many times the store product page was actually opened — the denominator of store conversion"
description: "Product page views count actual opens of the store page — how they differ from impressions, and using them as the conversion denominator."
date: "2026-08-18"
slug: "product-page-views"
keywords: "product page views, app store product page views, store listing visitors, store conversion denominator, impressions vs product page views"
category: "Measurement & Methodology"
relatedPosts: ["store-conversion-drop-diagnosis", "aso-basics-guide"]
draft: false
faq:
  - q: "What is the difference between impressions and product page views?"
    a: "Impressions count how often the app appeared in a search result or recommendation list; product page views count actual opens of the page. 4,300 views on 12,900 impressions is a 33% tap-through, and the other 67% passed by on icon and title alone. The two steps have different fixes and have to be read separately."
  - q: "What should the store conversion denominator be?"
    a: "Product page views is the standard choice. 1,935 installs on 4,300 views is a 45% conversion rate. Using impressions as the denominator blends a discovery problem with a persuasion problem into one number, leaving no way to tell which one got worse."
  - q: "Do Apple and Google define views the same way?"
    a: "No. App Store Connect reports product page views while Google Play Console reports store listing visitors. Apple provides unique-device variants separately, and Google counts visitors as deduplicated. Do not add the two stores together into a single conversion rate — read each on its own."
---

## In one line

Product page views count how many times someone tapped through from a store search result or recommendation list and actually opened your product page. It is the denominator used to calculate store conversion.

## Not the same as impressions

An impression is your app appearing in a list — including everyone who scrolled past on icon and title alone. Product page views count only the people who tapped in.

The numbers make the split concrete. 4,300 views on 12,900 impressions is a 33% tap-through. The other 67% dropped out at the list stage, which is an icon, title, and rating problem. Of the 4,300 who did come in, whoever did not install is a screenshot, description, and price problem. Both look like "did not install" and have entirely different causes.

## Why this is the denominator

Using impressions as the denominator blends the two problems into one number, so failing to earn the tap and failing to persuade on the page become indistinguishable.

With product page views as the denominator, the rate answers "of the people who reached the page, how many installed" — isolating the page's persuasive power. 1,935 installs on 4,300 views is 45%.

## The stores name and define it differently

App Store Connect calls it Product Page Views; Google Play Console calls it Store listing visitors. Apple provides unique-device variants separately, while Google counts visitors deduplicated.

Because the definitions differ, adding the two stores together into a single conversion rate is not valid. Read iOS and Android separately.

## Where it is used

Splitting views and installs by traffic source shows whether a drop in store conversion came from the page or from the traffic mix. Upload a store console CSV to [ASO Store Conversion Analysis](/tools/aso-store-conversion) to see that decomposition directly.

## Go deeper

How to separate the two causes by source is covered in [Store Conversion Dropped: Page Problem or Traffic Mix?](/blog/store-conversion-drop-diagnosis).
