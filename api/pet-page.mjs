// Per-pet page: /p/<slug> (rewritten here) serves index.html with the
// <!-- pet-meta --> block swapped for pet-specific title/OG tags, so every
// shared link unfurls with its own animated jelly.
import { readFileSync } from "node:fs";
import { FLAVORS, parseSlug, stateSlug } from "../jelly-core.mjs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const escape = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export default function handler(req, res) {
  const { flavor, mode } = parseSlug(req.query.p);
  const slug = stateSlug(flavor, mode);
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "jellybones.vercel.app";
  const base = `https://${host}`;
  const title = `a ${flavor} jelly${mode === "sleep" ? ", sleeping" : ""} · jellybones`;
  const description = "Someone made you a tiny pixel pet. Poke it, remix it, export the gif.";
  const image = `${base}/api/pet-gif?p=${slug}&bg=1`;

  const meta = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}">`,
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${base}/p/${slug}">`,
    `<meta property="og:image" content="${escape(image)}">`,
    `<meta name="twitter:card" content="summary">`,
  ].join("\n");

  const html = page.replace(/<!-- pet-meta -->[\s\S]*<!-- \/pet-meta -->/, meta);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
  res.status(200).send(html);
}
