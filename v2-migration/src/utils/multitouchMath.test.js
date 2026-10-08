import { describe, it, expect } from "vitest";
import { MULTITOUCH_FIELDS, guessReportMapping } from "../lib/attributionReports/fields";
import { normalizeMultitouch, buildMultitouchView, parseTouchTimestamp, multitouchFlow } from "./multitouchMath";
const row = (id, extra = {}) => ({
  "AppsFlyer ID": id, "App ID": "app.a", "Install Time": "2026-09-01 12:00:00",
  "Attributed Touch Time": "2026-09-01 11:50:00", "Attributed Touch Type": "click",
  "Media Source": "tiktokglobal_int", Campaign: "Winner", Platform: "iOS", "Country Code": "KR", Channel: "Pangle",
  "Contributor 1 Media Source": "facebook_int", "Contributor 1 Touch Type": "click",
  "Contributor 1 Touch Time": "2026-09-01 11:00:00", "Contributor 1 Match Type": "probabilistic", "Contributor 1 Campaign": "Assist",
  "Contributor 2 Media Source": "", "Contributor 2 Touch Type": "", "Contributor 2 Touch Time": "", "Contributor 2 Match Type": "",
  "Contributor 3 Media Source": "", "Contributor 3 Touch Type": "", "Contributor 3 Touch Time": "", "Contributor 3 Match Type": "",
  ...extra,
});
const dataset = rows => normalizeMultitouch(rows, guessReportMapping(Object.keys(rows[0]), MULTITOUCH_FIELDS));
describe("AppsFlyer raw counting and timing", () => {
  it("keeps full-dataset date boundaries after a filtered query and follows the selected time zone", () => {
    const rows = [row("a", { "Install Time": "2026-09-01T23:50:00Z" }), row("b", { "Install Time": "2026-09-28T23:50:00Z" })];
    const mapping = guessReportMapping(Object.keys(rows[0]), MULTITOUCH_FIELDS);
    const data = normalizeMultitouch(rows, mapping, { utcOffsetMinutes: 540 });
    expect(data.minDate).toBe("2026-09-02"); expect(data.maxDate).toBe("2026-09-29");
    expect(buildMultitouchView(data, { start: "2026-09-29", utcOffsetMinutes: 540 }).total).toBe(1);
    expect(data.minDate).toBe("2026-09-02"); expect(data.maxDate).toBe("2026-09-29");
  });
  it("maps native headers rather than synthetic standard keys", () => {
    const mapping = guessReportMapping(Object.keys(row("a")), MULTITOUCH_FIELDS);
    expect(mapping["AppsFlyer ID"]).toBe("af_id");
    expect(mapping["Contributor 1 Match Type"]).toBe("af_c1_match_type");
    expect(mapping.Channel).toBe("af_placement");
    expect(mapping["Media Source"]).toBe("channel");
  });
  it("deduplicates before filtering and scopes IDs to app", () => {
    const data = dataset([row("a"), row("a", { "Install Time": "2026-09-02 12:00:00" }), row("a", { "App ID": "app.b" }), row("", {}), row("b", { "Attributed Touch Type": "impression" })]);
    expect(data.duplicates).toBe(1); expect(data.invalidRows).toBe(1); expect(data.nonClickInstalls).toBe(1);
    expect(buildMultitouchView(data).total).toBe(2);
    expect(buildMultitouchView(data, { start: "2026-09-02" }).total).toBe(0);
  });
  it("retains the install denominator when excluding modelled or unlabelled contributors", () => {
    const data = dataset([row("a"), row("b", { "Contributor 1 Match Type": "SRN" }), row("c", { "Contributor 1 Media Source": "" }), row("d", { "Contributor 1 Match Type": "" })]);
    const included = buildMultitouchView(data), excluded = buildMultitouchView(data, { excludeProbabilistic: true });
    expect(included.total).toBe(4); expect(excluded.total).toBe(4);
    expect(included.rate).toBe(0.75); expect(excluded.rate).toBe(0.25); expect(included.unknownMatches).toBe(1);
    expect(included.ctit).toEqual(excluded.ctit); // all-scope CTIT never follows the assist toggle
    expect(included.ctit[0].median).toBe(600000);
  });
  it("ignores view contributors and orders clicks by time, not slot", () => {
    const data = dataset([row("a", { "Contributor 2 Media Source": "Snap", "Contributor 2 Touch Type": "impression", "Contributor 2 Touch Time": "2026-09-01 08:00:00", "Contributor 3 Media Source": "googleadwords_int", "Contributor 3 Touch Type": "click", "Contributor 3 Touch Time": "2026-09-01 09:00:00", "Contributor 3 Match Type": "SRN" })]);
    const view = buildMultitouchView(data);
    expect(view.paths[0].touches).toEqual(["Google", "Meta"]); expect(view.heat.some(h => h.channel === "Snap")).toBe(false);
    expect(view.gaps.find(g => g.phase === "first-second" && g.name === "All").counts[4]).toBe(1);
  });
  it("reports reversals without clamping and uses exclusive bins", () => {
    const view = buildMultitouchView(dataset([row("a", { "Contributor 1 Touch Time": "2026-09-01 11:55:00" })]));
    const gap = view.gaps.find(g => g.phase === "last-attributed" && g.name === "All");
    expect(gap.counts[0]).toBe(1); expect(gap.shares.reduce((a, b) => a + b, 0)).toBe(1);
    expect(view.ctit[0].median).toBe(600000); // never contributor-to-install
  });
  it("leaves missing match types and timestamps unavailable", () => {
    const raw = [row("a", { "Contributor 1 Touch Time": "", "Attributed Touch Time": "" })], mapping = guessReportMapping(Object.keys(raw[0]), MULTITOUCH_FIELDS);
    for (const header of Object.keys(mapping)) if (mapping[header].endsWith("match_type")) delete mapping[header];
    const view = buildMultitouchView(normalizeMultitouch(raw, mapping));
    expect(view.rate).toBe(1); expect(view.mediaRows[0].rateExcluded).toBeNull();
    expect(view.pathInstalls).toBe(0); expect(view.unorderedInstalls).toBe(1);
    expect(view.ctit[0].median).toBeNull(); expect(view.ctit[0].invalid).toBe(1);
    expect(buildMultitouchView(normalizeMultitouch(raw, mapping), { excludeProbabilistic: true }).rate).toBeNull();
  });
  it("does not invent touch order from slot numbers when recorded timestamps tie", () => {
    const view = buildMultitouchView(dataset([row("a", { "Contributor 2 Media Source": "Google", "Contributor 2 Touch Type": "click", "Contributor 2 Touch Time": "2026-09-01 11:00:00" })]));
    expect(view.withAssist).toBe(1); expect(view.heat).toHaveLength(2);
    expect(view.pathInstalls).toBe(0); expect(view.unorderedInstalls).toBe(1);
    expect(view.ctit[0].median).toBe(600000);
    expect(view.gaps.find(g => g.phase === "attributed-install" && g.name === "All").valid).toBe(1);
  });
  it("counts each contributing channel once per installation and uses campaign scope denominators", () => {
    const data = dataset([row("a", { "Contributor 1 Match Type": "SRN", "Contributor 2 Media Source": "Facebook Ads", "Contributor 2 Touch Type": "click", "Contributor 2 Touch Time": "2026-09-01 10:00:00", "Contributor 2 Match Type": "SRN" }), row("b", { Campaign: "Other", "Contributor 1 Media Source": "" })]);
    const view = buildMultitouchView(data, { splitPlacement: true, focus: "TikTok · Pangle", campaignFocus: "Winner" });
    expect(view.scopedInstalls).toBe(1); expect(view.heat[0].installs).toBe(1); expect(view.heat[0].share).toBe(1);
    expect(view.ctit[0].name).toBe("Winner");
  });
  it("parses timestamps independent of machine timezone and refuses impossible/date-only values", () => {
    expect(parseTouchTimestamp("2026-09-01 12:00:00", 540)).toBe(Date.UTC(2026, 8, 1, 3));
    expect(parseTouchTimestamp("2026-09-01T12:00:00+09:00", 0)).toBe(Date.UTC(2026, 8, 1, 3));
    expect(parseTouchTimestamp("2026-09-01 12:00:00.123456")).toBeCloseTo(Date.UTC(2026, 8, 1, 12) + 123.456, 2);
    expect(parseTouchTimestamp("2026-02-30 12:00:00")).toBeNull();
    expect(parseTouchTimestamp("2026-09-01")).toBeNull();
  });
  it("preserves separate missing-touch lanes and flow volume", () => {
    const flow = multitouchFlow([{ touches: ["Google"], media: "TikTok", installs: 3 }, { touches: ["Meta"], media: "TikTok", installs: 2 }]);
    for (const lane of [0, 1, 2, 3]) expect(flow.nodes.filter(n => n.lane === lane).reduce((a, b) => a + b.volume, 0)).toBe(5);
    expect(flow.nodes.filter(n => n.lane === 1 && n.label === "None")).toHaveLength(2);
    expect(flow.nodes.filter(n => n.lane === 2 && n.label === "None")).toHaveLength(2);
    expect(flow.links.reduce((a, b) => a + b.value, 0)).toBe(15);
  });
  it("orders missing lanes by their upstream nodes and keeps literal None media separate", () => {
    const flow = multitouchFlow([{ touches: ["Google"], media: "None", installs: 1 }, { touches: ["Google", "Meta"], media: "TikTok", installs: 9 }, { touches: ["None"], media: "TikTok", installs: 5 }]);
    const parents = flow.nodes.filter(n => n.lane === 0);
    const missing = flow.nodes.filter(n => n.lane === 1 && n.isMissing);
    expect(missing.map(n => n.history[0])).toEqual(parents.map(n => n.label));
    expect(parents.find(n => n.label === "None").isMissing).toBe(false);
    expect(flow.nodes.find(n => n.lane === 3 && n.label === "None").isMissing).toBe(false);
  });
});
