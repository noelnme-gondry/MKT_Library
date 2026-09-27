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

it("places context above a high-resolution chart without shrinking or covering it", () => {
  const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillText: vi.fn(), save: vi.fn(), restore: vi.fn(), scale: vi.fn(), measureText: value => ({ width: value.length * 8 }) };
  let exported;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () { exported = this; return context; });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,test");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const source = document.createElement("canvas");
  source.width = 1200; source.height = 600;
  Object.defineProperty(source, "clientWidth", { value: 400 });
  expect(downloadChartAsPNG(source, "chart", { context: { title: "Actual period", details: ["2026-08-08 – 2026-08-14"] } })).toBe(true);
  expect(exported.width).toBe(1200);
  expect(exported.height).toBeGreaterThan(672);
  expect(context.scale).toHaveBeenCalledWith(3, 3);
  const [, x, y] = context.drawImage.mock.calls[0];
  expect(x).toBe(0);
  expect(y).toBeGreaterThan(0);
  expect(y + source.height + 72).toBe(exported.height);
  expect(context.fillText).toHaveBeenCalledWith("Actual period", 16, 20);
  vi.restoreAllMocks();
});
