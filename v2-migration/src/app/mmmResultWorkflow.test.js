import fs from "node:fs";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const marketingResponse = fs.readFileSync(new URL("../components/tools/MarketingResponse.jsx", import.meta.url), "utf8");
const webRPanel = fs.readFileSync(new URL("../components/tools/WebRMmmAdvanced.jsx", import.meta.url), "utf8");
const randomForestPanel = fs.readFileSync(new URL("../components/tools/WebRRandomForestPanel.jsx", import.meta.url), "utf8");

describe("MMM result workflow UI contract", () => {
  it("recreates Bayesian charts when the selected result model changes", () => {
    expect(marketingResponse).toMatch(/\[stage, mmmResultModel, mmm,/);
    expect(marketingResponse).toContain('mmmResultModel === "bayesian"');
    expect(marketingResponse).toContain("Chart.getChart?.(canvas)?.resize()");
  });

  it("uses a defined accessible model switch instead of an unstyled stat-card button", () => {
    expect(webRPanel).toContain('className="mmm-model-switcher" role="radiogroup"');
    expect(webRPanel).toContain('role="radio" aria-checked={selectedModel === "bayesian"}');
    expect(webRPanel).not.toMatch(/<button[^>]+className=\{`stat-card/);
    expect(randomForestPanel).toContain('className="mmm-model-switcher" role="radiogroup"');
    expect(randomForestPanel).not.toMatch(/<button[^>]+className=\{`stat-card/);
    expect(css).toMatch(/\.mmm-model-switcher\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.mmm-model-switcher\s*\{\s*grid-template-columns:\s*1fr;/);
  });

  it("keeps the WebR workflow in fit-to-decision order in both languages", () => {
    ["실제 성과를 얼마나 설명했나", "무엇이 성과를 설명했나", "채널 효과는 검증에서도 유지됐나", "지출을 바꾸면 예측이 어떻게 달라지나", "예산 변경을 추천해도 안전한가"].forEach((copy) => expect(webRPanel).toContain(copy));
    ["How much of actual performance did the model explain?", "What explained performance?", "Did channel effects persist across validation windows?", "How does prediction change when spend changes?", "Is a budget change safe enough to recommend?"].forEach((copy) => expect(webRPanel).toContain(copy));
    expect(webRPanel.indexOf("{T.fitStep}")).toBeLessThan(webRPanel.indexOf("{T.driverStep}"));
    expect(webRPanel.indexOf("{T.driverStep}")).toBeLessThan(webRPanel.indexOf("{T.responseStep}"));
    expect(webRPanel.indexOf("{T.responseStep}")).toBeLessThan(webRPanel.indexOf("{T.budgetStep}"));
  });

  it("gives Bayesian the same five-question result flow as WebR", () => {
    ["실제 성과를 얼마나 설명했나", "무엇이 성과를 설명했나", "채널 효과는 검증에서도 유지됐나", "지출을 바꾸면 예측이 어떻게 달라지나", "예산 변경을 추천해도 안전한가"].forEach((copy) => expect(marketingResponse).toContain(copy));
    ["How much of actual performance did the model explain?", "What explained performance?", "Did channel effects persist across validation?", "How does prediction change when spend changes?", "Is a budget change safe enough to recommend?"].forEach((copy) => expect(marketingResponse).toContain(copy));
    expect(marketingResponse).toContain('data-mmm-result-model="bayesian"');
    expect(marketingResponse.indexOf("<WebRMmmAdvanced")).toBeLessThan(marketingResponse.indexOf('data-mmm-result-model="bayesian"'));
    expect(marketingResponse.match(/<canvas ref=\{fitRef\}/g)).toHaveLength(1);
    expect(marketingResponse).not.toContain("WebR Elastic-net 결과를 보고 있습니다");
    expect(css).toMatch(/data-mmm-flow-step="fit"\]\s*\{\s*order:\s*1/);
    expect(css).toMatch(/data-mmm-flow-step="drivers"\]\s*\{\s*order:\s*2/);
    expect(css).toMatch(/data-mmm-flow-step="coefficients"\]\s*\{\s*order:\s*3/);
    expect(css).toMatch(/data-mmm-flow-step="response"\]\s*\{\s*order:\s*4/);
    expect(css).toMatch(/data-mmm-flow-step="decision"\]\s*\{\s*order:\s*5/);
  });

  it("shows one Bayesian response channel at a time with an explicit selected state", () => {
    expect(marketingResponse).toContain('className="mmm-channel-selector" role="group"');
    expect(marketingResponse).toContain("aria-pressed={effectiveBayesianResponseChannel?.key === channel.key}");
    expect(marketingResponse).toContain("setBayesianResponseChannel(channel.key)");
    expect(marketingResponse).not.toContain("satHidden");
    expect(marketingResponse).not.toContain("saturationCurveView");
  });
});
