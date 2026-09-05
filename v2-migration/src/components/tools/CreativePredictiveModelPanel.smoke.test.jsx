// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import CreativePredictiveModelPanel from "@/components/tools/CreativePredictiveModelPanel";

function creativeFixture() {
  return Array.from({ length: 73 }, (_, index) => ({
    creative_id: `creative_${index + 1}`,
    channel: index % 4 < 2 ? "Meta" : "Google",
    hook_type: ["question", "proof", "offer"][index % 3],
    format: index % 2 ? "video" : "static",
    impressions: 10000 + index * 31,
    clicks: 280 + (index % 11) * 17,
    ctr: 0.025 + (index % 13) * 0.001,
  }));
}

describe("CreativePredictiveModelPanel smoke", () => {
  it("withholds RF and SVM honestly when the creative-level sample and production features are insufficient", () => {
    render(<CreativePredictiveModelPanel
      metrics={creativeFixture()}
      attributes={["hook_type", "format"]}
      metric="ctr"
      mappedKeys={new Set(["creative_id", "channel", "hook_type", "format", "impressions", "clicks"])}
      signature="demo-73"
    />);

    expect(screen.getByRole("heading", { name: /예측 모델 비교와 설명력 분해/ })).toBeTruthy();
    expect(screen.getByText("73")).toBeTruthy();
    expect(screen.getAllByText("데이터 기준 미달")).toHaveLength(2);
    expect(screen.getByText(/SVM은 독립 소재/)).toBeTruthy();
    expect(screen.getByText(/개별 소재 SHAP 값이나 인과 기여도가 아닙니다/)).toBeTruthy();
    expect(screen.queryByText(/동일 검증 성능/)).toBeNull();
  });

  it("keeps the same eligibility disclosure in English", () => {
    render(<CreativePredictiveModelPanel
      metrics={creativeFixture()}
      attributes={["hook_type", "format"]}
      metric="ctr"
      mappedKeys={new Set(["creative_id", "channel", "hook_type", "format", "impressions", "clicks"])}
      signature="demo-73-en"
      locale="en"
    />);

    expect(screen.getByRole("heading", { name: /Predictive model comparison/ })).toBeTruthy();
    expect(screen.getAllByText("Below data threshold")).toHaveLength(2);
    expect(screen.getByText(/not per-creative SHAP or causal contribution/)).toBeTruthy();
  });
});

// 화면이 "5-fold"라고 단정하고 있었는데 엔진은 표본 크기에 따라 3~5겹을 고른다
// (min(5, max(3, floor(n/30)))). 값을 그대로 단언하면 다음 변경에서 가드가 버그를 지키므로,
// 근거인 R 코드에서 파생해 문구와 대조한다.
describe("교차검증 겹 수 표기", () => {
  const readFoldRule = (path) => {
    const source = readFileSync(path, "utf8");
    const match = source.match(/fold_count <- min\((\d+)L, max\((\d+)L/);
    expect(match, `${path}에서 fold 규칙을 찾지 못했습니다`).toBeTruthy();
    return { max: Number(match[1]), min: Number(match[2]) };
  };

  it("RF와 SVM이 같은 겹 규칙을 쓴다", () => {
    const rf = readFoldRule("src/lib/analysis/webr/randomForest.js");
    const svm = readFoldRule("src/lib/analysis/webr/svm.js");
    expect(rf).toEqual(svm);
  });

  it("실행 중 문구가 엔진의 겹 범위와 일치하고, 고정 숫자로 단정하지 않는다", () => {
    const { min, max } = readFoldRule("src/lib/analysis/webr/randomForest.js");
    const source = readFileSync("src/components/tools/CreativePredictiveModelPanel.jsx", "utf8");
    const ko = source.match(/running: "(같은[^"]+)"/)[1];
    const en = source.match(/running: "(Comparing[^"]+)"/)[1];

    expect(ko).toContain(`${min}~${max}겹`);
    expect(en).toMatch(/between three and five/);
    // 겹 수가 하나로 고정된 것처럼 말하는 표현은 금지 — 이번 수정의 원인이다.
    for (const copy of [ko, en]) {
      expect(copy).not.toMatch(/5-fold|five-fold|5겹 교차검증/);
    }
  });

  it("결과가 오면 실제 겹 수를 화면에 쓴다", () => {
    const source = readFileSync("src/components/tools/CreativePredictiveModelPanel.jsx", "utf8");
    // 엔진이 반환하는 folds를 실제로 읽어 표시까지 배선했는지(계산만 하고 안 쓰는 신호 방지).
    expect(source).toMatch(/const foldCount = Number\(rf\?\.folds \|\| svm\?\.folds\)/);
    expect(source).toMatch(/C\.folds\(foldCount\)/);
  });
});
