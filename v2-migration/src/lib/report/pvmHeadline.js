import { subjectParticle } from "@/lib/vocabulary/hangulMatch";

/* ============================================================
 * 성과 변동 원인(5-21) 결론 문장 — product-ssot §1.1c "보고서 틀".
 *
 * "무엇이 얼마나 변했고, 어디 때문인가"를 한 번에 말한다. 지표는 낮을수록 좋은
 * 단가(CPA·CPI 류)다.
 *
 * 부호 함정(AGENTS §7): 기여는 무잔차 분해라 Σ기여 = 전체 변화다. 그래서 전체 변화와
 * 같은 방향의 기여가 적어도 하나 있다. 절대값이 가장 큰 기여를 고르면 반대 방향일 수
 * 있으므로("올랐는데 가장 크게 내린 곳"을 원인으로 지목), **같은 방향 중 가장 큰 기여**를
 * 고른다. 같은 방향 기여의 합이 전체 변화를 넘을 수 있어("오른 52원 중 80원") 몫(%)은
 * 0 < 몫 ≤ 100%일 때만 돌려준다.
 * ============================================================ */

// 표시 자릿수(소수 첫째)에서 0이면 "거의 그대로"다 — "+0.0%"를 오름으로 읽히지 않게.
const FLAT_PCT = 0.05;

export function pvmHeadline({ metric, start, end, rows = [], formatMoney = (value) => String(value), locale = "ko" }) {
  const en = locale === "en";
  const delta = Number(end) - Number(start);
  const pct = Number(start) > 0 ? (delta / Number(start)) * 100 : null;
  const isFlat = delta === 0 || (pct != null && Math.abs(pct) < FLAT_PCT);
  const direction = isFlat ? "flat" : delta > 0 ? "up" : "down";
  const sign = direction === "up" ? 1 : -1;
  const lead = direction === "flat" ? null : rows
    .map((row, index) => ({ ...row, index }))
    .filter((row) => Number.isFinite(row.contribution) && Math.sign(row.contribution) === sign)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || a.index - b.index)[0] || null;
  const shareRaw = lead && delta !== 0 ? lead.contribution / delta : null;
  const share = shareRaw != null && shareRaw > 0 && shareRaw <= 1 ? Math.round(shareRaw * 100) : null;
  const pctText = pct == null ? null : `${Math.abs(pct).toFixed(1)}%`;
  const leadName = lead ? (lead.key || (en ? "(unspecified)" : "(미지정)")) : "";

  // 한 문장으로 말한다 — 결론 칸은 큰 글씨라 두 문장이면 폰에서 다섯 줄이 된다.
  // 기여 금액은 바로 아래 숫자 칸("가장 크게 올린 곳")이 말한다.
  const range = `${formatMoney(start)} → ${formatMoney(end)}`;
  let text;
  if (direction === "flat") {
    text = en ? `${metric} barely changed (${range}).` : `${metric} 변화는 거의 없습니다(${range}).`;
  } else if (en) {
    text = `${metric} ${direction === "up" ? "rose" : "fell"}${pctText ? ` ${pctText}` : ""} (${range})${lead ? `, ${direction === "up" ? "driven most by" : "pulled down most by"} ${leadName}` : ""}.`;
  } else {
    const verb = direction === "up" ? "올랐" : "내렸";
    text = lead
      ? `${metric}${subjectParticle(metric)}${pctText ? ` ${pctText}` : ""} ${verb}고(${range}), ${leadName}${subjectParticle(leadName)} 가장 크게 ${direction === "up" ? "올렸습니다" : "낮췄습니다"}.`
      : `${metric}${subjectParticle(metric)}${pctText ? ` ${pctText}` : ""} ${verb}습니다(${range}).`;
  }
  return { text, direction, delta, pct, lead, share };
}

/**
 * "왜" 한 줄 — 비중 이동과 단가 변화 중 무엇이 컸는가. 두 항의 합은 전체 변화다.
 * unit은 분석 단위 이름(채널·캠페인·OS…) — 축을 바꾸면 문장도 그 단위로 말한다.
 */
export function pvmDriverLine({ mix, rate, unit, formatMoney = (value) => String(value), locale = "ko" }) {
  if (!Number.isFinite(mix) || !Number.isFinite(rate)) return "";
  const en = locale === "en";
  const name = String(unit || (en ? "channel" : "채널")).trim();
  const signed = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatMoney(Math.abs(value))}`;
  const rateBigger = Math.abs(rate) >= Math.abs(mix);
  const rateLabel = en ? `Unit costs within each ${name.toLowerCase()}` : `${name} 안의 단가 변화`;
  const mixLabel = en ? `the shift in ${name.toLowerCase()} share` : `${name} 비중 변화`;
  const [bigLabel, bigValue, smallLabel, smallValue] = rateBigger ? [rateLabel, rate, mixLabel, mix] : [mixLabel, mix, rateLabel, rate];
  if (en) {
    const capital = bigLabel.charAt(0).toUpperCase() + bigLabel.slice(1);
    return `${capital} moved it more (${signed(bigValue)}) than ${smallLabel.charAt(0).toLowerCase() + smallLabel.slice(1)} (${signed(smallValue)}).`;
  }
  return `${bigLabel}(${signed(bigValue)})가 ${smallLabel}(${signed(smallValue)})보다 컸습니다.`;
}
