// 신규 소재 수명주기와 예외 처리 (spec §6.6).
// 피로도만 보면 신규 소재가 세 군데서 틀리게 읽힌다(PVM 진입 비용·노출 증가를 피로로·학습 중 곡선 이탈).
// 여기서 소재마다 상태를 정하고, 다른 단계는 그 상태를 읽어 예외를 적용한다.
import { CREATIVE_CONFIG } from "@/utils/creativeConfig";
import { CREATIVE_FATIGUE, CREATIVE_STATS } from "@/utils/creativeMath";
import { addDays, dayDiff, median } from "./plannerStats";
import { ancestorKey, nodeKey } from "./plannerData";

export const CREATIVE_STATES = Object.freeze([
  "LEARNING", "RAMPING", "STALLED", "WINNER", "PAR", "LOSER", "NO_BASELINE", "ENDED_UNJUDGED", "UNKNOWN_AGE",
]);
const JUDGED = new Set(["WINNER", "PAR", "LOSER", "NO_BASELINE"]);
const FATIGUE_ELIGIBLE = new Set([...JUDGED, "UNKNOWN_AGE"]);

export function identityKeyOf(row, scope) {
  return scope === "global"
    ? JSON.stringify([row.creative_id])
    : JSON.stringify([row.country, row.platform, row.channel, row.campaign_name, row.creative_id]);
}

function emptyDay() {
  return { cost: 0, result: 0, impressions: 0, clicks: 0, hasFunnel: true };
}

function addRow(day, row) {
  day.cost += row.cost;
  day.result += row.result;
  if (row.impressions == null || row.clicks == null) day.hasFunnel = false;
  else {
    day.impressions += row.impressions;
    day.clicks += row.clicks;
  }
}

function totalOver(days, from, to, onlyDates) {
  const out = { ...emptyDay(), dates: 0 };
  for (const [date, day] of days) {
    if (date < from || date > to || (onlyDates && !onlyDates.has(date))) continue;
    addRow(out, { ...day, impressions: day.hasFunnel ? day.impressions : null, clicks: day.hasFunnel ? day.clicks : null });
    out.dates += 1;
  }
  return out;
}

/** 소재 출시일: 첫 지출일, 단 relaunchGapDays 이상 쉬었다 다시 쓰면 마지막 재출시일. */
function launchOf(spendDates, gapDays) {
  let launch = spendDates[0];
  let relaunched = false;
  for (let i = 1; i < spendDates.length; i += 1) {
    if (dayDiff(spendDates[i - 1], spendDates[i]) >= gapDays) {
      launch = spendDates[i];
      relaunched = true;
    }
  }
  return { launch, relaunched };
}

/**
 * 하나의 소재가 날짜별로 "학습 중"이었는지: 나이 < learningDays 또는 누적 결과 < minResultsToJudge.
 * 현재 상태와 별개로 과거 날짜마다 판정해야 곡선·요일 학습에서 그날을 뺄 수 있다.
 */
function learningDatesOf(entry, cfg) {
  const { learningDays } = cfg.creative;
  const { minResultsToJudge } = cfg.creative.launch;
  const out = new Set();
  if (entry.unknownAge) return out;
  let cumulative = 0;
  for (const [date, day] of entry.days) {
    if (date < entry.launch) continue;
    cumulative += day.result;
    if (dayDiff(entry.launch, date) < learningDays || cumulative < minResultsToJudge) out.add(date);
    else break;
  }
  return out;
}

function incumbentsOf(entry, siblings) {
  return siblings.filter((other) => other !== entry && (other.unknownAge || other.launch < entry.launch));
}

function sumEntries(entries, from, to, onlyDates) {
  const total = { ...emptyDay(), dates: 0 };
  for (const entry of entries) {
    const part = totalOver(entry.days, from, to, onlyDates);
    total.cost += part.cost;
    total.result += part.result;
    total.impressions += part.impressions;
    total.clicks += part.clicks;
    if (!part.hasFunnel) total.hasFunnel = false;
  }
  return total;
}

/** 과거 출시의 나이 구간별 표본(같은 날 기존 소재 대비 CPR 비율, 노드 지출 비중). */
function launchSamples(entry, siblings, nodeDays, cfg) {
  const incumbents = incumbentsOf(entry, siblings);
  return cfg.creative.launch.profileBuckets.map(([from, to]) => {
    const start = addDays(entry.launch, from);
    const end = addDays(entry.launch, to);
    if (end > entry.evalDate) return null;
    const own = totalOver(entry.days, start, end);
    if (!(own.cost > 0)) return null;
    const spentDates = new Set([...entry.days].filter(([date, day]) => date >= start && date <= end && day.cost > 0).map(([date]) => date));
    const inc = sumEntries(incumbents, start, end, spentDates);
    const node = totalOver(nodeDays, start, end);
    return {
      ratio: own.result > 0 && inc.result > 0 && inc.cost > 0 ? (own.cost / own.result) / (inc.cost / inc.result) : null,
      share: node.cost > 0 ? own.cost / node.cost : null,
    };
  });
}

function pickProfileValue(pools, minLaunches, pick) {
  for (const pool of pools) {
    const values = pool.map(pick).filter(Number.isFinite);
    if (values.length >= minLaunches) return median(values);
  }
  return null;
}

/**
 * 출시 프로파일: 노드 → 채널 → 전체 순으로, 출시 표본이 minHistoricalLaunches 이상인 첫 묶음의 중앙값.
 * 자기 자신은 빼고(leave-one-out) 계산해 자기 성과가 자기 사전값으로 새어 들지 않게 한다.
 */
export function launchProfileFor(entry, profileEntries, cfg) {
  const { minHistoricalLaunches } = cfg.creative;
  const { profileBuckets, defaultLaunchProfile, defaultLaunchPenalty } = cfg.creative.launch;
  const others = profileEntries.filter((other) => other.id !== entry?.id);
  const pools = [
    others.filter((other) => other.nodeKey === entry?.nodeKey),
    others.filter((other) => other.channelKey === entry?.channelKey),
    others,
  ];
  let assumed = false;
  const buckets = profileBuckets.map((bucket, index) => {
    const ratio = pickProfileValue(pools, minHistoricalLaunches, (other) => other.samples[index]?.ratio);
    const share = pickProfileValue(pools, minHistoricalLaunches, (other) => other.samples[index]?.share);
    if (ratio == null || share == null) assumed = true;
    return {
      ages: bucket,
      cprRatio: ratio ?? defaultLaunchProfile.cprRatio[index],
      spendShare: share ?? defaultLaunchProfile.spendShare[index],
    };
  });
  const pooledRatio = pickProfileValue(
    pools.map((pool) => pool.flatMap((other) => {
      const values = other.samples.map((sample) => sample?.ratio).filter(Number.isFinite);
      return values.length ? [median(values)] : [];
    })),
    minHistoricalLaunches,
    (value) => value,
  );
  return {
    buckets,
    judgeRatio: pooledRatio ?? defaultLaunchPenalty,
    assumed: assumed || pooledRatio == null,
    launches: pools[2].length,
  };
}

function judge(entry, incumbents, cfg, profile) {
  const { priorStrengthResults, winMargin, loseMargin } = cfg.creative.launch;
  const { promoteProb, killProb } = CREATIVE_CONFIG.bayes;
  const spentDates = new Set([...entry.days].filter(([date, day]) => date >= entry.launch && date <= entry.evalDate && day.cost > 0).map(([date]) => date));
  const inc = sumEntries(incumbents, entry.launch, entry.evalDate, spentDates);
  if (!(inc.result > 0) || !(inc.cost > 0)) return { state: "NO_BASELINE", judgment: { reason: "no_incumbent_on_same_days" } };
  const own = entry.sinceLaunch;
  const cprIncumbent = inc.cost / inc.result;
  const cprPrior = cprIncumbent * profile.judgeRatio;
  // 결과 ~ 포아송(지출 × 결과율), 결과율 ~ 감마(k, k·CPR_prior). 사후 평균의 역수가 CPR_post.
  const cprPost = (priorStrengthResults * cprPrior + own.cost) / (priorStrengthResults + own.result);
  const judgment = { cprIncumbent, cprPrior, cprPost, priorAssumed: profile.assumed, pCtrBetter: null, pCvrBetter: null };
  const funnelOk = own.hasFunnel && inc.hasFunnel && own.impressions > 0 && inc.impressions > 0;
  if (funnelOk && own.clicks <= own.impressions && inc.clicks <= inc.impressions) {
    judgment.pCtrBetter = CREATIVE_STATS.betaProbGreater(own.clicks, own.impressions, inc.clicks, inc.impressions);
    if (own.clicks > 0 && inc.clicks > 0 && own.result <= own.clicks && inc.result <= inc.clicks) {
      judgment.pCvrBetter = CREATIVE_STATS.betaProbGreater(own.result, own.clicks, inc.result, inc.clicks);
    }
  }
  judgment.ctrSignal = judgment.pCtrBetter == null ? null : judgment.pCtrBetter >= promoteProb ? "better" : judgment.pCtrBetter <= killProb ? "worse" : "unclear";
  const state = cprPost <= cprIncumbent * (1 - winMargin) ? "WINNER" : cprPost >= cprIncumbent * (1 + loseMargin) ? "LOSER" : "PAR";
  return { state, judgment };
}

function rampEndOf(entry, threshold, learningDays) {
  if (entry.unknownAge) return null;
  const start = addDays(entry.launch, learningDays);
  for (let date = start; date <= entry.evalDate; date = addDays(date, 1)) {
    const last = totalOver(entry.days, addDays(date, -6), date).cost;
    const prev = totalOver(entry.days, addDays(date, -13), addDays(date, -7)).cost;
    if (prev > 0 && last / prev - 1 <= threshold) return date;
  }
  return null;
}

/**
 * 피로 판정. 램프가 끝난 뒤 구간만 보고(첫날 고점 기준 금지), 같은 노드에 큰 소재가 들어오거나
 * 빠진 직후라면 노출·CPM 신호를 빼고 CTR로만 본다 — 플랫폼이 노출을 다시 나눈 것이지 닳은 것이 아니다.
 */
function assessFatigue(entry, cfg, cannibalWindows) {
  if (!FATIGUE_ELIGIBLE.has(entry.state) || entry.ended) return null;
  if (!entry.unknownAge && entry.age < cfg.creative.fatigue.minAgeDays) return null;
  const base = CREATIVE_CONFIG.fatigueAlert;
  const start = entry.unknownAge ? "" : rampEndOf(entry, cfg.creative.launch.rampStableGrowth, cfg.creative.learningDays);
  if (start == null) return null;
  const series = [...entry.days].filter(([date, day]) => date >= start && day.hasFunnel && day.impressions > 0)
    .map(([date, day]) => ({ date, impressions: day.impressions, clicks: day.clicks, cost: day.cost }));
  if (series.length < base.minDays) return null;
  const windowStart = series.slice(-base.trendWindow)[0].date;
  const ctrOnly = cannibalWindows.some((window) => window.creativeId !== entry.id && window.to >= windowStart && window.from <= entry.evalDate);
  const fatigueCfg = ctrOnly ? { ...base, impressionWeight: 0, cpmWeight: 0 } : base;
  const index = CREATIVE_FATIGUE.compositeIndex(CREATIVE_FATIGUE.buildDailySeries(series), fatigueCfg);
  if (!index) return null;
  return { score: index.score, fatigued: index.score >= base.alertScore, ctrOnly, ctrTrendPctPerDay: index.ctrTrendPctPerDay };
}

/**
 * @param {object[]} rows 정리된 플래너 행
 * @param {object} cfg 전역 config
 * @param {{levels:string[], allocateLevel:string, asOf:string, dataStart:string, nodes:Map, configForPath:(path)=>object}} ctx
 */
export function buildCreativeLifecycle(rows, cfg, { levels, allocateLevel, asOf, dataStart, nodes, configForPath }) {
  const creativeRows = rows.filter((row) => row.creative_id);
  const byNode = new Map();
  if (!creativeRows.length) return { hasCreatives: false, entries: [], byNode };

  const scope = cfg.creative.identityScope;
  const identitySpend = new Map();
  const entries = new Map();
  for (const row of creativeRows) {
    const identity = identityKeyOf(row, scope);
    if (row.cost > 0) {
      if (!identitySpend.has(identity)) identitySpend.set(identity, new Set());
      identitySpend.get(identity).add(row.date);
    }
    const node = nodeKey(row, allocateLevel, levels);
    const id = JSON.stringify([node, identity]);
    if (!entries.has(id)) {
      entries.set(id, {
        id,
        identity,
        nodeKey: node,
        channelKey: ancestorKey(row, "channel", levels),
        creativeId: row.creative_id,
        path: Object.fromEntries(levels.slice(0, levels.indexOf(allocateLevel) + 1).map((name) => [name, row[name] || ""])),
        days: new Map(),
      });
    }
    const days = entries.get(id).days;
    if (!days.has(row.date)) days.set(row.date, emptyDay());
    addRow(days.get(row.date), row);
  }

  const list = [];
  for (const entry of entries.values()) {
    entry.days = new Map([...entry.days].sort(([a], [b]) => a.localeCompare(b)));
    const nodeCfg = configForPath(entry.path);
    entry.cfg = nodeCfg;
    const spendDates = [...(identitySpend.get(entry.identity) || [])].sort();
    if (!spendDates.length) continue;
    const { launch, relaunched } = launchOf(spendDates, nodeCfg.creative.relaunchGapDays);
    entry.launch = launch;
    entry.relaunched = relaunched;
    // 데이터 첫날부터 쓰던 소재는 언제 시작했는지 모른다 — 신규로 보지 않는다.
    entry.unknownAge = !relaunched && launch <= dataStart;
    entry.lastSpend = spendDates.at(-1);
    entry.ended = dayDiff(entry.lastSpend, asOf) >= nodeCfg.events.removedAfterDays;
    entry.evalDate = entry.ended ? entry.lastSpend : asOf;
    entry.age = entry.unknownAge ? null : dayDiff(launch, entry.evalDate);
    const from = entry.unknownAge ? dataStart : launch;
    entry.sinceLaunch = totalOver(entry.days, from, entry.evalDate);
    const nodeDays = nodes.get(entry.nodeKey)?.days ?? new Map();
    const nodeTotal = totalOver(nodeDays, from, entry.evalDate);
    entry.share = nodeTotal.cost > 0 ? entry.sinceLaunch.cost / nodeTotal.cost : 0;
    const last7 = totalOver(entry.days, addDays(entry.evalDate, -6), entry.evalDate).cost;
    const prev7 = totalOver(entry.days, addDays(entry.evalDate, -13), addDays(entry.evalDate, -7)).cost;
    entry.growth7 = prev7 > 0 ? last7 / prev7 - 1 : last7 > 0 ? Infinity : 0;
    list.push(entry);
  }

  const siblingsByNode = new Map();
  for (const entry of list) {
    if (!siblingsByNode.has(entry.nodeKey)) siblingsByNode.set(entry.nodeKey, []);
    siblingsByNode.get(entry.nodeKey).push(entry);
  }

  // 1차 상태(판정 전) — 출시 프로파일 표본을 고르려면 학습 중인지가 먼저 필요하다.
  for (const entry of list) {
    const { learningDays } = entry.cfg.creative;
    const { stallDays, stallShare, minResultsToJudge, rampStableGrowth } = entry.cfg.creative.launch;
    let state;
    if (entry.unknownAge) state = "UNKNOWN_AGE";
    else if (entry.age >= stallDays && entry.share < stallShare) state = "STALLED";
    else if (entry.age < learningDays || entry.sinceLaunch.result < minResultsToJudge) state = "LEARNING";
    else if (entry.growth7 > rampStableGrowth) state = "RAMPING";
    else state = "JUDGE";
    if (entry.ended && ["LEARNING", "RAMPING", "STALLED"].includes(state)) state = "ENDED_UNJUDGED";
    entry.state = state;
  }

  const profileEntries = list
    .filter((entry) => !entry.unknownAge && entry.state !== "ENDED_UNJUDGED")
    .map((entry) => ({
      id: entry.id,
      nodeKey: entry.nodeKey,
      channelKey: entry.channelKey,
      samples: launchSamples(entry, siblingsByNode.get(entry.nodeKey), nodes.get(entry.nodeKey)?.days ?? new Map(), entry.cfg),
    }));

  for (const entry of list) {
    entry.profile = launchProfileFor(entry, profileEntries, entry.cfg);
    if (entry.state === "JUDGE") {
      const result = judge(entry, incumbentsOf(entry, siblingsByNode.get(entry.nodeKey)), entry.cfg, entry.profile);
      entry.state = result.state;
      entry.judgment = result.judgment;
    }
  }

  for (const [key, siblings] of siblingsByNode) {
    const nodeCfg = siblings[0].cfg;
    const nodeDays = nodes.get(key)?.days ?? new Map();
    const learningCost = new Map();
    for (const entry of siblings) {
      for (const date of learningDatesOf(entry, nodeCfg)) {
        learningCost.set(date, (learningCost.get(date) || 0) + (entry.days.get(date)?.cost || 0));
      }
    }
    const shareOn = (date) => {
      const total = nodeDays.get(date)?.cost || 0;
      return total > 0 ? (learningCost.get(date) || 0) / total : 0;
    };
    const learningDates = new Set([...learningCost.keys()].filter((date) => shareOn(date) >= nodeCfg.creative.launch.learningShareExclude));
    const freezeDates = new Set([...learningCost.keys()].filter((date) => shareOn(date) >= nodeCfg.creative.launch.learningShareFreeze));
    // 같은 노드에 큰 소재가 들어오거나 빠지면 플랫폼이 노출을 다시 나눈다. 특히 큰 소재를 끈 직후
    // 남은 소재의 노출이 급증하는데, 피로 지수는 노출 증가를 위험으로 세므로 이 기간은 CTR로만 본다.
    const windowDays = nodeCfg.creative.fatigue.cannibalWindowDays;
    const significant = siblings.filter((entry) => entry.share >= nodeCfg.events.minCreativeShare);
    const cannibalWindows = [
      ...significant.filter((entry) => !entry.unknownAge).map((entry) => ({ creativeId: entry.id, kind: "launch", from: entry.launch, to: addDays(entry.launch, windowDays - 1) })),
      ...significant.filter((entry) => entry.ended).map((entry) => ({ creativeId: entry.id, kind: "removal", from: addDays(entry.lastSpend, 1), to: addDays(entry.lastSpend, windowDays) })),
    ];
    for (const entry of siblings) entry.fatigue = assessFatigue(entry, nodeCfg, cannibalWindows);
    const learningNow = siblings.filter((entry) => entry.state === "LEARNING");
    byNode.set(key, {
      entries: siblings,
      learningDates,
      freezeDates,
      cannibalWindows,
      learningShareNow: learningNow.reduce((acc, entry) => acc + entry.share, 0),
      loserShare: siblings.filter((entry) => entry.state === "LOSER" && !entry.ended).reduce((acc, entry) => acc + entry.share, 0),
      fatiguedShare: siblings.filter((entry) => entry.fatigue?.fatigued).reduce((acc, entry) => acc + entry.share, 0),
      stallRate: (() => {
        const launched = siblings.filter((entry) => !entry.unknownAge);
        return launched.length ? launched.filter((entry) => entry.state === "STALLED").length / launched.length : 0;
      })(),
    });
  }

  for (const entry of list) delete entry.cfg;
  return { hasCreatives: true, entries: list, byNode };
}
