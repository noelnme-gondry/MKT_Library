// Descriptive support at a chosen horizon, using already-normalized episodes.
// An early observed exit is a known outcome, not an immature censored episode.
export function survivalFollowup(rows, horizon) {
  if (!Array.isArray(rows) || !Number.isFinite(horizon) || horizon < 0) return null;
  const result = { horizon, total: rows.length, observedToHorizon: 0, earlyExit: 0, earlyCensored: 0, notEntered: 0 };
  for (const row of rows) {
    if (!Number.isFinite(row.time) || !Number.isFinite(row.entry) || ![0, 1].includes(row.event)) return null;
    if (row.entry > horizon) result.notEntered += 1;
    else if (row.time >= horizon) result.observedToHorizon += 1;
    else if (row.event === 1) result.earlyExit += 1;
    else result.earlyCensored += 1;
  }
  return result;
}

export function followupTable(overall, groups = []) {
  const entries = [{ segment: "all", ...overall }, ...groups.map(({ segment, followup }) => ({ segment, ...followup }))];
  return { name: "FOLLOWUP_SUPPORT", title: "Observed follow-up support; not a maturity estimate", rows: [
    ["segment", "horizon", "total", "observed_to_horizon", "exit_before_horizon", "censored_before_horizon", "not_entered_at_horizon"],
    ...entries.map((row) => [row.segment, row.horizon, row.total, row.observedToHorizon, row.earlyExit, row.earlyCensored, row.notEntered]),
  ] };
}
