// Jellybones pure core: procedural renderer, GIF encoder, slug codec.
// No DOM, no dependencies — imported by index.html (browser) and api/* (Vercel Node).
"use strict";

export const GRID = 24, CX = 11.5, GROUND = 20, BASE_H = 13, BASE_RX = 7.5, FPS = 12;
export const PAGE_BG = "#171129";

export const FLAVORS = {
  lime:       { B: "#7fd348", O: "#35771f", L: "#a6e87d", S: "#e9ffd2", glow: "rgba(127,211,72,.16)" },
  strawberry: { B: "#f25d7e", O: "#99284d", L: "#f78ba4", S: "#ffdce6", glow: "rgba(242,93,126,.16)" },
  blueberry:  { B: "#5c6ce8", O: "#2c3494", L: "#8b97f2", S: "#d6dbff", glow: "rgba(92,108,232,.18)" },
  grape:      { B: "#a25de0", O: "#5b2b8f", L: "#c18bef", S: "#eed9ff", glow: "rgba(162,93,224,.18)" },
  peach:      { B: "#f2985d", O: "#995128", L: "#f7bd8b", S: "#ffeadc", glow: "rgba(242,152,93,.16)" },
  banana:     { B: "#eed655", O: "#94802a", L: "#f5e48c", S: "#fdf8d8", glow: "rgba(238,214,85,.16)" },
};
// R/Y/G are accessory colors — flavor-independent like the bone's N.
export const COMMON = {
  N: "#f6eedc", E: "#221a38", M: "#221a38", C: "#ee86ae", H: "#0d0a1c",
  R: "#e0453a", Y: "#f7c948", G: "#3f9142",
};

function shapeHW(u) {
  // Circular dome over the top 70%, straight sides down to the base.
  const d = 0.7;
  if (u >= d) return 1;
  const q = (d - u) / d;
  return Math.sqrt(Math.max(0, 1 - q * q));
}

// Accessories are hand-placed pixels anchored to the head apex — [x, dy, color]
// with dy relative to the top body row, so they ride every squash for free.
// They live above the outline (the bottom row may replace it — "worn", not
// "floating") and clip at the canvas edge on extreme boing frames, gracefully.
const ACCESSORY_PIXELS = {
  bow: [
    [9, -2, "R"], [10, -2, "R"], [13, -2, "R"], [14, -2, "R"],
    [10, -1, "R"], [11, -1, "R"], [12, -1, "R"], [13, -1, "R"],
  ],
  sprout: [
    [9, -2, "G"], [10, -2, "G"], [12, -2, "G"], [13, -2, "G"],
    [11, -1, "G"], [11, 0, "G"],
  ],
  crown: [
    [9, -2, "Y"], [11, -2, "Y"], [12, -2, "Y"], [14, -2, "Y"],
    [9, -1, "Y"], [10, -1, "Y"], [11, -1, "Y"], [12, -1, "Y"], [13, -1, "Y"], [14, -1, "Y"],
    [10, 0, "Y"], [11, 0, "Y"], [12, 0, "Y"], [13, 0, "Y"],
  ],
  party: [
    [11, -3, "Y"], [12, -3, "Y"],
    [11, -2, "R"], [12, -2, "R"],
    [10, -1, "R"], [11, -1, "R"], [12, -1, "R"], [13, -1, "R"],
    [9, 0, "R"], [10, 0, "R"], [11, 0, "R"], [12, 0, "R"], [13, 0, "R"], [14, 0, "R"],
  ],
};

// Pure frame renderer: squash, lift, and frame options → palette-key grid.
// opts: { blink, mouthOpen, sleepProgress, face, accessory }
export function renderGrid(s, lift, opts = {}) {
  const {
    blink = false, mouthOpen = false, sleepProgress = null,
    face = "happy", accessory = "none",
  } = opts;
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

  // Face rides the surface and scales with the squash. Expressions are
  // hand-placed pixel variants; a blink (or sleep) closes any open eye.
  const eyeY = Math.round(topY + h * 0.3);
  const eye = ([a, b], open) => {
    put(a, eyeY, "E"); put(b, eyeY, "E");
    if (open) { put(a, eyeY - 1, "E"); put(b, eyeY - 1, "E"); }
  };
  const heart = (left) => {
    [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]]
      .forEach(([dx, dy]) => put(left + dx, eyeY - 1 + dy, "C"));
  };
  if (face === "love" && !blink) {
    heart(7); heart(14);
  } else if (face === "wink") {
    eye([8, 9], !blink); eye([14, 15], false);
  } else {
    eye([8, 9], !blink); eye([14, 15], !blink);
    if (face === "grump" && !blink) { put(9, eyeY - 2, "E"); put(14, eyeY - 2, "E"); }
  }
  put(11, eyeY + 2, "M"); put(12, eyeY + 2, "M");
  if (mouthOpen || face === "ooh") {
    put(11, eyeY + 3, "M"); put(12, eyeY + 3, "M");
  } else if (face === "grump") {
    put(10, eyeY + 3, "M"); put(13, eyeY + 3, "M"); // corners drop: a frown
  }
  if (face !== "love") { put(7, eyeY + 1, "C"); put(16, eyeY + 1, "C"); }

  // Accessory rides the head apex: hy is the first body row (y > topY - 0.5).
  if (ACCESSORY_PIXELS[accessory]) {
    const hy = Math.round(topY);
    for (const [x, dy, c] of ACCESSORY_PIXELS[accessory])
      if (g[hy + dy]?.[x] !== undefined) g[hy + dy][x] = c;
  }

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
  const colors = [null, "B", "O", "L", "S", "N", "E", "C", "H", "R", "Y", "G"];
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

// Boing schedule: [squash, lift, mouthOpen] per tick — anticipate, jump,
// land, settle. Shared by the live click-to-boing and the boing loop.
export const BOING = [
  [0.84, 0, 0], [0.84, 0, 0],
  [1.16, 1, 1], [1.22, 3, 1], [1.18, 4, 1], [1.12, 3, 1], [1.05, 1, 1],
  [0.82, 0, 0], [0.92, 0, 0], [1.06, 0, 0], [0.97, 0, 0],
];
// The loop closes the seam with rest ticks: settle ends at 0.97, rest sits at
// 1.0, and the next pass opens on the 0.84 anticipation squash.
const BOING_REST = 5;
export const BOING_LOOP = [...BOING, ...Array.from({ length: BOING_REST }, () => [1, 0, 0])];

// Deterministic loop schedules per animation mode. Live-only flourishes
// (random blinks) are omitted so the seam always closes cleanly.
export const IDLE_FRAMES = 17;
export const SLEEP_FRAMES = FPS * 4;

export function modeGrids(mode, { face = "happy", accessory = "none" } = {}) {
  if (mode === "sleep") {
    return Array.from({ length: SLEEP_FRAMES }, (_, frame) => {
      const progress = frame / SLEEP_FRAMES;
      // Sleep is one complete pose; the saved awake expression is intentionally
      // ignored — but the accessory stays on (you sleep in your crown).
      return renderGrid(1 + 0.04 * Math.sin(2 * Math.PI * progress), 0,
        { blink: true, sleepProgress: progress, accessory });
    });
  }
  if (mode === "boing") {
    return BOING_LOOP.map(([s, lift, mo]) =>
      renderGrid(s, lift, { mouthOpen: !!mo, face, accessory }));
  }
  return Array.from({ length: IDLE_FRAMES }, (_, frame) =>
    renderGrid(1 + 0.055 * Math.sin((2 * Math.PI * frame) / IDLE_FRAMES), 0, { face, accessory }));
}

// Slug codec. Tokens are order-insensitive and unknown tokens are ignored, so
// links never break as parts are added — a bad link degrades to the default pet.
export const MODES = ["idle", "boing", "sleep"];
export const FACES = ["happy", "wink", "ooh", "grump", "love"];
export const ACCESSORIES = ["bow", "sprout", "crown", "party"];
export const DEFAULT_PET = { flavor: "lime", mode: "idle", face: "happy", accessory: "none" };

export function parseSlug(slug) {
  const pet = { ...DEFAULT_PET };
  for (const token of String(slug ?? "").toLowerCase().split("-")) {
    if (FLAVORS[token]) pet.flavor = token;
    else if (MODES.includes(token)) pet.mode = token;
    else if (FACES.includes(token)) pet.face = token;
    else if (ACCESSORIES.includes(token)) pet.accessory = token;
  }
  return pet;
}

export function stateSlug(flavor, mode, face = DEFAULT_PET.face, accessory = DEFAULT_PET.accessory) {
  const tokens = [];
  if (flavor !== DEFAULT_PET.flavor) tokens.push(flavor);
  if (face !== DEFAULT_PET.face) tokens.push(face);
  if (accessory !== DEFAULT_PET.accessory) tokens.push(accessory);
  if (mode !== DEFAULT_PET.mode) tokens.push(mode);
  return tokens.join("-");
}

// Gift tag: a recipient name and note ride next to the slug as ?to=/&note= query
// params. They're free text — unlike slug tokens they need sanitizing, and the page
// and pet-page share this cleaner so the tag the recipient sees matches the unfurl.
// An empty `to` means "not a gift"; a note without a recipient is ignored.
export const GIFT_MAX = { to: 24, note: 80 };
export const NAME_MAX = 16;

// Shared free-text cleaner: strip control chars, collapse whitespace, cap length.
export function cleanText(value, max) {
  return String(value ?? "").replace(/\p{C}/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanGift({ to, note } = {}) {
  const gift = { to: cleanText(to, GIFT_MAX.to), note: cleanText(note, GIFT_MAX.note) };
  if (!gift.to) gift.note = "";
  return gift;
}

// Name-seeded pets: the same name always divines the same jelly — two people
// comparing get provably "their" pet, which is the whole share hook. FNV-1a
// over the normalized name; independent bit ranges pick each part so flavors,
// faces, and accessories mix freely. Mode stays idle: the reveal needs a face.
export function seedPet(name) {
  const norm = cleanText(name, NAME_MAX).toLowerCase();
  let h = 0x811c9dc5;
  for (const char of norm) {
    h ^= char.codePointAt(0); // per code point: emoji names don't split surrogates
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const flavors = Object.keys(FLAVORS);
  const accessories = ["none", ...ACCESSORIES];
  return {
    flavor: flavors[h % flavors.length],
    face: FACES[(h >>> 8) % FACES.length],
    accessory: accessories[(h >>> 16) % accessories.length],
    mode: "idle",
  };
}

// Store-only ZIP writer for the emoji pack. GIF payloads are already
// LZW-compressed, so storing them keeps the container dependency-free
// without a meaningful size cost.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function makeZip(files) {
  const bytes = [];
  const word = (v) => bytes.push(v & 0xff, (v >> 8) & 0xff);
  const dword = (v) => bytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  const entries = [];

  for (const { name, data } of files) {
    const nameBytes = [...name].map((char) => char.charCodeAt(0));
    const crc = crc32(data);
    entries.push({ nameBytes, crc, size: data.length, offset: bytes.length });
    dword(0x04034b50); word(20); word(0); word(0); word(0); word(0);
    dword(crc); dword(data.length); dword(data.length);
    word(nameBytes.length); word(0);
    bytes.push(...nameBytes, ...data);
  }

  const dirStart = bytes.length;
  for (const { nameBytes, crc, size, offset } of entries) {
    dword(0x02014b50); word(20); word(20); word(0); word(0); word(0); word(0);
    dword(crc); dword(size); dword(size);
    word(nameBytes.length); word(0); word(0); word(0); word(0);
    dword(0); dword(offset);
    bytes.push(...nameBytes);
  }
  const dirSize = bytes.length - dirStart;
  dword(0x06054b50); word(0); word(0); word(entries.length); word(entries.length);
  dword(dirSize); dword(dirStart); word(0);
  return new Uint8Array(bytes);
}
