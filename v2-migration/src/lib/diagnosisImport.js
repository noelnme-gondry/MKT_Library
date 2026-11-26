import Papa from "papaparse";
import { stripCurrencySuffix } from "./data-import/headerUnits";
import { normalizeNumericValue, parseDateValue } from "./data-import/normalizeValues";
import { prepareCsvParseInput } from "./data-import/csvParseInput";

export const DIAGNOSIS_SAMPLE_URL = "/examples/campaign-diagnosis.csv";

function field(key, ko, en, aliases = [], numeric = false) {
  return { key, ko, en, aliases: [key, ko, en, ...aliases], numeric };
}

// Only additive amounts and counts belong in metric slots. A rate such as
// install conversion rate must never be chosen merely because it contains "install".
export const DIAGNOSIS_FIELDS = [
  field("date", "날짜", "Date", ["dt", "day", "일", "일자", "기간 시작일", "reporting starts", "week", "week start", "주차", "주 시작일"]),
  field("cost", "광고비", "Spend", ["cost", "비용", "지출", "지출 금액", "총비용", "amount spent", "ad spend"], true),
  field("result", "성과 건수", "Outcome count", ["results", "성과", "설치", "설치 수", "설치 건수", "installs", "가입", "회원가입", "가입 수", "signups", "전환", "전환수", "conversions", "구매", "구매 수", "purchases", "leads"], true),
  field("channel", "채널", "Channel", ["매체", "광고 매체", "매체명", "network", "media", "media source", "source"]),
  field("campaign", "캠페인", "Campaign", ["campaign name", "campaign id", "캠페인 이름", "캠페인명", "캠페인 ID"]),
  field("creative", "소재", "Creative", ["creative id", "creative name", "ad name", "소재명", "소재 ID", "광고 이름"]),
  field("organic", "오가닉 성과", "Organic outcomes", ["organic", "organic installs", "오가닉 설치", "자연 유입 설치", "자연 전환"], true),
  field("market", "시장", "Market", ["국가", "지역", "country", "region"]),
  field("platform", "플랫폼", "Platform", ["운영체제", "os", "operating system", "device os", "앱 플랫폼"]),
  field("currency", "통화", "Currency", ["통화 코드", "currency code", "account currency"]),
  field("impressions", "노출", "Impressions", ["노출수", "노출 건수", "imps"], true),
  field("clicks", "클릭", "Clicks", ["클릭수", "탭", "taps"], true),
  field("reach", "도달", "Reach", ["도달수", "도달 인원", "unique reach"], true),
  field("frequency", "노출 빈도", "Frequency", ["빈도", "평균 빈도", "average frequency"], true),
  field("change", "변경 이력", "Change log", ["액션", "변경 사항", "change history", "action", "change note"]),
  field("budget", "설정 예산", "Configured budget", ["예산", "budget", "daily budget", "일 예산"], true),
];

const normalizeHeader = (s) => stripCurrencySuffix(s.normalize("NFKC")).trim().toLowerCase().replace(/[\s_-]+/g, "");
const required = ["date", "cost", "result"];
const blank = (s) => /^(?:|-|n\/a|na|null|없음)$/i.test(String(s ?? "").trim());
const label = (locale, ko, en) => locale === "en" ? en : ko;

export function inferDiagnosisMapping(headers) {
  return Object.fromEntries(DIAGNOSIS_FIELDS.map(({ key, aliases }) => {
    const names = new Set(aliases.map(normalizeHeader));
    const candidates = headers.filter((h) => names.has(normalizeHeader(h)));
    return [key, candidates.length === 1 ? candidates[0] : ""];
  }));
}

export function parseDiagnosisCsv(text, locale = "ko") {
  const parsed = Papa.parse(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: true,
    delimitersToGuess: [",", "\t", ";", "|"],
  });
  const fail = (ko, en) => { throw new Error(label(locale, ko, en)); };
  if (parsed.errors.length) {
    const row = (parsed.errors[0].row ?? 0) + 1;
    fail(`CSV 구분자와 따옴표를 확인해 주세요 (레코드 ${row}).`, `Check CSV delimiters and quotes near record ${row}.`);
  }
  const [first = [], ...records] = parsed.data;
  const headers = first.map((h) => h.trim());
  if (!records.length) fail("헤더 아래에 데이터가 필요합니다.", "Add data below the column headers.");
  if (headers.some((h) => !h) || new Set(headers).size !== headers.length) {
    fail("모든 열에 서로 다른 제목을 입력해 주세요.", "Give every column a unique, nonempty header.");
  }
  const mismatch = records.findIndex((r) => r.length !== headers.length);
  if (mismatch >= 0) fail(`데이터 ${mismatch + 1}행의 열 개수가 헤더와 다릅니다.`, `Data row ${mismatch + 1} has a different number of columns from the header.`);
  return { headers, records, mapping: inferDiagnosisMapping(headers) };
}

export async function readDiagnosisFile(file, locale) {
  const input = await prepareCsvParseInput(file);
  if (typeof input === "string") return parseDiagnosisCsv(input, locale);
  const text = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(input);
  });
  return parseDiagnosisCsv(text, locale);
}

export function suggestedGrain({ headers, mapping, records }) {
  const header = mapping.date;
  const index = headers.indexOf(header);
  return /week|주차|주시작/i.test(normalizeHeader(header || "")) ||
    parseDateValue(records[0]?.[index])?.grain === "week" ? "weekly" : "daily";
}

const knownCodes = { "원": "KRW", "₩": "KRW", "€": "EUR", "£": "GBP" };
export const DIAGNOSIS_CURRENCIES = typeof Intl.supportedValuesOf === "function"
  ? Intl.supportedValuesOf("currency")
  : ["KRW","USD","EUR","JPY","GBP","CNY","TWD","HKD","SGD","CAD","AUD","CHF","NZD","INR"];
const parseCurrency = (raw) => knownCodes[raw] || (DIAGNOSIS_CURRENCIES.includes(raw) ? raw : null);
function explicitCurrency(raw) {
  const token = String(raw || "").toUpperCase().match(/^(?:[A-Z]{3}|[₩€£원])|(?:[A-Z]{3}|[₩€£원])$/);
  return token && parseCurrency(token[0]);
}
export function diagnosisScopeValues(data, mapping, key, market = "") {
  if (!data || !mapping[key]) return [];
  const index = data.headers.indexOf(mapping[key]);
  const marketIndex = data.headers.indexOf(mapping.market);
  if (index < 0) return [];
  const values = new Set();
  for (const record of data.records) {
    if (!market || record[marketIndex]?.trim() === market) values.add(record[index].trim());
  }
  return [...values].sort();
}

export function mapDiagnosisData(data, mapping, {
  locale = "ko", grain = "daily", currency = "", targetCpa = null, organicExclusive = false, source = "file",
  market = "", platform = "",
} = {}) {
  const fail = (ko, en) => { throw new Error(label(locale, ko, en)); };
  if (required.some((key) => !mapping[key]) || ![mapping.channel, mapping.campaign].some(Boolean)) {
    fail("날짜, 광고비, 성과 건수, 채널 또는 캠페인 열을 연결해 주세요.", "Select date, spend, outcome count, and a channel or campaign column.");
  }
  const fields = DIAGNOSIS_FIELDS.filter((f) => mapping[f.key]).map((f) => ({ ...f, index: data.headers.indexOf(mapping[f.key]) }));
  if (fields.some((f) => f.index < 0) || new Set(fields.map((f) => f.index)).size !== fields.length) {
    fail("각 항목에 서로 다른 열을 연결해 주세요.", "Choose a different source column for each field.");
  }
  const currencyCodes = new Set();
  const headerUnit = mapping.cost.match(/[(\[]\s*([^()[\]]+)\s*[)\]]\s*$/)?.[1];
  const headerCurrency = explicitCurrency(headerUnit);
  const ambiguousUnits = new Set(String(headerUnit || "").match(/[$¥]/g) || []);
  if (headerCurrency) currencyCodes.add(headerCurrency);
  if (currency) currencyCodes.add(currency);
  if (targetCpa != null && !(Number.isFinite(targetCpa) && targetCpa > 0)) {
    fail("목표 CPA는 양수로 입력해 주세요.", "Enter a positive target CPA.");
  }
  let weeklyDay = null;
  let missingCurrency = false;
  const marketIndex = data.headers.indexOf(mapping.market);
  const platformIndex = data.headers.indexOf(mapping.platform);
  const rows = [];
  data.records.forEach((record, i) => {
    if (market && record[marketIndex]?.trim() !== market) return;
    if (platform && record[platformIndex]?.trim() !== platform) return;
    const row = {};
    for (const f of fields) {
      const raw = record[f.index].trim();
      row[f.key] = raw || null;
      const invalid = (ko, en) => fail(`데이터 ${i + 1}행 · ${mapping[f.key]} — ${ko}`, `Data row ${i + 1} · ${mapping[f.key]} — ${en}`);
      if (f.key === "date") {
        const date = parseDateValue(raw);
        if (!date || date.ambiguous || date.grain === "month" || (date.grain === "week" && grain !== "weekly")) {
          invalid("일자는 YYYY-MM-DD, 주별 합계는 시작일 또는 ISO 주차로 입력해 주세요.", "Use YYYY-MM-DD for dates or a week start / ISO week for weekly totals.");
        }
        if (grain === "weekly" && weeklyDay !== null && weeklyDay !== date.date.getUTCDay()) {
          invalid("주별 합계의 시작 요일을 통일해 주세요.", "Use the same starting weekday for each weekly total.");
        }
        weeklyDay = date.date.getUTCDay();
        row.date = date.isoDate;
      } else if (f.numeric) {
        const isMoney = f.key === "cost" || f.key === "budget";
        const code = isMoney ? explicitCurrency(raw) : null;
        const numericText = code ? raw.replace(new RegExp(`^${code}\\s*|\\s*${code}$`, "i"), "") : raw;
        const parsed = normalizeNumericValue(numericText);
        if (!blank(raw) && (!parsed || parsed.isPercent || parsed.value < 0)) {
          invalid("0 이상의 숫자 또는 빈칸이 필요합니다.", "Use a nonnegative number or leave it blank.");
        }
        if (!isMoney && /[₩$€£¥원]|krw|usd|eur|jpy|gbp/i.test(raw)) {
          invalid("성과·도달·노출에는 금액을 입력할 수 없습니다.", "Use counts or frequency here, not monetary values.");
        }
        row[f.key] = parsed?.value ?? null;
        if (f.key === "cost") {
          if (row.cost == null) invalid("비용이 없으면 합계를 계산할 수 없습니다. 실제 무지출은 0으로 입력해 주세요.", "Spend is missing. Enter 0 for an actual zero-spend record.");
        }
        if (isMoney) {
          for (const symbol of raw.match(/[$¥]/g) || []) ambiguousUnits.add(symbol);
          if (code) currencyCodes.add(code);
        }
      } else if (f.key === "currency") {
        if (raw && !parseCurrency(raw.toUpperCase())) invalid("세 자리 통화 코드를 입력해 주세요.", "Use a three-letter currency code.");
        if (raw) currencyCodes.add(parseCurrency(raw.toUpperCase()));
        else missingCurrency = true;
      }
    }
    if (!row.channel && !row.campaign) fail(`데이터 ${i + 1}행의 채널 또는 캠페인이 비어 있습니다.`, `Fill a channel or campaign on data row ${i + 1}.`);
    rows.push(row);
  });
  if (!rows.length) fail("선택한 시장·플랫폼에 해당하는 행이 없습니다.", "No rows match the selected market and platform.");
  if (currencyCodes.size > 1) fail("여러 통화가 섞여 있습니다. 같은 통화의 시장을 선택하거나 환산한 CSV를 사용해 주세요.", "The selected rows contain conflicting currencies. Select a single-currency market or convert spend before analysis.");
  if (mapping.currency && missingCurrency && !currency && !headerCurrency && currencyCodes.size) fail("통화가 비어 있는 행이 있습니다. 해당 행의 통화를 확인해 선택해 주세요.", "Some rows have no currency. Confirm their currency using the currency selector.");
  const resolvedCurrency = [...currencyCodes][0] || null;
  for (const symbol of ambiguousUnits) {
    const display = resolvedCurrency && new Intl.NumberFormat("en-US", {style:"currency", currency:resolvedCurrency, currencyDisplay:"narrowSymbol"}).formatToParts(1);
    if (!display?.some(part => part.type === "currency" && part.value === symbol)) {
      fail(`파일의 ${symbol} 기호에 맞는 통화 코드를 선택해 주세요. 통화가 섞여 있다면 환산 후 다시 시도해 주세요.`, `Choose the currency code represented by ${symbol}. Convert mixed currencies before analysis.`);
    }
  }
  for (const row of rows) row.currency = resolvedCurrency;
  const scope = {
    markets: [...new Set(rows.map(r => r.market || ""))].sort(),
    platforms: [...new Set(rows.map(r => r.platform || ""))].sort(),
    fileRows: data.records.length, selectedRows: rows.length,
  };
  const supplementalScopeHeld = scope.markets.length > 1 || scope.platforms.length > 1;
  return { rows, meta: { source, grain, currency: resolvedCurrency, resultLabel: mapping.result, warnings: [], organicExclusive, targetCpa, scope, supplementalScopeHeld } };
}

export async function loadDiagnosisExample(locale = "ko", signal) {
  const response = await fetch(DIAGNOSIS_SAMPLE_URL, { signal });
  if (!response.ok) throw new Error(label(locale, "예시 파일을 불러오지 못했습니다.", "Could not load the example CSV."));
  const parsed = parseDiagnosisCsv(await response.text(), locale);
  const result = mapDiagnosisData(parsed, parsed.mapping, { locale, source: "example", organicExclusive: true, targetCpa: 12000 });
  result.meta.resultLabel = label(locale, "설치", "Installs");
  return result;
}
