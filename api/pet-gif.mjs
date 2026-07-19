// Animated pet GIF endpoint: /api/pet-gif?p=<slug>[&bg=1][&scale=N]
// Transparent by default (README-embeddable); bg=1 composites onto the page
// ink for OG previews (transparent og:images render unpredictably).
import { PAGE_BG, makeGif, modeGrids, parseSlug } from "../jelly-core.mjs";

export default function handler(req, res) {
  const { flavor, mode, face, accessory } = parseSlug(req.query.p);
  const scale = Math.min(16, Math.max(2, parseInt(req.query.scale, 10) || 8));
  const bytes = makeGif(modeGrids(mode, { face, accessory }), flavor, {
    scale,
    background: req.query.bg === "1" ? PAGE_BG : null,
  });
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=31536000");
  res.status(200).send(Buffer.from(bytes));
}
