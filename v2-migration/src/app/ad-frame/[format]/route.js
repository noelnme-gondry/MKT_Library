import { adsterraDocument } from "@/lib/partnerAdFrame";
import { ADSTERRA_FRAME_SANDBOX, isAdsterraFrameHost } from "@/lib/adsterraHost.mjs";
import { SITE_URL } from "@/lib/routeMap";

// A document endpoint, not a public app page: no shell, user input, analytics or SEO entry.
export async function GET(request, { params }) {
  const { format } = await params;
  const html = isAdsterraFrameHost(request.headers.get("host")) && !new URL(request.url).search
    ? adsterraDocument(format) : null;
  return new Response(html || "Not found", {
    status: html ? 200 : 404,
    headers: {
      "Content-Type": html ? "text/html; charset=utf-8" : "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "origin",
      "Content-Security-Policy": html
        ? `frame-ancestors ${SITE_URL} https://www.${new URL(SITE_URL).hostname}; sandbox ${ADSTERRA_FRAME_SANDBOX}`
        : "frame-ancestors 'none'; sandbox",
    },
  });
}
