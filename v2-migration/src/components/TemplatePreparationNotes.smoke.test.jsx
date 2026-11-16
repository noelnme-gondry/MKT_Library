import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import TemplatePreparationNotes from "./TemplatePreparationNotes";
import { TEMPLATE_PAGES } from "@/lib/templateCatalog";
import { getToolGuide } from "@/utils/toolGuide";

afterEach(cleanup);
it.each(["ko", "en"])("shows row grain and preparation for every published template (%s)", (locale) => {
  for (const { toolId } of TEMPLATE_PAGES) {
    const guide = getToolGuide(toolId, locale);
    expect(guide, toolId).toBeTruthy();
    const view = render(<TemplatePreparationNotes toolId={toolId} locale={locale} />);
    expect(view.container.textContent, toolId).toContain(guide.grain);
    expect(view.container.querySelectorAll("li").length, toolId).toBeGreaterThan(0);
    view.unmount();
  }
});
