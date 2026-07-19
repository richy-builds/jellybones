// Per-pet page: /p/<slug> (rewritten here) serves index.html with the
// <!-- pet-meta --> block swapped for pet-specific title/OG tags, so every
// shared link unfurls with its own animated jelly.
import { readFileSync } from "node:fs";
import { NAME_MAX, cleanGift, cleanText, parseSlug, stateSlug } from "../jelly-core.mjs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const escape = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const FACE_ADJ = { wink: "winking", ooh: "surprised", grump: "grumpy", love: "lovestruck" };
const MODE_PHRASE = { sleep: ", sleeping", boing: ", mid-boing" };

export default function handler(req, res) {
  const { flavor, mode, face } = parseSlug(req.query.p);
  const slug = stateSlug(flavor, mode, face);
  const { to, note } = cleanGift(req.query);
  const name = cleanText(req.query.name, NAME_MAX);
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "jellybones.vercel.app";
  const base = `https://${host}`;
  const adjective = mode !== "sleep" && FACE_ADJ[face] ? `${FACE_ADJ[face]} ` : "";
  // Named pets unfurl as characters; gifted links unfurl addressed to the
  // recipient; the note becomes the description.
  const jelly = `a ${adjective}${flavor} jelly`;
  const title = to
    ? `${name ? `${name}, ${jelly}` : jelly} for ${to} · jellybones`
    : (name
      ? `${name} the ${adjective}${flavor} jelly${MODE_PHRASE[mode] ?? ""} · jellybones`
      : `${jelly}${MODE_PHRASE[mode] ?? ""} · jellybones`);
  const description = to
    ? (note
      ? `“${note}” — a tiny pixel pet, made just for you. Poke it, send one back.`
      : "Someone made you a tiny pixel pet. Poke it, remix it, send one back.")
    : (name
      ? `Meet ${name}, a tiny pixel pet. Poke it, remix it, export the gif.`
      : "Someone made you a tiny pixel pet. Poke it, remix it, export the gif.");
  // X large-image cards require an image at least 300px wide. Scale 16 gives
  // crawlers a compact 384px GIF while the underlying pet remains 24×24.
  const image = `${base}/api/pet-gif?p=${slug}&bg=1&scale=16`;
  // Default pets have an empty slug; gifts and named pets still get a real /p/
  // path (`flavor` round-trips through parseSlug) so the unfurl stays personal.
  const extras = new URLSearchParams();
  if (name) extras.set("name", name);
  if (to) extras.set("to", to);
  if (to && note) extras.set("note", note);
  const query = extras.toString();
  const url = `${base}/p/${slug || (to || name ? flavor : "")}${query ? `?${query}` : ""}`;

  const meta = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}">`,
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escape(url)}">`,
    `<meta property="og:image" content="${escape(image)}">`,
    `<meta property="og:image:type" content="image/gif">`,
    `<meta property="og:image:width" content="384">`,
    `<meta property="og:image:height" content="384">`,
    `<meta property="og:image:alt" content="${escape(title)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escape(title)}">`,
    `<meta name="twitter:description" content="${escape(description)}">`,
    `<meta name="twitter:image" content="${escape(image)}">`,
    `<meta name="twitter:image:alt" content="${escape(title)}">`,
  ].join("\n");

  const html = page.replace(/<!-- pet-meta -->[\s\S]*<!-- \/pet-meta -->/, meta);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
  res.status(200).send(html);
}
