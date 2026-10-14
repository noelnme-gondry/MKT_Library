---
title: "Marketing Analysis: A Practical CSV Walkthrough"
description: "Work through marketing analysis with a downloadable CSV: calculate spend, installs and CPI, locate campaign changes, and plan the next review."
date: "2026-10-14"
slug: "marketing-analysis-example"
searchTitleTerms: ["Marketing Analysis", "CSV"]
keywords: "marketing analysis, marketing analysis methods, performance marketing analysis, campaign analysis example"
tags: ["Diagnosis", "Methodology"]
draft: false
primaryTool: "5-21"
relatedGlossary: ["cpi", "cpa", "roas", "incrementality"]
answer: "Marketing analysis compares cost and outcomes on consistent definitions, then identifies what to investigate and do next. This synthetic CSV walkthrough raises spend from KRW 700,000 to 840,000 with installs unchanged at 700: CPI rises from 1,000 to 1,200. Investigate campaign A first; this does not establish profitability or causal advertising effects."
conditions: "The periods have equal length, currency, install definitions and assumed reporting maturity. Do not interpret installs as purchases or estimate revenue, profit or incrementality from missing fields."
faq:
  - q: "What data do I need for marketing analysis?"
    a: "Dates, channels or campaigns, spend and conversions are a starting point for operating comparisons. Clicks support post-click conversion rates; attributed revenue supports ROAS. Align conversion definitions and reporting rules first."
  - q: "How does this differ from analysis in Excel?"
    a: "Excel can calculate the same totals and ratios. Here, mapping a CSV lets you continue into two-period campaign comparisons and mix-efficiency decomposition. Input quality still needs to be checked."
  - q: "Should I immediately stop a campaign with deteriorating metrics?"
    a: "Locating a change is not proof that stopping the campaign improves profit. Check reporting delay, configuration changes, customer value and other channels, then define a small change and review criteria."
sources:
  - title: "SAS — Marketing analytics"
    url: "https://www.sas.com/ko_kr/insights/marketing/marketing-analytics.html"
  - title: "Google Ads — Average CPA definition"
    url: "https://support.google.com/google-ads/answer/6396841?hl=en"
  - title: "Google Ads — CPA and ROAS glossary"
    url: "https://support.google.com/google-ads/answer/12851704?hl=en"
  - title: "Google Meridian — Required causal assumptions"
    url: "https://developers.google.com/meridian/docs/causal-inference/required-assumptions"
---
Ad spend is up, but installs are flat. The report shows a higher cost per install without telling you which campaign to open first or whether cutting budget is the right response. This is where marketing analysis becomes useful.

This walkthrough uses one downloadable CSV to check totals, locate campaign changes and define the next review. It is a synthetic teaching example, not a customer success story. After the [performance marketing workflow](/blog/performance-marketing-analysis-order), use it to practice the analysis step.

## Marketing analysis connects numbers to decisions

Marketing analysis examines marketing data to assess performance and inform operating decisions. [SAS’s introduction](https://www.sas.com/ko_kr/insights/marketing/marketing-analytics.html) describes using data and analytical processes to evaluate marketing performance. In practice, narrow the task to an answerable question such as where a weekly cost increase is concentrated.

Our question is **why overall cost per install rose while installs stayed flat**. First compare totals, then inspect campaigns. Completing the arithmetic does not identify a creative or targeting change as the cause.

## 1. Establish what one row means

[Download the marketing analysis CSV](/examples/weekly-report-campaigns.csv)

One row represents **one day × one campaign**. Compare August 31–September 6, 2026 with September 7–13: two seven-day periods. Amounts are in KRW. Columns include date, channel, campaign ID and name, cost, installs, impressions and clicks.

| Check | This example | Common problem in an actual file |
|---|---|---|
| Conversion definition | App install | Combining signups, purchases and installs |
| Period | Two equal-length weeks | Comparing three weekdays with seven days |
| Cost unit | KRW | Mixing currencies or tax treatment |
| Reporting maturity | Both periods assumed complete | Recent conversions have not arrived |
| Row duplication | One campaign per day | Adding total rows to daily detail |

Mapping columns does not align reporting conditions. In an actual account, separately inspect changes to conversion definitions and campaign settings.

## 2. Calculate unit cost from totals

| Metric | Prior seven days | Recent seven days | Change |
|---|---:|---:|---:|
| Spend | KRW 700,000 | KRW 840,000 | +20% |
| Installs | 700 | 700 | 0% |
| CPI | KRW 1,000 | KRW 1,200 | +200, or +20% |

CPI is **total cost ÷ total installs**. The prior period is 700,000 ÷ 700 = 1,000; the recent period is 840,000 ÷ 700 = 1,200. Dividing the increase of 200 by the prior CPI of 1,000 gives 20%.

[Google Ads defines average CPA](https://support.google.com/google-ads/answer/6396841?hl=en) using total cost divided by total conversions. Here the conversion is an install, so we call the metric CPI. Averaging daily or campaign-level ratios can ignore volume differences. Check the denominator alongside the [performance marketing metrics guide](/blog/performance-marketing-metrics).

## 3. Locate the campaign behind the change

| Campaign | Prior spend / installs | Recent spend / installs | CPI change |
|---|---:|---:|---:|
| A | KRW 350,000 / 350 | KRW 420,000 / 280 | 1,000 → 1,500 |
| B | KRW 350,000 / 350 | KRW 420,000 / 420 | 1,000 → 1,000 |

Both campaigns increased spend by 20%. A’s installs fell from 350 to 280, while B’s increased from 350 to 420. The unchanged overall install count hides this difference.

With B’s CPI unchanged, there is a reason to investigate A first. That does not prove a setting in A is wrong. Use [campaign variance analysis](/tools/campaign-variance) with aligned periods to inspect mix and efficiency, then review A’s impressions, clicks, installs and operating history. Decomposition methods allocate interactions differently; read the definition of each term.

## 4. Keep ROAS and incremental impact separate

There is no revenue column in this file. It establishes a CPI increase, not a ROAS decline or a loss of profit. Post-install purchases and customer value may also have changed.

If revenue is available, align it with spend on period, currency and attribution rules. In the [Google Ads glossary](https://support.google.com/google-ads/answer/12851704?hl=en), ROAS divides conversion value by spend. Using revenue as that value does not make it a profit margin. Calculate your totals in the [ROAS calculator](/calculator/roas), then continue to the [ROAS investigation steps](/blog/roas-improvement).

The difference advertising makes relative to no advertising requires a control or another comparison design. [Google Meridian’s causal assumptions](https://developers.google.com/meridian/docs/causal-inference/required-assumptions) explain why observational models also require assumptions for causal interpretation. A campaign cost table cannot establish that A produced no incremental installs.

## 5. Write the next review into the decision

A useful report should be more specific than “efficiency deteriorated, so we will cut budget.” Separate observed facts, unverified explanations and possible actions.

| Category | What to record in this example |
|---|---|
| Observation | Overall CPI +20%; A at KRW 1,500, B at KRW 1,000 |
| Hypotheses to inspect | A’s conversion delay, setting changes, traffic mix and creative response |
| Immediate decision to consider | Whether to hold further scaling of A while checking its change history |
| Next comparison | Equally mature, equal-length periods with the same conversion definition |
| Remaining limits | Revenue, profit and incremental effects are unavailable |

Holding further scaling is an example of a judgment, not an optimal action calculated by this dataset. Actual decisions need target costs, customer value, learning status and business constraints. Improvement after an action also needs further design before attributing the change to that action.

Use the [weekly report template](/blog/weekly-marketing-report-template) to carry these distinctions into the next review. For a different question, compare data requirements in the [marketing analysis hub](/compare).

## Continue with your own data

After exploring the example, prepare a daily campaign CSV. In [campaign variance analysis](/tools/campaign-variance), map date, campaign, spend and installs; check the source currency and the two comparison periods before running it. If your outcome is a purchase or signup, follow the conversion-basis and mapping guidance so it is not misread as an install.

Analysis is free, and CSVs are processed in your browser. If you are unsure which data to prepare, [find supported analyses for your CSV](/start) by checking its columns and shape first.
