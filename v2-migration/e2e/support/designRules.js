// 사이트 전역 디자인 규칙 — "AI가 만든 것처럼 보이는" 화면의 공통 증상을 수치로 잰다.
// 2026-09-24 사용자 지적(겹침·박스 안 박스·가장자리 어긋남·제목 위 작은 라벨·굵기 난립)을
// 한 번에 막기 위해 만들었다. 값을 보지 않고 **렌더된 박스**를 본다 — CSS만 읽는 가드는
// 캐스케이드·고정 요소·폭 계산에서 생기는 문제를 못 잡는다(AGENTS.md §7).
//
// 예외는 주석이 아니라 DOM 표식 + 사유로만: data-design-exempt="<rule>: <reason>".
// 표식은 요소 자신 또는 조상에 둔다. 사유가 비면 예외로 인정하지 않는다.

export const ALLOWED_WEIGHTS = [400, 600, 700];

export async function measureDesignRules(page) {
  return page.evaluate((allowedWeights) => {
    const exempt = (el, rule) => {
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        const mark = node.getAttribute?.("data-design-exempt");
        if (mark && new RegExp(`(^|;)\\s*${rule}\\s*:\\s*\\S`).test(mark)) return true;
      }
      return false;
    };
    const visible = (el) => el.checkVisibility?.({ checkVisibilityCSS: true, opacityProperty: true }) ?? true;
    const label = (el) => {
      const cls = (el.className?.baseVal ?? el.className ?? "").toString().trim().split(/\s+/)[0];
      return cls ? `${el.tagName.toLowerCase()}.${cls}` : `${el.tagName.toLowerCase()}("${el.textContent.trim().slice(0, 16)}")`;
    };
    const inDialog = (el) => Boolean(el.closest('[role="dialog"], dialog, .blog-reading-bar, .consent-banner, .source-survey, .dochi-assistant, .dochi-home-assistant'));

    // 스크롤·잘림(overflow) 상자 밖으로 나간 부분은 화면에 없다 — 보이는 부분만 남긴다.
    const visibleRect = (el, rect) => {
      let { left, top, right, bottom } = rect;
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const st = getComputedStyle(a);
        if (st.overflowX === "visible" && st.overflowY === "visible") continue;
        const c = a.getBoundingClientRect();
        left = Math.max(left, c.left); top = Math.max(top, c.top); right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom);
      }
      if (right - left < Math.min(4, rect.width / 2) || bottom - top < rect.height / 2) return null;
      return { left, top, right, bottom, width: right - left, height: bottom - top };
    };
    // 텍스트 조각(보이는 것만).
    const texts = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent.trim();
      const el = node.parentElement;
      if (!text || !el || !visible(el) || el.closest("script,style,noscript,svg,[aria-hidden='true'],.sr-only,.skip-link")) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      // 여러 줄로 감긴 글자는 줄마다 따로 잰다 — 합친 상자는 옆 줄의 글자와 거짓으로 겹친다.
      const lines = [...range.getClientRects()].filter((r) => r.width >= 1 && r.height >= 1).map((r) => visibleRect(el, r)).filter(Boolean);
      if (!lines.length) continue;
      const rect = lines[0];
      const style = getComputedStyle(el);
      texts.push({ el, text: text.slice(0, 30), rect, lines, size: parseFloat(style.fontSize), weight: Number(style.fontWeight),
        top: Math.min(...lines.map((r) => r.top)), bottom: Math.max(...lines.map((r) => r.bottom)) });
    }

    // 고정·스티키 요소 안의 글자는 스크롤한 본문 위를 지나가는 게 정상이다 — 2)에서 따로 본다.
    const floating = (el) => {
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const pos = getComputedStyle(a).position;
        if (pos === "fixed" || pos === "sticky") return true;
      }
      return false;
    };
    // 1) 글자끼리 겹침. 글자가 수천 개인 표(콘텐츠 신선도 등)에서 n² 비교가 테스트 시간을 넘겼다 —
    // 세로 위치로 정렬해 겹칠 수 있는 이웃만 비교하고, 조상을 거슬러 오르는 판정은 미리 한 번만 한다.
    for (const t of texts) { t.dialog = inDialog(t.el); t.floating = floating(t.el); }
    const byTop = [...texts].sort((x, y) => x.top - y.top);
    const overlaps = [];
    for (let i = 0; i < byTop.length; i += 1) for (let j = i + 1; j < byTop.length && byTop[j].top < byTop[i].bottom - 3; j += 1) {
      const a = byTop[i], b = byTop[j];
      if (a.floating || b.floating || a.dialog !== b.dialog) continue;
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const hit = a.lines.some((ra) => b.lines.some((rb) => {
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        return ox > 3 && oy > 3;
      }));
      if (hit && !exempt(a.el, "overlap") && !exempt(b.el, "overlap")) overlaps.push(`"${a.text}" ✕ "${b.text}"`);
    }

    // 2) 고정·스티키 요소가 본문 글자를 덮음(헤더·대화상자 제외).
    const covering = [];
    const floaters = [...document.querySelectorAll("body *")].filter((el) => {
      if (!visible(el) || inDialog(el) || el.closest("header, .topbar, .sidebar, .skip-link")) return false;
      const pos = getComputedStyle(el).position;
      if (pos !== "fixed" && pos !== "sticky") return false;
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 20;
    });
    for (const f of floaters) {
      const fr = f.getBoundingClientRect();
      for (const t of texts) {
        if (f.contains(t.el) || t.el.contains(f) || inDialog(t.el)) continue;
        if (getComputedStyle(t.el).position === "sticky" || t.el.closest(".sidebar, header, .topbar")) continue;
        const hit = t.lines.some((r) => Math.min(fr.right, r.right) - Math.max(fr.left, r.left) > 3 && Math.min(fr.bottom, r.bottom) - Math.max(fr.top, r.top) > 3);
        if (hit && !exempt(f, "cover")) { covering.push(`${label(f)} ✕ "${t.text}"`); break; }
      }
    }

    // 3) 굵기 세 단.
    const weights = [...new Set(texts.map((t) => t.weight))].sort((a, b) => a - b);
    const offWeights = texts.filter((t) => !allowedWeights.includes(t.weight) && !exempt(t.el, "weight")).map((t) => `"${t.text}" ${t.weight}`);

    // 4) 박스 안 박스(테두리+배경+모서리). 버튼·입력 같은 컨트롤은 박스가 아니다.
    // 컨트롤(버튼·입력·토글 묶음·툴팁)과 글줄 안 배지는 상자가 아니다.
    const control = (el) => el.matches("button, a, input, select, textarea, label, summary, [role='button'], [role='tab'], [role='radio'], [role='switch'], [role='radiogroup'], [role='tablist'], [role='tooltip'], [role='group'], .btn, code, kbd, pre, mark, [class*='badge'], [class*='chip'], .pill")
      || getComputedStyle(el).display.startsWith("inline");
    // 상자 = 모서리가 둥글고, (테두리 세 변 이상 + 바탕) 이거나 바탕색이 바로 뒤 바탕과 다른 면.
    // 테두리 없이 바탕색만 다른 안쪽 면도 눈에는 상자 안 상자다.
    const backdrop = (el) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        const bg = getComputedStyle(a).backgroundColor;
        if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
      }
      return "rgb(255, 255, 255)";
    };
    const boxy = (el) => {
      if (control(el)) return false;
      const s = getComputedStyle(el);
      if (!(parseFloat(s.borderTopLeftRadius) > 0)) return false;
      const bg = s.backgroundColor;
      const hasBg = bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
      if (!hasBg) return false;
      const bordered = ["Top", "Right", "Bottom", "Left"].filter((side) => parseFloat(s[`border${side}Width`]) > 0 && s[`border${side}Style`] !== "none").length >= 3;
      return bordered || bg !== backdrop(el);
    };
    const boxes = [...document.querySelectorAll("body *")].filter((el) => {
      if (!visible(el) || inDialog(el) || el.closest(".sidebar, header, .topbar, footer, [aria-hidden='true']")) return false;
      const r = el.getBoundingClientRect();
      // 한 줄 높이의 칩·배지는 상자가 아니다 — 내용을 담는 상자만 센다.
      return r.width > 60 && r.height > 44 && boxy(el);
    });
    const nested = boxes.map((el) => {
      if (exempt(el, "nested")) return null;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (boxy(a) && visible(a)) return `${label(el)} ⊂ ${label(a)}`;
      return null;
    }).filter(Boolean);

    // 5) 제목 바로 위에 붙은 작은 라벨(13px 이하 → 12px 안에 20px 이상).
    const eyebrows = [];
    for (const small of texts) {
      if (small.size > 13 || small.dialog || small.floating || exempt(small.el, "eyebrow")) continue;
      const head = texts.find((h) => h.size >= 20 && !h.floating && h.rect.top - small.rect.bottom >= -2 && h.rect.top - small.rect.bottom <= 12 && Math.abs(h.rect.left - small.rect.left) < 40);
      if (head) eyebrows.push(`"${small.text}"(${small.size}px) → "${head.text}"`);
    }

    // 6) 세로로 쌓인 형제 박스는 좌우 가장자리가 같아야 한다(튀어나오거나 좁아지지 않게).
    const misaligned = [];
    const main = document.querySelector("#main-content") || document.body;
    const blocks = [...main.querySelectorAll("*")].filter((el) => {
      if (!visible(el) || inDialog(el) || el.closest("footer")) return false;
      const s = getComputedStyle(el);
      const bg = s.backgroundColor;
      const surface = (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") || parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0;
      // 한 줄 칩(높이 40px 이하)은 줄 바꿈에 따라 폭이 달라지는 게 정상이다.
      return surface && !control(el) && el.getBoundingClientRect().height > 40;
    });
    const set = new Set(blocks);
    for (const el of blocks) {
      const parent = el.parentElement;
      if (!parent || exempt(el, "align")) continue;
      const pr = parent.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (r.width < pr.width * 0.6) continue;
      let next = el.nextElementSibling;
      while (next && !(set.has(next))) next = next.nextElementSibling;
      if (!next || exempt(next, "align")) continue;
      const nr = next.getBoundingClientRect();
      if (nr.width < pr.width * 0.6 || nr.top < r.bottom - 1) continue;
      if (Math.abs(nr.left - r.left) > 1 || Math.abs(nr.right - r.right) > 1) misaligned.push(`${label(el)} ↔ ${label(next)} (Δleft ${Math.round(nr.left - r.left)}, Δright ${Math.round(nr.right - r.right)})`);
    }

    // 7) 왼쪽 굵은 색 막대 + 배경 상자(AI가 만든 안내 상자의 전형). 막대만 있거나 배경만 있으면 괜찮다.
    const accents = [...(main.querySelectorAll("*"))].filter((el) => {
      if (!visible(el) || inDialog(el) || control(el) || exempt(el, "accent")) return false;
      const st = getComputedStyle(el);
      const left = parseFloat(st.borderLeftWidth), top = parseFloat(st.borderTopWidth);
      const bg = st.backgroundColor;
      const hasBg = bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
      const r = el.getBoundingClientRect();
      return st.borderLeftStyle !== "none" && left >= 2 && left > top && hasBg && r.height > 30;
    }).map(label);

    return {
      accents: [...new Set(accents)],
      textCount: texts.length,
      overlaps: [...new Set(overlaps)],
      covering: [...new Set(covering)],
      weights,
      offWeights: [...new Set(offWeights)].slice(0, 20),
      nested: [...new Set(nested)],
      eyebrows: [...new Set(eyebrows)],
      misaligned: [...new Set(misaligned)],
    };
  }, ALLOWED_WEIGHTS);
}
