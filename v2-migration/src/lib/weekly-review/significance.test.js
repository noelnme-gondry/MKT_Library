import { describe, expect, it } from "vitest";
import {
  HIGHER_IS_BETTER,
  LOWER_IS_BETTER,
  SIGNIFICANCE_CONFIG,
  assessChange,
  summarizeBaseline,
} from "./significance";

/** 목업·명세와 같은 픽스처. 화면이 그리는 띠와 판정이 같은 값이어야 한다. */
const HISTORY = [7.15, 7.72, 7.24, 7.61, 7.79, 7.18, 7.42];

describe("평소 변동 범위", () => {
  it("표본 평균·표준편차이고 띠는 평균 ±1σ다", () => {
    const baseline = summarizeBaseline(HISTORY);
    expect(baseline.known).toBe(true);
    expect(baseline.weeks).toBe(7);
    expect(baseline.mean).toBeCloseTo(7.444285714285714, 12);
    expect(baseline.sd).toBeCloseTo(0.2651324915872026, 12);
    // 화면의 회색 띠가 이 두 값이다 — 어긋나면 그림과 문장이 다른 말을 한다.
    expect(baseline.lo).toBeCloseTo(baseline.mean - baseline.sd, 12);
    expect(baseline.hi).toBeCloseTo(baseline.mean + baseline.sd, 12);
  });

  it("최근 lookbackWeeks개만 본다", () => {
    const long = [99, 99, 99, ...HISTORY, 7.5, 7.5];
    expect(summarizeBaseline(long).weeks).toBe(SIGNIFICANCE_CONFIG.lookbackWeeks);
    expect(summarizeBaseline(long).mean).toBeLessThan(10); // 앞의 99가 섞이지 않았다
  });

  it("주가 모자라면 모른다고 한다 — 정상이라고 하지 않는다", () => {
    const baseline = summarizeBaseline([7.42, 8.04]);
    expect(baseline.known).toBe(false);
    expect(baseline.reason).toBe("too_few_weeks");
    expect(baseline.lo).toBeNull();
  });

  it("흩어짐이 0이면 무한대 z를 만들지 않고 모른다고 한다", () => {
    const baseline = summarizeBaseline([7.4, 7.4, 7.4, 7.4]);
    expect(baseline.known).toBe(false);
    expect(baseline.reason).toBe("no_variation");
    expect(baseline.sd).toBe(0);
  });

  it("숫자가 아닌 값은 걸러낸다", () => {
    expect(summarizeBaseline([7.15, null, "7.72", undefined, 7.24, NaN, "합계"]).weeks).toBe(3);
  });
});

describe("세 축을 모두 통과해야 확인할 것이 된다", () => {
  const base = { history: HISTORY, volume: 11551, direction: LOWER_IS_BETTER };

  it("크기·평소범위·표본이 다 넘으면 유의미", () => {
    const result = assessChange({ ...base, current: 8.04, previous: 7.42 });
    expect(result.significant).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.deltaPct).toBeCloseTo(0.083558, 6);
    expect(result.z).toBeCloseTo(2.2469, 4);
    expect(result.outcome).toBe("worse");
  });

  it("변화가 작으면 크기에서 막힌다", () => {
    const result = assessChange({ ...base, current: 7.48, previous: 7.42 });
    expect(result.significant).toBe(false);
    expect(result.reason).toBe("change_too_small");
    expect(Math.abs(result.z)).toBeLessThan(SIGNIFICANCE_CONFIG.minZ);
  });

  it("크기는 넘어도 평소 변동 범위 안이면 막힌다", () => {
    // 흩어짐이 큰 이력에서는 8% 변화도 평소 등락이다.
    const noisy = [6.4, 8.3, 6.7, 8.1, 6.9, 8.0, 7.42];
    const result = assessChange({ ...base, history: noisy, current: 8.04, previous: 7.42 });
    expect(result.checks.size.pass).toBe(true);
    expect(result.checks.variability.pass).toBe(false);
    expect(result.reason).toBe("within_normal_range");
  });

  it("표본이 적으면 막힌다", () => {
    const result = assessChange({ ...base, current: 8.04, previous: 7.42, volume: 12 });
    expect(result.reason).toBe("volume_too_low");
    expect(result.volumeRequired).toBe(SIGNIFICANCE_CONFIG.minVolume);
  });

  it("부분 주 소표본이면 표본 기준이 두 배가 된다", () => {
    const args = { ...base, current: 8.04, previous: 7.42, volume: 45, volumeMultiplier: 2 };
    expect(assessChange(args).volumeRequired).toBe(60);
    expect(assessChange(args).reason).toBe("volume_too_low");
    expect(assessChange({ ...args, volumeMultiplier: 1 }).significant).toBe(true);
  });
});

describe("모르는 것을 통과로 세지 않는다", () => {
  it("이력이 모자라면 평소범위 검사를 건너뛰고 그 사실을 남긴다", () => {
    const result = assessChange({
      current: 8.04, previous: 7.42, history: [7.42], volume: 11551, direction: LOWER_IS_BETTER,
    });
    expect(result.baselineKnown).toBe(false);
    expect(result.checks.variability.skipped).toBe(true);
    expect(result.checks.variability.pass).toBe(false); // 건너뛴 것은 통과가 아니다
    expect(result.z).toBeNull();
    // 크기·표본만으로 판단하되, 화면이 "평소 범위를 아직 모릅니다"라고 말할 수 있어야 한다.
    expect(result.significant).toBe(true);
  });

  it("무유의의 사유가 '범위 안'인지 '몰라서'인지 구분된다", () => {
    const withinRange = assessChange({
      current: 7.90, previous: 7.42, history: [6.4, 8.3, 6.7, 8.1, 6.9, 8.0, 7.42],
      volume: 11551, direction: LOWER_IS_BETTER,
    });
    const noBaseline = assessChange({
      current: 7.44, previous: 7.42, history: [7.42], volume: 11551, direction: LOWER_IS_BETTER,
    });
    expect(withinRange.reason).toBe("within_normal_range");
    expect(withinRange.baselineKnown).toBe(true);
    expect(noBaseline.reason).toBe("change_too_small");
    expect(noBaseline.baselineKnown).toBe(false);
  });

  it("표본을 안 주면 통과시키지 않고 no_volume으로 남긴다", () => {
    const result = assessChange({ current: 8.04, previous: 7.42, history: HISTORY });
    expect(result.significant).toBe(false);
    expect(result.reason).toBe("no_volume");
    expect(result.checks.volume.skipped).toBe(true);
  });
});

describe("정의되지 않는 값을 화면에 내보내지 않는다", () => {
  it("지난 기간이 0이면 변화율을 만들지 않는다", () => {
    const result = assessChange({ current: 8.04, previous: 0, history: HISTORY, volume: 11551 });
    expect(result.reason).toBe("no_previous_value");
    expect(result.deltaPct).toBeNull();
    expect(result.significant).toBe(false);
  });

  it("값이 비었거나 숫자가 아니면 no_value", () => {
    for (const args of [{ current: null, previous: 7.42 }, { current: 8.04, previous: undefined }, { current: "합계", previous: 7.42 }]) {
      const result = assessChange({ ...args, history: HISTORY, volume: 11551 });
      expect(result.reason).toBe("no_value");
      expect(result.deltaPct).toBeNull();
    }
  });

  it("어떤 입력에도 Infinity·NaN이 새어나가지 않는다", () => {
    const inputs = [
      { current: 8.04, previous: 0 }, { current: 0, previous: 7.42 }, { current: 0, previous: 0 },
      { current: -1, previous: 7.42 }, { current: 8.04, previous: -7.42 },
    ];
    for (const args of inputs) {
      const result = assessChange({ ...args, history: HISTORY, volume: 11551 });
      for (const value of [result.deltaPct, result.z, result.delta]) {
        if (value !== null) expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});

describe("좋고 나쁨은 지표의 방향을 따른다", () => {
  it("CPA는 오르면 나쁘고 내리면 좋다", () => {
    expect(assessChange({ current: 8.04, previous: 7.42, history: HISTORY, volume: 11551, direction: LOWER_IS_BETTER }).outcome).toBe("worse");
    expect(assessChange({ current: 6.80, previous: 7.42, history: HISTORY, volume: 11551, direction: LOWER_IS_BETTER }).outcome).toBe("better");
  });

  it("ROAS는 반대다", () => {
    const history = [1.9, 2.3, 2.0, 2.2, 2.4, 1.95, 2.1];
    expect(assessChange({ current: 1.7, previous: 2.1, history, volume: 11551, direction: HIGHER_IS_BETTER }).outcome).toBe("worse");
    expect(assessChange({ current: 2.6, previous: 2.1, history, volume: 11551, direction: HIGHER_IS_BETTER }).outcome).toBe("better");
  });

  it("변화가 없으면 flat이고, 방향이 판정 자체를 바꾸지는 않는다", () => {
    const args = { current: 8.04, previous: 7.42, history: HISTORY, volume: 11551 };
    const lower = assessChange({ ...args, direction: LOWER_IS_BETTER });
    const higher = assessChange({ ...args, direction: HIGHER_IS_BETTER });
    expect(lower.significant).toBe(higher.significant);
    expect(lower.outcome).toBe("worse");
    expect(higher.outcome).toBe("better");
    expect(assessChange({ ...args, current: 7.42 }).outcome).toBe("flat");
  });
});

describe("결정론", () => {
  it("같은 입력이면 같은 출력", () => {
    const args = { current: 8.04, previous: 7.42, history: HISTORY, volume: 11551, direction: LOWER_IS_BETTER };
    expect(JSON.stringify(assessChange(args))).toBe(JSON.stringify(assessChange(args)));
  });

  it("임계값은 config로 갈아끼울 수 있다", () => {
    const args = { current: 7.48, previous: 7.42, history: HISTORY, volume: 11551 };
    expect(assessChange(args).significant).toBe(false);
    const loose = { ...SIGNIFICANCE_CONFIG, minPct: 0.005, minZ: 0.1 };
    expect(assessChange({ ...args, config: loose }).significant).toBe(true);
  });
});
