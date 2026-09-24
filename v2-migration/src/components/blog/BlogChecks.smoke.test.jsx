// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import BlogSelfCheck from "./BlogSelfCheck";
import BlogSituationCheck from "./BlogSituationCheck";
import { shouldShowReadingBar, READING_BAR_MIN_DEPTH } from "./BlogReadingBar";
import BlogArrivalStrip, { blogArrivalState } from "./BlogArrivalStrip";
import { useAppStore } from "@/store/useDataStore";
import { blogSelfCheckFor } from "@/lib/blogSelfCheck";
import { blogSituationCheckFor } from "@/lib/blogSituationCheck";
import { idToSlug } from "@/lib/routeMap";
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn(), trackProductEventOnce: vi.fn(), productEventKey: (...a) => a.join(":") }));

afterEach(cleanup);

describe("plan D — 30-second self-check", () => {
  it.each(["ko", "en"])("shows the %s verdict only after both questions are answered", (locale) => {
    const slug = "ios-att-skan-guide", en = locale === "en";
    const check = blogSelfCheckFor(slug, locale);
    render(<BlogSelfCheck slug={slug} locale={locale} />);
    expect(screen.getByRole("heading", { name: check.title })).toBeTruthy();
    const yes = screen.getAllByRole("button", { name: en ? "Yes" : "예" });
    fireEvent.click(yes[0]);
    expect(screen.queryByText(check.results.yy[0])).toBeNull();
    fireEvent.click(yes[1]);
    expect(screen.getByText(check.results.yy[0])).toBeTruthy();
    expect(yes[0].getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getAllByRole("button", { name: en ? "No" : "아니요" })[1]);
    expect(screen.getByText(check.results.yn[0])).toBeTruthy();
  });
  it("renders nothing for a post without a self-check", () => {
    const { container } = render(<BlogSelfCheck slug="ab-testing" />);
    expect(container.innerHTML).toBe("");
  });
});

describe("plan B — situation check at the end", () => {
  it.each(["ko", "en"])("answers the picked %s situation and links to its destination", (locale) => {
    const slug = "ad-performance-diagnosis", tool = "5-21", en = locale === "en";
    const check = blogSituationCheckFor(slug, tool, locale);
    render(<BlogSituationCheck slug={slug} toolId={tool} locale={locale} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios.every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);
    fireEvent.click(radios[1]);
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(check.options[1].answer)).toBeTruthy();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(`${en ? "/en" : ""}${idToSlug[check.options[1].tool]}`);
    fireEvent.keyDown(radios[1], { key: "ArrowDown" });
    expect(radios[2].getAttribute("aria-checked")).toBe("true");
  });
  it("uses the post's own question for a non-CSV post, not the dashboard question", () => {
    render(<BlogSituationCheck slug="ios-att-skan-guide" toolId="5-2" />);
    expect(screen.getByRole("heading", { name: blogSituationCheckFor("ios-att-skan-guide", "5-2").question })).toBeTruthy();
    expect(screen.queryByText("지금 설치당 비용(CPI·CPA)은 어떤가요?")).toBeNull();
  });
});

describe("plan C — reading bar visibility", () => {
  it("appears only past the minimum depth, hides while its target is visible, and stays closed once dismissed", () => {
    expect(shouldShowReadingBar({ depthPercent: READING_BAR_MIN_DEPTH - 1, targetVisible: false, dismissed: false })).toBe(false);
    expect(shouldShowReadingBar({ depthPercent: READING_BAR_MIN_DEPTH, targetVisible: false, dismissed: false })).toBe(true);
    expect(shouldShowReadingBar({ depthPercent: 80, targetVisible: true, dismissed: false })).toBe(false);
    expect(shouldShowReadingBar({ depthPercent: 80, targetVisible: false, dismissed: true })).toBe(false);
    expect(shouldShowReadingBar({ depthPercent: 90, targetVisible: false, dismissed: false, articleEnded: true })).toBe(false);
  });
});

describe("plan E — arrival strip", () => {
  const arrival = { slug: "ad-performance-diagnosis", title: "광고 성과 진단", toolId: "5-21", fileName: "demo_efficiency_ko.csv", source: "demo" };
  it("speaks only on the tool it opened and only while that file is still loaded", () => {
    expect(blogArrivalState(arrival, "5-21", { fileName: "demo_efficiency_ko.csv" })).toBe("demo");
    expect(blogArrivalState(arrival, "5-2", { fileName: "demo_efficiency_ko.csv" })).toBeNull();
    expect(blogArrivalState(arrival, "5-21", { fileName: "mine.csv" })).toBeNull();
    expect(blogArrivalState({ ...arrival, source: "csv", fileName: "mine.csv" }, "5-21", { fileName: "mine.csv" })).toBe("csv");
    expect(blogArrivalState({ ...arrival, source: "none", fileName: null }, "5-21", null)).toBe("none");
    expect(blogArrivalState(null, "5-21", null)).toBeNull();
  });
  it.each(["ko", "en"])("names the article and links back (%s)", (locale) => {
    const en = locale === "en";
    useAppStore.setState({ blogArrival: arrival, csvData: { fileName: arrival.fileName } });
    render(<BlogArrivalStrip routeId="5-21" locale={locale} />);
    expect(screen.getByText(new RegExp(arrival.title))).toBeTruthy();
    expect(screen.getByRole("button", { name: en ? "Use my CSV" : "내 CSV로 바꾸기" })).toBeTruthy();
    expect(screen.getByRole("link", { name: en ? "Back to the article" : "글로 돌아가기" }).getAttribute("href")).toBe(`${en ? "/en" : ""}/blog/${arrival.slug}`);
    useAppStore.setState({ blogArrival: null });
  });
});
