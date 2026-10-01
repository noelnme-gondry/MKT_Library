import { ALLOCATION_OPTIONS, decodeAllocationOption } from "@/lib/recipe/allocationRecipe";

// Existing direct controls own these settings; the command bar saves the same steps.
export const ALLOCATION_WORDS = Object.entries(ALLOCATION_OPTIONS).map(([key, option]) => ({
  id: `allocation.${key}`, kind: "data", slot: `allocation.${key}`,
  fieldParams: key === "unitField" ? ["value"] : [],
  carriesUserValues: Boolean(option.private),
  label: params => {
    let value;
    try { value = decodeAllocationOption(key, params); } catch { return { ko: option.ko, en: option.en }; }
    const names = { budget: ["총예산", "Budget"], target: ["효율 목표", "Efficiency target"], daily: ["일", "Daily"], monthly: ["월", "Monthly"], c: ["효율 가중", "Efficiency weighted"], b: ["한계효용", "Marginal utility"], install: ["CPI", "CPI"], action: ["CPA", "CPA"], roas: ["ROAS", "ROAS"], auto: ["자동", "Auto"], channel: ["채널", "Channel"], country: ["국가", "Country"], campaign_name: ["캠페인", "Campaign"], all: ["전체", "All"], country_channel: ["국가·채널", "Country/channel"], allocation: ["배분 단위", "Allocation units"], detail: ["상세", "Detail"] };
    const text = value == null ? ["기본", "Default"] : typeof value === "boolean" ? (value ? ["켜짐", "On"] : ["꺼짐", "Off"]) : names[value] || [String(value), String(value)];
    return { ko: `${option.ko}: ${text[0]}`, en: `${option.en}: ${text[1]}` };
  },
  expand: () => [],
  apply: (state, params) => {
    const value = decodeAllocationOption(key, params);
    if (key === "objective") state.data.metric = value;
    state.data.allocation = { ...state.data.allocation, [key]: value };
    return state;
  },
}));
