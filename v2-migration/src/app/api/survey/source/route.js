import { accountSameOrigin } from "@/lib/account/accountServer";
import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";
import { saveSourceSurvey, sourceSurveyError } from "@/lib/survey/sourceSurveyServer";
import { SOURCE_SURVEY_MAX_LENGTH } from "@/lib/survey/sourceSurvey";

// 유입 경로 서베이 제출. 로그인 없이 누구나 부르는 경로이므로 본문 크기를 먼저
// 막고(스트림을 끝까지 읽지 않는다) 같은 출처만 받는다.
// 답변 상한의 4배를 바이트 예산으로 둔다 — 한글 1자가 UTF-8 3바이트라 상한을
// 그대로 바이트로 쓰면 정상 답변이 거절된다.
const MAX_BYTES = SOURCE_SURVEY_MAX_LENGTH * 4 + 512;

async function readSurveyInput(request) {
  accountSameOrigin(request);
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_SURVEY");
  let bytes = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error("INVALID_SURVEY"); }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error?.message === "INVALID_SURVEY" || error?.message === "INVALID_ORIGIN") throw error;
    throw new Error("INVALID_SURVEY");
  } finally { reader.releaseLock(); }
}

export async function POST(request) {
  if (!admitPaymentRequest("source-survey", request)) return paymentLimitResponse();
  try {
    const input = await readSurveyInput(request);
    const pathname = typeof input?.pathname === "string" ? input.pathname : "";
    return Response.json(await saveSourceSurvey(input, pathname), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return sourceSurveyError(error);
  }
}
