import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { SITE_URL } from "@/lib/routeMap";

describe("RSS channel metadata", () => {
  it("publishes a canonical feed URL and business contact", async () => {
    const response = GET();
    const xml = await response.text();
    expect(response.headers.get("content-type")).toContain("application/rss+xml");
    expect(xml).toContain(`xmlns:atom="http://www.w3.org/2005/Atom"`);
    expect(xml).toContain(`href="${SITE_URL}/rss.xml" rel="self"`);
    expect(xml).toContain("<managingEditor>gondry.montauk@gmail.com (Growth Opt Playbook)</managingEditor>");
    expect(xml).toContain("<webMaster>gondry.montauk@gmail.com (Growth Opt Playbook)</webMaster>");
    const lastBuildDate = xml.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/)?.[1];
    expect(new Date(lastBuildDate).getTime()).toBeGreaterThanOrEqual(new Date("2026-07-29T00:00:00Z").getTime());
  });
});
