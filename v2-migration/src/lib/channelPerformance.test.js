import { describe, expect, it } from "vitest";
import { analyzeDiagnosis } from "./campaignDiagnosis";
import { compareChannelPerformance, scanChannelPairs } from "./channelPerformance";
import { addDays } from "./budgetPlanner/plannerStats";

const start = "2026-09-07";
const row = (index,channel,cost,result,budget) => ({date:addDays(start,index*7),channel,cost,result,budget});
function history(rows,options={}) { return analyzeDiagnosis(rows,{grain:"weekly",...options}).channelPerformance; }
const budgets = [100,120,120,140,140,160,160];
const results = [10,8,10,7,9,6,8];
const sample = budgets.flatMap((b,i) => [row(i,"A",100,10,b),row(i,"B",100,results[i],50)]);
describe("directional channel comparisons",() => {
  it("compares raised vs non-raised weeks, distinguishes source setting from spend and direction",() => {
    const [a,b]=history(sample).channels;
    const study=compareChannelPerformance(a,b,"budget");
    expect(study.increased).toEqual({weeks:3,efficiencyWeeks:3,worse:3,fewer:3});
    expect(study.other).toEqual({weeks:3,efficiencyWeeks:3,worse:0,fewer:0});
    expect(compareChannelPerformance(b,a,"budget").increased.weeks).toBe(0);
    expect(compareChannelPerformance(a,b,"cost").increased.weeks).toBe(0);
  });
  it("preserves genuine zero outcomes, excludes missing counts and keeps target spend as a sensitivity filter",() => {
    const [a,b]=history(sample.map(r => r.channel!=="B" ? r : {...r,
      result:r.date===start ? 0 : r.date===addDays(start,14) ? null : r.date===addDays(start,35) ? 0 : r.result,
      cost:r.date===addDays(start,21) ? 300 : 100})).channels;
    const all=compareChannelPerformance(a,b,"budget");
    expect(all.events).toHaveLength(4);
    expect(all.increased).toMatchObject({weeks:2,efficiencyWeeks:1,worse:1});
    expect(compareChannelPerformance(a,b,"budget",true).events).toHaveLength(3);
  });
  it("requires real channels, common scope and consecutive weeks, respects the end date",() => {
    expect(history(sample.map(r => ({...r,campaign:r.channel,channel:null}))).reason).toBe("channels");
    expect(history(sample,{supplementalScopeHeld:true}).reason).toBe("scope");
    const withGap=sample.filter(r => r.date!==addDays(start,14));
    const [a,b]=history(withGap,{periods:{previous:{start,end:addDays(start,6)},current:{start:addDays(start,21),end:addDays(start,27)}}}).channels;
    expect(compareChannelPerformance(a,b,"budget").events.map(e=>e.end)).toEqual([addDays(start,13)]);
  });
  it("aggregates complete daily weeks and counts repeated campaign budgets once, withholding conflicting settings",() => {
    const rows=[];
    for(let day=0;day<21;day++){
      for(const [campaign,budget] of [["c1",100],["c1",day===20?999:100],["c2",day>=7?200:100]]){
        rows.push({date:addDays(start,day),channel:"A",campaign,cost:20,result:1,budget});
      }
      if(day!==17)rows.push({date:addDays(start,day),channel:"B",cost:40,result:day<7?2:1});
    }
    const [a,b]=history(rows,{grain:"daily"}).channels;
    expect(a.points.map(p=>p.budget)).toEqual([200,300,null]);
    const {events}=compareChannelPerformance(a,b,"budget");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({from:200,to:300,before:{cost:280,result:14},after:{cost:280,result:7}});
  });
});

describe("automatic pair scan", () => {
  it("ranks all six directions and reports the pooled CPA and mean outcome changes", () => {
    const historyRows = sample.concat(budgets.map((_,i) => row(i,"C",200+i,5,null)));
    const {channels} = history(historyRows);
    const pairs = scanChannelPairs(channels);
    expect(pairs).toHaveLength(6);
    expect(new Set(pairs.map(p => p.source+"→"+p.target)).size).toBe(6);
    expect(pairs.every(p => p.source!==p.target)).toBe(true);
    const ab=pairs[0];
    expect(ab).toMatchObject({source:"A",target:"B",exposure:"budget",raised:{weeks:3,sourceChange:20}});
    expect(ab.raised.cpaChange).toBeCloseTo(300/21-300/29,8);
    expect(ab.raised.resultChange).toBeCloseTo(-8/3,8);
    expect(ab.raised.cpaRate).toBeCloseTo(29/21-1,8);
    expect(pairs.find(p=>p.source==="C" && p.target==="A").exposure).toBe("cost");
    expect(pairs.find(p=>p.source==="B" && p.target==="A").raised.cpaChange).toBeNull();
    const events=compareChannelPerformance(channels[0],channels[1],"budget").events;
    expect(events[0]).toMatchObject({sourceCost:100,from:100,to:120,before:{cost:100,result:10},after:{cost:100,result:8}});
  });
  it("keeps total outcome loss without inventing a CPA or a zero for unobserved weeks", () => {
    const {channels}=history([row(0,"A",10,1,40),row(1,"A",15,1,80),row(0,"B",70,7,null),row(1,"B",50,0,null)]);
    const [pair]=scanChannelPairs(channels);
    expect(pair.raised).toMatchObject({weeks:1,cpaChange:null,cpaRate:null,lostAll:true,resultChange:-7,resultRate:-1});
    expect(scanChannelPairs(channels,"auto",true).find(p=>p.source==="A").raised).toMatchObject({weeks:0,resultChange:null});
  });
});
