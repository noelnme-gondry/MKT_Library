const MAX_PERSISTED_EVENT_MARKERS = 200;
export const sanitizeEventMarkers = (markers) => {
  if (!Array.isArray(markers)) return [];
  return markers
    .filter((marker) => marker && typeof marker === "object")
    .slice(0, MAX_PERSISTED_EVENT_MARKERS)
    .map((marker) => ({
      id: String(marker.id ?? "").slice(0, 40),
      date: String(marker.date ?? "").slice(0, 40),
      label: String(marker.label ?? "").slice(0, 120),
      type: ["listing", "creative", "price", "campaign", "release", "external", "other"].includes(marker.type) ? marker.type : "other",
    }))
    .filter((marker) => marker.date || marker.label);
};
