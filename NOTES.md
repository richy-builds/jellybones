# Jellybones — project notes

*A pixel pet maker: customize a little jelly creature (with a bone inside), watch it wobble, export a looping GIF.*

## The idea

A **character maker, not a general pixel editor**. Visitors customize a jelly pet from
designed parts (flavor/color, later: accessories, expressions), pick an animation, and
export a GIF for Slack, GitHub profiles, etc. Constraints are the craft: every output
looks good because the parts are designed, which is what makes people share results.

**Goals:** looks good, fun, shippable in days, iterable, LinkedIn-postable, design-portfolio-worthy.

**Key differentiator found in research:** existing makers (Picrew, Square Face Generator,
Avatars in Pixels) all export *static* images. Animated GIF output is the gap Jellybones fills.

## Decisions log

- **2026-07-14 — Maker over editor.** A freeform editor demands drawing skill (blank-canvas
  problem); a constrained maker guarantees cute output. Also dodges competing with Aseprite/Piskel.
- **2026-07-14 — Spike before any docs/UI.** The make-or-break risk is whether the character
  is charming; that's judged with eyes, not documents. Spike = `index.html`, one character,
  idle wobble + blink + click-to-boing, 3 flavor palettes.
- **2026-07-14 — Procedural rendering, no sprite sheets.** The blob is math (dome profile ×
  squash factor) rasterized to a 24×24 grid each frame; face/bone/shine/shadow are placed
  relative to the body. This is what makes one animation cycle work across every future
  part combination — the trick that keeps scope to days.
- **2026-07-14 — Chunky clock.** Animation clock quantized to 12 fps. Smooth 60 fps motion
  kills the pixel charm; the steppiness *is* the aesthetic.
- **2026-07-14 — Shape iterations.** Pointy droplet → read as a cone; flat dome → read as a
  loaf; circular dome over top 55% → square with a nub. Landed on: circular dome over top
  70%, straight sides to a flat base (flan/pudding profile — fitting for a jelly).
- **2026-07-14 — Face/bone layout.** Bone low (rows base−4…base−2), face high (eyes at 30%
  of body height). First attempt had the bone under the mouth and it read as buckteeth.
- **2026-07-14 — Dependency-free GIF export.** Keep the zero-build spike self-contained:
  encode indexed GIF89a frames directly from `renderGrid`, with the current flavor's compact
  palette and transparent background. The export is a deterministic 17-frame idle loop;
  random live blinks are omitted so the seam always closes cleanly.
- **2026-07-15 — Pet state lives in the URL.** Sharing is the growth loop, so every pet is a
  link: canonical `/p/<slug>` (needs a rewrite at deploy), `?p=<slug>` on any static server.
  Slug tokens (`strawberry-sleep`) are order-insensitive and unknown tokens are ignored, so
  links never break as parts are added. Hash was rejected: fragments never reach the server,
  which would make per-pet OG previews impossible later.
- **2026-07-15 — Core extracted to `jelly-core.mjs` (ES module).** One pure module (renderer,
  GIF encoder, slug codec) imported by both the page and the Vercel functions — per-pet OG
  previews and the GIF endpoint reuse the exact pixels the browser draws. Verified
  byte-identical exports (sha256) before/after. Tradeoff: modules kill `file://` dev; use
  `python3 -m http.server`.
- **2026-07-15 — OG images are GIFs from `/api/pet-gif`, not PNGs.** Reuses the existing
  encoder, zero new dependencies, and unfurls *animate* where platforms allow it. `bg=1`
  composites onto the page ink because transparent og:images render unpredictably;
  the transparent default is GitHub-README-embeddable — a distribution surface in itself.
- **2026-07-15 — `?p=` is dev-only; canonical `/p/` on any real host.** Static files beat
  rewrites on Vercel, so `/?p=<slug>` can never reach `pet-page` and unfurled as the lime
  default (caught live in Slack). The app now writes `/p/<slug>` to the address bar except
  on file:// and localhost, so copy-link and address-bar shares always use the form that
  unfurls. `?p=` still parses on load for old links.
- **2026-07-15 — Per-pet meta via marker swap.** `/p/:slug` rewrites to `api/pet-page.mjs`,
  which swaps the `<!-- pet-meta -->` block in `index.html` for pet-specific title/OG tags.
  Root `/` stays static.
- **2026-07-15 — Boing is a mode, not just a click.** The `[squash, lift, mouthOpen]`
  schedule moved into the core; the loop closes its seam with 5 rest ticks (settle ends at
  0.97, rest sits at 1.0, next pass opens on the 0.84 anticipation squash). Click-to-boing
  in idle is unchanged and shares the same schedule. Export follows the selected mode.
- **2026-07-15 — Expressions are pixel deltas, not new art.** Five faces (happy / wink /
  ooh / grump / love) are hand-placed pixel variants inside `renderGrid`, drawn with `put()`
  so they clip gracefully against any squash. A blink (or sleep) closes any open eye, which
  is what lets every face work with every animation for free. Faces are slug tokens like
  everything else. `renderGrid`'s tail args became an options object before they hit six.
- **2026-07-15 — Emoji pack is a hand-written store-only zip.** The GIF payloads are
  already LZW-compressed, so storing them costs nothing and keeps the pack dependency-free
  like the encoder. GIFs are 120×120 (scale 5) to sit under Slack's 128 px emoji size;
  the whole three-animation pack is ~60 KB against Slack's 128 KB per-emoji cap.
- **2026-07-15 — Copy scrubbed for the public.** "spike 001 · proof of charm" →
  "pixel pet maker"; the footer drops "no sprites". README added with an embedded
  live pet GIF (the transparent `/api/pet-gif` default exists for exactly this).
- **2026-07-19 — Pets have names; names ride `?name=`, never the slug.** A named pet is a
  character, not a graphic — attachment is what makes people post it where strangers see
  it. Free text follows the gift-field pattern (shared `cleanText` in the core, 16-char
  cap, sanitized identically by page and pet-page so the nameplate matches the unfurl).
  Named pets unfurl as "Boba the winking blueberry jelly"; exports and Slack emoji
  filenames take the name (`:boba-boing:`), which is the distribution surface talking.
- **2026-07-19 — Accessories are head-apex pixel lists; flavors doubled to six.** One
  accessory slot (bow/sprout/crown/party), each a hand-placed `[x, dy, color]` list
  anchored to the top body row so it rides every squash free, clipping gracefully at the
  boing apex. Head-top mounting was chosen over glasses/held items because it can't
  collide with faces or blinks. R/Y/G joined `COMMON` (GIF palette now 12 of 16 slots).
  Uniqueness math: 45 combos → 450; "my pet" has to be plausibly unique before
  name-seeding can land. `modeGrids(mode, face)` became `modeGrids(mode, opts)` before
  its args hit three.
- **2026-07-19 — Name-seeding is FNV-1a in the core, revealed with a boing.** _[Superseded —
  removed 2026-07-20; see below.]_ "✨ pet
  from your name" hashes the normalized name into flavor/face/accessory (150 outcomes,
  verified evenly distributed and fully reachable). Determinism is the product: the same
  name divines the same jelly on anyone's machine, so shared results are provably "yours"
  and every share is an implicit prompt to try your own. Deliberately client-only — no
  new endpoint; a seeded pet is just state, and the existing share/unfurl loop carries it.
- **2026-07-19 — Wardrobe to 13; the seed pool is frozen.** Nine more accessories
  (halo/flower/cherry/ears/cowboy/mushroom/antenna/egg/star) in the same head-apex pixel
  system; only the cowboy needed a new palette slot (`T` tan — 13 of 16 GIF slots used).
  `seedPet` now draws from frozen `SEED_*` snapshot lists, not the live ones: growing
  `FLAVORS`/`ACCESSORIES` later must never reshuffle a seeded pet someone already shared.
  New parts stay makeable and shareable but not seedable unless the seed algorithm is
  deliberately re-versioned; golden name→pet mappings in `verify.mjs` hold the line.
  The extra picker became a CSS grid — 14 `flex: 1` children shrink to slivers instead
  of wrapping. (Also learned: headless Chrome clamps windows to 500px wide; screenshot
  narrow layouts inside a fixed-width iframe.)
- **2026-07-20 — World Cup moment: a `kickups` juggle mode + ¡Campeones! banner.**
  Spain won the final (2026-07-19), so a timely, viral hook: one new *evergreen* animation
  (`kickups`) plus one *date-gated* promo (the ¡Campeones! banner → strawberry + kickups +
  the name, one tap). The ball is a single `BALL` sprite (cream shell + one central `H`
  pentagon — no new palette slot) drawn flying its own 11-frame arc via a new `renderGrid`
  `ball` option, independent of the body squash, while the jelly pulses up to *head* it at
  the loop seam. A red/gold confetti burst pops on the header contact — fixed Spain colours,
  deliberately NOT flavor-tinted, since the confetti *is* the Spain signal (a green jelly
  must still throw red/gold); it also reads as generic celebration, so `kickups` stays
  evergreen. The banner carries a drawn red-yellow-red flag chip, not the 🇪🇸 emoji (which is
  bare "ES" on Windows Chrome/Edge, and a flat chip suits the pixels anyway). **Tried a
  `football` head accessory too and cut it:** a ball-on-head plus the juggled ball stacked
  into a two-ball totem, and "a kickups motion AND a football extra" read as redundant — so
  the ball lives only as the mode. One scar worth keeping: the ball's first sprite had two
  symmetric top panels and read as a *skull* (fatal on a project called jellybones), so it's
  a single centred pentagon now, the ⚽ glyph. Unknown tokens degrade gracefully, so
  `…-kickups` links stay valid forever; only the banner auto-expires (`CAMPAIGN_UNTIL`,
  ~3 weeks) and lifts out as one block.
- **2026-07-20 — Removed name-seeding (kept naming). A hash isn't an identity.** "✨ pet
  from your name" looked like a "which ___ are you?" viral toy but lacked the ingredient that
  spreads those: a felt, *legible* link between you and the result. A hash gives determinism
  ("provably yours") but not meaning ("that's so me"), and meaning is what makes people post —
  so the mechanic never earned its keep. The clincher was cost, not just weak upside:
  determinism was the *sole* reason the seed pools had to be FROZEN, which taxed every new
  part with "is this seedable? will it reshuffle a shared seed?" (felt live when the football
  had to dodge the pool). Deleting `seedPet`/`SEED_*` + the button collapses that whole class
  of constraint — parts just get added now, no freeze, fewer tests. Naming stays (a name makes
  it a character; that one works); old `?p=` links are unaffected (a seeded pet was only ever
  ordinary state). If analytics ever say it landed, it's cheap to rebuild — ideally with a
  meaning layer (archetype labels) next time, which is what a hash-only version was missing.
- **2026-07-15 — Checks live in the repo, not in heads.** `verify.mjs` (plain Node, no
  framework — the core is pure, so nothing else is needed) covers slug round-trips, GIF
  structure, Slack emoji caps, zip CRCs, and mock-tests both functions. `AGENTS.md` records
  the working rules: zero deps, pure core, links never break, push-to-main deploys prod.
- **2026-07-14 — Sleep stays subtle.** A 4-second breathing loop reuses the procedural body
  deformation at lower amplitude, with closed eyes and one drifting pixel Z. The mode becomes
  a static sleeping pose when reduced motion is requested; poking the jelly wakes it.
- **2026-07-15 — Sleep is one complete pose.** Expressions are awake customization, so the
  expression picker hides during sleep and the renderer ignores the saved face until the pet
  wakes. The face stays in URL state so waking or revisiting the link restores the user's choice.
- **2026-07-15 — Expressions are a visual palette, not a second mode switch.** Motion keeps
  the segmented control; expressions use cropped portraits drawn by the shared procedural
  renderer and recolor with flavor. This separates the two concepts without explanatory copy.
- **2026-07-15 — Customization becomes one responsive workbench.** Desktop pairs the large
  preview with a 380 px Customize panel; below 800 px the same panel stacks beneath the pet.
  Flavor, face, motion, and output stay visible instead of moving into drawers or accordions.
- **2026-07-15 — Public language can differ from stable state tokens.** The UI and downloads
  call idle motion "wobble," while slugs and renderer modes keep `idle` so old links survive.
  Share uses the native device sheet when available and falls back to copying the canonical URL.
- **2026-07-15 — Removed the technical footer metadata from the main UI.** `24×24 px · 12 fps ·
  all math` was a nice implementation signature but made the maker feel more like a demo; the
  pet and customization controls should carry the page.
- **2026-07-15 — Gift mode: pets are addressed, not just shared.** The viral loop is "someone
  made this *for you*", so a recipient name + note ride the URL as `?to=`/`&note=` query params
  next to the slug — free text never becomes slug tokens. `cleanGift` in the core (strip control
  chars, collapse whitespace, cap 24/80, note requires a name) is shared by the page and
  `pet-page`, so the gift tag matches the unfurl. The tag over the pet doubles as a live preview
  while composing; an arriving gift adds a "send one back" CTA that clears the fields — the
  loop-closer. Gifted default pets canonicalize to `/p/<flavor>` (round-trips through
  `parseSlug`) so even an uncustomized gift unfurls addressed. URL sync from the inputs is
  debounced because Safari rate-limits `replaceState`.
- **2026-07-15 — Gift-tag ornaments follow the face, not a setting.** Hearts around "for sam"
  clash with a grump jelly, but a toggle would be config creep. The face is already the mood
  the sender chose, so the tag speaks it: happy ♥ · love ♥♥ · wink ☆ · ooh ! · grump · (deadpan
  dots). Ornaments are aria-hidden spans (readers hear just "for sam"), built in DOM rather
  than CSS pseudo-content so every browser renders them.
- **2026-07-15 — Gift tag sits inside the canvas's empty air.** The top ~7 grid rows are
  always transparent (dome starts at row 7; boing peaks at row 3 ≈ 42px), so the tag pulls
  down 28px into the canvas (`margin-bottom: -56px`, z-indexed above it) and reads as part
  of the character, not page chrome. Type scaled up to 19px/13px to carry the moment.
- **2026-07-15 — "Send one back" is arrival-only, remembered on-device.** A sender reloading
  their own composed link is indistinguishable from a recipient arriving, so composed gift
  signatures (`to\note`, last 50) are kept in localStorage and matching arrivals skip the
  "someone made this for you" treatment. Wrong only across devices/private mode, where it
  errs toward showing the arrival view — the safe direction. No backend, consistent with
  URL-as-state.
- **2026-07-15 — Share/send is the primary action.** The URL is the growth loop, so share
  (or "send to <name>" when gifted) takes the full-width milk button; GIF export and the
  emoji pack drop to the secondary pair. Export labels shorten to "<motion> gif" to fit
  the half-width slot.
- **2026-07-15 — Social previews use 384 px GIFs.** X large-image cards reject the prior
  288 px rendition (their minimum width is 300 px), so OG/Twitter previews now request
  `scale=16` while the downloadable and emoji outputs keep their existing dimensions.

## Character spec (spike)

- Grid 24×24, drawn at 14× scale, `image-rendering: pixelated`
- Body height 13 px, half-width 7.5 px; squash `s = 1 + 0.055·sin(t)`, period ~1.4 s;
  width scales by `1/√s` (volume conservation)
- Outline = body pixel with an empty 4-neighbour; inner "translucent" tint = 2 erosions in
- Blink every 2.5–5.5 s for 2 ticks; click = boing (2-tick anticipation squash, 4-px jump
  with open mouth, landing squash, settle)
- Shadow widens on squash, shrinks when airborne
- Palette: deep blueberry-ink page (#171129), milk-cream bone/text (#f6eedc);
  flavors lime / strawberry / blueberry, each with body + outline + light + shine + page glow

## Research sources

Pixel animation technique:

- [Lospec idle-animation tutorials](https://lospec.com/pixel-art-tutorials/tags/idle) — idle cycles are typically ~4 frames
- [Sandro Maglione — pixel character animations guide](https://www.sandromaglione.com/articles/pixel-art-character-animations-guide) — 1 px bounce with 1-frame delay on secondary parts
- [Pedro Medeiros — Pixel Grimoire animation basics](https://medium.com/pixel-grimoire/how-to-start-making-pixel-art-3-c9eb70270fa1)
- [Pixilart — squash & stretch tutorial](https://www.pixilart.com/tutorial/animation-squash-stretch-61)
- [Pixnote — sprite FPS guide](https://pixnote.net/en/learn/animation/) — idles read well around 6–12 fps; 1–3 px shifts are enough
- [Sprite-AI — 12 animation principles for pixel art](https://www.sprite-ai.art/guides/animation-principles)

Maker landscape (all static output — the gap Jellybones fills):

- [Picrew](https://picrew.me/en/) and e.g. [cute pixel character maker](https://picrew.me/en/image_maker/1929778)
- [Avatars in Pixels](https://www.avatarsinpixels.com/)
- [Square Face Generator](https://squarefacegenerator.app/) — 200+ options, no signup; good UX reference
- [Pixel cat maker](https://www.squarefacegenerators.com/pixel-cat-maker)

Tone/presentation reference:

- [Pica](https://coachme-pica.vercel.app) — pixel cat mascot landing page; multiple mascot
  states as brand personality, conversational copy. (Note: its cream + terracotta look is
  the current AI-default palette — Jellybones deliberately went candy-shop-at-night instead.)

## v1 scope (post-spike)

Customization (flavors → accessories → expressions) · 3 animations (idle / boing / sleep) ·
client-side GIF export · deploy to Vercel.

**Not doing at v1:** freeform pixel drawing, accounts, shared gallery, sound.

## Next steps

- [x] Verify the boing + flavor swap feel good in a real browser — boing confirmed 2026-07-14
- [x] `git init` so editor-buffer accidents can't eat work (one already happened)
- [x] GIF export spike — 192×192 transparent loop, 17 frames / 1.42 s, ~21 KB; verified in Chrome
- [x] Second animation cycle — 4-second breathe, closed eyes, drifting Z; verified desktop/mobile
- [x] Animation-aware GIF export (idle / boing / sleep) — boing loop seam closed with rest
      ticks; export button follows the selected mode (2026-07-15)
- [x] Phase 3: expressions (5 faces as slug tokens: happy / wink / ooh / grump / love) +
      one-click Slack emoji pack (store-only zip, hand-written, 120×120 GIFs) — 2026-07-15
- [x] Public copy scrub + README with embedded live pet GIF (2026-07-15)
- [x] URL state spike — `?p=flavor-mode` synced live + copy-link button; headless-Chrome verified
- [x] OG link previews — per-pet HTML meta (`api/pet-page.mjs`) + animated GIF endpoint
      (`api/pet-gif.mjs`), `/p/*` rewrite in `vercel.json`; mock-tested in Node
- [x] Deployed to https://jellybones.vercel.app (2026-07-15) — root, `/p/<slug>` meta, and
      `/api/pet-gif` all verified live via curl
- [x] Gift mode — `?to=`/`&note=` on any pet URL, live-preview gift tag, addressed OG
      unfurls, "send one back" CTA (2026-07-15)
- [ ] Paste a `/p/...` link into Slack/iMessage to verify the unfurl renders the pet
- [ ] Paste a gifted link (`/p/...?to=...&note=...`) somewhere real to verify the addressed unfurl
- [x] World Cup moment — `kickups` juggle mode + red/gold confetti + banner-with-flag +
      date-gated ¡Campeones! preset; football accessory tried and cut (2026-07-20)
- [x] Removed name-seeding — a hash isn't an identity, and it was the sole source of the
      frozen seed-pool complexity. Naming kept. (2026-07-20)
- [ ] After ~2026-08-10: retire the ¡Campeones! banner block (parts stay; links stay valid)
