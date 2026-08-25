"use client";

import React, { createContext, useContext } from "react";

const AnalysisExportContext = createContext(null);

export function AnalysisExportProvider({ value, children }) {
  return <AnalysisExportContext.Provider value={value}>{children}</AnalysisExportContext.Provider>;
}

export function useAnalysisExport() {
  return useContext(AnalysisExportContext);
}
