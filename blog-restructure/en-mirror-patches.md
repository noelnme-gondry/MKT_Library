# EN 미러 패치 — KR 수정과 동기화할 4편

KR 수정 대상 14편 중 EN 짝(/en/blog)이 존재하는 4편의 반영 내용입니다. EN 원문 파일이 없어 완성본 대신 **적용 패치** 형태로 드려요. 각 항목을 해당 EN 파일의 같은 위치에 반영하면 됩니다. KR과 같은 주차에 머지하세요.

---

## 1. ad-performance-drop (EN: "Ad Performance Suddenly Dropped? Here's Where to Look First")

**New title:**
> Ad Performance Cut in Half? Touching Creative First Means Missing the Cause

**New description:**
> When performance tanks, blaming creative first hides the real cause. A 4-step route — verify the numbers, split by channel, mix vs. efficiency, trace the funnel — plus the signals to distrust on days performance suddenly *improves*.

**New hook (replace first paragraph):**
> You open the dashboard Monday morning, CPA has doubled, and your hand reaches for the creative swap. But the cause of a sudden drop is more often in measurement or budget mix than in creative. This post gives you a 4-step checking route, starting with what you can verify in 10 minutes without spending a won. Touch things before you know the cause, and you fix nothing — and never learn what worked.

**Insert after the tracking paragraph (experience block):**
> Here's the most common pattern in practice. An app update ships Thursday; from Friday, conversions *appear* down 70%. The team spends the weekend in creative reviews and pushes new assets Monday — then discovers the new build dropped the conversion event call (numbers are illustrative). Performance was fine; only the numbers had vanished. The one habit that saves that week: put your release calendar and your conversion-count graph side by side.

**New section before "What to do today" (absorbs the anomaly-detection post):**
> ## Be Just as Suspicious on Days Performance Suddenly Improves
>
> Drops aren't the only thing worth diagnosing. A day when CPA suddenly looks great deserves the same route — duplicate measurement, junk conversions, or a mix shift can all make things *look* better. Raising budget on excitement is the same mistake as swapping creative in a panic.
>
> Before either, define "spiked." Daily numbers wobble by nature — weekday effects, thin samples, settlement delays. Don't react to "20% vs. yesterday"; react only when today falls outside a recent-N-day moving average ± variability band. Inside the band is normal noise, and touching it just [resets platform learning](/en/blog/ad-machine-learning).
>
> If it's a real deviation, decompose it: is it volume (spend/impressions changed) or efficiency (conversion rate/costs changed)? Mixed together, you only learn "CPA moved." Split, you learn *which channel's efficiency* moved the total.
>
> If running this band math daily by hand is a chore, the free [anomaly-detection tab](/dashboard) flags spiking days automatically and [variance decomposition](/tools/campaign-variance) splits the cause into volume vs. efficiency. Upload a CSV or connect a Google Sheet; data stays in your browser. One caveat: anomaly detection says "this looks off" — it doesn't prove a cause. Treat it as the start of the investigation, not the verdict.

**Keywords to append:** sudden performance improvement, campaign anomaly detection, campaign monitoring

---

## 2. performance-marketing-metrics (EN: "Performance Marketing Metrics: Stop Memorizing Them, Read Them as a Chain")

Title/hook unchanged. Two insertions:

**FAQ item to add:**
> Q: What's the difference between CPM, CPC, CPI, and CPA?
> A: They're costs attached to different funnel stages. CPM is cost per 1,000 impressions, CPC per click, CPI per install, CPA per action (signup/purchase). The further right, the closer to revenue; the earlier metrics are diagnostics that tell you *why*.

**New section between current sections 2 and 3 (absorbs the CPM/CPC/CPI/CPA post). Renumber the old section 3 to 4:**
> ## 3. The Chain Isn't Complete Until You Add CPM and CPC Up Front
>
> The chain above started at installs (CPI), but two more cells sit in front: impressions and clicks.
>
> - **CPM** (Cost Per Mille): cost per 1,000 impressions — closest to the raw price you pay the platform.
> - **CPC** (Cost Per Click): cost per click; connects as CPM ÷ CTR.
>
> Line it all up (numbers are illustrative): ₩10M in spend buys 5M impressions → CPM ₩2,000. 50K clicks → CTR 1%, CPC ₩200. 5,000 installs → CPI ₩2,000. 500 signups → CPA ₩20,000. Stand the whole line up and you see exactly where cost accumulates.
>
> This matters because **CPA is the result; CPM, CTR, and CVR are the causes.** High CPA with high CPM → auction competition or expensive targeting. Low CTR → creative or targeting. Low conversion rate → landing page or [funnel](/en/blog/funnel-dropoff-analysis). Staring at the result alone can't tell you whether to swap creative or change targeting.
>
> Optimization targets follow the goal: awareness → CPM/reach, traffic → CPC, installs → CPI, revenue/signups → CPA (or [ROAS](/en/blog/roas-improvement)). But optimize on early metrics alone and you'll buy cheap installs who never purchase. Go as far down the money-action chain as you can — a cheap CPI is only good if those users [stick around](/en/blog/cohort-analysis-guide) and pay.

**Keywords to append:** CPM, CPC, CPI vs CPA, ad cost metrics

**Note:** EN counterpart of `/blog/cohort-analysis-guide` and `/blog/funnel-dropoff-analysis` don't exist yet (EN gap). Point those two links at the KR posts, existing EN glossary entries, or drop the links until the EN translations ship — don't link to nonexistent /en/blog slugs.

---

## 3. marketing-mix-modeling (EN: "What Is MMM: Measuring Channel Contribution Beyond Attribution Models")

**New title:**
> When Last-Click Only Praises Brand Search — Measuring Channel Contribution with MMM

**New description:**
> Last-click credits whichever channel stood last in line — which is why brand search ROAS always looks heroic. How MMM back-calculates each channel's real contribution from aggregate data (regression, adstock, saturation), and where its limits are.

**New hook (replace first paragraph; keep the second):**
> Ever raised budget on brand search because its ROAS looked outstanding — and watched total revenue stay flat? Last-click praises only the channel that stood **last** in the journey; the credit earned by channels that created the demand upstream all flows to the final click. When one person sees dozens of ads across channels in a single day, judging performance with last-touch attribution alone stops making sense. And multi-touch attribution never quite delivers a clear answer either.

**Also update the in-body H1** to match the new title.

---

## 4. performance-marketer-skills (EN: "Essential Performance Marketer Skills: Why Memorizing Tool Names Gets the Order Wrong")

**No changes needed.** The EN title already carries the angle the KR title just adopted — the KR was updated to match the EN, not the other way around. Verify hook/description parity and move on.

---

## 공통 주의

- EN도 슬러그 불변, title·H1·description·본문 삽입만.
- 실질 수정이므로 updated 날짜 갱신은 자연스럽게. 발행일 유지.
- 링크는 반드시 /en/blog 인벤토리에 실제 존재하는 슬러그만. 없는 EN 짝은 링크 생략이 안전.
