import fs from "fs";
import path from "path";

// Server/build-time loader. Passing the parsed JSON into the client enhancer
// keeps the complete guide in initial HTML while preserving copy/sort controls.
export function readSopData(routeId, locale = "ko") {
  const candidates = locale === "en" ? [`${routeId}.en.json`, `${routeId}.json`] : [`${routeId}.json`];
  for (const fileName of candidates) {
    try {
      const filePath = path.join(process.cwd(), "public", "content", "pages", fileName);
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      // Try the locale fallback or return null after the final candidate.
    }
  }
  return null;
}
