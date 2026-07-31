import { validateProjectFile } from "./projectSchema";

function normalizedHeaders(headers) {
  return (headers || []).map((header) => String(header).trim().normalize("NFKC").toLowerCase()).sort();
}

export async function headerFingerprint(headers) {
  const payload = new TextEncoder().encode(normalizedHeaders(headers).join("\u001f"));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function filterToJson(filter) {
  const list = (value) => [...(value || [])].map(String).sort();
  return {
    dateStart: filter?.dateStart || undefined,
    dateEnd: filter?.dateEnd || undefined,
    platforms: list(filter?.platforms),
    countries: list(filter?.countries),
    channels: list(filter?.channels),
    sources: list(filter?.sources),
  };
}

export async function serializeProject(state, locale = "ko") {
  const groups = {};
  for (const [group, slice] of Object.entries(state.csvGroups || {})) {
    const mapping = slice?.mapping || {};
    if (!slice?.headers?.length && !Object.keys(mapping).length) continue;
    groups[group] = {
      headerFingerprint: await headerFingerprint(slice.headers || Object.keys(mapping)),
      mapping: Object.fromEntries(Object.entries(mapping).map(([key, value]) => [String(key), String(value)])),
      filters: filterToJson(state.dashboardFilterGroups?.[group]),
    };
  }
  return validateProjectFile({
    schemaVersion: 1,
    product: "growthopt-playbook",
    locale: locale === "en" ? "en" : "ko",
    exportedAt: new Date().toISOString(),
    groups,
    viewConfig: structuredClone(state.viewConfig || {}),
    customMetrics: structuredClone(state.customMetrics || {}),
    customCharts: structuredClone(state.customCharts || {}),
  });
}

export function parseProjectText(text) {
  if (new TextEncoder().encode(text).length > 1_000_000) throw new Error("PROJECT_FILE_TOO_LARGE");
  return validateProjectFile(JSON.parse(text));
}

