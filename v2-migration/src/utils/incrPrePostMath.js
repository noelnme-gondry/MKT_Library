// ── Pre/Post incrementality (turn-on / turn-off) ────────────────────────────
// For the 증분 분석 tool's ② 신규 켜기(on) / ③ 종료(off) tabs: measure the effect
// of switching something on or off at a cutoff date by comparing the metric
// BEFORE vs AFTER. Optional control group → difference-in-differences (DiD) to
// strip seasonality/trend. (docs/design-system-baseline.md §2)
//
// Pure & deterministic. Significance via STATS.continuousTest (Welch). Golden.

import { STATS } from "./abTestMath";

function mean(a) {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
}
function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  const v = a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1);
  return Math.sqrt(v);
}

export const INCR_PREPOST = {
  mean,
  sd,
  // pre/post: arrays of daily metric values (treatment). direction: "on"|"off".
  // control (optional): { pre:[], post:[] } — same window, an unchanged group.
  compute({ pre, post, direction = "on", control = null }) {
    if (!pre || !post || pre.length === 0 || post.length === 0) return null;
    const preMean = mean(pre);
    const postMean = mean(post);
    const delta = postMean - preMean;            // raw change (signed)
    const deltaPct = preMean !== 0 ? delta / preMean : null;

    // Counterfactual = pre-period daily rate continues through the post window.
    const counterfactualTotal = preMean * post.length;
    const postTotal = post.reduce((s, v) => s + v, 0);
    // incremental over the whole post window (signed; on→+ gained, off→− lost)
    const incrementalTotal = postTotal - counterfactualTotal;

    // Significance: is the post daily mean different from pre daily mean?
    const sig = STATS.continuousTest(
      pre.length, preMean, sd(pre),
      post.length, postMean, sd(post),
    );

    // Difference-in-differences with a control group (removes common trend).
    let did = null;
    if (control && control.pre && control.post && control.pre.length && control.post.length) {
      const cPre = mean(control.pre);
      const cPost = mean(control.post);
      const treatDelta = delta;
      const ctrlDelta = cPost - cPre;
      const didDelta = treatDelta - ctrlDelta; // effect net of control's own change
      did = { ctrlPreMean: cPre, ctrlPostMean: cPost, ctrlDelta, didDelta };
    }

    // Direction framing: "off" measures the LOSS from turning off (magnitude of
    // the drop). We keep raw signed values; the view labels them per direction.
    return {
      preMean, postMean, delta, deltaPct,
      counterfactualTotal, postTotal, incrementalTotal,
      nPre: pre.length, nPost: post.length,
      sig, did, direction,
    };
  },
};
