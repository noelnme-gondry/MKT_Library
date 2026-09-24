// 블로그 글의 "예시 결과 카드"(시안 A)에 들어갈 숫자를 실제 엔진으로 계산한다.
//
// 이 모듈은 엔진을 import하므로 블로그 화면에서 직접 쓰지 않는다(콘텐츠 페이지에
// 앱 번들을 흘리지 않는다, §12.29). `blogExamples.test.js`가 이 계산을 다시 돌려
// `data.json`과 같은지 확인하고, 화면은 그 JSON만 읽는다.
//
// 숫자를 손으로 적지 않는다: 도구의 데모 데이터(또는 글이 지정한 예제 파일)를
// 같은 어댑터·엔진에 넣어 나온 값만 쓴다. 판정할 수 없으면 판정할 수 없다고 쓴다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { buildDemoCsv } from "@/utils/demoData";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { blogMapping } from "@/lib/blogInsightRunner";
import { BLOG_INSIGHT_PLACEMENTS } from "@/lib/blogInsightRegistry";
import { BLOG_PRACTICES } from "@/lib/blogPractice";
import { runEfficiencyAnalysis } from "@/lib/assistant/efficiencyAnalysisAdapters";
import { runOptimizationAnalysis } from "@/lib/assistant/optimizationAnalysisAdapters";
import { runSpecialAnalysis } from "@/lib/assistant/specialAnalysisAdapters";
import { runResponseAnalysis } from "@/lib/assistant/responseAnalysisAdapters";
import { STATS } from "@/utils/abTestMath";
import { AHA_STATS } from "@/utils/ahaMath";
import { runBrandInterruptedTimeSeries } from "@/utils/brandIncrementalityMath";

// 데모로 계산할 수 없는 도구는 같은 데이터로 답하는 가까운 도구의 예시를 쓴다.
// 카드 제목이 어떤 분석의 예시인지 밝히므로 숨기는 대체가 아니다.
// 5-3: 효율 데모는 배분 곡선을 적합할 만큼 채널별 지출 수준이 다양하지 않다(엔진이 not_computable).
// 5-18-mmm: MMM 적합은 무겁고 데모 132주로는 식별 판정이 따로 필요하다 — 글이 권하는 사전 점검(VIF)을 보여 준다.
export const EXAMPLE_TOOL_SUBSTITUTE = Object.freeze({ "5-3": "5-22", "5-18-mmm": "5-25" });

const r1 = (v) => Math.round(v * 10) / 10;
const pct = (v, d = 1) => `${(Math.round(v * 10 ** (d + 2)) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d })}%`;
const num = (v, d = 0) => Number(v).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const won = (v, en) => (en ? `₩${num(Math.round(v))}` : `${num(Math.round(v))}원`);
const signed = (s) => (s.startsWith("-") ? s.replace("-", "−") : `+${s}`);

function csvFromDemo(toolId) {
  const demo = buildDemoCsv(TOOL_GROUP[toolId], "ko");
  const raw = demo.raw.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? "" : String(v)])));
  const contract = blogMapping(raw, demo.headers, toolId);
  return { raw, headers: demo.headers, mapping: contract.mapping, currency: demo.currency || "KRW", importSource: "demo" };
}

function csvFromExample(file, toolId, currency) {
  const text = readFileSync(fileURLToPath(new URL(`../../../public/examples/${file}`, import.meta.url)), "utf8");
  const parsed = Papa.parse(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy" });
  const contract = blogMapping(parsed.data, parsed.meta.fields, toolId);
  return { raw: parsed.data, headers: parsed.meta.fields, mapping: contract.mapping, currency: currency || "KRW", importSource: "demo" };
}

function runAdapter(toolId, csvData) {
  const input = { toolId, csvData, locale: "ko", inputSignature: "blog-example", mappingSignature: "blog-example", options: { displayCurrency: csvData.currency, denomBasis: "installs" } };
  if (["5-2", "5-21", "5-22", "5-3"].includes(toolId)) return runEfficiencyAnalysis(input);
  if (["5-25", "5-26"].includes(toolId)) return runOptimizationAnalysis(input);
  if (["5-27", "9-6"].includes(toolId)) return runSpecialAnalysis(input);
  return runResponseAnalysis(input);
}

const stat = (res, id) => res.verdict?.stats?.find((s) => s.id === id)?.value;

// 카드 한 장의 모양: 결론 한 문장 + 막대(최대 5개, 강조 1개) + 캡션.
// 막대 폭·선 모양에만 쓰는 값은 10자리로 자른다 — 부동소수 마지막 자리가 CPU·Node 빌드마다
// 달라(CI에서 1e-14 차이) 신선도 테스트가 엔진 변화가 아닌 기계 차이에 깨졌다.
const stable = (v) => (typeof v === "number" && Number.isFinite(v) ? Number(v.toPrecision(10)) : v);
function card({ ko, en, bars = [], spark = null, note }) {
  const steadyBars = bars.map((b) => ({ ...b, value: stable(b.value) }));
  const steadySpark = spark ? JSON.parse(JSON.stringify(spark, (k, v) => stable(v))) : spark;
  return { ko: { headline: ko.headline, caption: ko.caption }, en: { headline: en.headline, caption: en.caption }, bars: steadyBars, spark: steadySpark, note: note || null };
}

const BUILDERS = {
  "5-2": (csv) => {
    const res = runAdapter("5-2", csv);
    if (res.status !== "success") return null;
    const rows = res.visualizations[0].data;
    const by = (m) => rows.find((r) => r.metric === m);
    const cost = by("cost"), inst = by("inst");
    const cpiChange = (cost.recent / inst.recent) / (cost.prior / inst.prior) - 1;
    const pick = ["cost", "imp", "clk", "inst"].map(by).filter(Boolean);
    const LABEL = { cost: ["지출", "Spend"], imp: ["노출", "Impressions"], clk: ["클릭", "Clicks"], inst: ["설치", "Installs"] };
    return card({
      ko: { headline: `최근 7일 설치당 비용이 ${pct(Math.abs(cpiChange))} ${cpiChange >= 0 ? "올랐습니다" : "내려갔습니다"}. 지출은 ${pct(Math.abs(cost.change))} ${cost.change >= 0 ? "늘었는데" : "줄었는데"} 설치는 ${Math.abs(inst.change) < 0.0005 ? "그대로였습니다" : `${pct(Math.abs(inst.change))} ${inst.change >= 0 ? "늘었습니다" : "줄었습니다"}`}.`, caption: "예시 데이터로 계산했습니다. 최근 7일과 직전 7일 비교." },
      en: { headline: `Cost per install ${cpiChange >= 0 ? "rose" : "fell"} ${pct(Math.abs(cpiChange))} in the last 7 days. Spend ${cost.change >= 0 ? "grew" : "fell"} ${pct(Math.abs(cost.change))}, while installs ${Math.abs(inst.change) < 0.0005 ? "stayed flat" : `${inst.change >= 0 ? "grew" : "fell"} ${pct(Math.abs(inst.change))}`}.`, caption: "Calculated on example data. Last 7 days vs the 7 days before." },
      bars: pick.map((r) => ({ label: { ko: LABEL[r.metric][0], en: LABEL[r.metric][1] }, value: r.change, display: signed(pct(r.change)), highlight: r.metric === "cost" })),
    });
  },
  "5-21": (csv) => {
    const res = runAdapter("5-21", csv);
    if (res.status !== "success") return null;
    const prior = stat(res, "prior-unit-cost"), recent = stat(res, "recent-unit-cost"), delta = stat(res, "unit-cost-change");
    const rows = [...res.visualizations[0].data].sort((a, b) => Math.sign(delta || 1) * (b.contribution - a.contribution));
    const top = rows[0];
    const share = top.contribution / delta;
    return card({
      ko: { headline: `설치당 비용이 ${won(Math.abs(delta))} ${delta >= 0 ? "올랐고" : "내려갔고"}, 그중 ${won(Math.abs(top.contribution))}이 ${top.entity}에서 나왔습니다.`, caption: `예시 데이터로 계산했습니다. 최근 7일과 직전 7일 비교, ${won(prior)} → ${won(recent)}.` },
      en: { headline: `Cost per install ${delta >= 0 ? "rose" : "fell"} by ${won(Math.abs(delta), true)}, and ${won(Math.abs(top.contribution), true)} of it came from ${top.entity}.`, caption: `Calculated on example data. Last 7 days vs the prior 7, ${won(prior, true)} → ${won(recent, true)}.` },
      bars: rows.slice(0, 5).map((r, i) => ({ label: { ko: r.entity, en: r.entity }, value: r.contribution, display: { ko: signed(won(r.contribution)), en: signed(won(r.contribution, true)) }, highlight: i === 0, suffix: i === 0 ? pct(share, 0) : null })),
    });
  },
  "5-22": (csv) => {
    const res = runAdapter("5-22", csv);
    if (res.status !== "success") return null;
    const rows = res.visualizations[0].data.filter((r) => Number.isFinite(r.saturationIndex)).sort((a, b) => b.saturationIndex - a.saturationIndex);
    const saturated = rows.filter((r) => r.verdict === "saturated").length;
    const top = rows[0];
    return card({
      ko: { headline: `채널 ${rows.length}개 중 ${saturated}개는 광고비를 더 쓰면 설치당 비용이 평균보다 비싸집니다. 가장 높은 곳은 평균의 ${num(top.saturationIndex, 2)}배입니다.`, caption: "예시 데이터로 계산했습니다. 한계 비용 ÷ 평균 비용, 1보다 크면 포화 신호." },
      en: { headline: `${saturated} of ${rows.length} channels get more expensive per install with extra spend. ${top.entity} is ${num(top.saturationIndex, 2)}× its average.`, caption: "Calculated on example data. Marginal ÷ average cost; above 1 signals saturation." },
      bars: rows.slice(0, 5).map((r, i) => ({ label: { ko: r.entity, en: r.entity }, value: r.saturationIndex, display: `${num(r.saturationIndex, 2)}×`, highlight: i === 0 })),
    });
  },
  "5-25": (csv) => {
    const res = runAdapter("5-25", csv);
    if (res.status !== "success") return null;
    const rows = res.visualizations[0].data.filter((r) => r.isComputable).sort((a, b) => b.vif - a.vif);
    const [a, b] = rows;
    return card({
      ko: { headline: `${a.entity}·${b.entity} 두 채널의 지출이 거의 같이 움직여서(VIF ${num(a.vif)}) 기여를 따로 나눌 수 없습니다.`, caption: "예시 데이터로 계산했습니다. VIF가 10을 넘으면 기여도 분리가 불안정합니다." },
      en: { headline: `${a.entity} and ${b.entity} spend move almost together (VIF ${num(a.vif)}), so their contributions cannot be separated.`, caption: "Calculated on example data. A VIF above 10 makes contribution estimates unstable." },
      bars: rows.slice(0, 5).map((r, i) => ({ label: { ko: r.entity, en: r.entity }, value: Math.log10(Math.max(1, r.vif)), display: num(r.vif, r.vif < 10 ? 2 : 0), highlight: i === 0 })),
      note: "log-scale",
    });
  },
  "5-26": (csv) => {
    const res = runAdapter("5-26", csv);
    if (res.status !== "success") return null;
    const items = [["exact-candidates", "Exact 승격", "Exact promotion"], ["raise-cpt", "CPT 증액", "Raise CPT"], ["lower-cpt", "CPT 감액", "Lower CPT"], ["negative-candidates", "제외 검토", "Negative review"]]
      .map(([id, ko, en]) => ({ id, ko, en, v: stat(res, id) ?? 0 }));
    const total = items.reduce((s, x) => s + x.v, 0);
    return card({
      ko: { headline: `검색어 보고서에서 바로 검토할 후보가 ${total}건 나옵니다. Exact 승격 ${items[0].v}건, CPT 조정 ${items[1].v + items[2].v}건입니다.`, caption: "예시 데이터로 계산했습니다. 목표 CPA와 탭·설치 수로 고른 운영 후보입니다." },
      en: { headline: `The search term report yields ${total} candidates to review: ${items[0].v} Exact promotions and ${items[1].v + items[2].v} CPT adjustments.`, caption: "Calculated on example data. Operating candidates chosen from target CPA, taps and installs." },
      bars: items.map((x, i) => ({ label: { ko: x.ko, en: x.en }, value: x.v, display: num(x.v), highlight: i === 0 })),
    });
  },
  "5-27": (csv) => {
    const res = runAdapter("5-27", csv);
    if (res.status !== "success") return null;
    const before = stat(res, "before-view-to-install"), after = stat(res, "after-view-to-install"), mix = stat(res, "mix-share");
    if (![before, after, mix].every(Number.isFinite)) return null;
    return card({
      ko: { headline: `조회→설치 전환율이 ${pct(before)}에서 ${pct(after)}로 떨어졌고, 그 하락의 ${pct(mix, 0)}는 페이지가 아니라 유입 구성 변화 때문입니다.`, caption: "예시 데이터로 계산했습니다. 유입 구성과 소스별 전환율로 하락을 나눴습니다." },
      en: { headline: `View-to-install conversion fell from ${pct(before)} to ${pct(after)}, and ${pct(mix, 0)} of the drop came from traffic mix, not the page.`, caption: "Calculated on example data. The drop is split into traffic mix and per-source conversion." },
      bars: [
        { label: { ko: "유입 구성 변화", en: "Traffic mix" }, value: mix, display: pct(mix, 0), highlight: true },
        { label: { ko: "페이지 전환율 변화", en: "Page conversion" }, value: 1 - mix, display: pct(1 - mix, 0), highlight: false },
      ],
    });
  },
  "9-6": (csv) => {
    const res = runAdapter("9-6", csv);
    if (res.status !== "success") return null;
    const rows = res.visualizations[0].data;
    const fatigued = rows.filter((r) => /피로 감지|현재 알림/.test(r.status)).reduce((s, r) => s + r.count, 0);
    const judged = rows.filter((r) => !/기간 부족/.test(r.status)).reduce((s, r) => s + r.count, 0);
    const EN = { "현재 알림": "Alert now", "피로 감지·알림 없음": "Fatigue signal", "판정 가능·비피로": "No fatigue", "기간 부족": "Too few days" };
    return card({
      ko: { headline: `판정할 수 있는 소재 ${num(judged)}개 중 ${num(fatigued)}개에서 클릭률이 떨어지는 피로 신호가 보입니다.`, caption: "예시 데이터로 계산했습니다. 운영 기간이 짧은 소재는 판정에서 뺐습니다." },
      en: { headline: `${num(fatigued)} of the ${num(judged)} creatives that can be judged show a falling-CTR fatigue signal.`, caption: "Calculated on example data. Creatives with too few days are excluded." },
      bars: rows.filter((r) => !/기간 부족/.test(r.status)).map((r) => ({ label: { ko: r.status, en: EN[r.status] || r.status }, value: r.count, display: num(r.count), highlight: /피로 감지/.test(r.status) })),
    });
  },
  "5-18-trend": (csv) => {
    const res = runAdapter("5-18-trend", csv);
    if (res.status !== "success") return null;
    const change = stat(res, "trend-change-pct"), p = stat(res, "deseasonalized-mk-p"), weeks = stat(res, "observed-periods");
    const series = res.visualizations[0].data.map((d) => d.trend);
    const clear = Number.isFinite(p) && p < 0.05;
    return card({
      ko: { headline: clear ? `${num(weeks)}주 동안 광고와 무관한 자연 추세가 ${signed(`${r1(change)}%`)} 움직였습니다.` : `${num(weeks)}주 동안 추세는 ${signed(`${r1(change)}%`)} 움직였지만, 계절을 빼면 뚜렷한 자연 추세라고 볼 수 없습니다.`, caption: "예시 데이터로 계산했습니다. 계절성을 뺀 추세의 방향 검정 결과입니다." },
      en: { headline: clear ? `Over ${num(weeks)} weeks the natural trend moved ${signed(`${r1(change)}%`)} independent of ads.` : `Over ${num(weeks)} weeks the trend moved ${signed(`${r1(change)}%`)}, but after removing seasonality it is not a clear natural trend.`, caption: "Calculated on example data. A direction test on the deseasonalized trend." },
      spark: series,
    });
  },
  "5-18-paid-organic": (csv) => {
    const res = runAdapter("5-18-paid-organic", csv);
    if (res.status !== "success") return null;
    const org = stat(res, "recent-organic-change"), paid = stat(res, "recent-paid-change"), opp = stat(res, "opposite-direction-weeks");
    return card({
      ko: { headline: `최근 4주 오가닉은 ${signed(`${r1(org)}%`)}, 유료는 ${signed(`${r1(paid)}%`)} 움직였고, 둘이 반대로 움직인 주는 ${num(opp)}주입니다. 잠식이라고 볼 신호는 아직 없습니다.`, caption: "예시 데이터로 계산했습니다. 주별 변화 방향만 비교합니다." },
      en: { headline: `In the last 4 weeks organic moved ${signed(`${r1(org)}%`)} and paid ${signed(`${r1(paid)}%`)}, with ${num(opp)} weeks moving in opposite directions. No sign of cannibalization yet.`, caption: "Calculated on example data. Compares weekly direction only." },
      bars: [
        { label: { ko: "오가닉", en: "Organic" }, value: org / 100, display: signed(`${r1(org)}%`), highlight: true },
        { label: { ko: "유료", en: "Paid" }, value: paid / 100, display: signed(`${r1(paid)}%`), highlight: false },
      ],
    });
  },
  "5-4": () => {
    const demo = buildDemoCsv(TOOL_GROUP["5-4"], "ko");
    const arms = new Map();
    for (const row of demo.raw) {
      const key = row.arm_id;
      const a = arms.get(key) || { name: key, n: 0, x: 0, isControl: Number(row.is_control) === 1 };
      a.n += Number(row.denominator); a.x += Number(row.numerator); arms.set(key, a);
    }
    const out = STATS.massReadout([...arms.values()]);
    const rows = out.rows;
    const control = rows.find((r) => r.isControl);
    const best = rows.filter((r) => !r.isControl).sort((a, b) => b.rate - a.rate)[0];
    const sigKo = best.sig ? `차이는 우연으로 보기 어렵습니다(p ${best.pValue < 0.001 ? "< 0.001" : `= ${num(best.pValue, 3)}`}).` : "아직 우연과 구분되지 않습니다.";
    const sigEn = best.sig ? `The difference is unlikely to be chance (p ${best.pValue < 0.001 ? "< 0.001" : `= ${num(best.pValue, 3)}`}).` : "It is not yet distinguishable from chance.";
    return card({
      ko: { headline: `${best.name}의 전환율이 ${pct(best.rate, 2)}로 대조군(${pct(control.rate, 2)})보다 ${pct(best.liftRel)} 높습니다. ${sigKo}`, caption: "예시 데이터로 계산했습니다. 여러 안을 함께 비교해 p값을 보정했습니다." },
      en: { headline: `${best.name} converts at ${pct(best.rate, 2)}, ${pct(best.liftRel)} above control (${pct(control.rate, 2)}). ${sigEn}`, caption: "Calculated on example data. P-values are adjusted for comparing several variants." },
      bars: rows.map((r) => ({ label: { ko: r.isControl ? `${r.name} (대조군)` : r.name, en: r.isControl ? `${r.name} (control)` : r.name }, value: r.rate, display: pct(r.rate, 2), highlight: r === best })),
    });
  },
  "5-23": () => {
    const demo = buildDemoCsv(TOOL_GROUP["5-23"], "ko");
    const g = { exposed: { name: "exposed", n: 0, x: 0, isControl: false }, holdout: { name: "holdout", n: 0, x: 0, isControl: true } };
    for (const row of demo.raw) { const a = g[row.holdout_group]; if (!a) continue; a.n += Number(row.denominator); a.x += Number(row.numerator); }
    const rows = STATS.massReadout([g.holdout, g.exposed]).rows;
    const hold = rows.find((r) => r.isControl), exp = rows.find((r) => !r.isControl);
    const sigKo = exp.sig ? "우연으로 보기 어려운 차이입니다." : "아직 우연과 구분되지 않는 차이입니다.";
    const sigEn = exp.sig ? "The difference is unlikely to be chance." : "The difference is not yet distinguishable from chance.";
    return card({
      ko: { headline: `광고를 본 그룹의 전환율은 ${pct(exp.rate, 2)}, 광고를 막은 그룹은 ${pct(hold.rate, 2)}입니다. 광고가 만든 순증분은 ${signed(pct(exp.liftRel))}이고, ${sigKo}`, caption: "예시 데이터로 계산했습니다. 무작위로 나눈 홀드아웃과 비교했습니다." },
      en: { headline: `The exposed group converts at ${pct(exp.rate, 2)} and the holdout at ${pct(hold.rate, 2)}. The incremental lift is ${signed(pct(exp.liftRel))}. ${sigEn}`, caption: "Calculated on example data. Compared with a randomized holdout." },
      bars: [
        { label: { ko: "광고 노출", en: "Exposed" }, value: exp.rate, display: pct(exp.rate, 2), highlight: true },
        { label: { ko: "홀드아웃", en: "Holdout" }, value: hold.rate, display: pct(hold.rate, 2), highlight: false },
      ],
    });
  },
  "5-24": () => {
    const demo = buildDemoCsv(TOOL_GROUP["5-24"], "ko");
    const res = runBrandInterruptedTimeSeries({ rows: demo.raw.map((r) => ({ date: r.date, outcome: r.brand_search, campaignOn: r.campaign_on })) });
    if (!res.ok) return null;
    const rate = res.incrementalRate;
    const [lo, hi] = res.ci95;
    const certain = lo > 0 || hi < 0;
    return card({
      ko: { headline: `캠페인 기간 브랜드 검색은 ${num(res.actualTotal)}건으로, 캠페인이 없었다면 예상되는 ${num(res.counterfactualTotal)}건보다 ${num(res.incrementalTotal)}건(${signed(pct(rate))}) 많았습니다.${certain ? "" : " 다만 불확실성 범위가 0을 포함합니다."}`, caption: `예시 데이터로 계산했습니다. 캠페인 전 ${res.prePeriods}일 추세로 예상치를 만들었습니다.` },
      en: { headline: `Brand searches during the campaign were ${num(res.actualTotal)}, ${num(res.incrementalTotal)} (${signed(pct(rate))}) above the ${num(res.counterfactualTotal)} expected without it.${certain ? "" : " The uncertainty range still includes zero."}`, caption: `Calculated on example data. The expectation comes from the ${res.prePeriods}-day pre-campaign trend.` },
      bars: [
        { label: { ko: "실제", en: "Actual" }, value: res.actualTotal, display: num(res.actualTotal), highlight: true },
        { label: { ko: "캠페인 없었을 때 예상", en: "Expected without campaign" }, value: res.counterfactualTotal, display: num(res.counterfactualTotal), highlight: false },
      ],
    });
  },
  "5-20": () => {
    const demo = buildDemoCsv(TOOL_GROUP["5-20"], "ko");
    const targets = demo.raw.map((r) => Number(r.converted));
    const base = targets.reduce((s, v) => s + v, 0) / targets.length;
    const idx = targets.map((_, i) => i);
    const minSupport = Math.ceil(targets.length * 0.05);
    const LABEL = { matches_first_7d: ["첫 7일 매칭", "Matches in first 7 days"], messages_sent_7d: ["첫 7일 메시지", "Messages in first 7 days"], profile_completed: ["프로필 완성 항목", "Profile fields completed"], boost_used: ["부스트 사용", "Boosts used"] };
    const found = Object.keys(LABEL).map((col) => ({ col, t: AHA_STATS.bestThreshold(demo.raw.map((r) => Number(r[col])), targets, idx, minSupport) })).filter((x) => x.t);
    found.sort((a, b) => b.t.F1 - a.t.F1);
    const best = found[0];
    return card({
      ko: { headline: `${LABEL[best.col][0]} ${best.t.k}회 이상인 사용자의 전환율은 ${pct(best.t.P)}로, 전체 평균(${pct(base)})의 ${num(best.t.P / base, 1)}배입니다.`, caption: `예시 데이터로 계산했습니다. 행동 ${found.length}개와 여러 기준을 훑어 가장 강한 조합을 골랐으니, 새 기간에서 다시 확인하세요.` },
      en: { headline: `Users with ${best.t.k}+ ${LABEL[best.col][1].toLowerCase()} convert at ${pct(best.t.P)}, ${num(best.t.P / base, 1)}× the average (${pct(base)}).`, caption: `Calculated on example data. The strongest of ${found.length} actions and many thresholds was picked, so confirm it on a new period.` },
      bars: found.map((x) => ({ label: { ko: `${LABEL[x.col][0]} ${x.t.k}회+`, en: `${LABEL[x.col][1]} ${x.t.k}+` }, value: x.t.P, display: pct(x.t.P), highlight: x === best })),
    });
  },
  "9-1": () => {
    const demo = buildDemoCsv(TOOL_GROUP["9-1"], "ko");
    const LABEL = { title_has_number: ["제목에 숫자", "Number in title"], has_emoji: ["이모지", "Emoji"], thumbnail_bright: ["밝은 썸네일", "Bright thumbnail"], listicle: ["목록형 글", "Listicle"] };
    const diffs = Object.keys(LABEL).map((col) => {
      const on = demo.raw.filter((r) => Number(r[col]) === 1).map((r) => Number(r.ctr));
      const off = demo.raw.filter((r) => Number(r[col]) === 0).map((r) => Number(r.ctr));
      const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
      return { col, d: mean(on) - mean(off) };
    }).sort((a, b) => b.d - a.d);
    const top = diffs[0];
    return card({
      ko: { headline: `‘${LABEL[top.col][0]}’ 요소가 있는 콘텐츠의 평균 클릭률이 ${num(top.d, 2)}%p 높습니다. 요소가 겹치는 영향을 빼면 달라질 수 있습니다.`, caption: `예시 데이터로 계산했습니다. 콘텐츠 ${demo.raw.length}개의 단순 평균 차이이며, 도구는 회귀로 요소를 서로 떼어 봅니다.` },
      en: { headline: `Content with a ${LABEL[top.col][1].toLowerCase()} has ${num(top.d, 2)} pp higher average CTR. This can change once overlapping elements are separated.`, caption: `Calculated on example data. A simple mean difference across ${demo.raw.length} pieces; the tool separates elements with regression.` },
      bars: diffs.map((x, i) => ({ label: { ko: LABEL[x.col][0], en: LABEL[x.col][1] }, value: x.d, display: { ko: signed(`${num(x.d, 2)}%p`), en: signed(`${num(x.d, 2)} pp`) }, highlight: i === 0 })),
    });
  },
};

// 글이 자기 예제 파일을 지정했으면 그 파일로, 아니면 도구 데모로 계산한다.
function exampleFor(slug) {
  const placement = BLOG_INSIGHT_PLACEMENTS[slug];
  if (!placement) return null;
  const practice = BLOG_PRACTICES[slug];
  const toolId = EXAMPLE_TOOL_SUBSTITUTE[placement.toolId] || placement.toolId;
  const build = BUILDERS[toolId];
  if (!build) throw new Error(`No example builder for ${toolId} (${slug})`);
  if (practice?.file && ["5-2", "5-22", "5-27", "5-26"].includes(toolId)) {
    const custom = build(csvFromExample(practice.file, toolId, practice.currency));
    if (custom) return { toolId, source: practice.file, ...custom };
    return { toolId, source: practice.file, withheld: true, ...card({
      ko: { headline: "이 예제로는 판단을 보류합니다. 같은 채널을 여러 날짜·여러 지출 수준에서 관측해야 추정할 수 있습니다.", caption: "예시 데이터로 계산했습니다. 행이 많아도 채널마다 관측이 한 번뿐이면 판단할 수 없습니다." },
      en: { headline: "This example withholds a judgment. The same channel must be observed across dates and spend levels.", caption: "Calculated on example data. Many rows do not help when each channel is observed only once." },
    }) };
  }
  const result = build(toolId.startsWith("5-4") || ["5-23", "5-24", "5-20", "9-1"].includes(toolId) ? null : csvFromDemo(toolId));
  if (!result) throw new Error(`Example not computable for ${toolId} (${slug})`);
  return { toolId, source: "demo", ...result };
}

export function computeBlogExamples() {
  const out = {};
  for (const slug of Object.keys(BLOG_INSIGHT_PLACEMENTS).sort()) out[slug] = exampleFor(slug);
  return out;
}
