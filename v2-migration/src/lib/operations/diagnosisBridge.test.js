import { describe, it, expect } from "vitest";
import { buildOperationsDemo } from "./operationsDemo";
import { analyzeDiagnosis } from "../campaignDiagnosis";
import { campaignExecutionInput, readPlannerDiagnosis } from "./diagnosisBridge";

describe("planner source continuity", () => {
  it("compares the exact guide periods using the same confirmed channel and denominator", () => {
    const csv = buildOperationsDemo();
    const {rows,meta} = readPlannerDiagnosis(csv,{channels:new Set(["Meta"])},"actions","day","ko");
    const periods={previous:{start:"2026-09-23",end:"2026-09-29"},current:{start:"2026-09-30",end:"2026-10-06"}};
    const report=analyzeDiagnosis(rows,{...meta,periods});
    const expected=csv.raw.filter(row=>row.Channel==="Meta" && row.Date>=periods.current.start && row.Date<=periods.current.end);
    expect(report.current.result).toBe(expected.reduce((sum,row)=>sum+row.Actions,0));
    expect(report.channels.map(row=>row.name)).toEqual(["Meta"]);
    expect(campaignExecutionInput(rows,meta).rows.reduce((sum,row)=>sum+row.actions,0)).toBe(rows.reduce((sum,row)=>sum+row.result,0));
    expect(analyzeDiagnosis(rows,{...meta,periods:{previous:periods.current,current:periods.current}}).status).toBe("insufficient");
  });
  it("keeps an unreported outcome and withholds a campaign plan for an unsupported unit", () => {
    const csv=buildOperationsDemo();
    csv.raw[0].Installs="";
    const {rows,meta}=readPlannerDiagnosis(csv,{},"installs","day","en");
    expect(rows[0].result).toBeNull();
    expect(campaignExecutionInput(rows,meta)).toBeNull();
    expect(campaignExecutionInput(rows.slice(1),{...meta,resultLabel:"purchases"})).toBeNull();
  });
});
