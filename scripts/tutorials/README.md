# Product video tutorials

`v2-migration/src/lib/videoTutorials.js` owns localized topics, chapter text,
media URLs and route coverage. Videos illustrate shared workflows; the current
tool's own input contract takes precedence over the dashboard mapping example.

The player loads no assets before it is opened. It has explicit native playback,
caption tracks, a timestamped transcript and Radix focus restoration. CSV mapping
and Sheets have contextual inline entry buttons; published CSV routes also have
the floating launcher. The project manager chooses its own topic when opened
inside the weekly-review route. Paid access is never changed by the player.
The launcher yields during scrolling or when it covers page controls. The header
utility menu always provides the same contextual guide, with focus returned to
its summary after closing the player.

## Reproduce (local only)

Run from the repository root, with the application dev server on port 3100.

1. `npx hyperframes init /tmp/gop-tutorial-videos --non-interactive --example=blank --skill=general-video`
2. Place GSAP 3.14.2 in `/tmp/gop-tutorial-videos/assets/gsap.min.js`.
3. `node scripts/tutorials/capture.mjs`
4. `node scripts/tutorials/build.mjs`
5. `node scripts/tutorials/render.mjs`

The capture script uses isolated browser profiles, actual controls and synthetic
campaign data. Payment and account API responses are local test fixtures; it
never sends a real account memo or performs a real purchase. Capture waits for hydration, dismisses the survey through a local preference,
and follows in-app navigation into weekly comparison. The end-to-end
capture exercises column mapping, currency selection, analysis, device project
saving, an optional consented account memo, export and backup inspection. Paid
access is a local fixture for the weekly workflow; the memo does not activate it.
The decision guide uploads the three-week fixture to show a real follow-up result.

Inspect the generated scene contact sheets before publishing. Each video has
four six-second chapters. HyperFrames checks every midpoint (layout, runtime,
contrast); FFprobe checks 1280×720 dimensions and 24-second duration. Native
browser tests cover actual playback, no automatic playback, seeking, responsive
layout and keyboard closing. Re-capture whenever the demonstrated controls change.
Do not refresh a video date or claim it reflects the current UI without doing so.

## Tool version

The refreshed render command uses HyperFrames 0.8.36 with `--quality high`.
The 2026-09-20 probe found no project package pin; the scripts now explicitly use
0.8.36. No npm security configuration was changed.

Generated working captures, compositions and local fixture backups stay outside
the repository. Only compressed MP4, JPEG posters and VTT captions are published.
No user dataset appears in any published asset. Application screenshots and font
come from this repository. GSAP is the pinned upstream distribution.
