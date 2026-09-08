export function limitAhaObservationWindow(colMap, outcomeStartDay) {
  const confirmed = Number.isInteger(outcomeStartDay) && outcomeStartDay > 0;
  if (!confirmed) return { colMap, confirmed: false, excluded: [] };
  const excluded = [];
  const scoped = Object.fromEntries(Object.entries(colMap).map(([header, definition]) => {
    if (definition.role === "feature" && !(Number.isFinite(definition.window) && definition.window < outcomeStartDay)) {
      excluded.push(header);
      return [header, { ...definition, role: "unused" }];
    }
    return [header, definition];
  }));
  return { colMap: scoped, confirmed, excluded };
}
