// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import ConnectedToolJourney from "@/components/ConnectedToolJourney";

describe("ConnectedToolJourney", () => {
  it("tracks the selected tool and decision stage in both locales", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    const { container } = render(<ConnectedToolJourney locale="en" />);
    const link = container.querySelector(".connected-tool-card");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(gtag).toHaveBeenCalledWith("event", "connected_workflow_pick", {
      tool_id: "5-2",
      source: "landing",
      placement: "connected_workflow",
      tab_name: "monitor",
      locale: "en",
    });
    delete window.gtag;
  });
});
