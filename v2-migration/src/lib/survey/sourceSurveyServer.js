import { randomUUID } from "node:crypto";
import { paymentsDatabase } from "@/lib/account/accountServer";
import { journeySurface } from "@/lib/siteJourney";
import {
  isSourceSurveyLocale,
  normalizeSourceSurveyAnswer,
} from "./sourceSurvey";

// 유입 경로 서베이 저장. 저장되는 것은 사용자가 적은 답변 한 줄과 범주형 메타뿐이다
// (scripts/source-survey-schema.sql 참조). IP·계정·URL은 어느 경로로도 들어가지 않는다.

export const sourceSurveyEnabled = () => Boolean(process.env.PAYMENTS_DATABASE_URL);

// 브라우저가 보낸 값은 전부 다시 조립한다 — 펼치기(스프레드) 금지(§12.29 공유 링크와 같은 이유).
// 제출 id는 재시도 중복만 막는 난수이고, 형식이 어긋나면 서버가 새로 만든다.
export function buildSourceSurveyRow(input, pathname) {
  const answer = normalizeSourceSurveyAnswer(input?.answer);
  if (!answer) throw new Error("INVALID_SURVEY");
  const locale = isSourceSurveyLocale(input?.locale) ? input.locale : "ko";
  const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input?.id || "")
    ? String(input.id).toLowerCase()
    : randomUUID();
  // 경로 문자열을 그대로 저장하지 않는다. 고정 어휘로 분류된 진입면만 남긴다.
  const entrySurface = journeySurface(typeof pathname === "string" ? pathname : "");
  return { id, answer, locale, entrySurface };
}

export async function saveSourceSurvey(input, pathname) {
  if (!sourceSurveyEnabled()) throw new Error("SURVEY_UNAVAILABLE");
  const row = buildSourceSurveyRow(input, pathname);
  await paymentsDatabase().query(
    "INSERT INTO gop_source_survey(id,answer,locale,entry_surface) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING",
    [row.id, row.answer, row.locale, row.entrySurface],
  );
  return { ok: true };
}

export function sourceSurveyError(error) {
  const statuses = { INVALID_SURVEY: 400, INVALID_ORIGIN: 403, SURVEY_UNAVAILABLE: 503 };
  const code = Object.hasOwn(statuses, error?.message) ? error.message : "SURVEY_UNAVAILABLE";
  return Response.json({ error: code }, { status: statuses[code], headers: { "Cache-Control": "no-store" } });
}
