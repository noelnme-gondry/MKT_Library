import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 블로그 마크다운 서식 계약.
 *
 * 배경: 한 글 안에서도 서식이 갈리고 글마다 규칙이 달랐다. 실제로 있던 것들 —
 *  - 본문 맨 앞 `# 제목`이 24편에 있었는데 페이지는 이미 <h1>{post.title}</h1>을
 *    그린다. 렌더러가 h1→h2로 낮추기 때문에 그 줄이 섹션(`##`)과 같은 크기로 나가
 *    "제목이 소제목과 구분이 안 되는" 화면이 됐다.
 *  - `1.` `4.`는 순서 목록인데 `2)` `3)`은 마크다운이 아니라 그냥 문단이라,
 *    한 목록 안에서 들여쓰기가 갈렸다(스크린샷으로 지적된 자리).
 *  - 문장 전체를 볼드로 감싼 장식(§12.24)과, 볼드만으로 만든 소제목.
 *
 * 목록은 파일에서 파생한다 — 슬러그를 손으로 나열하면 새 글이 검사 밖으로 샌다(§7).
 */

const REPO_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIRS = ["content/blog", "content/blog-en"];

function readPosts() {
  const posts = [];
  for (const dir of DIRS) {
    const abs = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of fs.readdirSync(abs).sort()) {
      if (!file.endsWith(".md") || file.startsWith("_")) continue;
      const raw = fs.readFileSync(path.join(abs, file), "utf8");
      const cut = raw.indexOf("\n---", 4);
      posts.push({ id: `${dir.split("/").pop()}/${file.replace(/\.md$/, "")}`, body: raw.slice(cut + 4) });
    }
  }
  return posts;
}

// 코드블록 안은 서식 규칙 대상이 아니다.
function contentLines(body) {
  const out = [];
  let inFence = false;
  body.split("\n").forEach((line, index) => {
    if (line.trim().startsWith("```")) { inFence = !inFence; return; }
    if (!inFence) out.push({ line, number: index + 1 });
  });
  return out;
}

const posts = readPosts();

describe("블로그 마크다운 서식", () => {
  it("검사 대상을 실제로 수집한다", () => {
    // 경로가 깨지면 0편이 되고 아래 검사가 전부 공허하게 통과한다.
    expect(posts.length).toBeGreaterThan(80);
  });

  it("본문에 h1을 두지 않는다 — 제목은 페이지가 그린다", () => {
    const offenders = posts.filter((post) => contentLines(post.body).some(({ line }) => /^#\s+\S/.test(line))).map((post) => post.id);
    expect(offenders, `본문 h1:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("섹션은 ##에서 시작하고 단계를 건너뛰지 않는다", () => {
    const offenders = [];
    for (const post of posts) {
      let previous = 2;
      for (const { line, number } of contentLines(post.body)) {
        const match = line.match(/^(#{2,6})\s+\S/);
        if (!match) continue;
        const level = match[1].length;
        if (level > previous + 1) offenders.push(`${post.id}:${number} h${previous}→h${level}`);
        previous = level;
      }
    }
    expect(offenders, `헤딩 단계 건너뜀:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("헤딩 앞뒤에 빈 줄이 있다", () => {
    const offenders = [];
    for (const post of posts) {
      const lines = post.body.split("\n");
      lines.forEach((line, index) => {
        if (!/^#{2,6}\s+\S/.test(line)) return;
        if (index > 0 && lines[index - 1].trim() !== "") offenders.push(`${post.id}:${index + 1} 앞`);
        if (index + 1 < lines.length && lines[index + 1].trim() !== "") offenders.push(`${post.id}:${index + 1} 뒤`);
      });
    }
    expect(offenders, `헤딩 여백 누락:\n${offenders.slice(0, 20).join("\n")}`).toEqual([]);
  });

  it("`2)` 같은 손번호를 쓰지 않는다 — 마크다운 목록이 아니라 문단이 된다", () => {
    const offenders = [];
    for (const post of posts) {
      for (const { line, number } of contentLines(post.body)) {
        if (/^\s*\*{0,2}\d+\)\s/.test(line)) offenders.push(`${post.id}:${number} ${line.trim().slice(0, 40)}`);
      }
    }
    expect(offenders, `손번호 목록:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("문장 전체를 볼드로 감싸지 않는다 — 목록 라벨 볼드는 구조라 허용", () => {
    const offenders = [];
    for (const post of posts) {
      for (const { line, number } of contentLines(post.body)) {
        // 목록 항목을 여는 볼드는 라벨이라 구조다(§12.24) — 길이·문장부호로 걸면
        // "핵심 질문?" 같은 정당한 라벨까지 잡힌다.
        const body = line.replace(/^(\s*)(?:\d+\.|[-*+])\s+\*\*.+?\*\*/, "$1");
        // 볼드 쌍은 왼쪽부터 non-greedy로 짝짓는다. `[^*]+`로 잡으면 닫는 **와
        // 다음 여는 ** 사이 텍스트를 잡아 오탐이 난다.
        for (const inner of body.match(/\*\*(.+?)\*\*/g) || []) {
          const text = inner.slice(2, -2).trim();
          if (text.length >= 25 && /[.!?요다]$/.test(text)) offenders.push(`${post.id}:${number} ${text.slice(0, 50)}`);
        }
      }
    }
    expect(offenders, `문장 볼드:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("볼드만으로 소제목을 만들지 않는다 — 크기가 안 커진다", () => {
    const offenders = [];
    for (const post of posts) {
      for (const { line, number } of contentLines(post.body)) {
        if (/^\*\*[^*]+\*\*[:：]?\s*$/.test(line)) offenders.push(`${post.id}:${number} ${line.trim().slice(0, 40)}`);
      }
    }
    expect(offenders, `볼드 소제목:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("빈 줄을 3줄 이상 연속으로 두지 않는다", () => {
    const offenders = posts.filter((post) => /\n{4,}/.test(post.body)).map((post) => post.id);
    expect(offenders, `과한 빈 줄:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("한 목록 안에서 라벨 볼드가 일부만 있지 않다", () => {
    // 일부만 볼드로 남은 상태가 제일 나쁘다(§12.24) — 블록 단위로 전부 있거나 없거나.
    const offenders = [];
    for (const post of posts) {
      let run = [];
      const flush = () => {
        if (run.length >= 2) {
          const bold = run.filter((item) => item.bold).length;
          if (bold !== 0 && bold !== run.length) offenders.push(`${post.id}:${run[0].number} (${bold}/${run.length})`);
        }
        run = [];
      };
      for (const { line, number } of contentLines(post.body)) {
        const match = line.match(/^(\s*)(?:\d+\.|[-*+])\s+(.*)$/);
        if (match) run.push({ number, bold: /^\*\*/.test(match[2]) });
        else if (line.trim() !== "") flush();
      }
      flush();
    }
    expect(offenders, `목록 라벨 볼드 혼재:\n${offenders.slice(0, 20).join("\n")}`).toEqual([]);
  });
});
