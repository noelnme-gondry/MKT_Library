"use client";

import { useEffect } from "react";

export default function DocumentLanguage({ lang }) {
  useEffect(() => {
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = "ko";
    };
  }, [lang]);

  return null;
}
