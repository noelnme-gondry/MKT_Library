import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import AnalysisFinder from "./AnalysisFinder";
import { finderCards, finderFamilies, finderSituations } from "@/lib/finder/analysisFinder";
import { groupToolsByFile } from "@/lib/dataSources";

// 분석 찾기 — 홈 목록·/start·분석 방법 둘러보기·/data-guide를 합친 화면(product-ssot §1.1c).
// 옛 HomeToolFinder의 검색·저장·파일 표시 계약을 그대로 옮겨 지킨다.
describe("analysis finder", () => {
  beforeEach(() => window.localStorage.clear());

  it.each(["ko", "en"])("shows every analysis as a card with the file it needs, grouped by situation (%s)", (locale) => {
    const en = locale === "en";
    const { container } = render(<AnalysisFinder locale={locale} />);
    const cards = finderCards(locale);
    expect(container.querySelectorAll(".finder-card")).toHaveLength(cards.length);
    expect(container.querySelectorAll(".analysis-finder__group")).toHaveLength(7);
    const first = container.querySelector(`.finder-card[data-tool-id="${cards[0].id}"]`);
    expect(first.querySelector("h3").textContent).toBe(cards[0].name);
    expect(first.querySelector(".finder-card__data").textContent).toContain(cards[0].source.file);
    expect(within(first).getByRole("link", { name: en ? "View example report" : "예시 보고서 보기" }).getAttribute("href")).toBe(cards[0].exampleHref);
    expect(within(first).getByRole("link", { name: en ? /^Use my file/ : /^내 파일로 하기/ }).getAttribute("href")).toBe(`${en ? "/en" : ""}${cards[0].href}`);
    // 예시가 없는 카드는 지어내지 않고 보고서에 담기는 것을 보여 준다.
    const plain = cards.find((card) => !card.example && card.outputs.length);
    const plainNode = container.querySelector(`.finder-card[data-tool-id="${plain.id}"] .finder-card__result`);
    expect(plainNode.querySelector("span").textContent).toBe(en ? "What the report shows" : "보고서에 담기는 것");
    expect(plainNode.textContent).toContain(plain.outputs[0]);
    // 결론 예시는 예시 데이터로 계산한 문장일 때만 "예시 결론"이라 부른다.
    const withExample = cards.find((card) => card.example);
    const exampleCard = container.querySelector(`.finder-card[data-tool-id="${withExample.id}"] .finder-card__result`);
    expect(exampleCard.textContent).toContain(withExample.example);
    expect(exampleCard.querySelector("span").textContent).toBe(en ? "Example conclusion" : "예시 결론");
    // 파란 주 버튼을 카드마다 두지 않는다 — 이 화면의 주 행동은 파일 놓기 하나다.
    expect(container.querySelectorAll(".finder-card .btn.primary")).toHaveLength(0);
    if (en) expect(/[가-힣]/.test(container.querySelector(".analysis-finder").textContent)).toBe(false);
  });

  it("filters to one situation and back to all", () => {
    const { container } = render(<AnalysisFinder />);
    const budget = finderSituations("ko").find((item) => item.id === "budget");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(budget.title) }));
    expect(screen.getByRole("button", { name: new RegExp(budget.title) }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelectorAll(".finder-card")).toHaveLength(budget.count);
    expect(window.location.search).toContain("situation=budget");
    fireEvent.click(screen.getByRole("button", { name: /전체 보기/ }));
    expect(container.querySelectorAll(".finder-card")).toHaveLength(finderCards("ko").length);
    expect(window.location.search).not.toContain("situation=");
  });

  it("opens on the situation given by the address", () => {
    const { container } = render(<AnalysisFinder initialSituation="proof" />);
    expect(container.querySelectorAll(".analysis-finder__group")).toHaveLength(1);
    expect(container.querySelector(".analysis-finder__group h2").textContent).toContain(finderSituations("ko").find((item) => item.id === "proof").title);
  });

  it.each(["ko", "en"])("searches by file source and keeps saved analyses across visits (%s)", (locale) => {
    const en = locale === "en";
    const { container, unmount } = render(<AnalysisFinder locale={locale} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "App Store Connect" } });
    const storeCards = finderCards(locale).filter((card) => card.source.where.includes("App Store Connect"));
    expect(storeCards.length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".finder-card")).toHaveLength(storeCards.length);
    // 검색 결과는 상황이 섞이므로 카드에 상황을 적는다.
    expect(container.querySelector(".finder-card__situation").textContent).toContain(storeCards[0].situation.title);
    const target = storeCards[0];
    fireEvent.click(screen.getByRole("button", { name: `${en ? "Save" : "저장"}: ${target.name}` }));
    unmount();
    const again = render(<AnalysisFinder locale={locale} />);
    fireEvent.click(screen.getByRole("button", { name: en ? /Saved analyses/ : /저장한 분석/ }));
    expect(again.container.querySelectorAll(".finder-card")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: `${en ? "Save" : "저장"}: ${target.name}` }));
    expect(again.container.querySelectorAll(".finder-card")).toHaveLength(0);
    expect(screen.getByText(en ? "No saved analyses yet." : "아직 저장한 분석이 없습니다.")).toBeTruthy();
  });

  it("restores the full list after clearing an empty search", () => {
    const { container } = render(<AnalysisFinder />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-such-tool-xyz" } });
    expect(screen.getByText(/맞는 분석이 없습니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "검색 지우기" }));
    expect(screen.getByRole("searchbox").value).toBe("");
    expect(container.querySelectorAll(".finder-card")).toHaveLength(finderCards("ko").length);
  });

  it("reports storage failures without claiming success", () => {
    render(<AnalysisFinder />);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    fireEvent.click(screen.getAllByRole("button", { name: /^저장:/ })[0]);
    expect(screen.getByRole("alert").textContent).toContain("저장하지 못했습니다");
    spy.mockRestore();
  });

  it.each(["ko", "en"])("keeps the old data guide inside 'how to prepare' (%s)", (locale) => {
    const en = locale === "en";
    render(<AnalysisFinder locale={locale} />);
    const card = finderCards(locale).find((item) => item.id === "5-23");
    const cardNode = document.querySelector('.finder-card[data-tool-id="5-23"]');
    fireEvent.click(within(cardNode).getByRole("button", { name: en ? "How to prepare" : "준비 방법" }));
    const dialog = screen.getByRole("dialog", { name: en ? `How to prepare · ${card.name}` : `준비 방법 · ${card.name}` });
    expect(within(dialog).getByRole("table", { name: en ? "Required data and its use" : "필요한 데이터와 쓰임" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: en ? "Download blank CSV" : "빈 CSV 양식 받기" })).toBeTruthy();
    // 5-23은 비교 방식마다 필요한 데이터가 다르다 — 방식 선택이 창 안에 남아 있다.
    const methods = within(dialog).getByRole("group", { name: en ? "How will you compare?" : "어떤 방식으로 비교하나요?" });
    const buttons = within(methods).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    fireEvent.click(buttons[1]);
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    expect(within(dialog).getByRole("link", { name: en ? "Use my file" : "내 파일로 하기" }).className).toContain("primary");
    if (en) expect(/[가-힣]/.test(dialog.textContent)).toBe(false);
  });

  it.each(["ko", "en"])("picks by file type: groups the analyses by the file they read, and a situation releases it (%s)", (locale) => {
    const en = locale === "en";
    window.history.replaceState(null, "", "/start");
    const { container } = render(<AnalysisFinder locale={locale} />);
    const commerce = finderFamilies(locale).find((family) => family.id === "commerce");
    const nav = screen.getByRole("navigation", { name: en ? "Which files do you have?" : "어떤 파일을 갖고 계세요?" });
    const button = within(nav).getByRole("button", { name: new RegExp(commerce.name) });
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(window.location.search).toContain("file=commerce");
    expect(container.querySelectorAll(".finder-card")).toHaveLength(commerce.count);
    // 파일별 묶음: 소제목이 파일 이름이다(같은 파일을 쓰는 분석은 한 묶음).
    const files = groupToolsByFile(finderCards(locale).filter((card) => card.source?.familyId === "commerce").map((card) => card.id), locale);
    expect([...container.querySelectorAll(".analysis-finder__group-head h2")].map((node) => node.textContent)).toEqual(files.map((file) => file.source.file));
    // 상황을 고르면 파일 종류는 풀린다 — 둘을 겹쳐 빈 목록을 만들지 않는다.
    const budget = finderSituations(locale).find((item) => item.id === "budget");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(budget.title.replace(/[?]/g, "\\?")) }));
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(window.location.search).not.toContain("file=");
    expect(container.querySelectorAll(".finder-card")).toHaveLength(budget.count);
  });

  it("opens on the file type given by the address", () => {
    const { container } = render(<AnalysisFinder initialFamily="store" />);
    expect(container.querySelectorAll(".finder-card")).toHaveLength(finderFamilies("ko").find((family) => family.id === "store").count);
  });
});
