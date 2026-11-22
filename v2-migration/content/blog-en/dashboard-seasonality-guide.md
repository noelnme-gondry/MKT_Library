---
title: "Using the Seasonality dashboard to test a recurring November peak"
description: "Read the yearly overlay, seasonal index and heatmap using a two-year monthly installs example."
date: "2026-11-22"
updated: "2026-11-22"
reviewedAt: "2026-11-22"
slug: "dashboard-seasonality-guide"
primaryTool: "5-2"
tags: ["Analytics"]
draft: false
faq:
  - q: "Why can't I select a weekly view for this example?"
    a: "A monthly total does not tell you how many installs occurred in each week. Use daily or weekly source data to investigate a weekly calendar effect."
  - q: "Can I use November +50% as the revenue forecast for next year?"
    a: "The figure measures installs against the average month in each observed year. A revenue forecast also needs assumptions about audience, spend, conversion and revenue per customer."
---

November installs are higher than last November. Is the peak stronger, or did the entire market grow? Seasonality gives you two ways to read the same month. Absolute installs tell an operations team how much volume to handle. The seasonal index tells a planner how unusual that volume was within its own year.

## Open a monthly series with two complete years

The example contains monthly observations for one country and channel. Open the tab with Installs selected, Monthly as the calendar unit and Remove trend off. The summary reads **Nov +50.0%**. Coverage shows twelve months in 2023 and twelve in 2024. The weekly option is unavailable because the monthly source contains no evidence about how its installs were distributed across weeks.

## Read the overlay and heatmap in different directions

![Calendar heatmap showing +50 in the November column for both 2023 and 2024](/blog-assets/dashboard-guides/seasonality-en.webp)

On Actual values by year, follow one coloured line across the months, then point at November on both lines. November has 1,500 installs in 2023 and 1,800 in 2024. The higher line describes additional volume and may matter to a support team planning capacity.

Now read the Year × calendar period heatmap. Each row is a year. Read down the November column to compare the same calendar position across years. Both cells show +50. Read across a single row and September and October each show −25. The cells describe deviation from the year's baseline. The text in a cell gives a more precise comparison than its colour alone.

## Recover the number behind the summary

| Year | Total installs | Monthly mean | November installs | Deviation |
|---|---:|---:|---:|---:|
| 2023 | 12,000 | 1,000 | 1,500 | +50% |
| 2024 | 14,400 | 1,200 | 1,800 | +50% |

For 2024, divide 1,800 by 1,200 and multiply by 100. The index is 150, or 50% above baseline. November grew 20% year over year, and so did the annual monthly mean. The scale changed while the relative peak held steady. The +50.0% shown by the tab summarizes that recurring deviation. It is not a forecast of next year's growth.

## Check what survives a different baseline

A business growing rapidly within a year may show a high December even without a seasonal peak. Switch on Remove trend. For monthly input the comparison uses a centred five-month moving average; the weekly version uses a thirteen-week window. The verification chart shows the actual series and the trend used in the division. Inspect them around the peak and check whether the same period still stands out. At the edges there are fewer neighbouring observations.

For live data, hold the country, channel mix and metric definition as steady as possible. A holiday or launch does not occur on the same commercial calendar in every market. For ratio metrics such as CPI the software sums the period's numerator and denominator before dividing. A spreadsheet average of daily CPIs can disagree even with a perfectly matching export.

## Turn a repeatable pattern into a planning assumption

A repeatable November peak justifies preparing a demand scenario. Compare the promotion and spend calendars before attributing the peak to customer demand. If spend rose every November, the calendar pattern also captures part of your own operating schedule. Write down a base case and a lower-demand case, then use [Pacing](/en/blog/dashboard-pacing-guide) during the month to see how the budget is actually being consumed.
