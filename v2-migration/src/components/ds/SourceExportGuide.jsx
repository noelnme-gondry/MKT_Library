import { TOOL_GROUP } from "@/lib/toolGroups";
import GoogleSheetsGuide from "../GoogleSheetsGuide";

export default function SourceExportGuide({ toolId, locale = "ko" }) {
  if (toolId && TOOL_GROUP[toolId] !== "efficiency") return null;
  const en = locale === "en";
  return <section className="source-export-guide">
    <h3>{en ? "Prepare a file you can reuse next week" : "다음 주에도 쓸 수 있는 파일 준비"}</h3>
    <section data-information-section=""><header data-information-heading="">{en ? "Meta Ads Manager → daily campaign CSV" : "Meta 광고 관리자 → 일별 캠페인 CSV"}</header>
      <ol>
        <li>{en ? "Choose campaign-level reporting and a daily time breakdown. Export a CSV covering both comparison periods; exclude totals and partial days." : "캠페인 수준 보고서를 일별로 나누고, 비교할 두 기간을 포함해 CSV로 내보내세요. 합계 행과 아직 끝나지 않은 날은 제외하세요."}</li>
        <li>{en ? "Include the date, campaign, amount spent and the conversion event you will compare. Add impressions, clicks and conversion value when needed. Keep one currency, time zone and attribution setting." : "날짜·캠페인·지출 금액과 비교할 전환 이벤트를 포함하세요. 필요하면 노출·클릭·전환값을 추가하고, 통화·시간대·어트리뷰션 설정을 맞추세요."}</li>
        <li>{en ? "Check which event the Results column represents. Do not combine leads, purchases and installs as one conversion. Verify column mapping before analysis." : "‘결과’ 열이 어떤 이벤트인지 확인하세요. 리드·구매·설치를 하나의 전환으로 합치지 말고, 분석 전 컬럼 연결을 확인하세요."}</li>
      </ol>
      <a href="https://support.google.com/analytics/answer/16748649" target="_blank" rel="noreferrer">{en ? "Platform export reference (Google Analytics Help)" : "플랫폼별 내보내기 참고 (Google Analytics 도움말)"}</a>
    </section>
    <GoogleSheetsGuide locale={locale} />
    <p>{en ? "Next time, keep the same columns and measurement definitions and update the dates. Saved settings do not refresh the source: upload the new file and check the comparison periods." : "다음에는 같은 컬럼·측정 기준을 유지하고 기간을 갱신하세요. 저장된 설정이 원본을 자동 갱신하지는 않습니다. 새 파일을 올린 뒤 비교 기간을 확인하세요."}</p>
  </section>;
}
