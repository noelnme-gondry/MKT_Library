// Server-only helper — scans public/content/pages/ for translated EN guide JSON
// (*.en.json) and resolves each id to its EN route + display title.
//
// Reuses the SAME existence check (`{id}.en.json` present) that SopContent.jsx's
// DATA_BASED_PAGES-driven EN loader relies on for "is this guide translated" — a
// single source of truth so the nav list and the actual fetch fallback never drift
// apart (§7 CLAUDE.md pitfall: two places judging "translated" differently).
//
// Plain module, NOT "use client" — uses node:fs, must stay server-only.
import fs from "node:fs";
import path from "node:path";
import { idToSlug } from "@/lib/routeMap";

export function listTranslatedGuides() {
  const dir = path.join(process.cwd(), "public", "content", "pages");
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }

  return files
    .filter((f) => f.endsWith(".en.json"))
    .map((f) => f.slice(0, -".en.json".length))
    .map((id) => {
      let title = id;
      try {
        const raw = fs.readFileSync(path.join(dir, `${id}.en.json`), "utf8");
        const data = JSON.parse(raw);
        title = data.title || id;
      } catch {
        // Malformed/missing file — fall back to id as label rather than crash the nav.
      }
      const koSlug = idToSlug[id];
      if (!koSlug) return null; // not a routeMap SOP id, skip
      return { id, title, enSlug: `/en${koSlug}` };
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}
