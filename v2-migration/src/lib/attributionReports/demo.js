import { MULTITOUCH_FIELDS, WEEKLY_MOVEMENT_FIELDS, guessReportMapping } from "./fields";
export function buildMultitouchDemo() {
  const media = ["Facebook Ads", "googleadwords_int", "tiktokglobal_int", "Apple Search Ads"];
  const raw = Array.from({ length: 2400 }, (_, index) => {
    const winning = media[index % 4], day = String(1 + index % 28).padStart(2, "0");
    const row = { "AppsFlyer ID": `sample-${index}`, "App ID": "com.example.app", "Install Time": `2026-09-${day} 12:00:00`, "Attributed Touch Time": `2026-09-${day} 11:50:00`, "Attributed Touch Type": "click", "Media Source": winning, Campaign: index % 8 < 4 ? "Acquisition" : "Return", Platform: index % 3 ? "Android" : "iOS", "Country Code": "KR", Channel: winning === "Facebook Ads" ? (index % 8 ? "Instagram" : "Facebook") : winning === "tiktokglobal_int" ? (index % 8 ? "Pangle" : "TikTok") : "" };
    for (let n = 1; n <= 3; n++) {
      const used = index % (n + 2) === 0;
      row[`Contributor ${n} Media source`] = used ? media[(index + n) % 4].replace("Facebook Ads", "facebook_int") : "";
      row[`Contributor ${n} Campaign`] = used ? `Assist ${n}` : "";
      row[`Contributor ${n} Touch type`] = used ? "click" : "";
      // Slot 1 is newest: the engine must sort by timestamp, not slot number.
      row[`Contributor ${n} Touch time`] = used ? `2026-09-${day} ${String(11 - n).padStart(2, "0")}:00:00` : "";
      row[`Contributor ${n} Match type`] = used ? (index % 5 === 0 ? "probabilistic" : "SRN") : "";
    }
    return row;
  });
  raw.push({ ...raw[0], "Install Time": "2026-09-30 12:00:00" });
  const headers = Object.keys(raw[0]);
  return { raw, headers, mapping: guessReportMapping(headers, MULTITOUCH_FIELDS), fileName: "demo_multitouch.csv", importSource: "demo" };
}
export function buildCannibalDetailDemo() {
  const raw = [];
  for (const year of [2024, 2025]) for (const platform of ["Android", "iOS"]) for (let week = 1; week <= 20; week++) for (const channel of ["Organic", "Meta", "Google", "TikTok"]) for (const campaign of ["Acquisition", "Return"]) for (const gender of ["Female", "Male"]) for (const age of ["18–24", "25+"]) {
    const base = channel === "Organic" ? 500 : 150;
    const shift = year === 2025 && week >= 9 ? (channel === "Organic" ? -70 : channel === "TikTok" ? -8 : campaign === "Acquisition" ? 55 : 15) : 0;
    const count = base + shift + week * 2 + (gender === "Female" ? 20 : 0);
    raw.push({ year: String(year), week: String(week), countryname: "KR", platformname: platform, adprovidername: channel, campaignname: campaign, gender, age_bucket: age, type: "registration", cnt: String(count) });
  }
  const headers = Object.keys(raw[0]);
  return { raw, headers, mapping: guessReportMapping(headers, WEEKLY_MOVEMENT_FIELDS), fileName: "demo_cannibal_detail.csv", importSource: "demo" };
}
