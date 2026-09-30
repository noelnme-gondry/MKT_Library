// 5-21 캠페인 성과 변동 전용 단어(docs/result-autonomy-spec.md §4.3). 단일 축("채널별"·
// "캠페인별"·"OS별")은 올린 데이터에서 공용 틀 단어(level.field)가 만든다 — 여기에는
// 공용 틀이 못 만드는 계층 조합과 지표만 둔다. 공용 단어 뒤에 붙여 사전을 만든다.

const hierarchy = [
  {
    id: "level.pvm.channelCampaign",
    levels: ["channel", "campaign_id"],
    label: { ko: "채널+캠페인별", en: "By channel + campaign" },
    requires: ["channel", { oneOf: ["campaign_id", "campaign_name"] }],
  },
  {
    id: "level.pvm.channelCampaignCreative",
    levels: ["channel", "campaign_id", "creative_id"],
    label: { ko: "채널+캠페인+소재별", en: "By channel + campaign + creative" },
    requires: ["channel", { oneOf: ["campaign_id", "campaign_name"] }, "creative_id"],
  },
].map(({ id, levels, label, requires }) => ({
  id,
  kind: "level",
  slot: "level",
  tools: ["5-21"],
  requires,
  label,
  apply: (state) => {
    state.data.levels = [...levels];
    return state;
  },
}));

const metrics = [
  { metric: "cpa", label: { ko: "CPA 기준", en: "By CPA" }, requires: ["actions"], aliases: { ko: ["가입당 비용", "액션당 비용"], en: ["cost per action"] } },
  { metric: "cpi", label: { ko: "CPI 기준", en: "By CPI" }, requires: ["installs"], aliases: { ko: ["설치당 비용"], en: ["cost per install"] } },
].map(({ metric, label, requires, aliases }) => ({
  id: `metric.pvm.${metric}`,
  kind: "metric",
  slot: "metric",
  tools: ["5-21"],
  requires,
  label,
  aliases,
  apply: (state) => {
    state.data.metric = metric;
    return state;
  },
}));

export const PVM_WORDS = Object.freeze([...hierarchy, ...metrics]);
