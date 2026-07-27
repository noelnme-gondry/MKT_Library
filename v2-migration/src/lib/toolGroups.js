// route id → client-side CSV slice. Similar-grain tools share one slice;
// different grains stay isolated so navigating between tools never overwrites
// an unrelated dataset.
export const TOOL_GROUP = {
  "5-2": "efficiency", "5-21": "efficiency", "5-22": "efficiency", "5-3": "efficiency",
  // 5-6 is a defensive alias: 9-6 is the published route, while the creative
  // uploader still uses 5-6 for its demo/guide contract.
  "5-6": "creative",
  "5-4": "experiment", "5-7": "experiment", "5-15": "experiment",
  "5-18": "response",
  "5-20": "aha",
  "5-23": "incrementality",
  "9-1": "content_attr",
  "9-2": "content_aha",
  "9-3": "content_traffic",
  "9-6": "creative",
  "9-7": "content_dashboard",
};

// Home and guide routes never consume csvData; the efficiency fallback keeps
// the store mirror valid for those routes without creating an unused slice.
export const groupForRoute = (id) => TOOL_GROUP[id] || "efficiency";
