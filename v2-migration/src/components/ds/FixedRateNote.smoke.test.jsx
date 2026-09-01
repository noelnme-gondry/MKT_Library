import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FixedRateNote from "./FixedRateNote";
import { stripSourceComments } from "@/test-utils/stripSourceComments";
import { USD_KRW_RATE, isCurrencyConverted } from "@/utils/format";

const COMPONENT_ROOT = path.join(process.cwd(), "src/components");

function jsxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsxFiles(target);
    return entry.name.endsWith(".jsx") && !entry.name.includes(".test.") ? [target] : [];
  });
}

describe("고정 환율 고지", () => {
  it("환산이 일어나지 않으면 아무것도 그리지 않는다", () => {
    const { container } = render(<FixedRateNote sourceCurrency="KRW" displayCurrency="KRW" />);
    expect(container.textContent).toBe("");
    expect(isCurrencyConverted("KRW", "KRW")).toBe(false);
    // 원본 통화 미선택(=환산 안 함)도 같은 경로다.
    expect(render(<FixedRateNote sourceCurrency={null} displayCurrency="USD" />).container.textContent).toBe("");
  });

  it("환산될 때 상수에서 파생한 환율을 KO·EN 모두 고지한다", () => {
    const rate = USD_KRW_RATE.toLocaleString("en-US");
    const ko = render(<FixedRateNote sourceCurrency="KRW" displayCurrency="USD" locale="ko" />);
    expect(ko.container.textContent).toContain(rate);
    expect(ko.container.textContent).toContain("실시간 시세가 아닌");
    ko.unmount();
    render(<FixedRateNote sourceCurrency="USD" displayCurrency="KRW" locale="en" />);
    expect(screen.getByText(new RegExp(`fixed ₩${rate}`))).toBeTruthy();
  });

  // §8: 화면에 뜨는 환산 금액은 실시간 시세가 아니다. 통화를 바꾸는 컨트롤을 가진
  // 화면은 어떤 환율을 썼는지 말하거나, 환산을 하지 않는다는 사실을 DOM 표식으로
  // 남겨야 한다. 대상을 손으로 적으면 새 토글이 생겼을 때 조용히 빠지므로 소스에서
  // 파생한다(§7). 표식을 주석에 두면 검사가 주석에 속으므로 먼저 지우고 본다(§16).
  it("통화를 바꾸는 화면은 환율을 고지하거나 환산 안 함을 표식으로 남긴다", () => {
    const controls = jsxFiles(COMPONENT_ROOT).filter((file) =>
      /\bsetDisplayCurrency\b/.test(stripSourceComments(readFileSync(file, "utf8"))));
    // 스캐너가 깨지면 0건이 되어 통과해 버린다 — 대상이 있다는 것부터 단언한다.
    expect(controls.length).toBeGreaterThan(2);
    const offenders = controls.filter((file) => {
      const source = stripSourceComments(readFileSync(file, "utf8"));
      return !/<FixedRateNote\b/.test(source) && !/data-currency-scope="declare"/.test(source);
    });
    expect(offenders, `환율 고지도 "환산 안 함" 표식도 없는 통화 컨트롤:\n${offenders.join("\n")}`).toEqual([]);
  });
});
