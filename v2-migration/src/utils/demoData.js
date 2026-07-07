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
    "revenue_d0", "revenue_d7", "revenue_d14", "pu_d7", "pu_d14", "ret_d7", "ret_d14",
  ];
  // Channels differ in base efficiency (→ realloc opportunity in 5-3) and
  // saturation exponent (→ 5-22 marginal vs avg CPA spread).
  const channels = [
    { name: "Google UAC", eff: 1.00, satExp: 0.68, arppu: 14000, cvr: 0.42 },
    { name: "Meta AAP",   eff: 0.82, satExp: 0.62, arppu: 12000, cvr: 0.38 },
    { name: "TikTok",     eff: 1.35, satExp: 0.74, arppu: 9000,  cvr: 0.30 },
    { name: "Apple Search Ads", eff: 0.70, satExp: 0.58, arppu: 18000, cvr: 0.50 },
  ];
  const campaignsPer = ["Prospecting", "Retargeting", "Lookalike"];
  const dates = generateDates(90, "2024-01-01");
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
          const revenue = round(pu * ch.arppu * (1 + rnd() * 0.25)); // D7 매출
          // 리텐션(잔존 인원 count). 분모가 설치(installs) 또는 가입(actions≈0.27~0.33×installs)
          // 어느 쪽이든 100% 넘지 않게 actions보다 작게 생성(0.09~0.15×installs).
          const ret = round(installs * (0.12 + rnd() * 0.06));
          // 성숙 곡선 — 매출·결제는 누적 성장(D0<D7<D14), 리텐션은 감소(D14<D7).
          const revenueD0 = round(revenue * (0.38 + rnd() * 0.06));
          const revenueD14 = round(revenue * (1.35 + rnd() * 0.12));
          const puD14 = round(pu * (1.12 + rnd() * 0.08));
          const retD14 = round(ret * (0.70 + rnd() * 0.08));
          raw.push({
            date: dates[d], country, platform, channel: ch.name,
            campaign_name: campaign, creative_id: creativeId,
            cost: round(cost), impressions, clicks, installs, actions,
            revenue_d0: revenueD0, revenue_d7: revenue, revenue_d14: revenueD14,
            pu_d7: pu, pu_d14: puD14, ret_d7: ret, ret_d14: retD14,
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
// Concept Matrix(§8) 기본 축 = message_angle × format → 조합별 셀에 소재 ≥5개
// (minNCell=5) 채우려면 소재를 조합 순회로 다수 생성 + 속성 컬럼 필수.
// 속성별 효과(멀티플라이어)를 심어 §4 WLS 분해도 유의 신호 산출.
function buildCreative() {
  const headers = [
    "creative_id", "date", "channel", "impressions", "clicks", "installs",
    "spend", "revenue_d7", "video_3s_views", "video_completions",
    "message_angle", "format", "hook_type", "cta_style", "first_3s",
    "duration_bucket", "has_text_overlay",
  ];
  // 속성 어휘 + CTR/CVR 효과 (합성 신호)
  const angles = [
    { v: "할인혜택", ctr: 0.004, cvr: 0.02 },
    { v: "사회적증거", ctr: 0.009, cvr: 0.03 },
    { v: "기능강조", ctr: 0.000, cvr: 0.01 },
    { v: "감성스토리", ctr: 0.003, cvr: -0.01 },
  ];
  const formats = [
    { v: "UGC", ctr: 0.006, cvr: 0.00, isVideo: true },
    { v: "제작영상", ctr: 0.002, cvr: 0.02, isVideo: true },
    { v: "정적이미지", ctr: -0.004, cvr: 0.01, isVideo: false },
    { v: "플레이어블", ctr: 0.010, cvr: 0.04, isVideo: true },
  ];
  const hooks = ["문제제기", "호기심", "혜택제시"];
  const ctas = ["지금설치", "무료체험", "한정할인"];
  const first3 = ["얼굴클로즈업", "텍스트훅", "제품시연"];
  const durations = ["<10s", "10-20s", "20s+"];
  const channels = ["Meta AAP", "TikTok", "Google UAC", "Apple Search Ads"];
  const baseCtr = 0.022, baseCvr = 0.12, baseArppu = 12000;
  const dates = generateDates(28, "2024-02-01");
  // 조합별 상태 플랜 — 셀이 전부 "검증"만 나오지 않게 다채롭게:
  //  V=검증(n6·정상노출) · S=데이터부족(n3) · P=유망(n5·저노출<3000) · _=미관측(생성 안 함)
  const plan = {
    "할인혜택|UGC": "P", "할인혜택|정적이미지": "V", "할인혜택|제작영상": "S", "할인혜택|플레이어블": "_",
    "사회적증거|UGC": "V", "사회적증거|정적이미지": "V", "사회적증거|제작영상": "V", "사회적증거|플레이어블": "S",
    "기능강조|UGC": "V", "기능강조|정적이미지": "V", "기능강조|제작영상": "_", "기능강조|플레이어블": "V",
    "감성스토리|UGC": "V", "감성스토리|정적이미지": "S", "감성스토리|제작영상": "V", "감성스토리|플레이어블": "P",
  };
  const raw = [];
  let cIdx = 0, seed = 131;
  for (const ang of angles) {
    for (const fmt of formats) {
      const code = plan[`${ang.v}|${fmt.v}`] || "V";
      if (code === "_") continue; // 미관측 조합 — 소재 없음
      const nCre = code === "S" ? 3 : code === "P" ? 5 : 6;
      const lowImp = code === "P";           // 유망: 노출 적어 확정 어려움
      const nDays = lowImp ? 1 : dates.length;
      for (let k = 0; k < nCre; k++) {
        cIdx++;
        const rnd = seededNoise((seed += 23));
        const hook = hooks[cIdx % hooks.length];
        const cta = ctas[(cIdx + 1) % ctas.length];
        const f3 = first3[(cIdx + 2) % first3.length];
        const dur = fmt.isVideo ? durations[(cIdx + k) % durations.length] : "<10s";
        const overlay = (cIdx + k) % 2;
        const ch = channels[cIdx % channels.length];
        const id = `cr_${String(cIdx).padStart(3, "0")}_${fmt.v}_${ang.v}`;
        const fatigue = 0.002 + (cIdx % 5) * 0.003;
        const cCtr = clamp01(baseCtr + ang.ctr + fmt.ctr + (overlay ? 0.002 : 0));
        const cCvr = clamp01(baseCvr + ang.cvr + fmt.cvr + (hook === "혜택제시" ? 0.02 : 0));
        const arppu = baseArppu * (ang.v === "할인혜택" ? 0.85 : ang.v === "기능강조" ? 1.15 : 1);
        for (let d = 0; d < nDays; d++) {
          const decay = Math.max(0.35, 1 - fatigue * d);
          const impressions = lowImp ? round(400 + rnd() * 120) : round(40000 + rnd() * 30000);
          const ctr = clamp01(cCtr * decay * (1 + rnd() * 0.12));
          const clicks = round(impressions * ctr);
          const cvr = clamp01(cCvr * (1 + rnd() * 0.15));
          const installs = round(clicks * cvr);
          const cpc = 380 + rnd() * 160;
          const spend = round(clicks * cpc);
          const pu = installs * (0.5 + rnd() * 0.15);
          const revenue = round(pu * arppu * (1 + rnd() * 0.2));
          const v3s = fmt.isVideo ? round(impressions * (0.55 + rnd() * 0.15)) : 0;
          const vcomp = fmt.isVideo ? round(v3s * (0.25 + rnd() * 0.15)) : 0;
          raw.push({
            creative_id: id, date: dates[d], channel: ch,
            impressions, clicks, installs, spend, revenue_d7: revenue,
            video_3s_views: v3s, video_completions: vcomp,
            message_angle: ang.v, format: fmt.v, hook_type: hook,
            cta_style: cta, first_3s: f3, duration_bucket: dur,
            has_text_overlay: overlay,
          });
        }
      }
    }
  }
  const mapping = {};
  headers.forEach((h) => { mapping[h] = h; });
  return { raw, headers, mapping, fileName: "demo_creative.csv" };
}

// ── experiment (5-4) ────────────────────────────────────────────────────────
// 5-4 reads raw props directly (arm_id/is_control/holdout_group/numerator/
// denominator/spend/revenue_d7) — no mapping needed.
//   · ② A/B 판독: arm_id·is_control 사용 → 3 variant 중 A가 명확한 승자
//   · ③ 홀드아웃 증분: holdout_group(exposed vs holdout) + spend·revenue 사용 →
//     광고를 아예 안 본 holdout(비용 0) 대비 exposed의 순증분·iROAS 산출
//     (A/B와 달리 "광고 집행 자체의 값어치"를 봄).
function buildExperiment() {
  const headers = ["date", "arm_id", "is_control", "holdout_group", "numerator", "denominator", "spend", "revenue_d7"];
  // 통합 행 — 매 행이 arm_id·is_control·holdout_group을 모두 담아 두 탭이 같은
  // 데이터를 다른 관점으로 읽음(서로 오염 없음).
  //   · Control = 광고 미노출(홀드아웃 베이스라인, spend 0) · is_control=1
  //   · Variant A/B/C = 광고 노출(exposed, spend>0) · 전환율 차이 = 광고 증분
  const revPerConv = 32000;   // 전환당 매출(KRW)
  const costPerUser = 180;    // 노출 1인당 광고비(KRW) → iROAS ≈ 2x
  const arms = [
    { id: "Control",   control: 1, group: "holdout", cvr: 0.044, exposed: false }, // 오가닉만
    { id: "Variant A", control: 0, group: "exposed", cvr: 0.062, exposed: true },  // A/B 승자
    { id: "Variant B", control: 0, group: "exposed", cvr: 0.053, exposed: true },
    { id: "Variant C", control: 0, group: "exposed", cvr: 0.050, exposed: true },
  ];
  const dates = generateDates(60, "2024-03-01");
  const raw = [];
  let seed = 211;
  for (const a of arms) {
    const rnd = seededNoise((seed += 29));
    for (let d = 0; d < dates.length; d++) {
      const denominator = round(8000 + rnd() * 1400);
      const numerator = round(denominator * a.cvr * (1 + rnd() * 0.10));
      const spend = a.exposed ? round(denominator * costPerUser) : 0;
      const revenue = round(numerator * revPerConv * (1 + rnd() * 0.12));
      raw.push({
        date: dates[d], arm_id: a.id, is_control: a.control, holdout_group: a.group,
        numerator, denominator, spend, revenue_d7: revenue,
      });
    }
  }
  // 5-4는 이제 getMappedRows로 읽음 → 헤더=표준키 identity 매핑 필요.
  const mapping = {};
  headers.forEach((h) => { mapping[h] = h; });
  return { raw, headers, mapping, fileName: "demo_experiment.csv" };
}

// ── response (5-18) ─────────────────────────────────────────────────────────
// 5-18 uses its own colMap (autoGuessColMap detects week/reg/*_spend by name).
// signups = trend + seasonality + adstock-saturated contribution of each channel.
// Cannibalization demo signal is deliberately MIXED across channels (not all the
// same verdict) so the §4.5 diagnosis tabs show all three buckets:
//   google/brand  genuine positive lift, no organic drag           → "문제 없음"
//   tiktok        real negative causal link to organic (subtract)  → "잠식 의심"
//   meta          sparse flighted bursts (<12 active weeks)        → "애매함" (데이터 부족)
// Organic baseline dips early then recovers (NOT pure monotonic growth) — a
// pure upward baseline makes every channel's low-spend window look like it
// preceded organic growth, which trips the ①precedence vote AGAINST for ALL
// channels regardless of true effect (root cause of "everything looks like
// cannibalization" in the old demo).
function buildResponse() {
  const headers = ["week", "signups", "google_spend", "meta_spend", "tiktok_spend", "brand_spend"];
  const nWeeks = 104;
  // channel: spend generator + response coefficient + adstock decay + saturation half-point.
  // sign: +1 = genuine lift (organic-friendly), -1 = genuine cannibalization (subtracts organic).
  // steep = spend ramps up fast with little noise, so the lowest-25%-spend
  // weeks are unambiguously the earliest weeks (no scatter from noise
  // overlapping late-period values) — needed for the ①precedence test to
  // read the early organic dip cleanly instead of a random subset of weeks.
  // half/base는 실제 주간 광고비 스케일(수천~수만 달러)이어야 함 — mmmSaturation의
  // 한계효율 계산(marginal = coef/(1+spend)*1000)이 이 스케일을 전제로 함. 과거
  // 1000배 큰 값(수천만 달러)이 들어있어 "다음 예산은 여기로" 한계효과가 전부
  // 0으로 언더플로우되던 버그 수정(사용자 리포트).
  const chans = [
    { key: "google_spend", coef: 0.85, sign: 1,  lambda: 0.4, half: 40000, base: 30000, amp: 0.5, steep: true },
    { key: "meta_spend",   coef: 0.60, sign: 1,  lambda: 0.5, half: 30000, base: 22000, amp: 0.6, flighted: true },
    { key: "tiktok_spend", coef: 0.85, sign: -1, lambda: 0.3, half: 18000, base: 8000,  amp: 1.1 },
    { key: "brand_spend",  coef: 1.10, sign: 1,  lambda: 0.6, half: 12000, base: 6000,  amp: 0.3, steep: true },
  ];
  // meta_spend only fires in 3 short bursts (9 weeks total) → <12 active weeks
  // → fails the eligibility gate (MIN_ACTIVE=12) on purpose, landing it in "애매함".
  const metaBursts = [[10, 12], [45, 47], [80, 82]];
  const inBurst = (w) => metaBursts.some(([a, b]) => w >= a && w <= b);
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
      const trend = c.steep ? 1 + (w / nWeeks) * 2.2 : 1 + (w / nWeeks) * 0.6;
      const noiseAmp = c.steep ? 0.1 : 0.35;
      const seasonal = 1 + c.amp * 0.3 * Math.sin((w / 52) * 2 * Math.PI);
      let spend = Math.max(0, c.base * trend * seasonal * (1 + rndSpend[c.key]() * noiseAmp));
      if (c.flighted && !inBurst(w)) spend = 0;
      row[c.key] = round(spend);
      // adstock carryover
      adstock[c.key] = spend + c.lambda * adstock[c.key];
      // hill saturation on adstocked spend
      const sat = adstock[c.key] / (adstock[c.key] + c.half);
      contrib += c.sign * c.coef * sat * 12000; // scale to signups units
    }
    // organic baseline: dips ~20% over weeks 0-20, then recovers/grows — avoids a
    // pure monotonic trend that would make every channel's low-spend window
    // look like "organic was already rising", falsely flagging cannibalization.
    const baseline = w <= 20 ? 6000 - 60 * w : 4800 + 25 * (w - 20);
    const season = 900 * Math.sin((w / 52) * 2 * Math.PI + 1);
    const signups = Math.max(0, round(baseline + season + contrib + rndY() * 700));
    row.signups = signups;
    raw.push(row);
  }
  // MMM 채널 spend 스케일(§base/half)은 USD 기준으로 설계됨(mmmSaturation의
  // 고정 체크포인트 $10k/35k/60k와 정합) — 통화 토글이 KRW로 바뀌면 실제 환산.
  return { raw, headers, mapping: {}, fileName: "demo_response.csv", currency: "USD" };
}

// ── aha (5-20) ──────────────────────────────────────────────────────────────
// 5-20 auto-detects: id (header has user/id), target (binary 0/1), features
// (other numeric cols). convert prob rises with matches/messages, weak for boost.
function buildAha() {
  const headers = [
    "user_id", "converted",
    "matches_first_7d", "messages_sent_7d", "profile_completed", "boost_used",
  ];
  const nUsers = 2400;
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

// ── incrementality (5-23) ───────────────────────────────────────────────────
// 통제군(suppression): exposed vs holdout 그룹별·날짜별 1행. 올바른 홀드아웃 구조 —
// 홀드아웃 기간 前엔 두 그룹 동일(균형 증거), 기간 中 홀드아웃 그룹만 광고 차단해
// 벌어지고, 기간 後 다시 동일(광고 재개). 45일 중 [11..35]이 홀드아웃 창.
export function buildIncrSuppressionDemo() {
  const headers = ["date", "holdout_group", "numerator", "denominator", "spend", "revenue_d7"];
  const revPerConv = 32000, costPerUser = 180;
  const dates = generateDates(45, "2024-05-01");
  const winStart = 11, winEnd = 35; // 홀드아웃 창(인덱스, inclusive)
  const cvrOn = 0.060, cvrOrganic = 0.044; // 광고 있을 때 vs 차단(오가닉)
  const groups = [
    { group: "exposed", suppressed: false }, // 항상 광고 노출
    { group: "holdout", suppressed: true },  // 창 기간만 광고 차단
  ];
  const raw = [];
  let seed = 511;
  for (const g of groups) {
    const rnd = seededNoise((seed += 31));
    for (let d = 0; d < dates.length; d++) {
      const inWindow = d >= winStart && d <= winEnd;
      const adsOff = g.suppressed && inWindow;      // 이 그룹·이 날 광고 꺼짐?
      const cvr = adsOff ? cvrOrganic : cvrOn;
      const denominator = round(8500 + rnd() * 1400);
      const numerator = round(denominator * cvr * (1 + rnd() * 0.06));
      const spend = adsOff ? 0 : round(denominator * costPerUser);
      const revenue = round(numerator * revPerConv * (1 + rnd() * 0.10));
      raw.push({ date: dates[d], holdout_group: g.group, numerator, denominator, spend, revenue_d7: revenue });
    }
  }
  const mapping = {}; headers.forEach((h) => { mapping[h] = h; });
  return { raw, headers, mapping, fileName: "demo_incr_suppression.csv" };
}

// 전후비교(pre/post): date·group(treatment/control)·conversions. cutoff = 중앙.
// direction "on" → cutoff 후 treatment 상승, "off" → 하락. control은 계절만.
export function buildIncrPrepostDemo(direction = "on") {
  const headers = ["date", "group", "conversions"];
  const nDays = 90, cutoff = 45;
  const dates = generateDates(nDays, "2024-04-01");
  const raw = [];
  const rndT = seededNoise(direction === "on" ? 601 : 631);
  const rndC = seededNoise(direction === "on" ? 661 : 691);
  const baseT = direction === "on" ? 100 : 200;   // treatment 시작 수준
  const jump = direction === "on" ? 55 : -80;      // cutoff 후 변화
  for (let d = 0; d < nDays; d++) {
    const trend = d * 0.3;
    const season = 12 * Math.sin((d / 30) * 2 * Math.PI);
    const post = d >= cutoff ? jump : 0;
    // treatment
    raw.push({
      date: dates[d], group: "treatment",
      conversions: Math.max(0, round(baseT + trend + season + post + rndT() * 14)),
    });
    // control (같은 계절·추세, 변화 없음 → DiD 기준선)
    raw.push({
      date: dates[d], group: "control",
      conversions: Math.max(0, round(baseT * 0.9 + trend + season + rndC() * 14)),
    });
  }
  const mapping = {}; headers.forEach((h) => { mapping[h] = h; });
  return { raw, headers, mapping, fileName: `demo_incr_prepost_${direction}.csv` };
}

const BUILDERS = {
  efficiency: buildEfficiency,
  creative: buildCreative,
  experiment: buildExperiment,
  response: buildResponse,
  aha: buildAha,
  incrementality: buildIncrSuppressionDemo,
};

// group name (TOOL_GROUP value) → demo csv. Falls back to efficiency.
export function buildDemoCsv(group) {
  const fn = BUILDERS[group] || BUILDERS.efficiency;
  return fn();
}
