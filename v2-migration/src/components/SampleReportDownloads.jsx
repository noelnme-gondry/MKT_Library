"use client";
import { useState } from "react";
import { downloadFile, downloadXlsx } from "@/utils/download";
export default function SampleReportDownloads({ locale = "ko" }) {
  const en = locale === "en";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const download = async format => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { buildSampleReport } = await import("@/lib/analysis-export/sampleReport");
      const payload = buildSampleReport(locale);
      if (format === "docx") {
        const { createAnalysisDocument } = await import("@/lib/analysis-export/analysisDocument");
        downloadFile(await createAnalysisDocument(payload), `growthopt-sample-${locale}.docx`);
      } else {
        const { createAnalysisWorkbook } = await import("@/lib/analysis-export/workbookClient");
        downloadXlsx(await createAnalysisWorkbook(payload), `growthopt-sample-${locale}`);
      }
    } catch { setError(en ? "Could not create the sample. Please try again." : "샘플을 만들지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  };
  return <div className="sample-report-downloads"><h3>{en ? "Open a real sample before buying" : "구매 전에 실제 파일을 열어보세요"}</h3><p>{en ? "Free Word and Excel files calculated from the built-in sample. Includes source rows, channel totals and CPA formulas. No chart images are included in this sample." : "체험용 데이터로 계산한 Word·Excel 파일을 무료로 받으세요. 원본 행·채널 집계·CPA 수식을 포함합니다. 이 샘플에는 차트 이미지는 포함되지 않습니다."}</p><div className="workflow-next-step__actions"><button className="btn primary" disabled={busy} onClick={() => download("docx")}>{en ? "Download sample Word" : "Word 샘플 받기"}</button><button className="btn" disabled={busy} onClick={() => download("xlsx")}>{en ? "Download sample Excel" : "Excel 샘플 받기"}</button></div>{busy && <p role="status">{en ? "Creating sample…" : "샘플 생성 중…"}</p>}{error && <p role="alert">{error}</p>}</div>;
}
