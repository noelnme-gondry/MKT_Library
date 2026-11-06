import { advancedMap } from "./registry";
import { ADVANCED_FIELDS } from "./fields";
import { advancedDemoRows } from "./demo";
import { csvBody } from "@/utils/download";
// Shared navigation/CSV guidance only needs the opening sentence. The complete
// reading stays in the dynamically loaded tool and server-rendered templates.
import ADVANCED_READING from "./guideSummaries.json";

export const ADVANCED_SEARCH_CONTENT = advancedMap((tool) => Object.fromEntries(["ko", "en"].map((locale) => {
  const en = locale === "en";
  const data = `${tool.grain[locale]}. ${tool.need[locale]}. ${en ? "Keep identifiers as text, preserve zero versus missing values, and use the same units throughout the file." : "식별자는 문자열로 보존하고, 0과 누락을 구분하며 파일 전체에서 같은 단위를 사용하세요."}`;
  const reading = ADVANCED_READING[tool.id];
  const method = reading.method[locale];
  const read = `${reading.check[locale]} ${en ? "Read alongside:" : "함께 확인할 결과:"} ${tool.outputs.map((output) => output[locale]).join(" · ")}.`;
  const limit = tool.limit[locale];
  return [locale, { eyebrow: en ? "Tool guide" : "도구 사용 가이드", title: tool.question[locale], question: tool.question[locale], answer: tool.answer[locale],
    lead: method, detailsLabel: en ? "See data and interpretation limits" : "데이터와 해석 한계 보기", outputs: tool.outputs.map((output) => output[locale]),
    sections: [[en ? "Prepare the input" : "입력 데이터 준비", data], [en ? "Read the result" : "결과 확인 순서", read], [en ? "Interpretation limits" : "해석할 수 있는 범위", limit]],
    faq: [{ q: en ? "What data does this analysis require?" : "어떤 데이터가 필요한가요?", a: data },
      { q: en ? "What should I verify before acting?" : "결정 전에 무엇을 확인해야 하나요?", a: reading.check[locale] }] }];
})));
export function advancedGuide(tool, locale = "ko") {
  return { when: tool.answer[locale], grain: tool.grain[locale], source: tool.need[locale],
    needs: [...tool.required, ...tool.optional].map((key) => ({ col: key,
      label: locale === "en" ? ADVANCED_FIELDS[key]?.labelEn || key : ADVANCED_FIELDS[key]?.label || key,
      why: tool.required.includes(key) ? (locale === "en" ? "Required for this analysis" : "이 분석의 필수 입력") : (locale === "en" ? "Optional detail" : "선택 세부 정보"), required: tool.required.includes(key) })),
    prep: [tool.limit[locale], locale === "en" ? "Confirm the settings and data definitions before analyzing. Processing stays in your browser." : "분석 전에 설정과 데이터 정의를 확인하세요. 계산은 브라우저 안에서 처리합니다."],
    example: csvBody(tool.required, advancedDemoRows(tool.id).slice(0, 3).map(row => tool.required.map(key => row[key] ?? ""))) };
}
