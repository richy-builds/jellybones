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
GIF export (gifenc or similar, client-side) · deploy to Vercel.

**Not doing at v1:** freeform pixel drawing, accounts, shared gallery, sound.

## Next steps

- [x] Verify the boing + flavor swap feel good in a real browser — boing confirmed 2026-07-14
- [x] `git init` so editor-buffer accidents can't eat work (one already happened)
- [ ] GIF export spike — second riskiest bit after character charm
- [ ] Second animation cycle (sleep: slow breathe + closed eyes + "z" pixels)
