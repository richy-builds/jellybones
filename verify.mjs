// Repo check script — run `node verify.mjs` from the repo root.
// No test framework: jelly-core.mjs is pure, so everything checks in plain Node.
// Add `--faces` to print each expression as ASCII for eyeballing.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  BOING_LOOP, FACES, FLAVORS, MODES, GRID, IDLE_FRAMES, SLEEP_FRAMES,
  makeGif, makeZip, modeGrids, parseSlug, renderGrid, stateSlug,
} from "./jelly-core.mjs";

let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failures++;
};
const gifWidth = (gif) => gif[6] + (gif[7] << 8);

if (process.argv.includes("--faces")) {
  for (const face of FACES) {
    console.log(`\n--- face: ${face} ---`);
    const g = renderGrid(1, 0, { face });
    console.log(g.map((row) => row.join("").replace(/\./g, " ")).join("\n"));
  }
}

// Slug codec: every combination must round-trip, junk must degrade gracefully.
let badRoundTrips = 0;
for (const flavor of Object.keys(FLAVORS))
  for (const mode of MODES)
    for (const face of FACES) {
      const pet = parseSlug(stateSlug(flavor, mode, face));
      if (pet.flavor !== flavor || pet.mode !== mode || pet.face !== face) badRoundTrips++;
    }
check(`slug round-trips (${Object.keys(FLAVORS).length * MODES.length * FACES.length} combos)`, badRoundTrips === 0);
check("default pet has an empty slug", stateSlug("lime", "idle", "happy") === "");
check("unknown slug tokens are ignored", JSON.stringify(parseSlug("xyzzy-love-boing-!!")) ===
  JSON.stringify({ flavor: "lime", mode: "boing", face: "love" }));

// Every mode encodes to a structurally sound GIF with the expected frame count.
const expectFrames = { idle: IDLE_FRAMES, boing: BOING_LOOP.length, sleep: SLEEP_FRAMES };
for (const mode of MODES) {
  const grids = modeGrids(mode, "wink");
  check(`${mode}: ${expectFrames[mode]} frames`, grids.length === expectFrames[mode]);
  const gif = makeGif(grids, "strawberry");
  check(`${mode}: GIF89a header, trailer, ${GRID * 8}px`,
    String.fromCharCode(...gif.slice(0, 6)) === "GIF89a" && gif.at(-1) === 0x3b && gifWidth(gif) === GRID * 8);
}

// Emoji pack: scale-5 GIFs must sit under Slack's 128 px / 128 KB emoji caps.
const packFiles = MODES.map((mode) => ({
  name: `jelly-lime-grump-${mode}.gif`,
  data: makeGif(modeGrids(mode, "grump"), "lime", { scale: 5 }),
}));
for (const { name, data } of packFiles)
  check(`${name}: 120px, ${(data.length / 1024).toFixed(1)} KB < 128 KB`,
    gifWidth(data) === 120 && data.length < 128 * 1024);

const outDir = mkdtempSync(join(tmpdir(), "jellybones-"));
const zipPath = join(outDir, "pack.zip");
writeFileSync(zipPath, makeZip(packFiles));
try {
  execFileSync("unzip", ["-t", zipPath], { stdio: "pipe" });
  check("emoji pack zip passes unzip -t (CRC check)", true);
} catch (error) {
  check(`emoji pack zip passes unzip -t: ${error.message}`, false);
}

// Vercel functions, mock-tested in-process.
const mockRes = () => {
  const res = { headers: {}, body: null, code: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.code = c; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
};
const gifHandler = (await import("./api/pet-gif.mjs")).default;
const pageHandler = (await import("./api/pet-page.mjs")).default;

let res = mockRes();
gifHandler({ query: { p: "blueberry-love-boing", bg: "1", scale: "12" } }, res);
check("pet-gif: 200, image/gif, 288px",
  res.code === 200 && res.headers["Content-Type"] === "image/gif"
  && res.body.slice(0, 6).toString("ascii") === "GIF89a" && gifWidth(res.body) === 288);

res = mockRes();
pageHandler({ query: { p: "strawberry-grump-sleep" }, headers: { host: "jellybones.vercel.app" } }, res);
check("pet-page: face-aware title",
  res.code === 200 && res.body.includes("<title>a grumpy strawberry jelly, sleeping · jellybones</title>"));
check("pet-page: og:url keeps the full slug", res.body.includes("/p/strawberry-grump-sleep"));
check("pet-page: meta marker fully replaced", !res.body.includes("pet-meta"));

console.log(failures ? `\n${failures} FAILURES` : "\nall checks passed");
process.exit(failures ? 1 : 0);
