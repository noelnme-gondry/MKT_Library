// ── Demo data generator ─────────────────────────────────────────────────────
// Deterministic (seededNoise / LCG — NO Math.random, §3) sample datasets that
// produce MEANINGFUL results in every tool. Wired to the "데모 데이터" button in
// CsvUploader (efficiency·creative·experiment groups) and the self-hosted
// dropzones of 5-18 (response) and 5-20 (aha).
//
// buildDemoCsv(group) → { raw, headers, mapping, fileName }
//   - raw:     array of row objects keyed by header (numbers for metrics, strings for dims)
//   - headers: header order
//   - mapping: header → standard-field key ("__ignore__" to skip). Empty {} for
//              tools that read raw props directly (5-4) or use their own colMap (5-18/5-20).
//   - fileName: shown in the file-state chip.
//
// Signal baked into each group:
//   efficiency  cost^0.7 diminishing installs (saturation), channel efficiency
//               spread (realloc), period variance (PVM), full funnel + revenue/retention.
//   creative    per-creative CTR/CVR spread + fatigue over time (forest + fatigue meaningful).
//   experiment  3 arms, one clear winner; control vs test lift large-n significant; holdout split.
//   response    weekly signups = adstock-saturated spend contributions + trend + seasonality.
//   aha         convert strongly tied to messages/matches, weakly to boost (lift/F1 spread).

import { seededNoise, generateDates } from "./testFixtures";

const round = (v) => Math.round(v);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ── efficiency (5-2 / 5-21 / 5-22 / 5-3) ────────────────────────────────────
function buildEfficiency() {
  const headers = [
    "date", "country", "platform", "channel", "campaign_name", "creative_id",
    "cost", "impressions", "clicks", "installs", "actions",
    "revenue_d7", "pu_d7", "ret_d7",
  ];
  // Channels differ in base efficiency (→ realloc opportunity in 5-3) and
  // saturation exponent (→ 5-22 marginal vs avg CPA spread).
  const channels = [
    { name: "Google UAC", eff: 1.00, satExp: 0.68, arppu: 14000, cvr: 0.42 },
    { name: "Meta AAP",   eff: 0.82, satExp: 0.62, arppu: 12000, cvr: 0.38 },
    { name: "TikTok",     eff: 1.35, satExp: 0.74, arppu: 9000,  cvr: 0.30 },
    { name: "Apple Search Ads", eff: 0.70, satExp: 0.58, arppu: 18000, cvr: 0.50 },
  ];
  const campaignsPer = ["Prospecting", "Retargeting"];
  const dates = generateDates(45, "2024-01-01");
  const raw = [];
  let seed = 71;
  for (const ch of channels) {
    for (let ci = 0; ci < campaignsPer.length; ci++) {
      const campaign = `${ch.name.split(" ")[0]} - ${campaignsPer[ci]}`;
      for (let cr = 0; cr < 2; cr++) {
        const creativeId = `${ch.name.split(" ")[0].toLowerCase()}_${campaignsPer[ci].slice(0, 3).toLowerCase()}_cr${cr + 1}`;
        const platform = cr === 0 ? "Android" : "iOS";
        const country = ci === 0 ? "KR" : "US";
        const rnd = seededNoise((seed += 17));
        // base daily spend ramps up over the window (→ saturation visible at high spend)
        const baseSpend = 600000 * (1 + cr * 0.35) * (ci === 1 ? 0.6 : 1);
        for (let d = 0; d < dates.length; d++) {
          const ramp = 1 + (d / dates.length) * 1.6; // spend grows ~2.6x
          const noise = 1 + rnd() * 0.28;
          const cost = baseSpend * ramp * noise;
          // diminishing installs: installs ∝ cost^satExp / eff
          const installs = Math.max(1, round((Math.pow(cost, ch.satExp) / (14 * ch.eff)) * (1 + rnd() * 0.18)));
          const clicks = round(installs * (9 + rnd() * 4)); // CVR ~8-11%
          const impressions = round(clicks * (38 + rnd() * 20)); // CTR ~2-3%
          const actions = round(installs * ch.cvr * (1 + rnd() * 0.2));
          const pu = round(actions * (0.55 + rnd() * 0.15));
          const revenue = round(pu * ch.arppu * (1 + rnd() * 0.25));
          const ret = round(installs * (0.22 + rnd() * 0.08)); // retained-user count (>1 → count basis)
          raw.push({
            date: dates[d], country, platform, channel: ch.name,
            campaign_name: campaign, creative_id: creativeId,
            cost: round(cost), impressions, clicks, installs, actions,
            revenue_d7: revenue, pu_d7: pu, ret_d7: ret,
          });
        }
      }
    }
  }
  const mapping = {};
  headers.forEach((h) => { mapping[h] = h; }); // all headers are canonical std keys
  return { raw, headers, mapping, fileName: "demo_efficiency.csv" };
}

// ── creative (5-6) ──────────────────────────────────────────────────────────
function buildCreative() {
  const headers = [
    "creative_id", "date", "channel", "impressions", "clicks", "installs",
    "spend", "revenue_d7", "video_3s_views", "video_completions",
  ];
  // Creatives with distinct CTR/CVR; some fatigue (CTR decays), some stable.
  const creatives = [
    { id: "video_hook_A", ch: "Meta AAP", ctr: 0.032, cvr: 0.14, fatigue: 0.010, arppu: 13000 },
    { id: "video_hook_B", ch: "Meta AAP", ctr: 0.028, cvr: 0.11, fatigue: 0.004, arppu: 12000 },
    { id: "ugc_testimonial", ch: "TikTok", ctr: 0.041, cvr: 0.09, fatigue: 0.014, arppu: 9000 },
    { id: "ugc_trend", ch: "TikTok", ctr: 0.036, cvr: 0.08, fatigue: 0.002, arppu: 8500 },
    { id: "static_offer", ch: "Google UAC", ctr: 0.018, cvr: 0.16, fatigue: 0.001, arppu: 15000 },
    { id: "static_feature", ch: "Google UAC", ctr: 0.021, cvr: 0.13, fatigue: 0.007, arppu: 14000 },
    { id: "carousel_social", ch: "Meta AAP", ctr: 0.024, cvr: 0.10, fatigue: 0.005, arppu: 11000 },
    { id: "playable_demo", ch: "Apple Search Ads", ctr: 0.045, cvr: 0.19, fatigue: 0.003, arppu: 18000 },
  ];
  const dates = generateDates(30, "2024-02-01");
  const raw = [];
  let seed = 131;
  for (const c of creatives) {
    const rnd = seededNoise((seed += 23));
    for (let d = 0; d < dates.length; d++) {
      const decay = Math.max(0.3, 1 - c.fatigue * d); // CTR fatigue over run
      const impressions = round((120000 + rnd() * 40000));
      const ctr = clamp01(c.ctr * decay * (1 + rnd() * 0.12));
      const clicks = round(impressions * ctr);
      const cvr = clamp01(c.cvr * (1 + rnd() * 0.15));
      const installs = round(clicks * cvr);
      const cpc = 380 + rnd() * 160;
      const spend = round(clicks * cpc);
      const pu = installs * (0.5 + rnd() * 0.15);
      const revenue = round(pu * c.arppu * (1 + rnd() * 0.2));
      const v3s = round(impressions * (0.55 + rnd() * 0.15));
      const vcomp = round(v3s * (0.25 + rnd() * 0.15));
      raw.push({
        creative_id: c.id, date: dates[d], channel: c.ch,
        impressions, clicks, installs, spend, revenue_d7: revenue,
        video_3s_views: v3s, video_completions: vcomp,
      });
    }
  }
  const mapping = {};
  headers.forEach((h) => { mapping[h] = h; });
  return { raw, headers, mapping, fileName: "demo_creative.csv" };
}

// ── experiment (5-4) ────────────────────────────────────────────────────────
// 5-4 reads raw props directly (is_control/arm_id/holdout_group/numerator/
// denominator) — no mapping needed. 3 arms, Variant A clear winner.
function buildExperiment() {
  const headers = ["date", "arm_id", "is_control", "holdout_group", "numerator", "denominator"];
  const arms = [
    { id: "Control",   control: 1, group: "control", cvr: 0.050 },
    { id: "Variant A", control: 0, group: "test",    cvr: 0.062 }, // winner (+24%)
    { id: "Variant B", control: 0, group: "test",    cvr: 0.053 },
  ];
  const dates = generateDates(30, "2024-03-01");
  const raw = [];
  let seed = 211;
  for (const a of arms) {
    const rnd = seededNoise((seed += 29));
    for (let d = 0; d < dates.length; d++) {
      const denominator = round(8000 + rnd() * 1200);
      const numerator = round(denominator * a.cvr * (1 + rnd() * 0.10));
      raw.push({
        date: dates[d], arm_id: a.id, is_control: a.control,
        holdout_group: a.group, numerator, denominator,
      });
    }
  }
  return { raw, headers, mapping: {}, fileName: "demo_experiment.csv" };
}

// ── response (5-18) ─────────────────────────────────────────────────────────
// 5-18 uses its own colMap (autoGuessColMap detects week/reg/*_spend by name).
// signups = trend + seasonality + adstock-saturated contribution of each channel.
function buildResponse() {
  const headers = ["week", "signups", "google_spend", "meta_spend", "tiktok_spend", "brand_spend"];
  const nWeeks = 78;
  // channel: spend generator + response coefficient + adstock decay + saturation half-point
  const chans = [
    { key: "google_spend", coef: 0.85, lambda: 0.4, half: 40000000, base: 30000000, amp: 0.5 },
    { key: "meta_spend",   coef: 0.60, lambda: 0.5, half: 30000000, base: 22000000, amp: 0.6 },
    { key: "tiktok_spend", coef: 0.45, lambda: 0.3, half: 18000000, base: 8000000,  amp: 1.1 },
    { key: "brand_spend",  coef: 1.10, lambda: 0.6, half: 12000000, base: 6000000,  amp: 0.3 },
  ];
  const rndSpend = {};
  chans.forEach((c, i) => { rndSpend[c.key] = seededNoise(311 + i * 13); });
  const rndY = seededNoise(907);
  // week start dates
  const start = Date.parse("2023-01-02");
  const raw = [];
  const adstock = {}; chans.forEach((c) => { adstock[c.key] = 0; });
  for (let w = 0; w < nWeeks; w++) {
    const weekStr = new Date(start + w * 7 * 86400000).toISOString().slice(0, 10);
    const row = { week: weekStr };
    let contrib = 0;
    for (const c of chans) {
      // spend: base * (trend) * (seasonal) * noise
      const trend = 1 + (w / nWeeks) * 0.6;
      const seasonal = 1 + c.amp * 0.3 * Math.sin((w / 52) * 2 * Math.PI);
      const spend = Math.max(0, c.base * trend * seasonal * (1 + rndSpend[c.key]() * 0.35));
      row[c.key] = round(spend);
      // adstock carryover
      adstock[c.key] = spend + c.lambda * adstock[c.key];
      // hill saturation on adstocked spend
      const sat = adstock[c.key] / (adstock[c.key] + c.half);
      contrib += c.coef * sat * 12000; // scale to signups units
    }
    const baseline = 3500 + w * 22; // organic trend
    const season = 900 * Math.sin((w / 52) * 2 * Math.PI + 1);
    const signups = Math.max(0, round(baseline + season + contrib + rndY() * 700));
    row.signups = signups;
    raw.push(row);
  }
  return { raw, headers, mapping: {}, fileName: "demo_response.csv" };
}

// ── aha (5-20) ──────────────────────────────────────────────────────────────
// 5-20 auto-detects: id (header has user/id), target (binary 0/1), features
// (other numeric cols). convert prob rises with matches/messages, weak for boost.
function buildAha() {
  const headers = [
    "user_id", "converted",
    "matches_first_7d", "messages_sent_7d", "profile_completed", "boost_used",
  ];
  const nUsers = 800;
  const rnd = seededNoise(4242);
  const raw = [];
  for (let u = 0; u < nUsers; u++) {
    // latent engagement level drives both actions and conversion
    const eng = clamp01(0.5 + rnd() * 1.0); // skewed toward some engaged
    const matches = Math.max(0, round(eng * 12 * (0.6 + rnd() + 0.5))); // 0..~18
    const messages = Math.max(0, round(eng * 40 * (0.5 + rnd() + 0.5))); // 0..~60
    const profile = rnd() + 0.5 > (0.35 + eng * 0.3) ? 1 : 0;
    const boost = rnd() + 0.5 > 0.75 ? 1 : 0; // ~25% use boost, weakly tied
    // conversion: strong on messages≥~20 & matches≥~5, weak boost
    const score =
      (messages >= 20 ? 0.45 : messages * 0.012) +
      (matches >= 5 ? 0.28 : matches * 0.03) +
      profile * 0.08 +
      boost * 0.03 +
      rnd() * 0.18;
    const converted = score > 0.55 ? 1 : 0;
    raw.push({
      user_id: `u${10000 + u}`,
      converted,
      matches_first_7d: matches,
      messages_sent_7d: messages,
      profile_completed: profile,
      boost_used: boost,
    });
  }
  return { raw, headers, mapping: {}, fileName: "demo_aha.csv" };
}

const BUILDERS = {
  efficiency: buildEfficiency,
  creative: buildCreative,
  experiment: buildExperiment,
  response: buildResponse,
  aha: buildAha,
};

// group name (TOOL_GROUP value) → demo csv. Falls back to efficiency.
export function buildDemoCsv(group) {
  const fn = BUILDERS[group] || BUILDERS.efficiency;
  return fn();
}
