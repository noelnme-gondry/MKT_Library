import { getSopLastModified } from "@/lib/sopEditorial";

// sitemap의 lastmod는 페이지에 실제 반영된 최종 검수/기능 변경일만 기록한다.
// 새 도구·가이드의 공개 내용을 바꾸면 같은 PR에서 이 표도 갱신한다.
const TOOL_LAST_MODIFIED = {
  "5-2": "2026-08-05",
  "5-3": "2026-08-09",
  "5-4": "2026-08-01",
  "5-18": "2026-08-08",
  "5-18-paid-organic": "2026-08-08",
  "5-18-trend": "2026-08-08",
  "5-18-cannibal": "2026-08-08",
  "5-18-mmm": "2026-08-08",
  "5-18-forecast": "2026-08-08",
  "5-20": "2026-08-04",
  "5-21": "2026-08-07",
  "5-22": "2026-08-04",
  "5-23": "2026-08-04",
  "5-24": "2026-08-05",
  "5-25": "2026-08-09",
  "5-27": "2026-08-18",
  "5-28": "2026-08-21",
  "5-26": "2026-08-09",
  "9-1": "2026-08-05",
  "9-6": "2026-08-04",
};

export function getPublicRouteLastModified(routeId) {
  return TOOL_LAST_MODIFIED[routeId] || getSopLastModified(routeId) || null;
}
