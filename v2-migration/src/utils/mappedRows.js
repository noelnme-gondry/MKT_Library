// Shared raw-to-standard projection. Large imports can precompute this in a
// Worker so every tool reuses the same mapped row array.
export function mapRowsToStandard(raw = [], mapping = {}) {
  return raw.map((row) => {
    const mapped = {};
    for (const [origKey, value] of Object.entries(row || {})) {
      const standardKey = mapping[origKey];
      if (standardKey && standardKey !== "__ignore__") mapped[standardKey] = value;
    }
    if (mapped.cost != null && mapped.spend == null) mapped.spend = mapped.cost;
    else if (mapped.spend != null && mapped.cost == null) mapped.cost = mapped.spend;
    return mapped;
  });
}
