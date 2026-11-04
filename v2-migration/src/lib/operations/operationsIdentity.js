const text = value => String(value ?? "").trim();
export const operationsUnit = rows => rows.some(row => text(row.campaign_id) || text(row.campaign_name)) ? "campaign" : "channel";
export function operationsTarget(row, unit = "campaign") {
  return { unit, country: text(row.country), platform: text(row.platform), channel: text(row.channel), source: text(row.source),
    campaignId: unit === "campaign" ? text(row.campaign_id) : "", campaign: unit === "campaign" ? text(row.campaign_name) : "" };
}
export function operationsEntityKey(row, unit = "campaign") {
  const target = operationsTarget(row, unit);
  return JSON.stringify([target.country, target.platform, target.channel, target.source, target.campaignId || target.campaign]);
}
export function matchesOperationsTarget(row, target) {
  if (["country", "platform", "channel", "source"].some(key => text(row[key]) !== text(target[key]))) return false;
  if (target.campaignId) return text(row.campaign_id) === target.campaignId;
  if (target.unit === "channel") return true;
  if (target.campaign) return text(row.campaign_name) === target.campaign;
  return !text(row.campaign_id) && !text(row.campaign_name);
}
