// Per-pet page: /p/<slug> (rewritten here) serves index.html with the
// <!-- pet-meta --> block swapped for pet-specific title/OG tags, so every
// shared link unfurls with its own animated jelly.
import { readFileSync } from "node:fs";
import { cleanGift, FLAVORS, parseSlug, stateSlug } from "../jelly-core.mjs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const escape = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const FACE_ADJ = { wink: "winking", ooh: "surprised", grump: "grumpy", love: "lovestruck" };
const MODE_PHRASE = { sleep: ", sleeping", boing: ", mid-boing" };

export default function handler(req, res) {
  const { flavor, mode, face } = parseSlug(req.query.p);
  const slug = stateSlug(flavor, mode, face);
  const { to, note } = cleanGift(req.query);
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "jellybones.vercel.app";
  const base = `https://${host}`;
  const adjective = mode !== "sleep" && FACE_ADJ[face] ? `${FACE_ADJ[face]} ` : "";
  // Gifted links unfurl addressed to the recipient; the note becomes the description.
  const title = to
    ? `a ${adjective}${flavor} jelly for ${to} · jellybones`
    : `a ${adjective}${flavor} jelly${MODE_PHRASE[mode] ?? ""} · jellybones`;
  const description = to
    ? (note
      ? `“${note}” — a tiny pixel pet, made just for you. Poke it, send one back.`
      : "Someone made you a tiny pixel pet. Poke it, remix it, send one back.")
    : "Someone made you a tiny pixel pet. Poke it, remix it, export the gif.";
  const image = `${base}/api/pet-gif?p=${slug}&bg=1&scale=12`;
  // Default pets have an empty slug; gifts still get a real /p/ path (`flavor`
  // round-trips through parseSlug) so the unfurl stays personal.
  const giftQuery = to ? `?${new URLSearchParams(note ? { to, note } : { to })}` : "";
  const url = `${base}/p/${slug || (to ? flavor : "")}${giftQuery}`;

  const meta = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}">`,
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escape(url)}">`,
    `<meta property="og:image" content="${escape(image)}">`,
    `<meta property="og:image:type" content="image/gif">`,
    `<meta property="og:image:width" content="288">`,
    `<meta property="og:image:height" content="288">`,
    `<meta property="og:image:alt" content="${escape(title)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${escape(image)}">`,
  ].join("\n");

  const html = page.replace(/<!-- pet-meta -->[\s\S]*<!-- \/pet-meta -->/, meta);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
  res.status(200).send(html);
}
