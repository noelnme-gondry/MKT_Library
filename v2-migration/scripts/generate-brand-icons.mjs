import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
export const BRAND_BLUE = "#1f60d2";

export const PNG_TARGETS = [
  { path: "public/assets/brand/dochi-app-icon.png", size: 1254, fullBackground: true },
  { path: "public/icons/dochi-favicon-64.png", size: 64, fullBackground: false },
  { path: "public/icons/dochi-192.png", size: 192, fullBackground: true },
  { path: "public/icons/dochi-512.png", size: 512, fullBackground: true },
  { path: "public/icons/dochi-maskable-512.png", size: 512, fullBackground: true },
  { path: "public/apple-touch-icon.png", size: 180, fullBackground: true },
  { path: "src/app/apple-icon.png", size: 180, fullBackground: true },
];

export const ICO_SIZES = [16, 32, 48, 64];

export async function renderIconPng(svg, size, { fullBackground = false } = {}) {
  let image = sharp(svg).resize(size, size, { fit: "fill" });
  if (fullBackground) image = image.flatten({ background: BRAND_BLUE });
  return image.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

export function packPngIco(entries) {
  const headerSize = 6 + entries.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let dataOffset = headerSize;
  entries.forEach(({ size, buffer }, index) => {
    const offset = 6 + index * 16;
    header[offset] = size >= 256 ? 0 : size;
    header[offset + 1] = size >= 256 ? 0 : size;
    header[offset + 2] = 0;
    header[offset + 3] = 0;
    header.writeUInt16LE(1, offset + 4);
    header.writeUInt16LE(32, offset + 6);
    header.writeUInt32LE(buffer.length, offset + 8);
    header.writeUInt32LE(dataOffset, offset + 12);
    dataOffset += buffer.length;
  });

  return Buffer.concat([header, ...entries.map(({ buffer }) => buffer)]);
}

export async function buildBrandIconAssets(root = PROJECT_ROOT) {
  const svgPath = path.join(root, "src/app/icon.svg");
  const publicSvgPath = path.join(root, "public/favicon.svg");
  const svg = await readFile(svgPath);
  const publicSvg = await readFile(publicSvgPath);
  if (!svg.equals(publicSvg)) throw new Error("src/app/icon.svg and public/favicon.svg must stay identical");

  const pngAssets = await Promise.all(PNG_TARGETS.map(async (target) => ({
    ...target,
    buffer: await renderIconPng(svg, target.size, target),
  })));
  const icoEntries = await Promise.all(ICO_SIZES.map(async (size) => ({
    size,
    buffer: await renderIconPng(svg, size),
  })));

  return {
    pngAssets,
    ico: packPngIco(icoEntries),
  };
}

export async function writeBrandIconAssets(root = PROJECT_ROOT) {
  const assets = await buildBrandIconAssets(root);
  await Promise.all(assets.pngAssets.map(({ path: relativePath, buffer }) => (
    writeFile(path.join(root, relativePath), buffer)
  )));
  await writeFile(path.join(root, "src/app/favicon.ico"), assets.ico);
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) await writeBrandIconAssets();
