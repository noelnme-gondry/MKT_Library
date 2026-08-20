import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SemanticMappingTable from "./SemanticMappingTable";

describe("SemanticMappingTable", () => {
  it("shows a reviewable global role and lets the user abstain", () => {
    const onBindingChange = vi.fn();
    render(<SemanticMappingTable
      bindings={[{ sourceColumn: "Meta Spend", canonicalKey: "media_spend", decision: "SUGGEST" }]}
      semanticMapping={{ candidatesByHeader: { "Meta Spend": [{ canonicalKey: "media_spend", confidence: 0.82 }] } }}
      onBindingChange={onBindingChange}
    />);
    fireEvent.click(screen.getByText("Semantic Mapper V2 미리보기"));
    expect(screen.getByText("확인 필요")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Meta Spend: 전역 역할"), { target: { value: "__unknown__" } });
    expect(onBindingChange).toHaveBeenCalledWith("Meta Spend", null);
  });
});
