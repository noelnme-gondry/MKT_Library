// "내 데이터로 바꾸기" 뒤 업로드 자리로 포커스를 옮긴다. 예전 데모 안내 창에서 쓰던 것을
// 블로그 도착 줄 등이 함께 쓴다(안내 창은 결과를 덮어서 없앴다, 2026-09-24).
const DATA_PREP_TARGETS = [
  ".csv-dropzone",
  ".dropzone",
  "#dashboard-data-setup",
  "#s-prep",
  "[data-data-prep]",
  ".csv-uploader",
];

function focusDataPrepAfterRender() {
  if (typeof document === "undefined") return;
  const target = DATA_PREP_TARGETS.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!(target instanceof HTMLElement)) return;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView?.({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
  const hadTabIndex = target.hasAttribute("tabindex");
  const addedTabIndex = target.tabIndex < 0 && !hadTabIndex;
  if (addedTabIndex) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  if (addedTabIndex) {
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
}

export function scheduleDataPrepFocus() {
  if (typeof window === "undefined") return;
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => window.requestAnimationFrame(focusDataPrepAfterRender));
  } else {
    window.setTimeout(focusDataPrepAfterRender, 0);
  }
}
