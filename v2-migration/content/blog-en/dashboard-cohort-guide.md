---
title: "Reading D7 and D14 retention in the Cohort dashboard"
description: "Follow eligible installs and returning users through two cohort ages before drawing a retention conclusion."
date: "2026-11-22"
updated: "2026-11-22"
reviewedAt: "2026-11-22"
slug: "dashboard-cohort-guide"
primaryTool: "5-2"
tags: ["Analytics"]
draft: false
faq:
  - q: "Does a smaller D14 denominator mean the export lost records?"
    a: "Recent installs may have reached day seven but not day fourteen by the snapshot. Check eligibility, the actual extraction date and source completeness before treating the difference as data loss."
  - q: "Can I average the D7 percentages reported by my channels?"
    a: "Only equal-sized eligible groups would give each channel equal weight. Recompute the combined rate from total eligible returns and total eligible installs to match the dashboard."
---

D7 retention is 12.0% and D14 is 8.4%. It is tempting to say that the same group lost 3.6 percentage points of users in a week. The eligible installation base is smaller at D14, and the table does not identify individual visitors. Use the Cohort tab to work out exactly which returns and which installs went into each point on the curve.

## Open a mature-cohort comparison

The example opens with Installs as the basis, March 30, 2024 as the data snapshot and Matured Only selected. The snapshot says how far the export could observe a return. Replacing an old file's extraction date with today's date can make cohorts appear old enough for events the exporter never observed.

## Reproduce each point with its own denominator

![Retention table showing returning users and eligible installs beside each D7 and D14 rate](/blog-assets/dashboard-guides/cohort-en.webp)

| Age | Retained users | Eligible installs | Weighted retention |
|---|---:|---:|---:|
| D0 | 1,754,745 | 1,754,745 | 100.0% |
| D7 | 190,542 | 1,581,463 | 12.0% |
| D14 | 119,104 | 1,412,968 | 8.4% |

Divide 190,542 by 1,581,463 for D7. For D14, change both numerator and denominator. The 1,412,968 installs were eligible to reach fourteen days by the snapshot. They are not a random subsample of every install in the file. The D0 point represents the acquisition baseline.

## Read the curve and segment panels in the right order

The horizontal axis is age since installation. The line connecting the D7 and D14 points summarizes returns at different ages. It does not tell you whether a particular person present on D7 also returned on D14. Match each plotted point to its eligible base in the table before explaining a decline.

Next, compare channels, countries or platforms at one age. A small segment can move sharply on a handful of returns. Report raw returns and eligible installs alongside the percentage. To reproduce an overall rate, sum returns across eligible rows and divide by the sum of their eligible bases. An unweighted average of segment percentages can give a tiny channel disproportionate influence.

## Troubleshoot a mismatch with your own export

Pick either the install or signup basis and confirm it matches the return fields you supplied. For rate inputs, use a fraction such as 0.30. For a count, provide the count. A whole number such as 30 entered to mean 30% can be interpreted as thirty people instead. Check the export's field definition before changing a formula to force agreement.

Compare Include All with Matured Only to see which recent cohorts change the denominator. Return to the matured setting before preparing a report about observed D14 outcomes. When a campaign has just scaled, the mature group can have a different channel mix from the installs you acquired this week.

## Choose a testable follow-up

For an onboarding change, select installs acquired before release and those acquired afterwards. Compare **D7 with D7**, after both groups have had seven observable days. Check channel and country mix. If a difference remains, examine the onboarding steps changed in that release. To investigate whether same-age users generated more revenue, keep the install basis and continue to [LTV and ROAS](/en/blog/dashboard-ltv-guide).
