# jellybones

Tiny wobbly pixel pets. Pick a flavor, pull a face, poke it, keep the gif.

**[jellybones.vercel.app](https://jellybones.vercel.app)**

![a strawberry jelly, wobbling](https://jellybones.vercel.app/api/pet-gif?p=strawberry&scale=8)

## How it works

- **All math, no image assets.** The jelly is a dome profile × a squash factor,
  rasterized to a 24×24 grid every frame at a chunky 12 fps. Awake faces work across
  wobble and boing; sleep is one canonical closed-eye pose that restores the chosen
  face when the pet wakes.
- **Every pet is a URL.** `/p/strawberry-love-boing` is a lovestruck strawberry
  jelly, mid-boing. Slug tokens are order-insensitive and unknown tokens are
  ignored, so old links keep working as new parts are added.
- **Pets can be gifts.** Add a name and a tiny note and the link arrives addressed:
  the page greets the recipient, the unfurl says who it's for, and a "send one back"
  button closes the loop.
- **Links unfurl animated.** Each `/p/<slug>` page carries its own OG tags and an
  animated GIF preview from `/api/pet-gif` — the same renderer the page uses.
- **Dependency-free export.** GIF89a frames (and the emoji-pack zip) are encoded
  by hand in `jelly-core.mjs`. The transparent GIFs embed anywhere — like this
  README.
- **Emoji pack.** One click zips all three animations at Slack-emoji size
  (120×120, well under the 128 KB cap).

## Run it locally

```sh
python3 -m http.server
```

Then open <http://localhost:8000>. ES modules won't load from `file://`. The
`/p/<slug>` pages and the GIF endpoint are Vercel functions — locally, pet state
uses `?p=<slug>` instead, or run `vercel dev` for the full thing.

## Layout

| File | What it is |
| --- | --- |
| `index.html` | the whole page: UI, animation loop, export buttons |
| `jelly-core.mjs` | pure shared core: renderer, GIF encoder, zip writer, slug codec |
| `api/pet-page.mjs` | serves `/p/<slug>` with per-pet OG meta |
| `api/pet-gif.mjs` | animated GIF endpoint (unfurl previews, README embeds) |
| `NOTES.md` | design decisions log |
