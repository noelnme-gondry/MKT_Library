"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { MARKETING_ANALYSIS_TASKS } from "@/lib/marketingAnalysisHub";
import { idToPath } from "@/lib/routeMap";
import CalculatorWorkbench from "@/components/calculators/CalculatorWorkbench";
import AnalysisEntryLink from "@/components/seo/AnalysisEntryLink";
import { fmtNum } from "@/utils/format";

// The server passes only these public, engine-verified examples, never a user's CSV.
export default function MarketingAnalysisPreview({ examples, locale = "ko" }) {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const [selectedChannel, setSelectedChannel] = useState(0);
  const en = locale === "en", prefix = en ? "/en" : "";
  const task = MARKETING_ANALYSIS_TASKS[selected], copy = task[locale];
  const example = examples[task.slug];
  const isVariance = selected === 0;
  const bars = example?.bars || [];
  const maximum = isVariance ? Math.ceil(Math.max(...bars.map(bar => bar.value)) / 50) * 50 : Math.ceil(Math.max(1, ...bars.map(bar => bar.value)));
  const minimum = isVariance ? Math.floor(Math.min(0, ...bars.map(bar => bar.value)) / 50) * 50 : 0;
  const position = value => (value - minimum) / (maximum - minimum) * 100;
  const format = value => fmtNum(value, isVariance ? 0 : 2);
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  const channel = bars[selectedChannel] || bars[0];
  const signed = value => `${value > 0 ? "+" : ""}${format(value)}`;
  const ticks = [...new Set(isVariance ? [minimum, 0, maximum / 2, maximum] : [0, 1, maximum])];
  return <section id="analysis-examples" className="analysis-preview" aria-label={en ? "Explore a marketing analysis example" : "마케팅 분석 예시 살펴보기"}>
    <div className="analysis-preview__questions" role="group" aria-label={en ? "Choose your question" : "확인할 질문 선택"}>
      {MARKETING_ANALYSIS_TASKS.map((item, index) => <button key={item.slug} type="button" aria-pressed={selected === index} aria-controls="analysis-preview-result" onClick={() => { setSelected(index); setSelectedChannel(0); }}>
        {item[locale].question}
      </button>)}
    </div>
    <div id="analysis-preview-result" className="analysis-preview__result" role="region" aria-labelledby="analysis-preview-title">
      <div className="analysis-preview__heading"><span>{task.calculator ? (en ? "Enter your totals" : "합계 직접 입력") : (en ? "Public synthetic example" : "공개 합성 데이터 예시")}</span></div>
      <h2 id="analysis-preview-title">{task.calculator ? (en ? "What does my ROAS actually mean?" : "내 ROAS는 어떤 숫자인가요?") : isVariance ? (en ? "Which channel accounts for the cost increase?" : "어느 채널에서 단가가 올랐을까요?") : (en ? "Does a good average justify more budget?" : "평균 효율이 좋으면 더 써도 될까요?")}</h2>
      {task.calculator ? <CalculatorWorkbench slug={task.calculator} locale={locale} showToolLink={false} entry={{ type: "compare", slug: "marketing-analysis", placement: "analysis_preview" }} /> : <>
        <div className="analysis-preview__evidence">
          <div className="analysis-preview__finding">
            <span>{isVariance ? (en ? "Overall change in cost per install" : "전체 설치당 비용 변화") : (en ? "Estimated marginal / average CPI" : "추정 한계 CPI / 평균 CPI")}</span>
            <strong>{isVariance ? signed(total) : format(channel.value)}<small>{isVariance ? (en ? " KRW" : "원") : "×"}</small></strong>
            <div className="analysis-preview__channel" aria-live="polite" aria-atomic="true">
              <h3>{channel.label[locale]}</h3>
              <p>{isVariance
                ? (en ? `Contributes ${signed(channel.value)} KRW to the overall change. Inspect its mix and within-channel efficiency to understand the breakdown.` : `전체 변화에서 이 채널의 몫은 ${signed(channel.value)}원입니다. 채널 구성과 내부 효율을 나눠 보면 변화를 더 구체적으로 읽을 수 있습니다.`)
                : (en ? "The estimated cost of additional installs exceeds the observed average. Check response uncertainty before increasing spend." : "추가 설치의 추정 단가가 관측 평균보다 높습니다. 증액 전에 반응 추정의 불확실성을 함께 확인해야 합니다.")}</p>
            </div>
            <p className="analysis-preview__interaction">{en ? "Select a channel in the chart to inspect it." : "그래프의 채널을 선택해 비교해 보세요."}</p>
          </div>
          <figure className="analysis-preview__chart">
            <figcaption>{isVariance ? (en ? "Contribution to overall CPI change · KRW" : "전체 CPI 변화에 대한 채널별 기여 · 원") : (en ? "Estimated marginal / average CPI · multiples" : "추정 한계 CPI / 평균 CPI · 배")}</figcaption>
            <ul aria-label={en ? "Channel evidence" : "채널별 근거"}>{bars.map((bar, index) => <li key={bar.label.en}>
              <button type="button" aria-pressed={selectedChannel === index} aria-label={en ? `Inspect ${bar.label.en}` : `${bar.label.ko} 확인`} aria-describedby={`${id}-value-${index}`} onClick={() => setSelectedChannel(index)}>
              <span className="analysis-preview__bar-label"><span>{bar.label[locale]}</span><strong id={`${id}-value-${index}`}>{isVariance && bar.value > 0 ? "+" : ""}{format(bar.value)}{isVariance ? "" : "×"}</strong></span>
              <span className="analysis-preview__track" aria-hidden="true">
                <span className="analysis-preview__reference" style={{ left: `${position(isVariance ? 0 : 1)}%` }} />
                <span className={`analysis-preview__bar${selectedChannel === index ? " is-highlight" : ""}`} style={{ left: `${position(Math.min(0, bar.value))}%`, width: `${Math.abs(bar.value) / (maximum - minimum) * 100}%` }} />
              </span>
              </button>
            </li>)}</ul>
            <div className="analysis-preview__axis" aria-hidden="true">{ticks.map(tick => <span key={tick} style={{ left: `${position(tick)}%` }}>{format(tick)}</span>)}</div>
            <p>{isVariance ? (en ? "Right of zero: raises overall CPI. Left: lowers it." : "0 오른쪽은 전체 단가를 올린 몫, 왼쪽은 낮춘 몫입니다.") : (en ? "The dotted line is 1×: marginal cost equals average cost." : "점선 1배는 한계 단가와 평균 단가가 같은 기준입니다.")}</p>
          </figure>
        </div>
        <p className="analysis-preview__caption">{example[locale].caption}{isVariance && (en ? " Values and changes are rounded independently to whole KRW." : " 전후 값과 변화량은 각각 원 단위로 반올림해 표시합니다.")}</p>
      </>}
      <div className="analysis-preview__next">
        <div><h3>{en ? "Bring the same question to your data" : "같은 질문을 내 데이터에 적용하려면"}</h3><p>{copy.needs}</p><p className="analysis-preview__limit">{task.calculator ? (en ? "Attributed revenue is neither profit nor incremental revenue." : "귀속 매출은 이익이나 광고의 순증 매출과 다릅니다.") : isVariance ? (en ? "This decomposition describes observed changes; it does not establish their cause." : "관측 변화를 분해한 결과이며, 변화의 인과적 원인을 확정하지 않습니다.") : (en ? "A saturation estimate is not an optimal allocation or a guaranteed future result." : "포화도 추정은 최적 배분안이나 미래 성과를 보장하지 않습니다.")}</p></div>
        <div className="analysis-preview__actions">
          <AnalysisEntryLink key={task.slug} href={`${prefix}${idToPath(task.toolId)}`} toolId={task.toolId} locale={locale}>{copy.action}</AnalysisEntryLink>
          <Link href={`${prefix}/blog/${task.slug}#blog-practice`}>{en ? "Read the example and review steps" : "예제와 점검 순서 읽기"}</Link>
        </div>
      </div>
    </div>
  </section>;
}
