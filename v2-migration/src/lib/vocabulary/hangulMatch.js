// 명령 입력창의 한글 매칭(docs/result-autonomy-spec.md §3.2). 순수·결정론 — 같은 입력이면
// 같은 순위. 자유 문장 해석은 하지 않는다: 사전 단어의 라벨·별칭과 글자 단위로만 비교한다.

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const JUNG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

// 겹받침·겹모음은 키 두 번으로 입력된다. 입력 중인 "닭"과 사전의 "달걀"을 같은 자모열로
// 비교하려면 둘 다 키 단위로 펼쳐야 한다. 된소리(ㄲ)는 키 하나라 펼치지 않는다.
const SPLIT = {
  ㄳ: "ㄱㅅ", ㄵ: "ㄴㅈ", ㄶ: "ㄴㅎ", ㄺ: "ㄹㄱ", ㄻ: "ㄹㅁ", ㄼ: "ㄹㅂ", ㄽ: "ㄹㅅ", ㄾ: "ㄹㅌ", ㄿ: "ㄹㅍ", ㅀ: "ㄹㅎ", ㅄ: "ㅂㅅ",
  ㅘ: "ㅗㅏ", ㅙ: "ㅗㅐ", ㅚ: "ㅗㅣ", ㅝ: "ㅜㅓ", ㅞ: "ㅜㅔ", ㅟ: "ㅜㅣ", ㅢ: "ㅡㅣ",
};

// 라벨의 구분 기호("채널+캠페인별", "OS→채널")는 입력하지 않아도 맞아야 한다.
const IGNORABLE = /[\s+·/→\-_()[\]{},.:;]/g;

export function normalizeText(text) {
  return String(text ?? "").normalize("NFC").toLowerCase().replace(IGNORABLE, "");
}

function isSyllable(code) {
  return code >= HANGUL_BASE && code <= HANGUL_LAST;
}

function isConsonantJamo(ch) {
  const code = ch.charCodeAt(0);
  return code >= 0x3131 && code <= 0x314e;
}

function splitJamo(ch) {
  return SPLIT[ch] || ch;
}

/** 키 입력 단위 자모열. 한글이 아닌 글자는 소문자로 그대로 둔다. */
export function toJamo(text) {
  let out = "";
  for (const ch of normalizeText(text)) {
    const code = ch.charCodeAt(0);
    if (!isSyllable(code)) {
      out += splitJamo(ch);
      continue;
    }
    const index = code - HANGUL_BASE;
    out += CHO[Math.floor(index / 588)];
    out += splitJamo(JUNG[Math.floor((index % 588) / 28)]);
    out += splitJamo(JONG[index % 28]);
  }
  return out;
}

/** 초성열. "OS별" → "osㅂ". */
export function toChosung(text) {
  let out = "";
  for (const ch of normalizeText(text)) {
    const code = ch.charCodeAt(0);
    out += isSyllable(code) ? CHO[Math.floor((code - HANGUL_BASE) / 588)] : ch;
  }
  return out;
}

export function isChosungQuery(query) {
  const q = normalizeText(query);
  return q.length > 0 && [...q].every(isConsonantJamo);
}

// 영문·숫자로 끝나는 이름은 읽는 소리로 받침을 정한다(OS=오에스 → 로, ROAS의 S도 같다).
// 값은 JONG 인덱스: 0 받침 없음, 8 ㄹ, 그 외 받침.
const LATIN_JONG = { L: 8, R: 8, M: 16, N: 4 };
const DIGIT_JONG = { 0: 21, 1: 8, 3: 16, 6: 1, 7: 8, 8: 8 };

function finalConsonantIndex(word) {
  const text = String(word ?? "").trim();
  const last = text.slice(-1);
  const code = text.charCodeAt(text.length - 1);
  if (isSyllable(code)) return (code - HANGUL_BASE) % 28;
  if (/[a-z]/i.test(last)) return LATIN_JONG[last.toUpperCase()] ?? 0;
  if (/\d/.test(last)) return DIGIT_JONG[last] ?? 0;
  return null;
}

/** 을/를 — 컬럼 이름이 유저 입력이라 조사를 고정할 수 없다. 읽을 수 없는 끝 글자면 을(를) 병기. */
export function objectParticle(word) {
  const jong = finalConsonantIndex(word);
  if (jong == null) return "을(를)";
  return jong === 0 ? "를" : "을";
}

/** 으로/로 — 받침 없음·ㄹ받침이면 로. */
export function directionParticle(word) {
  const jong = finalConsonantIndex(word);
  if (jong == null) return "(으)로";
  return jong === 0 || jong === 8 ? "로" : "으로";
}

export const MATCH_RANK = Object.freeze({
  PREFIX: 0, // "채" → 채널별
  JAMO_PREFIX: 1, // 조합 중인 "챈" → 채널별
  CHOSUNG: 2, // "ㅊㄴ" → 채널별
  CONTAINS: 3, // "캠페" → 채널+캠페인별
});

/** 한 문자열과의 최선 순위. 맞지 않으면 null. */
export function matchText(query, text) {
  const q = normalizeText(query);
  if (!q) return MATCH_RANK.PREFIX;
  const t = normalizeText(text);
  if (!t) return null;
  if (t.startsWith(q)) return MATCH_RANK.PREFIX;
  const qJamo = toJamo(q);
  const tJamo = toJamo(t);
  if (tJamo.startsWith(qJamo)) return MATCH_RANK.JAMO_PREFIX;
  if (isChosungQuery(q) && toChosung(t).startsWith(q)) return MATCH_RANK.CHOSUNG;
  if (t.includes(q)) return MATCH_RANK.CONTAINS;
  // 두 키 이상이면 조합 중인 글자가 단어 중간에 있어도 찾는다("캠펭" → 캠페인).
  if (qJamo.length >= 2 && tJamo.includes(qJamo)) return MATCH_RANK.CONTAINS;
  return null;
}
