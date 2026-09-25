"use client";
import React, { useId, useState } from "react";
import Link from "next/link";
import { toolIndexByStage } from "@/lib/toolIndex";
import { localizedHref } from "@/lib/localizedHref";
import { downloadTemplateCsv, hasToolTemplate } from "@/components/ds/csvTemplate";

/**
 * ToolIndex — "무엇을 할 수 있나"를 한 화면에 펴는 목록.
 *
 * 홈에서 이름이 보이는 도구가 4개뿐이었고, 나머지는 사이드바를
 * 열어야만 존재를 알 수 있었다. 같은 목록을 세 곳(홈·업로드 화면·전체 보기)에
 * 두되 **밀도만 다르게** 한다. 문장은 toolIndex 하나에서 나온다.
 *
 * density
 *   "compact" — 질문 + 도구명 + 결과. 홈처럼 이미 내용이 많은 화면.
 *   "full"    — 질문 + 답 + 도구명 + 결과 + 필요한 데이터. 전체 보기.
 *   "grid"    — 질문만 담은 버튼 격자 + 고른 하나의 상세. 업로드 화면.
 *               full은 도구 20개를 세로로 쌓아 4,600px이 됐다. 격자는 갈래마다
 *               한 줄(≤3개)이라 상세를 **그 줄 바로 아래**에 열어도 누른 버튼이
 *               움직이지 않는다 — 아래 §"갈래별 접기" 함정을 피하는 유일한 배치다.
 *
 * 정렬 축은 도구 이름이 아니라 **질문 단계**다. 마케터는 "무엇을 판단해야 하나"로
 * 도구를 찾지 도구 이름을 외워서 찾지 않는다.
 *
 * 갈래별 접기(<details>)는 뺐다 — 하나 펼 때마다 아래 갈래가 통째로 밀려서
 * 방금 본 도구가 어디 있었는지 매번 다시 찾아야 했다. 갈래가 2~3개짜리로
 * 고르게 나뉜 뒤로는 전부 펴 두는 게 더 짧고, 위치가 고정된다.
 */
export default function ToolIndex({ locale = "ko", density = "full", eligibleIds = null, blockedInfo = null, excludeIds = null, headingLevel = 3, onSelect = null, onItemClick = null, renderDetail = null, renderSummary = null, blockedCta = null, activeToolId, onActiveToolChange }) {
  const stages = toolIndexByStage(locale);
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";
  const isCompact = density === "compact";
  const labels = locale === "en"
    ? {
      tool: "Tool", outputs: "You get", needs: "Needs", open: "Open this analysis",
      readyGroup: "Ready with this file",
      readyDesc: "Select an analysis to inspect its result or required setup.",
      blockedGroup: "Needs more data or setup",
      blockedDesc: "Select an analysis to see the data and additional setup it needs.",
      blockedHint: "Add the missing columns above to your file, then upload it again.",
      missing: "Missing:",
      template: "⬇ Download a template with these columns",
      more: (n) => `+${n} more`,
      openAnyway: "Open anyway",
      needPrefix: "Needs:",
    }
    : {
      tool: "도구", outputs: "결과", needs: "필요 데이터", open: "이 분석 열기",
      readyGroup: "지금 이 파일로 되는 분석",
      readyDesc: "분석을 선택해 결과와 필요한 설정을 확인하세요.",
      blockedGroup: "추가 데이터·설정이 필요한 분석",
      blockedDesc: "분석을 선택하면 필요한 데이터와 추가 설정을 안내합니다.",
      blockedHint: "위 ‘필요 데이터’의 빠진 컬럼을 채워 다시 올리면 됩니다.",
      missing: "빠진 컬럼",
      template: "⬇ 이 컬럼이 들어간 템플릿 받기",
      more: (n) => `외 ${n}개`,
      openAnyway: "그래도 열어 보기",
      needPrefix: "필요:",
    };

  if (density === "grid") {
    return <ToolIndexGrid {...{ stages, locale, eligibleIds, blockedInfo, excludeIds, labels, Heading, onSelect, onItemClick, renderDetail, renderSummary, blockedCta, activeToolId, onActiveToolChange }} />;
  }

  return (
    <div className={`tool-index tool-index--${density}`}>
      {stages.map((stage) => (
        <section className="tool-index__stage" key={stage.id}>
          <div className="tool-index__stage-head">
            {stage.label && <span className="tool-index__stage-no">{stage.label.split("·")[0].trim()}</span>}
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
                    data-mobile-task=".tool-index__link"
                    href={localizedHref(tool.href, locale)}
                    // onSelect는 이동을 가로채고(업로드 화면의 재매핑 핸드오프),
                    // onItemClick은 평범한 이동에 곁들이는 기록용이다.
                    onClick={onSelect
                      ? (event) => { event.preventDefault(); onSelect(tool.id); }
                      : onItemClick ? () => onItemClick(tool.id) : undefined}
                  >
                    <span className="tool-index__q">{tool.question}</span>
                    {!isCompact && tool.answer && <span className="tool-index__answer">{tool.answer}</span>}
                    <span className="tool-index__meta">
                      <span className="tool-index__meta-label">{labels.tool}</span>
                      <span className="tool-index__name">{tool.name}</span>
                    </span>
                    {tool.outputs.length > 0 && (
                      <span className="tool-index__outputs">
                        <span className="tool-index__meta-label">{labels.outputs}</span>
                        <span>{tool.outputs.slice(0, isCompact ? 2 : tool.outputs.length).join(" · ")}</span>
                      </span>
                    )}
                    {!isCompact && tool.needs.length > 0 && (
                      <span className="tool-index__needs">
                        <span className="tool-index__meta-label">{labels.needs}</span>
                        <span>{tool.needs.join(" · ")}</span>
                      </span>
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

/**
 * 버튼 격자 + 고른 하나의 상세.
 *
 * **파일을 올렸으면 자격이 정렬 축이다.** "할 수 있는 분석"은 우리가 제공하는
 * 목록이 아니라 *지금 이 CSV로 바로 되는 것*을 뜻한다. 그래서 되는 것을 위에,
 * 안 되는 것을 아래에 "컬럼을 더 주면 되는 것"으로 묶는다. 판단 단계(갈래)는
 * 버튼 안의 작은 표식으로만 남긴다 — 파일이 없을 때는 자격을 모르므로 그때만
 * 갈래가 다시 정렬 축이 된다.
 *
 * 자격은 **글자로** 말한다. 예전에는 흐림(opacity)이 유일한 표식이었는데
 * `library-workspace.css`가 더 높은 특이도로 취소해 화면에 아무 차이가 없었다 —
 * 판정은 하는데 보이지 않는 상태였다(§7 "전역 규칙이 있어도 개별 규칙이 취소하면
 * 없는 것과 같다"). 묶음 제목과 글자는 취소당하지 않는다.
 *
 * 상세는 그 묶음의 격자 **바로 다음**에 둔다. 버튼 사이에 끼우면 누를 때마다
 * 뒤 버튼이 밀려 방금 본 것을 다시 찾게 된다(§12.31).
 */
function ToolIndexGrid({ stages, locale, eligibleIds, blockedInfo, excludeIds, labels, Heading, onSelect, onItemClick, renderDetail, renderSummary, blockedCta, activeToolId, onActiveToolChange }) {
  const [localOpenId, setLocalOpenId] = useState(null);
  const openId = activeToolId === undefined ? localOpenId : activeToolId;
  const setOpenId = onActiveToolChange || setLocalOpenId;
  const base = useId();
  // 지금 보고 있는 도구는 "이어서 볼 것"이 아니다. 목록에서 통째로 뺀다 —
  // 자격에서만 빼면 "안 되는 분석"으로 내려가 거짓말이 된다.
  const skip = new Set(excludeIds || []);
  const flat = stages.flatMap((stage) => stage.tools
    .filter((tool) => !skip.has(tool.id))
    .map((tool) => ({ ...tool, stage: stage.title })));
  const groups = eligibleIds
    ? [
      { id: "ready", title: labels.readyGroup, desc: labels.readyDesc, ready: true, tools: flat.filter((tool) => eligibleIds.includes(tool.id)) },
      { id: "blocked", title: labels.blockedGroup, desc: labels.blockedDesc, ready: false, tools: flat.filter((tool) => !eligibleIds.includes(tool.id)) },
    ].filter((group) => group.tools.length > 0)
    : stages
      .map((stage) => ({ id: stage.id, title: stage.title, desc: stage.description, label: stage.label, ready: null, tools: stage.tools.filter((tool) => !skip.has(tool.id)) }))
      .filter((group) => group.tools.length > 0);

  return (
    <div className="tool-index tool-index--grid">
      {groups.map((group) => {
        return (
          <section className={`tool-index__stage tool-index__stage--${group.id}`} key={group.id}>
            <div className="tool-index__stage-head">
              {group.label && <span className="tool-index__stage-no">{group.label.split("·")[0].trim()}</span>}
              <Heading className="tool-index__stage-title">
                {group.title}
                {group.ready !== null && <span className="tool-index__count">{group.tools.length}</span>}
              </Heading>
              {group.desc && <p className="tool-index__stage-desc">{group.desc}</p>}
            </div>
            <ul className="tool-index__grid">
              {group.tools.map((tool) => {
                const isOpen = openId === tool.id;
                return (
                  <React.Fragment key={tool.id}>
                  <li className={`tool-index__cell${group.ready === false ? " is-dim" : ""}`}>
                    <button
                      type="button"
                      className={`tool-index__chip${isOpen ? " is-open" : ""}`}
                      aria-expanded={isOpen}
                      aria-controls={isOpen ? `${base}-${tool.id}-panel` : undefined}
                      onClick={() => setOpenId(isOpen ? null : tool.id)}
                    >
                      <span className="tool-index__q">{tool.name}</span>
                      {group.ready !== false && renderSummary?.(tool.id)}
                      {/* 안 되는 분석은 컬럼 이름이 아니라 "어떤 값이 있어야 하는지" 한 문장으로 말한다.
                          예시 결과는 여기 두지 않는다 — 이 파일의 결과로 오해된다. */}
                      {group.ready === false && (blockedInfo?.[tool.id]?.reason
                        // 이 파일로 돌렸지만 판정을 못 낸 분석은 "필요한 데이터"가 틀린 말이다 — 엔진이 말한 사유를 쓴다.
                        ? <span className="tool-index__need">{blockedInfo[tool.id].reason}</span>
                        : tool.dataNeed && <span className="tool-index__need"><span>{labels.needPrefix}</span> {tool.dataNeed}</span>)}
                      {group.ready === false && blockedCta && <span className="tool-index__cta" aria-hidden="true">{blockedCta}</span>}
                      {/* 빠진 컬럼은 버튼에서 바로 읽힌다 — 눌러야만 보이면 15개를
                          하나씩 열어 봐야 "무엇을 채우면 몇 개가 열리는지" 알 수 있다. */}
                      {tool.stage && <span className="tool-index__stage-tag">{tool.stage}</span>}
                    </button>
                  </li>
                  {/* 상세는 누른 버튼 **다음 줄 전체**를 차지한다. 격자 밖(맨 아래)에
                      두면 15개짜리 묶음에서 다섯 줄 아래에 열려 화면 밖으로 나가고,
                      버튼 사이에 좁게 끼우면 같은 줄의 뒤 버튼이 밀린다. 줄 전체를
                      쓰면 누른 버튼과 그 앞은 제자리에 있다(§12.31). */}
                  {isOpen && (
                    <li className="tool-index__panel-row">
                      {renderPanel(tool)}
                    </li>
                  )}
                  </React.Fragment>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );

  function renderPanel(open) {
    const group = eligibleIds ? (eligibleIds.includes(open.id) ? { ready: true, id: "ready" } : { ready: false, id: "blocked" }) : { ready: null, id: "stage" };
    return (
              <div className="tool-index__panel" id={`${base}-${open.id}-panel`} role="region" aria-label={open.question}>
                {renderDetail ? renderDetail(open.id) : <>
                <h4>{open.question}</h4>
                <p className="tool-index__answer">{open.description || open.answer}</p>
                {open.guidance && <div className="tool-index__guidance"><strong>{open.guidance[0]}</strong><p>{open.guidance[1]}</p></div>}
                <p className="tool-index__meta">
                  <span className="tool-index__meta-label">{labels.tool}</span>
                  <span className="tool-index__name">{open.name}</span>
                </p>
                {open.outputs.length > 0 && (
                  <div className="tool-index__output-preview" aria-label={locale === "en" ? "Report contents preview" : "결과 보고서 구성 미리보기"}>
                    <strong>{locale === "en" ? "What the result contains" : "분석하면 이런 결과를 받습니다"}</strong>
                    <ol>{open.outputs.map((output, index) => <li key={output}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><b>{output}</b></li>)}</ol>
                  </div>
                )}
                {open.needs.length > 0 && (
                  <p className="tool-index__needs">
                    <span className="tool-index__meta-label">{labels.needs}</span>
                    <span>{open.needs.join(" · ")}</span>
                  </p>
                )}
                {/* 안 되는 분석은 무엇이 없어서 안 되는지(바로 위 `필요 데이터`)를
                    읽는 게 먼저다. 그래도 길은 막지 않는다 — 막으면 도구를 구경조차
                    못 하고, 그건 "숨기지 말 것"과 같은 이유로 나쁘다(§12.31). */}
                {group.ready === false && (
                  <p className="tool-index__blocked-note">{blockedInfo?.[open.id]?.hint || labels.blockedHint}</p>
                )}
                {/* 브릿지는 여러 갈래여야 한다 — 컬럼을 직접 채울 사람, 템플릿부터
                    받을 사람, 일단 도구를 보고 판단할 사람이 각각 있다. */}
                {group.ready === false && hasToolTemplate(open.id) && (
                  <button type="button" className="btn tool-index__template" onClick={() => downloadTemplateCsv(open.id)}>
                    {labels.template}
                  </button>
                )}
                {/* onSelect가 있으면 그 쪽이 이긴다 — 업로드 화면은 올린 CSV를 대상
                    도구용으로 다시 매핑해 넘겨야 하고, 링크로 이동하면 그 핸드오프가
                    사라져 도구가 빈 상태로 열린다. */}
                <Link
                  className={`btn tool-index__link${group.ready === false ? "" : " primary"}`}
                  href={localizedHref(open.href, locale)}
                  onClick={onSelect
                    ? (event) => { event.preventDefault(); onSelect(open.id); }
                    : onItemClick ? () => onItemClick(open.id) : undefined}
                >
                  {group.ready === false ? labels.openAnyway : labels.open}
                </Link>
                </>}
              </div>
    );
  }
}
