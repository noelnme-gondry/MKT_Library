import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BlockedOptionsNote from "./BlockedOptionsNote";

describe("BlockedOptionsNote", () => {
  it("renders nothing when no option is blocked", () => {
    const { container } = render(<BlockedOptionsNote items={[{ label: "CVR" }, { label: "CPA", reason: "" }]} />);
    expect(container.querySelector(".blocked-options-note")).toBeNull();
  });

  it("names each blocked option with what would unblock it", () => {
    const { container } = render(
      <BlockedOptionsNote items={[
        { label: "CVR", reason: "clicks·installs 컬럼이 필요합니다" },
        { label: "CPA" },
        { label: "ROAS", reason: "revenue 컬럼이 필요합니다" },
      ]} />,
    );
    const note = container.querySelector(".blocked-options-note");
    expect(note.textContent).toContain("CVR");
    expect(note.textContent).toContain("clicks·installs 컬럼이 필요합니다");
    expect(note.textContent).toContain("ROAS");
    // 막히지 않은 항목은 언급하지 않는다 — 쓸 수 있는 것을 못 쓰는 것처럼 보이면 안 된다.
    expect(note.textContent).not.toContain("CPA");
  });

  it("writes only the reason when there is nothing to label", () => {
    const { container } = render(<BlockedOptionsNote items={[{ reason: "통화를 선택하면 분석할 수 있습니다" }]} />);
    expect(container.querySelector(".blocked-options-note").textContent).toBe("통화를 선택하면 분석할 수 있습니다");
    expect(container.querySelector("strong")).toBeNull();
  });
});
