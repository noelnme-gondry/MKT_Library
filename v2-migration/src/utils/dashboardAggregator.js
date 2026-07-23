import { DERIVED_METRICS, computeMetrics } from "./metrics/metricRegistry.js";

const CURRENCY_SYMBOLS = { KRW: "₩", USD: "$" };

/**
 * 값 크기별 자릿수 적응 통화 포맷 — index.html fmtCurrencyPrecise 이식(§7 0-뭉개짐 방지).
 * |v|<10 → 2자리, <1000 → 1자리, 그 외 0자리. 표시 통화(₩/$)만 전환(값 변환 아님).
 */
export function fmtCurrencyPrecise(value, currency = "KRW") {
  if (value == null || !isFinite(value)) return "—";
  const sym = CURRENCY_SYMBOLS[currency] || "₩";
  const a = Math.abs(value);
  const dec = a === 0 ? 0 : a < 10 ? 2 : a < 1000 ? 1 : 0;
  return `${sym}${Number(value).toLocaleString("ko-KR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })}`;
}

// KPI 카드처럼 한 줄 안에 읽어야 하는 큰 금액용 표기. 원화는 달러보다 자릿수가
// 훨씬 길어 같은 글자 크기에서 카드 위계를 깨뜨리므로, 원본 숫자를 숨기지 않고
// 읽기 쉬운 단위로만 축약한다. 표·CSV·툴팁은 fmtCurrencyPrecise를 계속 써서
// 정확한 금액을 유지한다.
export function fmtCurrencyCompact(value, currency = "KRW", locale = "ko") {
  if (value == null || !isFinite(value)) return "—";
  const sym = CURRENCY_SYMBOLS[currency] || "₩";
  const abs = Math.abs(Number(value));
  const sign = Number(value) < 0 ? "−" : "";
  const display = (scaled, suffix, digits = 1) => `${sign}${sym}${scaled.toLocaleString("en-US", { maximumFractionDigits: digits })}${suffix}`;
  if (currency === "KRW") {
    if (abs >= 1e8) return locale === "ko" ? display(abs / 1e8, "억") : display(abs / 1e6, "M");
    if (abs >= 1e4) return locale === "ko" ? display(abs / 1e4, "만") : display(abs / 1e3, "K");
  }
  if (currency === "USD" && abs >= 1e6) return display(abs / 1e6, "M");
  if (currency === "USD" && abs >= 1e3) return display(abs / 1e3, "K");
  return fmtCurrencyPrecise(value, currency);
}

/**
 * 전역 분모 기준(설치/가입) 해석 — index.html effectiveDenomBasis 이식(§12.18).
 * 요청한 basis가 매핑에 없으면 installs → actions 순으로 자동 폴백.
 * mapping = { origHeader: standardKey } 이므로 표준키 집합으로 판별.
 */
export function effectiveDenomBasis(csvData, requested) {
  const mapped = new Set(Object.values((csvData && csvData.mapping) || {}));
  let b = requested || "installs";
  if (!mapped.has(b)) {
    b = mapped.has("installs") ? "installs" : mapped.has("actions") ? "actions" : b;
  }
  return b;
}

/**
 * 가중 리텐션 (SSOT) — 스코어카드·리텐션(코호트) 탭이 공유. index.html computeWeightedRetention 이식(§7).
 * 분모 = Σ 모수(설치 or 액션). 분자 = 비율컬럼이면 Σ(ret×모수), 인원수컬럼이면 Σret.
 * 비율/인원 판별: 컬럼 단위 max ≤ 1 → 비율(0.x), 초과 → 인원수(자연수).
 * (정수 퍼센트 30=30%는 인원수로 잡혀 hasWholePct 경고.) 단순 산술평균(비가중) 금지 — 코호트 크기 가중.
 * @param {Array<Object>} rows 표준키 매핑된 rows
 * @param {number} day Dn (7·14·30…) — ret_d{day} 컬럼 읽음
 * @param {"installs"|"actions"} basis 모수 기준
 */
export function computeWeightedRetention(rows, day, basis) {
  const rk = `ret_d${day}`;
  const vals = rows.map((r) => Number(r[rk])).filter((v) => isFinite(v) && v > 0);
  if (!vals.length) return { rate: null, survivors: 0, denom: 0, isRate: null };
  const isRate = Math.max(...vals) <= 1; // 컬럼 단위 판별
  let num = 0,
    denom = 0,
    hasWholePct = false;
  for (const r of rows) {
    const v = Number(r[rk]);
    if (!isFinite(v) || v <= 0) continue;
    const base = Number(r[basis]) || 0;
    if (isRate) {
      num += v * base;
      denom += base;
    } else {
      num += v; // 인원수 그대로
      denom += base;
      if (v > 1 && v <= 100) hasWholePct = true; // 정수 퍼센트 의심
    }
  }
  const rate = denom > 0 ? Math.min(1, Math.max(0, num / denom)) : null;
  return { rate, survivors: Math.round(num), denom, isRate, hasWholePct };
}

// 코호트 곡선용 SSOT. D0는 시작 모수 자체라 정의상 100%이며, 이후 시점만
// computeWeightedRetention으로 모수 가중 집계한다.
export function buildRetentionCurve(rows, basis, days = [0, 7, 14]) {
  return days.map((day) => day === 0 ? 1 : computeWeightedRetention(rows, day, basis).rate);
}

/**
 * 데이터를 표준 키로 매핑하여 반환합니다.
 */
export function getMappedRows(csvData) {
  if (!csvData || !csvData.raw || csvData.raw.length === 0) return [];
  const { raw, mapping } = csvData;

  return raw.map((row) => {
    const mapped = {};
    for (const [origKey, val] of Object.entries(row)) {
      const standardKey = mapping[origKey];
      if (standardKey && standardKey !== "__ignore__") {
        mapped[standardKey] = val;
      }
    }
    // cost/spend 별칭 (§7): 효율 CSV는 비용을 'cost' 표준키로, creative CSV는 'spend'로 매핑.
    // 엔진마다 읽는 키가 다름(PVM/creativeMath=spend, ALLOC/dashboard=cost) → 둘 다 채워 도구별 불일치 방지.
    if (mapped.cost != null && mapped.spend == null) mapped.spend = mapped.cost;
    else if (mapped.spend != null && mapped.cost == null) mapped.cost = mapped.spend;
    // Date normalization if needed
    if (mapped.date) {
      // Basic normalization (assuming YYYY-MM-DD or parsing needed)
      // In old code, usually it was kept as string YYYY-MM-DD
    }
    return mapped;
  });
}

/**
 * 모니터링 대시보드의 필터 상태에 따라 매핑된 데이터를 필터링합니다.
 */
export function getMonFilteredRows(csvData, filterState) {
  let rows = getMappedRows(csvData);
  const f = filterState;

  if (f.dateStart) rows = rows.filter((r) => r.date >= f.dateStart);
  if (f.dateEnd) rows = rows.filter((r) => r.date <= f.dateEnd);
  
  if (f.platforms && f.platforms.size > 0)
    rows = rows.filter((r) => f.platforms.has(String(r.platform || "").trim()));
  
  if (f.countries && f.countries.size > 0)
    rows = rows.filter((r) => f.countries.has(String(r.country || "").trim()));
  
  if (f.channels && f.channels.size > 0)
    rows = rows.filter((r) => f.channels.has(String(r.channel || "").trim()));

  if (f.sources && f.sources.size > 0)
    rows = rows.filter((r) => f.sources.has(String(r.source || "").trim()));

  return rows;
}

/**
 * 현재 선택된 필터 및 코호트를 기준으로 핵심 성과 지표(KPI)를 자동 계산합니다.
 */
export function calculateKPIs(filteredRows, cohort = 7, denomBasis = "installs") {
  const sum = (key) =>
    filteredRows.reduce((a, r) => {
      const val = Number(r[key]);
      return a + (isNaN(val) ? 0 : val);
    }, 0);

  const cost = sum("cost");
  const impressions = sum("impressions");
  const clicks = sum("clicks");
  const installs = sum("installs");
  const revenue = sum(`revenue_d${cohort}`);
  const purchases = sum(`pu_d${cohort}`);
  // 전역 분모 기준(§12.18): 설치=installs / 가입=actions. CPI/CPA·CVR·ARPU 분모 전환.
  const actions = sum("actions");
  const denom = denomBasis === "actions" ? actions : installs;

  // 리텐션은 SSOT computeWeightedRetention 재사용(§7) — 비율/인원수 컬럼 자동 판별 +
  // 모수 가중. 예전엔 여기서 문자열 값만 %/비율 변환하고 숫자(인원수) 값은 그대로
  // 평균해버려 ret_d7=50(명) 같은 값이 "50%"·"10895%"로 튀는 버그가 있었음.
  const retentionAvg = computeWeightedRetention(filteredRows, cohort, denomBasis).rate;

  // 파생 지표(cpm·ctr·cpc·cpi·cvr·purchaseRate·roas·cpp·cpa·arpu·arppu)는 이제
  // metricRegistry(SSOT)가 정의 — 여기서 하드코딩하지 않고 레지스트리 compute를 소비.
  // agg 계약: registry의 파생식이 읽는 정규화 집계객체(denom·revenue·purchases는
  // 위에서 분모기준·코호트 해석 완료). 반환 shape·값은 기존과 byte-identical.
  const agg = { cost, impressions, clicks, installs, actions, revenue, purchases, denom };
  const derived = computeMetrics(agg, DERIVED_METRICS);

  return {
    cost,
    impressions,
    clicks,
    installs,
    actions,
    revenue,
    purchases,
    denomBasis,
    denom,
    ...derived,
    retentionAvg,
    cohort,
  };
}

export function aggregateByKey(rows, keyField, sumFields) {
  const map = new Map();
  for (const r of rows) {
    const k = r[keyField] || "Unknown";
    if (!map.has(k)) {
      const obj = { _key: k };
      sumFields.forEach((f) => (obj[f] = 0));
      map.set(k, obj);
    }
    const tgt = map.get(k);
    sumFields.forEach((f) => {
      const v = Number(r[f]);
      if (!isNaN(v)) tgt[f] += v;
    });
  }
  return Array.from(map.values());
}
