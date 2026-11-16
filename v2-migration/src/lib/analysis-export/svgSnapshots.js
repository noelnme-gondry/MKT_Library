// Rasterize only explicitly opted-in, locally rendered SVG figures at export.
// Computed styles preserve the active theme without external CSS or requests.
export async function captureSvgFigures(root = document) {
  const figures = [...root.querySelectorAll("svg[data-analysis-svg]")].filter(svg => svg.getClientRects().length);
  return Promise.all(figures.map(async svg => {
    const clone = svg.cloneNode(true), originals = [svg, ...svg.querySelectorAll("*")], copies = [clone, ...clone.querySelectorAll("*")];
    originals.forEach((node, index) => {
      const style = getComputedStyle(node);
      for (const property of ["fill", "stroke", "stroke-width", "stroke-dasharray", "font-size", "font-family", "font-weight", "opacity", "text-anchor"]) {
        copies[index].style.setProperty(property, style.getPropertyValue(property));
      }
    });
    const { width, height } = svg.viewBox.baseVal;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(width)); clone.setAttribute("height", String(height));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("svg_chart_export_failed")); image.src = url; });
      const canvas = document.createElement("canvas"); canvas.width = width * 2; canvas.height = height * 2;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("chart_canvas_unavailable");
      context.fillStyle = getComputedStyle(document.body).getPropertyValue("--surface-base").trim() || "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return { title: svg.querySelector("title")?.textContent || "Chart", type: "svg", labels: [], series: [], image: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
    } finally { URL.revokeObjectURL(url); }
  }));
}
