import { describe, expect, it } from "vitest";
import { getAllPosts } from "@/lib/blog";
import { getAllTerms } from "@/lib/glossary";
import { EN_READY_GUIDE_IDS, EN_READY_TOOL_IDS, ROUTES } from "@/lib/routeMap";
import {
  SEARCH_INTENT_CLUSTERS,
  intentContentKey,
  intentHref,
  intentLinksFor,
} from "@/lib/searchIntentRegistry";

const koPosts = new Set(getAllPosts("ko").map((post) => post.slug));
const enPosts = new Set(getAllPosts("en").map((post) => post.slug));
const koTerms = new Set(getAllTerms("ko").map((term) => term.slug));
const enTerms = new Set(getAllTerms("en").map((term) => term.slug));
const routeIds = new Set(ROUTES.map((route) => route.id));
const enRouteIds = new Set([...EN_READY_GUIDE_IDS, ...EN_READY_TOOL_IDS]);

describe("search intent ownership", () => {
  it("keeps one unique primary URL per intent cluster", () => {
    const ids = SEARCH_INTENT_CLUSTERS.map((cluster) => cluster.id);
    const primaryKeys = SEARCH_INTENT_CLUSTERS.map((cluster) => intentContentKey(cluster.primary));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(primaryKeys).size).toBe(primaryKeys.length);
  });

  it("references only published KO and EN content", () => {
    for (const cluster of SEARCH_INTENT_CLUSTERS) {
      const refs = [cluster.primary, ...cluster.supports];
      expect(new Set(refs.map(intentContentKey)).size, cluster.id).toBe(refs.length);
      for (const ref of refs) {
        expect(ref.ko?.label, `${cluster.id} KO label`).toBeTruthy();
        expect(ref.en?.label, `${cluster.id} EN label`).toBeTruthy();
        if (ref.kind === "blog") {
          expect(koPosts.has(ref.id), `${cluster.id} KO blog ${ref.id}`).toBe(true);
          expect(enPosts.has(ref.id), `${cluster.id} EN blog ${ref.id}`).toBe(true);
        } else if (ref.kind === "glossary") {
          expect(koTerms.has(ref.id), `${cluster.id} KO glossary ${ref.id}`).toBe(true);
          expect(enTerms.has(ref.id), `${cluster.id} EN glossary ${ref.id}`).toBe(true);
        } else {
          expect(routeIds.has(ref.id), `${cluster.id} route ${ref.id}`).toBe(true);
          expect(enRouteIds.has(ref.id), `${cluster.id} EN route ${ref.id}`).toBe(true);
        }
        expect(intentHref(ref, "ko")).toMatch(/^\//);
        expect(intentHref(ref, "en")).toMatch(/^\/en\//);
      }
    }
  });

  it("puts the primary answer first when linking from supporting content", () => {
    const links = intentLinksFor("blog", "cannibalization-organic-paid", "ko");
    expect(links[0]).toMatchObject({
      clusterId: "cannibalization",
      role: "definition",
      href: "/glossary/cannibalization",
    });
  });

  it("does not return the current page as its own related link", () => {
    for (const cluster of SEARCH_INTENT_CLUSTERS) {
      for (const ref of [cluster.primary, ...cluster.supports]) {
        const currentHref = intentHref(ref, "ko");
        const hrefs = intentLinksFor(ref.kind, ref.id, "ko").map((link) => link.href);
        expect(hrefs).not.toContain(currentHref);
        expect(new Set(hrefs).size).toBe(hrefs.length);
      }
    }
  });
});
