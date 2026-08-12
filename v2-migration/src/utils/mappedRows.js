// Shared raw-to-standard projection. Large imports can precompute this in a
// Worker so every tool reuses the same mapped row array.
import { NUMERIC_STANDARD_KEYS } from "./csvConstants";

// 천단위 구분자·통화기호를 제거한다. PapaParse는 dynamicTyping 없이 돌리는 게 정책이라
// (§7) 모든 값이 문자열로 들어오고, Excel·GA·매체 리포트는 "72,341,057"처럼 콤마를
// 넣어 내보낸다. 여기서 안 벗기면 하류 44곳의 `Number(r.cost)`가 전부 NaN→0이 되어
// 총비용 ₩0·CPI "계산 불가"로 무너진다(감사 P0-1, 재현 완료).
//
// 왜 문자열로 되돌려주나: 소비처와 골든이 문자열 계약에 의존한다. 숫자로 바꾸면
// 반환 shape가 달라져 byte-identical 보증이 깨진다. 여기선 "Number()가 읽을 수 있는
// 문자열"까지만 만든다.
//
// 스코프를 type:"number" 필드로 좁힌 이유: 캠페인명이 "1,000"인 경우까지 건드리면
// 디멘션 값이 조용히 바뀐다. percent(잔존율 등)도 제외 — "%" 해석은 소비처 몫이고
// (computeWeightedRetention의 비율/인원수 판별), 여기서 벗기면 12.5%가 인원수 12.5로
// 오독된다.
const SEPARATORS = /[,\s  ]/g;
const CURRENCY = /[₩$€£¥]/g;

function stripThousandSeparators(value) {
  if (typeof value !== "string") return value;
  const raw = value.trim();
  if (!raw) return value;
  // 이미 Number()가 읽을 수 있으면 손대지 않는다(기존 계약 보존).
  if (Number.isFinite(Number(raw))) return value;
  const cleaned = raw.replace(CURRENCY, "").replace(SEPARATORS, "");
  // 정리해도 숫자가 아니면 원본 유지 — 진짜 문자열 값을 훼손하지 않는다.
  return cleaned && Number.isFinite(Number(cleaned)) ? cleaned : value;
}

export function mapRowsToStandard(raw = [], mapping = {}) {
  return raw.map((row) => {
    const mapped = {};
    for (const [origKey, value] of Object.entries(row || {})) {
      const standardKey = mapping[origKey];
      if (!standardKey || standardKey === "__ignore__") continue;
      mapped[standardKey] = NUMERIC_STANDARD_KEYS.has(standardKey) ? stripThousandSeparators(value) : value;
    }
    if (mapped.cost != null && mapped.spend == null) mapped.spend = mapped.cost;
    else if (mapped.spend != null && mapped.cost == null) mapped.cost = mapped.spend;
    return mapped;
  });
}
