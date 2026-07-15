// Jellybones pure core: procedural renderer, GIF encoder, slug codec.
// No DOM, no dependencies — imported by index.html (browser) and api/* (Vercel Node).
"use strict";

export const GRID = 24, CX = 11.5, GROUND = 20, BASE_H = 13, BASE_RX = 7.5, FPS = 12;
export const PAGE_BG = "#171129";

export const FLAVORS = {
  lime:       { B: "#7fd348", O: "#35771f", L: "#a6e87d", S: "#e9ffd2", glow: "rgba(127,211,72,.16)" },
  strawberry: { B: "#f25d7e", O: "#99284d", L: "#f78ba4", S: "#ffdce6", glow: "rgba(242,93,126,.16)" },
  blueberry:  { B: "#5c6ce8", O: "#2c3494", L: "#8b97f2", S: "#d6dbff", glow: "rgba(92,108,232,.18)" },
};
export const COMMON = { N: "#f6eedc", E: "#221a38", M: "#221a38", C: "#ee86ae", H: "#0d0a1c" };

function shapeHW(u) {
  // Circular dome over the top 70%, straight sides down to the base.
  const d = 0.7;
  if (u >= d) return 1;
  const q = (d - u) / d;
  return Math.sqrt(Math.max(0, 1 - q * q));
}

// Pure frame renderer: squash, lift, face state, and optional sleep progress → palette-key grid.
export function renderGrid(s, lift, blink, mouthOpen, sleepProgress = null) {
  const h = BASE_H * s;
  const rx = BASE_RX / Math.sqrt(s);
  const base = GROUND - lift;
  const topY = base - h;

  const inside = (x, y) => {
    if (y > base) return false;
    const u = (y + 0.5 - topY) / h;
    return u > 0 && Math.abs(x - CX) <= rx * shapeHW(u);
  };

  const g = Array.from({ length: GRID }, () => Array(GRID).fill("."));
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) if (inside(x, y)) g[y][x] = "B";

  const NB = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      if (g[y][x] !== "B") continue;
      if (NB.some(([dx, dy]) => (g[y + dy]?.[x + dx] ?? ".") === ".")) g[y][x] = "O";
    }

  // Inner light region: 2 erosions in from the outline.
  const erode = (from, to) => {
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        if (g[y][x] !== from) continue;
        if (NB.every(([dx, dy]) => ["B", "L", from, to].includes(g[y + dy]?.[x + dx] ?? ".")))
          g[y][x] = to;
      }
  };
  erode("B", "b");
  erode("b", "L");
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) if (g[y][x] === "b") g[y][x] = "B";

  const put = (x, y, c) => {
    if (g[y]?.[x] === "B" || g[y]?.[x] === "L") g[y][x] = c;
  };

  // The bone travels with the body, low and clear of the face.
  const boneMid = base - 3;
  [8, 9, 14, 15].forEach((bx) => { put(bx, boneMid - 1, "N"); put(bx, boneMid + 1, "N"); });
  for (let x = 8; x <= 15; x++) put(x, boneMid, "N");

  // Face rides the surface and scales with the squash.
  const eyeY = Math.round(topY + h * 0.3);
  [[8, 9], [14, 15]].forEach(([a, b]) => {
    put(a, eyeY, "E"); put(b, eyeY, "E");
    if (!blink) { put(a, eyeY - 1, "E"); put(b, eyeY - 1, "E"); }
  });
  put(11, eyeY + 2, "M"); put(12, eyeY + 2, "M");
  if (mouthOpen) { put(11, eyeY + 3, "M"); put(12, eyeY + 3, "M"); }
  put(7, eyeY + 1, "C"); put(16, eyeY + 1, "C");

  // A tiny Z drifts up beside the sleeping jelly, then loops back to its cheek.
  if (sleepProgress !== null && sleepProgress < 0.82) {
    const zX = 18 + Math.floor(sleepProgress * 2);
    const zY = 6 - Math.floor(sleepProgress * 5);
    [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]].forEach(([dx, dy]) => {
      if (g[zY + dy]?.[zX + dx] === ".") g[zY + dy][zX + dx] = "N";
    });
  }

  // Glass highlight hugging the upper-left curve.
  put(9, Math.round(topY) + 2, "S");
  put(8, Math.round(topY) + 3, "S");
  put(8, Math.round(topY) + 4, "S");

  // Ground shadow: wider on squash, smaller when airborne.
  let shHW = rx * (0.95 + (1 - s) * 2.5) - lift * 0.9;
  shHW = Math.max(2, Math.round(shHW));
  for (let x = Math.round(CX - shHW); x <= Math.round(CX + shHW); x++)
    if ((g[GROUND + 1][x] ?? "x") === ".") g[GROUND + 1][x] = "H";

  return g;
}

function gifPalette(flavorName) {
  const colors = [null, "B", "O", "L", "S", "N", "E", "C", "H"];
  const palette = { ...COMMON, ...FLAVORS[flavorName] };
  const rgb = colors.map((key) => {
    if (!key) return [0, 0, 0];
    const hex = palette[key];
    return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  });
  const index = new Map(colors.slice(1).map((key, i) => [key, i + 1]));
  index.set(".", 0);
  index.set("M", index.get("E"));
  return { rgb, index };
}

function scaledIndices(grid, index, scale) {
  const size = GRID * scale;
  const pixels = new Uint8Array(size * size);
  for (let y = 0; y < GRID; y++) {
    for (let sy = 0; sy < scale; sy++) {
      const row = (y * scale + sy) * size;
      for (let x = 0; x < GRID; x++) {
        const colorIndex = index.get(grid[y][x]);
        pixels.fill(colorIndex, row + x * scale, row + (x + 1) * scale);
      }
    }
  }
  return pixels;
}

function lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  let dictionary = new Map();
  let bitBuffer = 0;
  let bitCount = 0;
  const output = [];

  const writeCode = (code) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(bitBuffer & 0xff);
      bitBuffer >>>= 8;
      bitCount -= 8;
    }
    // The decoder learns one entry behind the encoder, so grow after writing
    // the last code that still fits the current width.
    if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
  };

  const reset = () => {
    dictionary = new Map();
    codeSize = minCodeSize + 1;
    nextCode = endCode + 1;
  };

  writeCode(clearCode);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const value = pixels[i];
    const key = (prefix << 8) | value;
    const found = dictionary.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }

    writeCode(prefix);
    if (nextCode < 4096) {
      dictionary.set(key, nextCode++);
    } else {
      writeCode(clearCode);
      reset();
    }
    prefix = value;
  }
  writeCode(prefix);
  writeCode(endCode);
  if (bitCount > 0) output.push(bitBuffer & 0xff);
  return output;
}

// Looping GIF from a list of palette-key grids. Transparent background by
// default; pass `background` (hex) for an opaque version (OG previews).
export function makeGif(grids, flavorName, { scale = 8, background = null } = {}) {
  const size = GRID * scale;
  const bytes = [];
  const ascii = (text) => { for (const char of text) bytes.push(char.charCodeAt(0)); };
  const word = (value) => bytes.push(value & 0xff, (value >> 8) & 0xff);
  const blocks = (data) => {
    for (let i = 0; i < data.length; i += 255) bytes.push(Math.min(255, data.length - i), ...data.slice(i, i + 255));
    bytes.push(0);
  };
  const { rgb, index } = gifPalette(flavorName);
  if (background) rgb[0] = [1, 3, 5].map((start) => parseInt(background.slice(start, start + 2), 16));

  ascii("GIF89a");
  word(size); word(size);
  bytes.push(0xf3, 0, 0); // 16-color global table, background index 0.
  for (let i = 0; i < 16; i++) bytes.push(...(rgb[i] ?? [0, 0, 0]));
  bytes.push(0x21, 0xff, 0x0b); ascii("NETSCAPE2.0");
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00); // Loop forever.

  grids.forEach((grid, frame) => {
    const delay = Math.round(((frame + 1) * 100) / FPS) - Math.round((frame * 100) / FPS);
    bytes.push(0x21, 0xf9, 0x04, background ? 0x08 : 0x09); // Disposal 2; transparency only when no bg.
    word(delay);
    bytes.push(0x00, 0x00); // Transparent color index, then extension terminator.
    bytes.push(0x2c);
    word(0); word(0); word(size); word(size);
    bytes.push(0x00, 0x04); // No local palette; 4-bit minimum LZW code size.
    blocks(lzwEncode(scaledIndices(grid, index, scale), 4));
  });

  bytes.push(0x3b);
  return new Uint8Array(bytes);
}

// Deterministic loop schedules per animation mode. Live-only flourishes
// (random blinks) are omitted so the seam always closes cleanly.
export const IDLE_FRAMES = 17;
export const SLEEP_FRAMES = FPS * 4;

export function modeGrids(mode) {
  if (mode === "sleep") {
    return Array.from({ length: SLEEP_FRAMES }, (_, frame) => {
      const progress = frame / SLEEP_FRAMES;
      return renderGrid(1 + 0.04 * Math.sin(2 * Math.PI * progress), 0, true, false, progress);
    });
  }
  return Array.from({ length: IDLE_FRAMES }, (_, frame) =>
    renderGrid(1 + 0.055 * Math.sin((2 * Math.PI * frame) / IDLE_FRAMES), 0, false, false));
}

// Slug codec. Tokens are order-insensitive and unknown tokens are ignored, so
// links never break as parts are added — a bad link degrades to the default pet.
export const MODES = ["idle", "sleep"];
export const DEFAULT_PET = { flavor: "lime", mode: "idle" };

export function parseSlug(slug) {
  const pet = { ...DEFAULT_PET };
  for (const token of String(slug ?? "").toLowerCase().split("-")) {
    if (FLAVORS[token]) pet.flavor = token;
    else if (MODES.includes(token)) pet.mode = token;
  }
  return pet;
}

export function stateSlug(flavor, mode) {
  const tokens = [];
  if (flavor !== DEFAULT_PET.flavor) tokens.push(flavor);
  if (mode !== DEFAULT_PET.mode) tokens.push(mode);
  return tokens.join("-");
}
