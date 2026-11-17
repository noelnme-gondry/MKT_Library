import { beforeEach, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { activePro } from "@/test/proEntitlement";
import { bindAlertRule } from "@/lib/performance-alerts/rules";
import PerformanceAlertNotice from "./PerformanceAlertNotice";
beforeEach(() => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: activePro(), decisionPersistenceEnabled: true, projectsReady: true });
  const data = { fileName: "test.csv", importSource: "csv", currency: "KRW", headers: ["Date", "Cost", "Installs"], mapping: { Date: "date", Cost: "cost", Installs: "installs" }, raw: [{ Date: "2026-08-01", Cost: 100, Installs: 10 }] };
  useAppStore.getState().setCurrentRouteId("5-31"); useAppStore.getState().setCsvData(data); useAppStore.getState().setGroupAnalyzed("5-31");
  const rule = bindAlertRule({ name: "Test condition", metric: "cpr", basis: "installs", channel: "", days: 7, comparison: "previous", direction: "up", percent: 20, target: 100 }, data, "rule");
  useAppStore.setState({ projects: [{ id: "default", name: "Test project", performanceAlerts: [rule] }] });
});
for (const locale of ["ko", "en"]) it(`opens the canonical alert workspace without the management alias redirect (${locale})`, () => {
  render(<PerformanceAlertNotice locale={locale} />);
  expect(screen.getByRole("link", { name: locale === "en" ? "Review conditions" : "조건 확인" }).getAttribute("href")).toBe(`${locale === "en" ? "/en" : ""}/weekly-review#performance-alerts`);
});
