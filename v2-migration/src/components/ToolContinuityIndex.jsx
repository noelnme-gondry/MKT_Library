"use client";

import { useMemo } from "react";
import Link from "next/link";
import { publishedToolIds } from "@/lib/routeMap";
import ToolIndex from "@/components/ds/ToolIndex";
import { useAppStore } from "@/store/useDataStore";
import { computeCsvEligibility, eligibleToolIds } from "@/lib/assistant/csvEligibility";
import { blockerFieldLabels, blockersText } from "@/lib/assistant/blockerText";

/**
 * "이 데이터로 지금 할 수 있는 다른 분석" — 도구 화면 맨 아래.
 *
 * 업로드 화면(`/start`)에서 하나를 고르는 순간 나머지 후보가 화면에서 사라졌다.
 * 도구를 다 보고 나면 되돌아갈 길이 사이드바뿐이라, 같은 CSV로 이어서 볼 수
 * 있는 것들이 있다는 사실 자체를 잊게 된다. 같은 판정을 같은 부품으로 다시
 * 그려서 흐름을 잇는다 — 문구도 목록도 `/start`와 한 출처다.
 *
 * 판정은 무겁다(카탈로그 19개 × 매핑 계약). 그래서 이 컴포넌트는 **분석 게이트
 * 뒤에서만 마운트**된다 — 부모가 그렇게 부른다(§4.4). 훅은 조건부로 못 부르므로
 * 게이트를 부모가 쥐는 것이 이 분리의 이유다.
 */
const COPY = {
  ko: {
    title: "이 데이터로 이어서 볼 수 있는 분석",
    desc: "지금 올린 파일 그대로 바로 실행됩니다. 다시 올릴 필요 없습니다.",
    none: "이 파일로 지금 바로 되는 다른 분석은 없습니다.",
    all: "전체 분석 보기",
  },
  en: {
    title: "Continue with this data",
    desc: "These run on the file you already uploaded. No need to upload it again.",
    none: "No other analysis runs on this file as-is.",
    all: "See all analyses",
  },
};

export const CONTINUITY_LIMIT = 3;

export default function ToolContinuityIndex({ toolId, locale = "ko", onSelect = null }) {
  const lang = locale === "en" ? "en" : "ko";
  const T = COPY[lang];
  const raw = useAppStore((state) => state.csvData.raw);
  const headers = useAppStore((state) => state.csvData.headers);
  const mapping = useAppStore((state) => state.csvData.mapping);
  const fileName = useAppStore((state) => state.csvData.fileName);

  const { eligibleIds, blockedInfo } = useMemo(() => {
    const results = computeCsvEligibility({ raw, headers, mapping, fileName, locale: lang });
    return {
      eligibleIds: eligibleToolIds(results).filter((id) => id !== toolId),
      blockedInfo: Object.fromEntries(results
        .filter((result) => result.status === "blocked")
        .map((result) => [result.toolId, {
          fields: blockerFieldLabels(result, lang),
          hint: blockersText(result, lang),
        }])),
    };
  }, [raw, headers, mapping, fileName, lang, toolId]);

  // 판정이 비면(헤더가 없거나 파싱 전) 목록을 지어내지 않는다 — 자격을 모르는
  // 전체 카탈로그를 여기 펴면 "이 데이터로 된다"는 약속이 거짓이 된다(§8).
  if (!raw?.length || !headers?.length) return null;

  // 결과 아래에 도구 20개를 전부 펴면 폰에서 2,000px가 넘었다(2026-09-24 실측). 지금 바로 되는 것
  // 3개만 두고 나머지는 전체 목록으로 보낸다 — 안 되는 분석의 사유는 /start 전체 목록이 말한다.
  const shown = eligibleIds.slice(0, CONTINUITY_LIMIT);
  const hidden = publishedToolIds().filter((id) => !shown.includes(id));

  return (
    <section className="tool-continuity" aria-labelledby={`tool-continuity-${toolId}`}>
      <h2 className="section-title" id={`tool-continuity-${toolId}`}>{T.title}</h2>
      <p className="muted">{eligibleIds.length > 0 ? T.desc : T.none}</p>
      {shown.length > 0 && <ToolIndex
        locale={lang}
        density="grid"
        eligibleIds={shown}
        blockedInfo={blockedInfo}
        excludeIds={[toolId, ...hidden]}
        headingLevel={3}
        onSelect={onSelect}
      />}
      <Link className="tool-continuity__all" href={lang === "en" ? "/en/start" : "/start"}>{T.all}</Link>
    </section>
  );
}
