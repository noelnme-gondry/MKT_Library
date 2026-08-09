// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";

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

  it("opens the matching stage instead of sending a multi-tool stage to an arbitrary first tool", async () => {
    const { container, getByRole } = render(<ConnectedToolJourney locale="ko" />);
    expect(container.querySelectorAll(".connected-tool-path > li")).toHaveLength(5);
    expect(container.querySelector(".connected-tool-journey__details").open).toBe(false);
    const chooseStage = getByRole("button", { name: /다음 조치 선택.*4개 도구 중 선택/ });
    expect(chooseStage.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(chooseStage);
    expect(container.querySelector(".connected-tool-journey__details").open).toBe(true);
    expect(chooseStage.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelectorAll(".tool-template-action")).toHaveLength(2);
    await waitFor(() => expect(document.activeElement?.id).toBe("connected-tool-stage-choose"));
  });
});
