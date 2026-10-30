import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/ad-frame/[format]/route";
import { proxy } from "@/proxy";
import { ADSTERRA_FORMATS } from "./partnerAds";
import { adsterraSource } from "./partnerAdFrame";
import { ADSTERRA_FRAME_ORIGIN } from "./adsterraHost.mjs";
import { SITE_URL } from "./routeMap";

const host = new URL(ADSTERRA_FRAME_ORIGIN).host;
const response = (format, requestHost = host, query = "") => GET(
  new Request(`${ADSTERRA_FRAME_ORIGIN}/ad-frame/${format}${query}`, { headers: { host: requestHost } }),
  { params: Promise.resolve({ format }) },
);

describe("isolated Adsterra document", () => {
  it.each(Object.keys(ADSTERRA_FORMATS))("serves only issued %s on its fixed separate origin", async format => {
    const res = await response(format);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(ADSTERRA_FORMATS[format].key);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(res.headers.get("content-security-policy")).toContain(`frame-ancestors ${SITE_URL} https://www.${new URL(SITE_URL).hostname}; sandbox`);
    expect(new URL(adsterraSource(format)).origin).not.toBe(SITE_URL);
  });

  it.each([new URL(SITE_URL).host, `www.${new URL(SITE_URL).host}`, "localhost", "preview.up.railway.app", `${host}.evil.example`])("never runs SDK on %s", async wrongHost => {
    const res = await response("compact", wrongHost);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("script");
  });

  it.each(["constructor", "__proto__", "unknown"])("rejects unissued format %s", async format => {
    expect((await response(format)).status).toBe(404);
    expect(adsterraSource(format)).toBeNull();
  });

  it("rejects user parameters and preserves ordinary Railway redirects", async () => {
    expect((await response("compact", host, "?name=private")).status).toBe(404);
    const frameRequest = new NextRequest(adsterraSource("compact"), { headers: { host } });
    expect(proxy(frameRequest).headers.get("location")).toBeNull();
    const pageRequest = new NextRequest(`${ADSTERRA_FRAME_ORIGIN}/start`, { headers: { host } });
    expect(proxy(pageRequest).headers.get("location")).toBe(`${SITE_URL}/start`);
  });
});
