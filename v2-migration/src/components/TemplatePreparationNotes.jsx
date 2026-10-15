import { getToolGuide } from "@/utils/toolGuide";

// 검색에서 바로 내려받는 두 템플릿에 기존 업로드 안내의 집계 단위를 보여준다.
// 컬럼 계약·예제를 다시 작성하지 않고 도구 안내 SSOT를 재사용한다.
export default function TemplatePreparationNotes({ toolId, locale = "ko" }) {
  if (!["5-28", "5-29"].includes(toolId)) return null;
  const guide = getToolGuide(toolId, locale);
  if (!guide) return null;
  return <section aria-labelledby="template-preparation-heading">
    <h2 id="template-preparation-heading">{locale === "en" ? "Prepare the observation unit" : "분석에 맞는 행 단위 준비하기"}</h2>
    <p>{guide.when}</p>
    <p>{guide.grain}</p>
    <ul className="template-detail__rules">{guide.prep.map(tip => <li key={tip}>{tip}</li>)}</ul>
  </section>;
}
