import { describe, expect, it } from "vitest";
import { MAX_SNAPSHOTS, historyFor, mergeSnapshots, toStoredSnapshot } from "./snapshotStore";
import { buildSnapshot, deriveMetrics, sumRows } from "./snapshot";

function snap(start, end, rows, extra = {}) {
  return buildSnapshot({
    period: { start, end, days: 7 },
    rows: rows.map((row) => ({ date: start, ...row })),
    ...extra,
  });
}

const WEEK = [
  { campaign: "A", channel: "Google", cost: 30_000, actions: 4_000 },
  { campaign: "B", channel: "Meta", cost: 20_000, actions: 2_000 },
];

describe("저장하는 것은 집계뿐이다", () => {
  it("원본 행이 스냅샷 레코드에 남지 않는다", () => {
    const stored = toStoredSnapshot(buildSnapshot({
      period: { start: "2026-08-31", end: "2026-09-06", days: 7 },
      rows: [{ date: "2026-08-31", campaign: "A", cost: 10, actions: 1, 사용자메모: "비밀" }],
    }));
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toMatch(/사용자메모|비밀/);
    expect(serialized).not.toMatch(/"date"/);
    expect(stored.rows[0].campaign).toBe("A"); // 캠페인명은 남는다 — 없으면 원인을 못 좁힌다
  });

  it("합산 필드만 담고 비율은 담지 않는다", () => {
    const stored = toStoredSnapshot(snap("2026-08-31", "2026-09-06", WEEK));
    expect(Object.keys(stored.rows[0]).sort()).toEqual(
      ["actions", "campaign", "channel", "clicks", "cost", "impressions", "installs", "revenue"],
    );
    for (const banned of ["cpa", "ctr", "roas"]) expect(stored.rows[0]).not.toHaveProperty(banned);
  });

  it("저장할 수 없는 스냅샷은 null", () => {
    expect(toStoredSnapshot(null)).toBeNull();
    expect(toStoredSnapshot({ ok: false })).toBeNull();
    expect(toStoredSnapshot(buildSnapshot({ period: { start: "2026-08-31", end: "2026-09-06" }, rows: [] }))).toBeNull();
  });
});

describe("병합", () => {
  it("같은 기간은 덮어쓴다 — 재분석하면 같은 주를 다시 저장한다", () => {
    const first = mergeSnapshots([], snap("2026-08-31", "2026-09-06", WEEK));
    const again = mergeSnapshots(first, snap("2026-08-31", "2026-09-06", [{ campaign: "A", cost: 99, actions: 9 }]));
    expect(again).toHaveLength(1);
    expect(again[0].rows[0].cost).toBe(99);
  });

  it("기간 시작일 오름차순으로 정렬한다", () => {
    let list = [];
    for (const start of ["2026-09-07", "2026-08-24", "2026-08-31"]) {
      list = mergeSnapshots(list, snap(start, start, WEEK));
    }
    expect(list.map((item) => item.period.start)).toEqual(["2026-08-24", "2026-08-31", "2026-09-07"]);
  });

  it("오래된 것부터 잘라내고 상한을 지킨다", () => {
    let list = [];
    for (let week = 0; week < MAX_SNAPSHOTS + 4; week += 1) {
      const day = String(week + 1).padStart(2, "0");
      list = mergeSnapshots(list, snap(`2026-03-${day}`, `2026-03-${day}`, WEEK));
    }
    expect(list).toHaveLength(MAX_SNAPSHOTS);
    expect(list[0].period.start).toBe("2026-03-05"); // 앞의 4주가 잘렸다
  });

  it("저장할 수 없는 입력은 기존 목록을 그대로 둔다", () => {
    const list = mergeSnapshots([], snap("2026-08-31", "2026-09-06", WEEK));
    expect(mergeSnapshots(list, null)).toEqual(list);
  });

  it("깨진 항목은 걸러낸다", () => {
    const list = mergeSnapshots([null, {}, { period: {} }], snap("2026-08-31", "2026-09-06", WEEK));
    expect(list).toHaveLength(1);
  });
});

describe("이력 추출", () => {
  const derive = (rows) => deriveMetrics(sumRows(rows), { basis: "actions" });

  function fixture() {
    let list = [];
    const weeks = [
      ["2026-08-10", 30_000, 4_000],
      ["2026-08-17", 32_000, 4_100],
      ["2026-08-24", 31_000, 4_050],
      ["2026-08-31", 44_000, 4_060],
    ];
    for (const [start, cost, actions] of weeks) {
      list = mergeSnapshots(list, snap(start, start, [{ campaign: "A", cost, actions }]));
    }
    return list;
  }

  it("이번 기간은 이력에서 뺀다 — 평소 범위가 자기 자신을 포함하면 안 된다", () => {
    const history = historyFor(fixture(), { excludeStart: "2026-08-31", derive });
    expect(history.cpa).toHaveLength(3);
    expect(history.cpa.every((value) => value < 8)).toBe(true); // 이번 주(10.8)는 빠졌다
  });

  it("지표별로 배열을 만든다", () => {
    const history = historyFor(fixture(), { excludeStart: null, derive });
    expect(history.cpa).toHaveLength(4);
    expect(history.cpa[0]).toBeCloseTo(30_000 / 4_000, 12);
  });

  it("계산할 수 없는 지표는 이력에 넣지 않는다 — null이 0으로 새면 평소 범위가 무너진다", () => {
    const list = mergeSnapshots([], snap("2026-08-10", "2026-08-10", [{ campaign: "A", cost: 100, actions: 10 }]));
    const history = historyFor(list, { derive });
    expect(history.cpa).toEqual([10]);
    expect(history.roas).toBeUndefined(); // 매출 컬럼이 없다
    expect(history.ctr).toBeUndefined();
  });

  it("빈 입력에도 던지지 않는다", () => {
    expect(historyFor([], { derive })).toEqual({});
    expect(historyFor(null, { derive })).toEqual({});
    expect(historyFor(fixture(), {})).toEqual({});
  });
});


it("통화·기간 길이·미래 주가 다른 집계는 평소 범위에서 제외한다", () => {
  const record = { currency: "KRW", period: { start: "2026-08-24", end: "2026-08-30", days: 7 }, rows: WEEK };
  const history = historyFor([record, { ...record, currency: "USD" }, { ...record, period: { ...record.period, days: 3 } }, { ...record, period: { ...record.period, start: "2026-09-07" } }], { currency: "KRW", days: 7, excludeStart: "2026-08-31", derive: rows => deriveMetrics(sumRows(rows)) });
  expect(history.cpa).toEqual([50000 / 6000]);
});

it("같은 월요일의 부분 주를 저장해도 완료 주는 보존한다", () => {
  const full = snap("2026-08-24", "2026-08-30", WEEK);
  const partial = snap("2026-08-24", "2026-08-26", WEEK);
  expect(mergeSnapshots(mergeSnapshots([], full), partial)).toHaveLength(2);
});
