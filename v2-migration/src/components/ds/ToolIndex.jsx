"use client";
import React from "react";
import Link from "next/link";
import { toolIndexByStage } from "@/lib/toolIndex";
import { localizedHref } from "@/lib/localizedHref";

/**
 * ToolIndex — "무엇을 할 수 있나"를 한 화면에 펴는 목록.
 *
 * 도구가 17개인데 홈에서 이름이 보이는 건 4개뿐이었고, 나머지는 사이드바를
 * 열어야만 존재를 알 수 있었다. 같은 목록을 세 곳(홈·업로드 화면·전체 보기)에
 * 두되 **밀도만 다르게** 한다. 문장은 toolIndex 하나에서 나온다.
 *
 * density
 *   "compact" — 이름 + 질문 한 줄. 홈처럼 이미 내용이 많은 화면.
 *   "full"    — 질문 + 답 + 필요한 데이터. 업로드 화면·전체 보기.
 *
 * 정렬 축은 도구 이름이 아니라 **질문 단계**다. 마케터는 "무엇을 판단해야 하나"로
 * 도구를 찾지 도구 이름을 외워서 찾지 않는다.
 */
export default function ToolIndex({ locale = "ko", density = "full", eligibleIds = null, headingLevel = 3, onSelect = null, onItemClick = null }) {
  const stages = toolIndexByStage(locale);
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";
  const isCompact = density === "compact";

  return (
    <div className={`tool-index tool-index--${density}`}>
      {stages.map((stage) => (
        <section key={stage.id} className="tool-index__stage">
          <div className="tool-index__stage-head">
            <Heading className="tool-index__stage-title">{stage.title}</Heading>
            {!isCompact && <p className="tool-index__stage-desc">{stage.description}</p>}
          </div>
          <ul className="tool-index__list">
            {stage.tools.map((tool) => {
              // eligibleIds가 주어지면 지금 올린 CSV로 되는 것만 강조하고, 나머지는
              // 숨기지 않고 흐리게 둔다 — 숨기면 "무엇이 있는지" 자체를 못 본다.
              const ready = !eligibleIds || eligibleIds.includes(tool.id);
              return (
                <li key={tool.id} className={`tool-index__item${ready ? "" : " is-dim"}`}>
                  {/* onSelect가 있으면 그 쪽이 이긴다 — 업로드 화면에서는 올린 CSV를
                      대상 도구용으로 다시 매핑해 넘겨야 하고, 링크로 이동하면 그
                      핸드오프가 사라져 도구가 빈 상태로 열린다. */}
                  <Link
                    className="tool-index__link"
                    href={localizedHref(tool.href, locale)}
                    // onSelect는 이동을 가로채고(업로드 화면의 재매핑 핸드오프),
                    // onItemClick은 평범한 이동에 곁들이는 기록용이다.
                    onClick={onSelect
                      ? (event) => { event.preventDefault(); onSelect(tool.id); }
                      : onItemClick ? () => onItemClick(tool.id) : undefined}
                  >
                    <span className="tool-index__name">{tool.name}</span>
                    <span className="tool-index__q">{tool.question}</span>
                    {!isCompact && tool.needs.length > 0 && (
                      <span className="tool-index__needs">{tool.needs.join(" · ")}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
