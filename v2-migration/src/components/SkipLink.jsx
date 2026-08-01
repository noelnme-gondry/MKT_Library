"use client";

import { usePathname } from "next/navigation";

export default function SkipLink() {
  const pathname = usePathname() || "/";
  const isEnglish = pathname === "/en" || pathname.startsWith("/en/");

  return (
    <a className="skip-link" href="#main-content">
      {isEnglish ? "Skip to main content" : "본문으로 바로가기"}
    </a>
  );
}
