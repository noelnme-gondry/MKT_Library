"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import CsvUploader from "@/components/CsvUploader";
import DochiSprite from "@/components/assistant/DochiSprite";
import ModalDialog from "@/components/ds/ModalDialog";
import { trackProductEvent } from "@/lib/analytics";
import {
  dochiWelcomeServerSnapshot,
  markDochiWelcomeSessionSeen,
  readDochiWelcomeStorageSnapshot,
  shouldShowDochiWelcome,
  writeDochiWelcomeDismissed,
} from "@/lib/dochiWelcome";
import { useAppStore } from "@/store/useDataStore";

// 스냅샷이 바뀌는 일이 없으므로 구독은 빈 해지 함수만 돌려준다.
const subscribeWelcome = () => () => {};

// 첫 방문자 인사 오버레이 — 홈(랜딩)에 처음 들어온 사람에게 도치가 4단계로 말을
// 걸고, 마지막 단계에서 바로 CSV·구글시트를 받는다. 닫아도 우하단 상시 접수처
// (DochiAssistant)가 남으므로 여기서 안 올린 사람도 뒤에 올릴 수 있다.
//
// 노출 판정은 lib/dochiWelcome.js가 소유한다(§SSOT). 정적 프리렌더라 서버 HTML엔
// 이 오버레이가 없고, 마운트 후 저장소를 읽어 열리므로 크롤러는 가려진 화면을
// 보지 않는다.
//
// 단계별 포즈는 자산(public/assets/dochi)에 실제로 있는 것만 쓴다.
const STEPS = [
  { id: "greeting", pose: "idle" },
  { id: "intro", pose: "point-up" },
  { id: "purpose", pose: "results" },
  { id: "ask", pose: "delivery" },
];

const COPY = {
  ko: {
    label: "도치의 첫 방문 안내",
    lines: [
      "안녕하세요!",
      "저는 처음 오신 분들을 안내하는 역할을 맡고 있는 도치라고 합니다!",
      "이 홈페이지는 마케터 분들을 위한 분석 사이트입니다!",
      "가지고 계신 데이터 파일이나 구글 스프레드시트(전체공개) 주소를 전달해주시면 지금의 문제와 할 수 있는 데이터 분석을 정리해드릴게요!",
    ],
    next: "다음",
    close: "안내 닫기",
    skip: "건너뛰기",
    dontShow: "다음 방문부터 보이지 않기",
    privacy: "데이터는 브라우저 안에서만 읽습니다. 서버로 보내지 않습니다.",
    importing: "파일을 읽고 있어요.",
    progress: (current, total) => `${total}단계 중 ${current}단계`,
  },
  en: {
    label: "Dochi’s welcome for first-time visitors",
    lines: [
      "Hello!",
      "I’m Dochi, and I show first-time visitors around!",
      "This site is an analysis workspace built for marketers!",
      "Hand me a data file you already have — or a link to a publicly shared Google Sheet — and I’ll lay out what’s going on and which analyses you can run.",
    ],
    next: "Next",
    close: "Close the welcome",
    skip: "Skip",
    dontShow: "Don’t show this again",
    privacy: "Your data is read only in this browser. Nothing is sent to a server.",
    importing: "Reading your file.",
    progress: (current, total) => `Step ${current} of ${total}`,
  },
};

export default function DochiWelcomeOverlay({ locale = "ko" }) {
  const copy = COPY[locale] || COPY.ko;
  const router = useRouter();
  const savedDatasets = useAppStore((state) => state.workspaceDatasetSummaries);
  const [closed, setClosed] = useState(false);
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [importing, setImporting] = useState(false);
  const nextButtonRef = useRef(null);
  // 열림 여부는 effect의 setState가 아니라 렌더 파생이다(§5 set-state-in-effect).
  // 저장소 판정은 스냅샷이 소유하고, 재방문 신호는 마운트 시점 값으로 굳힌다 —
  // 저장된 작업 목록은 IndexedDB에서 비동기로 채워지므로 이 시점엔 아직 비어
  // 있을 수 있고, 그때는 인사가 한 번 더 뜬다(세션당 1회라 반복되진 않는다).
  const storageAllows = useSyncExternalStore(
    subscribeWelcome,
    readDochiWelcomeStorageSnapshot,
    dochiWelcomeServerSnapshot,
  );
  const [hadSavedWorkOnMount] = useState(() => savedDatasets.length > 0);
  const open = shouldShowDochiWelcome({
    dismissed: !storageAllows,
    hasReturningSignal: hadSavedWorkOnMount,
  }) && !closed;

  useEffect(() => {
    if (!open) return;
    markDochiWelcomeSessionSeen();
    trackProductEvent("onboarding_welcome_viewed", { placement: "home_welcome", locale, state: "opened" });
    // open이 true가 되는 것은 생애 한 번뿐이라 이 effect도 한 번만 돈다.
  }, [open, locale]);

  const close = (state) => {
    if (dontShowAgain) writeDochiWelcomeDismissed();
    setClosed(true);
    trackProductEvent("onboarding_welcome_closed", {
      placement: "home_welcome",
      locale,
      state,
      rank: step + 1,
    });
  };

  const goNext = () => {
    const nextStep = Math.min(step + 1, STEPS.length - 1);
    setStep(nextStep);
    trackProductEvent("onboarding_welcome_step", {
      placement: "home_welcome",
      locale,
      state: STEPS[nextStep].id,
      rank: nextStep + 1,
    });
  };

  const isLast = step === STEPS.length - 1;

  return (
    <ModalDialog
      open={open}
      onClose={() => close("dismissed")}
      ariaLabel={copy.label}
      overlayClassName="dochi-welcome-overlay"
      panelClassName="dochi-welcome"
    >
      <div className="dochi-welcome__inner" data-step={STEPS[step].id} data-importing={importing ? "true" : "false"}>
        <button type="button" className="dochi-welcome__close" onClick={() => close("dismissed")} aria-label={copy.close}>
          ×
        </button>

        {/* key로 리마운트해 단계가 바뀔 때마다 등장 모션이 다시 재생된다
            (같은 노드에 재적용하면 CSS 애니메이션이 다시 돌지 않는다). */}
        <div className="dochi-welcome__stage" key={`stage-${step}-${importing}`} aria-hidden="true">
          <DochiSprite pose={importing ? "run" : STEPS[step].pose} />
        </div>

        <div className="dochi-welcome__speech" key={`speech-${step}`}>
          <p className="dochi-welcome__line" aria-live="polite">
            {importing ? copy.importing : copy.lines[step]}
          </p>

          {isLast && !importing && (
            <div className="dochi-welcome__intake">
              <CsvUploader
                toolId="start-gate"
                locale={locale}
                entryVariant="dochi"
                sheetInitiallyOpen
                onImportStart={() => setImporting(true)}
                onPrepared={() => {
                  close("imported");
                  router.push(locale === "en" ? "/en/dochi-result" : "/dochi-result");
                }}
                onImportFailed={() => setImporting(false)}
              />
              <small className="dochi-welcome__privacy">{copy.privacy}</small>
            </div>
          )}

        </div>

        <div className="dochi-welcome__controls">
          <p className="dochi-welcome__progress">{copy.progress(step + 1, STEPS.length)}</p>
          <label className="dochi-welcome__optout">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
            />
            <span>{copy.dontShow}</span>
          </label>
          {isLast ? (
            <button type="button" className="dochi-welcome__skip" onClick={() => close("skipped")}>
              {copy.skip}
            </button>
          ) : (
            <button type="button" className="dochi-welcome__next" ref={nextButtonRef} onClick={goNext}>
              {copy.next}
            </button>
          )}
        </div>
      </div>
    </ModalDialog>
  );
}
