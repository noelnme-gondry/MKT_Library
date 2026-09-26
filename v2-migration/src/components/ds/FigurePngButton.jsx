"use client";

// 그림 하나를 PNG로 받는 버튼(Pro). 캔버스 차트와 HTML 그림이 같은 버튼·같은 자리(제목 줄 오른쪽)를 쓴다.
// 도구마다 받기 버튼 모양이 갈려 있었다(칩·보조 버튼·메뉴 항목) — 그림을 받는 길은 이 부품 하나다.
import { useState } from "react";

import { requirePaidExport } from "@/lib/subscription/paidExport";
import { downloadChartAsPNG } from "@/utils/chartUtils";
import { downloadElementAsPNG } from "@/utils/figureImage";

const tr = (locale, ko, en) => (locale === "en" ? en : ko);

function resolveTarget(target) {
  if (!target) return null;
  if (typeof target === "function") return target();
  if ("current" in target) return target.current;
  return target;
}

/** 캔버스면 차트 PNG로, 그 밖의 요소면 HTML 그림 PNG로 받는다. 받을 대상이 없거나 실패하면 false. */
export async function downloadFigureTarget(element, fileName) {
  if (!element) return false;
  if (element.tagName === "CANVAS") return downloadChartAsPNG(element, fileName);
  return downloadElementAsPNG(element, fileName);
}

/** `target`: ref · 요소 · 요소를 돌려주는 함수. */
export default function FigurePngButton({ target, fileName, locale = "ko" }) {
  const [failed, setFailed] = useState(false);
  const download = async () => {
    if (!requirePaidExport({ format: "png" })) return;
    const ok = await downloadFigureTarget(resolveTarget(target), fileName);
    setFailed(!ok);
  };
  return <>
    <button type="button" className="btn secondary figure-png-button" onClick={download}>{tr(locale, "PNG 받기", "Download PNG")}</button>
    {failed && <span className="figure-png-button__error" role="alert">{tr(locale, "이 브라우저에서는 그림을 이미지로 만들지 못했습니다. 화면 캡처를 이용해 주세요.", "This browser could not turn the figure into an image. Please use a screenshot instead.")}</span>}
  </>;
}

/** 제목 + PNG 받기 한 줄. 제목이 없는 그림은 `title` 없이 쓰면 버튼만 오른쪽에 선다. */
export function FigureHead({ title, level = 2, id, target, fileName, locale = "ko" }) {
  const Heading = level === 3 ? "h3" : "h2";
  return <div className={title ? "section-head" : "section-head figure-head--bare"}>
    {title && <Heading className="section-title" id={id}>{title}</Heading>}
    <FigurePngButton target={target} fileName={fileName} locale={locale} />
  </div>;
}
