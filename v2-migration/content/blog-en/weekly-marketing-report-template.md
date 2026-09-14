---
title: "Weekly Marketing Report Template: From Metrics to Decisions"
description: "Build a weekly marketing report with a two-week campaign CSV, a blank worksheet and a completed example. Align comparisons, decisions and review dates."
date: "2026-09-14"
updated: "2026-09-14"
slug: "weekly-marketing-report-template"
keywords: "Weekly Marketing Report, Template"
searchTitleTerms: ["Weekly Marketing Report", "Template"]
tags: ["Analysis Methodology"]
draft: false
sources: [{"title": "Google Analytics: Data freshness", "url": "https://support.google.com/analytics/answer/11198161?hl=en"}]
faq: [{"q": "Is the worksheet free?", "a": "The synthetic CSV and blank report worksheet attached to this article are public resources. Product project storage and analysis-report downloads follow the separate pass entitlement."}, {"q": "Should I cut spend when CPI rises week over week?", "a": "Check conversion maturity, measurement definitions and campaign composition first. An observed CPI rise alone establishes neither the cause nor the optimal budget."}]
reviewedAt: "2026-09-14"
reviewer: "Codex (AI-assisted editorial review)"
---
A weekly marketing report should leave the reader with a decision to make or a question to resolve. Copying spend and installs into a slide is only the beginning. Record the evidence, the hypothesis, the owner and the next review date.

This worked example uses synthetic install-campaign data. Download the [campaign CSV](/examples/weekly-report-campaigns.csv), [blank report worksheet](/examples/weekly-report-template-en.csv) and [completed example](/examples/weekly-report-filled-en.csv). Only the campaign CSV is an analysis input; the other files are writing worksheets.

## Fix four comparison conditions first

Compare August 31–September 6, 2026 with September 7–13: two Monday-to-Sunday weeks. The time zone is Korea, the currency is KRW, and the outcome is installs under one attribution definition. Both weeks are assumed mature in this example. For a real export, record the extraction time and check platform-specific conversion lag.

Installs cannot stand in for new paying customers. Resolve mixed purchase, signup and install definitions using the [data preparation guide](/guide/csv-data-prep). Compare ROAS only when the revenue observation windows also match.

## Spend rose 20% while installs stayed at 700

| Campaign | Prior spend / installs | Current spend / installs | Cost per install |
| --- | --- | --- | --- |
| A | KRW 350,000 / 350 | KRW 420,000 / 280 | 1,000 → 1,500 |
| B | KRW 350,000 / 350 | KRW 420,000 / 420 | 1,000 → 1,000 |
| Total | KRW 700,000 / 700 | KRW 840,000 / 700 | 1,000 → 1,200 |

Spend increased by KRW 140,000 without adding installs overall. A lost installs after spending more; B's spend and installs rose together. Calculate total CPI from total spend divided by total installs, not the unweighted average of campaign CPIs.

## Inspect the campaign changes in the CSV

Open the demo below and check the spend and install mappings. In the full campaign-variance tool, select the two periods above and compare the totals with the table. The file contains two campaigns per day for 14 days, or 28 rows.

The decomposition describes arithmetic components of observed change. It cannot establish whether creative, auctions or tracking caused A's decline. Follow the [performance diagnosis guide](/blog/ad-performance-diagnosis) to inspect change history and narrower metrics.

## Separate observations, hypotheses and decisions

![Four stages of a weekly report: observation, hypothesis, decision and review](/blog-assets-en/weekly-marketing-report-template/review-loop.svg)

| Field | Completed example |
| --- | --- |
| Observation | Spend +20%; installs remain 700. A's CPI +50% |
| Hypothesis to check | Did A's placement mix, creative or tracking change in the same week? |
| Decision | Hold further scaling of A. Do not scale B solely on its current average efficiency |
| Owner and review | Campaign owner; review on September 21 after checking maturity |

September 21 is this example's review commitment, not a universal data-finalization date. Specify both when to review and what to inspect. B's stable average efficiency does not guarantee the same return on additional spend. Check [marginal efficiency and allocation](/blog/budget-marginal-efficiency) separately.

## Start next week with the previous decision

Ask whether the reason for holding a decision has been resolved. Record campaigns left unchanged too: that helps distinguish actions taken from external changes later.

Use [weekly review](/weekly-review) to revisit the periods, KPI and decision. Running analysis and viewing results are free. Projects and new review or decision saves require active Pro; saving decision records also requires sign-in. The 14-day trial includes project and review storage, while analysis-report downloads require a purchased pass. The public examples and blank worksheet in this article are separate from product-generated report downloads.

## Reduce repeated work at the input stage

If combining exports takes most of the week, continue with [BigQuery, Google Sheets and analysis-ready CSVs](/blog/marketing-report-sheets-bigquery). A cleaner collection process still needs definition and maturity checks. A report becomes reusable when the next week's data can actually test the decision you recorded.
