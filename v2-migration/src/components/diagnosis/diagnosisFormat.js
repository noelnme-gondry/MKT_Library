export function diagnosisFormat(locale, currency) {
  const language = locale === "en" ? "en-US" : "ko-KR";
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  const money = new Intl.NumberFormat(language, currency ? {
    style: "currency", currency, maximumFractionDigits: currency === "KRW" ? 0 : 2,
  } : { maximumFractionDigits: 2 });
  const compact = new Intl.NumberFormat(language, { notation: "compact", maximumFractionDigits: 1 });
  const format = (value, formatter) => Number.isFinite(value) ? formatter.format(value) : "—";
  const signed = (value, formatter) => Number.isFinite(value)
    ? (value > 0 ? "+" : value < 0 ? "−" : "") + formatter.format(Math.abs(value))
    : "—";
  return {
    money: (value) => format(value, money),
    num: (value) => format(value, number),
    delta: (value) => signed(value, number),
    moneyDelta: (value) => signed(value, money),
    short: (value) => format(value, compact),
    percent: (value) => Number.isFinite(value) ? number.format(value * 100) + "%" : "—",
    range: (period) => period?.start && period?.end ? period.start + " – " + period.end : "—",
  };
}
