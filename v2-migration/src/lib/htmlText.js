function isMarkupStart(text, index) {
  let cursor = index + 1;
  if (text[cursor] === "/") cursor += 1;
  const first = text[cursor];
  return first === "!" || first === "?" || /[A-Za-z]/.test(first || "");
}

function findTagEnd(text, start) {
  let quote = "";
  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return index;
    }
  }
  return -1;
}

// HTML을 다시 렌더하지 않는 메타데이터·내보내기용 평문 변환이다. 정규식 한 번으로
// 태그를 지우면 중첩 입력이 새 태그를 만들어낼 수 있어 문자 단위로 건너뛴다.
export function stripHtmlTags(value) {
  const text = String(value ?? "");
  let plain = "";
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "<" && isMarkupStart(text, index)) {
      const end = findTagEnd(text, index);
      if (end >= 0) {
        index = end;
        continue;
      }
    }
    plain += text[index];
  }
  return plain;
}

const TEXT_ENTITIES = Object.freeze({
  "&amp;": "&",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
});

// 한 번의 매칭 결과만 바꿔 `&amp;quot;`가 같은 호출에서 `"`까지 이중 해제되지 않게 한다.
export function decodeTextEntitiesOnce(value) {
  return String(value ?? "").replace(/&(amp|quot|apos|#39);/g, (entity) => TEXT_ENTITIES[entity]);
}
