// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserMappingSettings from "./UserMappingSettings";
import { accountRequest } from "@/lib/account/accountClient";
import { CANONICAL_FIELDS } from "@/lib/data-import/schema/canonicalFields";
vi.mock("@/lib/account/accountClient", () => ({ accountRequest: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); accountRequest.mockResolvedValue({ accountId: "a", rules: [], enabled: true, canApply: true }); });
afterEach(cleanup);
it.each(["ko", "en"])("keeps the mapping draft when saving fails (%s)", async locale => {
  accountRequest.mockImplementation(async (path, options) => { if (options?.method) throw new Error("WRITE_FAILED"); return { accountId: "a", rules: [], enabled: true, canApply: true }; });
  render(<UserMappingSettings locale={locale} accountId="a" />);
  await screen.findByText(locale === "en" ? "No saved mappings yet." : "아직 저장한 매핑이 없습니다.");
  const source = screen.getByRole("textbox", { name: locale === "en" ? "Enter manually" : "직접 입력" });
  const field = screen.getByRole("combobox", { name: locale === "en" ? "Field this tool uses" : "이 도구가 쓰는 항목" });
  const key = Object.keys(CANONICAL_FIELDS)[0];
  fireEvent.change(source, { target: { value: "my_column" } });
  fireEvent.change(field, { target: { value: key } });
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Add" : "추가", exact: true }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/저장하지 못|Could not save/));
  expect(source.value).toBe("my_column");
  expect(field.value).toBe(key);
});
it.each(["ko", "en"])("reports unreadable storage instead of an empty mapping list (%s)", async locale => {
  accountRequest.mockRejectedValue(new Error("READ_FAILED"));
  render(<UserMappingSettings locale={locale} accountId="a" />);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/불러오지 못|Could not load/));
  expect(screen.queryByText(locale === "en" ? "No saved mappings yet." : "아직 저장한 매핑이 없습니다.")).toBeNull();
});
