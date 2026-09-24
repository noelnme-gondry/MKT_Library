"use client";

import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { scheduleDataPrepFocus } from "@/components/DemoNoticeModal";
import { trackProductEvent } from "@/lib/analytics";

// 시안 E — 블로그 예시 결과에서 도구로 넘어온 방문의 첫 줄.
// 데모 안내 모달·유입 설문 대신 "무엇을 보고 있고 어디서 왔는지"를 한 줄로 말하고,
// 두 갈래(내 CSV로 바꾸기 · 글로 돌아가기)만 둔다. 상자·라벨 없이 본문과 같은 가장자리.
// 도구 쪽에서 내 파일을 새로 올리면(fileName이 달라지면) 이 줄은 사실이 아니므로 사라진다.
export function blogArrivalState(arrival, routeId, csvData) {
  if (!arrival || arrival.toolId !== routeId) return null;
  if (arrival.source === "none") return "none";
  if (!csvData?.fileName || csvData.fileName !== arrival.fileName) return null;
  return arrival.source === "demo" ? "demo" : "csv";
}

export default function BlogArrivalStrip({ routeId, locale = "ko" }) {
  const en = locale === "en";
  const arrival = useAppStore((s) => s.blogArrival);
  const csvData = useAppStore((s) => s.csvData);
  const clearCsvGroup = useAppStore((s) => s.clearCsvGroup);
  const setBlogArrival = useAppStore((s) => s.setBlogArrival);
  const state = blogArrivalState(arrival, routeId, csvData);
  if (!state) return null;
  const href = `${en ? "/en" : ""}/blog/${arrival.slug}`;
  const title = arrival.title;
  const lead = state === "demo"
    ? (en ? `Example data from “${title}”.` : `「${title}」의 예시 데이터로 연 결과입니다.`)
    : state === "csv"
      ? (en ? `Your CSV from “${title}”.` : `「${title}」에서 고른 내 CSV로 연 결과입니다.`)
      : (en ? `Opened from “${title}”.` : `「${title}」에서 열었습니다.`);
  const useMine = async () => {
    trackProductEvent("blog_arrival_action", { content_slug: arrival.slug, content_type: "blog", tool_id: routeId, placement: "blog_arrival", state: "use_my_csv", locale });
    setBlogArrival(null);
    await clearCsvGroup();
    scheduleDataPrepFocus();
  };
  return <div className="blog-arrival" role="note" aria-label={en ? "Where this result came from" : "이 결과의 출처"}>
    <p className="blog-arrival__text">{lead}</p>
    <div className="blog-arrival__actions">
      {state === "demo" && <button type="button" className="btn primary" onClick={useMine}>{en ? "Use my CSV" : "내 CSV로 바꾸기"}</button>}
      <Link className="blog-arrival__back" href={href} onClick={() => trackProductEvent("blog_arrival_action", { content_slug: arrival.slug, content_type: "blog", tool_id: routeId, placement: "blog_arrival", state: "back_to_article", locale })}>{en ? "Back to the article" : "글로 돌아가기"}</Link>
    </div>
  </div>;
}
