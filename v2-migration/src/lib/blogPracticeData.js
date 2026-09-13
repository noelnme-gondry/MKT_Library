import { buildDemoCsv } from "@/utils/demoData";
import { csvBody } from "@/utils/download";

// Only registered, deterministic public fixtures are serialized; never store data.
export function buildBlogPracticeDownload(practice) {
  const demo = buildDemoCsv(practice.demoGroup, practice.locale);
  return {
    file: practice.file,
    text: csvBody(demo.headers, demo.raw.map(row => demo.headers.map(header => row[header]))),
    demo,
  };
}

// A filename is not proof of sample origin. Match every cell before marking a demo.
export function matchesBlogPracticeDemo(parsed, demo) {
  return parsed.meta.fields.length === demo.headers.length
    && parsed.meta.fields.every((header, index) => header === demo.headers[index])
    && parsed.data.length === demo.raw.length
    && parsed.data.every((row, index) => demo.headers.every(header => row[header] === String(demo.raw[index][header] ?? "")));
}
