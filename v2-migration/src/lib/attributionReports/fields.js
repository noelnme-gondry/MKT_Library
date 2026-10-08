// 설치 raw와 주간 성과 raw의 열 계약. UI·자동매핑·가이드·템플릿이 여기서 파생한다.
const col = (label, labelEn, aliases, required = false, type = "string") => ({ label, labelEn, aliases, required, type, group: "Attribution" });
export const CONTRIBUTOR_SLOTS = [1, 2, 3];
export const MULTITOUCH_FIELDS = {
  af_id: col("AppsFlyer ID", "AppsFlyer ID", ["appsflyer_id", "AppsFlyer ID"], true),
  af_install_time: col("설치 시각", "Install time", ["install_ts", "install_time", "Install Time"], true),
  channel: col("설치 귀속 매체", "Attributed media", ["media_source", "Media Source", "ad_provider"], true),
  af_touch_type: col("귀속 접촉 유형", "Attributed touch type", ["attributed_touch_type", "Attributed Touch Type"], true),
  af_touch_time: col("귀속 클릭 시각", "Attributed touch time", ["attributed_touch_time", "Attributed Touch Time"]),
  campaign_name: col("귀속 캠페인", "Attributed campaign", ["campaign", "Campaign", "campaign_name"]),
  af_app_id: col("앱 ID", "App ID", ["app_id", "App ID"]),
  country: col("국가", "Country", ["country_code", "Country Code", "country"]),
  platform: col("OS", "OS", ["platform", "Platform", "platformname"]),
  af_placement: col("귀속 지면", "Attributed placement", ["af_channel", "Channel"]),
  ...Object.fromEntries(CONTRIBUTOR_SLOTS.flatMap(n => [
    ["media_source", "매체", "Media source"], ["campaign", "캠페인", "Campaign"],
    ["touch_type", "접촉 유형", "Touch type"], ["touch_time", "접촉 시각", "Touch time"], ["match_type", "매칭 방식", "Match type"],
  ].map(([name, ko, en]) => [`af_c${n}_${name}`, col(`기여 ${n} ${ko}`, `Contributor ${n} ${en}`, [`contributor${n}_${name}`, `contributor_${n}_${name}`, `Contributor ${n} ${en}`], n === 1 && ["media_source", "touch_type"].includes(name))]))),
};
export function multitouchCapabilities(mapping = {}) {
  const keys = new Set(Object.values(mapping));
  return { hasPlacement: keys.has("af_placement"), hasAppId: keys.has("af_app_id"),
    hasMatchType: CONTRIBUTOR_SLOTS.some(n => keys.has(`af_c${n}_match_type`)),
    contributorSlots: CONTRIBUTOR_SLOTS.filter(n => keys.has(`af_c${n}_media_source`) && keys.has(`af_c${n}_touch_type`)) };
}
export const WIDE_AGE_BUCKETS = [
  ["under_18", "Under 18", 0, 17], ["18_24", "18–24", 18, 24], ["25_34", "25–34", 25, 34],
  ["35_44", "35–44", 35, 44], ["45_54", "45–54", 45, 54], ["55_64", "55–64", 55, 64],
  ["65_plus", "65+", 65, Infinity], ["45_plus", "45+", 45, Infinity],
].map(([suffix, label, low, high]) => ({ key: `age_count_${suffix}`, suffix, label, low, high }));
export const WEEKLY_MOVEMENT_FIELDS = {
  date: col("날짜·주 시작일", "Date / week start", ["date", "week_date", "week_start", "week"]),
  iso_year: col("ISO 연도", "ISO year", ["iso_year", "year", "yyyy"]),
  iso_week: col("ISO 주차", "ISO week", ["iso_week", "week", "week_number", "weeknum"]),
  channel: col("채널", "Channel", ["adprovidername", "media_source", "channel", "provider"], true),
  count: col("성과 건수", "Outcome count", ["cnt", "count", "registrations", "signups", "actions"], true, "number"),
  country: col("국가", "Country", ["countryname", "country", "country_code"]),
  platform: col("OS", "OS", ["platformname", "platform", "os"]),
  campaign_name: col("캠페인", "Campaign", ["campaignname", "campaign_name", "campaign"]),
  outcome_type: col("성과 종류", "Outcome type", ["type", "outcome_type", "event_type"]),
  gender: col("성별", "Gender", ["gender", "gendername", "sex"]),
  female_count: col("여성 성과 건수", "Female outcome count", ["female_rr", "female_count"], false, "number"),
  age: col("연령 구간", "Age bucket", ["age", "age_bucket", "agegroupname", "age_band", "agegroup"]),
  ...Object.fromEntries(WIDE_AGE_BUCKETS.map(bucket => [bucket.key, col(`${bucket.label} 건수`, `${bucket.label} count`, [`age_${bucket.suffix}`, `rr_${bucket.suffix}`, `${bucket.suffix}_rr`, `age_${bucket.suffix}_rr`], false, "number")])),
};
export const normalizeReportHeader = value => String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
export function normalizeReportPlatform(value) {
  const name = String(value ?? "").trim();
  return ({ android: "Android", ios: "iOS" })[name.toLowerCase()] || name;
}
export function guessReportMapping(headers, fields, rows = []) {
  const mapping = {};
  const used = new Set();
  for (const [key, field] of Object.entries(fields)) {
    // Native aliases win over a generic key: AppsFlyer "Channel" is placement,
    // while "Media Source" is the attributed media.
    const aliases = [...new Set([...field.aliases, key].map(normalizeReportHeader))];
    const hasYear = fields.iso_year && headers.some(h => fields.iso_year.aliases.map(normalizeReportHeader).includes(normalizeReportHeader(h)));
    const weekIsDate = header => rows.slice(0, 20).some(row => /^\d{4}-(?:\d{2}-\d{2}|W\d{1,2})/.test(String(row[header] ?? "").trim()));
    const candidates = headers.filter(h => !used.has(h) && aliases.includes(normalizeReportHeader(h)) && !(key === "date" && hasYear && normalizeReportHeader(h) === "week" && !weekIsDate(h)));
    if (!candidates.length) continue;
    const priority = Math.min(...candidates.map(h => aliases.indexOf(normalizeReportHeader(h))));
    const best = candidates.filter(h => aliases.indexOf(normalizeReportHeader(h)) === priority);
    if (best.length !== 1) continue; // ambiguous columns remain visible for confirmation
    const header = best[0];
    mapping[header] = key;
    used.add(header);
  }
  return mapping;
}
export function reportRows(raw, mapping) {
  const entries = Object.entries(mapping || {}).filter(([, key]) => key && key !== "__ignore__");
  return raw.map(row => Object.fromEntries(entries.map(([header, key]) => [key, row[header]])));
}
export function missingReportFields(mapping, fields) {
  const mapped = new Set(Object.values(mapping || {}));
  return Object.entries(fields).filter(([key, field]) => field.required && !mapped.has(key)).map(([key]) => key);
}
