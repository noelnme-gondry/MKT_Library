// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadChartAsPNG } from "@/utils/chartUtils";

describe("downloadChartAsPNG", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adds a visible source footer without covering the chart", () => {
    let exportCanvas;
    const context = {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      fillStyle: "",
      font: "",
      textAlign: "",
      textBaseline: "",
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function getContext() {
      exportCanvas = this;
      return context;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,test");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const source = document.createElement("canvas");
    source.width = 600;
    source.height = 300;

    expect(downloadChartAsPNG(source, "weekly_chart")).toBe(true);
    expect(exportCanvas.width).toBe(600);
    expect(exportCanvas.height).toBe(324);
    expect(context.drawImage).toHaveBeenCalledWith(source, 0, 0);
    expect(context.fillText).toHaveBeenCalledWith(
      "Growth Opt Playbook · growthoptplaybook.com",
      590,
      312,
    );
  });
});
