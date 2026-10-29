"use client";
import { useEffect, useRef, useState } from "react";
import { PARTNER_AD_DISCLOSURE, PARTNER_AD_FORMATS, PARTNER_AD_PLACEMENTS, PARTNER_AD_RAIL_MIN_WIDTH, partnerAdFormat } from "@/lib/partnerAds";
import { partnerAdSource, PARTNER_FRAME_SANDBOX } from "@/lib/partnerAdFrame";
import usePartnerAdMode from "./usePartnerAdMode";
import usePartnerAdView from "./usePartnerAdView";

// 숨긴 슬롯도 부모를 관찰한다. 창 확대·메뉴 접기·배율 변경 후 다시 표시할 수 있다.
function useParentWidth(ref, fullBleed = false) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(parent);
      const inset = fullBleed ? 0 : (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const slotStyle = getComputedStyle(ref.current);
      const slotInset = (parseFloat(slotStyle.paddingLeft) || 0) + (parseFloat(slotStyle.paddingRight) || 0);
      setWidth(Math.max(0, parent.clientWidth - inset - slotInset));
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [ref, fullBleed]);
  return width;
}

function AdCreative({ placement, format, locale, mode }) {
  const frameRef = useRef(null);
  usePartnerAdView(frameRef, { placement, format, locale, mode });
  const en = locale === "en";
  const size = PARTNER_AD_FORMATS[format];
  return <div className="partner-ad-preview" style={{ "--partner-ad-width": `${size.width}px`, "--partner-ad-height": `${size.height}px` }}>
    <p className="partner-ad-preview__label">{mode === "preview" ? (en ? "Ad space · preview" : "광고 영역 · 미리보기") : (en ? "Advertisement" : "광고")}</p>
    {mode === "live" ? <iframe ref={frameRef} className="partner-ad-frame" data-ad-format={format} title={`${PARTNER_AD_PLACEMENTS[placement][en ? "en" : "ko"]} · Coupang Partners`} src={partnerAdSource(format)} width={size.width} height={size.height} loading="lazy" sandbox={PARTNER_FRAME_SANDBOX} referrerPolicy="origin" scrolling="no" /> : <div className="partner-ad-preview__frame" data-ad-format={format}>
      <strong>{size.width} × {size.height}</strong>
      <span>{PARTNER_AD_PLACEMENTS[placement][en ? "en" : "ko"]}</span>
    </div>}
    <p className="partner-ad-preview__note">{PARTNER_AD_DISCLOSURE[en ? "en" : "ko"]}</p>
  </div>;
}

function HorizontalSlot({ placement, locale, mode }) {
  const ref = useRef(null);
  const width = useParentWidth(ref, placement === "blog-byline");
  const format = partnerAdFormat(placement, width);
  return <aside ref={ref} className={`partner-ad-slot partner-ad-slot--${placement}`} data-ad-slot={placement} hidden={!format} aria-label={PARTNER_AD_PLACEMENTS[placement][locale === "en" ? "en" : "ko"]}>
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
  const width = useParentWidth(ref);
  return <aside ref={ref} className="partner-ad-rail" data-ad-slot="site-rail" hidden={width < PARTNER_AD_RAIL_MIN_WIDTH} style={{ width: PARTNER_AD_FORMATS.rail.width }} aria-label={PARTNER_AD_PLACEMENTS["site-rail"][locale === "en" ? "en" : "ko"]}>
    {width >= PARTNER_AD_RAIL_MIN_WIDTH && <AdCreative placement="site-rail" format="rail" locale={locale} mode={mode} />}
  </aside>;
}

export function PartnerAdRail({ locale = "ko" }) {
  const mode = usePartnerAdMode();
  if (mode === "off") return null;
  return <RailSlot locale={locale} mode={mode} />;
}

export function PartnerAdDisclosure({ locale = "ko" }) {
  const mode = usePartnerAdMode();
  if (mode === "off") return null;
  return <p className="partner-ad-disclosure">{PARTNER_AD_DISCLOSURE[locale === "en" ? "en" : "ko"]}</p>;
}
