import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ADDITIVE_FIELDS,
  buildSnapshot,
  deriveMetrics,
  snapshotMetrics,
  sumRows,
} from "./snapshot";

const PERIOD = { start: "2026-08-31", end: "2026-09-06", days: 7 };

function row(date, campaign, extra = {}) {
  return { date, campaign, cost: 100, clicks: 200, impressions: 10000, actions: 10, ...extra };
}

describe("기간으로 자르고 채널×캠페인으로 묶는다", () => {
  it("기간 밖 행은 들어오지 않는다", () => {
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [
        row("2026-08-30", "A"), // 지난 기간
        row("2026-08-31", "A"),
        row("2026-09-06", "A"),
        row("2026-09-07", "A"), // 다음 주
      ],
    });
    expect(snapshot.ok).toBe(true);
    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.rows[0].cost).toBe(200);
  });

  it("같은 캠페인의 여러 날을 합친다", () => {
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [
        row("2026-08-31", "A", { cost: 10, actions: 1 }),
        row("2026-09-01", "A", { cost: 20, actions: 2 }),
        row("2026-09-02", "B", { cost: 30, actions: 3 }),
      ],
    });
    expect(snapshot.rows.map((r) => [r.campaign, r.cost, r.actions])).toEqual([
      ["A", 30, 3],
      ["B", 30, 3],
    ]);
  });

  it("채널이 있으면 채널×캠페인으로 나뉜다", () => {
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [
        row("2026-08-31", "Brand", { channel: "Google", cost: 10 }),
        row("2026-08-31", "Brand", { channel: "Meta", cost: 20 }),
      ],
    });
    expect(snapshot.hasChannel).toBe(true);
    expect(snapshot.rows).toHaveLength(2);
    expect(snapshot.rows.map((r) => r.channel)).toEqual(["Google", "Meta"]);
  });

  it("채널이 없으면 캠페인만으로 묶고 channel은 null이다", () => {
    const snapshot = buildSnapshot({ period: PERIOD, rows: [row("2026-08-31", "A")] });
    expect(snapshot.hasChannel).toBe(false);
    expect(snapshot.rows[0].channel).toBeNull();
  });

  it("캠페인명에 구분자로 쓸 법한 문자가 들어와도 그룹이 합쳐지지 않는다", () => {
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [
        row("2026-08-31", "b", { channel: "a", cost: 10 }),
        row("2026-08-31", "a b", { channel: "", cost: 20 }),
        row("2026-08-31", 'A"|B', { cost: 40 }),
      ],
    });
    expect(snapshot.rows).toHaveLength(3);
  });

  it("이름 앞뒤 공백은 같은 캠페인으로 본다", () => {
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [row("2026-08-31", " A ", { cost: 10 }), row("2026-09-01", "A", { cost: 20 })],
    });
    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.rows[0].cost).toBe(30);
  });
});

describe("없는 것과 0을 구분한다", () => {
  it("매핑되지 않은 필드는 null이지 0이 아니다", () => {
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [{ date: "2026-08-31", campaign: "A", cost: 100, actions: 10 }],
    });
    expect(snapshot.rows[0].revenue).toBeNull();
    expect(snapshot.rows[0].impressions).toBeNull();
    expect(snapshot.availableFields).toEqual(["cost", "actions"]);
  });

  it("매출이 실제로 0이면 0으로 남는다", () => {
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [{ date: "2026-08-31", campaign: "A", cost: 100, revenue: 0 }],
    });
    expect(snapshot.rows[0].revenue).toBe(0);
    expect(snapshot.availableFields).toContain("revenue");
  });

  it("빈 문자열·null·true는 0으로 읽지 않는다", () => {
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [{ date: "2026-08-31", campaign: "A", cost: "", revenue: null, clicks: true, actions: "  " }],
    });
    for (const field of ADDITIVE_FIELDS) expect(snapshot.rows[0][field]).toBeNull();
    expect(snapshot.availableFields).toEqual([]);
  });

  it("천단위 콤마가 붙은 값을 온전히 읽는다", () => {
    // parseFloat("2,488")은 2다. 실제 CSV가 이 모양으로 온다.
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [{ date: "2026-08-31", campaign: "A", cost: "2,488", actions: "1,204" }],
    });
    expect(snapshot.rows[0].cost).toBe(2488);
    expect(snapshot.rows[0].actions).toBe(1204);
  });
});

describe("비율은 저장하지 않고 합에서 만든다", () => {
  it("스냅샷 행에 비율 필드가 없다", () => {
    const snapshot = buildSnapshot({ period: PERIOD, rows: [row("2026-08-31", "A")] });
    expect(Object.keys(snapshot.rows[0]).sort()).toEqual(
      ["campaign", "channel", ...ADDITIVE_FIELDS].sort(),
    );
    for (const banned of ["cpa", "ctr", "cvr", "roas", "cpm", "cpi"]) {
      expect(snapshot.rows[0]).not.toHaveProperty(banned);
    }
  });

  it("전체 CPA는 캠페인 CPA의 평균이 아니라 합의 비다", () => {
    // A: 비용 900 / 전환 10 → CPA 90 · B: 비용 100 / 전환 90 → CPA 1.11
    // 단순 평균은 45.6이지만 실제 전체 CPA는 1000/100 = 10이다.
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [
        { date: "2026-08-31", campaign: "A", cost: 900, actions: 10 },
        { date: "2026-08-31", campaign: "B", cost: 100, actions: 90 },
      ],
    });
    const metrics = snapshotMetrics(snapshot);
    expect(metrics.cpa).toBe(10);

    const perCampaign = snapshot.rows.map((r) => r.cost / r.actions);
    const naiveAverage = perCampaign.reduce((a, b) => a + b, 0) / perCampaign.length;
    expect(naiveAverage).toBeGreaterThan(45); // 이 값이 화면에 뜨면 안 된다
  });

  it("어떤 부분집합으로 묶어도 합이 전체와 맞는다", () => {
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [
        { date: "2026-08-31", campaign: "A", channel: "Google", cost: 33.33, actions: 7 },
        { date: "2026-09-01", campaign: "B", channel: "Google", cost: 66.67, actions: 11 },
        { date: "2026-09-02", campaign: "C", channel: "Meta", cost: 10.01, actions: 3 },
      ],
    });
    const all = sumRows(snapshot.rows);
    const google = sumRows(snapshot.rows.filter((r) => r.channel === "Google"));
    const meta = sumRows(snapshot.rows.filter((r) => r.channel === "Meta"));
    expect(google.cost + meta.cost).toBeCloseTo(all.cost, 12);
    expect(google.actions + meta.actions).toBe(all.actions);
  });

  it("분모가 0이거나 없으면 비율을 만들지 않는다 — Infinity를 내보내지 않는다", () => {
    expect(deriveMetrics({ cost: 100, actions: 0 }).cpa).toBeNull();
    expect(deriveMetrics({ cost: 100, actions: null }).cpa).toBeNull();
    expect(deriveMetrics({ clicks: 5, impressions: 0 }).ctr).toBeNull();
    expect(deriveMetrics({ revenue: 100, cost: 0 }).roas).toBeNull();
    expect(deriveMetrics({ cost: 100, impressions: null }).cpm).toBeNull();
    for (const value of Object.values(deriveMetrics({ cost: 100, actions: 0, impressions: 0, clicks: 0 }))) {
      if (value !== null) expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("기준(설치/가입)에 따라 전환과 CPA가 바뀐다", () => {
    const totals = { cost: 100, installs: 50, actions: 10 };
    expect(deriveMetrics(totals, { basis: "installs" }).cpa).toBe(2);
    expect(deriveMetrics(totals, { basis: "actions" }).cpa).toBe(10);
    expect(deriveMetrics(totals, { basis: "installs" }).conversions).toBe(50);
  });
});

describe("결정론", () => {
  const rows = [
    { date: "2026-09-02", campaign: "Meta AAP", channel: "Meta", cost: 12.1, actions: 3 },
    { date: "2026-08-31", campaign: "UAC A", channel: "Google", cost: 0.1, actions: 1 },
    { date: "2026-09-01", campaign: "ASA Brand", channel: "ASA", cost: 0.2, actions: 2 },
    { date: "2026-09-01", campaign: "UAC A", channel: "Google", cost: 0.3, actions: 4 },
  ];

  it("입력 행 순서가 달라도 같은 스냅샷이 나온다", () => {
    const forward = buildSnapshot({ period: PERIOD, rows });
    const reversed = buildSnapshot({ period: PERIOD, rows: [...rows].reverse() });
    expect(reversed.rows.map((r) => r.campaign)).toEqual(forward.rows.map((r) => r.campaign));
    forward.rows.forEach((r, i) => {
      expect(reversed.rows[i].cost).toBeCloseTo(r.cost, 12);
      expect(reversed.rows[i].actions).toBe(r.actions);
    });
  });

  it("정렬은 채널 → 캠페인 순이다", () => {
    const snapshot = buildSnapshot({ period: PERIOD, rows });
    expect(snapshot.rows.map((r) => `${r.channel}/${r.campaign}`)).toEqual([
      "ASA/ASA Brand",
      "Google/UAC A",
      "Meta/Meta AAP",
    ]);
  });

  it("정렬에 localeCompare를 쓰지 않는다 — 로케일마다 순서가 달라진다", () => {
    const source = readFileSync(new URL("./snapshot.js", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/localeCompare/);
    // 가드가 빈 문자열을 보고 통과하지 않도록 실제 비교기가 있는지도 확인한다.
    expect(source).toMatch(/function compareText/);
  });

  it("부동소수점 합이 순진한 덧셈보다 정확하다", () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({
      date: "2026-08-31", campaign: "A", cost: 0.1, actions: i === 0 ? 1 : 0,
    }));
    const snapshot = buildSnapshot({ period: PERIOD, rows: many });
    expect(snapshot.rows[0].cost).toBe(100); // 순진한 누적은 99.9999999999986
  });
});

describe("집계할 것이 없으면 지어내지 않는다", () => {
  it("기간이 없으면 no_period", () => {
    expect(buildSnapshot({ rows: [row("2026-08-31", "A")] }).reason).toBe("no_period");
  });

  it("기간 안에 행이 없으면 no_rows_in_period", () => {
    const snapshot = buildSnapshot({ period: PERIOD, rows: [row("2026-07-01", "A")] });
    expect(snapshot.ok).toBe(false);
    expect(snapshot.reason).toBe("no_rows_in_period");
    expect(snapshot.rows).toEqual([]);
    expect(snapshotMetrics(snapshot)).toBeNull();
  });

  it("날짜를 읽을 수 없는 행은 조용히 버린다", () => {
    const snapshot = buildSnapshot({
      period: PERIOD,
      rows: [row("합계", "A"), row("2026-08-31", "A", { cost: 5 })],
    });
    expect(snapshot.rows[0].cost).toBe(5);
  });
});

describe("저장 계약", () => {
  it("원본 행이 스냅샷에 남지 않는다", () => {
    const snapshot = buildSnapshot({
      period: PERIOD,
      kpi: { metric: "cpa", basis: "actions", direction: "lower_is_better" },
      createdAt: "2026-09-07T00:00:00.000Z",
      rows: [{ date: "2026-08-31", campaign: "A", cost: 10, actions: 1, 사용자메모: "비밀" }],
    });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toMatch(/사용자메모|비밀/);
    expect(serialized).not.toMatch(/2026-08-31T|"date"/);
    expect(snapshot.kpi).toEqual({ metric: "cpa", basis: "actions", direction: "lower_is_better" });
  });

  it("스냅샷은 그대로 직렬화·복원된다", () => {
    const snapshot = buildSnapshot({ period: PERIOD, rows: [row("2026-08-31", "A")] });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
