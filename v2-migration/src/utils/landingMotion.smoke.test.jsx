// @vitest-environment jsdom
//
// 랜딩이 "자리는 차지하는데 보이지 않는" 상태로 남는 실패 모드를 고정한다.
// 초기 숨김(`is-motion-armed`)은 동기로 걸리는데 anime 청크는 비동기로 온다 —
// 그 프라미스가 **거부되지 않고 지연·중단**되면(느린 모바일 회선에서 흔하다)
// catch가 잡을 것이 없고 콘텐츠는 영영 투명하게 남는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadAnimeMock } = vi.hoisted(() => ({ loadAnimeMock: vi.fn() }));

vi.mock("@/utils/motion", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, loadAnime: loadAnimeMock };
});

import { runLandingMotion } from "@/utils/landingMotion";
import { MOTION } from "@/utils/motion";

function mountLanding() {
  const root = document.createElement("div");
  root.className = "decision-console-landing";
  document.body.appendChild(root);
  return root;
}

beforeEach(() => {
  vi.useFakeTimers();
  loadAnimeMock.mockReset();
  document.body.innerHTML = "";
  // 모션 축소가 켜져 있으면 arming 자체가 없어 검사가 무의미해진다 — 끈 상태로 고정.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("landing entrance motion never hides content permanently", () => {
  it("shows the landing when the anime chunk never settles", () => {
    loadAnimeMock.mockReturnValue(new Promise(() => {})); // 영원히 대기
    const root = mountLanding();

    const cleanup = runLandingMotion(root);
    expect(root.classList.contains("is-motion-armed")).toBe(true);

    vi.advanceTimersByTime(MOTION.armBudget + 1);
    // 예산을 넘기면 연출을 버리고 콘텐츠를 보여준다.
    expect(root.classList.contains("is-motion-armed")).toBe(false);
    cleanup();
  });

  it("shows the landing when the anime chunk fails to load", async () => {
    loadAnimeMock.mockResolvedValue(null);
    const root = mountLanding();

    const cleanup = runLandingMotion(root);
    await vi.waitFor(() => expect(root.classList.contains("is-motion-armed")).toBe(false));
    cleanup();
  });

  it("does not re-hide the landing when a slow chunk arrives after the budget", async () => {
    let resolveAnime;
    loadAnimeMock.mockReturnValue(new Promise((resolve) => { resolveAnime = resolve; }));
    const root = mountLanding();

    const cleanup = runLandingMotion(root);
    vi.advanceTimersByTime(MOTION.armBudget + 1);
    expect(root.classList.contains("is-motion-armed")).toBe(false);

    // 늦게 도착한 모션이 화면을 다시 흔들면 안 된다.
    const animate = vi.fn();
    resolveAnime({ animate, createTimeline: () => ({ add: vi.fn() }), stagger: () => 0 });
    await vi.waitFor(() => expect(root.classList.contains("is-motion-armed")).toBe(false));
    expect(animate).not.toHaveBeenCalled();
    cleanup();
  });

  it("keeps the budget short enough that a reader never waits on choreography", () => {
    // 값이 아니라 상한을 고정한다 — 늘리면 그만큼 빈 화면을 보는 시간이 길어진다.
    expect(MOTION.armBudget).toBeLessThanOrEqual(1000);
  });
});
