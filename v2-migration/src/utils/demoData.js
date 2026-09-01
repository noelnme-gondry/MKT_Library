// ── Demo data generator ─────────────────────────────────────────────────────
// Deterministic (seededNoise / LCG — NO Math.random, §3) sample datasets that
// produce MEANINGFUL results in every tool. Wired to the "데모 데이터" button in
// CsvUploader (efficiency·creative·experiment groups) and the self-hosted
// dropzones of 5-18 (response) and 5-20 (aha).
//
// buildDemoCsv(group, locale) → { raw, headers, mapping, fileName }
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
    "revenue_d0", "revenue_d7", "revenue_d14", "pu_d7", "pu_d14", "ret_d7", "ret_d14", "source", "snapshot_date",
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
            // 이 루프는 매체의 유료 캠페인만 만든다. Lookalike는 캠페인 유형이지
            // 오가닉 유입이 아니므로 source를 바꾸면 유료 비용이 오가닉 성과로 섞인다.
            source: "paid",
            snapshot_date: dates[Math.min(d + 14, dates.length - 1)],
          });
        }
      }
    }
  }
  // 오가닉은 유료 캠페인 행에 라벨만 덧씌우지 않는다. 비용 0인 별도 관측으로
  // 만들어 Paid/Organic 필터와 리텐션 마감 판정 모두를 실제로 체험할 수 있게 한다.
  dates.forEach((date, index) => {
    const installs = 110 + ((index * 17) % 42);
    const actions = Math.round(installs * (0.34 + (index % 5) * 0.01));
    const paidUsers = Math.round(actions * 0.62);
    const revenue = paidUsers * 14500;
    raw.push({
      date, country: "KR", platform: "Organic", channel: "Organic Search",
      campaign_name: "Organic acquisition", creative_id: "organic_search_listing",
      cost: 0, impressions: installs * 46, clicks: installs * 5, installs, actions,
      revenue_d0: Math.round(revenue * 0.38), revenue_d7: revenue, revenue_d14: Math.round(revenue * 1.4),
      pu_d7: paidUsers, pu_d14: Math.round(paidUsers * 1.15),
      ret_d7: Math.round(installs * 0.17), ret_d14: Math.round(installs * 0.12),
      source: "organic", snapshot_date: dates[Math.min(index + 14, dates.length - 1)],
    });
  });
  const mapping = {};
  headers.forEach((h) => { mapping[h] = h; }); // all headers are canonical std keys
  // 생성 금액은 KRW 스케일이다. 원본 통화가 없으면 표시 토글이 숫자를 다른 통화로
  // 오해하게 하므로 데모도 실제 업로드와 같은 통화 계약을 갖는다.
  return { raw, headers, mapping, fileName: "demo_efficiency.csv", currency: "KRW" };
}

// ── aso_store (5-27) ───────────────────────────────────────────────────────
// 84일 × 소스 4개 = 336행. 이야기를 셋 심어 두어 이벤트 주석이 실제로 쓸모
// 있게 만든다(§12.16 — 진단 도구 데모는 합성 패턴이 신호를 띠어야 한다).
//   D21 스크린샷 교체 → Search 전환율만 계단식 상승 (효율)
//   D42 광고 증액     → 저전환 Browse 조회가 급증  (믹스)
//   D63 가격 인하     → 전 소스 전환율이 함께 소폭 상승 (효율)
// 그래서 "전체만 내려갔는데 소스별은 그대로"인 구간과 "소스별이 같이 움직인"
// 구간이 한 데이터 안에 다 들어 있다.
function buildAsoStore() {
  const headers = ["date", "country", "store_source", "impressions", "product_page_views", "installs", "event", "event_type"];
  const dates = generateDates(84, "2025-03-01");
  const EVENTS = {
    20: { label: "스크린샷 1번 교체", type: "creative" },
    41: { label: "UA 예산 2배 증액", type: "campaign" },
    62: { label: "연간권 20% 인하", type: "price" },
  };
  const raw = [];
  dates.forEach((date, index) => {
    const afterCreative = index >= 20;
    const afterScale = index >= 41;
    const afterPrice = index >= 62;
    // 소스별 기본 전환율. 교체 이후 Search만, 인하 이후 전 소스가 오른다.
    const searchCvr = 0.40 + (afterCreative ? 0.06 : 0) + (afterPrice ? 0.03 : 0);
    const browseCvr = 0.085 + (afterPrice ? 0.015 : 0);
    const referrerCvr = 0.21 + (afterPrice ? 0.02 : 0);
    const webCvr = 0.14 + (afterPrice ? 0.01 : 0);
    // 조회 수. 증액 이후 Browse가 크게 늘어 저전환 비중이 커진다.
    const searchViews = 4200 + ((index * 37) % 11) * 70 + (afterScale ? 300 : 0);
    const browseViews = (afterScale ? 6400 : 2300) + ((index * 53) % 9) * 90;
    const referrerViews = 880 + ((index * 19) % 7) * 45;
    const webViews = 610 + ((index * 29) % 5) * 55;
    const event = EVENTS[index];
    const tag = (position) => (event && position === 0 ? { event: event.label, event_type: event.type } : { event: "", event_type: "" });
    raw.push(
      { date, country: "KR", store_source: "App Store Search", impressions: searchViews * 3, product_page_views: searchViews, installs: Math.round(searchViews * searchCvr), ...tag(0) },
      { date, country: "KR", store_source: "App Store Browse", impressions: browseViews * 11, product_page_views: browseViews, installs: Math.round(browseViews * browseCvr), ...tag(1) },
      { date, country: "US", store_source: "App Referrer", impressions: referrerViews * 4, product_page_views: referrerViews, installs: Math.round(referrerViews * referrerCvr), ...tag(2) },
      { date, country: "US", store_source: "Web Referrer", impressions: webViews * 5, product_page_views: webViews, installs: Math.round(webViews * webCvr), ...tag(3) },
    );
  });
  return {
    raw,
    headers,
    mapping: {
      date: "date", country: "country", store_source: "store_source", impressions: "impressions",
      product_page_views: "product_page_views", installs: "installs", event: "event", event_type: "event_type",
    },
    fileName: "demo_aso_store.csv",
  };
}

// ── collinearity (5-25) ────────────────────────────────────────────────────
// Meta·TikTok 지출을 거의 같은 일정으로 움직이게 해 VIF 도구가 "진행 보류"
// 신호를 실제로 보여 준다. Google·ASA는 다른 리듬으로 넣어 비교 근거도 남긴다.
function buildCollinearity() {
  const headers = ["date", "channel", "cost"];
  const dates = generateDates(42, "2025-03-01");
  const raw = [];
  dates.forEach((date, index) => {
    const shared = 420000 + (index % 7) * 28000 + Math.floor(index / 7) * 19000;
    const independent = 290000 + ((index * 43) % 11) * 17000;
    raw.push(
      { date, channel: "Meta", cost: shared },
      { date, channel: "TikTok", cost: Math.round(shared * 0.94 + (index % 3) * 1200) },
      { date, channel: "Google UAC", cost: independent },
      { date, channel: "Apple Search Ads", cost: 180000 + ((index * 29) % 13) * 14500 },
    );
  });
  return { raw, headers, mapping: { date: "date", channel: "channel", cost: "cost" }, fileName: "demo_collinearity.csv" };
}

// ── action survival (5-28) ───────────────────────────────────────────────
// 5-28은 구독 전용이 아니라 한 개체의 핵심 액션 유지·이탈 관측 에피소드를
// 분석한다. 기간형과 날짜형 입력을 한 세트에 함께 넣어 두 모드, 중도절단,
// 좌측절단, 세그먼트 비교, 관측기간 반복 가치까지 모두 직접 체험할 수 있게 한다.
function buildActionSurvival() {
  const headers = [
    "Action Survival Duration", "Dropout Observed", "Action Start Date",
    "Action Exit Date", "Action Observation End Date", "Observation Entry",
    "Channel", "Action Type", "Campaign Name", "Acquisition Cost",
  ];
  const raw = [];
  const observationEndDate = "2025-12-31";
  ["Organic", "Meta", "ASA"].forEach((channel, channelIndex) => {
    for (let index = 0; index < 36; index += 1) {
      const actionType = index % 3 === 0 ? "첫 구매" : index % 3 === 1 ? "주간 핵심 기능 사용" : "14일 내 재방문";
      const campaign = index % 2 === 0 ? "온보딩 개선" : "리마인드 캠페인";
      const tenure = 2 + ((index * 7 + channelIndex * 3) % 13);
      // 채널별로 의도적인 위험 차이를 넣어, 데모의 세그먼트 비교가 계산만 되는
      // 빈 차트가 아니라 실제 관측 차이 신호를 보여 주도록 한다.
      const channelRisk = [15, 70, 35][channelIndex];
      const actionRisk = [4, 12, -5][index % 3];
      const campaignRisk = campaign === "리마인드 캠페인" ? 6 : 0;
      const churned = ((index * 37 + channelIndex * 19 + (index % 3) * 11) % 100) < channelRisk + actionRisk + campaignRisk ? 1 : 0;
      const actionEnd = new Date(Date.UTC(2025, 11, 31));
      if (churned) actionEnd.setUTCMonth(actionEnd.getUTCMonth() - (1 + ((index * 5 + channelIndex) % 6)));
      const actionStartDate = new Date(actionEnd);
      actionStartDate.setUTCMonth(actionStartDate.getUTCMonth() - tenure);
      const actionStart = actionStartDate.toISOString().slice(0, 10);
      const entryPeriod = tenure > 3 && index % 11 === 0 ? 1 + (channelIndex % 2) : 0;
      raw.push({
        "Action Survival Duration": tenure,
        "Dropout Observed": churned,
        "Action Start Date": actionStart,
        "Action Exit Date": churned ? actionEnd.toISOString().slice(0, 10) : "",
        "Action Observation End Date": observationEndDate,
        "Observation Entry": entryPeriod,
        Channel: channel,
        "Action Type": actionType,
        "Campaign Name": campaign,
        "Acquisition Cost": 8000 + channelIndex * 13000 + (index % 6) * 1200,
      });
    }
  });
  return {
    raw,
    headers,
    mapping: {
      "Action Survival Duration": "tenure_periods",
      "Dropout Observed": "event_observed",
      "Action Start Date": "subscription_start_date",
      "Action Exit Date": "churn_date",
      "Action Observation End Date": "observation_end_date",
      "Observation Entry": "entry_period",
      Channel: "channel",
      "Action Type": "event_type",
      "Campaign Name": "campaign_name",
      "Acquisition Cost": "cac",
    },
    fileName: "demo_action_survival.csv",
  };
}

// ── ASA keyword finder (5-26) ──────────────────────────────────────────────
// Search Match 승격·저소진 증액·과소진 감액·제외 검토가 모두 보이도록 구성.
// 일일 예산은 현재 엔진의 검색어 단위 판정 예시값이며, 실데이터에서는 캠페인
// 예산과 검색어 성과를 분리해 해석해야 한다.
function buildAsaKeyword() {
  const headers = ["date", "country", "campaign_name", "adgroup_name", "search_term", "match_type", "cost", "clicks", "installs", "daily_budget", "target_cpa", "current_cpt", "target_cpt"];
  const dates = generateDates(14, "2025-04-01");
  const configs = [
    { term: "가계부", campaign: "ASA KR Discovery", match: "Search Match", cost: 420, clicks: 42, installs: 8, budget: 1000, targetCpa: 80, cpt: 10 },
    { term: "무료 가계부", campaign: "ASA KR Generic", match: "Broad", cost: 1280, clicks: 64, installs: 5, budget: 1000, targetCpa: 150, cpt: 18 },
    { term: "영수증 정리", campaign: "ASA KR Broad", match: "Broad", cost: 620, clicks: 50, installs: 3, budget: 1000, targetCpa: 120, cpt: 12 },
  ];
  const raw = dates.flatMap((date, day) => configs.map((config) => ({
    date,
    country: day % 3 === 0 ? "US" : "KR",
    campaign_name: config.campaign,
    adgroup_name: "Discovery",
    search_term: config.term,
    match_type: config.match,
    cost: config.cost + (day % 3) * 12,
    clicks: config.clicks + (day % 2),
    installs: config.installs,
    daily_budget: config.budget,
    target_cpa: config.targetCpa,
    current_cpt: config.cpt,
    target_cpt: Math.round(config.cpt * 0.9),
  })));
  return { raw, headers, mapping: Object.fromEntries(headers.map((header) => [header, header])), fileName: "demo_asa_keyword.csv" };
}

// ── brand incrementality (5-24) ────────────────────────────────────────────
function buildBrandIncrementality() {
  const headers = ["date", "brand_search", "campaign_on", "cost", "country", "channel"];
  const start = Date.UTC(2025, 0, 1);
  const raw = Array.from({ length: 49 }, (_, index) => {
    const date = new Date(start + index * 86400000).toISOString().slice(0, 10);
    const weekdayPattern = [5, 2, -3, 1, 4, 8, 12][index % 7];
    return {
      date,
      brand_search: Math.round(180 + index * 1.6 + weekdayPattern + (index >= 35 ? 42 : 0)),
      campaign_on: index >= 35 ? "on" : "off",
      cost: index >= 35 ? 78000 + (index % 5) * 4000 : 0,
      country: "KR",
      channel: "Brand Search",
    };
  });
  return { raw, headers, mapping: Object.fromEntries(headers.map((header) => [header, header])), fileName: "demo_brand_incrementality.csv" };
}

// ── creative (5-6) ──────────────────────────────────────────────────────────
// Concept Matrix(§8) 기본 축 = message_angle × format → 조합별 셀에 소재 ≥5개
// (minNCell=5) 채우려면 소재를 조합 순회로 다수 생성 + 속성 컬럼 필수.
// 속성별 효과(멀티플라이어)를 심어 §4 WLS 분해도 유의 신호 산출.
function buildCreative() {
  const headers = [
    "creative_id", "date", "channel", "impressions", "clicks", "installs",
    "actions", "spend", "revenue_d7", "video_3s_views", "video_completions",
    "message_angle", "format", "hook_type", "cta_style", "first_3s",
    "duration_bucket", "has_text_overlay", "duration_seconds", "text_length",
    "scene_cut_count", "face_screen_ratio", "speech_rate",
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
          const actions = Math.max(1, round(installs * (0.42 + rnd() * 0.08)));
          const cpc = 380 + rnd() * 160;
          const spend = round(clicks * cpc);
          const pu = installs * (0.5 + rnd() * 0.15);
          const revenue = round(pu * arppu * (1 + rnd() * 0.2));
          const v3s = fmt.isVideo ? round(impressions * (0.55 + rnd() * 0.15)) : 0;
          const vcomp = fmt.isVideo ? round(v3s * (0.25 + rnd() * 0.15)) : 0;
          const durationSeconds = fmt.isVideo ? 7 + ((cIdx * 7 + k) % 39) : 5 + (cIdx % 4);
          const textLength = 12 + ((cIdx * 11 + k * 3) % 64);
          const sceneCutCount = fmt.isVideo ? 3 + ((cIdx * 5 + k) % 24) : 1 + (cIdx % 3);
          const faceScreenRatio = Number((0.08 + ((cIdx * 13 + k) % 65) / 100).toFixed(2));
          const speechRate = fmt.isVideo ? 2.1 + ((cIdx * 3 + k) % 20) / 10 : 0;
          raw.push({
            creative_id: id, date: dates[d], channel: ch,
            impressions, clicks, installs, actions, spend, revenue_d7: revenue,
            video_3s_views: v3s, video_completions: vcomp,
            message_angle: ang.v, format: fmt.v, hook_type: hook,
            cta_style: cta, first_3s: f3, duration_bucket: dur,
            has_text_overlay: overlay, duration_seconds: durationSeconds,
            text_length: textLength, scene_cut_count: sceneCutCount,
            face_screen_ratio: faceScreenRatio, speech_rate: speechRate,
          });
        }
      }
    }
  }
  // 예측 비교는 일별 행이 아니라 고유 소재 단위로 적합한다. 매트릭스의 부족·미관측
  // 셀은 보존하고, 이미 검증된 조합에만 추가 소재를 넣어 RF/SVM을 실제로 실행한다.
  for (let index = cIdx; index < 480; index += 1) {
    cIdx += 1;
    const rnd = seededNoise((seed += 23));
    const fmt = formats[index % 2];
    const ang = angles[1];
    const impressions = round(28000 + rnd() * 9000);
    const ctr = clamp01(baseCtr + ang.ctr + fmt.ctr + rnd() * 0.003);
    const clicks = Math.max(1, round(impressions * ctr));
    const installs = Math.max(1, round(clicks * clamp01(baseCvr + ang.cvr + rnd() * 0.02)));
    const actions = Math.max(1, round(installs * (0.42 + rnd() * 0.08)));
    const v3s = fmt.isVideo ? round(impressions * (0.55 + rnd() * 0.15)) : 0;
    raw.push({
      creative_id: `cr_${String(cIdx).padStart(3, "0")}_${fmt.v}_${ang.v}`,
      date: dates[index % dates.length], channel: channels[index % channels.length],
      impressions, clicks, installs, actions, spend: round(clicks * (410 + rnd() * 110)),
      revenue_d7: round(actions * baseArppu * (0.52 + rnd() * 0.12)),
      video_3s_views: v3s, video_completions: fmt.isVideo ? round(v3s * (0.28 + rnd() * 0.12)) : 0,
      message_angle: ang.v, format: fmt.v, hook_type: hooks[index % hooks.length],
      cta_style: ctas[index % ctas.length], first_3s: first3[index % first3.length],
      duration_bucket: fmt.isVideo ? durations[index % durations.length] : "<10s",
      has_text_overlay: index % 2,
      duration_seconds: fmt.isVideo ? 8 + (index % 37) : 5 + (index % 3),
      text_length: 14 + (index % 62), scene_cut_count: fmt.isVideo ? 4 + (index % 22) : 1 + (index % 3),
      face_screen_ratio: Number((0.1 + (index % 62) / 100).toFixed(2)),
      speech_rate: fmt.isVideo ? 2.2 + (index % 19) / 10 : 0,
    });
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
  const headers = ["week", "country", "signups", "paid_signups", "google_spend", "meta_spend", "tiktok_spend", "brand_spend"];
  // Bayesian과 WebR가 같은 2개 이상의 12주 OOS fold를 만들 수 있도록
  // 최소 120주보다 여유 있게 제공한다. 한쪽만 숫자가 뜨는 비교는 허용하지 않는다.
  const nWeeks = 132;
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
    // 각 채널은 서로 다른 운용 주기·phase·성장률을 갖는다. 모든 채널을 함께
    // 우상향시키면 데모조차 VIF가 폭증해 "예산 추천 보류"만 보여주게 된다.
    // 이 파형은 실제 MMM의 식별 조건(독립적인 지출 변동)을 체험하기 위한 것.
    { key: "google_spend", coef: 0.85, sign: 1,  lambda: 0.4, half: 40000, base: 30000, amp: 0.5, trendRate: 0.65, wave: 0.42, period: 17, phase: 0.4 },
    { key: "meta_spend",   coef: 0.60, sign: 1,  lambda: 0.5, half: 30000, base: 22000, amp: 0.6, trendRate: 0.15, wave: 0.38, period: 13, phase: 2.2, flighted: true },
    { key: "tiktok_spend", coef: 0.85, sign: -1, lambda: 0.3, half: 18000, base: 8000,  amp: 1.1, trendRate: 0.35, wave: 0.55, period: 11, phase: 4.1 },
    { key: "brand_spend",  coef: 1.10, sign: 1,  lambda: 0.6, half: 12000, base: 6000,  amp: 0.3, trendRate: 0.1, wave: 0.6, period: 23, phase: 1.5 },
  ];
  // meta_spend only fires in 3 short bursts (9 weeks total) → <12 active weeks
  // → fails the eligibility gate (MIN_ACTIVE=12) on purpose, landing it in "애매함".
  const metaBursts = [[10, 12], [45, 47], [80, 82]];
  const inBurst = (w) => metaBursts.some(([a, b]) => w >= a && w <= b);
  const rndSpend = {};
  chans.forEach((c, i) => { rndSpend[c.key] = seededNoise(311 + i * 13); });
  const rndY = seededNoise(907);
  const rndPaid = seededNoise(1103);
  // week start dates
  const start = Date.parse("2023-01-02");
  const raw = [];
  const adstock = {}; chans.forEach((c) => { adstock[c.key] = 0; });
  for (let w = 0; w < nWeeks; w++) {
    const weekStr = new Date(start + w * 7 * 86400000).toISOString().slice(0, 10);
    // 데모에서만 KR을 명시한다. 실제 모델은 특정 국가를 기본값으로 가정하지
    // 않으며, 이 값은 국가 prior self-reference 제외 gate를 체험하기 위한 입력이다.
    const row = { week: weekStr, country: "KR" };
    let contrib = 0;
    let paidSignal = 0;
    for (const c of chans) {
      // spend: base * (trend) * (seasonal) * noise
      const trend = 1 + (w / nWeeks) * c.trendRate;
      const noiseAmp = c.flighted ? 0.2 : 0.16;
      const seasonal = 1 + c.amp * 0.3 * Math.sin((w / 52) * 2 * Math.PI);
      const operatingWave = 1 + c.wave * Math.sin((w / c.period) * 2 * Math.PI + c.phase);
      let spend = Math.max(0, c.base * trend * seasonal * operatingWave * (1 + rndSpend[c.key]() * noiseAmp));
      if (c.flighted && !inBurst(w)) spend = 0;
      row[c.key] = round(spend);
      // adstock carryover
      adstock[c.key] = spend + c.lambda * adstock[c.key];
      // hill saturation on adstocked spend
      const sat = adstock[c.key] / (adstock[c.key] + c.half);
      contrib += c.sign * c.coef * sat * 12000; // scale to signups units
      // Paid 성과는 어트리뷰션 관측값이라 순증분 계수의 부호와 별개다. 모든
      // 채널의 포화된 집행량을 반영하되 Total을 넘지 않도록 아래에서 제한한다.
      paidSignal += Math.abs(c.coef) * sat;
    }
    // organic baseline: dips ~20% over weeks 0-20, then recovers/grows — avoids a
    // pure monotonic trend that would make every channel's low-spend window
    // look like "organic was already rising", falsely flagging cannibalization.
    const baseline = w <= 20 ? 6000 - 60 * w : 4800 + 25 * (w - 20);
    const season = 900 * Math.sin((w / 52) * 2 * Math.PI + 1);
    const signups = Math.max(0, round(baseline + season + contrib + rndY() * 700));
    row.signups = signups;
    row.paid_signups = Math.min(
      signups,
      Math.max(0, round(signups * 0.24 + paidSignal * 850 + rndPaid() * 180)),
    );
    raw.push(row);
  }
  // MMM 채널 spend 스케일(§base/half)은 USD 기준으로 설계됨(mmmSaturation의
  // 고정 체크포인트 $10k/35k/60k와 정합) — 통화 토글이 KRW로 바뀌면 실제 환산.
  return { raw, headers, mapping: {}, fileName: "demo_response.csv", currency: "USD" };
}

// ── MMM prior evidence (5-18) ──────────────────────────────────────────────
// 기여 분해의 "근거 보정" UX와 prior 엔진을 함께 검증하는 원자료 세트.
// On/Off 반복 구간과 여러 참고 국가의 country 컬럼을 실제 형식으로 제공한다.
export function buildMmmPriorDemo() {
  const base = buildResponse();
  const marketRows = [];
  const multipliers = { JP: 1.16, TW: 0.78, SG: 0.55, US: 1.42 };
  Object.entries(multipliers).forEach(([country, multiplier], ci) => {
    const noise = seededNoise(610 + ci * 29);
    base.raw.forEach((row, weekIndex) => {
      const seasonalShift = 1 + 0.035 * Math.sin((weekIndex / 52) * 2 * Math.PI + ci);
      const copy = { week: row.week, country };
      base.headers.filter((header) => header !== "week" && header !== "country").forEach((header) => {
        const value = Number(row[header]) || 0;
        const isSpend = header.endsWith("_spend");
        const variance = isSpend ? 1 + noise() * 0.12 : 1 + noise() * 0.05;
        copy[header] = Math.round(value * multiplier * seasonalShift * variance);
      });
      marketRows.push(copy);
    });
  });

  const holdoutRows = [];
  const holdoutNoise = seededNoise(1701);
  base.raw.slice(60, 84).forEach((row, i) => {
    const isOn = (i >= 6 && i < 12) || (i >= 18 && i < 24);
    const spend = isOn ? Math.round(22000 * (1 + holdoutNoise() * 0.12)) : 0;
    const signups = Math.round(5200 + (isOn ? 520 : 0) + 260 * Math.sin((i / 12) * Math.PI) + holdoutNoise() * 160);
    holdoutRows.push({
      week: row.week,
      experiment_type: "on_off",
      treatment_state: isOn ? "on" : "off",
      geo: "KR_national",
      arm: "treatment",
      meta_spend: spend,
      signups,
    });
  });

  return {
    experiment: {
      raw: holdoutRows,
      headers: ["week", "experiment_type", "treatment_state", "geo", "arm", "meta_spend", "signups"],
      fileName: "demo_mmm_holdout_on_off.csv",
      currency: "USD",
    },
    country: {
      raw: marketRows,
      headers: ["week", "country", ...base.headers.slice(1)],
      fileName: "demo_mmm_reference_markets.csv",
      currency: "USD",
    },
  };
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
    // profile/boost were binary flags (0/1) — a threshold sweep over a 2-value
    // column collapses to a single k, so the P/R scatter rendered as one dot
    // instead of a curve (§bugfix, user-reported). Made count-style like
    // matches/messages so every action has multiple k levels to sweep over.
    const profile = Math.max(0, round(eng * 5 * (0.4 + rnd() + 0.3))); // 0..~8 edits
    const boost = Math.max(0, round(eng * 3 * (0.3 + rnd() + 0.3))); // 0..~5 uses
    // conversion: all 4 actions given real (but differentiated) weight — none
    // reduced to near-pure noise, so no event's curve looks degenerate.
    const score =
      (messages >= 20 ? 0.40 : messages * 0.011) +
      (matches >= 5 ? 0.25 : matches * 0.028) +
      (profile >= 3 ? 0.16 : profile * 0.035) +
      (boost >= 2 ? 0.11 : boost * 0.035) +
      rnd() * 0.16;
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

// ── content_aha (9-2 킬러 콘텐츠·충성 독자 발굴) ──────────────────────────────
// aha와 동일 grain(1행=독자, target=구독 전환 0/1, feature=소비한 콘텐츠 횟수).
// 특정 킬러 콘텐츠(ga4guide)를 소비한 독자가 구독으로 강하게 이어지도록 신호 설계.
// (오직 subscribed만 이진값 → 타겟 자동탐지 명확. 나머지는 count.)
function buildContentAha() {
  const headers = [
    "reader_id", "subscribed",
    "ga4guide_d7", "casestudy_d7", "pricing_d7", "shared_d7",
  ];
  const nReaders = 2400;
  const rnd = seededNoise(7311);
  const raw = [];
  for (let u = 0; u < nReaders; u++) {
    const interest = clamp01(0.45 + rnd() * 1.0); // latent 관심도(구독·소비 공통원인)
    const ga4 = Math.max(0, round(interest * 3 * (0.6 + rnd() + 0.4)));      // 킬러 콘텐츠(강한 연관)
    const casestudy = Math.max(0, round(interest * 5 * (0.5 + rnd() + 0.5))); // 중간 연관
    const pricing = rnd() + 0.5 > (0.4 + interest * 0.2) ? round(rnd() * 3) : 0; // 약한 연관
    const shared = round(rnd() * 2); // 무관에 가까움(count)
    const score =
      (ga4 >= 2 ? 0.5 : ga4 * 0.12) +
      (casestudy >= 3 ? 0.22 : casestudy * 0.03) +
      (pricing > 0 ? 0.05 : 0) +
      shared * 0.01 +
      rnd() * 0.18;
    const subscribed = score > 0.55 ? 1 : 0;
    raw.push({
      reader_id: `r${10000 + u}`,
      subscribed,
      ga4guide_d7: ga4,
      casestudy_d7: casestudy,
      pricing_d7: pricing,
      shared_d7: shared,
    });
  }
  return { raw, headers, mapping: {}, fileName: "demo_content_aha.csv" };
}

// ── content_attr (9-1 콘텐츠 요소 분석기) ────────────────────────────────────
// 1행=콘텐츠 1편 + 제작 속성(0/1·길이) + 성과(CTR%). 다변량 회귀로 어떤 속성이
// CTR과 유의하게 연관되는지 확인. 제목숫자·밝은썸네일=유의(+), 이모지=무유의(≈0)로
// 설계 → "이모지는 유의미하지 않음" 서사가 데모에서 실제로 재현되도록.
function buildContentAttr() {
  const headers = [
    "post_id",
    "title_has_number", "title_len", "has_emoji", "thumbnail_bright", "listicle",
    "ctr",
  ];
  const n = 260;
  const rnd = seededNoise(9137);
  const raw = [];
  for (let i = 0; i < n; i++) {
    const hasNum = rnd() + 0.5 > 0.5 ? 1 : 0;
    const titleLen = round(20 + (rnd() + 0.5) * 45); // 20..65자
    const emoji = rnd() + 0.5 > 0.5 ? 1 : 0;
    const bright = rnd() + 0.5 > 0.5 ? 1 : 0;
    const listicle = rnd() + 0.5 > 0.6 ? 1 : 0;
    let ctr =
      2.4 +
      hasNum * 1.35 +
      (titleLen - 42.5) * -0.012 +
      emoji * 0.03 + // ≈ 무유의(노이즈에 묻힘)
      bright * 0.7 +
      listicle * 0.5 +
      (rnd() - 0.5) * 1.1; // 노이즈
    ctr = Math.max(0.1, ctr);
    raw.push({
      post_id: `p${1000 + i}`,
      title_has_number: hasNum,
      title_len: titleLen,
      has_emoji: emoji,
      thumbnail_bright: bright,
      listicle,
      ctr: Number(ctr.toFixed(2)),
    });
  }
  return { raw, headers, mapping: {}, fileName: "demo_content_attr.csv" };
}

// ── content_traffic (9-3 콘텐츠 트래픽 변동 탐지) ─────────────────────────────
// efficiency와 같은 PVM grain(1행 = 하루 × 유입경로 × 카테고리 × 콘텐츠)이되 콘텐츠
// 도메인 매핑: channel=유입경로 · campaign_id=카테고리 · creative_id=콘텐츠 ·
// cost=제작/배포 비용 · installs=트래픽(방문·PV). 결과 지표 1개(traffic→installs)만
// 매핑 → bothMetricsMapped=false로 CPA/CPI 토글 자연히 숨김. 3주치(마감주 P1 vs P2)
// 신호: W3(P2)에서 비싼 유입경로(social)로 트래픽 비중 이동(Mix↑) + social 방문당
// 비용 상승(Rate↑)이 함께 보이도록 설계. 결정론(seededNoise, NO Math.random §3).
function buildContentTraffic() {
  const headers = [
    "date", "traffic_source", "category", "content_id", "cost", "traffic",
    "impressions", "clicks",
  ];
  // cpv = 방문당 비용(원). social은 후반 주로 갈수록 cpv 상승(Rate 악화 신호).
  const sources = [
    { name: "organic",    cpv: 120, share: 1.4 }, // 값싼 유입(검색/추천 유입)
    { name: "social",     cpv: 420, share: 1.0, rampCpv: true }, // 비쌈 + 후반 악화
    { name: "search",     cpv: 260, share: 1.1 },
    { name: "newsletter", cpv: 680, share: 0.6 }, // 방문당 가장 비쌈
  ];
  const cats = ["튜토리얼", "사례연구"];
  const dates = generateDates(21, "2024-01-01"); // 3 full calendar weeks (Mon 시작)
  const raw = [];
  let seed = 61;
  for (const s of sources) {
    for (let ci = 0; ci < cats.length; ci++) {
      for (let k = 0; k < 2; k++) {
        const contentId = `${s.name}_${ci === 0 ? "tut" : "case"}_${k + 1}`;
        const rnd = seededNoise((seed += 19));
        const baseVisits = 800 * s.share * (1 + k * 0.3);
        for (let d = 0; d < dates.length; d++) {
          const wk = Math.floor(d / 7); // 0=W1,1=W2(P1),2=W3(P2)
          // W3에 social로 트래픽 비중 쏠림 → Mix 효과(비싼 유입경로로 이동).
          const shareBoost = s.name === "social" && wk === 2 ? 1.6 : 1;
          const visits = Math.max(1, round(baseVisits * shareBoost * (1 + rnd() * 0.12)));
          // social 방문당 비용은 주가 갈수록 상승(Rate 효과).
          const cpvNow = s.cpv * (s.rampCpv ? 1 + wk * 0.25 : 1);
          const cost = round(visits * cpvNow * (1 + rnd() * 0.08));
          const clicks = round(visits * (1.6 + rnd() * 0.4));
          const impressions = round(clicks * (10 + rnd() * 4));
          raw.push({
            date: dates[d], traffic_source: s.name, category: cats[ci],
            content_id: contentId, cost, traffic: visits, impressions, clicks,
          });
        }
      }
    }
  }
  // header → 표준키 매핑(엔진 계약): 유입경로=channel·카테고리=campaign_id·
  // 콘텐츠=creative_id·트래픽=installs. getMonFilteredRows가 cost→spend 별칭 채움.
  const mapping = {
    date: "date", traffic_source: "channel", category: "campaign_id",
    content_id: "creative_id", cost: "cost", traffic: "installs",
    impressions: "impressions", clicks: "clicks",
  };
  return { raw, headers, mapping, fileName: "demo_content_traffic.csv" };
}


// ── content_dashboard (9-7 콘텐츠 운영 대시보드) ──────────────────────────────
// 콘텐츠 운영 CSV — 유입경로(traffic_source)·카테고리·콘텐츠·비용·노출·클릭·방문·구독.
// 매출/결제/리텐션은 콘텐츠 데이터에 없으므로 넣지 않는다(대시보드가 content 도메인에서
// 그 지표 카드/차트를 아예 노출하지 않음 — §정직성, 날조 금지). 트래픽 신호: 유입경로별
// 방문당 비용 스프레드 + cost^0.72 수확체감 + 결정론 노이즈, 한 날짜 트래픽 급등(이상탐지).
function buildContentDashboard() {
  const headers = [
    "date", "traffic_source", "device", "content_category", "content_id",
    "content_cost", "impressions", "clicks", "visits", "subscribers",
  ];
  // 유입경로별 효율(방문당 비용) 차이 → donut/cpi 비교에 신호. subRate=방문→구독 전환율.
  const sources = [
    { name: "자연 검색", eff: 0.70, subRate: 0.06, ctr: 0.045 },
    { name: "소셜", eff: 1.20, subRate: 0.03, ctr: 0.030 },
    { name: "뉴스레터", eff: 0.55, subRate: 0.11, ctr: 0.070 },
    { name: "직접 유입", eff: 0.85, subRate: 0.08, ctr: 0.050 },
    { name: "추천/제휴", eff: 1.00, subRate: 0.05, ctr: 0.038 },
  ];
  const categories = ["튜토리얼", "사례연구", "업계뉴스"];
  const dates = generateDates(60, "2024-01-01");
  const raw = [];
  let seed = 41;
  for (let si = 0; si < sources.length; si++) {
    const s = sources[si];
    const rnd = seededNoise((seed += 23));
    const baseCost = 180000 * s.eff;
    for (let d = 0; d < dates.length; d++) {
      const cat = categories[(d + si) % categories.length];
      const contentId = `${cat}_${(d % 6) + 1}`;
      const ramp = 1 + (d / dates.length) * 1.2;
      const noise = 1 + rnd() * 0.22;
      // 뉴스레터에 한 날짜(d=40) 대량 발송 → 트래픽·비용 급등(이상탐지 신호).
      const spike = s.name === "뉴스레터" && d === 40 ? 3.2 : 1;
      const cost = baseCost * ramp * noise * spike;
      const visits = Math.max(
        1,
        round((Math.pow(cost, 0.72) / (9 * s.eff)) * (1 + rnd() * 0.15))
      );
      const clicks = Math.max(visits, round(visits * (1.4 + rnd() * 0.5)));
      const impressions = round((clicks / s.ctr) * (1 + rnd() * 0.12));
      const subscribers = round(visits * s.subRate * (1 + rnd() * 0.25));
      raw.push({
        date: dates[d], traffic_source: s.name,
        device: d % 2 === 0 ? "Mobile" : "Desktop",
        content_category: cat, content_id: contentId,
        content_cost: round(cost), impressions, clicks, visits, subscribers,
      });
    }
  }
  // 콘텐츠 헤더 → 대시보드 표준키. visits=installs(트래픽 결과), subscribers=actions(구독).
  const mapping = {
    date: "date", traffic_source: "channel", device: "platform",
    content_category: "campaign_name", content_id: "creative_id",
    content_cost: "cost", impressions: "impressions", clicks: "clicks",
    visits: "installs", subscribers: "actions",
  };
  return { raw, headers, mapping, fileName: "demo_content_dashboard.csv" };
}

// ── segment_composition (5-29) ─────────────────────────────────────────────
// 전체 여성 비중이 21%에서 36%로 오르는데, 그 원인이 캠페인 간 볼륨 이동과
// 캠페인 내부 구성 변화에 **둘 다** 들어 있게 설계했다. 한쪽만 넣으면 분해 표가
// 늘 한 열만 커져서 도구가 무엇을 가르는지 데모로 보이지 않는다(§12.16).
//   BRAND  볼륨이 커지고(이동) 내부 여성 비중도 50%→70%로 오른다(내부 변화)
//   CPS    볼륨은 줄지만 내부 여성 비중은 8.6%→13.3%로 오른다
// 연령 축은 같은 파일에 함께 두어 "축이 여러 개일 때 무엇이 더 움직였나"를 본다.
function buildSegmentComposition() {
  const headers = ["date", "campaign", "platform", "gender", "age_band", "signups", "cost"];
  const dates = generateDates(78, "2025-03-03").filter((_, index) => index % 7 === 0); // 주 단위 12주
  const raw = [];
  // OS는 경쟁 범위(scope) 역할의 데모다. iOS는 성별 구성이 거의 움직이지 않게 두어
  // "범위를 나눠 보면 결론이 달라진다"를 한 파일 안에서 확인할 수 있게 한다.
  const PLATFORMS = [
    { name: "Android", scale: 1, femaleLift: 1 },
    { name: "iOS", scale: 0.45, femaleLift: 0 },
  ];
  dates.forEach((date, index) => {
    const t = index / (dates.length - 1); // 0 → 1
    // 캠페인별 볼륨: BRAND가 점점 커진다(이동).
    const cpsTotal = 1400 - 300 * t + ((index * 37) % 5) * 12;
    const brandTotal = 600 + 400 * t + ((index * 53) % 5) * 9;
    // 연령은 완만하게만 움직여 "성별이 더 크게 움직였다"가 랭킹에서 드러나게 한다.
    const youngRate = 0.62 - 0.04 * t;
    PLATFORMS.forEach((platform) => {
      const rows = [
        { campaign: "CPS", total: cpsTotal, femaleRate: 0.086 + 0.047 * t * platform.femaleLift, cost: 2800000 + index * 25000 },
        { campaign: "BRAND", total: brandTotal, femaleRate: 0.50 + 0.20 * t * platform.femaleLift, cost: 1200000 + index * 160000 },
      ];
      rows.forEach((row) => {
        const total = Math.round(row.total * platform.scale);
        const female = Math.round(total * row.femaleRate);
        const male = total - female;
        const split = (count) => {
          const young = Math.round(count * youngRate);
          return [young, count - young];
        };
        const [femaleYoung, femaleOld] = split(female);
        const [maleYoung, maleOld] = split(male);
        const cost = String(Math.round(row.cost * platform.scale));
        raw.push(
          { date, campaign: row.campaign, platform: platform.name, gender: "Female", age_band: "29세 이하", signups: String(femaleYoung), cost },
          { date, campaign: row.campaign, platform: platform.name, gender: "Female", age_band: "30대 이상", signups: String(femaleOld), cost },
          { date, campaign: row.campaign, platform: platform.name, gender: "Male", age_band: "29세 이하", signups: String(maleYoung), cost },
          { date, campaign: row.campaign, platform: platform.name, gender: "Male", age_band: "30대 이상", signups: String(maleOld), cost },
        );
      });
    });
  });
  // 세그먼트 축은 사용자가 선언하는 값이라 표준키 매핑에는 날짜만 둔다.
  return { raw, headers, mapping: { date: "date" }, fileName: "demo_segment_composition.csv" };
}

const BUILDERS = {
  efficiency: buildEfficiency,
  creative: buildCreative,
  experiment: buildExperiment,
  response: buildResponse,
  aha: buildAha,
  incrementality: buildIncrSuppressionDemo,
  brand_incrementality: buildBrandIncrementality,
  aso_store: buildAsoStore,
  subscription_survival: buildActionSurvival,
  segment_composition: buildSegmentComposition,
  collinearity: buildCollinearity,
  asa_keyword: buildAsaKeyword,
  content_aha: buildContentAha,
  content_attr: buildContentAttr,
  content_traffic: buildContentTraffic,
  content_dashboard: buildContentDashboard,
};

// group name (TOOL_GROUP value) → demo csv. A missing builder is a product bug:
// silently showing another tool's data creates a false "demo result".
const DEMO_EN_VALUE_MAP = {
  // 5-27 액션 로그 — 데모 이벤트 라벨도 EN에서는 영어로 나가야 한다
  // (차트 세로선과 목록에 그대로 찍히는 값이라 KO가 새면 바로 보인다).
  "스크린샷 1번 교체": "Swapped first screenshot", "UA 예산 2배 증액": "Doubled UA budget",
  "연간권 20% 인하": "Cut annual plan 20%",
  "할인혜택": "Discount offer", "사회적증거": "Social proof", "기능강조": "Feature focus", "감성스토리": "Emotional story",
  "제작영상": "Produced video", "정적이미지": "Static image", "플레이어블": "Playable", "문제제기": "Problem",
  "호기심": "Curiosity", "혜택제시": "Benefit", "지금설치": "Install now", "무료체험": "Free trial", "한정할인": "Limited offer",
  "얼굴클로즈업": "Face close-up", "텍스트훅": "Text hook", "제품시연": "Product demo", "악화 추세 없음": "No worsening trend",
  "무료 가계부": "Free budget planner", "가계부": "Budget planner", "영수증 정리": "Receipt organizer",
  "추세 외삽": "Trend extrapolation", "일": "d", "밖": "outside",
};

function localizeDemoCsv(data, locale) {
  if (locale !== "en" || !data?.raw) return data;
  const replaceValue = (value) => {
    if (typeof value !== "string") return value;
    return Object.entries(DEMO_EN_VALUE_MAP).reduce((next, [ko, en]) => next.replaceAll(ko, en), value);
  };
  return { ...data, raw: data.raw.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, replaceValue(value)]))) };
}

export function buildDemoCsv(group, locale = "ko") {
  const fn = BUILDERS[group];
  if (!fn) throw new Error(`No demo dataset registered for data group: ${group}`);
  return localizeDemoCsv(fn(), locale);
}
