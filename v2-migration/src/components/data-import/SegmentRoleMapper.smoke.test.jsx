import React, { useState } from "react";
import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SegmentRoleMapper from "./SegmentRoleMapper";
import { buildSegmentPanel, SEGMENT_ISSUE } from "@/lib/segment-composition/segmentPanel";
import { segmentMappingSignature } from "@/lib/segment-composition/mappingSignature";
import {
  LONG_TWO_AXIS_ROWS, WIDE_GENDER_ROWS, BASE_ROLES, GENDER_LONG_DIMENSION, GENDER_WIDE_DIMENSION,
} from "@/lib/segment-composition/fixtures";

const headersOf = (rows) => Object.keys(rows[0]);
const EMPTY = { roles: { time: "", entity: [], scope: [], population: "", measures: {} }, dimensions: [] };

// 실제 사용 경로를 밟는다 — 부모가 상태를 갖고 매퍼가 controlled로 도는 형태.
function Harness({ rows, initial = EMPTY, quality = null, locale = "ko", onState }) {
  const [state, setState] = useState(initial);
  onState?.(state);
  return (
    <SegmentRoleMapper
      headers={headersOf(rows)}
      rows={rows}
      value={state}
      quality={quality}
      locale={locale}
      onChange={(next) => { setState(next); onState?.(next); }}
    />
  );
}

describe("SegmentRoleMapper", () => {
  it("빈 상태에서 무엇이 막혔는지 사유를 말한다", () => {
    const { container } = render(<Harness rows={LONG_TWO_AXIS_ROWS} />);
    const blocked = container.querySelector("[aria-labelledby='segment-blocked-title']");
    expect(blocked.textContent).toContain("기간 컬럼");
    expect(blocked.textContent).toContain("세그먼트 축");
  });

  it("축 후보를 제안하고 지표·날짜 컬럼은 후보로 올리지 않는다", () => {
    const { container } = render(<Harness rows={LONG_TWO_AXIS_ROWS} />);
    const list = container.querySelector(".segment-candidate-list").textContent;
    expect(list).toContain("성별");
    expect(list).toContain("연령대");
    expect(list).not.toContain("광고비");
  });

  it("후보를 누르면 축으로 선언되고 인원수 컬럼을 마저 묻는다", () => {
    let latest = null;
    const { container } = render(
      <Harness rows={LONG_TWO_AXIS_ROWS} onState={(state) => { latest = state; }} />,
    );
    const genderRow = [...container.querySelectorAll(".segment-candidate-list li")]
      .find((item) => item.textContent.startsWith("성별"));
    fireEvent.click(genderRow.querySelector("button"));
    expect(latest.dimensions).toHaveLength(1);
    expect(latest.dimensions[0].categoryColumn).toBe("성별");
    // 인원수를 아직 모르므로 분석을 열지 않는다.
    expect(container.querySelector("[aria-labelledby='segment-blocked-title']").textContent).toContain("인원수 컬럼");
  });

  it("이미 역할을 맡은 컬럼은 축 후보에서 뺀다", () => {
    // 캠페인은 저카디널리티 문자열이라 후보 규칙을 통과하지만, 분석 단위로 선언했다면
    // 다시 축으로 쓰는 것은 동어반복이다.
    const initial = { roles: { time: "일자", entity: ["캠페인"], scope: ["OS"], population: "", measures: {} }, dimensions: [] };
    const { container } = render(<Harness rows={LONG_TWO_AXIS_ROWS} initial={initial} />);
    const list = container.querySelector(".segment-candidate-list").textContent;
    expect(list).toContain("성별");
    expect(list).not.toContain("캠페인");
    expect(list).not.toContain("OS");
  });

  it("wide 멤버 컬럼 묶음을 제안하고 전체 컬럼은 분모로 넣는다", () => {
    let latest = null;
    const { getByText } = render(<Harness rows={WIDE_GENDER_ROWS} onState={(state) => { latest = state; }} />);
    fireEvent.click(getByText("묶음으로 추가"));
    const dimension = latest.dimensions[0];
    expect(dimension.members.map((member) => member.sourceColumn)).toEqual(["여성가입", "남성가입"]);
    expect(dimension.denominatorColumn).toBe("전체가입");
  });

  it("배타·포괄 선언을 사용자가 뒤집을 수 있다", () => {
    let latest = null;
    const initial = { roles: { ...BASE_ROLES, entity: ["캠페인"], scope: ["OS"] }, dimensions: [GENDER_WIDE_DIMENSION] };
    const { getByLabelText } = render(
      <Harness rows={WIDE_GENDER_ROWS} initial={initial} onState={(state) => { latest = state; }} />,
    );
    fireEvent.click(getByLabelText("모든 사람이 어딘가에 속함 (포괄)"));
    expect(latest.dimensions[0].isExhaustive).toBe(false);
  });

  it("선언이 바뀌면 분석 서명도 바뀐다 — 옛 결과가 그대로 남지 않도록", () => {
    const before = segmentMappingSignature({ rowCount: 4, roles: BASE_ROLES, dimensions: [GENDER_WIDE_DIMENSION] });
    const after = segmentMappingSignature({
      rowCount: 4,
      roles: BASE_ROLES,
      dimensions: [{ ...GENDER_WIDE_DIMENSION, isExhaustive: false }],
    });
    expect(after).not.toBe(before);
    const binned = segmentMappingSignature({
      rowCount: 4,
      roles: BASE_ROLES,
      dimensions: [{ ...GENDER_WIDE_DIMENSION, binning: { boundaries: [29, 39] } }],
    });
    expect(binned).not.toBe(before);
  });

  it("점검 결과를 받으면 코드가 아니라 문장으로 보여 준다", () => {
    const panel = buildSegmentPanel({ rows: LONG_TWO_AXIS_ROWS, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] });
    const { container } = render(
      <Harness rows={LONG_TWO_AXIS_ROWS} initial={{ roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] }} quality={panel.quality} />,
    );
    const report = container.querySelector("[aria-labelledby='segment-quality-title']");
    expect(report.textContent).toContain("비용이 멤버 행마다 반복");
    expect(report.textContent).not.toContain(SEGMENT_ISSUE.MEASURE_REPEATED_ACROSS_MEMBERS);
  });

  it("EN 로케일에서 같은 기능과 같은 사유를 제공한다", () => {
    const panel = buildSegmentPanel({ rows: LONG_TWO_AXIS_ROWS, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] });
    const { container } = render(
      <Harness rows={LONG_TWO_AXIS_ROWS} quality={panel.quality} locale="en" />,
    );
    expect(container.textContent).toContain("Confirm column roles");
    expect(container.textContent).toContain("No period column selected yet.");
    expect(container.querySelectorAll(".segment-candidate-list li").length).toBeGreaterThan(0);
  });

  it("역할 선택기에 이름이 붙어 있다 — 이름 없는 select는 보조기술이 읽지 못한다", () => {
    const { getByLabelText } = render(<Harness rows={LONG_TWO_AXIS_ROWS} />);
    expect(getByLabelText("기간 (날짜·주차)")).toBeTruthy();
    expect(getByLabelText("전체 모수")).toBeTruthy();
  });

  it("분석 단위·경쟁 범위 체크박스 묶음에 legend가 있다", () => {
    const { container } = render(<Harness rows={LONG_TWO_AXIS_ROWS} />);
    const legends = [...container.querySelectorAll("fieldset legend")].map((legend) => legend.textContent);
    expect(legends).toContain("분석 단위 (캠페인·채널)");
    expect(legends).toContain("경쟁 범위 (OS·국가)");
  });
});
