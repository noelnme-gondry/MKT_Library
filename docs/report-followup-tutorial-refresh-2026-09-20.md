# Weekly report follow-up and tutorial refresh

## Scope

- Preserve the weekly-marketing-report-template URLs in Korean and English.
- Add a clearly synthetic third week, a completed follow-up worksheet and a
  direct 24-second decision tutorial entry. The practice file contains 42 rows.
- Campaign A CPI changes from 1,500 to 1,200 with unchanged spending; it remains
  20% above week one's 1,000. The example separates keeping a budget decision,
  revising an investigation and withholding a causal conclusion.
- Demo mode is for exploration. Saving practice requires a separate example
  project and direct CSV upload; published copy explains the access boundary.
- Replace all nine tutorial topics in both languages: 36 to 24 seconds, four
  concise chapters, current UI captures, anchored zoom and fast transitions.
  Videos remain silent with captions, transcript and manual playback.
- Capture uses synthetic data and local account/payment fixtures. It does not
  make purchases or send real account memos. The decision clip shows a new-data
  follow-up; device saving precedes the optional account memo.

## Verification

- test:all: 505 files passed, one skipped; 4,256 tests passed, three skipped.
- lint and production build passed.
- 12 targeted Playwright cases passed against the final production build and
  rendered media: desktop/mobile, KO/EN, dark/light playback, 12-second seeking,
  keyboard close/focus return, article tutorial and 42-row analysis entry.
- All 18 HyperFrames checks passed. All rendered files are 1280×720, 24 seconds.
- Reviewed chapter contact sheets, report controls and numeric follow-up.
- No ranking or conversion uplift has been measured. These changes add useful
  content and a working product path; they do not establish willingness to pay.

## Reproduction

See scripts/tutorials/README.md. The registry owns copy and timing; the build
manifest drives rendering checks. Working compositions and capture artifacts are
outside the repository. Original checkout changes were preserved in place.
