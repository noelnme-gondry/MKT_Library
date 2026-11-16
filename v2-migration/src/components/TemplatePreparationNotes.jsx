import { getToolGuide } from "@/utils/toolGuide";
import { ADVANCED_READING } from "@/lib/advanced-marketing/reading";

// 모든 템플릿에 기존 업로드 안내의 집계 단위를 보여준다.
// 컬럼 계약·예제를 다시 작성하지 않고 도구 안내 SSOT를 재사용한다.
export default function TemplatePreparationNotes({ toolId, locale = "ko" }) {
  const guide = getToolGuide(toolId, locale);
  if (!guide) return null;
  const prep = ADVANCED_READING[toolId] ? [ADVANCED_READING[toolId].prep[locale], guide.prep[0]] : guide.prep;
  return <section aria-labelledby="template-preparation-heading">
    <h2 id="template-preparation-heading">{locale === "en" ? "Prepare the observation unit" : "분석에 맞는 행 단위 준비하기"}</h2>
    <p>{guide.when}</p>
    <p>{guide.grain}</p>
    <ul className="template-detail__rules">{prep.map(tip => <li key={tip}>{tip}</li>)}</ul>
    {guide.example && <><h3>{locale === "en" ? "Input example (first rows, not a complete study)" : "입력 예시 (일부 행 · 전체 분석 표본 아님)"}</h3>
      <div className="table-scroll" role="region" tabIndex={0} aria-label={locale === "en" ? "CSV input example" : "CSV 입력 예시"}><pre>{guide.example}</pre></div></>}
  </section>;
}
