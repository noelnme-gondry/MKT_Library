import { START_PAGE_COPY } from "@/lib/startPageCopy";

// 분석 모듈이나 searchParams가 준비되기 전에도 같은 목적·입력 안내를 제공한다.
export default function StartGateIntroduction({ locale = "ko", pending = false }) {
  const copy = START_PAGE_COPY[locale] || START_PAGE_COPY.ko;
  return <>
    <h1 className="page-title">{copy.title}</h1>
    <p className="page-deck">{copy.deck}</p>
    {pending && <p role="status">{locale === "en" ? "Loading workspace…" : "분석 화면을 준비하고 있습니다…"}</p>}
  </>;
}
