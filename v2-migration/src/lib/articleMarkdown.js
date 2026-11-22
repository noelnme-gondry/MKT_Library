import { Marked } from "marked";

export const articleMarkdown = new Marked({
  gfm: true,
  breaks: false,
  tokenizer: {
    del(src) {
      // 날짜·수치 범위의 물결표는 본문이다. 취소선은 ~~로 명시한다.
      if (src.startsWith("~") && !src.startsWith("~~")) {
        return { type: "text", raw: "~", text: "~" };
      }
      return false;
    },
  },
});
