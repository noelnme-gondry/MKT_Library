// User-requested search entries, not a claim of whole-site coverage.
// Parse the HTTP response without executing scripts: rendered browser text is a separate check.
import fs from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";

const base = process.argv[2] || "http://localhost:3215";
const output = process.argv[3];
const toolPaths = ["/tools/budget-allocation", "/tools/campaign-variance", "/tools/mmm-contribution"];
const discovered = [
  "/blog/asa-keyword-expansion", "/blog/brand-campaign-lift", "/blog/cac-payback-period",
  "/blog/marketing-report-sheets-bigquery", "/blog/simpson-paradox-conversion-rate", "/blog/user-churn-survival-analysis",
  "/compare/csv-upload-vs-api-connector", "/glossary/arpu", "/glossary/mmm", "/glossary/retargeting",
  "/templates/segment-composition-change", "/templates/subscription-survival",
];
const editorial = ["/glossary/cac", "/glossary/incrementality", "/glossary/uplift", "/glossary/holdout-test", "/blog/performance-marketing-metrics", "/blog/cannibalization-organic-paid"];
const publicPaths = [...toolPaths, ...discovered, ...editorial];
const privatePaths = ["/projects", "/dochi-result", "/weekly-review", "/weekly-report", "/share"];
const paths = [...new Set(["/", "/blog", "/glossary", "/templates", "/compare", ...publicPaths, ...publicPaths.map(p => `/en${p}`), ...privatePaths, ...privatePaths.map(p => `/en${p}`)])];
const failures = [];
const records = [];
for (let start = 0; start < paths.length; start += 6) {
  const batch = await Promise.all(paths.slice(start, start + 6).map(async pathname => {
    const response = await fetch(new URL(pathname, base));
    const html = await response.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const main = doc.querySelector("main");
    const readableMain = main?.cloneNode(true);
    // JSON-LD and embedded scripts are source code, not readable body copy.
    readableMain?.querySelectorAll("script, style, template").forEach(node => node.remove());
    const mainText = (readableMain?.textContent || "").replace(/\s+/g, " ").trim();
    const canonical = doc.querySelector('link[rel="canonical"]')?.href || null;
    const robots = [...doc.querySelectorAll('meta[name="robots"]')].map(node => node.content).join("; ");
    const plainPath = pathname.replace(/^\/en(?=\/)/, "");
    const isPrivate = privatePaths.includes(plainPath);
    const check = (condition, reason) => { if (!condition) failures.push(`${pathname}: ${reason}`); };
    check(response.status === 200, `HTTP ${response.status}`);
    if (publicPaths.includes(plainPath)) {
      check(canonical === `https://growthoptplaybook.com${pathname}`, "canonical mismatch");
      check(!/noindex/i.test(`${robots} ${response.headers.get("x-robots-tag") || ""}`), "public noindex");
      check(mainText.length > 300, "missing initial main text");
    }
    if (isPrivate) {
      check(/noindex/i.test(`${robots} ${response.headers.get("x-robots-tag") || ""}`), "private route lacks noindex");
      check(!doc.querySelector(".tool-longform"), "public method text on private result");
    }
    if (toolPaths.includes(plainPath)) {
      check(doc.querySelectorAll(".tool-longform").length === 1, "method section absent or duplicated");
      check(doc.querySelectorAll(".tool-longform__body h3").length >= 3, "missing purpose/method/limits");
      check(doc.querySelectorAll(".tool-longform__faq p").length >= 2, "missing visible FAQ");
      check(mainText.includes(pathname.startsWith("/en/") ? "Required data:" : "필요한 데이터:"), "missing input explanation");
    }
    if (plainPath.startsWith("/templates/") && discovered.includes(plainPath)) {
      check(Boolean(doc.querySelector("#template-preparation-heading")), "missing row-unit guidance");
    }
    const record = {
      path: pathname, fetchedAt: new Date().toISOString(), status: response.status,
      canonical, robots, xRobots: response.headers.get("x-robots-tag"),
      lang: doc.documentElement.lang, title: doc.title,
      description: doc.querySelector('meta[name="description"]')?.content || null,
      rawMainChars: mainText.length, mainText,
      links: [...doc.querySelectorAll("a[href]")].map(a => a.getAttribute("href")),
    };
    dom.window.close();
    return record;
  }));
  records.push(...batch);
}
const rootLinks = records.find(row => row.path === "/").links;
const discovery = discovered.map(url => ({
  path: url,
  linkedFromHomeInTwoSteps: records.filter(row => rootLinks.includes(row.path) && row.links.includes(url)).map(row => row.path),
}));
const report = { base, checkedAt: new Date().toISOString(), records, discovery, failures };
if (output) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ checked: records.length, failures, discovery, tools: records.filter(row => toolPaths.includes(row.path)).map(({ path, rawMainChars }) => ({ path, rawMainChars })) }, null, 2));
if (failures.length) process.exitCode = 1;
