// 블로그 본문을 "중간 행동 패널(ContentActionPanel)" 앞뒤로 가르는 순수 함수.
//
// 예전에는 KO·EN 페이지가 각자 `splitAtContentAction`을 갖고 있었고, 둘 다
// `<!-- CONTENT_ACTION -->` 마커가 있는 글에서만 갈라졌다. 마커는 사람이 .md에 직접
// 넣는 계약이라 KO 48편 중 14편에만 있었고, 없으면 `after=""`가 되어 중간 패널이
// 통째로, 조용히 사라졌다 — 즉 글 34편은 끝까지 읽은 사람에게만 행동 경로가 있었다.
// 마커가 없으면 본문 구조에서 삽입 위치를 파생한다(사람이 매번 넣는 계약을 유지하면
// 같은 누락이 새 글에서 다시 쌓인다). 마커가 있으면 언제나 마커가 이긴다 — 편집자가
// 고른 위치를 자동 추정으로 덮지 않는다.
const MARKER = "<!-- CONTENT_ACTION -->";

// 자동 삽입 임계. 짧은 글은 마감 영역이 이미 화면 안에 있어 중간 패널이 같은 CTA를
// 두 번 보여주는 꼴이 된다 → 최소 블록 수를 넘는 글에서만 가른다.
const MIN_BLOCKS = 8;
// 패널 뒤에 최소 이만큼 남아야 "중간"이다(끝에 붙으면 마감 영역과 겹친다).
const MIN_TRAILING_BLOCKS = 3;
const TARGET_RATIO = 0.55;
// 목표 지점 근처에 섹션 제목(h2)이 있으면 그 앞이 더 자연스러운 경계다.
const HEADING_WINDOW = 0.18;

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

// 최상위 블록이 닫히는 지점(depth 0 복귀)의 문자 인덱스 목록.
// 중첩된 </p>(느슨한 목록 안의 문단 등)에서 자르면 마크업이 깨지므로 depth를 센다.
export function topLevelBoundaries(html) {
  const source = String(html || "");
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  const boundaries = [];
  let depth = 0;
  let match;
  while ((match = tagRe.exec(source))) {
    const [tag, name, selfClosing] = [match[0], match[1].toLowerCase(), match[2]];
    if (VOID_TAGS.has(name) || selfClosing === "/") continue;
    if (tag.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      // 경계는 닫는 태그 뒤의 공백까지 넘긴다 — 줄바꿈을 after 앞에 남기면 다음 블록이
      // "\n<p>"로 시작해 호출부·검사 양쪽에서 블록 경계를 알아보기 어려워진다.
      if (depth === 0) {
        let end = tagRe.lastIndex;
        while (end < source.length && /\s/.test(source[end])) end += 1;
        boundaries.push(end);
      }
    } else {
      depth += 1;
    }
  }
  return boundaries;
}

function autoBoundary(html) {
  const boundaries = topLevelBoundaries(html);
  if (boundaries.length < MIN_BLOCKS) return -1;
  const usable = boundaries.slice(0, boundaries.length - MIN_TRAILING_BLOCKS);
  if (!usable.length) return -1;

  const target = html.length * TARGET_RATIO;
  const nearest = usable.reduce((best, index) => (
    Math.abs(index - target) < Math.abs(best - target) ? index : best
  ), usable[0]);

  // 목표 근처에서 h2가 시작되면 그 앞 경계를 고른다(섹션 사이가 읽기 흐름을 덜 끊는다).
  const window = html.length * HEADING_WINDOW;
  const headingLed = usable.filter((index) => {
    if (Math.abs(index - target) > window) return false;
    return /^\s*<h2[\s>]/i.test(html.slice(index, index + 40));
  });
  if (!headingLed.length) return nearest;
  return headingLed.reduce((best, index) => (
    Math.abs(index - target) < Math.abs(best - target) ? index : best
  ), headingLed[0]);
}

// { before, after, source } — source는 "marker" | "auto" | "none".
// after가 빈 문자열이면 호출부는 중간 패널을 렌더하지 않는다(기존 계약 유지).
export function splitArticleForAction(html) {
  const source = String(html || "");
  const markerAt = source.indexOf(MARKER);
  if (markerAt >= 0) {
    return { before: source.slice(0, markerAt), after: source.slice(markerAt + MARKER.length), source: "marker" };
  }
  const at = autoBoundary(source);
  if (at < 0) return { before: source, after: "", source: "none" };
  return { before: source.slice(0, at), after: source.slice(at), source: "auto" };
}
