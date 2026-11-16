import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import FinderExampleFigure from "./FinderExampleFigure";
import { finderCards } from "@/lib/finder/analysisFinder";

describe("finder figures", () => {
  it.each(["ko", "en"])("renders every published preview with readable values and bounded geometry (%s)", locale => {
    const cards = finderCards(locale).filter(card => card.preview);
    expect(cards.length).toBeGreaterThan(20);
    const kinds = new Set();
    for (const { preview } of cards) {
      kinds.add(preview.kind);
      const view = render(<FinderExampleFigure preview={preview} locale={locale} />);
      const figure = view.getByRole("figure", { name: preview.title });
      expect(figure.textContent).toContain(locale === "en" ? "Fictional data" : "가상 데이터");
      for (const row of preview.rows) expect(figure.textContent).toContain(row.display);
      for (const bar of figure.querySelectorAll("i[style]")) {
        if (bar.style.width) {
          expect(parseFloat(bar.style.width)).toBeGreaterThanOrEqual(0);
          expect(parseFloat(bar.style.width)).toBeLessThanOrEqual(100.000001);
        }
        if (bar.style.left) {
          expect(parseFloat(bar.style.left)).toBeGreaterThanOrEqual(0);
          expect(parseFloat(bar.style.left)).toBeLessThanOrEqual(100.000001);
        }
      }
      if (preview.kind === "counts") {
        expect(figure.querySelectorAll(".finder-preview__count-grid i")).toHaveLength(63);
        expect(figure.querySelectorAll('.finder-preview__count-grid i[data-primary="true"]')).toHaveLength(30);
      }
      if (locale === "en") expect(/[가-힣]/.test(figure.textContent)).toBe(false);
      view.unmount();
    }
    expect([...kinds].sort()).toEqual(["bars", "budget", "counts", "intervals", "metric", "parts", "range"]);
  });
});
