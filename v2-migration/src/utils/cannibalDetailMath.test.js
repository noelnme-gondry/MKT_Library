import { describe, it, expect } from "vitest";
import { WEEKLY_MOVEMENT_FIELDS, guessReportMapping } from "../lib/attributionReports/fields";
import { normalizeCannibalDetail, buildCannibalDetailView, isoWeekForDate, isoWeekStart } from "./cannibalDetailMath";
const rows = () => [2024, 2025].flatMap(year => Array.from({ length: 16 }, (_, index) => ["Organic", "Google", "Meta", "TikTok"].map(channel => ({
  year: String(year), week: String(index + 1), countryname: "KR", platformname: "iOS", adprovidername: channel, campaignname: `${channel} campaign`, cnt: String(1000 + (year === 2025 && index >= 8 ? channel === "Organic" ? -300 : channel === "TikTok" ? -50 : 100 : 0)), gender: "Female", age_bucket: "18–24",
}))).flat());
const run = (raw, options = {}) => buildCannibalDetailView(normalizeCannibalDetail(raw, guessReportMapping(Object.keys(raw[0]), WEEKLY_MOVEMENT_FIELDS)), options);
describe("descriptive weekly movement detail", () => {
  it("maps numeric ISO weeks and preserves paired years", () => {
    const map = guessReportMapping(Object.keys(rows()[0]), WEEKLY_MOVEMENT_FIELDS);
    expect(map.year).toBe("iso_year"); expect(map.week).toBe("iso_week");
    const result = run(rows()); expect(result.comparedWeeks).toBe(16);
    expect(result.stretches.map(s => [s.kind, s.start, s.end])).toEqual([["sign", 9, 16], ["trend", 9, 16]]);
  });
  it("keeps ties, all material channels, offsets and shares above 100%", () => {
    const raw = rows().map(r => ({ ...r, cnt: String(Number(r.cnt) + (r.year === "2025" && Number(r.week) >= 9 && r.adprovidername === "TikTok" ? -100 : 0)) }));
    const stretch = run(raw).stretches[0];
    expect(stretch.paidMove).toBe(400); expect(stretch.organicMove).toBe(-2400);
    expect(stretch.channels.map(c => c.name)).toEqual(["Google", "Meta"]);
    expect(stretch.channels[0].share).toBe(2);
    expect(stretch.campaigns.find(c => c.channel === "TikTok").move).toBe(-1200);
    expect(stretch.channels[0].coMovingWeeks).toBe(8);
    // The offsetting campaign also has an observed mix. Its own negative move
    // defines same-direction groups; the total Paid direction must not erase it.
    const offset = stretch.campaigns.find(c => c.channel === "TikTok");
    expect(stretch.campaignMix[offset.name].find(m => m.axis === "gender").overlap).toBe(1);
  });
  it("breaks runs at missing weeks and never calls absence zero by default", () => {
    const raw = rows().filter(r => !(r.year === "2025" && r.week === "12"));
    expect(run(raw).stretches.every(s => !(s.start < 12 && s.end > 12))).toBe(true);
    // Preserve the observed Paid total by moving the omitted campaign's volume
    // into another reported channel, so the opposite stretch still spans W10.
    const missing = rows().map(r => r.year === "2025" && r.week === "10" && r["adprovider" + "name"] === "Meta" ? { ...r, cnt: String(Number(r.cnt) + 1100) } : r).filter(r => !(r.year === "2025" && r.week === "10" && r["adprovider" + "name"] === "Google"));
    const s = run(missing).stretches.find(s => s.kind === "sign");
    expect(s.campaigns.find(c => c.channel === "Google").move).toBeNull();
    const explicit = run(missing, { missingAsZero: true }).stretches.find(s => s.kind === "sign");
    expect(explicit.campaigns.find(c => c.channel === "Google").move).not.toBeNull();
  });
  it("does not infer an opposite move from a partial total after a bad count is dropped", () => {
    const raw = rows().map(r => r.year === "2025" && r.week === "12" && r["adprovider" + "name"] === "Google" ? { ...r, cnt: "not recorded" } : r);
    const result = run(raw);
    expect(result.segments[0].points.some(p => p.week === 12)).toBe(false);
    expect(result.stretches.every(s => !(s.start < 12 && s.end > 12))).toBe(true);
  });
  it("uses a fixed trend baseline consistently in moves and points", () => {
    const raw = rows().map(r => ({ ...r, cnt: String(Number(r.cnt) + (r.year === "2025" ? r.adprovidername === "Organic" ? -100 : 10 : 0)) }));
    const stretch = run(raw).stretches.find(s => s.kind === "trend");
    expect(stretch.paidBase).toBe(30); expect(stretch.organicBase).toBe(-100);
    expect(stretch.paidMove).toBe(1200); expect(stretch.organicMove).toBe(-2400);
    const google = stretch.channels.find(c => c.name === "Google");
    expect(google.move).toBe(google.points.reduce((a, p) => a + p.delta, 0)); expect(google.move).toBe(800);
  });
  it("separates OS/country and excludes incomplete weeks by an explicit cutoff", () => {
    const result = run([...rows(), ...rows().map(r => ({ ...r, countryname: "US", platformname: "Android" }))], { country: "KR", cutoffDate: "2025-04-14" });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].points.every(p => isoWeekStart(2025, p.week) < "2025-04-14")).toBe(true);
  });
  it("marks incomplete mix unknown rather than inventing overlap or male counts", () => {
    const raw = rows().map(r => ({ ...r, gender: "", age_bucket: "", female_rr: "700" }));
    const result = run(raw), mix = result.stretches[0].mix;
    expect(mix.find(m => m.axis === "age").overlap).toBeNull();
    expect(mix.find(m => m.axis === "gender").groups.map(g => g.name)).toContain("Non-female / unknown");
    expect(mix.find(m => m.axis === "gender").groups.map(g => g.name)).not.toContain("Male");
  });
  it("handles ISO year boundaries and validates week 53", () => {
    expect(isoWeekForDate("2024-12-30")).toEqual({ year: 2025, week: 1 });
    expect(isoWeekStart(2025, 53)).toBeNull(); expect(isoWeekStart(2020, 53)).toBe("2020-12-28");
    expect(isoWeekForDate("2026-02-30")).toBeNull();
  });
  it("reads date-valued week columns even with a separate year, and supports wide age counts", () => {
    const raw = rows().map(r => ({ ...r, week: isoWeekStart(Number(r.year), Number(r.week)), age_bucket: "", age_18_24: String(Number(r.cnt) * 0.6), age_25_34: String(Number(r.cnt) * 0.4) }));
    const mapping = guessReportMapping(Object.keys(raw[0]), WEEKLY_MOVEMENT_FIELDS, raw);
    expect(mapping.week).toBe("date");
    const data = normalizeCannibalDetail(raw, mapping), view = buildCannibalDetailView(data);
    expect(data.invalidRows).toBe(0);
    expect(view.stretches[0].mix.find(axis => axis.axis === "age").overlap).toBeCloseTo(1);
    const invalid = raw.map(r => ({ ...r, age_45_plus: "10", age_45_54: "10" }));
    const invalidMapping = guessReportMapping(Object.keys(invalid[0]), WEEKLY_MOVEMENT_FIELDS, invalid);
    const invalidData = normalizeCannibalDetail(invalid, invalidMapping);
    expect(invalidData.invalidAgeRows).toBe(invalid.length);
    expect(buildCannibalDetailView(invalidData).stretches[0].mix.find(axis => axis.axis === "age").overlap).toBeNull();
  });
});
