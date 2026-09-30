import { CURRENCY_SYMBOLS } from "./format";

// Presentation only: pad the observed costs so bubbles do not touch the edges.
// The median reference and every underlying cost stay unchanged.
export function decisionCostBounds(costs) {
  const values = costs.filter(value => Number.isFinite(value) && value > 0);
  if (!values.length) return { min: 0, max: 1 };
  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = Math.max(high - low, high * 0.01) * 0.2;
  const lower = Math.max(0, low - padding);
  const upper = high + padding;
  const rawStep = (upper - lower) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = ([1, 2, 5, 10].find(n => n * magnitude >= rawStep) || 10) * magnitude;
  return { min: Math.floor(lower / step) * step, max: Math.ceil(upper / step) * step };
}

// Fixed one-decimal compact formatting can label several different ticks “5.9억”.
// Pick precision from the actual tick interval, retaining one unit across the axis.
export function decisionCostTick(value, ticks, currency = "KRW", locale = "ko") {
  const values = ticks.map(tick => Number(tick.value)).filter(Number.isFinite).sort((a, b) => a - b);
  const largest = Math.max(...values.map(Math.abs), Math.abs(value));
  const units = currency === "KRW" && locale === "ko"
    ? [[1e8, "억"], [1e4, "만"]]
    : [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  const [unit, suffix] = units.find(([size]) => largest >= size) || [1, ""];
  const steps = values.slice(1).map((n, index) => n - values[index]).filter(n => n > 0);
  const step = steps.length ? Math.min(...steps) : unit;
  const digits = Math.min(12, Math.max(0, Math.ceil(-Math.log10(step / unit)) + 1));
  return `${CURRENCY_SYMBOLS[currency] || "₩"}${(value / unit).toLocaleString(locale === "ko" ? "ko-KR" : "en-US", { maximumFractionDigits: digits })}${suffix}`;
}
