import { buildDemoCsv } from "@/utils/demoData";
import { compareSamplePerformance } from "@/utils/sampleSpendPreview";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { buildLegacyRows } from "@/lib/data-import/canonical-v2/buildLegacyRows";

// Only this module's source rows and mapping can skip manual sample mapping.
// Display-only copies retain that identity; uploaded rows or remapping do not.
const journeys = new WeakMap();

export function buildSampleJourney(locale = "ko") {
  const demo = buildDemoCsv("efficiency", locale);
  const preview = compareSamplePerformance(demo.raw);
  const lead = preview?.channels[0];
  if (!lead) throw new Error("The built-in sample needs a comparable paid channel.");
  const dates = new Set(preview.dates);
  const raw = demo.raw.filter(row => row.source === "paid" && row.channel === lead.channel && dates.has(row.date));
  const csv = { ...demo, raw, importSource: "demo" };
  csv.canonicalData = buildCanonicalDataset(csv);
  csv.mappedRows = buildLegacyRows({ raw, legacyMapping: csv.mapping, toolId: "start-gate" });
  const context = {
    channel: lead.channel,
    period: { previousStart: preview.dates[0], previousEnd: preview.dates[6], currentStart: preview.dates[7], currentEnd: preview.dates[13] },
  };
  journeys.set(raw, { mapping: csv.mapping, context });
  return csv;
}

export function getSampleJourney(csv) {
  const entry = csv?.importSource === "demo" && journeys.get(csv.raw);
  return entry && entry.mapping === csv.mapping ? entry.context : null;
}
