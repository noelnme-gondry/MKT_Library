# v2 Migration Phase 1.4 — 5-18 Marketing-Response Math Engines: PORT PLAN

Source: `index.html` (single-file app). Target: `v2-migration/src/utils/*.js` (ESM).
Faithful port — copy logic VERBATIM. Only allowed edits: decl→`export`, add cross-module `import`, replace a global/DOM read with an explicit param (none needed — see below).

Golden tests are the oracle. All 6 test functions live in index.html and will be re-run against the ported ESM modules.

---

## 0. Headline findings

- **The full transitive closure of the 6 golden tests + the 5 explicitly-required engine functions contains ZERO DOM reads, ZERO `document`/`window` reads, and ZERO global-state (`MMM_METH_STATE`/`CSV_STATE`) reads.** Every function is a pure engine. No parameterization of a global is required.
  - The only functions that touch `MMM_METH_STATE` / `CSV_STATE` (`mmmResolveAbsorb`, `mmmDetectCollinear`, `mmmRankCfg`, `mmmMacroFacts`, `mmmBuildCannibRank`, `regLabFromMmm`, `mmmHasDataForBridge`) are **NOT reachable** from the closure and stay in index.html (deferred UI/state tier).
  - The only `innerHTML` in the neighborhood is in `formatMmmTipText` (UI helper, not reachable). Deferred.
- **`responseMath.js` CANNIBAL_STATS is COMPLETE** — byte-identical logic to index 14149-14387 (only comments dropped). `dayOfYear` present. No completion work needed. `stlWeekly`, `mmmMergedPanel`, `mmmCannibalization`, `mmmRunMmm` all consume `CANNIBAL_STATS` (loess/pearson) → they import from responseMath.js.
- **`CREATIVE_MATH` and `CREATIVE_STATS` already exist in v2** (`creativeMath.js`). `mmmOls` → `CREATIVE_MATH`; `MMR_STATS` → `CREATIVE_MATH`+`CREATIVE_STATS`. In v2, `CREATIVE_CONFIG` is a **parameter** of CREATIVE_STATS methods (not a module const) — nothing extra to port for the closure.
- **Must NEWLY port (not yet in v2):** the t/chi2/beta/gamma numeric primitives, `mmmOls`, `MMR_MATH`, `MMR_STATS` (+`chi2Cdf`), `REG_STATS`, `REG_TRANSFORMS`, all reachable `mmm*` + MK/ADF/KPSS/AR1/Shapley/STL engines, `MMM_STATS`, `REG_FORECAST`, the regLab engine, and the deterministic test fixtures.

---

## 1. Module layout (disjoint owners)

| File | Owns | Imports from |
|---|---|---|
| `responseMath.js` *(exists — no change)* | `dayOfYear`, `CANNIBAL_STATS` | — |
| `statPrimitives.js` *(new)* | `_lgamma`, `_gammaP`, `chi2Cdf`, `_mmmErf`, `mmmNormCdf`, `_Z975`, `_betacf`, `_betai`, `studentTp`, `studentTcrit` | — |
| `regMath.js` *(new)* | `mmmOls`, `REG_STATS`, `REG_TRANSFORMS`, `TRANSFORM_LABELS` | `creativeMath` (CREATIVE_MATH) |
| `mmmMath.js` *(new)* | MK/ADF/KPSS/AR1/Shapley/STL stats + `MMM_STATS` + all reachable `mmm*` feature/fit/diagnostic/forecast engines + configs (`MMM_METH_CONFIG`, `MMM_CANNIB_RULES`, `MMM_CHANNELS`, `MMM_NONMEDIA_GROUPS`) + `MMR_MATH`/`MMR_STATS` | `statPrimitives`, `regMath`, `creativeMath`, `responseMath` |
| `regForecastMath.js` *(new)* | `REG_FORECAST`, `_mmmParseDate`, `_mmmFmtDate` | `regMath` (REG_STATS, REG_TRANSFORMS) |
| `regLabMath.js` *(new)* | `REG_LAB_STATE`, `REG_CACHE`, `regLabGuess`, `regLabLoad`, `regLabReadMapping`, `regLabGroupColOf`, `regLabSignature`, `regLabRun`, `regLabMakeSample` | `regMath` (REG_STATS, REG_TRANSFORMS), `testFixtures` (seededNoise — only for `regLabMakeSample`) |
| `testFixtures.js` *(new)* | `seededNoise`, `generateDates`, `_mmrLcg` | — |

> Rationale for `statPrimitives.js`: `mmmNormCdf`/`studentTp`/`studentTcrit`/`chi2Cdf` are consumed by BOTH `regMath` (via `mmmOls`… actually only mmm) and `mmmMath`. Extracting them breaks a would-be cycle between regMath and mmmMath and gives one owner. `mmmOls` stays in regMath (scout-suggested) since it only needs CREATIVE_MATH; MMM_STATS in mmmMath imports `mmmOls`, `mmmNormCdf`, `studentTp`, `studentTcrit`.

---

## 2. Verified symbol line ranges (index.html)

### statPrimitives.js
| Symbol | Lines | Deps |
|---|---|---|
| `_lgamma` | 20177-20196 | — |
| `_gammaP` | 20198-20232 | `_lgamma` |
| `chi2Cdf` | 20233-20235 | `_gammaP` |
| `_mmmErf` | 20599-20612 | — |
| `mmmNormCdf` | 20613-20615 | `_mmmErf` |
| `_Z975` | 20616 (const, single line) | — |
| `_betacf` | 20617-20649 | — |
| `_betai` | 20650-20663 | `_betacf`, `_lgamma` |
| `studentTp` | 20665-20668 | `_betai` |
| `studentTcrit` | 20670-20679 | `studentTp` |

### regMath.js
| Symbol | Lines | Deps |
|---|---|---|
| `mmmOls` | 20682-20727 | `CREATIVE_MATH` (import) |
| `REG_STATS` (IIFE) | 21320-21480 | self-contained (own inv/gammaln/betai/ols) |
| `REG_TRANSFORMS`+`TRANSFORM_LABELS` (IIFE) | 21482-21525 | self-contained |

### mmmMath.js — stats tier (MMM_STATS members)
| Symbol | Lines | Deps |
|---|---|---|
| `_mkScore` | 20730-20736 | — |
| `_mkVarS` | 20737-20745 | — |
| `_mkZ` | 20746-20751 | — |
| `_mkVerdict` | 20752-20759 | `_Z975`, `mmmNormCdf` |
| `_theilSen` | 20760-20768 | — |
| `_rankAvg` | 20769-20782 | — |
| `_mmmAcf` | 20783-20796 | — |
| `mkOriginal` | 20797-20812 | `_mkScore`,`_mkVarS`,`_mkVerdict`,`_mkZ`,`_theilSen` |
| `mkHamedRao` | 20813-20842 | `_Z975`,`_mkScore`,`_mkVarS`,`_mkVerdict`,`_mkZ`,`_mmmAcf`,`_rankAvg`,`_theilSen` |
| `mkSeasonal` | 20843-20857 | `_mkScore`,`_mkVarS`,`_mkVerdict`,`_mkZ` |
| `_mackinnonpCT` | 20860-20873 | `mmmNormCdf` |
| `adfCT` | 20874-20911 | `_mackinnonpCT`,`mmmOls` |
| `_kpssAutolag` | 20914-20932 | — |
| `kpssCT` | 20933-20972 | `_kpssAutolag`,`mmmOls` |
| `ljungBox` | 20975-20982 | `_mmmAcf`,`chi2Cdf` |
| `_yuleWalker1` | 20985-20997 | — |
| `fitAR1` | 20998-21044 | `_yuleWalker1`,`mmmOls`,`studentTcrit`,`studentTp` |
| `shapleyR2Exact` | 21047-21095 | `mmmOls` |
| `stlWeekly` | 21100-21140 | `CANNIBAL_STATS` (import responseMath) |
| `MMM_STATS` (object) | 21142-21157 | aggregates: `mmmOls`,`mkOriginal`,`mkHamedRao`,`mkSeasonal`,`adfCT`,`kpssCT`,`ljungBox`,`fitAR1`,`shapleyR2Exact`,`stlWeekly`,`mmmNormCdf`,`studentTp`,`studentTcrit`,`_theilSen` |

### mmmMath.js — MMR fit tier (used by mmmFitHac / mmmTrendExistence)
| Symbol | Lines | Deps |
|---|---|---|
| `MMR_MATH` | 20237-20284 | self-contained |
| `MMR_STATS` | 20286-20434 | `CREATIVE_MATH`,`CREATIVE_STATS` (import creativeMath), `MMR_MATH`, `chi2Cdf` (import statPrimitives) |

### mmmMath.js — configs
| Symbol | Lines | Deps |
|---|---|---|
| `MMM_METH_CONFIG` | 21649-21666 | — |
| `MMM_CANNIB_RULES` | 21669-21686 | — |
| `mmmIsBrandIntercept` | 21687-21692 | `MMM_CANNIB_RULES` |
| `MMM_CHANNELS` | 22334-22335 | — |
| `MMM_NONMEDIA_GROUPS` | 22910? → **24910-24915** | — (array literal) |

### mmmMath.js — feature / fit / diagnostic / forecast engines
| Symbol | Lines | Deps |
|---|---|---|
| `_mmmChans` | 22342-22359 | `MMM_CHANNELS` |
| `mmmAdstock` | 22369-22374 | — |
| `mmmLnMedia` | 22375-22390 | `mmmAdstock` |
| `_mean` | 22391-22393 | — |
| `_pstd` | 22394-22397 | `_mean` |
| `mmmChannelCoverage` | 22400-22417 | `_mmmChans` |
| `mmmSparseChannels` | 22418-22423 | `mmmChannelCoverage` |
| `_mmmStepSeries` | 22427-22433 | — |
| `mmmBuildFeatures` | 22482-22558 | `_mean`,`_mmmChans`,`_mmmStepSeries`,`_nonRedundantCols`,`_pstd`,`fitAR1`,`mmmLnMedia`,`mmmOls`,`mmmSparseChannels` |
| `mmmSheetDesign` | 22560-22628 | `_mmmChans` |
| `_designConst` | 22629-22631 | — |
| `mmmFitHac` | 22632-22638 | `MMR_STATS`,`_designConst` |
| `_nonRedundantCols` | 22657-22680 | — |
| `mmmFitNamed` | 22681-22706 | `_designConst`,`_nonRedundantCols`,`mmmFitHac`,`mmmOls`,`studentTp` |
| `mmmValidate` | 22743-22774 | `_mmmChans` |
| `mmmAudit` | 22777-22859 | `_mean`,`mmmFitNamed`,`mmmSheetDesign` |
| `mmmTrendExistence` | 22862-22914 | `MMR_STATS`,`_designConst`,`_mean`,`adfCT`,`kpssCT`,`mkHamedRao`,`mkOriginal`,`mkSeasonal`,`mmmBuildFeatures`,`mmmOls`,`stlWeekly` |
| `_mmmPrewhiten` | 22919-22930 | `REG_STATS` (import regMath) |
| `mmmGranger` | 22936-23009 | `REG_STATS`,`_mmmPrewhiten` |
| `mmmDeseasonHoliday` | 23014-23049 | `REG_STATS` |
| `mmmIRF` | 23053-23154 | `REG_STATS`,`_mmmPrewhiten` |
| `mmmChangePoints` | 23160-23255 | — |
| `mmmChangePointDrivers` | 23258-23311 | `_mmmChans` |
| `mmmCannibalization` | 23315-23550 | `MMM_CANNIB_RULES`,`CANNIBAL_STATS`,`_mean`,`_mmmChans`,`mmmGranger`,`mmmIsBrandIntercept`,`mmmOls`,`studentTp` |
| `_cvPredict` | 23554-23571 | `mmmOls` |
| `mmmSelectAdstock` | 23572-23596 | `_cvPredict`,`_designConst`,`_mean`,`mmmBuildFeatures` |
| `mmmShapleyGroups` | 23597-23622 | — |
| `mmmRunMmm` | 23623-23696 | `CANNIBAL_STATS`,`CREATIVE_MATH`,`_designConst`,`_mmmChans`,`mmmBuildFeatures`,`mmmElasticities`,`mmmSaturation`,`mmmSelectAdstock`,`mmmShapleyGroups`,`mmmSparseChannels`,`shapleyR2Exact` |
| `_mmmLogFitAR1` | 23699-23708 | `fitAR1` |
| `mmmElasticities` | 23709-23726 | `_designConst`,`_mmmLogFitAR1`,`mmmBuildFeatures` |
| `mmmSaturation` | 23727-23749 | `_designConst`,`fitAR1`,`mmmBuildFeatures` |
| `mmmChannelEffects` | 23752-23828 | `_designConst`,`_mmmChans`,`_mmmLogFitAR1`,`fitAR1`,`mmmBuildFeatures`,`mmmChannelCoverage` |
| `mmmRidgeFit` | 23974-24046 | — |
| `mmmMergedPanel` | 24048-24093 | `CANNIBAL_STATS`,`_mmmChans`,`mmmLnMedia` |
| `mmmWeeklyDecomp` | 24098-24226 | `MMM_NONMEDIA_GROUPS`,`_designConst`,`_mean`,`_mmmChans`,`mmmBuildFeatures`,`mmmMergedPanel`,`mmmOls`,`mmmRidgeFit`,`mmmShapleyGroups` |
| `mmmForecast` | 24234-24469 | `_designConst`,`_mean`,`_mmmChans`,`_mmmFmtDate`,`_mmmStepSeries`,`mmmBuildFeatures`,`mmmMergedPanel`,`mmmOls`,`mmmRidgeFit`,`studentTcrit`,`studentTp` |

> `_mmmFmtDate` is consumed by both `mmmForecast` (mmmMath) and `REG_FORECAST` (regForecastMath). It is a tiny date-format pure fn. **Owner = regForecastMath.js**; mmmMath imports it. (Alternatively duplicate — but single owner preferred.)

### regForecastMath.js
| Symbol | Lines | Deps |
|---|---|---|
| `_mmmParseDate` | 24928-24956 | — |
| `_mmmFmtDate` | 24985-24992 | — |
| `REG_FORECAST` (object) | 29550-29806 | `REG_STATS`,`REG_TRANSFORMS` (import regMath), `_mmmParseDate` |

### regLabMath.js
| Symbol | Lines | Deps |
|---|---|---|
| `REG_LAB_STATE` | 29312-29330 | — |
| `REG_CACHE` | 29331 (single line) | — |
| `_REG_ROLES` | 29332-29339 | — (optional; not touched by golden test) |
| `regLabGuess` | 29342-29377 | — |
| `regLabLoad` | 29379-29392 | `regLabGuess`, `REG_LAB_STATE`, `REG_CACHE` |
| `regLabGroupColOf` | 29490-29495 | `REG_LAB_STATE` |
| `regLabReadMapping` | 29497-29535 | `REG_LAB_STATE` |
| `regLabSignature` | 29536-29542 | `REG_LAB_STATE` |
| `regLabMakeSample` | 29442-29489 | `seededNoise` (import testFixtures) |
| `regLabRun` | 29882-29960 | `regLabReadMapping`,`REG_TRANSFORMS`,`REG_STATS`,`REG_LAB_STATE`,`REG_CACHE`,`regLabSignature` |

> NOT ported to regLabMath (they read `CSV_STATE`/`MMM_METH_STATE` globals, are MMM-bridge/UI): `mmmHasDataForBridge` (29396), `regLabFromMmm` (29404). Deferred.

### testFixtures.js
| Symbol | Lines | Deps |
|---|---|---|
| `generateDates` | 16358-16364 | — |
| `seededNoise` | 16366-16373 | — |
| `_mmrLcg` | 20437-20443 | — |

---

## 3. Test → module map (verified test boundaries)

| Golden test | Lines | Needs modules |
|---|---|---|
| `runCannibalTests` | 16380-16522 | `responseMath` (CANNIBAL_STATS), `testFixtures` (generateDates, seededNoise) |
| `runMmmStatTests` | 21159-21309 | `regMath` (mmmOls), `mmmMath` (mkOriginal, mkHamedRao, adfCT, kpssCT, ljungBox, fitAR1, shapleyR2Exact, stlWeekly, MMM_STATS), `statPrimitives` (studentTp), `testFixtures` (_mmrLcg) |
| `runRegStatsTests` | 21527-21635 | `regMath` (REG_STATS, REG_TRANSFORMS) |
| `runMmmMethTests` | 24525-24860 | `mmmMath` (MMM_METH_CONFIG, mmmValidate, mmmSelectAdstock, mmmRunMmm, mmmTrendExistence, mmmCannibalization, mmmGranger, mmmChangePoints, mmmChangePointDrivers, mmmIRF, mmmDeseasonHoliday, mmmAudit), `testFixtures` (_mmrLcg) |
| `runRegForecastTests` | 29808-29877 | `regForecastMath` (REG_FORECAST) |
| `runRegLabTests` | 30841-30927 | `regLabMath` (regLabMakeSample, regLabLoad, regLabReadMapping, regLabRun, REG_LAB_STATE) |

---

## 4. Warnings / thorny points

1. **`REG_STATS` and `mmmOls` implement DIFFERENT OLS** (different matrix inverse + ridge fallback). Keep BOTH verbatim; do not unify. `REG_STATS.ols` has its own Gauss-Jordan `inv` with a `throw` on singular + `1e-8` ridge fallback; `mmmOls` delegates to `CREATIVE_MATH.inverse`. Golden β-recovery values differ (2,3,-1.5 vs 5,2,-0.5).
2. **`REG_STATS` / `REG_TRANSFORMS` are IIFEs.** Port the whole `const X = (() => { … })();` verbatim, then `export const X`. Do not flatten the closure — internal helpers (inv, gammaln, betacf, betai, tSF, tinv, adstock, mean, std) must stay inside.
3. **`_Z975` and `REG_CACHE` are single-line consts** (20616, 29331). Ranges given as single line.
4. **`MMM_NONMEDIA_GROUPS` real range is 24910-24915** (a brace-balancer over-spans into `_mmmParseDate`; it is a plain string array). `_MMM_ROLES` (24916-24926) is NOT a dependency — do not port to the math layer.
5. **`_mmmFmtDate` shared owner**: lives in regForecastMath.js but imported by mmmMath.js (`mmmForecast`). No cycle (regForecastMath imports regMath only; mmmMath imports regForecastMath's `_mmmFmtDate` + regMath). Confirm no reverse import regForecastMath→mmmMath (there is none).
6. **No `Math.random` anywhere in the closure.** Determinism intact. Test RNGs (`seededNoise`, `_mmrLcg`) are LCGs — copy verbatim.
7. **`stlWeekly` depends on the completed `CANNIBAL_STATS.loess`** in responseMath.js — verify that method exists there (it does, 14197-14249 equivalent). Any drift in loess would silently change STL golden output.
8. **Deferred UI/state helpers that some math neighbors call but the closure does NOT reach**: `formatMmmTipText` (innerHTML), `mmmResolveAbsorb`/`mmmDetectCollinear`/`mmmMacroFacts`/`mmmRankCfg`/`mmmBuildCannibRank` (`MMM_METH_STATE` reads), `mmmConf*`/`mmmTip`/`mmm*Plain`/`MMM_GLOSSARY`/`CANNIBAL_RANK`/`RANK_CFG` (text/ranking UI), `regLabFromMmm`/`mmmHasDataForBridge` (`CSV_STATE` bridge). These stay in index.html — Phase 4.5.
9. **`MMM_STATS` aggregates across two modules.** It is defined in mmmMath.js and must import `mmmOls`, `mmmNormCdf`, `studentTp`, `studentTcrit` (the latter three via statPrimitives, mmmOls via regMath). `runMmmStatTests` calls the standalone functions directly, but MMM_STATS is exported for parity with index (window.MMM_STATS).
10. **`ljungBox` and `mkSeasonal` are exported in MMM_STATS and called by `runMmmStatTests`** even though not otherwise reachable from the 5 engine entrypoints — include them in mmmMath.js (they are in the golden test's directCalls).
