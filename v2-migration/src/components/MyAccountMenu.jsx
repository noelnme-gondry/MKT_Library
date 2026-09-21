"use client";
import Link from "next/link";
export default function MyAccountMenu({ locale = "ko" }) {
  const en = locale === "en";
  return <Link className="btn ghost my-account-menu__trigger" href={en ? "/en/account" : "/account"}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg><span>{en ? "My account" : "마이페이지"}</span></Link>;
}
