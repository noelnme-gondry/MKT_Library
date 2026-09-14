"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ModalDialog from "@/components/ds/ModalDialog";
import { VIDEO_TUTORIALS, TUTORIAL_STEP_SECONDS, tutorialIdsForPath, tutorialMedia } from "@/lib/videoTutorials";
import { trackProductEvent } from "@/lib/analytics";

const OPEN_EVENT = "gop:video-tutorial";
const PAGE_CONTROLS = 'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [contenteditable="true"]';

// A floating help entry must yield to the real task underneath it. Probe only
// its small viewport footprint instead of reading every control on every scroll.
function useLauncherClearance(ref, active) {
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let settleTimer = 0;
    let scrolling = false;
    const mountedLauncher = ref.current;
    const check = () => {
      frame = 0;
      if (scrolling) return;
      const launcher = ref.current;
      if (!launcher) return;
      const rect = launcher.getBoundingClientRect();
      let overlaps = false;
      for (let x = rect.left + 1; x < rect.right && !overlaps; x += 16) {
        for (let y = rect.top + 1; y < rect.bottom && !overlaps; y += 16) {
          overlaps = document.elementsFromPoint(x, y).some(node =>
            !launcher.contains(node) && node.closest(PAGE_CONTROLS));
        }
      }
      launcher.toggleAttribute("data-obscures-control", overlaps);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    const onScroll = () => {
      // Stay out of the way through scrolling and its settling frames.
      scrolling = true;
      ref.current?.setAttribute("data-obscures-control", "");
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => { scrolling = false; schedule(); }, 150);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", schedule);
      mountedLauncher?.removeAttribute("data-obscures-control");
    };
  }, [ref, active]);
}
export function VideoHelpButton({ topic, locale = "ko", className = "tutorial-inline", onOpen, children }) {
  return <button type="button" className={className} aria-haspopup="dialog" onClick={event => {
    const trigger = onOpen?.() || event.currentTarget;
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { topic, trigger } }));
  }}><span aria-hidden="true">▷</span> {children || (locale === "en" ? "Video guide" : "영상으로 보기")}</button>;
}

function TutorialLauncher({ pathname, locale }) {
  const [topic, setTopic] = useState(null);
  const [failed, setFailed] = useState(false);
  const [chapter, setChapter] = useState(0);
  const videoRef = useRef(null);
  const launcherRef = useRef(null);
  useLauncherClearance(launcherRef, !topic);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const en = locale === "en";
  const ids = tutorialIdsForPath(pathname);
  const tutorial = VIDEO_TUTORIALS.find(item => item.id === topic);
  const media = tutorial ? tutorialMedia(tutorial.id, locale) : null;
  const select = id => { videoRef.current?.pause(); setFailed(false); setChapter(0); setTopic(id); };
  useEffect(() => {
    const open = event => {
      const requested = event.detail?.topic || tutorialIdsForPath(pathname, { projectManagement: !!document.querySelector("#project-management") })[0] || "import";
      if (!VIDEO_TUTORIALS.some(item => item.id === requested)) return;
      triggerRef.current = event.detail?.trigger;
      setFailed(false);
      setChapter(0);
      setTopic(requested);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, [pathname]);
  if (!ids.length && !tutorial) return null;
  const close = () => { videoRef.current?.pause(); setTopic(null); };
  const event = name => trackProductEvent(name, { source: "video_tutorial", content_slug: topic, locale });
  return <>
    <button ref={launcherRef} type="button" className="tutorial-launcher no-print" aria-haspopup="dialog" onClick={event => {
      triggerRef.current = event.currentTarget;
      const projectManagement = !!document.querySelector("#project-management");
      const contextual = tutorialIdsForPath(pathname, { projectManagement });
      select(contextual[0] || ids[0]);
    }}><span aria-hidden="true">▷</span><span>{en ? "Video guide" : "영상 사용 안내"}</span></button>
    <ModalDialog open={!!tutorial} onClose={close} ariaLabel={en ? "Video guide" : "영상 사용 안내"} initialFocusRef={closeRef} returnFocusRef={triggerRef} overlayClassName="tutorial-overlay" panelClassName="tutorial-panel">
      {tutorial && <>
        <header className="tutorial-header"><div><p>{en ? "FOLLOW ALONG" : "화면을 보며 따라 하기"}</p><h2>{tutorial[locale]}</h2></div><button type="button" className="tutorial-close" ref={closeRef} onClick={close} aria-label={en ? "Close video guide" : "영상 안내 닫기"}>×</button></header>
        <div className="tutorial-layout">
          <div className="tutorial-main">
            <video key={topic} ref={videoRef} className="tutorial-video" controls playsInline preload="none" width="1280" height="720" poster={media.poster} aria-label={tutorial[locale]} aria-describedby="tutorial-video-note" onLoadedMetadata={() => { if (videoRef.current) videoRef.current.currentTime = chapter; }} onPlay={() => event("tutorial_video_started")} onEnded={() => event("tutorial_video_completed")} onError={() => setFailed(true)}>
              <source src={media.video} type="video/mp4" onError={() => setFailed(true)} />
              <track kind="captions" src={media.captions} srcLang={locale} label={en ? "English" : "한국어"} />
              {en ? "Read the steps below if video is unavailable." : "영상 재생이 지원되지 않으면 아래 설명을 확인하세요."}
            </video>
            <p id="tutorial-video-note" className="tutorial-note">{en ? "36 sec · silent, with on-screen instructions · synthetic demo data" : "36초 · 소리 없이 화면 설명으로 안내 · 가상 데모 데이터"}</p>
            {["import", "mapping", "sheets"].includes(topic) && <p className="tutorial-note">{en ? "Demonstrated in the dashboard. Required fields and supported file types differ by tool; use the input guide on your current screen." : "운영 대시보드의 입력 화면을 기준으로 설명합니다. 도구별 필수 컬럼과 지원 파일은 현재 화면의 입력 안내를 따르세요."}</p>}
            {failed && <p role="alert">{en ? "Video could not load. Read the steps below or reopen this guide to retry." : "영상을 불러오지 못했습니다. 아래 설명을 읽거나 안내를 다시 열어 재시도하세요."}</p>}
            <details className="tutorial-transcript"><summary>{en ? "Read the steps" : "단계별 설명 읽기"}</summary><ol>{tutorial.steps.map((step, index) => <li key={index}><button type="button" onClick={() => {
              const player = videoRef.current;
              if (player) {
                const time = index * TUTORIAL_STEP_SECONDS;
                setChapter(time);
                if (player.readyState > 0) player.currentTime = time;
                else { player.preload = "metadata"; player.load(); }
                player.focus();
              }
            }}>{String(index * TUTORIAL_STEP_SECONDS).padStart(2, "0")}s · {step[locale].title}</button><p>{step[locale].body}</p></li>)}</ol></details>
            <Link className="tutorial-guide-link" href={`${en ? "/en" : ""}${tutorial.guide}`} onClick={close}>{en ? "Open the related page" : "관련 화면 열기"} →</Link>
          </div>
          <nav className="tutorial-topics" aria-label={en ? "Tutorial topics" : "영상 안내 주제"}>{[...new Set([...ids, ...VIDEO_TUTORIALS.map(item => item.id)])].map(id => {
            const item = VIDEO_TUTORIALS.find(entry => entry.id === id);
            return <button key={id} type="button" aria-current={topic === id ? "true" : undefined} onClick={() => select(id)}><span aria-hidden="true">▷</span>{item[locale]}</button>;
          })}</nav>
        </div>
      </>}
    </ModalDialog>
  </>;
}
export default function VideoTutorialHelp({ locale = "ko" }) {
  const pathname = usePathname();
  return <TutorialLauncher key={pathname} pathname={pathname} locale={locale === "en" ? "en" : "ko"} />;
}
