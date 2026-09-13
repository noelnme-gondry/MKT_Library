export default function GoogleSheetsGuide({ locale = "ko" }) {
  const en = locale === "en";
  return <section className="google-sheets-guide">
    <h3>{en ? "Use Sheets for repeat imports" : "Google Sheets로 반복 입력 준비하기"}</h3>
    <p>{en ? "Keep one input tab with stable columns. Choose a method that matches its sharing permissions." : "같은 컬럼을 쓰는 입력용 탭을 두면 다음 기간도 이어서 준비하기 편합니다. 시트의 공개 범위에 맞는 방법을 선택하세요."}</p>
    <details>
      <summary>{en ? "Public sheet → import its tab link" : "공개 Google Sheets → 탭 링크로 불러오기"}</summary>
      <ol>
        <li>{en ? "Use a sheet already approved for public viewing. Signing into this product does not grant access to a private Google Sheet." : "공개가 허용된 시트에만 사용하세요. 이 사이트에 로그인해도 비공개 Google Sheets 접근 권한이 생기지는 않습니다."}</li>
        <li>{en ? "Open the input tab and copy its full address, including gid when present. Use the normal spreadsheet URL, not a Publish to web link." : "가져올 탭을 연 뒤 주소창의 전체 링크를 복사하세요. gid가 있으면 포함하고, ‘웹에 게시’ 링크가 아닌 일반 스프레드시트 주소를 사용하세요."}</li>
        <li>{en ? "Choose Import from a public Google Sheet in the data input area, paste the link and select Import. Check the column mapping, dates and currency, then run the analysis." : "데이터 입력 영역에서 ‘공개 Google Sheets에서 불러오기’를 선택하고 링크를 붙여 넣어 불러오세요. 컬럼 연결·기간·통화를 확인한 뒤 ‘분석하기’를 누르세요."}</li>
        <li>{en ? "When the source changes, select Fetch latest data and check the imported period before analyzing again. The browser reads Google directly when you request it; this is not background synchronization." : "원본을 갱신한 뒤에는 ‘최신 데이터 불러오기’를 누르고 가져온 기간을 확인해 다시 분석하세요. 요청할 때 브라우저가 Google에서 직접 읽으며, 백그라운드 자동 동기화는 아닙니다."}</li>
      </ol>
    </details>
    <details>
      <summary>{en ? "Private Google Sheets → CSV upload" : "비공개 Google Sheets → CSV 업로드"}</summary>
      <ol>
        <li>{en ? "Keep the sheet private. In Google Sheets, open the tab containing the rows you want to analyze." : "공개 범위를 바꾸지 마세요. Google Sheets에서 분석할 행이 들어 있는 탭을 여세요."}</li>
        <li>{en ? "Choose File → Download → Comma-separated values (.csv, current sheet). CSV downloads contain the selected tab, not every tab in the workbook." : "파일 → 다운로드 → 쉼표로 구분된 값(.csv, 현재 시트)을 선택하세요. CSV에는 선택한 탭이 담기며 모든 탭이 합쳐지지 않습니다."}</li>
        <li>{en ? "Upload the file here. Confirm the mapped columns and full comparison period before analyzing. On the next visit, download the updated tab and use the same project." : "이 사이트에 파일을 올리고 컬럼 연결과 비교할 전체 기간을 확인해 분석하세요. 다음에는 갱신된 탭을 다시 내려받아 같은 프로젝트에서 사용하세요."}</li>
      </ol>
      <a href="https://support.google.com/docs/answer/9330963" target="_blank" rel="noreferrer">{en ? "Google Sheets export help" : "Google Sheets 내보내기 도움말"}</a>
    </details>
    <details>
      <summary>{en ? "Already using BigQuery? Schedule data preparation" : "BigQuery를 쓰고 있다면 데이터 준비 자동화"}</summary>
      <p className="google-sheets-guide__flow">{en ? "BigQuery summary table → Connected Sheets extract → CSV upload or public-sheet refresh" : "BigQuery 집계 테이블 → Connected Sheets 추출 탭 → CSV 업로드 또는 공개 시트 재조회"}</p>
      <ol>
        <li>{en ? "Arrange ingestion into your own BigQuery project first. Scheduled queries transform available data; they do not connect every ad account for you. Google Cloud billing and the required dataset/query permissions must be configured." : "먼저 사용자 측 BigQuery에 원천 데이터가 들어오도록 수집을 구성하세요. 예약 쿼리는 들어온 데이터를 가공하는 기능이며, 광고 계정을 자동으로 연결해 주지는 않습니다. Google Cloud 결제 설정과 데이터 조회·쿼리 실행 권한이 필요합니다."}</li>
        <li>{en ? "Schedule a query to produce the input table at the grain required by the tool—for example, one day × campaign for campaign performance. Keep currency, time zone and conversion definitions consistent. Schedule it after source ingestion completes." : "도구가 요구하는 단위로 입력 테이블을 만드는 쿼리를 예약하세요. 예를 들어 캠페인 성과는 일자×캠페인 단위로 준비하고, 통화·시간대·전환 정의를 맞춥니다. 원천 데이터 수집이 끝난 뒤 실행되도록 시간을 잡으세요."}</li>
        <li>{en ? "On a computer, open Sheets → Data → Data connectors → Connect to BigQuery. Select the project and prepared table or view, then connect." : "PC의 Sheets에서 데이터 → 데이터 커넥터 → BigQuery에 연결을 열고, 프로젝트와 준비한 테이블 또는 뷰를 선택해 연결하세요."}</li>
        <li>{en ? "Create an Extract with the needed columns and date range, then apply it. Check the extracted row count and period: a preview or a limited extract is not the complete dataset." : "필요한 컬럼과 기간으로 ‘추출’을 만들고 적용하세요. 추출된 행 수와 기간을 확인해야 합니다. 미리보기나 제한된 추출을 전체 데이터로 사용하지 마세요."}</li>
        <li>{en ? "In Refresh options → Scheduled refresh, set a refresh after the BigQuery table is updated. These are separate schedules. Check the last successful refresh; access changes or a paused schedule can leave old data. Query usage may incur Google Cloud charges." : "새로고침 옵션 → 예약 새로고침에서 BigQuery 테이블 갱신 이후로 시간을 설정하세요. 두 예약은 별개입니다. 권한 변경이나 예약 중지로 이전 데이터가 남을 수 있으니 마지막 성공 시각을 확인하세요. 쿼리 사용량에 따라 Google Cloud 비용이 발생할 수 있습니다."}</li>
        <li>{en ? "For company data, keep the extract private and download it as CSV. Only an approved public tab can use this product’s link importer. Either way, import the latest data and run analysis here yourself." : "사내 데이터는 추출 탭도 비공개로 유지하고 CSV로 내려받으세요. 공개가 허용된 탭만 이 사이트의 링크 불러오기를 사용할 수 있습니다. 어느 방식이든 이 사이트에서 최신 데이터를 가져오고 분석하는 단계는 직접 실행해야 합니다."}</li>
      </ol>
      <nav aria-label={en ? "Official BigQuery and Sheets instructions" : "BigQuery·Sheets 공식 연결 안내"}>
        <a href="https://docs.cloud.google.com/bigquery/docs/scheduling-queries" target="_blank" rel="noreferrer">{en ? "Schedule a query" : "쿼리 예약"}</a>
        <a href="https://support.google.com/docs/answer/9702507" target="_blank" rel="noreferrer">{en ? "Connect Sheets" : "Sheets 연결"}</a>
        <a href="https://support.google.com/docs/answer/9703214" target="_blank" rel="noreferrer">{en ? "Extract and refresh" : "추출·새로고침"}</a>
      </nav>
    </details>
  </section>;
}
