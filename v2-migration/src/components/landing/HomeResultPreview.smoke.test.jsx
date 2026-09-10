import { expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import HomeResultPreview from "./HomeResultPreview";
vi.mock("@/utils/demoData", () => ({ buildDemoCsv: () => ({ raw: [] }) }));
it("omits the sample card when the fixture cannot support a comparison", () => {
  const { container } = render(<HomeResultPreview locale="ko" />);
  expect(container.textContent).toBe("");
});
