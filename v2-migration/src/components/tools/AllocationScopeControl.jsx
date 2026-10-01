"use client";

import { useId, useState } from "react";
import { Popover } from "radix-ui";
import { SlidersHorizontal } from "lucide-react";

// Draft scope stays isolated until Apply; fitting and verification remain owned
// by BudgetAllocation. The trigger describes applied values, never draft values.
export default function AllocationScopeControl({ applied, filterOptions, onApply, locale }) {
  const en = locale === "en";
  const id = useId();
  const [open, setOpen] = useState(false);
  const initial = () => ({
    unitField: applied.unitField,
    country: applied.countries?.size > 1 ? "__current__" : applied.countries?.size === 1 ? [...applied.countries][0] : "__all__",
    channel: applied.channels?.size > 1 ? "__current__" : applied.channels?.size === 1 ? [...applied.channels][0] : "__all__",
    platform: applied.platform,
  });
  const [draft, setDraft] = useState(initial);
  const title = en ? "Allocation scope" : "배분 대상";
  const all = en ? "All" : "전체";
  const units = [
    ["country", en ? "By country" : "국가별"],
    ["channel", en ? "Country × channel" : "국가 × 채널별"],
    ["campaign_name", en ? "Country × channel × campaign" : "국가 × 채널 × 캠페인별"],
  ];
  const selection = [
    applied.countries?.size ? [...applied.countries].join(", ") : (en ? "All countries" : "전체 국가"),
    applied.channels?.size ? [...applied.channels].join(", ") : (en ? "All channels" : "전체 채널"),
    applied.platform === "all" ? (en ? "All OS" : "전체 OS") : applied.platform,
  ].join(" · ");
  const select = (key, label, options) => <label className="allocation-scope__field">
    <span id={`${id}-${key}`}>{label}</span>
    <select aria-labelledby={`${id}-${key}`} value={draft[key]} onChange={event => setDraft(value => ({ ...value, [key]: event.target.value }))}>
      {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select>
  </label>;
  return <div className="allocation-scope">
    <span className="result-period-picker__label">{title}</span>
    <Popover.Root open={open} onOpenChange={value => { if (value) setDraft(initial()); setOpen(value); }}>
      <Popover.Trigger asChild>
        <button type="button" className="recipe-scope-trigger" aria-label={`${title}: ${selection}`}><SlidersHorizontal size={16} aria-hidden="true" /><span>{selection}</span></button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="recipe-scope-panel allocation-scope-panel" aria-label={title} sideOffset={8} align="start" collisionPadding={12}>
          <h3>{title}</h3>
          <p>{en ? "Choose the data used to build the plan. Apply to review the fitted curves." : "배분에 사용할 데이터를 고릅니다. 적용 후 적합 곡선을 검토합니다."}</p>
          <div className="allocation-scope__fields">
            {select("unitField", en ? "Allocation unit" : "배분 단위", units)}
            {filterOptions.hasCountry && select("country", en ? "Country" : "국가", [["__all__", all], ...(applied.countries?.size > 1 ? [["__current__", [...applied.countries].join(", ")]] : []), ...filterOptions.countries.map(value => [value, value])])}
            {filterOptions.hasChannel && select("channel", en ? "Channel" : "채널", [["__all__", all], ...(applied.channels?.size > 1 ? [["__current__", [...applied.channels].join(", ")]] : []), ...filterOptions.channels.map(value => [value, value])])}
            {filterOptions.hasPlatform && select("platform", "OS", [["all", all], ...[...filterOptions.platforms].map(value => [value, value === "ios" ? "iOS" : "Android"])])}
          </div>
          {draft.unitField !== "country" && filterOptions.countries.length > 1 && <p className="allocation-scope__note">{en ? "Channel and campaign allocation uses one country. Applying All selects the country with the highest observed spend." : "채널·캠페인별 배분은 한 국가만 사용합니다. 전체로 적용하면 관측 지출이 가장 큰 국가를 선택합니다."}</p>}
          <div className="allocation-scope__actions">
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{en ? "Cancel" : "취소"}</button>
            <button type="button" className="btn primary" onClick={() => {
              onApply({ objective: applied.objective, unitField: draft.unitField, countries: draft.country === "__current__" ? applied.countries : draft.country === "__all__" ? null : new Set([draft.country]), channels: draft.channel === "__current__" ? applied.channels : draft.channel === "__all__" ? null : new Set([draft.channel]), platform: draft.platform });
              setOpen(false);
            }}>{en ? "Apply and review curves" : "적용 후 곡선 검토"}</button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </div>;
}
