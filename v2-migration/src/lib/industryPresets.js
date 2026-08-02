export const INDUSTRY_PRESET_IDS = Object.freeze([
  "app-commerce",
  "mobile-game",
  "subscription",
  "lead-generation",
]);

export const INDUSTRY_SCALE_IDS = Object.freeze(["starter", "growth", "scale"]);

const SCALE_FACTORS = Object.freeze({ starter: 0.25, growth: 1, scale: 4 });

const PRESETS = Object.freeze({
  "app-commerce": {
    code: "COMMERCE",
    title: { ko: "앱 커머스", en: "App commerce" },
    question: {
      ko: "어느 매체가 D7 매출과 재구매 기반을 만들고 있나요?",
      en: "Which channel is building D7 revenue and repeat value?",
    },
    description: {
      ko: "설치부터 구매·매출·리텐션까지 한 화면에서 봅니다.",
      en: "Review installs, purchasers, revenue, and retention together.",
    },
    metricPath: { ko: ["설치", "구매", "D7 매출"], en: ["Install", "Purchase", "D7 revenue"] },
    channels: ["Google App", "Meta Advantage+", "TikTok Shop", "Apple Search Ads"],
    multipliers: { installs: 1, actions: 1.08, purchasers: 1.02, revenue: 1.45, retention: 1.05 },
  },
  "mobile-game": {
    code: "GAME",
    title: { ko: "모바일 게임", en: "Mobile game" },
    question: {
      ko: "설치 볼륨을 늘리면서 D7 잔존과 과금 품질을 지켰나요?",
      en: "Did scale preserve D7 retention and payer quality?",
    },
    description: {
      ko: "매체별 설치단가와 잔존·과금 신호를 함께 비교합니다.",
      en: "Compare acquisition cost with retention and payer signals by channel.",
    },
    metricPath: { ko: ["설치", "D7 잔존", "과금"], en: ["Install", "D7 retained", "Payer"] },
    channels: ["Google UAC", "Meta Gaming", "AppLovin", "Unity Ads"],
    multipliers: { installs: 1.65, actions: 0.82, purchasers: 0.76, revenue: 0.68, retention: 1.28 },
  },
  subscription: {
    code: "SUBSCRIPTION",
    title: { ko: "구독 서비스", en: "Subscription" },
    question: {
      ko: "가입 이후 체험·결제·잔존으로 이어지는 유입은 어디인가요?",
      en: "Which acquisition source turns signups into trials, payment, and retention?",
    },
    description: {
      ko: "초기 전환보다 가입 후 가치가 남는 매체를 찾습니다.",
      en: "Find channels that retain value after the initial conversion.",
    },
    metricPath: { ko: ["가입", "무료체험", "유료 구독"], en: ["Signup", "Trial", "Paid plan"] },
    channels: ["Google Search", "Meta", "YouTube", "Affiliate"],
    multipliers: { installs: 0.82, actions: 0.72, purchasers: 0.58, revenue: 1.62, retention: 1.38 },
  },
  "lead-generation": {
    code: "LEAD GEN",
    title: { ko: "리드 제너레이션", en: "Lead generation" },
    question: {
      ko: "싼 리드가 아니라 실제 파이프라인을 만드는 매체는 어디인가요?",
      en: "Which channel creates pipeline, not merely cheap leads?",
    },
    description: {
      ko: "방문·리드·가치 신호를 같은 비용 기준으로 비교합니다.",
      en: "Compare visits, leads, and downstream value on one cost basis.",
    },
    metricPath: { ko: ["방문", "리드", "파이프라인"], en: ["Visit", "Lead", "Pipeline"] },
    channels: ["Google Search", "Meta Lead Ads", "Naver Search", "Kakao Moment"],
    multipliers: { installs: 0.62, actions: 0.88, purchasers: 0.52, revenue: 2.05, retention: 0.82 },
  },
});

const SCALE_COPY = Object.freeze({
  starter: {
    label: { ko: "월 3천만 이하", en: "Lower monthly spend" },
    short: { ko: "초기 운영", en: "Starter" },
  },
  growth: {
    label: { ko: "월 3천만–3억", en: "Multi-channel spend" },
    short: { ko: "성장기", en: "Growth" },
  },
  scale: {
    label: { ko: "월 3억 이상", en: "High-volume spend" },
    short: { ko: "스케일", en: "Scale" },
  },
});

function localized(value, locale) {
  return value?.[locale === "en" ? "en" : "ko"] || "";
}

export function getIndustryPresets(locale = "ko") {
  return INDUSTRY_PRESET_IDS.map((id) => {
    const preset = PRESETS[id];
    return {
      id,
      code: preset.code,
      title: localized(preset.title, locale),
      question: localized(preset.question, locale),
      description: localized(preset.description, locale),
      metricPath: localized(preset.metricPath, locale),
    };
  });
}

export function getIndustryPreset(id, locale = "ko") {
  return getIndustryPresets(locale).find((preset) => preset.id === id) || null;
}

export function getIndustryScaleOptions(locale = "ko") {
  return INDUSTRY_SCALE_IDS.map((id) => ({
    id,
    label: localized(SCALE_COPY[id].label, locale),
    short: localized(SCALE_COPY[id].short, locale),
  }));
}

function scaled(value, factor) {
  return Math.max(0, Math.round((Number(value) || 0) * factor));
}

export function buildIndustryPresetDemo(base, id, scaleId = "growth") {
  const preset = PRESETS[id];
  const scaleFactor = SCALE_FACTORS[scaleId];
  if (!preset || !scaleFactor || !Array.isArray(base?.raw) || !base.raw.length) return null;
  const channelMap = new Map([
    ["Google UAC", preset.channels[0]],
    ["Meta AAP", preset.channels[1]],
    ["TikTok", preset.channels[2]],
    ["Apple Search Ads", preset.channels[3]],
  ]);
  const m = preset.multipliers;
  const raw = base.raw.map((row) => {
    const installs = scaled(row.installs, scaleFactor * m.installs);
    const actions = Math.min(installs, scaled(row.actions, scaleFactor * m.actions));
    const puD7 = Math.min(actions, scaled(row.pu_d7, scaleFactor * m.purchasers));
    const puD14 = Math.min(actions, Math.max(puD7, scaled(row.pu_d14, scaleFactor * m.purchasers)));
    const retD7 = Math.min(installs, scaled(row.ret_d7, scaleFactor * m.retention));
    const retD14 = Math.min(retD7, scaled(row.ret_d14, scaleFactor * m.retention));
    return {
      ...row,
      channel: channelMap.get(row.channel) || row.channel,
      campaign_name: `${preset.code} · ${String(row.campaign_name || "").split(" - ").at(-1) || "Campaign"}`,
      creative_id: `${id}_${String(row.creative_id || "creative")}`,
      cost: scaled(row.cost, scaleFactor),
      impressions: scaled(row.impressions, scaleFactor * m.installs),
      clicks: scaled(row.clicks, scaleFactor * m.installs),
      installs,
      actions,
      revenue_d0: scaled(row.revenue_d0, scaleFactor * m.revenue),
      revenue_d7: scaled(row.revenue_d7, scaleFactor * m.revenue),
      revenue_d14: scaled(row.revenue_d14, scaleFactor * m.revenue),
      pu_d7: puD7,
      pu_d14: puD14,
      ret_d7: retD7,
      ret_d14: retD14,
    };
  });

  return {
    ...base,
    raw,
    fileName: `demo_preset_${id}_${scaleId}.csv`,
    demoPresetId: id,
    demoPresetScale: scaleId,
  };
}
