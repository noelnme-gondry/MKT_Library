"use client";

import { useEffect } from "react";

const HEADING_SELECTOR = "h1,h2,h3,h4,[data-chart-title]";

function nearestHeadingText(element) {
  const section = element.closest("section,article,[role='region'],.card,.chart-card,.summary") || element.parentElement;
  const heading = section?.querySelector(HEADING_SELECTOR);
  return heading?.textContent?.trim() || "";
}

function localLabel(kind, heading) {
  const isEnglish = document.documentElement.lang?.toLowerCase().startsWith("en");
  if (heading) return isEnglish ? `${heading} ${kind}` : `${heading} ${kind === "chart" ? "차트" : "데이터 표"}`;
  if (kind === "chart") return isEnglish ? "Analysis result chart" : "분석 결과 차트";
  return isEnglish ? "Analysis result table" : "분석 결과 데이터 표";
}

function enhanceCanvas(canvas) {
  if (!canvas.hasAttribute("role")) canvas.setAttribute("role", "img");
  if (!canvas.hasAttribute("aria-label") && !canvas.hasAttribute("aria-labelledby")) {
    canvas.setAttribute("aria-label", localLabel("chart", nearestHeadingText(canvas)));
  }
}

function enhanceTable(table) {
  if (!table.hasAttribute("aria-label") && !table.hasAttribute("aria-labelledby") && !table.querySelector("caption")) {
    table.setAttribute("aria-label", localLabel("table", nearestHeadingText(table)));
  }
  table.querySelectorAll("thead th:not([scope])").forEach((cell) => cell.setAttribute("scope", "col"));
  table.querySelectorAll("tbody th:not([scope])").forEach((cell) => cell.setAttribute("scope", "row"));
}

function enhanceToggle(button) {
  if (button.hasAttribute("aria-selected") || button.hasAttribute("aria-checked")) return;
  if (button.hasAttribute("aria-pressed") && !button.hasAttribute("data-ui-semantics-toggle")) return;
  button.setAttribute("data-ui-semantics-toggle", "true");
  button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
}

function enhance(root) {
  const scope = root instanceof Element ? root : document;
  if (scope.matches?.("canvas")) enhanceCanvas(scope);
  if (scope.matches?.("table")) enhanceTable(scope);
  if (scope.matches?.("button.ab-pill")) enhanceToggle(scope);
  scope.querySelectorAll?.("canvas").forEach(enhanceCanvas);
  scope.querySelectorAll?.("table").forEach(enhanceTable);
  scope.querySelectorAll?.("button.ab-pill").forEach(enhanceToggle);
}

export default function UiSemantics() {
  useEffect(() => {
    const content = document.getElementById("main-content");
    if (!content) return undefined;
    enhance(content);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") enhance(mutation.target);
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) enhance(node);
        });
      });
    });
    observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return null;
}
