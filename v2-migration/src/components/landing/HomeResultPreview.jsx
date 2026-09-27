import { useMemo } from "react";
import Image from "next/image";
import { compareSamplePerformance } from "@/utils/sampleSpendPreview";
import { buildDemoCsv } from "@/utils/demoData";

// The preview and its launch button use the same deterministic sample source.

export default function HomeResultPreview({ locale, onTrySample }) {
  const result = useMemo(() => compareSamplePerformance(buildDemoCsv("efficiency").raw), []);
  const en = locale === "en";
  const money = value => `${Math.round(value).toLocaleString(en ? "en-US" : "ko-KR")} ${en ? "KRW" : "원"}`;
  const percent = value => value == null ? (en ? "Unavailable" : "추정 불가") : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
  // 결과 화면과 같은 범위(유료 채널 전체)를 보여 준다 — 샘플을 누르면 이 숫자 그대로 이어진다.
  const lead = result && { ...result, channel: en ? `${result.channels.length} paid channels` : `유료 채널 ${result.channels.length}개 합계` };
  if (!lead || !Number.isFinite(lead.prior.cpa) || !Number.isFinite(lead.recent.cpa) || !(lead.cpaChange > 0)) return null;
  return <aside className="home-result-preview home-result-preview--comparison" aria-label={en ? "Sample analysis preview" : "샘플 분석 미리보기"}>
    <h2>{en ? "Cost per conversion rose" : "전환당 비용이 올랐습니다"}</h2>
    <p className="home-sample-context">{en ? "Fictional data" : "가상 데이터"} · {lead.channel}</p>
    <table className="home-sample-table">
      <caption className="sr-only">{en ? "Cost per conversion by period, KRW" : "기간별 전환당 비용, 원"}</caption>
      <tbody>{["prior", "recent"].map((period, index) => <tr key={period}>
        <th scope="row">{index === 0 ? (en ? "Previous 7 days" : "이전 7일") : (en ? "Latest 7 days" : "최근 7일")}
          <span><time dateTime={result.dates[index * 7]}>{result.dates[index * 7]}</time> – <time dateTime={result.dates[index * 7 + 6]}>{result.dates[index * 7 + 6].slice(5)}</time></span>
        </th>
        <td>{money(lead[period].cpa)}</td>
      </tr>)}</tbody>
    </table>
    <div className="home-sample-change">
      <dl><dt>{en ? "CPA change" : "CPA 변화"}</dt><dd>{percent(lead.cpaChange)}</dd></dl>
      <Image src="/assets/dochi/dochi-present-results.png" width={86} height={86} alt={en ? "Dochi presenting the comparison" : "비교 결과를 안내하는 도치"} />
    </div>
    <p className="home-sample-context">{en ? "CPA = ad spend ÷ key actions" : "CPA = 광고비 ÷ 핵심행동 수"}</p>
    {/* 홈에서는 바로 옆 히어로 버튼이 같은 샘플을 연다 — 같은 버튼을 두 번 두지 않는다(2026-09-24). */}
    {onTrySample && <button type="button" className="ab-button" onClick={onTrySample}>{en ? "Explore a sample" : "샘플로 체험하기"} →</button>}
  </aside>;
}
