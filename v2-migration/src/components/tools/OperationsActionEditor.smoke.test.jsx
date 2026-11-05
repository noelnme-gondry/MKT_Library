import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { confirmReviewSave } from "@/test/reviewSaveBoundary";
import { useAppStore } from "@/store/useDataStore";
import { readOperationAction } from "@/lib/operations/actionContract";
import OperationsActionEditor from "./OperationsActionEditor";

beforeEach(() => {
  useAppStore.setState({ ...useAppStore.getInitialState(), decisionPersistenceEnabled: false }, true);
});

it.each([
  ["ko", "KRW", "257,842", "309,411"],
  ["en", "KRW", "257,842", "309,411"],
  ["ko", "USD", "257,842.29", "309,410.57"],
  ["en", "USD", "257,842.29", "309,410.57"],
])("limits budget display precision without changing saved amounts (%s, %s)", async (locale, currency, beforeText, afterText) => {
  const en = locale === "en";
  const target = { unit: "campaign", channel: "Meta", campaign: "Budget test" };
  const beforeBudget = 257842.2857142857, afterBudget = 309410.5714285714;
  render(<OperationsActionEditor seed={{ kind: "budget", target, beforeBudget, afterBudget }}
    groups={[{ id: "budget-test", name: "Budget test", target }]} metric="installs" currency={currency}
    today="2026-11-05" sourceThrough="2026-11-04" locale={locale} isDemo={false} onClose={vi.fn()} />);
  const previous = screen.getByLabelText(en ? `Previous daily budget (${currency}, optional)` : `변경 전 하루 예산 (${currency}, 선택)`);
  const next = screen.getByLabelText(en ? `New daily budget (${currency})` : `변경 후 하루 예산 (${currency})`);
  expect(previous.value).toBe(beforeText);
  expect(next.value).toBe(afterText);
  for (const input of [previous, next]) {
    fireEvent.focus(input);
    fireEvent.blur(input);
  }
  expect(previous.value).toBe(beforeText);
  expect(next.value).toBe(afterText);
  fireEvent.click(screen.getByRole("button", { name: en ? "Save action" : "액션 저장" }));
  confirmReviewSave();
  await waitFor(() => expect(useAppStore.getState().decisionRecords).toHaveLength(1));
  expect(readOperationAction(useAppStore.getState().decisionRecords[0].operationAction)).toMatchObject({ beforeBudget, afterBudget, currency });
});
