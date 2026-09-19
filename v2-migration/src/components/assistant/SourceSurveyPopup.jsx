"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { trackProductEvent } from "@/lib/analytics";
import {
  readWelcomeOpen,
  subscribeWelcomePresence,
  welcomePresenceServerSnapshot,
} from "@/lib/assistant/overlayPresence";
import {
  SOURCE_SURVEY_OPEN_DELAY_MS,
  SOURCE_SURVEY_MAX_LENGTH,
  markSourceSurveySessionSeen,
  normalizeSourceSurveyAnswer,
  readSourceSurveyStorageSnapshot,
  shouldShowSourceSurvey,
  sourceSurveyServerSnapshot,
  writeSourceSurveyAnswered,
} from "@/lib/survey/sourceSurvey";

// 스냅샷은 모듈에 한 번 굳는다(lib/survey/sourceSurvey.js 주석 참조).
const subscribeStorage = () => () => {};

// 유입 경로 서베이 — "어디서 오셨어요?"를 주관식 한 칸으로 묻는다.
//
// 화면 가운데 뜨지만 **배경을 덮는 오버레이는 없다**. 반투명 백드롭을 깔면 뒤가
// 통째로 잠겨 모바일 전면 광고(구글 인터스티셜) 판정에 걸리고, 읽던 사람이 질문에
// 답해야만 계속 읽을 수 있게 된다. 지금은 카드 바깥이 그대로 살아 있어 무시하고
// 스크롤할 수 있다 — 자리만 가운데다.
//
// 도치 첫 방문 인사와 절대 겹치지 않는다 — 인사가 닫히면 바로 뜬다
// (lib/assistant/overlayPresence.js).
export const SOURCE_SURVEY_COPY = {
  ko: {
    label: "유입 경로 한 가지 질문",
    heading: "어떻게 여기까지 오셨나요?",
    lead: "검색어, 커뮤니티 글, 추천해 준 사람 — 기억나는 대로 한 줄이면 충분합니다.",
    placeholder: "예: 네이버에서 'MMM 분석' 검색 / 회사 동료 추천 / 뉴스레터",
    submit: "보내기",
    sending: "보내는 중",
    skip: "나중에",
    dontAsk: "다시 묻지 않기",
    close: "질문 닫기",
    privacy: "적어 주신 이 답변만 저장됩니다. 업로드한 데이터와 분석 결과는 브라우저에만 남고 서버로 보내지 않습니다.",
    thanks: "고맙습니다. 덕분에 어디에 힘을 쏟을지 정할 수 있어요.",
    failed: "보내지 못했습니다. 네트워크를 확인하고 다시 눌러 주세요.",
    remaining: (count) => `${count}자 남음`,
  },
  en: {
    label: "One question about how you found us",
    heading: "How did you get here?",
    lead: "A search term, a community post, someone who recommended it — one line from memory is plenty.",
    placeholder: "e.g. Googled “marketing mix modeling” / a coworker / a newsletter",
    submit: "Send",
    sending: "Sending",
    skip: "Later",
    dontAsk: "Don’t ask again",
    close: "Close this question",
    privacy: "Only this answer is stored. Your uploaded data and analysis results stay in your browser and are never sent to a server.",
    thanks: "Thank you — this tells us where to put our effort.",
    failed: "That didn’t go through. Check your connection and try again.",
    remaining: (count) => `${count} characters left`,
  },
};

export default function SourceSurveyPopup({ locale = "ko" }) {
  const copy = SOURCE_SURVEY_COPY[locale] || SOURCE_SURVEY_COPY.ko;
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("editing");
  const [closed, setClosed] = useState(false);
  const [delayElapsed, setDelayElapsed] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);
  const closeTimerRef = useRef(null);
  const submissionRef = useRef(null);

  const storageAllows = useSyncExternalStore(
    subscribeStorage,
    readSourceSurveyStorageSnapshot,
    sourceSurveyServerSnapshot,
  );
  const welcomeOpen = useSyncExternalStore(
    subscribeWelcomePresence,
    readWelcomeOpen,
    welcomePresenceServerSnapshot,
  );

  // 마운트 이펙트 다음 틱으로 한 번만 미룬다(위 상수 주석 참조).
  // 저장소가 이미 막은 사람에게는 타이머를 걸지도 않는다.
  useEffect(() => {
    if (!storageAllows || delayElapsed) return undefined;
    const timer = window.setTimeout(() => setDelayElapsed(true), SOURCE_SURVEY_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [storageAllows, delayElapsed]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  // 열림은 렌더 파생이다(effect에서 setState로 열지 않는다, §5).
  const open = shouldShowSourceSurvey({ storageAllows, welcomeOpen, delayElapsed, closed });

  useEffect(() => {
    if (!open) return;
    markSourceSurveySessionSeen();
    trackProductEvent("source_survey_viewed", { placement: "source_survey", locale, state: "opened" });
  }, [open, locale]);

  const normalized = normalizeSourceSurveyAnswer(answer);
  const canSend = Boolean(normalized) && status !== "sending";

  const dismiss = (state) => {
    // "다시 묻지 않기"를 고르지 않았으면 세션 표식만 남는다 — 다음 방문에 한 번 더 묻는다.
    if (dontAsk) writeSourceSurveyAnswered();
    setClosed(true);
    trackProductEvent("source_survey_dismissed", { placement: "source_survey", locale, state });
  };

  const send = async (event) => {
    event.preventDefault();
    if (!canSend) return;
    if (submissionRef.current?.answer !== normalized) submissionRef.current = { answer: normalized, id: crypto.randomUUID() };
    setStatus("sending");
    try {
      // 답변 원문은 우리 서버로만 간다. GA4 이벤트에는 절대 싣지 않는다
      // (lib/analytics.js 최상단 규칙 — 범주형 파라미터만).
      const response = await fetch("/api/survey/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: submissionRef.current.id,
          answer: normalized,
          locale,
          pathname: window.location?.pathname || "",
        }),
      });
      if (!response.ok) throw new Error("SEND_FAILED");
      // 보낸 사람에게는 다시 묻지 않는다.
      writeSourceSurveyAnswered();
      setStatus("sent");
      trackProductEvent("source_survey_submitted", { placement: "source_survey", locale, state: "sent" });
      closeTimerRef.current = window.setTimeout(() => setClosed(true), 2600);
    } catch {
      // 실패를 성공으로 접지 않는다 — 답변은 그대로 두고 다시 누를 수 있게 한다(§8).
      setStatus("failed");
      trackProductEvent("source_survey_failed", { placement: "source_survey", locale, state: "failed" });
    }
  };

  if (!open) return null;

  return (
    <aside className="source-survey" role="dialog" aria-label={copy.label} aria-live="polite">
      <button type="button" className="source-survey__close" onClick={() => dismiss("closed")} aria-label={copy.close}>
        ×
      </button>

      {status === "sent" ? (
        <p className="source-survey__thanks">{copy.thanks}</p>
      ) : (
        <form className="source-survey__form" onSubmit={send}>
          {/* 입력칸의 이름은 이 제목이 맡는다. sr-only 라벨로 같은 문장을 한 번 더
              두면 보조기술이 질문을 두 번 읽는다(그리고 화면 검사가 제목을 둘로 센다). */}
          <h2 className="source-survey__heading" id="source-survey-heading">{copy.heading}</h2>
          <p className="source-survey__lead" id="source-survey-lead">{copy.lead}</p>

          <textarea
            id="source-survey-answer"
            aria-labelledby="source-survey-heading"
            aria-describedby="source-survey-lead"
            className="source-survey__input"
            value={answer}
            onChange={(event) => setAnswer(event.target.value.slice(0, SOURCE_SURVEY_MAX_LENGTH))}
            maxLength={SOURCE_SURVEY_MAX_LENGTH}
            rows={2}
            placeholder={copy.placeholder}
          />
          <p className="source-survey__count">{copy.remaining(SOURCE_SURVEY_MAX_LENGTH - answer.length)}</p>

          {status === "failed" && <p className="source-survey__error">{copy.failed}</p>}

          <div className="source-survey__actions">
            <button type="submit" className="source-survey__send" disabled={!canSend}>
              {status === "sending" ? copy.sending : copy.submit}
            </button>
            <button type="button" className="source-survey__skip" onClick={() => dismiss("skipped")}>
              {copy.skip}
            </button>
          </div>

          <label className="source-survey__optout">
            <input type="checkbox" checked={dontAsk} onChange={(event) => setDontAsk(event.target.checked)} />
            <span>{copy.dontAsk}</span>
          </label>

          <p className="source-survey__privacy">{copy.privacy}</p>
        </form>
      )}
    </aside>
  );
}
