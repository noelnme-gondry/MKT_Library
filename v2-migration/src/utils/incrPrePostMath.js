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
      // DiD를 선택했을 때 유의성도 반드시 처리군의 단순 전후 변화가 아니라
      // (처리군 − 대조군) 일별 차이의 전후 변화에서 계산한다. 그렇지 않으면
      // 공통 계절성만 유의해도 순효과가 유의한 것처럼 화면에 표시될 수 있다.
      const pairedPreN = Math.min(pre.length, control.pre.length);
      const pairedPostN = Math.min(post.length, control.post.length);
      const diffPre = Array.from({ length: pairedPreN }, (_, i) => pre[i] - control.pre[i]);
      const diffPost = Array.from({ length: pairedPostN }, (_, i) => post[i] - control.post[i]);
      const sig = STATS.continuousTest(
        diffPre.length, mean(diffPre), sd(diffPre),
        diffPost.length, mean(diffPost), sd(diffPost),
      );
      did = { ctrlPreMean: cPre, ctrlPostMean: cPost, ctrlDelta, didDelta, sig, pairedPreN, pairedPostN };
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
