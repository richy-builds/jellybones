# AGENTS.md — working on jellybones

A pixel pet maker, live at https://jellybones.vercel.app. `README.md` explains the
product; this file explains how to change it safely.

**Read `NOTES.md` first.** It is the binding decisions log — past choices (procedural
rendering, 12 fps clock, slug design, zip format) were made deliberately and are recorded
there with reasons. When you make a new design decision, append a dated entry.

## Hard constraints

- **Zero dependencies, zero build.** No npm, no bundler, no framework. The GIF encoder,
  zip writer, and renderer are hand-written in `jelly-core.mjs` on purpose. Don't add a
  package.json to solve a problem — solve it in the file.
- **`jelly-core.mjs` stays pure.** No DOM, no Node APIs. It's imported by both the page
  and the Vercel functions, which is what makes OG-preview GIFs byte-identical to what
  the browser renders. New rendering/encoding logic goes here, not in `index.html`.
- **Links never break.** Pet state is a slug of order-insensitive tokens
  (`/p/strawberry-love-boing`); unknown tokens are ignored and defaults are omitted.
  New features become new tokens with a default that keeps old slugs valid.
- **The character is math, not assets.** Parts (faces, accessories) are drawn relative
  to the body via `put()`, which clips against the current squash — that's what makes
  every part work across every animation with no extra art.

## Layout

| File | Role |
| --- | --- |
| `index.html` | the whole page: UI, animation loop, export/share buttons |
| `jelly-core.mjs` | pure shared core: renderer, GIF encoder, zip writer, slug codec |
| `api/pet-page.mjs` | serves `/p/<slug>` (rewritten in `vercel.json`) with per-pet OG meta |
| `api/pet-gif.mjs` | animated GIF endpoint — og:images, README embeds, `bg=1` for opaque |
| `verify.mjs` | check script (see below) |
| `NOTES.md` | decisions log — append, don't rewrite history |

## Local dev

```sh
python3 -m http.server   # then http://localhost:8000
```

ES modules won't load from `file://`. On localhost, pet state uses `?p=<slug>`
(the `/p/` form needs the Vercel rewrite — use `vercel dev` if you need the
functions locally, though `verify.mjs` mock-tests them without it).

**Hard-refresh (⌘⇧R) after `jelly-core.mjs` gains an export.** `http.server` sends no
`Cache-Control`, so browsers heuristically cache the module; a fresh `index.html`
importing a name the stale module lacks kills the whole script (blank pet, no controls).

## Verifying changes

```sh
node verify.mjs           # slug round-trips, GIF structure, emoji caps, zip CRCs, API handlers
node verify.mjs --faces   # also prints each expression as ASCII — eyeball new pixel art this way
```

Keep `verify.mjs` in step with new features (new modes/faces/tokens get checks).
For UI changes, also load the page in headless Chrome and confirm no console errors
and that a slug like `?p=strawberry-love-boing` presses the right buttons:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --virtual-time-budget=4000 --dump-dom "http://localhost:8000/?p=strawberry-love-boing"
```

Anything charm-related (wobble feel, face readability, loop seams) ultimately needs
human eyes — say so rather than declaring it verified.

## Deploying

- **Pushing to `main` deploys production.** Vercel git integration handles it; there is
  no separate deploy step and no reason to run `vercel deploy`. So: only push verified
  work, and don't push mid-task.
- The remote is HTTPS as the `richy-builds` GitHub account. The machine's default
  SSH/`gh` identity is a different (work) account — don't switch the remote to SSH.
- Post-deploy smoke test:

```sh
curl -s https://jellybones.vercel.app/ | grep eyebrow                      # page serves
curl -s https://jellybones.vercel.app/p/strawberry-love-boing | grep '<title>'  # per-pet meta
curl -sI "https://jellybones.vercel.app/api/pet-gif?p=grump-sleep" | head -1    # GIF endpoint
```

## Conventions

- Commit messages: short, present tense, say the *why* when it isn't obvious
  (see `git log --oneline`).
- Sizes matter: Slack emoji GIFs must stay 120×120 and under 128 KB; OG images are
  288×288 (`scale=12`, `bg=1`).
