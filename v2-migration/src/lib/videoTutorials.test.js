import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { VIDEO_TUTORIALS, tutorialIdsForPath, tutorialMedia, TUTORIAL_STEP_SECONDS } from "./videoTutorials";
import { ROUTES, isRoutePublished } from "./routeMap";
import { TOOL_GROUP } from "./toolGroups";

describe("video tutorial publishing contract", () => {
  it("covers every published CSV route in both languages", () => {
    const routes = ROUTES.filter(route => isRoutePublished(route) && TOOL_GROUP[route.id]);
    expect(routes.length).toBeGreaterThan(15);
    for (const route of routes) for (const prefix of ["", "/en"]) {
      const ids = tutorialIdsForPath(`${prefix}${route.slug}`);
      expect(ids, route.slug).toContain("mapping");
      expect(ids, route.slug).toContain("import");
      for (const id of ids) expect(VIDEO_TUTORIALS.some(item => item.id === id)).toBe(true);
    }
  });
  it("selects relevant workflows and keeps reading pages unobstructed", () => {
    expect(tutorialIdsForPath("/dashboard")[0]).toBe("dashboard");
    expect(tutorialIdsForPath("/en/weekly-review")[0]).toBe("review");
    expect(tutorialIdsForPath("/weekly-review", { projectManagement: true })[0]).toBe("projects");
    expect(tutorialIdsForPath("/dashboard", { mapping: true })[0]).toBe("mapping");
    expect(tutorialIdsForPath("/blog/cac-payback-period")).toEqual([]);
  });
  it("ships real localized media and aligned captions for every topic", () => {
    expect(new Set(VIDEO_TUTORIALS.map(item => item.id)).size).toBe(VIDEO_TUTORIALS.length);
    for (const item of VIDEO_TUTORIALS) for (const locale of ["ko", "en"]) {
      const media = tutorialMedia(item.id, locale);
      for (const url of Object.values(media)) expect(existsSync(path.join(process.cwd(), "public", url.split("?")[0])), url).toBe(true);
      const video = readFileSync(path.join(process.cwd(), "public", media.video.split("?")[0]));
      expect(video.subarray(4, 8).toString()).toBe("ftyp");
      const captions = readFileSync(path.join(process.cwd(), "public", media.captions.split("?")[0]), "utf8");
      expect(captions.startsWith("WEBVTT\n")).toBe(true);
      expect(item.steps.length * TUTORIAL_STEP_SECONDS).toBe(24);
      for (const step of item.steps) {
        expect(captions).toContain(step[locale].title);
        expect(captions).toContain(step[locale].body);
      }
    }
  });
});
