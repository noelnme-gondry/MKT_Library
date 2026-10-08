import { expect, test } from "@playwright/test";
import { legacyBlogTagRedirects } from "../src/lib/blogTags.mjs";
import { idToSlug, OG_CARD_URL } from "../src/lib/routeMap";

test("retired search URLs redirect once to an existing topic, tool or image", async ({ request }) => {
  const tags = legacyBlogTagRedirects();
  const cases = [
    ...["iOS", "MMM", "커리어·성장", "AI·자동화"].map(tag => {
      const source = `/blog/tag/${encodeURIComponent(tag)}`;
      return [source, tags.find(rule => rule.source === source).destination, "text/html"];
    }),
    ["/en/blog/tag/Budget-Allocation", "/en/blog", "text/html"],
    ...["", "/en"].flatMap(prefix => [
      [`${prefix}/tools/experiment`, `${prefix}${idToSlug["5-4"]}`, "text/html"],
      [`${prefix}/tools/vif-diagnosis`, `${prefix}${idToSlug["5-25"]}`, "text/html"],
      [`${prefix}/blog/offline-ad-online-impact/opengraph-image`, new URL(OG_CARD_URL).pathname, "image/png"],
      [`${prefix}/blog/retargeting-reengagement-guide/opengraph-image-kabnh0?b21e0d1ca6dc202e`, new URL(OG_CARD_URL).pathname, "image/png"],
    ]),
    ["/og/tool/5-26", new URL(OG_CARD_URL).pathname, "image/png"],
    ["/og/tool/5-29", new URL(OG_CARD_URL).pathname, "image/png"],
  ];
  for (const [source, destination, mime] of cases) {
    const response = await request.get(source, { maxRedirects: 0 });
    expect(response.status(), source).toBe(308);
    const location = new URL(response.headers().location, response.url());
    expect(location.pathname, source).toBe(destination);
    const terminal = await request.get(location.href, { maxRedirects: 0 });
    expect(terminal.status(), source).toBe(200);
    expect(terminal.headers()["content-type"], source).toContain(mime);
  }
  const unknown = await request.get("/blog/tag/not-a-real-topic", { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
});
