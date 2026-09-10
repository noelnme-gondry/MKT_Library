import SampleReportExcerpt from "./SampleReportExcerpt";
import SampleReportDownloads from "./SampleReportDownloads";
export default function SubscriptionReportPreview({ locale = "ko" }) {
  const en = locale === "en";
  return <section className="report-preview" aria-labelledby="report-preview-title">
    <div className="report-preview-heading"><h2 id="report-preview-title">{en ? "One analysis. Two ways to use it." : "하나의 분석, 두 가지 활용 방식."}</h2><p>{en ? "Present the conclusion. Inspect the calculation." : "Word로 설명하고, Excel로 계산을 확인하세요."}</p></div>
    <div className="report-preview-grid">
      <article className="report-preview-item">
        <div className="report-file-label"><span aria-hidden="true">W</span><div><h3>Word</h3><p>{en ? "For your next meeting" : "다음 회의에 가져갈 문서"}</p></div><span className="report-file-extension">.docx</span></div>
        <div className="report-paper" aria-label={en ? "Word file structure example" : "Word 파일 구성 예시"}>
          <div className="report-paper-top">Growth Opt Playbook <span>{en ? "Analysis report" : "분석 보고서"}</span></div>
          <h4>{en ? "Conclusion and next actions" : "결론과 다음 행동"}</h4>
          <div className="report-paper-callout">{en ? "What changed, what to check, and what to do next" : "무엇이 달라졌고, 무엇을 확인하고, 다음에 무엇을 할지"}</div>
          <ul><li>{en ? "Key results and supporting evidence" : "핵심 수치와 판단 근거"}</li><li>{en ? "Charts from the analysis" : "분석 화면의 차트"}</li><li>{en ? "Method and interpretation limits" : "분석 방법과 해석 한계"}</li></ul>
        </div>
        <p>{en ? "Edit the conclusion, tables and next actions for your team. Captured charts keep the visual context of your analysis." : "결론·근거 표·다음 행동을 팀에 맞게 편집하세요. 화면 차트를 함께 담아 분석의 맥락을 전달합니다."}</p>
      </article>
      <article className="report-preview-item">
        <div className="report-file-label"><span aria-hidden="true">X</span><div><h3>Excel</h3><p>{en ? "For checking the numbers" : "숫자를 다시 확인할 워크북"}</p></div><span className="report-file-extension">.xlsx</span></div>
        <div className="report-workbook" aria-label={en ? "Excel file structure example" : "Excel 파일 구성 예시"}>
          <div className="report-workbook-toolbar">ƒx <span>{en ? "Formula cells + engine outputs" : "수식 셀 + 엔진 산출물"}</span></div>
          <div className="report-workbook-grid">{(en ? [["Raw data", "Source rows"], ["Mapping", "Column definitions"], ["Calculations", "Inputs and formulas"], ["Charts", "Editable series"]] : [["원본", "분석에 사용한 행"], ["매핑", "컬럼별 정의"], ["계산", "입력값과 수식"], ["차트", "편집 가능한 시리즈"]]).map(([label, value]) => <div key={label}><strong>{label}</strong><span>{value}</span></div>)}</div>
          <div className="report-workbook-tabs"><span>{en ? "Source" : "원본"}</span><span>{en ? "Evidence" : "근거"}</span><span>{en ? "Charts" : "차트"}</span></div>
        </div>
        <p>{en ? "Trace source rows, mappings and calculation inputs. Inspect formulas and edit chart data in your spreadsheet." : "원본·매핑·계산 입력을 따라가며 근거를 확인하세요. 스프레드시트에서 수식과 차트 데이터를 편집할 수 있습니다."}</p>
      </article>
    </div>
    <SampleReportExcerpt locale={locale} />
    <SampleReportDownloads locale={locale} />
    <p className="report-preview-note">{en ? "The Word/Excel layout illustrations show file structure; the sample excerpt below them uses calculated demo results. Content varies by tool. Complex models must be refitted on the website; editing raw cells does not rerun preprocessing or model estimation. Chart annotations may differ from the website." : "Word·Excel 구성 이미지는 파일 구조 예시이고 아래 샘플 발췌는 데모 계산 결과입니다. 도구마다 포함 내용이 다릅니다. 복잡한 모델은 사이트에서 다시 추정해야 합니다. 원본 셀 편집만으로 전처리·모델 추정이 재실행되지는 않으며, 차트 주석은 화면과 다를 수 있습니다."}</p>
  </section>;
}
