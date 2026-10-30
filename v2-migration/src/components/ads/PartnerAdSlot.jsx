"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ADSTERRA_DISCLOSURE, ADSTERRA_FORMATS, pageAdPlacement, PARTNER_AD_DISCLOSURE, PARTNER_AD_FORMATS, PARTNER_AD_PLACEMENTS, partnerAdFormat, partnerAdInlineLayout, partnerAdRailFormat } from "@/lib/partnerAds";
import { adsterraSource, ADSTERRA_FRAME_SANDBOX, partnerAdSource, PARTNER_FRAME_SANDBOX } from "@/lib/partnerAdFrame";
import usePartnerAdMode from "./usePartnerAdMode";
import usePartnerAdView from "./usePartnerAdView";

// 숨긴 슬롯도 부모를 관찰한다. 창 확대·메뉴 접기·배율 변경 후 다시 표시할 수 있다.
function useParentWidth(ref, inline = false, fullBleed = false) {
  const [layout, setLayout] = useState({ width: 0, marginLeft: 0 });
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const boundary = parent.closest(".main") || parent;
    const measure = () => {
      const style = getComputedStyle(parent);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const slotStyle = getComputedStyle(ref.current);
      const safeLeft = parseFloat(slotStyle.getPropertyValue("--ad-safe-left")) || 0;
      const safeRight = parseFloat(slotStyle.getPropertyValue("--ad-safe-right")) || 0;
      const contentWidth = parent.clientWidth - paddingLeft - paddingRight;
      let next = { width: Math.max(0, contentWidth - safeLeft - safeRight), marginLeft: 0 };
      if (inline) {
        const contentLeft = parent.getBoundingClientRect().left + parent.clientLeft + paddingLeft;
        const bounds = boundary.getBoundingClientRect();
        next = partnerAdInlineLayout({
          contentLeft, contentWidth,
          preferredWidth: fullBleed ? parent.clientWidth : contentWidth,
          maxWidth: parseFloat(slotStyle.maxWidth) || Infinity,
          safeLeft: Math.max(safeLeft, bounds.left + boundary.clientLeft),
          safeRight: Math.min(document.documentElement.clientWidth - safeRight, bounds.left + boundary.clientLeft + boundary.clientWidth),
        });
      }
      setLayout(previous => previous.width === next.width && previous.marginLeft === next.marginLeft ? previous : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    if (boundary !== parent) observer.observe(boundary);
    observer.observe(document.documentElement);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [ref, inline, fullBleed]);
  return layout;
}

function AdCreative({ placement, format, locale, mode }) {
  const frameRef = useRef(null);
  usePartnerAdView(frameRef, { placement, format, locale, mode });
  const en = locale === "en";
  const provider = PARTNER_AD_PLACEMENTS[placement].provider;
  const adsterra = provider === "adsterra";
  const size = (adsterra ? ADSTERRA_FORMATS : PARTNER_AD_FORMATS)[format];
  return <div className="partner-ad-preview" style={{ "--partner-ad-width": `${size.width}px`, "--partner-ad-height": `${size.height}px` }}>
    <p className="partner-ad-preview__label">{mode === "preview" ? (en ? "Ad space · preview" : "광고 영역 · 미리보기") : (en ? "Advertisement" : "광고")}</p>
    {mode === "live" ? <iframe ref={frameRef} className="partner-ad-frame" data-ad-format={format} data-ad-provider={provider} title={`${PARTNER_AD_PLACEMENTS[placement][en ? "en" : "ko"]} · ${adsterra ? "Adsterra" : "Coupang Partners"}`} src={adsterra ? adsterraSource(format) : partnerAdSource(format)} width={size.width} height={size.height} loading="lazy" sandbox={adsterra ? ADSTERRA_FRAME_SANDBOX : PARTNER_FRAME_SANDBOX} referrerPolicy="origin" scrolling="no" /> : <div className="partner-ad-preview__frame" data-ad-format={format}>
      <strong>{size.width} × {size.height}</strong>
      <span>{PARTNER_AD_PLACEMENTS[placement][en ? "en" : "ko"]}</span>
    </div>}
    <p className="partner-ad-preview__note">{(adsterra ? ADSTERRA_DISCLOSURE : PARTNER_AD_DISCLOSURE)[en ? "en" : "ko"]}</p>
  </div>;
}

function HorizontalSlot({ placement, locale, mode }) {
  const ref = useRef(null);
  const layout = useParentWidth(ref, true, placement === "blog-byline");
  const { width } = layout;
  const format = partnerAdFormat(placement, width);
  return <aside ref={ref} style={layout} className={`partner-ad-slot partner-ad-slot--${placement}`} data-ad-slot={placement} hidden={!format} aria-label={PARTNER_AD_PLACEMENTS[placement][locale === "en" ? "en" : "ko"]}>
    {format && <AdCreative placement={placement} format={format} locale={locale} mode={mode} />}
  </aside>;
}

export default function PartnerAdSlot({ placement, locale = "ko" }) {
  const mode = usePartnerAdMode();
  if (mode === "off" || !PARTNER_AD_PLACEMENTS[placement] || placement === "site-rail") return null;
  return <HorizontalSlot placement={placement} locale={locale} mode={mode} />;
}

function RailSlot({ locale, mode }) {
  const ref = useRef(null);
  const [host, setHost] = useState(null);
  const attach = useCallback(node => { ref.current = node; setHost(node?.parentElement || null); }, []);
  const { width } = useParentWidth(ref);
  const pathname = usePathname();
  const format = partnerAdRailFormat(pathname, width);
  // Header가 한 프레임만 소유한다. portal은 본문 뒤에 붙어 모바일 읽기·탭 순서도 지킨다.
  return <><span ref={attach} className="partner-ad-anchor" hidden />{host && createPortal(
    <aside className={format === "compact" ? "partner-ad-slot partner-ad-slot--rail-inline" : "partner-ad-rail"} data-ad-slot="site-rail" hidden={!format} style={format === "rail" ? { width: ADSTERRA_FORMATS.rail.width } : undefined} aria-label={PARTNER_AD_PLACEMENTS["site-rail"][locale === "en" ? "en" : "ko"]}>
      {format && <AdCreative placement="site-rail" format={format} locale={locale} mode={mode} />}
    </aside>, host
  )}</>;
}

export function PartnerAdRail({ locale = "ko" }) {
  const mode = usePartnerAdMode();
  if (mode === "off") return null;
  return <RailSlot locale={locale} mode={mode} />;
}

export function PartnerAdDisclosure({ locale = "ko" }) {
  const pathname = usePathname();
  const disclosure = PARTNER_AD_PLACEMENTS[pageAdPlacement(pathname)].provider === "coupang" ? PARTNER_AD_DISCLOSURE : ADSTERRA_DISCLOSURE;
  const mode = usePartnerAdMode();
  if (mode === "off") return null;
  return <p className="partner-ad-disclosure">{disclosure[locale === "en" ? "en" : "ko"]}</p>;
}
